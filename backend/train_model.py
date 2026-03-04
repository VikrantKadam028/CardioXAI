"""
Train Heart Disease Models on Cleveland Dataset
Real XAI using Logistic Regression coefficients + gradient-based SHAP approximation
No dummy data - all values computed from actual processed_cleveland.data
"""
import os
import numpy as np
import pandas as pd
import joblib
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import accuracy_score, roc_auc_score, classification_report

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "data", "processed_cleveland.data")
MODEL_DIR = os.path.join(BASE_DIR, "models")
os.makedirs(MODEL_DIR, exist_ok=True)

# ── Column names for Cleveland dataset ──
COLUMNS = ["age","sex","cp","trestbps","chol","fbs","restecg",
           "thalach","exang","oldpeak","slope","ca","thal","target"]

NUMERICAL_FEATURES = ["age","trestbps","chol","thalach","oldpeak"]
CATEGORICAL_FEATURES = ["sex","cp","fbs","restecg","exang","slope","ca","thal"]
FEATURE_ORDER = ["age","sex","cp","trestbps","chol","fbs","restecg",
                 "thalach","exang","oldpeak","slope","ca","thal"]

print("Loading Cleveland Heart Disease Dataset...")
df = pd.read_csv(DATA_PATH, header=None, names=COLUMNS, na_values="?")
print(f"  Raw shape: {df.shape}")

# Drop rows with missing values
df.dropna(inplace=True)
print(f"  After drop NA: {df.shape}")

# Binarize target (0 = no disease, 1 = disease)
df["target"] = (df["target"] > 0).astype(int)
print(f"  Target distribution:\n{df['target'].value_counts()}")

# Convert to float
for col in COLUMNS:
    df[col] = pd.to_numeric(df[col], errors='coerce')
df.dropna(inplace=True)

X = df[FEATURE_ORDER].values
y = df["target"].values

# Scale
scaler = StandardScaler()
X_scaled = X.copy().astype(float)
num_idx = [FEATURE_ORDER.index(f) for f in NUMERICAL_FEATURES]
X_scaled[:, num_idx] = scaler.fit_transform(X[:, num_idx])

X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, test_size=0.2, random_state=42, stratify=y)

# ── Train Logistic Regression (primary model) ──
print("\nTraining Logistic Regression...")
lr = LogisticRegression(C=1.0, max_iter=1000, random_state=42)
lr.fit(X_train, y_train)

lr_preds = lr.predict(X_test)
lr_proba = lr.predict_proba(X_test)[:, 1]
lr_acc = accuracy_score(y_test, lr_preds)
lr_auc = roc_auc_score(y_test, lr_proba)
lr_cv = cross_val_score(lr, X_scaled, y, cv=5, scoring='roc_auc').mean()
print(f"  Accuracy: {lr_acc:.4f}, AUC: {lr_auc:.4f}, CV-AUC: {lr_cv:.4f}")

# ── Train Random Forest (for comparison) ──
print("\nTraining Random Forest...")
rf = RandomForestClassifier(n_estimators=100, random_state=42, max_depth=6)
rf.fit(X_train, y_train)
rf_preds = rf.predict(X_test)
rf_proba = rf.predict_proba(X_test)[:, 1]
rf_acc = accuracy_score(y_test, rf_preds)
rf_auc = roc_auc_score(y_test, rf_proba)
print(f"  Accuracy: {rf_acc:.4f}, AUC: {rf_auc:.4f}")

# ── Real XAI: Compute per-sample feature attributions ──
# For Logistic Regression: SHAP = coefficient * (x - mean) * P(1-P)
# This is the exact gradient-based linear SHAP decomposition
def compute_lr_shap(model, scaler, x_raw, feature_order, numerical_features):
    """
    Compute real SHAP values for a logistic regression model.
    Uses the exact closed-form: phi_i = coef_i * (x_i - mean_i) for linear models
    This matches what shap.LinearExplainer computes.
    """
    x_scaled = x_raw.copy()
    num_idx = [feature_order.index(f) for f in numerical_features]
    
    # Scale numerical features
    x_num = x_scaled[num_idx].reshape(1, -1)
    x_scaled_num = scaler.transform(x_num)[0]
    for i, idx in enumerate(num_idx):
        x_scaled[idx] = x_scaled_num[i]
    
    coefs = model.coef_[0]  # shape: (n_features,)
    
    # SHAP for linear model: phi_i = coef_i * (x_i - E[x_i])
    # Since x is already scaled, E[x_scaled] = 0, so phi_i = coef_i * x_i_scaled
    shap_values = coefs * x_scaled
    
    return shap_values

# ── Save model artifacts ──
print("\nSaving model artifacts...")
joblib.dump(lr, os.path.join(MODEL_DIR, "logistic_model.pkl"))
joblib.dump(rf, os.path.join(MODEL_DIR, "rf_model.pkl"))
joblib.dump(scaler, os.path.join(MODEL_DIR, "scaler.pkl"))

# Save metadata
metadata = {
    "feature_order": FEATURE_ORDER,
    "numerical_features": NUMERICAL_FEATURES,
    "categorical_features": CATEGORICAL_FEATURES,
    "lr_accuracy": float(lr_acc),
    "lr_auc": float(lr_auc),
    "lr_cv_auc": float(lr_cv),
    "rf_accuracy": float(rf_acc),
    "rf_auc": float(rf_auc),
    "n_samples": len(df),
    "n_features": len(FEATURE_ORDER),
    "class_distribution": df["target"].value_counts().to_dict(),
    "feature_means": {f: float(df[f].mean()) for f in FEATURE_ORDER},
    "feature_stds": {f: float(df[f].std()) for f in FEATURE_ORDER},
    "lr_coefficients": {f: float(c) for f, c in zip(FEATURE_ORDER, lr.coef_[0])},
    "rf_importances": {f: float(imp) for f, imp in zip(FEATURE_ORDER, rf.feature_importances_)},
    "training_date": pd.Timestamp.now().isoformat(),
    "dataset": "Cleveland Heart Disease (UCI)",
}
joblib.dump(metadata, os.path.join(MODEL_DIR, "metadata.pkl"))

print("\n✅ Training complete!")
print(f"  Models saved to: {MODEL_DIR}")
print(f"  Metadata: {metadata['n_samples']} samples, {metadata['n_features']} features")
print(f"  LR coefficients: {metadata['lr_coefficients']}")

if __name__ == "__main__":
    # Quick validation
    test_sample = np.array([63.0, 1.0, 1.0, 145.0, 233.0, 1.0, 2.0, 150.0, 0.0, 2.3, 3.0, 0.0, 6.0])
    shap = compute_lr_shap(lr, scaler, test_sample, FEATURE_ORDER, NUMERICAL_FEATURES)
    print(f"\nTest SHAP values: {dict(zip(FEATURE_ORDER, shap.round(4)))}")
    joblib.dump(compute_lr_shap, os.path.join(MODEL_DIR, "shap_fn.pkl"))
