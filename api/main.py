"""
Diabetes Risk Prediction — FastAPI Backend v3.0
Endpoints: /health  /model-info  /model-metrics  /predict  /log-input  /user-history
New in v3: SHAP explainability · SQLite history · data-drift detection · rule-based recommendations
"""
from __future__ import annotations

import json
import logging
import os
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import httpx
from passlib.context import CryptContext

load_dotenv()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# ── Paths ──────────────────────────────────────────────────────────────────────
MODEL_DIR = Path(os.environ.get("MODEL_DIR", "models"))
DB_PATH   = Path(os.environ.get("DB_PATH", "database/predictions.db"))
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.1")
OLLAMA_ENABLE = os.environ.get("OLLAMA_ENABLE", "1")
OLLAMA_TIMEOUT = float(os.environ.get("OLLAMA_TIMEOUT", "6"))
OPENROUTER_URL = os.environ.get("OPENROUTER_URL", "https://openrouter.ai/api/v1")
OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "openai/gpt-4o-mini")
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_APP_NAME = os.environ.get("OPENROUTER_APP_NAME", "VitalAI")
OPENROUTER_TIMEOUT = float(os.environ.get("OPENROUTER_TIMEOUT", "12"))
HEART_MODEL_NAME = os.environ.get("HEART_MODEL_NAME", "heart_model.pkl")
HEART_FEATURES_NAME = os.environ.get("HEART_FEATURES_NAME", "heart_feature_names.json")
HEART_SUMMARY_NAME = os.environ.get("HEART_SUMMARY_NAME", "heart_model_summary.json")
HEART_STATS_NAME = os.environ.get("HEART_STATS_NAME", "heart_training_stats.json")

# ── FastAPI ────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Diabetes Risk Prediction API",
    description="ML-powered diabetes risk assessment with SHAP explainability and history tracking",
    version="3.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/assets", StaticFiles(directory=str(MODEL_DIR), check_dir=False), name="assets")

# ── Database ───────────────────────────────────────────────────────────────────

def _db() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def _init_db() -> None:
    conn = _db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            email TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS predictions (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id         TEXT    NOT NULL,
            input_data      TEXT    NOT NULL,
            prediction      INTEGER NOT NULL,
            probability     REAL    NOT NULL,
            risk_level      TEXT    NOT NULL,
            shap_top        TEXT,
            shap_summary    TEXT,
            recommendations TEXT,
            drift_detected  INTEGER DEFAULT 0,
            timestamp       TEXT    NOT NULL
        )
    """)
    _ensure_predictions_columns(conn)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS alert_settings (
            user_id     TEXT PRIMARY KEY,
            threshold   REAL NOT NULL,
            channel     TEXT NOT NULL,
            created_at  TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS alerts (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id      TEXT NOT NULL,
            message      TEXT NOT NULL,
            risk_level   TEXT NOT NULL,
            probability  REAL NOT NULL,
            created_at   TEXT NOT NULL,
            read_flag    INTEGER DEFAULT 0
        )
    """)
    conn.commit()
    conn.close()


def _ensure_predictions_columns(conn: sqlite3.Connection) -> None:
    existing = {row["name"] for row in conn.execute("PRAGMA table_info(predictions)")}
    columns = {
        "input_data": "TEXT NOT NULL DEFAULT '{}'",
        "shap_top": "TEXT",
        "shap_summary": "TEXT",
        "recommendations": "TEXT",
        "drift_detected": "INTEGER DEFAULT 0",
    }
    for name, ddl in columns.items():
        if name not in existing:
            conn.execute(f"ALTER TABLE predictions ADD COLUMN {name} {ddl}")


# ── Global artifacts ───────────────────────────────────────────────────────────

_model           = None
_feature_names:  list[str] = []
_model_summary:  dict      = {}
_training_stats: dict      = {}
_shap_explainer  = None
_scaler          = None
_clf             = None
_heart_model           = None
_heart_feature_names:  list[str] = []
_heart_model_summary:  dict      = {}
_heart_training_stats: dict      = {}
_heart_shap_explainer  = None
_heart_scaler          = None
_heart_clf             = None

# All features the API accepts from the user (superset)
# The actual features fed to the model are determined at runtime from feature_names.json
ALL_INPUT_FEATURES = [
    "HighBP", "HighChol", "BMI", "Stroke",
    "HeartDiseaseorAttack", "PhysActivity", "HvyAlcoholConsump",
    "GenHlth", "MentHlth", "PhysHlth", "DiffWalk",
    "Age", "Income",
]

HEART_FEATURE_ORDER = [
    "gender", "age_years", "bmi",
    "ap_hi", "ap_lo",
    "cholesterol", "gluc",
    "smoke", "alco", "active",
]

# Kept for backwards-compat; overridden at startup once feature_names.json loads
FEATURE_ORDER = ALL_INPUT_FEATURES


def _patch_legacy(m) -> None:
    if hasattr(m, "steps"):
        for _, s in m.steps:
            _patch_legacy(s)
        return
    if m.__class__.__name__ == "LogisticRegression" and not hasattr(m, "multi_class"):
        m.multi_class = "auto"


def _load_artifacts() -> None:
    global _model, _feature_names, _model_summary, _training_stats
    global _shap_explainer, _scaler, _clf

    # Model
    mp = MODEL_DIR / "best_model_v2.pkl"
    if not mp.exists():
        mp = MODEL_DIR / "best_model.joblib"
    if mp.exists():
        _model = joblib.load(mp)
        _patch_legacy(_model)
        logger.info("Model loaded from %s", mp)

    # Feature names
    fn = MODEL_DIR / "feature_names.json"
    if fn.exists():
        with open(fn) as f:
            data = json.load(f)
            _feature_names = data.get("feature_names", data) if isinstance(data, dict) else data

    # Model summary
    ms = MODEL_DIR / "model_summary.json"
    if ms.exists():
        with open(ms) as f:
            _model_summary = json.load(f)

    # Training stats for drift detection
    ts = MODEL_DIR / "training_stats.json"
    if ts.exists():
        with open(ts) as f:
            _training_stats = json.load(f)

    # Extract scaler + clf from pipeline, initialise SHAP
    if _model is not None and hasattr(_model, "named_steps"):
        steps = list(_model.named_steps.values())
        _scaler = steps[0] if len(steps) > 1 else None
        _clf    = steps[-1]
        _init_shap()


def _load_heart_artifacts() -> None:
    global _heart_model, _heart_feature_names, _heart_model_summary, _heart_training_stats
    global _heart_shap_explainer, _heart_scaler, _heart_clf

    mp = MODEL_DIR / HEART_MODEL_NAME
    if not mp.exists():
        mp = MODEL_DIR / "heart_model.joblib"
    if mp.exists():
        _heart_model = joblib.load(mp)
        _patch_legacy(_heart_model)
        logger.info("Heart model loaded from %s", mp)

    fn = MODEL_DIR / HEART_FEATURES_NAME
    if fn.exists():
        with open(fn) as f:
            data = json.load(f)
            _heart_feature_names = data.get("feature_names", data) if isinstance(data, dict) else data

    ms = MODEL_DIR / HEART_SUMMARY_NAME
    if ms.exists():
        with open(ms) as f:
            _heart_model_summary = json.load(f)

    ts = MODEL_DIR / HEART_STATS_NAME
    if ts.exists():
        with open(ts) as f:
            _heart_training_stats = json.load(f)

    if _heart_model is not None and hasattr(_heart_model, "named_steps"):
        steps = list(_heart_model.named_steps.values())
        _heart_scaler = steps[0] if len(steps) > 1 else None
        _heart_clf    = steps[-1]
        _heart_shap_explainer = _init_shap_for_model(_heart_clf, _heart_scaler, _heart_feature_names)


def _init_shap_for_model(clf, scaler, feature_names: list[str]):
    try:
        import shap  # noqa: F401
        if clf is None:
            return None
        if hasattr(clf, "feature_importances_"):
            import shap as _shap
            logger.info("SHAP TreeExplainer ready")
            return _shap.TreeExplainer(clf)
        if hasattr(clf, "coef_"):
            import shap as _shap
            feats = len(feature_names) if feature_names else len(FEATURE_ORDER)
            bg = np.zeros((1, feats))
            if scaler is not None:
                bg = scaler.transform(bg)
            logger.info("SHAP LinearExplainer ready")
            return _shap.LinearExplainer(clf, bg)
    except Exception as e:
        logger.warning("SHAP init failed: %s", e)
    return None


def _init_shap() -> None:
    global _shap_explainer
    _shap_explainer = _init_shap_for_model(_clf, _scaler, _feature_names)


@app.on_event("startup")
def _startup() -> None:
    _init_db()
    try:
        _load_artifacts()
        _load_heart_artifacts()
    except Exception as e:
        logger.warning("Artifact load failed: %s", e)


# ── Schemas ────────────────────────────────────────────────────────────────────

class PredictRequest(BaseModel):
    user_id:              str   = Field("anonymous", description="Session / user identifier")
    HighBP:               float = Field(0.0, ge=0, le=1,   description="High blood pressure (0/1)")
    HighChol:             float = Field(0.0, ge=0, le=1,   description="High cholesterol (0/1)")
    BMI:                  float = Field(25.0, ge=10, le=70, description="Body Mass Index")
    Stroke:               float = Field(0.0, ge=0, le=1,   description="Stroke history (0/1)")
    HeartDiseaseorAttack: float = Field(0.0, ge=0, le=1,   description="Heart disease or MI (0/1)")
    PhysActivity:         float = Field(1.0, ge=0, le=1,   description="Physical activity in past 30 days (0/1)")
    HvyAlcoholConsump:    float = Field(0.0, ge=0, le=1,   description="Heavy alcohol use (0/1)")
    GenHlth:              float = Field(3.0, ge=1, le=5,   description="General health 1–5")
    MentHlth:             float = Field(0.0, ge=0, le=30,  description="Mental health bad days")
    PhysHlth:             float = Field(0.0, ge=0, le=30,  description="Physical health bad days")
    DiffWalk:             float = Field(0.0, ge=0, le=1,   description="Difficulty walking (0/1)")
    Age:                  float = Field(7.0, ge=1, le=13,  description="Age category 1–13")
    Income:               float = Field(6.0, ge=1, le=8,   description="Income level 1–8")

    model_config = {
        "json_schema_extra": {
            "example": {
                "user_id": "demo", "BMI": 28.5, "Age": 9, "HighBP": 1,
                "HighChol": 1, "GenHlth": 3, "Stroke": 0,
                "HeartDiseaseorAttack": 0, "PhysActivity": 1, "HvyAlcoholConsump": 0,
                "MentHlth": 2, "PhysHlth": 2, "DiffWalk": 0, "Income": 5,
            }
        }
    }


class SHAPFeature(BaseModel):
    feature:   str
    impact:    float
    direction: str   # "increases" | "decreases"


class PredictResponse(BaseModel):
    prediction:          int
    label:               str
    probability_no:      float
    probability_yes:     float
    confidence:          float
    risk_level:          str
    model_used:          str
    shap_explanation:    list[SHAPFeature]
    shap_summary:        str
    recommendations:     list[str]
    feature_importances: dict[str, float]
    drift_detected:      bool
    alerts:              list[str] | None = None
    timestamp:           str


class FeatureImportanceItem(BaseModel):
    feature: str
    importance: float


class FeatureImportanceResponse(BaseModel):
    plot_path: str | None
    feature_importances: list[FeatureImportanceItem]


class HeartPredictRequest(BaseModel):
    user_id: str = Field("anonymous", description="Session / user identifier")
    gender: int = Field(0, ge=0, le=1, description="0=female, 1=male")
    age_years: float = Field(53.0, ge=18, le=120, description="Age in years")
    bmi: float = Field(27.0, ge=10, le=70, description="Body Mass Index")
    ap_hi: int = Field(120, ge=50, le=300, description="Systolic BP")
    ap_lo: int = Field(80, ge=30, le=200, description="Diastolic BP")
    cholesterol: int = Field(1, ge=1, le=3, description="1=normal, 2=above normal, 3=well above")
    gluc: int = Field(1, ge=1, le=3, description="1=normal, 2=above normal, 3=well above")
    smoke: int = Field(0, ge=0, le=1, description="Smoking status")
    alco: int = Field(0, ge=0, le=1, description="Alcohol intake")
    active: int = Field(1, ge=0, le=1, description="Physically active")

class UserRegistration(BaseModel):
    name: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class GoogleLoginRequest(BaseModel):
    name: str
    email: str

class UserResponse(BaseModel):
    name: str
    email: str

class SymptomPredictRequest(BaseModel):
    user_id: str = Field("anonymous", description="Session / user identifier")
    age: int | None = Field(None, ge=1, le=13, description="Age category 1–13")
    bmi: float | None = Field(None, ge=10, le=70, description="Body Mass Index")
    symptoms: list[str] = Field(default_factory=list, description="List of symptom keys")
    severity: int = Field(2, ge=1, le=5, description="1=low, 5=severe")


class SymptomPredictResponse(BaseModel):
    prediction: int
    label: str
    probability_no: float
    probability_yes: float
    confidence: float
    risk_level: str
    model_used: str
    shap_explanation: list[SHAPFeature]
    shap_summary: str
    recommendations: list[str]
    drift_detected: bool
    derived_inputs: dict[str, float]
    symptoms_used: list[str]
    timestamp: str


class AlertConfig(BaseModel):
    user_id: str = Field("anonymous", description="User identifier")
    threshold: float = Field(0.7, ge=0.0, le=1.0)
    channel: str = Field("in_app", description="Delivery channel (in_app/email/sms)")


class AlertItem(BaseModel):
    id: int
    message: str
    risk_level: str
    probability: float
    created_at: str
    read: bool


class AlertsResponse(BaseModel):
    user_id: str
    alerts: list[AlertItem]


class ChatRequest(BaseModel):
    message: str
    context: dict | None = None


class ChatResponse(BaseModel):
    response: str
    model: str


# ── Helpers ────────────────────────────────────────────────────────────────────

def _active_features() -> list[str]:
    return _feature_names if _feature_names else FEATURE_ORDER


def _active_heart_features() -> list[str]:
    return _heart_feature_names if _heart_feature_names else HEART_FEATURE_ORDER


def _risk(p: float) -> str:
    if p < 0.25: return "Low"
    if p < 0.50: return "Moderate"
    if p < 0.75: return "High"
    return "Very High"


def _feat_importances() -> dict[str, float]:
    try:
        clf = _clf if _clf is not None else list(_model.named_steps.values())[-1]
        if hasattr(clf, "feature_importances_"):
            imps = clf.feature_importances_
        elif hasattr(clf, "coef_"):
            imps = np.abs(clf.coef_[0])
        else:
            return {}
        total = float(imps.sum()) or 1.0
        feats = _active_features()
        return {
            f: round(float(i) / total, 4)
            for f, i in sorted(zip(feats, imps), key=lambda x: x[1], reverse=True)
        }
    except Exception:
        return {}


def _feat_importances_heart() -> dict[str, float]:
    try:
        clf = _heart_clf if _heart_clf is not None else list(_heart_model.named_steps.values())[-1]
        if hasattr(clf, "feature_importances_"):
            imps = clf.feature_importances_
        elif hasattr(clf, "coef_"):
            imps = np.abs(clf.coef_[0])
        else:
            return {}
        total = float(imps.sum()) or 1.0
        feats = _active_heart_features()
        return {
            f: round(float(i) / total, 4)
            for f, i in sorted(zip(feats, imps), key=lambda x: x[1], reverse=True)
        }
    except Exception:
        return {}


def _heart_recommendations(inp: dict[str, float], prob_yes: float) -> list[str]:
    recs: list[str] = []
    if inp.get("ap_hi", 0) >= 140 or inp.get("ap_lo", 0) >= 90:
        recs.append("Blood pressure appears elevated; monitor regularly and consult a clinician.")
    if inp.get("cholesterol", 1) >= 2:
        recs.append("Cholesterol is above normal; consider dietary changes and medical guidance.")
    if inp.get("gluc", 1) >= 2:
        recs.append("Glucose is above normal; consider fasting glucose or HbA1c testing.")
    if inp.get("bmi", 0) >= 30:
        recs.append("BMI is in the obese range; gradual weight reduction can lower cardiovascular risk.")
    if inp.get("smoke", 0) == 1:
        recs.append("Smoking increases cardiovascular risk; quitting offers rapid benefits.")
    if inp.get("alco", 0) == 1:
        recs.append("Limit alcohol intake to recommended levels to reduce risk.")
    if inp.get("active", 1) == 0:
        recs.append("Increase physical activity toward 150 minutes per week if possible.")
    if prob_yes >= 0.75:
        recs.append("High risk detected; consider a professional evaluation soon.")
    return recs or ["Maintain healthy habits and monitor key indicators regularly."]


def _global_feature_importances() -> list[FeatureImportanceItem]:
    importances = _feat_importances()
    return [
        FeatureImportanceItem(feature=feature, importance=importance)
        for feature, importance in list(importances.items())[:10]
    ]


_FNAME_MAP = {
    "HeartDiseaseorAttack": "Heart Disease",
    "HvyAlcoholConsump":    "Heavy Alcohol",
    "HighBP":               "High BP",
    "HighChol":             "High Cholesterol",
    "GenHlth":              "General Health",
    "PhysHlth":             "Physical Health",
    "MentHlth":             "Mental Health",
    "DiffWalk":             "Difficulty Walking",
}


def _compute_shap_for(
    row: np.ndarray,
    feats: list[str],
    explainer,
    scaler,
    importances: dict[str, float],
) -> list[SHAPFeature]:
    """Compute per-person SHAP values for a specific model context."""
    out: list[SHAPFeature] = []

    if explainer is not None and scaler is not None:
        try:
            scaled = scaler.transform(row)  # (1, n_features)
            sv     = explainer.shap_values(scaled)
            vals: np.ndarray = sv[1][0] if isinstance(sv, list) else sv[0]
            for feat, impact in sorted(zip(feats, vals), key=lambda x: abs(x[1]), reverse=True)[:5]:
                out.append(SHAPFeature(
                    feature   = feat,
                    impact    = round(abs(float(impact)), 4),
                    direction = "increases" if float(impact) > 0 else "decreases",
                ))
            return out
        except Exception as e:
            logger.warning("SHAP computation failed: %s — falling back to scaled input heuristic", e)

    if importances and scaler is not None:
        try:
            scaled_vals = scaler.transform(row)[0]
            per_person_scores = {
                feat: abs(float(scaled_vals[i]) * importances.get(feat, 0.0))
                for i, feat in enumerate(feats)
            }
            for feat, score in sorted(per_person_scores.items(), key=lambda x: x[1], reverse=True)[:5]:
                direction = "increases" if float(scaled_vals[feats.index(feat)]) > 0 else "decreases"
                out.append(SHAPFeature(feature=feat, impact=round(score, 4), direction=direction))
            return out
        except Exception as e2:
            logger.warning("Per-person fallback also failed: %s", e2)

    for feat, imp in list(importances.items())[:5]:
        out.append(SHAPFeature(feature=feat, impact=float(imp), direction="increases"))
    return out


def _compute_shap(row: np.ndarray) -> list[SHAPFeature]:
    feats = _active_features()
    fi = _feat_importances()
    return _compute_shap_for(row, feats, _shap_explainer, _scaler, fi)


def _compute_shap_heart(row: np.ndarray) -> list[SHAPFeature]:
    feats = _active_heart_features()
    fi = _feat_importances_heart()
    return _compute_shap_for(row, feats, _heart_shap_explainer, _heart_scaler, fi)


def _shap_summary(features: list[SHAPFeature], risk: str) -> str:
    if not features:
        return f"{risk} diabetes risk based on your health indicators."
    names = [_FNAME_MAP.get(f.feature, f.feature) for f in features[:3]]
    return f"{risk} risk — primarily driven by: {', '.join(names)}."


def _recommendations(inp: dict, pred: int, prob: float) -> list[str]:
    ollama_recs = _ollama_recommendations(inp, pred, prob)
    if ollama_recs:
        return ollama_recs

    recs: list[str] = []
    if inp.get("BMI", 25) >= 30:
        recs.append("Reduce BMI: target below 25 through a calorie deficit and regular exercise.")
    if inp.get("HighBP"):
        recs.append("Monitor blood pressure daily; follow the DASH diet to lower sodium intake.")
    if inp.get("HighChol"):
        recs.append("Reduce dietary cholesterol and increase soluble fibre (oats, legumes, flaxseed).")
    if inp.get("HvyAlcoholConsump"):
        recs.append("Limit alcohol: max 2 standard drinks/day (men) or 1/day (women).")
    if inp.get("GenHlth", 3) >= 4:
        recs.append("Schedule a comprehensive health check-up with your physician.")
    if inp.get("PhysHlth", 0) > 14:
        recs.append("Engage in low-impact exercise (walking, swimming) on your better health days.")
    if inp.get("MentHlth", 0) > 10:
        recs.append("Seek mental health support — chronic stress significantly raises insulin resistance.")
    if inp.get("DiffWalk"):
        recs.append("Consider physiotherapy to improve mobility and reduce the risk of sedentary complications.")
    if inp.get("Stroke") or inp.get("HeartDiseaseorAttack"):
        recs.append("Work with a cardiologist to actively manage cardiovascular risk factors.")
    if pred == 1 or prob >= 0.5:
        recs += [
            "Schedule an HbA1c blood test with your doctor within the next 30 days.",
            "Follow a low-glycaemic diet — reduce refined carbohydrates and added sugars.",
            "Aim for 150 minutes/week of moderate aerobic activity (ADA guideline).",
        ]
    if not recs:
        recs = ["Maintain your healthy lifestyle and attend annual preventive health screenings."]
    return recs[:6]


def _ollama_recommendations(inp: dict, pred: int, prob: float) -> list[str] | None:
    if OLLAMA_ENABLE == "0":
        return None

    risk = _risk(prob)
    user_facts = {
        "BMI": inp.get("BMI"),
        "HighBP": inp.get("HighBP"),
        "HighChol": inp.get("HighChol"),
        "Stroke": inp.get("Stroke"),
        "HeartDiseaseorAttack": inp.get("HeartDiseaseorAttack"),
        "PhysActivity": inp.get("PhysActivity"),
        "HvyAlcoholConsump": inp.get("HvyAlcoholConsump"),
        "GenHlth": inp.get("GenHlth"),
        "MentHlth": inp.get("MentHlth"),
        "PhysHlth": inp.get("PhysHlth"),
        "DiffWalk": inp.get("DiffWalk"),
        "Age": inp.get("Age"),
        "Income": inp.get("Income"),
        "risk_level": risk,
        "prediction": "Diabetes" if pred == 1 else "No Diabetes",
        "probability_yes": round(prob, 4),
    }

    prompt = (
        "You are a health guidance assistant. "
        "Return a JSON array of 3 to 6 short, actionable recommendations tailored to the person. "
        "Do not include any markdown, headings, or extra text. "
        "Use concise sentences. Avoid diagnosing.\n\n"
        f"User data (JSON): {json.dumps(user_facts)}\n"
    )

    try:
        with httpx.Client(timeout=OLLAMA_TIMEOUT) as client:
            res = client.post(
                f"{OLLAMA_URL}/api/generate",
                json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False},
            )
        if not res.is_success:
            logger.warning("Ollama error: %s", res.text)
            return None

        data = res.json()
        text = (data.get("response") or "").strip()
        if not text:
            return None

        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            start = text.find("[")
            end = text.rfind("]")
            if start == -1 or end == -1 or end <= start:
                return None
            parsed = json.loads(text[start:end + 1])

        if isinstance(parsed, list) and all(isinstance(x, str) for x in parsed):
            return parsed[:6]
    except Exception as e:
        logger.warning("Ollama recommendations failed: %s", e)

    return None


def _detect_drift_for(row: np.ndarray, stats: dict, feats: list[str]) -> bool:
    if not stats:
        return False
    anomalies = 0
    for i, feat in enumerate(feats):
        stat = stats.get(feat)
        if stat:
            mu, sigma = stat["mean"], stat["std"]
            if sigma > 0 and abs(row[0][i] - mu) / sigma > 3.5:
                anomalies += 1
    return anomalies >= 2


def _detect_drift(row: np.ndarray) -> bool:
    return _detect_drift_for(row, _training_stats, _active_features())


def _detect_drift_heart(row: np.ndarray) -> bool:
    return _detect_drift_for(row, _heart_training_stats, _active_heart_features())


def _get_alert_threshold(user_id: str) -> float:
    try:
        conn = _db()
        row = conn.execute("SELECT threshold FROM alert_settings WHERE user_id = ?", (user_id,)).fetchone()
        conn.close()
        return float(row[0]) if row else 0.7
    except Exception:
        return 0.7


def _create_alert(user_id: str, risk: str, prob_yes: float) -> None:
    msg = f"Risk alert: {risk} ({round(prob_yes * 100, 1)}%)"
    try:
        conn = _db()
        conn.execute(
            "INSERT INTO alerts (user_id, message, risk_level, probability, created_at) VALUES (?,?,?,?,?)",
            (user_id, msg, risk, float(prob_yes), datetime.utcnow().isoformat()),
        )
        conn.commit()
        conn.close()
    except Exception as e:
        logger.warning("Alert insert failed: %s", e)


_SYMPTOM_MAP: dict[str, dict[str, float]] = {
    "frequent_urination": {"GenHlth": 1, "PhysHlth": 4},
    "excessive_thirst": {"GenHlth": 1, "PhysHlth": 3},
    "fatigue": {"PhysHlth": 5, "MentHlth": 3},
    "blurred_vision": {"GenHlth": 1, "PhysHlth": 2},
    "slow_healing": {"GenHlth": 1, "PhysHlth": 2},
    "numbness": {"PhysHlth": 2},
    "headaches": {"HighBP": 1, "MentHlth": 2},
    "low_activity": {"PhysActivity": 0, "BMI": 2},
    "chest_pain": {"HeartDiseaseorAttack": 1, "HighBP": 1, "GenHlth": 2},
    "shortness_of_breath": {"HeartDiseaseorAttack": 1, "GenHlth": 2},
    "swelling_legs": {"HeartDiseaseorAttack": 1, "HighBP": 1},
    "dizziness": {"GenHlth": 1},
}


def _clamp(val: float, min_v: float, max_v: float) -> float:
    return max(min_v, min(max_v, val))


def _derive_inputs_from_symptoms(req: SymptomPredictRequest) -> dict[str, float]:
    base = PredictRequest().model_dump()
    severity = max(1, min(5, req.severity))
    for sym in req.symptoms:
        adj = _SYMPTOM_MAP.get(sym, {})
        for key, delta in adj.items():
            if key in ("HighBP", "HighChol", "Stroke", "HeartDiseaseorAttack", "PhysActivity", "HvyAlcoholConsump", "DiffWalk"):
                base[key] = 1.0 if delta >= 1 else base[key]
            elif key in ("BMI",):
                base[key] = float(base[key]) + float(delta) * (severity / 3.0)
            else:
                base[key] = float(base[key]) + float(delta) * (severity / 2.0)

    if req.age is not None:
        base["Age"] = float(req.age)
    if req.bmi is not None:
        base["BMI"] = float(req.bmi)

    base["BMI"] = _clamp(float(base["BMI"]), 10, 70)
    base["GenHlth"] = _clamp(float(base["GenHlth"]), 1, 5)
    base["MentHlth"] = _clamp(float(base["MentHlth"]), 0, 30)
    base["PhysHlth"] = _clamp(float(base["PhysHlth"]), 0, 30)
    base["Age"] = _clamp(float(base["Age"]), 1, 13)
    base["Income"] = _clamp(float(base["Income"]), 1, 8)
    return {k: float(v) for k, v in base.items() if k in ALL_INPUT_FEATURES}


def _log_to_db(
    user_id: str, inp: dict, pred: int, prob: float, risk: str,
    shap_top: list[SHAPFeature], shap_sum: str,
    recs: list[str], drift: bool, ts: str,
) -> None:
    try:
        conn = _db()
        conn.execute("""
            INSERT INTO predictions
              (user_id, input_data, prediction, probability, risk_level,
               shap_top, shap_summary, recommendations, drift_detected, timestamp)
            VALUES (?,?,?,?,?,?,?,?,?,?)
        """, (
            user_id, json.dumps(inp), pred, prob, risk,
            json.dumps([s.model_dump() for s in shap_top]),
            shap_sum, json.dumps(recs), int(drift), ts,
        ))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error("DB log error: %s", e)


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["System"])
def health():
    return {
        "status":         "ok",
        "model_loaded":   _model is not None,
        "heart_model_loaded": _heart_model is not None,
        "features":       len(_active_features()),
        "shap_available": _shap_explainer is not None,
        "drift_stats":    len(_training_stats) > 0,
        "timestamp":      datetime.utcnow().isoformat(),
    }


@app.get("/model-info", tags=["System"])
def model_info():
    if not _model_summary:
        raise HTTPException(503, "Model summary not available. Run ml/train.py first.")
    return _model_summary


@app.get("/model-metrics", tags=["System"])
def model_metrics():
    if not _model_summary:
        raise HTTPException(404, "Metrics not found. Run training first.")
    return {
        "models":        {k: v for k, v in _model_summary.items() if k != "best_model"},
        "best_model":    _model_summary.get("best_model"),
        "feature_names": _active_features(),
    }


@app.get("/feature-importance", response_model=FeatureImportanceResponse, tags=["System"])
def feature_importance(target: str = Query("diabetes", description="diabetes | heart")):
    if target == "heart":
        plot_path = MODEL_DIR / "heart_shap_global.png"
        feats = _feat_importances_heart()
        items = [
            FeatureImportanceItem(feature=feature, importance=importance)
            for feature, importance in list(feats.items())[:10]
        ]
    else:
        plot_path = MODEL_DIR / "shap_global.png"
        items = _global_feature_importances()

    return {
        "plot_path": str(plot_path) if plot_path.exists() else None,
        "feature_importances": items,
    }

@app.post("/auth/register", response_model=UserResponse, tags=["Auth"])
def register_user(req: UserRegistration):
    conn = _db()
    existing = conn.execute("SELECT email FROM users WHERE email = ?", (req.email,)).fetchone()
    if existing:
        conn.close()
        raise HTTPException(400, "Email already registered")
    
    hashed = pwd_context.hash(req.password)
    try:
        conn.execute(
            "INSERT INTO users (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)",
            (req.email, req.name, hashed, datetime.utcnow().isoformat())
        )
        conn.commit()
    except Exception as e:
        conn.close()
        raise HTTPException(500, f"Database error: {e}")
    conn.close()
    return UserResponse(name=req.name, email=req.email)

@app.post("/auth/login", response_model=UserResponse, tags=["Auth"])
def login_user(req: UserLogin):
    conn = _db()
    user = conn.execute("SELECT email, name, password_hash FROM users WHERE email = ?", (req.email,)).fetchone()
    conn.close()
    if not user or not pwd_context.verify(req.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    
    return UserResponse(name=user["name"], email=user["email"])

@app.post("/auth/google", response_model=UserResponse, tags=["Auth"])
def login_google(req: GoogleLoginRequest):
    conn = _db()
    user = conn.execute("SELECT email, name FROM users WHERE email = ?", (req.email,)).fetchone()
    
    if not user:
        hashed = pwd_context.hash("GOOGLE_OAUTH_DUMMY_PASSWORD_" + req.email)
        try:
            conn.execute(
                "INSERT INTO users (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)",
                (req.email, req.name, hashed, datetime.utcnow().isoformat())
            )
            conn.commit()
            user_name = req.name
        except Exception as e:
            conn.close()
            raise HTTPException(500, f"Database error: {e}")
    else:
        user_name = user["name"]
        
    conn.close()
    return UserResponse(name=user_name, email=req.email)

@app.post("/predict", response_model=PredictResponse, tags=["Prediction"])
def predict(req: PredictRequest, bg: BackgroundTasks):
    if _model is None:
        raise HTTPException(503, "Model not loaded. Run ml/train.py first.")

    # Use the model's actual feature list (from feature_names.json), not the
    # hardcoded FEATURE_ORDER which may include features dropped during training (e.g. Income).
    active_feats = _active_features()
    inp = {f: getattr(req, f, 0.0) for f in ALL_INPUT_FEATURES}
    row = np.array([[inp[f] for f in active_feats]])

    proba      = _model.predict_proba(row)[0]
    prob_yes   = round(float(proba[1]), 4)
    prob_no    = round(float(proba[0]), 4)
    prediction = int(prob_yes >= 0.5)
    risk       = _risk(prob_yes)

    shap_top = _compute_shap(row)
    shap_sum = _shap_summary(shap_top, risk)
    recs     = _recommendations(inp, prediction, prob_yes)
    drift    = _detect_drift(row)
    fi       = _feat_importances()
    ts       = datetime.utcnow().isoformat()

    alerts: list[str] = []
    threshold = _get_alert_threshold(req.user_id)
    if prob_yes >= threshold:
        _create_alert(req.user_id, risk, prob_yes)
        alerts.append(f"Risk alert triggered (threshold {threshold:.2f}).")

    bg.add_task(
        _log_to_db,
        req.user_id, inp, prediction, prob_yes,
        risk, shap_top, shap_sum, recs, drift, ts,
    )

    return PredictResponse(
        prediction          = prediction,
        label               = "Diabetes / Pre-diabetes" if prediction == 1 else "No Diabetes",
        probability_no      = prob_no,
        probability_yes     = prob_yes,
        confidence          = round(prob_yes * 100, 1),
        risk_level          = risk,
        model_used          = _model_summary.get("best_model", "Unknown"),
        shap_explanation    = shap_top,
        shap_summary        = shap_sum,
        recommendations     = recs,
        feature_importances = fi,
        drift_detected      = drift,
        alerts              = alerts or None,
        timestamp           = ts,
    )


@app.post("/predict-heart", response_model=PredictResponse, tags=["Prediction"])
def predict_heart(req: HeartPredictRequest, bg: BackgroundTasks):
    if _heart_model is None:
        raise HTTPException(503, "Heart model not loaded. Run ml/train_heart.py first.")

    active_feats = _active_heart_features()
    inp = {f: getattr(req, f, 0.0) for f in active_feats}
    row = np.array([[inp[f] for f in active_feats]])

    proba      = _heart_model.predict_proba(row)[0]
    prob_yes   = round(float(proba[1]), 4)
    prob_no    = round(float(proba[0]), 4)
    prediction = int(prob_yes >= 0.5)
    risk       = _risk(prob_yes)

    shap_top = _compute_shap_heart(row)
    shap_sum = _shap_summary(shap_top, risk)
    recs     = _heart_recommendations(inp, prob_yes)
    drift    = _detect_drift_heart(row)
    fi       = _feat_importances_heart()
    ts       = datetime.utcnow().isoformat()

    alerts: list[str] = []
    threshold = _get_alert_threshold(req.user_id)
    if prob_yes >= threshold:
        _create_alert(req.user_id, risk, prob_yes)
        alerts.append(f"Heart risk alert triggered (threshold {threshold:.2f}).")

    return PredictResponse(
        prediction          = prediction,
        label               = "Heart Disease Risk" if prediction == 1 else "No Heart Disease",
        probability_no      = prob_no,
        probability_yes     = prob_yes,
        confidence          = round(prob_yes * 100, 1),
        risk_level          = risk,
        model_used          = _heart_model_summary.get("best_model", "Unknown"),
        shap_explanation    = shap_top,
        shap_summary        = shap_sum,
        recommendations     = recs,
        feature_importances = fi,
        drift_detected      = drift,
        alerts              = alerts or None,
        timestamp           = ts,
    )


@app.post("/predict-symptoms", response_model=SymptomPredictResponse, tags=["Prediction"])
def predict_symptoms(req: SymptomPredictRequest, bg: BackgroundTasks):
    if _model is None:
        raise HTTPException(503, "Model not loaded. Run ml/train.py first.")

    derived = _derive_inputs_from_symptoms(req)
    active_feats = _active_features()
    row = np.array([[derived.get(f, 0.0) for f in active_feats]])

    proba      = _model.predict_proba(row)[0]
    prob_yes   = round(float(proba[1]), 4)
    prob_no    = round(float(proba[0]), 4)
    prediction = int(prob_yes >= 0.5)
    risk       = _risk(prob_yes)

    shap_top = _compute_shap(row)
    shap_sum = _shap_summary(shap_top, risk)
    recs     = _recommendations(derived, prediction, prob_yes)
    drift    = _detect_drift(row)
    ts       = datetime.utcnow().isoformat()

    bg.add_task(
        _log_to_db,
        req.user_id, derived, prediction, prob_yes,
        risk, shap_top, shap_sum, recs, drift, ts,
    )

    return SymptomPredictResponse(
        prediction       = prediction,
        label            = "Diabetes / Pre-diabetes" if prediction == 1 else "No Diabetes",
        probability_no   = prob_no,
        probability_yes  = prob_yes,
        confidence       = round(prob_yes * 100, 1),
        risk_level       = risk,
        model_used       = _model_summary.get("best_model", "Unknown"),
        shap_explanation = shap_top,
        shap_summary     = shap_sum,
        recommendations  = recs,
        drift_detected   = drift,
        derived_inputs   = derived,
        symptoms_used    = req.symptoms,
        timestamp        = ts,
    )


@app.post("/log-input", tags=["Monitoring"])
def log_input(req: PredictRequest):
    """Log raw input without prediction — used for monitoring and drift tracking."""
    feats = _active_features()
    inp = {f: getattr(req, f) for f in feats}
    row = np.array([[inp[f] for f in feats]])
    drift = _detect_drift(row)
    return {
        "logged":         True,
        "user_id":        req.user_id,
        "drift_detected": drift,
        "timestamp":      datetime.utcnow().isoformat(),
    }


@app.get("/user-history", tags=["History"])
def user_history(
    user_id: str = Query("anonymous", description="User identifier"),
    limit:   int = Query(20, ge=1, le=100),
):
    conn = _db()
    rows = conn.execute("""
        SELECT id, user_id, input_data, prediction, probability,
             risk_level, shap_summary, recommendations, drift_detected, timestamp
        FROM predictions
        WHERE user_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
    """, (user_id, limit)).fetchall()
    conn.close()

    return {
        "user_id": user_id,
        "total":   len(rows),
        "history": [
            {
                "id":            r["id"],
                "prediction":    r["prediction"],
                "probability":   r["probability"],
                "risk_level":    r["risk_level"],
                "shap_summary":  r["shap_summary"],
                "recommendations": json.loads(r["recommendations"]) if r["recommendations"] else [],
                "drift_detected": bool(r["drift_detected"]),
                "timestamp":     r["timestamp"],
                "input_data":    json.loads(r["input_data"]),
            }
            for r in rows
        ],
    }


@app.post("/alert-config", tags=["Alerts"])
def alert_config(req: AlertConfig):
    conn = _db()
    conn.execute(
        "INSERT OR REPLACE INTO alert_settings (user_id, threshold, channel, created_at) VALUES (?,?,?,?)",
        (req.user_id, float(req.threshold), req.channel, datetime.utcnow().isoformat()),
    )
    conn.commit()
    conn.close()
    return {"saved": True, "user_id": req.user_id, "threshold": req.threshold, "channel": req.channel}


@app.get("/alerts", response_model=AlertsResponse, tags=["Alerts"])
def alerts(user_id: str = Query("anonymous"), limit: int = Query(20, ge=1, le=100)):
    conn = _db()
    rows = conn.execute(
        "SELECT id, message, risk_level, probability, created_at, read_flag FROM alerts WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
        (user_id, limit),
    ).fetchall()
    conn.close()

    return {
        "user_id": user_id,
        "alerts": [
            {
                "id": r["id"],
                "message": r["message"],
                "risk_level": r["risk_level"],
                "probability": float(r["probability"]),
                "created_at": r["created_at"],
                "read": bool(r["read_flag"]),
            }
            for r in rows
        ],
    }


@app.post("/chat", response_model=ChatResponse, tags=["Chatbot"])
def chat(req: ChatRequest):
    if not OPENROUTER_API_KEY:
        raise HTTPException(401, "OPENROUTER_API_KEY is not set")

    system = (
        "You are VitalAI's health assistant. Provide short, clear guidance. "
        "Do not diagnose or prescribe. Encourage professional care for serious symptoms."
    )
    user_text = req.message.strip()
    ctx = f"\n\nContext: {json.dumps(req.context)}" if req.context else ""

    try:
        with httpx.Client(timeout=OPENROUTER_TIMEOUT) as client:
            res = client.post(
                f"{OPENROUTER_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "http://localhost",
                    "X-Title": OPENROUTER_APP_NAME,
                },
                json={
                    "model": OPENROUTER_MODEL,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": f"{user_text}{ctx}"},
                    ],
                    "temperature": 0.3,
                    "max_tokens": 512,
                },
            )
        if not res.is_success:
            raise HTTPException(502, "Chatbot upstream error")
        data = res.json()
        choice = (data.get("choices") or [{}])[0]
        reply = (choice.get("message", {}) or {}).get("content", "")
        reply = reply.strip() if isinstance(reply, str) else ""
        return {"response": reply or "Sorry, I could not generate a response.", "model": OPENROUTER_MODEL}
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("Chat failed: %s", e)
        raise HTTPException(500, "Chatbot failure")
