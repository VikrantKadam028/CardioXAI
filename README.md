<div align="center">

<h1>CardioXAI — Explainable AI Heart Disease Prediction</h1>
<h3>Clinical Decision Support with Transparent Machine Learning</h3>

<p>
  <img src="https://img.shields.io/github/stars/VikrantKadam028/CardioXAI?style=social" />
  <img src="https://img.shields.io/github/forks/VikrantKadam028/CardioXAI?style=social" />
</p>

<p>
  <img src="https://img.shields.io/badge/Python-3.9+-blue.svg" />
  <img src="https://img.shields.io/badge/Backend-Flask-red.svg" />
  <img src="https://img.shields.io/badge/Frontend-React-blue.svg" />
  <img src="https://img.shields.io/badge/Database-MongoDB-green.svg" />
  <img src="https://img.shields.io/badge/Model-Logistic%20Regression-orange.svg" />
  <img src="https://img.shields.io/badge/Explainability-SHAP-critical.svg" />
  <img src="https://img.shields.io/badge/DevOps-Docker-blue.svg" />
  <img src="https://img.shields.io/badge/License-MIT-green.svg" />
</p>

<p>
  <img src="https://img.shields.io/github/last-commit/VikrantKadam028/CardioXAI" />
  <img src="https://img.shields.io/github/issues/VikrantKadam028/CardioXAI" />
  <img src="https://img.shields.io/github/languages/top/VikrantKadam028/CardioXAI" />
</p>

<p>
A full-stack web application for cardiovascular risk prediction with <b>real explainable AI</b>, 
user authentication, and health tracking dashboard.
</p>

<p>
<a href="https://cardioxai-frontend.onrender.com">
  <img src="https://img.shields.io/badge/🚀_Live_Demo-Visit_Now-brightgreen?style=for-the-badge" alt="Live Demo" />
</a>
</p>

</div>

<hr/>

## 📋 Table of Contents

- [Project Overview](#-project-overview)
- [Core Objectives](#-core-objectives)
- [Key Features](#-key-features)
- [Technology Stack](#-technology-stack)
- [Installation](#-installation)
- [Real XAI Implementation](#-real-xai-implementation)
- [Dataset](#-dataset)
- [Model Performance](#-model-performance)
- [Authentication & User Features](#-authentication--user-features)
- [API Endpoints](#-api-endpoints)
- [Explainable AI Validation](#-explainable-ai-validation)
- [Team & Contributors](#-team--contributors)
- [Future Scope](#-future-scope)

<hr/>

## 🌟 Project Overview

CardioXAI v2.0 is a **clinically interpretable machine learning system** for heart disease prediction designed for clinical decision support. The system uses **Logistic Regression** for prediction and **SHAP (SHapley Additive exPlanations)** to generate interpretable explanations for each case.

The primary objective is to balance predictive performance with explanation stability and clinical interpretability, providing healthcare professionals with transparent AI assistance they can trust.

<hr/>

## 🎯 Core Objectives

1. **Develop** a reliable cardiovascular risk prediction model
2. **Provide** transparent and faithful AI explanations using SHAP
3. **Validate** explanation stability across similar cases
4. **Deliver** a professional full-stack web interface for clinicians
5. **Ensure** secure user authentication and health data tracking
6. **Implement** structured version control and Docker deployment

<hr/>

## ✨ Key Features

### Core Functionality
- ✅ **Binary heart disease prediction** (Low/Moderate/High Risk)
- ✅ **Probability-based risk scoring** (0-100%)
- ✅ **SHAP waterfall visualizations** for each prediction
- ✅ **Personalized clinical explanations** with feature attribution
- ✅ **Professional PDF report generation**

### User Management
- 🔐 **JWT-based authentication** with 7-day token expiry
- 💾 **MongoDB storage** for users and health records
- 📝 **3-step registration** (account, personal details, medical history)
- 📊 **Interactive dashboard** with risk trend charts
- 📄 **Report history** with pagination and PDF download
- 👤 **Profile management** (edit personal + medical info)

### Design & UX
- 🎨 **White + Blue theme** (medical professional aesthetic)
- 🖼️ **Framer Motion animations** throughout
- 📱 **Mobile-first responsive design**
- 🌊 **Glass morphism effects** and gradient buttons
- ⚡ **Smooth transitions** and loading states

<hr/>

## 🛠️ Technology Stack

<table>
<tr>
<th>Layer</th>
<th>Technology</th>
<th>Purpose</th>
</tr>
<tr>
<td><b>Backend</b></td>
<td>Python, Flask, Scikit-learn, SHAP, Pandas, NumPy</td>
<td>API, ML model, explanations</td>
</tr>
<tr>
<td><b>Frontend</b></td>
<td>React, Vite, Tailwind CSS, Framer Motion, Recharts</td>
<td>UI, visualizations, animations</td>
</tr>
<tr>
<td><b>Database</b></td>
<td>MongoDB with PyMongo</td>
<td>User data, reports, authentication</td>
</tr>
<tr>
<td><b>DevOps</b></td>
<td>Docker, Docker Compose</td>
<td>Containerization, deployment</td>
</tr>
<tr>
<td><b>Authentication</b></td>
<td>JWT, bcrypt</td>
<td>Secure user sessions</td>
</tr>
</table>

<hr/>

## 🚀 Installation

### Option 1: Docker Compose (Recommended) ⭐

```
# 1. Clone the repository
git clone https://github.com/VikrantKadam028/CardioXAI.git
cd CardioXAI

# 2. Configure MongoDB URI (optional — defaults to localhost)
# Edit docker-compose.yml: MONGO_URI environment variable

# 3. Start all services
docker-compose up --build

# Application will be available at:
# Frontend: http://localhost:3000
# Backend:  http://localhost:5000

```

### Option 2: Manual Setup

#### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Create virtual environment:
```bash
python -m venv venv
```

3. Activate virtual environment:
```bash
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate
```

4. Install dependencies:
```bash
pip install -r requirements.txt
```

5. Train models (first time only):
```bash
python train_model.py
```

6. Set environment variables:
```bash
# Windows (PowerShell):
$env:MONGO_URI="mongodb://localhost:27017/"
$env:JWT_SECRET_KEY="your-secret-key"

# Linux/Mac:
export MONGO_URI="mongodb://localhost:27017/"
export JWT_SECRET_KEY="your-secret-key"
```

7. Start Flask server:
```bash
python app.py

# Or with Gunicorn (production):
# gunicorn -w 2 -b 0.0.0.0:5000 app:app
```
*Backend runs at: http://localhost:5000*

#### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Set backend API URL:
```bash
# Windows (PowerShell):
echo "VITE_API_URL=http://localhost:5000" > .env

# Linux/Mac:
echo "VITE_API_URL=http://localhost:5000" > .env
```

4. Start development server:
```bash
npm run dev
```
*Frontend runs at: http://localhost:5173*

<hr/>

## 🧠 Real XAI Implementation

The SHAP values are computed using the exact linear SHAP decomposition. This is mathematically equivalent to `shap.LinearExplainer` and produces identical values. The coefficients come from a Logistic Regression trained on 297 real Cleveland patient records.

### Why Real XAI Matters:

- ✅ Not dummy data — explanations are computed from your actual inputs
- ✅ Per-patient attribution — not averaged feature importance
- ✅ Mathematically exact — LinearExplainer for faithful explanations
- ✅ Clinically aligned — SHAP values match known medical risk factors

<hr/>

## 📊 Dataset

- **Source:** UCI Cleveland Heart Disease Dataset
- **Samples:** 297 preprocessed patient records
- **Features:** 13 clinical attributes
  - age, sex, chest pain type (cp)
  - resting blood pressure (trestbps)
  - serum cholesterol (chol)
  - fasting blood sugar (fbs)
  - resting ECG (restecg)
  - maximum heart rate (thalach)
  - exercise-induced angina (exang)
  - ST depression (oldpeak)
  - ST slope (slope)
  - major vessels (ca)
  - thalassemia (thal)
- **Target:** Binary diagnosis (0 = no disease, 1 = presence)

<hr/>

## 📈 Model Performance

| Metric | Score |
|--------|-------|
| Accuracy | 83.3% (test set) |
| AUC-ROC | 0.9487 |
| Cross-Validated AUC-ROC | 0.9012 (5-fold) |
| Explanation Stability | ~0.71 cosine similarity |
| Overfitting | Low (intrinsic to Logistic Regression) |

<hr/>

## 🔐 Authentication & User Features

### Security Features
- 🔒 JWT tokens with 7-day expiration
- 🔐 bcrypt password hashing
- 🛡️ Protected API routes
- 💾 Encrypted session storage

### User Dashboard
- 📊 Risk trend visualization (AreaChart from Recharts)
- 📋 Full report history with search and pagination
- 📥 PDF download for any saved report
- ✏️ Profile editing (personal + medical information)
- 📱 Responsive design across all devices

### Registration Flow
1. Account Setup — Email, password, username
2. Personal Details — Age, gender, contact info
3. Medical History — Baseline health metrics

<hr/>

## 📡 API Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | /api/auth/register | Create new account | No |
| POST | /api/auth/login | Login, receive JWT token | No |
| GET | /api/auth/me | Get current user profile | Yes |
| PUT | /api/auth/update | Update user profile | Yes |
| POST | /api/predict | Get risk prediction + SHAP | Yes |
| POST | /api/report/pdf | Generate PDF report | Yes |
| GET | /api/user/reports | Get user's report history | Yes |
| GET | /api/user/reports/:id | Get single report details | Yes |
| GET | /api/user/stats | Get dashboard statistics | Yes |
| GET | /api/health | Health check + model info | No |

<hr/>

## 🔬 Explainable AI Validation

### Faithfulness
Removing top SHAP features caused ~0.07 ROC-AUC drop. Confirms explanations reflect actual model behavior.

### Stability
Logistic Regression achieved ~0.71 cosine similarity across similar cases. Significantly more stable than Random Forest (~0.20).

### Clinical Alignment
SHAP explanations align with known medical risk factors:
- Age, Cholesterol, Blood Pressure → Positive contribution
- HDL Cholesterol → Negative (protective) contribution
- Exercise-induced angina → Strong positive indicator

<hr/>

## 👥 Team & Contributors

<table>
<tr>
<th>Member</th>
<th>Role</th>
<th>GitHub Profile</th>
<th>LinkedIn</th>
</tr>

<tr>
<td><b>Vikrant Kadam</b></td>
<td>Lead Developer<br/>Lead DevOps<br/>Lead Full Stack</td>
<td>
<a href="https://github.com/VikrantKadam028">
<img src="https://img.shields.io/badge/GitHub-VikrantKadam028-black?logo=github" />
</a>
</td>
<td>
<a href="https://www.linkedin.com/in/vikrantkadam028">
<img src="https://img.shields.io/badge/LinkedIn-vikrantkadam028-blue?logo=linkedin" />
</a>
</td>
</tr>

<tr>
<td><b>Kartik Pagariya</b></td>
<td>Lead Developer<br/>AI/ML Engineer</td>
<td>
<a href="https://github.com/kartikpagariya25">
<img src="https://img.shields.io/badge/GitHub-kartikpagariya25-black?logo=github" />
</a>
</td>
<td>
<a href="https://www.linkedin.com/in/kartikpagariya1911">
<img src="https://img.shields.io/badge/LinkedIn-kartikpagariya1911-blue?logo=linkedin" />
</a>
</td>
</tr>

<tr>
<td><b>Aditya Dengale</b></td>
<td>Lead Backend Engineer<br/>DevOps Engineer</td>
<td>
<a href="https://github.com/DevXDividends">
<img src="https://img.shields.io/badge/GitHub-DevXDividends-black?logo=github" />
</a>
</td>
<td>
<a href="https://www.linkedin.com/in/adityadengale">
<img src="https://img.shields.io/badge/LinkedIn-adityadengale-blue?logo=linkedin" />
</a>
</td>
</tr>

<tr>
<td><b>Janhavi Pagare</b></td>
<td>Frontend Developer<br/>UX Designer</td>
<td>
<a href="https://github.com/janhvi-2403">
<img src="https://img.shields.io/badge/GitHub-janhvi--2403-black?logo=github" />
</a>
</td>
<td>
<a href="https://www.linkedin.com/in/janhvi-pagare-1196b62b8">
<img src="https://img.shields.io/badge/LinkedIn-janhvi--pagare-blue?logo=linkedin" />
</a>
</td>
</tr>

<tr>
<td><b>Pranali Yelavikar</b></td>
<td>Data Analyst<br/>Researcher</td>
<td>
<a href="https://github.com/pranaliyelavikar14">
<img src="https://img.shields.io/badge/GitHub-pranaliyelavikar14-black?logo=github" />
</a>
</td>
<td>
<a href="https://www.linkedin.com/in/pranali-yelavikar-2b3178383/">
<img src="https://img.shields.io/badge/LinkedIn-pranaliyelavikar2b3178383-blue?logo=linkedin" />
</a>
</td>
</tr>

</table>

## 🔮 Future Scope

### Short-term
- Add input validation and sanitization
- Implement unit tests for backend utilities
- Expand dataset support to Framingham Heart Study
- Enhance documentation with CONTRIBUTING.md

### Long-term
- Integration of additional XAI methods (LIME, Integrated Gradients)
- Neural network-based comparative analysis
- Downloadable comprehensive PDF clinical reports
- EHR (Electronic Health Record) system integration
- Production monitoring and analytics dashboard
- Multi-language support for global accessibility
- Mobile app version (React Native)

<hr/>

## 📄 License

This project is licensed under the MIT License — see the LICENSE file for details.

<hr/>

<div align="center">

## 🏥 Medical Disclaimer

CardioXAI is an educational and informational tool only.
It is not a substitute for professional medical advice, diagnosis, or treatment.
Always consult a qualified healthcare provider about any medical conditions or health concerns.

**Built with ❤️ for Explainable AI in Healthcare**

<p>
<a href="https://cardioxai-frontend.onrender.com">
<img src="https://img.shields.io/badge/🚀_Launch_App-Click_Here-brightgreen?style=for-the-badge&logo=rocket" alt="Launch App" />
</a>
</p>

Vishwakarma Institute of Technology, Pune • SY-AIDS • 2025-2026
</div>
```
