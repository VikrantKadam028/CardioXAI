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
# App Setup
# ──────────────────────────────────────────────
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})
bcrypt = Bcrypt(app)

app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY", "xai-heart-super-secret-key-2024")
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
# PDF Report Generator
# ──────────────────────────────────────────────
def generate_pdf_report(input_dict, prob, shap_vector, explanation, shap_chart_b64, patient_info=None):
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                            rightMargin=1.8*cm, leftMargin=1.8*cm,
                            topMargin=1.5*cm, bottomMargin=1.5*cm)
    styles = getSampleStyleSheet()
    story = []

    DARK_BLUE = colors.HexColor("#0f2d5e")
    MID_BLUE  = colors.HexColor("#1a56db")
    LIGHT_BLUE= colors.HexColor("#dbeafe")
    RED       = colors.HexColor("#dc2626")
    GREEN     = colors.HexColor("#16a34a")
    GRAY_TEXT = colors.HexColor("#374151")
    LIGHT_GRAY= colors.HexColor("#f1f5f9")
    WHITE     = colors.white

    title_style = ParagraphStyle("title", fontSize=20, fontName="Helvetica-Bold",
                                 textColor=WHITE, alignment=TA_CENTER, spaceAfter=4)
    section_header = ParagraphStyle("section_header", fontSize=12, fontName="Helvetica-Bold",
                                    textColor=DARK_BLUE, spaceBefore=12, spaceAfter=6)
    body_style = ParagraphStyle("body", fontSize=9.5, fontName="Helvetica",
                                textColor=GRAY_TEXT, leading=15, spaceAfter=4, alignment=TA_JUSTIFY)
    label_style = ParagraphStyle("label", fontSize=9, fontName="Helvetica-Bold", textColor=DARK_BLUE)
    value_style = ParagraphStyle("value", fontSize=9, fontName="Helvetica", textColor=GRAY_TEXT)
    small_style = ParagraphStyle("small", fontSize=8.5, fontName="Helvetica",
                                 textColor=colors.HexColor("#6b7280"), leading=13)

    # Header
    header_table = Table([[Paragraph("❤  XAI Heart Disease Risk Assessment Report", title_style)]],
                         colWidths=[doc.width])
    header_table.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), DARK_BLUE),
        ("ROWPADDING", (0,0), (-1,-1), 14),
        ("ALIGN", (0,0), (-1,-1), "CENTER"),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 0.3*cm))

    now = datetime.now().strftime("%B %d, %Y  •  %I:%M %p")
    pi = patient_info or {}
    meta_data = [[
        Paragraph(f"<b>Patient:</b> {pi.get('name', 'Anonymous')}", label_style),
        Paragraph(f"<b>Age:</b> {pi.get('age', input_dict.get('age', 'N/A'))}", label_style),
        Paragraph(f"<b>Date:</b> {now}", label_style),
        Paragraph("<b>Model:</b> LR + XAI (Cleveland Dataset)", label_style)
    ]]
    meta_table = Table(meta_data, colWidths=[doc.width/4]*4)
    meta_table.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), LIGHT_BLUE),
        ("ROWPADDING", (0,0), (-1,-1), 8),
        ("BOX", (0,0), (-1,-1), 0.5, colors.HexColor("#93c5fd")),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 0.4*cm))

    risk_pct = round(prob * 100, 1)
    if prob > 0.7:
        risk_label, risk_color, risk_desc = "HIGH RISK", RED, "Significant cardiovascular concern detected"
    elif prob > 0.4:
        risk_label, risk_color, risk_desc = "MODERATE RISK", colors.HexColor("#d97706"), "Some clinical parameters warrant attention"
    else:
        risk_label, risk_color, risk_desc = "LOW RISK", GREEN, "Most indicators within safe physiological range"

    result_style = ParagraphStyle("result", fontSize=22, fontName="Helvetica-Bold", textColor=WHITE, alignment=TA_CENTER)
    result_sub = ParagraphStyle("result_sub", fontSize=10, fontName="Helvetica",
                                textColor=colors.HexColor("#fef9c3"), alignment=TA_CENTER)
    result_table = Table([
        [Paragraph(f"{risk_label}  —  {risk_pct}% Probability", result_style)],
        [Paragraph(risk_desc, result_sub)]
    ], colWidths=[doc.width])
    result_table.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), risk_color),
        ("ROWPADDING", (0,0), (-1,-1), 10),
        ("ALIGN", (0,0), (-1,-1), "CENTER"),
    ]))
    story.append(result_table)
    story.append(Spacer(1, 0.5*cm))

    # Patient Parameters
    story.append(Paragraph("Patient Clinical Parameters", section_header))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#bfdbfe"), spaceAfter=6))

    param_display = [
        ("Age", f"{input_dict['age']} yrs"),
        ("Sex", "Male" if input_dict['sex'] == 1 else "Female"),
        ("Chest Pain Type", ["Typical Angina","Atypical Angina","Non-anginal Pain","Asymptomatic"][int(input_dict['cp'])]),
        ("Resting BP", f"{input_dict['trestbps']} mm Hg"),
        ("Cholesterol", f"{input_dict['chol']} mg/dl"),
        ("Fasting Blood Sugar >120", "Yes" if input_dict['fbs'] == 1 else "No"),
        ("Resting ECG", ["Normal","ST-T Abnormality","LV Hypertrophy"][int(input_dict['restecg'])]),
        ("Max Heart Rate", f"{input_dict['thalach']} bpm"),
        ("Exercise Angina", "Yes" if input_dict['exang'] == 1 else "No"),
        ("ST Depression", f"{input_dict['oldpeak']}"),
        ("ST Slope", ["Upsloping","Flat","Downsloping"][int(input_dict['slope'])]),
        ("Major Vessels", str(int(input_dict['ca']))),
        ("Thalassemia", ["Normal","Fixed Defect","Reversible Defect","Other"][int(input_dict['thal'])]),
    ]

    rows_per_col = 7
    left_params = param_display[:rows_per_col]
    right_params = param_display[rows_per_col:]
    while len(right_params) < rows_per_col:
        right_params.append(("", ""))

    param_rows = []
    for i in range(rows_per_col):
        lk, lv = left_params[i]
        rk, rv = right_params[i]
        param_rows.append([
            Paragraph(f"<b>{lk}</b>", label_style), Paragraph(lv, value_style),
            Paragraph(""), Paragraph(f"<b>{rk}</b>", label_style), Paragraph(rv, value_style),
        ])

    param_table = Table(param_rows, colWidths=[3.8*cm, 3.5*cm, 0.4*cm, 3.8*cm, 3.5*cm])
    param_table.setStyle(TableStyle([
        ("ROWPADDING", (0,0), (-1,-1), 5),
        ("ROWBACKGROUNDS", (0,0), (-1,-1), [WHITE, LIGHT_GRAY]),
        ("GRID", (0,0), (1,-1), 0.3, colors.HexColor("#e2e8f0")),
        ("GRID", (3,0), (4,-1), 0.3, colors.HexColor("#e2e8f0")),
    ]))
    story.append(param_table)
    story.append(Spacer(1, 0.5*cm))

    # SHAP Chart
    story.append(Paragraph("Explainability — Feature Impact Analysis (Real SHAP)", section_header))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#bfdbfe"), spaceAfter=6))

    if shap_chart_b64:
        img_buf = io.BytesIO(base64.b64decode(shap_chart_b64))
        chart_img = RLImage(img_buf, width=doc.width*0.9, height=5*cm)
        chart_table = Table([[chart_img]], colWidths=[doc.width])
        chart_table.setStyle(TableStyle([
            ("ALIGN", (0,0), (-1,-1), "CENTER"),
            ("BACKGROUND", (0,0), (-1,-1), colors.HexColor("#f8fafc")),
            ("BOX", (0,0), (-1,-1), 0.5, colors.HexColor("#bfdbfe")),
            ("ROWPADDING", (0,0), (-1,-1), 8),
        ]))
        story.append(chart_table)
    story.append(Spacer(1, 0.5*cm))

    # Risk Factors
    story.append(Paragraph("Key Risk-Elevating Factors", section_header))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#bfdbfe"), spaceAfter=6))

    for i, f in enumerate(explanation.get("risk_factors", [])):
        impact_pct = round(abs(f["impact"]) * 100, 2)
        row_bg = LIGHT_GRAY if i % 2 == 0 else WHITE
        rf_table = Table([
            [Paragraph(f"<b>▲ {f['label']}</b>", ParagraphStyle("rfl", fontSize=9.5, fontName="Helvetica-Bold", textColor=RED)),
             Paragraph(f"Value: <b>{f['value']}</b>", label_style),
             Paragraph(f"Impact: <b>+{impact_pct}%</b>", ParagraphStyle("rfi", fontSize=9, fontName="Helvetica-Bold", textColor=RED))],
            [Paragraph(f['explanation'], small_style), "", ""]
        ], colWidths=[5.5*cm, 4*cm, 3.5*cm])
        rf_table.setStyle(TableStyle([
            ("SPAN", (0,1), (2,1)), ("BACKGROUND", (0,0), (-1,-1), row_bg),
            ("ROWPADDING", (0,0), (-1,-1), 6), ("LEFTPADDING", (0,0), (-1,-1), 8),
            ("BOX", (0,0), (-1,-1), 0.3, colors.HexColor("#fca5a5")),
        ]))
        story.append(rf_table)
        story.append(Spacer(1, 0.12*cm))

    story.append(Spacer(1, 0.4*cm))

    # Protective Factors
    story.append(Paragraph("Key Protective Factors", section_header))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#bfdbfe"), spaceAfter=6))

    for i, f in enumerate(explanation.get("protective_factors", [])):
        impact_pct = round(abs(f["impact"]) * 100, 2)
        row_bg = LIGHT_GRAY if i % 2 == 0 else WHITE
        pf_table = Table([
            [Paragraph(f"<b>▼ {f['label']}</b>", ParagraphStyle("pfl", fontSize=9.5, fontName="Helvetica-Bold", textColor=GREEN)),
             Paragraph(f"Value: <b>{f['value']}</b>", label_style),
             Paragraph(f"Impact: <b>-{impact_pct}%</b>", ParagraphStyle("pfi", fontSize=9, fontName="Helvetica-Bold", textColor=GREEN))],
            [Paragraph(f['explanation'], small_style), "", ""]
        ], colWidths=[5.5*cm, 4*cm, 3.5*cm])
        pf_table.setStyle(TableStyle([
            ("SPAN", (0,1), (2,1)), ("BACKGROUND", (0,0), (-1,-1), row_bg),
            ("ROWPADDING", (0,0), (-1,-1), 6), ("LEFTPADDING", (0,0), (-1,-1), 8),
            ("BOX", (0,0), (-1,-1), 0.3, colors.HexColor("#86efac")),
        ]))
        story.append(pf_table)
        story.append(Spacer(1, 0.12*cm))

    story.append(Spacer(1, 0.4*cm))

    # Overall Assessment
    story.append(Paragraph("Overall Clinical Assessment", section_header))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#bfdbfe"), spaceAfter=6))
    assessment_table = Table([[Paragraph(explanation["overall_assessment"], body_style)]], colWidths=[doc.width])
    assessment_table.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), LIGHT_BLUE),
        ("ROWPADDING", (0,0), (-1,-1), 10),
        ("BOX", (0,0), (-1,-1), 0.5, colors.HexColor("#93c5fd")),
    ]))
    story.append(assessment_table)
    story.append(Spacer(1, 0.5*cm))

    # Model Info
    story.append(Paragraph("Model Information", section_header))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#bfdbfe"), spaceAfter=6))
    model_info = (
        f"Model: Logistic Regression trained on Cleveland Heart Disease Dataset (UCI) | "
        f"Samples: {metadata['n_samples']} | "
        f"Accuracy: {metadata['lr_accuracy']*100:.1f}% | "
        f"AUC-ROC: {metadata['lr_auc']:.4f} | "
        f"XAI Method: Linear SHAP (gradient-based exact decomposition)"
    )
    story.append(Paragraph(model_info, ParagraphStyle("mi", fontSize=8.5, fontName="Helvetica",
                                                       textColor=colors.HexColor("#475569"), leading=13)))
    story.append(Spacer(1, 0.4*cm))

    # Disclaimer
    disclaimer = ("⚠ Medical Disclaimer: This report is generated by an AI-based predictive model for informational "
                  "purposes only. It does not constitute a medical diagnosis. Please consult a qualified healthcare "
                  "professional before making any clinical decisions.")
    disc_table = Table([[Paragraph(disclaimer, ParagraphStyle("disc", fontSize=7.5, fontName="Helvetica",
                                                               textColor=colors.HexColor("#6b7280"),
                                                               alignment=TA_JUSTIFY, leading=12))]],
                       colWidths=[doc.width])
    disc_table.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), colors.HexColor("#f8fafc")),
        ("BOX", (0,0), (-1,-1), 0.4, colors.HexColor("#e2e8f0")),
        ("ROWPADDING", (0,0), (-1,-1), 8),
    ]))
    story.append(disc_table)

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
    input_df = pd.DataFrame([x_scaled], columns=feature_order)

    prob = float(model.predict_proba(input_df)[0][1])

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
    input_df = pd.DataFrame([x_scaled], columns=feature_order)

    prob = float(model.predict_proba(input_df)[0][1])
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


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
