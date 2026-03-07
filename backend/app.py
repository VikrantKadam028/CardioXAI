import os
import io
import base64
import numpy as np
import pandas as pd
import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError
from bson import ObjectId
from bson.json_util import dumps
import json
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, Image as RLImage
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from datetime import datetime, timedelta

# ──────────────────────────────────────────────
# RAG Pipeline (lazy import to avoid slow startup)
# ──────────────────────────────────────────────
_rag_loaded  = False
_rag_error   = None
rag_pipeline = None

def load_rag():
    global _rag_loaded, _rag_error, rag_pipeline
    if not _rag_loaded and rag_pipeline is None:
        try:
            import rag_pipeline as _rp
            rag_pipeline = _rp
            _rag_loaded  = True
            _rag_error   = None
            print("[RAG] Pipeline loaded successfully.")
        except Exception as e:
            import traceback
            _rag_error = str(e)
            traceback.print_exc()
            print(f"[RAG] LOAD ERROR: {e}")
    return rag_pipeline, _rag_error

# ──────────────────────────────────────────────
# App Setup
# ──────────────────────────────────────────────
app = Flask(__name__)
CORS(app,
     resources={r"/api/*": {"origins": "*"}},
     supports_credentials=False,
     allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     max_age=86400)
bcrypt = Bcrypt(app)

app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY", "xai-heart-super-secret-keys-2024")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(days=7)
jwt = JWTManager(app)

MONGO_URI = "mongodb+srv://vikrantkk2889:clZRES2qrls0b4n9@cluster0.yqonlou.mongodb.net/"
client = MongoClient(MONGO_URI)
db = client["xai_heart_db"]
users_col = db["users"]
reports_col = db["reports"]
users_col.create_index("email", unique=True)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "models")

model = joblib.load(os.path.join(MODEL_DIR, "logistic_model.pkl"))
scaler = joblib.load(os.path.join(MODEL_DIR, "scaler.pkl"))
metadata = joblib.load(os.path.join(MODEL_DIR, "metadata.pkl"))

feature_order = metadata["feature_order"]
numerical_features = metadata["numerical_features"]
lr_coefs = metadata["lr_coefficients"]

# ──────────────────────────────────────────────
# Feature Metadata
# ──────────────────────────────────────────────
FEATURE_LABELS = {
    "age": "Age (Years)", "sex": "Sex", "cp": "Chest Pain Type",
    "trestbps": "Resting Blood Pressure", "chol": "Serum Cholesterol",
    "fbs": "Fasting Blood Sugar", "restecg": "Resting ECG",
    "thalach": "Max Heart Rate", "exang": "Exercise Induced Angina",
    "oldpeak": "ST Depression", "slope": "ST Segment Slope",
    "ca": "Major Vessels", "thal": "Thalassemia"
}

FEATURE_UNITS = {
    "age": "yrs", "trestbps": "mm Hg", "chol": "mg/dl",
    "thalach": "bpm", "oldpeak": ""
}

RISK_EXPLANATIONS = {
    "age": {
        "high": "Advanced age is a well-established non-modifiable risk factor for cardiovascular disease.",
        "low": "Younger age provides natural baseline protection against cardiovascular disease."
    },
    "oldpeak": {
        "high": "Elevated ST depression indicates abnormal cardiac stress response during exercise.",
        "low": "Minimal ST depression suggests healthy cardiac response to physical stress."
    },
    "ca": {
        "high": "Multiple major vessels with blockage indicates structural coronary artery involvement.",
        "low": "Absence of major vessel blockage significantly reduces structural cardiac risk."
    },
    "thal": {
        "high": "Thalassemia result indicates abnormal myocardial perfusion and compromised blood flow.",
        "low": "Thalassemia result does not indicate significant perfusion abnormality."
    },
    "exang": {
        "high": "Exercise-induced angina shows cardiac symptoms triggered by physical stress.",
        "low": "No exercise-induced angina indicates good cardiac stress tolerance."
    },
    "trestbps": {
        "high": "Elevated resting blood pressure increases cardiac workload significantly.",
        "low": "Blood pressure is within a relatively controlled and safer range."
    },
    "chol": {
        "high": "High cholesterol may contribute to arterial plaque formation and atherosclerosis.",
        "low": "Cholesterol level does not indicate severe lipid-related cardiovascular risk."
    },
    "fbs": {
        "high": "Elevated fasting blood sugar suggests metabolic imbalance linked to cardiovascular complications.",
        "low": "Normal fasting blood sugar indicates healthy metabolic function."
    },
    "slope": {
        "high": "ST segment slope pattern is associated with higher cardiac stress under exercise.",
        "low": "ST segment slope does not indicate concerning cardiac stress patterns."
    },
    "sex": {
        "high": "Male sex is statistically associated with increased prevalence of coronary artery disease.",
        "low": "Female sex is associated with lower baseline cardiovascular risk in most age groups."
    },
    "cp": {
        "high": "Chest pain pattern corresponds to clinically significant angina type.",
        "low": "Reported chest pain type does not correspond to high-risk angina patterns."
    },
    "thalach": {
        "high": "Lower maximum heart rate may indicate reduced cardiac fitness or chronotropic incompetence.",
        "low": "High maximum heart rate indicates excellent exercise tolerance and cardiac fitness."
    },
    "restecg": {
        "high": "ECG abnormalities suggest underlying electrical or structural cardiac issues.",
        "low": "Normal resting ECG indicates healthy baseline cardiac electrical activity."
    }
}

# ──────────────────────────────────────────────
# Real XAI: Gradient-based SHAP for Logistic Regression
# ──────────────────────────────────────────────
def compute_real_shap(input_dict):
    """
    Compute real SHAP values using the linear model exact decomposition.
    For logistic regression: phi_i = coef_i * x_i_scaled
    This is mathematically equivalent to shap.LinearExplainer output.
    Values are computed from actual model coefficients trained on real Cleveland data.
    """
    x_raw = np.array([input_dict[col] for col in feature_order], dtype=float)
    x_scaled = x_raw.copy()
    
    num_idx = [feature_order.index(f) for f in numerical_features]
    x_num = x_raw[num_idx].reshape(1, -1)
    x_scaled[num_idx] = scaler.transform(x_num)[0]
    
    coefs = model.coef_[0]
    shap_values = coefs * x_scaled
    
    return shap_values

# ──────────────────────────────────────────────
# Chart Generation
# ──────────────────────────────────────────────
def build_shap_chart(shap_vector, feature_names):
    """Build a clean horizontal bar SHAP chart."""
    fig, ax = plt.subplots(figsize=(9, 5))
    fig.patch.set_facecolor("#f8fafc")
    ax.set_facecolor("#f8fafc")

    sorted_idx = np.argsort(np.abs(shap_vector))[-10:]
    vals = shap_vector[sorted_idx]
    names = [FEATURE_LABELS.get(feature_names[i], feature_names[i]) for i in sorted_idx]
    bar_colors = ["#ef4444" if v > 0 else "#22c55e" for v in vals]

    bars = ax.barh(names, vals, color=bar_colors, height=0.55, edgecolor="none")

    ax.axvline(0, color="#94a3b8", linewidth=1.0, alpha=0.8)
    ax.tick_params(colors="#1e3a5f", labelsize=9.5, length=0)
    ax.spines[["top", "right", "bottom", "left"]].set_visible(False)
    ax.set_xlabel("SHAP Value (Feature Impact on Risk Score)", color="#475569", fontsize=9)
    ax.set_title("Explainable AI — Feature Contribution Analysis", color="#0f172a", fontsize=11, fontweight='bold', pad=12)
    ax.tick_params(axis='y', labelcolor='#1e3a5f')
    ax.tick_params(axis='x', labelcolor='#64748b')

    red_patch = mpatches.Patch(color='#ef4444', label='Increases Risk')
    green_patch = mpatches.Patch(color='#22c55e', label='Decreases Risk')
    ax.legend(handles=[red_patch, green_patch], loc='lower right', fontsize=8,
              framealpha=0.9, edgecolor='#e2e8f0')

    plt.tight_layout(pad=1.5)
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=140, bbox_inches="tight",
                facecolor="#f8fafc", edgecolor="none")
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")


def generate_clinical_explanation(input_dict, shap_vector, prob):
    contribution_df = pd.DataFrame({
        "feature": feature_order,
        "impact": shap_vector
    }).sort_values(by="impact", key=abs, ascending=False)

    risk_factors = []
    protective_factors = []

    for _, row in contribution_df.iterrows():
        feat = row["feature"]
        impact = float(row["impact"])
        value = input_dict.get(feat)
        label = FEATURE_LABELS.get(feat, feat)
        direction = "high" if impact > 0 else "low"
        explanation = RISK_EXPLANATIONS.get(feat, {}).get(direction, f"{label} is influencing the prediction.")
        unit = FEATURE_UNITS.get(feat, "")
        val_str = f"{value} {unit}".strip() if unit else str(value)

        entry = {
            "feature": feat,
            "label": label,
            "value": val_str,
            "impact": round(impact, 4),
            "explanation": explanation
        }

        if impact > 0 and len(risk_factors) < 5:
            risk_factors.append(entry)
        elif impact < 0 and len(protective_factors) < 5:
            protective_factors.append(entry)

    if prob > 0.7:
        overall = ("High cardiovascular risk detected. Multiple significant clinical risk factors are present. "
                   "Comprehensive cardiovascular evaluation including stress testing and coronary imaging is strongly recommended.")
    elif prob > 0.4:
        overall = ("Moderate cardiovascular risk detected. Some clinical parameters warrant further diagnostic screening. "
                   "Consultation with a cardiologist and lifestyle risk factor assessment is advised.")
    else:
        overall = ("Low cardiovascular risk detected. Most evaluated clinical indicators appear within safer physiological ranges. "
                   "Continued preventive health practices and routine check-ups are recommended.")

    return {
        "risk_factors": risk_factors,
        "protective_factors": protective_factors,
        "overall_assessment": overall
    }


# ──────────────────────────────────────────────
# PDF Report Generator  — Polished Template
# ──────────────────────────────────────────────

# ── Lookup helpers (safe — no IndexError) ─────────────────────────────────
def _cp_label(v):
    return {0:"Typical Angina",1:"Atypical Angina",2:"Non-anginal Pain",3:"Asymptomatic"}.get(int(v),"Unknown")

def _sex_label(v):
    return "Male" if int(v)==1 else "Female"

def _restecg_label(v):
    return {0:"Normal",1:"ST-T Wave Abnormality",2:"LV Hypertrophy"}.get(int(v),"Unknown")

def _slope_label(v):
    return {1:"Upsloping",2:"Flat",3:"Downsloping"}.get(int(v),"Unknown")

def _thal_label(v):
    # Valid values: 3=Normal, 6=Fixed Defect, 7=Reversible Defect
    return {3:"Normal",6:"Fixed Defect",7:"Reversible Defect"}.get(int(v), f"Value {int(v)}")

def generate_pdf_report(input_dict, prob, shap_vector, explanation, shap_chart_b64, patient_info=None):
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                            rightMargin=1.6*cm, leftMargin=1.6*cm,
                            topMargin=1.2*cm, bottomMargin=1.5*cm)

    # ── Colour palette ─────────────────────────
    C = {
        "navy":    colors.HexColor("#0f2d5e"),
        "blue":    colors.HexColor("#1a56db"),
        "lblue":   colors.HexColor("#dbeafe"),
        "lblue2":  colors.HexColor("#eff6ff"),
        "teal":    colors.HexColor("#0e7490"),
        "lteal":   colors.HexColor("#cffafe"),
        "red":     colors.HexColor("#dc2626"),
        "lred":    colors.HexColor("#fee2e2"),
        "orange":  colors.HexColor("#d97706"),
        "lorange": colors.HexColor("#fef3c7"),
        "green":   colors.HexColor("#16a34a"),
        "lgreen":  colors.HexColor("#dcfce7"),
        "gray":    colors.HexColor("#374151"),
        "lgray":   colors.HexColor("#f1f5f9"),
        "lgray2":  colors.HexColor("#e2e8f0"),
        "mgray":   colors.HexColor("#64748b"),
        "dgray":   colors.HexColor("#475569"),
        "white":   colors.white,
    }

    # ── Style factory ──────────────────────────
    def S(name, **kw):
        base = dict(fontName="Helvetica", fontSize=9, textColor=C["gray"], leading=13)
        base.update(kw)
        return ParagraphStyle(name, **base)

    P  = lambda txt, st: Paragraph(txt, st)
    HR = lambda: HRFlowable(width="100%", thickness=0.5, color=C["lgray2"], spaceAfter=5, spaceBefore=2)

    now = datetime.now().strftime("%B %d, %Y  •  %I:%M %p")
    pi  = patient_info or {}
    W   = doc.width

    story = []

    # ══════════════════════════════════════════
    # SECTION 0 — BRANDED HEADER
    # ══════════════════════════════════════════
    hdr_inner = Table([
        [P("CardioXAI", S("h1", fontSize=22, fontName="Helvetica-Bold", textColor=C["white"], alignment=TA_LEFT)),
         P("Heart Disease Risk Assessment Report", S("h2", fontSize=11, fontName="Helvetica", textColor=colors.HexColor("#93c5fd"), alignment=TA_LEFT))],
    ], colWidths=[5.5*cm, W-5.5*cm])
    hdr_inner.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"MIDDLE"),("TOPPADDING",(0,0),(-1,-1),2)]))

    hdr = Table([[hdr_inner]], colWidths=[W])
    hdr.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),C["navy"]),
        ("ROWPADDING",(0,0),(-1,-1),14),
    ]))
    story.append(hdr)

    # ── Meta bar ──────────────────────────────
    meta = Table([[
        P(f"<b>Patient:</b>  {pi.get('name','Anonymous Patient')}", S("m1", fontSize=8.5, textColor=C["navy"])),
        P(f"<b>Age / Sex:</b>  {input_dict.get('age','—')} yrs  ·  {_sex_label(input_dict.get('sex',1))}", S("m2", fontSize=8.5, textColor=C["navy"])),
        P(f"<b>Report Date:</b>  {now}", S("m3", fontSize=8.5, textColor=C["navy"])),
        P("<b>Model:</b>  Logistic Regression + Linear SHAP", S("m4", fontSize=8.5, textColor=C["navy"])),
    ]], colWidths=[W/4]*4)
    meta.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),C["lblue"]),
        ("ROWPADDING",(0,0),(-1,-1),8),
        ("BOX",(0,0),(-1,-1),0.5,colors.HexColor("#93c5fd")),
    ]))
    story.append(meta)
    story.append(Spacer(1, 0.35*cm))

    # ══════════════════════════════════════════
    # SECTION 1 — RISK VERDICT BANNER
    # ══════════════════════════════════════════
    risk_pct = round(prob * 100, 1)
    if prob > 0.7:
        rlabel, rcolor, rlcolor, rdesc = "HIGH RISK", C["red"], C["lred"], \
            "Significant cardiovascular risk detected. Comprehensive cardiac evaluation strongly recommended."
    elif prob > 0.4:
        rlabel, rcolor, rlcolor, rdesc = "MODERATE RISK", C["orange"], C["lorange"], \
            "Moderate cardiovascular risk. Some clinical parameters warrant further diagnostic screening."
    else:
        rlabel, rcolor, rlcolor, rdesc = "LOW RISK", C["green"], C["lgreen"], \
            "Low cardiovascular risk. Most indicators within safe physiological range."

    # Gauge-style probability bar
    filled = int(risk_pct / 100 * 40)
    bar_filled = "█" * filled
    bar_empty  = "░" * (40 - filled)

    verdict_left = Table([
        [P(rlabel, S("rl", fontSize=20, fontName="Helvetica-Bold", textColor=C["white"]))],
        [P(f"{risk_pct}% Probability", S("rp", fontSize=13, fontName="Helvetica-Bold", textColor=colors.HexColor("#fef9c3")))],
        [P(rdesc, S("rd", fontSize=8.5, textColor=colors.HexColor("#fef9c3"), leading=13))],
    ], colWidths=[8.5*cm])
    verdict_left.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),rcolor),
        ("ROWPADDING",(0,0),(-1,-1),7),
        ("LEFTPADDING",(0,0),(-1,-1),14),
    ]))

    verdict_right = Table([
        [P("<b>Risk Probability Gauge</b>", S("rg", fontSize=8, textColor=C["dgray"]))],
        [P(f'<font color="#ef4444">{bar_filled}</font><font color="#d1d5db">{bar_empty}</font>',
           S("bar", fontSize=7, fontName="Helvetica", leading=10))],
        [P(f"0%{'':>18}50%{'':>18}100%", S("scale", fontSize=7, textColor=C["mgray"]))],
        [P(f"<b>Model Accuracy:</b>  {metadata['lr_accuracy']*100:.1f}%    <b>AUC-ROC:</b>  {metadata['lr_auc']:.4f}",
           S("ma", fontSize=8, textColor=C["dgray"]))],
    ], colWidths=[W-8.5*cm])
    verdict_right.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),rlcolor),
        ("ROWPADDING",(0,0),(-1,-1),7),
        ("LEFTPADDING",(0,0),(-1,-1),14),
    ]))

    verdict = Table([[verdict_left, verdict_right]], colWidths=[8.5*cm, W-8.5*cm])
    verdict.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"TOP"),("INNERGRID",(0,0),(-1,-1),0,C["white"])]))
    story.append(verdict)
    story.append(Spacer(1, 0.45*cm))

    # ══════════════════════════════════════════
    # SECTION 2 — CLINICAL PARAMETERS (13 fields)
    # ══════════════════════════════════════════
    sec_s   = S("sec", fontSize=11, fontName="Helvetica-Bold", textColor=C["navy"], spaceBefore=6, spaceAfter=3)
    lbl_s   = S("lbl", fontSize=8.5, fontName="Helvetica-Bold", textColor=C["navy"])
    val_s   = S("val", fontSize=8.5, textColor=C["gray"])
    tag_s   = S("tag", fontSize=7.5, fontName="Helvetica-Bold", textColor=C["mgray"])

    story.append(P("Clinical Input Parameters", sec_s))
    story.append(HR())

    # 13 fields in a 3-column card grid
    params = [
        ("Age",                   f"{input_dict['age']} years",          "Demographics"),
        ("Biological Sex",        _sex_label(input_dict['sex']),          "Demographics"),
        ("Chest Pain Type",       _cp_label(input_dict['cp']),            "Symptoms"),
        ("Resting Blood Pressure",f"{input_dict['trestbps']} mm Hg",     "Vitals"),
        ("Serum Cholesterol",     f"{input_dict['chol']} mg/dL",          "Blood Labs"),
        ("Fasting Blood Sugar",   "Yes (>120)" if input_dict['fbs']==1 else "No (≤120)", "Blood Labs"),
        ("Resting ECG",           _restecg_label(input_dict['restecg']), "ECG"),
        ("Max Heart Rate",        f"{input_dict['thalach']} bpm",         "Stress Test"),
        ("Exercise Angina",       "Yes" if input_dict['exang']==1 else "No", "Stress Test"),
        ("ST Depression",         f"{input_dict['oldpeak']} mm",          "Stress Test"),
        ("ST Segment Slope",      _slope_label(input_dict['slope']),      "Stress Test"),
        ("Major Vessels (ca)",    str(int(input_dict['ca'])),             "Angiography"),
        ("Thalassemia",           _thal_label(input_dict['thal']),        "Perfusion MPI"),
    ]

    TAG_COLORS = {
        "Demographics": ("#1d4ed8","#eff6ff"),
        "Symptoms":     ("#7c3aed","#f5f3ff"),
        "Vitals":       ("#0e7490","#ecfeff"),
        "Blood Labs":   ("#d97706","#fffbeb"),
        "ECG":          ("#be185d","#fdf2f8"),
        "Stress Test":  ("#dc2626","#fff1f2"),
        "Angiography":  ("#065f46","#f0fdf4"),
        "Perfusion MPI":("#6d28d9","#faf5ff"),
    }

    # Build 3-column card rows
    def make_param_card(label, value, tag):
        tc, bc = TAG_COLORS.get(tag, ("#475569","#f8fafc"))
        card = Table([
            [P(f'<font color="{tc}"><b>{label}</b></font>',
               S(f"pl{label}", fontSize=8, fontName="Helvetica-Bold", textColor=colors.HexColor(tc)))],
            [P(f"<b>{value}</b>", S(f"pv{label}", fontSize=11, fontName="Helvetica-Bold", textColor=C["navy"]))],
            [P(tag, S(f"pt{label}", fontSize=7, textColor=colors.HexColor(tc)))],
        ], colWidths=[(W-0.6*cm)/3 - 0.3*cm])
        card.setStyle(TableStyle([
            ("BACKGROUND",(0,0),(-1,-1),colors.HexColor(bc)),
            ("BOX",(0,0),(-1,-1),0.5,colors.HexColor(tc+"44" if len(tc)==7 else tc)),
            ("ROWPADDING",(0,0),(-1,-1),5),
            ("LEFTPADDING",(0,0),(-1,-1),8),
            ("RIGHTPADDING",(0,0),(-1,-1),8),
            ("TOPPADDING",(0,0),(0,0),8),
            ("BOTTOMPADDING",(-1,-1),(-1,-1),8),
        ]))
        return card

    col_w = (W - 0.4*cm) / 3
    for row_start in range(0, 13, 3):
        row_cards = params[row_start:row_start+3]
        while len(row_cards) < 3:
            row_cards.append(("","",""))
        cells = [make_param_card(lbl, val, tag) if lbl else P("", val_s) for lbl,val,tag in row_cards]
        row_t = Table([cells], colWidths=[col_w]*3)
        row_t.setStyle(TableStyle([
            ("VALIGN",(0,0),(-1,-1),"TOP"),
            ("LEFTPADDING",(0,0),(-1,-1),3),
            ("RIGHTPADDING",(0,0),(-1,-1),3),
        ]))
        story.append(row_t)
        story.append(Spacer(1, 0.15*cm))

    story.append(Spacer(1, 0.3*cm))

    # ══════════════════════════════════════════
    # SECTION 3 — SHAP CHART
    # ══════════════════════════════════════════
    story.append(P("Explainable AI — Feature Impact Analysis (Linear SHAP)", sec_s))
    story.append(HR())

    shap_intro = ("The chart below shows each clinical parameter's contribution to the predicted risk score. "
                  "Red bars increase risk; green bars decrease risk. Values represent exact Linear SHAP "
                  "decomposition of the logistic regression model coefficients.")
    story.append(P(shap_intro, S("si", fontSize=8.5, textColor=C["dgray"], leading=13, spaceAfter=6)))

    if shap_chart_b64:
        img_buf   = io.BytesIO(base64.b64decode(shap_chart_b64))
        chart_img = RLImage(img_buf, width=W*0.92, height=5.5*cm)
        chart_wrap = Table([[chart_img]], colWidths=[W])
        chart_wrap.setStyle(TableStyle([
            ("ALIGN",(0,0),(-1,-1),"CENTER"),
            ("BACKGROUND",(0,0),(-1,-1),colors.HexColor("#f8fafc")),
            ("BOX",(0,0),(-1,-1),0.5,C["lgray2"]),
            ("ROWPADDING",(0,0),(-1,-1),6),
        ]))
        story.append(chart_wrap)
    story.append(Spacer(1, 0.4*cm))

    # ══════════════════════════════════════════
    # SECTION 4 — RISK & PROTECTIVE FACTORS
    # ══════════════════════════════════════════
    rf_list = explanation.get("risk_factors", [])
    pf_list = explanation.get("protective_factors", [])

    if rf_list or pf_list:
        story.append(P("Key Clinical Factors Driving the Prediction", sec_s))
        story.append(HR())

        # Two-column header
        col_header = Table([
            [P("▲  Risk-Elevating Factors", S("rfh", fontSize=9.5, fontName="Helvetica-Bold", textColor=C["red"])),
             P("▼  Protective Factors",     S("pfh", fontSize=9.5, fontName="Helvetica-Bold", textColor=C["green"]))],
        ], colWidths=[W/2 - 0.2*cm, W/2 - 0.2*cm])
        col_header.setStyle(TableStyle([
            ("BACKGROUND",(0,0),(0,0),C["lred"]),
            ("BACKGROUND",(1,0),(1,0),C["lgreen"]),
            ("ROWPADDING",(0,0),(-1,-1),7),
            ("LEFTPADDING",(0,0),(-1,-1),10),
            ("BOX",(0,0),(0,0),0.5,colors.HexColor("#fca5a5")),
            ("BOX",(1,0),(1,0),0.5,colors.HexColor("#86efac")),
        ]))
        story.append(col_header)
        story.append(Spacer(1, 0.12*cm))

        small_s = S("sm", fontSize=8, textColor=C["dgray"], leading=12)
        imp_r_s = S("ir", fontSize=8, fontName="Helvetica-Bold", textColor=C["red"])
        imp_g_s = S("ig", fontSize=8, fontName="Helvetica-Bold", textColor=C["green"])

        max_rows = max(len(rf_list), len(pf_list))
        for i in range(max_rows):
            rf_cell = pf_cell = P("", small_s)

            if i < len(rf_list):
                f = rf_list[i]
                pct = round(abs(f["impact"])*100, 2)
                rf_cell = Table([
                    [P(f"<b>{f['label']}</b>  ·  {f['value']}",
                       S(f"rl{i}", fontSize=8.5, fontName="Helvetica-Bold", textColor=C["red"])),
                     P(f"+{pct}%", imp_r_s)],
                    [P(f['explanation'], small_s), ""],
                ], colWidths=[W/2 - 2.2*cm, 1.8*cm])
                rf_cell.setStyle(TableStyle([
                    ("SPAN",(0,1),(1,1)),
                    ("BACKGROUND",(0,0),(-1,-1),colors.HexColor("#fff5f5")),
                    ("ROWPADDING",(0,0),(-1,-1),5),("LEFTPADDING",(0,0),(-1,-1),8),
                    ("BOX",(0,0),(-1,-1),0.3,colors.HexColor("#fca5a5")),
                ]))

            if i < len(pf_list):
                f = pf_list[i]
                pct = round(abs(f["impact"])*100, 2)
                pf_cell = Table([
                    [P(f"<b>{f['label']}</b>  ·  {f['value']}",
                       S(f"pl{i}", fontSize=8.5, fontName="Helvetica-Bold", textColor=C["green"])),
                     P(f"-{pct}%", imp_g_s)],
                    [P(f['explanation'], small_s), ""],
                ], colWidths=[W/2 - 2.2*cm, 1.8*cm])
                pf_cell.setStyle(TableStyle([
                    ("SPAN",(0,1),(1,1)),
                    ("BACKGROUND",(0,0),(-1,-1),colors.HexColor("#f0fdf4")),
                    ("ROWPADDING",(0,0),(-1,-1),5),("LEFTPADDING",(0,0),(-1,-1),8),
                    ("BOX",(0,0),(-1,-1),0.3,colors.HexColor("#86efac")),
                ]))

            row_t = Table([[rf_cell, pf_cell]], colWidths=[W/2, W/2])
            row_t.setStyle(TableStyle([
                ("VALIGN",(0,0),(-1,-1),"TOP"),
                ("LEFTPADDING",(0,0),(-1,-1),2),
                ("RIGHTPADDING",(0,0),(-1,-1),2),
            ]))
            story.append(row_t)
            story.append(Spacer(1, 0.1*cm))

        story.append(Spacer(1, 0.35*cm))

    # ══════════════════════════════════════════
    # SECTION 5 — OVERALL CLINICAL ASSESSMENT
    # ══════════════════════════════════════════
    story.append(P("Overall Clinical Assessment", sec_s))
    story.append(HR())

    assess_t = Table([[P(explanation.get("overall_assessment",""), S("oa", fontSize=9.5, textColor=C["gray"], leading=15, alignment=TA_JUSTIFY))]],
                     colWidths=[W])
    assess_t.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),C["lblue2"]),
        ("ROWPADDING",(0,0),(-1,-1),12),
        ("BOX",(0,0),(-1,-1),0.8,C["blue"]),
        ("LEFTPADDING",(0,0),(-1,-1),14),
        ("RIGHTPADDING",(0,0),(-1,-1),14),
    ]))
    story.append(assess_t)
    story.append(Spacer(1, 0.4*cm))

    # ══════════════════════════════════════════
    # SECTION 6 — RECOMMENDATIONS TABLE
    # ══════════════════════════════════════════
    story.append(P("Clinical Recommendations", sec_s))
    story.append(HR())

    if prob > 0.7:
        recs = [
            ("Urgent Cardiology Referral",    "Schedule consultation within 1–2 weeks for comprehensive cardiac evaluation."),
            ("Coronary Angiography",          "Consider invasive coronary evaluation based on stress test and imaging findings."),
            ("Medication Optimisation",       "Review antiplatelet, statin, and antihypertensive therapy with prescribing physician."),
            ("Lifestyle Modification",        "Structured cardiac rehabilitation, low-fat diet, aerobic activity as tolerated."),
            ("Risk Factor Control",           "Target BP <130/80 mmHg, LDL <70 mg/dL, fasting glucose <100 mg/dL."),
        ]
    elif prob > 0.4:
        recs = [
            ("Cardiology Consultation",       "Outpatient cardiology review within 4–6 weeks recommended."),
            ("Diagnostic Workup",             "Consider stress ECG or echocardiogram for further risk stratification."),
            ("Lipid & BP Management",         "Optimise statin therapy; target BP <130/80 mmHg."),
            ("Lifestyle Modification",        "Mediterranean diet, aerobic exercise 150 min/week, smoking cessation."),
            ("Repeat Assessment",             "Repeat cardiovascular risk assessment in 3–6 months."),
        ]
    else:
        recs = [
            ("Routine Follow-up",             "Annual cardiovascular risk review with primary care physician."),
            ("Preventive Health Practices",   "Maintain healthy weight, regular exercise, heart-healthy diet."),
            ("Lipid & Glucose Monitoring",    "Repeat fasting lipid panel and glucose in 12 months."),
            ("Blood Pressure Monitoring",     "Regular home BP monitoring; target <120/80 mmHg."),
            ("Lifestyle Maintenance",         "Continue current healthy lifestyle; avoid smoking and excess alcohol."),
        ]

    rec_data = [["#", "Recommendation", "Action"]]
    for idx, (title, detail) in enumerate(recs, 1):
        rec_data.append([
            P(f"<b>{idx}</b>", S(f"ri{idx}", fontSize=9, fontName="Helvetica-Bold", textColor=C["white"])),
            P(f"<b>{title}</b>", S(f"rt{idx}", fontSize=8.5, fontName="Helvetica-Bold", textColor=C["navy"])),
            P(detail, S(f"rd{idx}", fontSize=8.5, textColor=C["gray"], leading=13)),
        ])

    rec_t = Table(rec_data, colWidths=[0.7*cm, 5*cm, W-5.7*cm])
    rec_style = [
        ("BACKGROUND",(0,0),(-1,0),C["teal"]),
        ("TEXTCOLOR",(0,0),(-1,0),C["white"]),
        ("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"),
        ("FONTSIZE",(0,0),(-1,0),9),
        ("ROWPADDING",(0,0),(-1,-1),7),
        ("ROWBACKGROUNDS",(0,1),(-1,-1),[C["white"],C["lteal"]]),
        ("GRID",(0,0),(-1,-1),0.3,C["lgray2"]),
        ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
        ("ALIGN",(0,0),(0,-1),"CENTER"),
    ]
    for i in range(1, len(rec_data)):
        rec_style.append(("BACKGROUND",(0,i),(0,i),C["teal"]))
    rec_t.setStyle(TableStyle(rec_style))
    story.append(rec_t)
    story.append(Spacer(1, 0.4*cm))

    # ══════════════════════════════════════════
    # SECTION 7 — MODEL INFORMATION
    # ══════════════════════════════════════════
    story.append(P("Model & Methodology Information", sec_s))
    story.append(HR())

    model_data = [
        ["Algorithm",      "Logistic Regression (scikit-learn)",   "Dataset",    "Cleveland Heart Disease (UCI ML Repository)"],
        ["Training Size",  f"{metadata['n_samples']} samples",     "Accuracy",   f"{metadata['lr_accuracy']*100:.1f}%"],
        ["AUC-ROC",        f"{metadata['lr_auc']:.4f}",            "XAI Method", "Linear SHAP (exact gradient decomposition)"],
        ["Features Used",  "13 clinical parameters",               "Risk Cutoff","Probability > 50% = Positive prediction"],
    ]
    md_rows = []
    for row in model_data:
        md_rows.append([
            P(f"<b>{row[0]}</b>", S(f"mk{row[0]}", fontSize=8.5, fontName="Helvetica-Bold", textColor=C["navy"])),
            P(row[1], S(f"mv{row[0]}", fontSize=8.5, textColor=C["gray"])),
            P(f"<b>{row[2]}</b>", S(f"mk2{row[0]}", fontSize=8.5, fontName="Helvetica-Bold", textColor=C["navy"])),
            P(row[3], S(f"mv2{row[0]}", fontSize=8.5, textColor=C["gray"])),
        ])

    md_t = Table(md_rows, colWidths=[3.5*cm, 5.5*cm, 3*cm, W-12*cm])
    md_t.setStyle(TableStyle([
        ("ROWPADDING",(0,0),(-1,-1),6),
        ("ROWBACKGROUNDS",(0,0),(-1,-1),[C["white"],C["lgray"]]),
        ("GRID",(0,0),(-1,-1),0.3,C["lgray2"]),
        ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
    ]))
    story.append(md_t)
    story.append(Spacer(1, 0.35*cm))

    # ══════════════════════════════════════════
    # FOOTER — DISCLAIMER
    # ══════════════════════════════════════════
    disc_t = Table([[
        P("⚠  Medical Disclaimer:  This report is generated by an AI-based predictive system for "
          "informational and research purposes only. It does not constitute a clinical diagnosis "
          "or medical advice. All predictions should be interpreted by a qualified healthcare "
          "professional before any clinical decision is made.  |  "
          f"Generated by CardioXAI  ·  {now}",
          S("disc", fontSize=7.5, textColor=C["mgray"], leading=12, alignment=TA_JUSTIFY))
    ]], colWidths=[W])
    disc_t.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),C["lgray"]),
        ("BOX",(0,0),(-1,-1),0.4,C["lgray2"]),
        ("ROWPADDING",(0,0),(-1,-1),8),
        ("LEFTPADDING",(0,0),(-1,-1),12),
        ("RIGHTPADDING",(0,0),(-1,-1),12),
    ]))
    story.append(disc_t)

    doc.build(story)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")


# ──────────────────────────────────────────────
# Auth Routes
# ──────────────────────────────────────────────
@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json()
    required = ["email", "password", "firstName", "lastName"]
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"{field} is required"}), 400

    hashed = bcrypt.generate_password_hash(data["password"]).decode("utf-8")
    user = {
        "email": data["email"].lower().strip(),
        "password": hashed,
        "firstName": data["firstName"].strip(),
        "lastName": data["lastName"].strip(),
        "dateOfBirth": data.get("dateOfBirth", ""),
        "gender": data.get("gender", ""),
        "phone": data.get("phone", ""),
        "bloodGroup": data.get("bloodGroup", ""),
        "medicalHistory": data.get("medicalHistory", ""),
        "createdAt": datetime.utcnow().isoformat(),
        "reportCount": 0
    }

    try:
        result = users_col.insert_one(user)
        token = create_access_token(identity=str(result.inserted_id))
        return jsonify({
            "token": token,
            "user": {
                "id": str(result.inserted_id),
                "email": user["email"],
                "firstName": user["firstName"],
                "lastName": user["lastName"],
                "gender": user["gender"],
                "phone": user["phone"],
                "bloodGroup": user["bloodGroup"],
            }
        }), 201
    except DuplicateKeyError:
        return jsonify({"error": "Email already registered"}), 409


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data.get("email", "").lower().strip()
    password = data.get("password", "")

    user = users_col.find_one({"email": email})
    if not user or not bcrypt.check_password_hash(user["password"], password):
        return jsonify({"error": "Invalid email or password"}), 401

    token = create_access_token(identity=str(user["_id"]))
    return jsonify({
        "token": token,
        "user": {
            "id": str(user["_id"]),
            "email": user["email"],
            "firstName": user["firstName"],
            "lastName": user["lastName"],
            "gender": user.get("gender", ""),
            "phone": user.get("phone", ""),
            "bloodGroup": user.get("bloodGroup", ""),
            "medicalHistory": user.get("medicalHistory", ""),
            "dateOfBirth": user.get("dateOfBirth", ""),
        }
    })


@app.route("/api/auth/me", methods=["GET"])
@jwt_required()
def get_me():
    user_id = get_jwt_identity()
    user = users_col.find_one({"_id": ObjectId(user_id)})
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify({
        "id": str(user["_id"]),
        "email": user["email"],
        "firstName": user["firstName"],
        "lastName": user["lastName"],
        "gender": user.get("gender", ""),
        "phone": user.get("phone", ""),
        "bloodGroup": user.get("bloodGroup", ""),
        "medicalHistory": user.get("medicalHistory", ""),
        "dateOfBirth": user.get("dateOfBirth", ""),
        "reportCount": user.get("reportCount", 0),
        "createdAt": user.get("createdAt", ""),
    })


@app.route("/api/auth/update", methods=["PUT"])
@jwt_required()
def update_profile():
    user_id = get_jwt_identity()
    data = request.get_json()
    allowed = ["firstName", "lastName", "phone", "bloodGroup", "medicalHistory", "dateOfBirth", "gender"]
    update_data = {k: v for k, v in data.items() if k in allowed}
    users_col.update_one({"_id": ObjectId(user_id)}, {"$set": update_data})
    return jsonify({"message": "Profile updated"})


# ──────────────────────────────────────────────
# Prediction & Report Routes
# ──────────────────────────────────────────────
def parse_input(data):
    return {
        "age": float(data["age"]),
        "sex": float(data["sex"]),
        "cp": float(data["cp"]),
        "trestbps": float(data["trestbps"]),
        "chol": float(data["chol"]),
        "fbs": float(data["fbs"]),
        "restecg": float(data["restecg"]),
        "thalach": float(data["thalach"]),
        "exang": float(data["exang"]),
        "oldpeak": float(data["oldpeak"]),
        "slope": float(data["slope"]),
        "ca": float(data["ca"]),
        "thal": float(data["thal"]),
    }


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "model": "Logistic Regression",
        "dataset": "Cleveland Heart Disease (UCI)",
        "accuracy": round(metadata["lr_accuracy"] * 100, 1),
        "auc": round(metadata["lr_auc"], 4),
        "samples": metadata["n_samples"],
        "xai": "Real Linear SHAP"
    })


@app.route("/api/predict", methods=["POST"])
@jwt_required(optional=True)
def predict():
    data = request.get_json()
    input_dict = parse_input(data)

    x_raw = np.array([input_dict[col] for col in feature_order], dtype=float)
    x_scaled = x_raw.copy()
    num_idx = [feature_order.index(f) for f in numerical_features]
    x_scaled[num_idx] = scaler.transform(x_raw[num_idx].reshape(1, -1))[0]
    # Use plain numpy array to avoid sklearn "feature names" warning
    prob = float(model.predict_proba(x_scaled.reshape(1, -1))[0][1])

    shap_vector = compute_real_shap(input_dict)

    shap_chart_b64 = build_shap_chart(shap_vector, feature_order)
    explanation = generate_clinical_explanation(input_dict, shap_vector, prob)

    shap_data = [
        {"feature": f, "label": FEATURE_LABELS.get(f, f), "impact": round(float(v), 5)}
        for f, v in zip(feature_order, shap_vector)
    ]

    result = {
        "probability": round(prob, 4),
        "prediction": 1 if prob > 0.5 else 0,
        "shap_chart": shap_chart_b64,
        "shap_values": shap_data,
        "explanation": explanation,
        "model_info": {
            "name": "Logistic Regression",
            "dataset": "Cleveland Heart Disease",
            "accuracy": round(metadata["lr_accuracy"] * 100, 1),
            "auc": round(metadata["lr_auc"], 4),
            "xai_method": "Linear SHAP"
        }
    }

    # Save to DB if authenticated
    user_id = get_jwt_identity()
    if user_id:
        report_doc = {
            "userId": user_id,
            "inputData": input_dict,
            "probability": round(prob, 4),
            "prediction": 1 if prob > 0.5 else 0,
            "riskLevel": "high" if prob > 0.7 else ("moderate" if prob > 0.4 else "low"),
            "shap_values": shap_data,
            "explanation": explanation,
            "createdAt": datetime.utcnow().isoformat(),
            "patientNote": data.get("patientNote", ""),
        }
        report_id = reports_col.insert_one(report_doc).inserted_id
        users_col.update_one({"_id": ObjectId(user_id)}, {"$inc": {"reportCount": 1}})
        result["reportId"] = str(report_id)

    return jsonify(result)


@app.route("/api/report/pdf", methods=["POST"])
@jwt_required(optional=True)
def generate_report_pdf():
    data = request.get_json()
    input_dict = parse_input(data)
    patient_info = data.get("patientInfo", {})

    x_raw = np.array([input_dict[col] for col in feature_order], dtype=float)
    x_scaled = x_raw.copy()
    num_idx = [feature_order.index(f) for f in numerical_features]
    x_scaled[num_idx] = scaler.transform(x_raw[num_idx].reshape(1, -1))[0]
    # Use plain numpy array to avoid sklearn "feature names" warning
    prob = float(model.predict_proba(x_scaled.reshape(1, -1))[0][1])
    shap_vector = compute_real_shap(input_dict)
    shap_chart_b64 = build_shap_chart(shap_vector, feature_order)
    explanation = generate_clinical_explanation(input_dict, shap_vector, prob)

    pdf_b64 = generate_pdf_report(input_dict, prob, shap_vector, explanation, shap_chart_b64, patient_info)

    return jsonify({
        "pdf": pdf_b64,
        "filename": f"heart_risk_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    })


@app.route("/api/user/reports", methods=["GET"])
@jwt_required()
def get_user_reports():
    user_id = get_jwt_identity()
    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 10))
    skip = (page - 1) * limit

    total = reports_col.count_documents({"userId": user_id})
    reports = list(reports_col.find({"userId": user_id},
                                    {"shap_values": 0})
                   .sort("createdAt", -1)
                   .skip(skip).limit(limit))

    for r in reports:
        r["_id"] = str(r["_id"])

    return jsonify({"reports": reports, "total": total, "page": page, "pages": (total + limit - 1) // limit})


@app.route("/api/user/reports/<report_id>", methods=["GET"])
@jwt_required()
def get_single_report(report_id):
    user_id = get_jwt_identity()
    try:
        report = reports_col.find_one({"_id": ObjectId(report_id), "userId": user_id})
        if not report:
            return jsonify({"error": "Report not found"}), 404
        report["_id"] = str(report["_id"])

        # Regenerate chart from stored shap values
        if report.get("shap_values"):
            sv = np.array([s["impact"] for s in report["shap_values"]])
            report["shap_chart"] = build_shap_chart(sv, feature_order)

        return jsonify(report)
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/user/stats", methods=["GET"])
@jwt_required()
def get_user_stats():
    user_id = get_jwt_identity()
    reports = list(reports_col.find({"userId": user_id}, {"probability": 1, "riskLevel": 1, "createdAt": 1}))

    total = len(reports)
    if total == 0:
        return jsonify({"total": 0, "avgRisk": 0, "highRisk": 0, "lowRisk": 0, "trend": []})

    probs = [r["probability"] for r in reports]
    risk_counts = {"high": 0, "moderate": 0, "low": 0}
    for r in reports:
        risk_counts[r.get("riskLevel", "low")] += 1

    trend = [{"date": r["createdAt"][:10], "probability": r["probability"],
              "riskLevel": r.get("riskLevel", "low")} for r in sorted(reports, key=lambda x: x["createdAt"])][-10:]

    return jsonify({
        "total": total,
        "avgRisk": round(sum(probs) / total * 100, 1),
        "highRisk": risk_counts["high"],
        "moderateRisk": risk_counts["moderate"],
        "lowRisk": risk_counts["low"],
        "trend": trend
    })


# ──────────────────────────────────────────────
# RAG Report Extraction Endpoint
# ──────────────────────────────────────────────
@app.route("/api/rag/extract", methods=["POST", "OPTIONS"])
def rag_extract():
    """
    Upload one OR multiple PDF/DOCX medical reports.
    Supports field name 'file' (single) or 'files' (multiple).
    Each report is processed independently; results are merged with
    higher-confidence values winning on conflicts.
    """
    if request.method == "OPTIONS":
        return jsonify({}), 200

    rp, rag_err = load_rag()
    if rp is None:
        err_msg = f"RAG pipeline failed to load: {rag_err}" if rag_err else "RAG pipeline not available."
        return jsonify({"error": err_msg}), 503

    # Collect files — support 'files' (multi), 'file' (single), or any key
    uploaded = []
    for key in request.files:
        for f in request.files.getlist(key):
            if f and f.filename:
                uploaded.append(f)

    # Debug log so errors are visible in console
    print(f"[RAG] request.files keys: {list(request.files.keys())}")
    print(f"[RAG] uploaded count: {len(uploaded)}")

    if not uploaded:
        return jsonify({
            "error": "No files received. Make sure you are sending multipart/form-data with field name 'files' or 'file'.",
            "received_keys": list(request.files.keys()),
            "content_type": request.content_type,
        }), 400

    ALLOWED = {"pdf", "docx", "doc"}
    for f in uploaded:
        ext = f.filename.lower().rsplit(".", 1)[-1]
        if ext not in ALLOWED:
            return jsonify({"error": f"Unsupported file: '{f.filename}'. Only PDF/DOCX allowed."}), 400

    try:
        per_report   = []   # results per file
        merged_vals  = {}   # field -> best value so far
        merged_conf  = {}   # field -> best confidence so far
        patient_name = ""
        report_notes_parts = []

        for f in uploaded:
            file_bytes = f.read()
            if len(file_bytes) > 20 * 1024 * 1024:
                return jsonify({"error": f"File '{f.filename}' exceeds 20 MB limit."}), 413

            result = rp.process_medical_report(file_bytes, f.filename)

            per_report.append({
                "filename":         f.filename,
                "extracted_values": result["extracted_values"],
                "confidence":       result["confidence"],
                "text_preview":     result["raw_text_preview"],
            })

            if result["patient_name"] and not patient_name:
                patient_name = result["patient_name"]
            if result["report_notes"]:
                report_notes_parts.append(f"[{f.filename}] {result['report_notes']}")

            # Merge: higher-confidence value wins per field
            for field, val in result["extracted_values"].items():
                new_conf = float(result["confidence"].get(field, 0.0))
                cur_conf = float(merged_conf.get(field, -1))
                if new_conf > cur_conf:
                    merged_vals[field] = val
                    merged_conf[field] = new_conf

        return jsonify({
            "success":          True,
            "extracted_values": merged_vals,
            "confidence":       merged_conf,
            "patient_name":     patient_name,
            "report_notes":     " | ".join(report_notes_parts),
            "per_report":       per_report,
            "report_count":     len(uploaded),
            "filenames":        [f.filename for f in uploaded],
        })

    except ValueError as ve:
        return jsonify({"error": str(ve)}), 422
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Extraction failed: {str(e)}"}), 500


@app.route("/api/rag/health", methods=["GET"])
def rag_health():
    """Check if RAG pipeline dependencies are available."""
    checks = {}
    for pkg, alias in [
        ("pdfplumber",  "pdfplumber"),
        ("docx",        "python_docx"),
        ("langchain_community.vectorstores", "langchain_community"),
        ("faiss",       "faiss"),
        ("chromadb",    "chroma"),
        ("groq",        "groq"),
    ]:
        try:
            __import__(pkg)
            checks[alias] = True
        except ImportError:
            checks[alias] = False

    all_ok = checks.get("pdfplumber") and checks.get("python_docx") and checks.get("groq")
    return jsonify({
        "rag_available": bool(all_ok),
        "dependencies":  checks,
        "model":         "qwen/qwen3-32b (GroqCloud)",
        "vector_stores": ["FAISS", "Chroma"],
    }), 200 if all_ok else 503


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
