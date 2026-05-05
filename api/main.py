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
from fastapi import BackgroundTasks, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# ── Paths ──────────────────────────────────────────────────────────────────────
MODEL_DIR = Path(os.environ.get("MODEL_DIR", "models"))
DB_PATH   = Path(os.environ.get("DB_PATH", "database/predictions.db"))

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

# ── Database ───────────────────────────────────────────────────────────────────

def _db() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def _init_db() -> None:
    conn = _db()
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
    conn.commit()
    conn.close()


# ── Global artifacts ───────────────────────────────────────────────────────────

_model           = None
_feature_names:  list[str] = []
_model_summary:  dict      = {}
_training_stats: dict      = {}
_shap_explainer  = None
_scaler          = None
_clf             = None

FEATURE_ORDER = [
    "HighBP", "HighChol", "BMI", "Stroke",
    "HeartDiseaseorAttack", "HvyAlcoholConsump",
    "GenHlth", "MentHlth", "PhysHlth", "DiffWalk",
    "Age", "Income",
]


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


def _init_shap() -> None:
    global _shap_explainer
    try:
        import shap  # noqa: F401
        if _clf is None:
            return
        if hasattr(_clf, "feature_importances_"):
            import shap as _shap
            _shap_explainer = _shap.TreeExplainer(_clf)
            logger.info("SHAP TreeExplainer ready")
        elif hasattr(_clf, "coef_"):
            import shap as _shap
            feats = len(_feature_names) if _feature_names else len(FEATURE_ORDER)
            bg = np.zeros((1, feats))
            if _scaler is not None:
                bg = _scaler.transform(bg)
            _shap_explainer = _shap.LinearExplainer(_clf, bg)
            logger.info("SHAP LinearExplainer ready")
    except Exception as e:
        logger.warning("SHAP init failed: %s", e)


@app.on_event("startup")
def _startup() -> None:
    _init_db()
    try:
        _load_artifacts()
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
                "HeartDiseaseorAttack": 0, "HvyAlcoholConsump": 0,
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
    timestamp:           str


class FeatureImportanceItem(BaseModel):
    feature: str
    importance: float


class FeatureImportanceResponse(BaseModel):
    plot_path: str | None
    feature_importances: list[FeatureImportanceItem]


# ── Helpers ────────────────────────────────────────────────────────────────────

def _active_features() -> list[str]:
    return _feature_names if _feature_names else FEATURE_ORDER


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


def _compute_shap(row: np.ndarray) -> list[SHAPFeature]:
    feats = _active_features()
    out: list[SHAPFeature] = []

    if _shap_explainer is not None and _scaler is not None:
        try:
            scaled = _scaler.transform(row)
            sv     = _shap_explainer.shap_values(scaled)
            # TreeExplainer returns list[ndarray] for RandomForest; LinearExplainer ndarray
            vals: np.ndarray = sv[1][0] if isinstance(sv, list) else sv[0]
            for feat, impact in sorted(zip(feats, vals), key=lambda x: abs(x[1]), reverse=True)[:5]:
                out.append(SHAPFeature(
                    feature   = feat,
                    impact    = round(abs(float(impact)), 4),
                    direction = "increases" if float(impact) > 0 else "decreases",
                ))
            return out
        except Exception as e:
            logger.warning("SHAP computation failed: %s", e)

    # Fallback → feature importances (direction always "increases" as proxy)
    fi = _feat_importances()
    for feat, imp in list(fi.items())[:5]:
        out.append(SHAPFeature(feature=feat, impact=float(imp), direction="increases"))
    return out


def _shap_summary(features: list[SHAPFeature], risk: str) -> str:
    if not features:
        return f"{risk} diabetes risk based on your health indicators."
    names = [_FNAME_MAP.get(f.feature, f.feature) for f in features[:3]]
    return f"{risk} risk — primarily driven by: {', '.join(names)}."


def _recommendations(inp: dict, pred: int, prob: float) -> list[str]:
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


def _detect_drift(row: np.ndarray) -> bool:
    if not _training_stats:
        return False
    feats = _active_features()
    anomalies = 0
    for i, feat in enumerate(feats):
        stat = _training_stats.get(feat)
        if stat:
            mu, sigma = stat["mean"], stat["std"]
            if sigma > 0 and abs(row[0][i] - mu) / sigma > 3.5:
                anomalies += 1
    return anomalies >= 2


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
def feature_importance():
    plot_path = MODEL_DIR / "shap_global.png"
    return {
        "plot_path": str(plot_path) if plot_path.exists() else None,
        "feature_importances": _global_feature_importances(),
    }


@app.post("/predict", response_model=PredictResponse, tags=["Prediction"])
def predict(req: PredictRequest, bg: BackgroundTasks):
    if _model is None:
        raise HTTPException(503, "Model not loaded. Run ml/train.py first.")

    inp = {f: getattr(req, f) for f in FEATURE_ORDER}
    row = np.array([[inp[f] for f in FEATURE_ORDER]])

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
        timestamp           = ts,
    )


@app.post("/log-input", tags=["Monitoring"])
def log_input(req: PredictRequest):
    """Log raw input without prediction — used for monitoring and drift tracking."""
    inp = {f: getattr(req, f) for f in FEATURE_ORDER}
    row = np.array([[inp[f] for f in FEATURE_ORDER]])
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
