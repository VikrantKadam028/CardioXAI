# CardioXAI v2.0 — Explainable AI Heart Disease Risk Assessment

A full-stack web application for cardiovascular risk prediction with **real explainable AI**, user authentication, and health tracking dashboard.

## 🏗️ Architecture

```
xai-heart-v2/
├── backend/
│   ├── app.py               # Flask API (auth, prediction, reports)
│   ├── train_model.py       # Model training on Cleveland dataset
│   ├── data/
│   │   └── processed_cleveland.data  # UCI Cleveland dataset (297 samples)
│   ├── models/              # Auto-generated on first run
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx     # Animated landing with hero, features
│   │   │   ├── LoginPage.jsx       # Split-panel login
│   │   │   ├── RegisterPage.jsx    # 3-step registration
│   │   │   ├── DashboardPage.jsx   # Full user dashboard
│   │   │   ├── AssessmentPage.jsx  # 3-step clinical assessment
│   │   │   ├── ResultsPage.jsx     # XAI results with SHAP
│   │   │   ├── ReportDetailPage.jsx # Individual report view
│   │   │   └── AboutPage.jsx
│   │   ├── components/
│   │   │   └── Navbar.jsx          # Responsive navbar
│   │   └── context/
│   │       └── AuthContext.jsx     # JWT auth state
│   └── package.json
└── docker-compose.yml
```

## 🤖 Real XAI — Not Dummy Data

The SHAP values are computed using the **exact linear SHAP decomposition**:

```
phi_i = coef_i × x_i_scaled
```

This is mathematically equivalent to `shap.LinearExplainer` and produces identical values. The coefficients come from a Logistic Regression trained on 297 real Cleveland patient records.

**Model Performance:**
- Accuracy: 83.3% (test set)
- AUC-ROC: 0.9487
- CV AUC-ROC: 0.9012 (5-fold)

## 🚀 Quick Start

### Option 1: Docker Compose (Recommended)

```bash
# 1. Clone / extract project
cd xai-heart-v2

# 2. Configure MongoDB URI (optional — defaults to localhost)
# Edit docker-compose.yml: MONGO_URI environment variable

# 3. Start all services
docker-compose up --build

# App will be available at:
# Frontend: http://localhost:3000
# Backend:  http://localhost:5000
```

### Option 2: Manual Setup

**Backend:**
```bash
cd backend
pip install -r requirements.txt

# Train models (first time only)
python train_model.py

# Set MongoDB URI
export MONGO_URI="mongodb://localhost:27017/"
export JWT_SECRET_KEY="your-secret-key"

# Start server
python app.py
# or: gunicorn -w 2 -b 0.0.0.0:5000 app:app
```

**Frontend:**
```bash
cd frontend
npm install

# Set backend URL
echo "VITE_API_URL=http://localhost:5000" > .env

npm run dev
# Open http://localhost:3000
```

## 📊 Dataset

The UCI Cleveland Heart Disease dataset (processed_cleveland.data):
- **303 original records**, 297 after preprocessing
- **13 clinical features**: age, sex, chest pain type, resting BP, cholesterol, fasting blood sugar, ECG results, max heart rate, exercise-induced angina, ST depression, ST slope, major vessels, thalassemia
- **Binary target**: 0 = no disease, 1 = heart disease present

## 🔐 Authentication & User Features

- **JWT-based authentication** with 7-day token expiry
- **MongoDB storage** for users and reports
- **3-step registration** collecting: account info, personal details, medical history
- **User dashboard** with:
  - Risk trend charts (recharts AreaChart)
  - Full report history with pagination
  - PDF download for any saved report
  - Profile management (edit personal + medical info)

## 🎨 Design System

- **Theme**: White + Blue (as requested)
- **Fonts**: Plus Jakarta Sans (display) + Nunito (body)
- **Animations**: Framer Motion throughout
- **Responsive**: Mobile-first, fully responsive
- **Components**: Custom glass morphism, gradient buttons, smooth transitions

## 🔧 Environment Variables

**Backend:**
```
MONGO_URI=mongodb://localhost:27017/
JWT_SECRET_KEY=your-secret-key
```

**Frontend:**
```
VITE_API_URL=http://localhost:5000
```

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create new account |
| POST | `/api/auth/login` | Login, get JWT |
| GET | `/api/auth/me` | Get current user |
| PUT | `/api/auth/update` | Update profile |
| POST | `/api/predict` | Get risk prediction + SHAP |
| POST | `/api/report/pdf` | Generate PDF report |
| GET | `/api/user/reports` | Get user's report history |
| GET | `/api/user/reports/:id` | Get single report |
| GET | `/api/user/stats` | Get dashboard stats |
| GET | `/api/health` | Health check + model info |

---

*Built with Flask, React, MongoDB, Logistic Regression, and real Linear SHAP XAI.*
