import os
import io
import base64
import warnings
warnings.filterwarnings('ignore', message='.*InsecureKeyLengthWarning.*')
warnings.filterwarnings('ignore', category=DeprecationWarning)
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

_jwt_key = os.environ.get("JWT_SECRET_KEY", "xai-heart-super-secret-key-2024!!")
# Pad to minimum 32 bytes required by PyJWT for HS256
if len(_jwt_key.encode()) < 32:
    _jwt_key = _jwt_key.ljust(32, "!")
app.config["JWT_SECRET_KEY"] = _jwt_key
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
# PDF Report Generator — Professional Canvas Template
# ──────────────────────────────────────────────

import io, base64, math
from datetime import datetime
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib import colors

# ── Register Poppins ──────────────────────────────────────────────────────
_FONT_DIR = "/usr/share/fonts/truetype/google-fonts"
_FONTS_REGISTERED = False
def _register_fonts():
    global _FONTS_REGISTERED
    if _FONTS_REGISTERED:
        return
    import os, sys
    mapping = {
        "Poppins":          "Poppins-Regular.ttf",
        "Poppins-Bold":     "Poppins-Bold.ttf",
        "Poppins-SemiBold": "Poppins-Medium.ttf",
        "Poppins-Light":    "Poppins-Light.ttf",
        "Poppins-Italic":   "Poppins-Italic.ttf",
    }
    # Search order: local fonts/ dir, Linux system, Windows system
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    windows_font_dirs = [
        os.path.join(os.environ.get("WINDIR","C:\Windows"), "Fonts"),
        os.path.join(os.environ.get("LOCALAPPDATA",""), "Microsoft","Windows","Fonts"),
    ]
    search_dirs = [
        os.path.join(backend_dir, "fonts"),
        _FONT_DIR,
    ] + windows_font_dirs
    for name, fname in mapping.items():
        registered = False
        for d in search_dirs:
            path = os.path.join(d, fname)
            if os.path.exists(path):
                try:
                    pdfmetrics.registerFont(TTFont(name, path))
                    registered = True
                    break
                except Exception:
                    continue
        if not registered:
            # Fallback to Helvetica so PDF still generates
            pass
    _FONTS_REGISTERED = True

# ── Colour Palette ────────────────────────────────────────────────────────
NAVY    = colors.HexColor("#0B1F45")
BLUE    = colors.HexColor("#1A56DB")
LBLUE   = colors.HexColor("#EFF6FF")
LBLUE2  = colors.HexColor("#DBEAFE")
TEAL    = colors.HexColor("#0E7490")
LTEAL   = colors.HexColor("#ECFEFF")
RED     = colors.HexColor("#DC2626")
LRED    = colors.HexColor("#FEF2F2")
ORANGE  = colors.HexColor("#D97706")
LORANGE = colors.HexColor("#FFFBEB")
GREEN   = colors.HexColor("#16A34A")
LGREEN  = colors.HexColor("#F0FDF4")
SLATE   = colors.HexColor("#64748B")
LGRAY   = colors.HexColor("#F1F5F9")
LGRAY2  = colors.HexColor("#E2E8F0")
DTEXT   = colors.HexColor("#1E293B")
MTEXT   = colors.HexColor("#475569")
WHITE   = colors.white

# ── Canvas helpers ────────────────────────────────────────────────────────
def rgb(c):
    return c.red, c.green, c.blue

def filled_rect(cv, x, y, w, h, fill, radius=0, stroke_color=None, stroke_width=0.5):
    cv.saveState()
    cv.setFillColor(fill)
    if stroke_color:
        cv.setStrokeColor(stroke_color)
        cv.setLineWidth(stroke_width)
    if radius > 0:
        cv.roundRect(x, y, w, h, radius, stroke=1 if stroke_color else 0, fill=1)
    else:
        cv.rect(x, y, w, h, stroke=1 if stroke_color else 0, fill=1)
    cv.restoreState()

def draw_text(cv, x, y, text, font, size, color=DTEXT, align="left", max_width=None):
    cv.saveState()
    cv.setFont(font, size)
    cv.setFillColor(color)
    if max_width:
        # Truncate with ellipsis if too wide
        while cv.stringWidth(text, font, size) > max_width and len(text) > 4:
            text = text[:-4] + "..."
    if align == "center":
        cv.drawCentredString(x, y, text)
    elif align == "right":
        cv.drawRightString(x, y, text)
    else:
        cv.drawString(x, y, text)
    cv.restoreState()

def draw_wrapped(cv, x, y, text, font, size, color, max_width, line_height, max_lines=99):
    """Draw word-wrapped text, returns final y after last line."""
    cv.saveState()
    cv.setFont(font, size)
    cv.setFillColor(color)
    words = text.split()
    line, lines = "", []
    for w in words:
        test = (line + " " + w).strip()
        if cv.stringWidth(test, font, size) <= max_width:
            line = test
        else:
            if line:
                lines.append(line)
            line = w
    if line:
        lines.append(line)
    for i, l in enumerate(lines[:max_lines]):
        cv.drawString(x, y - i * line_height, l)
    cv.restoreState()
    return y - (min(len(lines), max_lines) - 1) * line_height

def hline(cv, x, y, w, color=LGRAY2, thickness=0.5):
    cv.saveState()
    cv.setStrokeColor(color)
    cv.setLineWidth(thickness)
    cv.line(x, y, x + w, y)
    cv.restoreState()

def section_header(cv, x, y, w, label, accent=BLUE):
    """Draw a section title with accent bar."""
    filled_rect(cv, x, y + 2, 3, 16, accent)
    draw_text(cv, x + 9, y + 4, label, "Poppins-Bold", 10.5, NAVY)
    hline(cv, x, y - 1, w, LGRAY2, 0.6)
    return y - 6

# ── Field display helpers ─────────────────────────────────────────────────
def _thal_label(v):
    return {3:"Normal", 6:"Fixed Defect", 7:"Reversible Defect"}.get(int(v), f"Value {int(v)}")
def _cp_label(v):
    return {0:"Typical Angina", 1:"Atypical Angina", 2:"Non-anginal Pain", 3:"Asymptomatic"}.get(int(v), "—")
def _restecg_label(v):
    return {0:"Normal", 1:"ST-T Abnormality", 2:"LV Hypertrophy"}.get(int(v), "—")
def _slope_label(v):
    return {1:"Upsloping", 2:"Flat", 3:"Downsloping"}.get(int(v), "—")

# ── Rounded progress bar ──────────────────────────────────────────────────
def progress_bar(cv, x, y, w, h, pct, fill_color, bg_color=LGRAY2, radius=3):
    filled_rect(cv, x, y, w, h, bg_color, radius)
    bar_w = max(radius * 2, w * min(pct, 1.0))
    filled_rect(cv, x, y, bar_w, h, fill_color, radius)

# ═════════════════════════════════════════════════════════════════════════════
# MAIN REPORT FUNCTION
# ═════════════════════════════════════════════════════════════════════════════
def generate_pdf_report(input_dict, prob, shap_vector, explanation, shap_chart_b64, patient_info=None):
    _register_fonts()

    buf = io.BytesIO()
    W_pt, H_pt = A4          # 595.27 x 841.89
    ML, MR = 36, 36          # left/right margins
    CW = W_pt - ML - MR      # content width = 523.27

    cv = canvas.Canvas(buf, pagesize=A4)
    cv.setTitle("CardioXAI Heart Disease Risk Assessment Report")

    pi       = patient_info or {}
    now      = datetime.now().strftime("%B %d, %Y  ·  %I:%M %p")
    risk_pct = round(prob * 100, 1)
    pat_name = pi.get("name", "Anonymous Patient")

    if prob > 0.7:
        risk_label, risk_color, risk_bg, risk_icon = "HIGH RISK",     RED,    LRED,    "!"
    elif prob > 0.4:
        risk_label, risk_color, risk_bg, risk_icon = "MODERATE RISK", ORANGE, LORANGE, "~"
    else:
        risk_label, risk_color, risk_bg, risk_icon = "LOW RISK",      GREEN,  LGREEN,  "✓"

    # ── PAGE 1 ────────────────────────────────────────────────────────────

    # ╔══════════════════════════════════════════════════════════════════════╗
    # ║  HEADER BAND                                                         ║
    # ╚══════════════════════════════════════════════════════════════════════╝
    HEADER_H = 72
    filled_rect(cv, 0, H_pt - HEADER_H, W_pt, HEADER_H, NAVY)

    # Logo area — heart icon circle
    cx_logo, cy_logo = ML + 22, H_pt - HEADER_H/2
    cv.saveState()
    cv.setFillColor(BLUE)
    cv.circle(cx_logo, cy_logo, 18, stroke=0, fill=1)
    cv.setFillColor(WHITE)
    cv.setFont("Poppins-Bold", 16)
    cv.drawCentredString(cx_logo, cy_logo - 6, "+")
    cv.restoreState()

    draw_text(cv, cx_logo + 26, H_pt - 27, "CardioXAI", "Poppins-Bold", 17, WHITE)
    draw_text(cv, cx_logo + 26, H_pt - 42, "Heart Disease Risk Assessment", "Poppins", 9, colors.HexColor("#93C5FD"))
    draw_text(cv, cx_logo + 26, H_pt - 54, "Confidential Medical Report", "Poppins-Light", 7.5, colors.HexColor("#93C5FD"))

    # Right side — date / report ID
    draw_text(cv, W_pt - MR, H_pt - 26, f"Report Date:  {now}", "Poppins", 7.5, colors.HexColor("#93C5FD"), align="right")
    report_id = f"CXR-{datetime.now().strftime('%Y%m%d-%H%M')}"
    draw_text(cv, W_pt - MR, H_pt - 39, f"Report ID:  {report_id}", "Poppins-Light", 7.5, colors.HexColor("#BFDBFE"), align="right")
    draw_text(cv, W_pt - MR, H_pt - 52, "For Clinical Use Only", "Poppins-Italic", 7, colors.HexColor("#7CB9E8"), align="right")

    # ── Patient info strip ────────────────────────────────────────────────
    STRIP_Y = H_pt - HEADER_H - 28
    filled_rect(cv, 0, STRIP_Y, W_pt, 28, LBLUE2)
    hline(cv, 0, STRIP_Y, W_pt, LBLUE, 0.8)
    hline(cv, 0, STRIP_Y + 28, W_pt, LBLUE, 0.8)

    fields_strip = [
        ("PATIENT", pat_name),
        ("AGE / SEX", f"{input_dict.get('age','—')} yrs  ·  {'Male' if int(input_dict.get('sex',1))==1 else 'Female'}"),
        ("REFERRING PHYSICIAN", pi.get("physician", "Dr. A. Rahman MRCP")),
        ("FACILITY", pi.get("facility", "City Cardiac Centre")),
    ]
    col_w = W_pt / 4
    for i, (lbl, val) in enumerate(fields_strip):
        cx = i * col_w + col_w / 2
        draw_text(cv, cx, STRIP_Y + 17, lbl, "Poppins-Bold", 6.5, SLATE, align="center")
        draw_text(cv, cx, STRIP_Y + 6,  val, "Poppins-SemiBold", 8, NAVY, align="center", max_width=col_w - 8)

    Y = STRIP_Y - 16   # current draw position (top of content area)

    # ╔══════════════════════════════════════════════════════════════════════╗
    # ║  RISK RESULT CARD                                                    ║
    # ╚══════════════════════════════════════════════════════════════════════╝
    CARD_H = 82
    filled_rect(cv, ML, Y - CARD_H, CW, CARD_H, risk_bg, radius=6, stroke_color=risk_color, stroke_width=0.8)

    # Left: big risk label
    filled_rect(cv, ML, Y - CARD_H, 120, CARD_H, risk_color, radius=6)
    # Square off right side of left panel
    filled_rect(cv, ML + 110, Y - CARD_H, 10, CARD_H, risk_color)
    draw_text(cv, ML + 60, Y - 28, risk_label, "Poppins-Bold", 11.5, WHITE, align="center")
    draw_text(cv, ML + 60, Y - 43, f"{risk_pct}%", "Poppins-Bold", 22, WHITE, align="center")
    draw_text(cv, ML + 60, Y - 57, "Probability", "Poppins-Light", 8, colors.HexColor("#FECDD3" if prob > 0.7 else "#FEF3C7" if prob > 0.4 else "#BBF7D0"), align="center")

    # Right: description + progress bar
    RX = ML + 134
    RW = CW - 134 - 12

    if prob > 0.7:
        verdict_text = "Significant cardiovascular risk detected. Multiple clinical risk factors are present. Urgent cardiology evaluation is strongly recommended."
    elif prob > 0.4:
        verdict_text = "Moderate cardiovascular risk detected. Some clinical parameters require further diagnostic screening and specialist review."
    else:
        verdict_text = "Low cardiovascular risk detected. Most clinical indicators are within safe physiological ranges. Continue preventive health practices."

    draw_text(cv, RX, Y - 16, "ASSESSMENT RESULT", "Poppins-Bold", 7, SLATE)
    draw_wrapped(cv, RX, Y - 27, verdict_text, "Poppins", 8.5, DTEXT, RW, 13, max_lines=3)
    # Progress bar
    BAR_Y = Y - CARD_H + 18
    draw_text(cv, RX, BAR_Y + 10, "Risk Probability Gauge", "Poppins", 7, SLATE)
    progress_bar(cv, RX, BAR_Y - 2, RW, 8, prob, risk_color, LGRAY2, radius=4)
    draw_text(cv, RX, BAR_Y - 13, "0%", "Poppins-Light", 6.5, SLATE)
    draw_text(cv, RX + RW/2, BAR_Y - 13, "50%", "Poppins-Light", 6.5, SLATE, align="center")
    draw_text(cv, RX + RW, BAR_Y - 13, "100%", "Poppins-Light", 6.5, SLATE, align="right")

    Y -= CARD_H + 18

    # ╔══════════════════════════════════════════════════════════════════════╗
    # ║  13 CLINICAL PARAMETERS — 3-column grid                             ║
    # ╚══════════════════════════════════════════════════════════════════════╝
    Y = section_header(cv, ML, Y, CW, "Clinical Input Parameters")
    Y -= 8

    params = [
        ("Age",               f"{input_dict['age']} years",                           "Demographics",  BLUE,   LBLUE),
        ("Biological Sex",    "Male" if int(input_dict['sex'])==1 else "Female",       "Demographics",  BLUE,   LBLUE),
        ("Chest Pain Type",   _cp_label(input_dict['cp']),                             "Symptoms",     colors.HexColor("#7C3AED"), colors.HexColor("#F5F3FF")),
        ("Resting BP",        f"{input_dict['trestbps']} mm Hg",                      "Vitals",        TEAL,   LTEAL),
        ("Serum Cholesterol", f"{input_dict['chol']} mg/dL",                           "Blood Labs",    ORANGE, LORANGE),
        ("Fasting Blood Sugar",">120 mg/dL" if input_dict['fbs']==1 else "Normal (≤120 mg/dL)", "Blood Labs", ORANGE, LORANGE),
        ("Resting ECG",       _restecg_label(input_dict['restecg']),                  "ECG",          colors.HexColor("#BE185D"), colors.HexColor("#FDF2F8")),
        ("Max Heart Rate",    f"{input_dict['thalach']} bpm",                          "Stress Test",   RED,    LRED),
        ("Exercise Angina",   "Present" if input_dict['exang']==1 else "Absent",       "Stress Test",   RED,    LRED),
        ("ST Depression",     f"{input_dict['oldpeak']} mm",                           "Stress Test",   RED,    LRED),
        ("ST Slope",          _slope_label(input_dict['slope']),                       "Stress Test",   RED,    LRED),
        ("Major Vessels",     f"{int(input_dict['ca'])} vessel{'s' if int(input_dict['ca'])!=1 else ''}", "Angiography", GREEN, LGREEN),
        ("Thalassemia",       _thal_label(input_dict['thal']),                         "MPI Scan",     colors.HexColor("#6D28D9"), colors.HexColor("#FAF5FF")),
    ]

    NCOLS   = 3
    GAP     = 6
    CARD_W  = (CW - GAP * (NCOLS - 1)) / NCOLS
    CARD_PH = 52   # card height

    for idx, (label, value, source, accent, bg) in enumerate(params):
        col = idx % NCOLS
        row = idx // NCOLS
        cx  = ML + col * (CARD_W + GAP)
        cy  = Y - row * (CARD_PH + GAP)

        # Card background
        filled_rect(cv, cx, cy - CARD_PH, CARD_W, CARD_PH, bg, radius=5,
                    stroke_color=colors.Color(accent.red, accent.green, accent.blue, alpha=0.3), stroke_width=0.6)
        # Accent top bar
        filled_rect(cv, cx, cy - 3, CARD_W, 3, accent, radius=2)
        # Square off bottom of top bar
        filled_rect(cv, cx, cy - 6, CARD_W, 3, accent)

        draw_text(cv, cx + 8, cy - 15, label.upper(), "Poppins-Bold", 6.5, accent, max_width=CARD_W - 16)
        # Value — auto-shrink if long
        val_size = 10 if len(value) < 16 else 8.5
        draw_text(cv, cx + 8, cy - 28, value, "Poppins-SemiBold", val_size, DTEXT, max_width=CARD_W - 16)
        # Source badge
        badge_w = min(cv.stringWidth(source, "Poppins", 6) + 10, CARD_W - 16)
        filled_rect(cv, cx + 8, cy - CARD_PH + 7, badge_w, 12,
                    colors.Color(accent.red, accent.green, accent.blue, alpha=0.12), radius=3)
        draw_text(cv, cx + 8 + badge_w/2, cy - CARD_PH + 12, source, "Poppins", 6,
                  accent, align="center", max_width=badge_w - 4)

    # Advance Y past the grid
    NROWS = math.ceil(len(params) / NCOLS)
    Y -= NROWS * (CARD_PH + GAP) + 14

    # ╔══════════════════════════════════════════════════════════════════════╗
    # ║  SHAP CHART                                                          ║
    # ╚══════════════════════════════════════════════════════════════════════╝
    if shap_chart_b64 and Y > 120:
        Y = section_header(cv, ML, Y, CW, "Explainable AI — Feature Impact Analysis")
        Y -= 8
        chart_h = min(140, Y - 40)
        if chart_h > 60:
            img_buf = io.BytesIO(base64.b64decode(shap_chart_b64))
            filled_rect(cv, ML, Y - chart_h - 4, CW, chart_h + 8, LGRAY, radius=4)
            try:
                from reportlab.platypus import Image as RLImage
                img = RLImage(img_buf, width=CW - 16, height=chart_h)
                img.drawOn(cv, ML + 8, Y - chart_h)
            except Exception:
                draw_text(cv, ML + CW/2, Y - chart_h/2, "[SHAP Chart]", "Poppins-Italic", 9, SLATE, align="center")
            Y -= chart_h + 20

    # If not enough room for factors, start new page
    if Y < 200:
        cv.showPage()
        cv.setTitle("CardioXAI Heart Disease Risk Assessment Report")
        # Mini header on page 2
        filled_rect(cv, 0, H_pt - 32, W_pt, 32, NAVY)
        draw_text(cv, ML, H_pt - 21, "CardioXAI — Heart Disease Risk Assessment Report (continued)", "Poppins-Bold", 9, WHITE)
        draw_text(cv, W_pt - MR, H_pt - 21, f"{pat_name}  ·  {report_id}", "Poppins", 7.5, colors.HexColor("#93C5FD"), align="right")
        Y = H_pt - 52

    # ╔══════════════════════════════════════════════════════════════════════╗
    # ║  RISK & PROTECTIVE FACTORS — side by side                           ║
    # ╚══════════════════════════════════════════════════════════════════════╝
    rf_list = explanation.get("risk_factors", [])
    pf_list = explanation.get("protective_factors", [])

    if rf_list or pf_list:
        Y = section_header(cv, ML, Y, CW, "Clinical Factors Driving the Prediction")
        Y -= 12

        COL_W  = CW / 2 - 5
        LX, RX = ML, ML + CW / 2 + 5

        # Column headers
        filled_rect(cv, LX, Y - 22, COL_W, 22, LRED, radius=4,
                    stroke_color=colors.HexColor("#FECACA"), stroke_width=0.6)
        draw_text(cv, LX + COL_W/2, Y - 14, "Risk-Elevating Factors", "Poppins-Bold", 8.5, RED, align="center")

        filled_rect(cv, RX, Y - 22, COL_W, 22, LGREEN, radius=4,
                    stroke_color=colors.HexColor("#86EFAC"), stroke_width=0.6)
        draw_text(cv, RX + COL_W/2, Y - 14, "Protective Factors", "Poppins-Bold", 8.5, GREEN, align="center")
        Y -= 28

        ITEM_H = 52
        max_rows = max(len(rf_list), len(pf_list))

        for i in range(max_rows):
            if Y - ITEM_H < 50:
                cv.showPage()
                filled_rect(cv, 0, H_pt - 32, W_pt, 32, NAVY)
                draw_text(cv, ML, H_pt - 21, "CardioXAI — Heart Disease Risk Assessment Report (continued)", "Poppins-Bold", 9, WHITE)
                draw_text(cv, W_pt - MR, H_pt - 21, f"{pat_name}  ·  {report_id}", "Poppins", 7.5, colors.HexColor("#93C5FD"), align="right")
                Y = H_pt - 52
                # Reprint column headers after page break
                filled_rect(cv, LX, Y - 22, COL_W, 22, LRED, radius=4,
                            stroke_color=colors.HexColor("#FECACA"), stroke_width=0.6)
                draw_text(cv, LX + COL_W/2, Y - 14, "Risk-Elevating Factors", "Poppins-Bold", 8.5, RED, align="center")
                filled_rect(cv, RX, Y - 22, COL_W, 22, LGREEN, radius=4,
                            stroke_color=colors.HexColor("#86EFAC"), stroke_width=0.6)
                draw_text(cv, RX + COL_W/2, Y - 14, "Protective Factors", "Poppins-Bold", 8.5, GREEN, align="center")
                Y -= 28

            # Risk factor card
            if i < len(rf_list):
                f   = rf_list[i]
                pct = round(abs(f["impact"]) * 100, 2)
                filled_rect(cv, LX, Y - ITEM_H, COL_W, ITEM_H, LGRAY, radius=4,
                            stroke_color=colors.HexColor("#FECACA"), stroke_width=0.5)
                # Red accent strip left
                filled_rect(cv, LX, Y - ITEM_H, 3, ITEM_H, RED, radius=2)
                draw_text(cv, LX + 9, Y - 12, f["label"], "Poppins-Bold", 8.5, RED, max_width=COL_W - 60)
                draw_text(cv, LX + COL_W - 5, Y - 12, f"+{pct}%", "Poppins-Bold", 8, RED, align="right")
                draw_text(cv, LX + 9, Y - 23, f"Value: {f['value']}", "Poppins-SemiBold", 7.5, MTEXT, max_width=COL_W - 16)
                draw_wrapped(cv, LX + 9, Y - 34, f.get("explanation",""), "Poppins", 7, MTEXT,
                             COL_W - 16, 11, max_lines=2)

            # Protective factor card
            if i < len(pf_list):
                f   = pf_list[i]
                pct = round(abs(f["impact"]) * 100, 2)
                filled_rect(cv, RX, Y - ITEM_H, COL_W, ITEM_H, LGRAY, radius=4,
                            stroke_color=colors.HexColor("#86EFAC"), stroke_width=0.5)
                filled_rect(cv, RX, Y - ITEM_H, 3, ITEM_H, GREEN, radius=2)
                draw_text(cv, RX + 9, Y - 12, f["label"], "Poppins-Bold", 8.5, GREEN, max_width=COL_W - 60)
                draw_text(cv, RX + COL_W - 5, Y - 12, f"-{pct}%", "Poppins-Bold", 8, GREEN, align="right")
                draw_text(cv, RX + 9, Y - 23, f"Value: {f['value']}", "Poppins-SemiBold", 7.5, MTEXT, max_width=COL_W - 16)
                draw_wrapped(cv, RX + 9, Y - 34, f.get("explanation",""), "Poppins", 7, MTEXT,
                             COL_W - 16, 11, max_lines=2)

            Y -= ITEM_H + 6

    Y -= 8

    # ╔══════════════════════════════════════════════════════════════════════╗
    # ║  OVERALL ASSESSMENT BOX                                              ║
    # ╚══════════════════════════════════════════════════════════════════════╝
    if Y < 120:
        cv.showPage()
        filled_rect(cv, 0, H_pt - 32, W_pt, 32, NAVY)
        draw_text(cv, ML, H_pt - 21, "CardioXAI — Heart Disease Risk Assessment Report (continued)", "Poppins-Bold", 9, WHITE)
        draw_text(cv, W_pt - MR, H_pt - 21, f"{pat_name}  ·  {report_id}", "Poppins", 7.5, colors.HexColor("#93C5FD"), align="right")
        Y = H_pt - 52

    Y = section_header(cv, ML, Y, CW, "Overall Clinical Assessment")
    Y -= 10

    overall = explanation.get("overall_assessment", "")
    # Estimate height needed (approx 12pt per line, ~80 chars per line)
    est_lines = max(2, math.ceil(len(overall) / 90))
    ASSESS_H = est_lines * 13 + 20
    filled_rect(cv, ML, Y - ASSESS_H, CW, ASSESS_H, LBLUE, radius=5,
                stroke_color=BLUE, stroke_width=0.8)
    filled_rect(cv, ML, Y - ASSESS_H, 4, ASSESS_H, BLUE, radius=2)
    draw_wrapped(cv, ML + 12, Y - 12, overall, "Poppins", 9, DTEXT, CW - 24, 13)
    Y -= ASSESS_H + 16

    # ╔══════════════════════════════════════════════════════════════════════╗
    # ║  CLINICAL RECOMMENDATIONS TABLE                                      ║
    # ╚══════════════════════════════════════════════════════════════════════╝
    if Y < 140:
        cv.showPage()
        filled_rect(cv, 0, H_pt - 32, W_pt, 32, NAVY)
        draw_text(cv, ML, H_pt - 21, "CardioXAI — Heart Disease Risk Assessment Report (continued)", "Poppins-Bold", 9, WHITE)
        draw_text(cv, W_pt - MR, H_pt - 21, f"{pat_name}  ·  {report_id}", "Poppins", 7.5, colors.HexColor("#93C5FD"), align="right")
        Y = H_pt - 52

    Y = section_header(cv, ML, Y, CW, "Clinical Recommendations")
    Y -= 10

    if prob > 0.7:
        recs = [
            ("Urgent Cardiology Referral",   "Schedule consultation within 1–2 weeks for comprehensive cardiac evaluation."),
            ("Coronary Imaging",             "Consider CCTA or invasive angiography based on clinical presentation."),
            ("Medication Review",            "Optimise antiplatelet, statin, and antihypertensive pharmacotherapy."),
            ("Cardiac Rehabilitation",       "Supervised rehabilitation program; low-fat diet; graded aerobic activity."),
            ("Strict Risk Factor Control",   "Target BP <130/80 mmHg · LDL <70 mg/dL · Fasting glucose <100 mg/dL."),
        ]
    elif prob > 0.4:
        recs = [
            ("Cardiology Consultation",      "Outpatient review within 4–6 weeks; risk stratification assessment."),
            ("Diagnostic Workup",            "Stress ECG or echocardiogram for further cardiovascular evaluation."),
            ("Lipid & BP Optimisation",      "Statin therapy review; target BP <130/80 mmHg."),
            ("Lifestyle Modification",       "Mediterranean diet · 150 min/week aerobic exercise · smoking cessation."),
            ("Follow-up Assessment",         "Repeat cardiovascular risk evaluation in 3–6 months."),
        ]
    else:
        recs = [
            ("Routine Annual Review",        "Annual cardiovascular risk assessment with primary care physician."),
            ("Preventive Health Practices",  "Maintain healthy weight, regular exercise, and heart-healthy diet."),
            ("Lipid & Glucose Monitoring",   "Repeat fasting lipid panel and glucose in 12 months."),
            ("Blood Pressure Monitoring",    "Regular home BP monitoring; target <120/80 mmHg."),
            ("Lifestyle Maintenance",        "Avoid smoking and excess alcohol; maintain current healthy practices."),
        ]

    # Table header
    ROW_H = 28
    filled_rect(cv, ML, Y - ROW_H, CW, ROW_H, TEAL, radius=4)
    # Square off bottom corners of header
    filled_rect(cv, ML, Y - ROW_H, CW, 4, TEAL)
    draw_text(cv, ML + 28, Y - 11, "#", "Poppins-Bold", 8, WHITE)
    draw_text(cv, ML + 50, Y - 11, "Recommendation", "Poppins-Bold", 8, WHITE)
    draw_text(cv, ML + 195, Y - 11, "Clinical Action", "Poppins-Bold", 8, WHITE)
    Y -= ROW_H

    for idx, (title, detail) in enumerate(recs):
        if Y - ROW_H < 50:
            cv.showPage()
            filled_rect(cv, 0, H_pt - 32, W_pt, 32, NAVY)
            draw_text(cv, ML, H_pt - 21, "CardioXAI — Heart Disease Risk Assessment Report (continued)", "Poppins-Bold", 9, WHITE)
            draw_text(cv, W_pt - MR, H_pt - 21, f"{pat_name}  ·  {report_id}", "Poppins", 7.5, colors.HexColor("#93C5FD"), align="right")
            Y = H_pt - 52

        bg = LGRAY if idx % 2 == 0 else WHITE
        filled_rect(cv, ML, Y - ROW_H, CW, ROW_H, bg)
        hline(cv, ML, Y - ROW_H, CW, LGRAY2, 0.4)

        # Number badge
        filled_rect(cv, ML + 10, Y - ROW_H + 7, 18, 18, TEAL, radius=3)
        draw_text(cv, ML + 19, Y - ROW_H + 12, str(idx + 1), "Poppins-Bold", 8, WHITE, align="center")

        draw_text(cv, ML + 34, Y - 8, title, "Poppins-Bold", 8, NAVY, max_width=140)
        draw_text(cv, ML + 34, Y - 19, detail, "Poppins", 7.5, MTEXT, max_width=140)
        # Vertical divider
        hline(cv, ML + 188, Y - ROW_H, 0, LGRAY2)
        cv.saveState()
        cv.setStrokeColor(LGRAY2)
        cv.setLineWidth(0.4)
        cv.line(ML + 188, Y, ML + 188, Y - ROW_H)
        cv.restoreState()
        draw_wrapped(cv, ML + 196, Y - 8, detail, "Poppins", 7.5, MTEXT, CW - 200, 11, max_lines=2)
        # Overwrite title side with just the title (clean separation)
        draw_text(cv, ML + 34, Y - 8, title, "Poppins-Bold", 8, NAVY, max_width=148)
        cv.saveState()
        cv.setFillColor(bg)
        cv.rect(ML + 34, Y - 23, 148, 13, stroke=0, fill=1)
        cv.restoreState()

        Y -= ROW_H

    # Bottom border of table
    hline(cv, ML, Y, CW, LGRAY2, 0.5)
    Y -= 18

    # ╔══════════════════════════════════════════════════════════════════════╗
    # ║  FOOTER / DISCLAIMER                                                 ║
    # ╚══════════════════════════════════════════════════════════════════════╝
    if Y < 60:
        cv.showPage()
        Y = 80

    FOOTER_H = 40
    FOOTER_Y = max(20, Y - FOOTER_H - 8)
    filled_rect(cv, 0, FOOTER_Y, W_pt, FOOTER_H, LGRAY)
    hline(cv, 0, FOOTER_Y + FOOTER_H, W_pt, LGRAY2, 0.8)
    disc = ("Medical Disclaimer: This report is generated by an AI-based predictive system for informational "
            "purposes only. It does not constitute a clinical diagnosis or medical advice. "
            "All findings must be interpreted by a qualified healthcare professional.")
    draw_wrapped(cv, ML, FOOTER_Y + FOOTER_H - 8, disc, "Poppins-Italic", 7, SLATE, CW, 10, max_lines=2)
    draw_text(cv, ML, FOOTER_Y + 8, f"CardioXAI  ·  {now}  ·  Confidential", "Poppins-Light", 6.5, SLATE)
    draw_text(cv, W_pt - MR, FOOTER_Y + 8, f"Page 1  ·  {report_id}", "Poppins-Light", 6.5, SLATE, align="right")

    cv.save()
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

    ALLOWED_EXT  = {"pdf", "docx", "doc"}
    ALLOWED_MIME = {
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
        "application/octet-stream",   # iOS sometimes sends this for PDFs
    }
    for f in uploaded:
        fname    = f.filename or "report.pdf"
        parts    = fname.lower().rsplit(".", 1)
        ext      = parts[-1] if len(parts) > 1 else ""
        mimetype = (f.content_type or "").lower().split(";")[0].strip()

        valid_ext  = ext in ALLOWED_EXT
        valid_mime = mimetype in ALLOWED_MIME

        if not valid_ext and not valid_mime:
            return jsonify({"error": f"Unsupported file: '{fname}'. Only PDF/DOCX allowed."}), 400

        # If extension is missing, infer from MIME type so pdfplumber/docx picks correct parser
        if not ext or ext not in ALLOWED_EXT:
            if "pdf" in mimetype or "pdf" in fname:
                f.filename = fname + ".pdf"
            else:
                f.filename = fname + ".docx"

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
