"""
RAG Pipeline for Medical Report Extraction
==========================================
Torch-free implementation using:
  - pdfplumber / python-docx  for document parsing
  - sklearn TF-IDF + cosine   for vector search  (no torch, no DLL issues)
  - Groq Qwen LLM             for structured extraction

Pipeline:
  PDF/DOCX -> Text -> TF-IDF chunks -> Cosine retrieval -> Groq Qwen -> JSON
"""

import os
import io
import re
import json
import logging
import warnings

warnings.filterwarnings("ignore")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────
GROQ_API_KEY = "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"
GROQ_MODEL = "qwen/qwen3-32b"

# ── Lazy singletons ───────────────────────────
_groq_client = None

def _get_groq():
    global _groq_client
    if _groq_client is None:
        from groq import Groq
        _groq_client = Groq(api_key=GROQ_API_KEY)
        logger.info("[RAG] Groq client ready.")
    return _groq_client


# ── Document Parsing ──────────────────────────
def _extract_pdf(file_bytes: bytes) -> str:
    import pdfplumber
    parts = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                parts.append(t)
    return "\n".join(parts)


def _extract_docx(file_bytes: bytes) -> str:
    from docx import Document as DocxDoc
    doc = DocxDoc(io.BytesIO(file_bytes))
    paras = [p.text for p in doc.paragraphs if p.text.strip()]
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                if cell.text.strip():
                    paras.append(cell.text.strip())
    return "\n".join(paras)


def extract_text(file_bytes: bytes, filename: str) -> str:
    ext = filename.lower().rsplit(".", 1)[-1]
    if ext == "pdf":
        return _extract_pdf(file_bytes)
    elif ext in ("docx", "doc"):
        return _extract_docx(file_bytes)
    raise ValueError(f"Unsupported file type: .{ext}. Please upload PDF or DOCX.")


# ── Pure sklearn TF-IDF Retriever ─────────────
class TFIDFRetriever:
    """
    Torch-free vector retriever.
    Uses TF-IDF + cosine similarity — sklearn only, no torch/transformers.
    """
    def __init__(self, chunks: list):
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity
        import numpy as np

        self._chunks = chunks
        self._cos    = cosine_similarity
        self._np     = np

        self._vectorizer = TfidfVectorizer(
            ngram_range=(1, 2),
            max_features=8000,
            sublinear_tf=True,
        )
        self._matrix = self._vectorizer.fit_transform(chunks)
        logger.info(f"[RAG] TF-IDF index built: {len(chunks)} chunks, "
                    f"vocab={self._vectorizer.vocabulary_.__len__()}")

    def invoke(self, query: str, k: int = 8) -> list:
        q_vec   = self._vectorizer.transform([query])
        scores  = self._cos(q_vec, self._matrix)[0]
        top_idx = self._np.argsort(scores)[::-1][:k]

        class _Doc:
            def __init__(self, text):
                self.page_content = text

        return [_Doc(self._chunks[i]) for i in top_idx if scores[i] > 0]


def build_retriever(text: str) -> TFIDFRetriever:
    """Chunk text and build TF-IDF retriever."""
    # Simple paragraph-aware chunker — no langchain needed
    paragraphs = [p.strip() for p in re.split(r"\n{2,}", text) if p.strip()]

    chunks = []
    current = ""
    for para in paragraphs:
        if len(current) + len(para) < 600:
            current += (" " if current else "") + para
        else:
            if current:
                chunks.append(current)
            current = para
    if current:
        chunks.append(current)

    # Also add a full-text chunk for global context
    if len(text) <= 3000:
        chunks.append(text)

    logger.info(f"[RAG] Created {len(chunks)} chunks.")
    return TFIDFRetriever(chunks)


# ── Retrieval Queries ─────────────────────────
CARDIAC_QUERIES = [
    "patient age years old",
    "sex gender male female",
    "chest pain type angina non-anginal asymptomatic",
    "resting blood pressure systolic mmHg",
    "cholesterol serum total mg dL lipid",
    "fasting blood sugar glucose 120 mg/dL",
    "ECG electrocardiogram ST-T wave abnormality resting",
    "maximum heart rate exercise bpm achieved",
    "exercise induced angina exertional chest pain yes no",
    "ST depression oldpeak mm exercise baseline",
    "ST segment slope flat upsloping downsloping",
    "major vessels fluoroscopy coronary blockage calcification coloured",
    "thalassemia nuclear stress test perfusion defect reversible fixed normal",
]


def retrieve_context(retriever: TFIDFRetriever) -> str:
    seen, chunks = set(), []
    for q in CARDIAC_QUERIES:
        for doc in retriever.invoke(q, k=5):
            c = doc.page_content.strip()
            if c not in seen:
                seen.add(c)
                chunks.append(c)
    result = "\n\n---\n\n".join(chunks)
    logger.info(f"[RAG] Retrieved {len(chunks)} unique chunks, {len(result)} chars.")
    return result


# ── LLM Extraction via Groq (Qwen) ───────────
SYSTEM_PROMPT = """You are a medical data extraction specialist. Extract cardiac clinical values from the report and return ONLY a valid JSON object.

Required fields:
- age: integer 20-100 (patient age in years)
- sex: 0=Female, 1=Male
- cp: 0=Typical Angina, 1=Atypical Angina, 2=Non-anginal Pain, 3=Asymptomatic
- trestbps: integer 80-220 (resting blood pressure mm Hg)
- chol: integer 100-600 (serum cholesterol mg/dL)
- fbs: 0=No (<=120 mg/dL fasting glucose), 1=Yes (>120 mg/dL)
- restecg: 0=Normal, 1=ST-T Wave Abnormality, 2=Left Ventricular Hypertrophy
- thalach: integer 60-220 (maximum heart rate achieved in bpm)
- exang: 0=No, 1=Yes (exercise-induced angina)
- oldpeak: float 0.0-8.0 (ST depression induced by exercise vs rest)
- slope: 1=Upsloping, 2=Flat, 3=Downsloping (peak exercise ST segment)
- ca: integer 0-3 (major vessels coloured by fluoroscopy)
- thal: 3=Normal, 6=Fixed Defect, 7=Reversible Defect

Also return:
- confidence: {same keys, value 0.0-1.0: 1.0=explicit in report, 0.5=inferred, 0.1=default used}
- patient_name: string or ""
- report_notes: string or ""

Defaults if a field is not found: {"age":55,"sex":1,"cp":0,"trestbps":130,"chol":240,"fbs":0,"restecg":0,"thalach":150,"exang":0,"oldpeak":1.0,"slope":2,"ca":0,"thal":3}

IMPORTANT: Return ONLY the raw JSON object. No markdown, no code fences, no explanation text."""


def extract_with_llm(context: str) -> dict:
    client = _get_groq()

    completion = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": f"Extract all cardiac values from this medical report:\n\n{context[:7000]}"},
        ],
        temperature=0.1,
        max_tokens=2048,
        stream=False,
    )

    raw = completion.choices[0].message.content.strip()
    logger.info(f"[RAG] LLM response (first 300): {raw[:300]}")

    # Strip markdown fences
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
    raw = re.sub(r"\s*```\s*$",       "", raw, flags=re.MULTILINE)
    raw = raw.strip()

    # Extract JSON object
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if match:
        raw = match.group()

    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        logger.error(f"[RAG] JSON parse error: {e} | raw: {raw[:400]}")
        raise ValueError(f"LLM returned invalid JSON: {raw[:200]}")


# ── Validation ────────────────────────────────
FIELD_RANGES = {
    "age":      (20,  100, int),
    "sex":      (0,   1,   int),
    "cp":       (0,   3,   int),
    "trestbps": (80,  220, int),
    "chol":     (100, 600, int),
    "fbs":      (0,   1,   int),
    "restecg":  (0,   2,   int),
    "thalach":  (60,  220, int),
    "exang":    (0,   1,   int),
    "oldpeak":  (0.0, 8.0, float),
    "slope":    (1,   3,   int),
    "ca":       (0,   3,   int),
    "thal":     (3,   7,   int),
}

DEFAULTS = {
    "age":55,"sex":1,"cp":0,"trestbps":130,"chol":240,"fbs":0,
    "restecg":0,"thalach":150,"exang":0,"oldpeak":1.0,"slope":2,"ca":0,"thal":3
}

THAL_VALID = {3, 6, 7}


def validate(extracted: dict) -> dict:
    out = {}
    for field, (lo, hi, cast) in FIELD_RANGES.items():
        val = extracted.get(field, DEFAULTS[field])
        try:
            val = cast(val)
        except (ValueError, TypeError):
            val = DEFAULTS[field]
        val = max(lo, min(hi, val))
        if field == "thal" and val not in THAL_VALID:
            val = min(THAL_VALID, key=lambda x: abs(x - val))
        out[field] = val
    return out


# ── Public Entry Point ────────────────────────
def process_medical_report(file_bytes: bytes, filename: str, store_type: str = "faiss") -> dict:
    """
    Full RAG pipeline — torch-free:
      1. Extract text (pdfplumber / python-docx)
      2. Chunk + TF-IDF index (sklearn, no torch)
      3. Retrieve relevant sections with 13 cardiac queries
      4. Groq Qwen LLM structured extraction
      5. Validate & clamp all 13 fields
    """
    logger.info(f"[RAG] Processing: {filename} ({len(file_bytes)} bytes)")

    raw_text = extract_text(file_bytes, filename)
    if len(raw_text.strip()) < 50:
        raise ValueError(
            "Could not extract meaningful text from the document. "
            "Ensure it is not a scanned/image-only PDF."
        )
    logger.info(f"[RAG] Extracted {len(raw_text)} chars.")

    retriever     = build_retriever(raw_text)
    context       = retrieve_context(retriever)
    llm_result    = extract_with_llm(context)
    cardiac_values = validate(llm_result)

    confidence   = llm_result.get("confidence",   {f: 0.5 for f in FIELD_RANGES})
    patient_name = llm_result.get("patient_name", "")
    report_notes = llm_result.get("report_notes", "")

    logger.info(f"[RAG] Done: {cardiac_values}")
    return {
        "extracted_values": cardiac_values,
        "confidence":        confidence,
        "patient_name":      patient_name,
        "report_notes":      report_notes,
        "raw_text_preview":  raw_text[:600],
    }
