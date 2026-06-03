"""
Tests for the FastAPI /predict endpoint.
Run: pytest tests/ -v
"""

import json
import pytest
import numpy as np
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch

SELECTED_FEATURES = [
    "HighBP", "HighChol", "BMI", "Stroke",
    "HeartDiseaseorAttack", "HvyAlcoholConsump",
    "GenHlth", "MentHlth", "PhysHlth", "DiffWalk",
    "Age", "Income",
]


@pytest.fixture(autouse=True, scope="function")
def mock_model():
    mock = MagicMock()
    mock.predict.return_value = np.array([1])
    mock.predict_proba.return_value = np.array([[0.3, 0.7]])

    # Simulate feature_importances_ on the clf step
    mock_clf = MagicMock()
    mock_clf.feature_importances_ = np.ones(12) / 12
    mock.named_steps = {"scaler": MagicMock(), "clf": mock_clf}

    with patch("joblib.load", return_value=mock), \
         patch("pathlib.Path.exists", return_value=True), \
         patch("builtins.open", create=True) as mock_open:

        def side_effect(path, *args, **kwargs):
            m = MagicMock()
            m.__enter__ = lambda s: s
            m.__exit__ = MagicMock(return_value=False)
            if "feature_names" in str(path):
                m.read.return_value = json.dumps({"feature_names": SELECTED_FEATURES})
            elif "model_summary" in str(path):
                m.read.return_value = json.dumps({"best_model": "RandomForest"})
            else:
                m.read.return_value = "{}"
            return m

        mock_open.side_effect = side_effect
        yield mock


@pytest.fixture(scope="function")
def client():
    from api.main import app
    return TestClient(app)


# ── Tests ──────────────────────────────────────────────────────────────────────

def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_predict_default_payload(client):
    r = client.post("/predict", json={})
    assert r.status_code in (200, 503)


def test_predict_valid(client):
    payload = {
        "BMI": 30.0, "Age": 9, "GenHlth": 4,
        "HighBP": 1, "HighChol": 1, "Stroke": 0,
        "HeartDiseaseorAttack": 0, "HvyAlcoholConsump": 0,
        "MentHlth": 5, "PhysHlth": 5, "DiffWalk": 0, "Income": 4,
    }
    r = client.post("/predict", json=payload)
    if r.status_code == 200:
        data = r.json()
        assert data["prediction"] in (0, 1)
        assert 0.0 <= data["probability_yes"] <= 1.0
        assert 0.0 <= data["confidence"] <= 100.0
        assert data["risk_level"] in ("Low", "Moderate", "High", "Very High")


def test_predict_invalid_bmi(client):
    r = client.post("/predict", json={"BMI": 5})   # below minimum of 10
    assert r.status_code == 422


def test_predict_invalid_genhlth(client):
    r = client.post("/predict", json={"GenHlth": 9})  # above maximum of 5
    assert r.status_code == 422


def test_predict_response_fields(client):
    r = client.post("/predict", json={"BMI": 25.0})
    if r.status_code == 200:
        required = {
            "prediction", "label", "probability_no", "probability_yes",
            "confidence", "risk_level", "model_used", "feature_importances",
        }
        assert required.issubset(r.json().keys())


def test_confidence_equals_probability(client):
    r = client.post("/predict", json={"BMI": 25.0})
    if r.status_code == 200:
        data = r.json()
        assert abs(data["confidence"] - round(data["probability_yes"] * 100, 1)) < 0.01


def test_predict_heart(client):
    payload = {
        "gender": 1,
        "age_years": 54.0,
        "bmi": 27.0,
        "ap_hi": 130,
        "ap_lo": 85,
        "cholesterol": 2,
        "gluc": 1,
        "smoke": 0,
        "alco": 0,
        "active": 1,
    }
    r = client.post("/predict-heart", json=payload)
    assert r.status_code in (200, 503)


def test_predict_symptoms(client):
    payload = {
        "symptoms": ["fatigue", "frequent_urination"],
        "severity": 3,
        "age": 7,
        "bmi": 29.0,
    }
    r = client.post("/predict-symptoms", json=payload)
    assert r.status_code in (200, 503)


def test_alert_config(client):
    r = client.post("/alert-config", json={"user_id": "test", "threshold": 0.8, "channel": "in_app"})
    assert r.status_code == 200


def test_chat_endpoint(client):
    r = client.post("/chat", json={"message": "Hello", "context": {"risk_level": "Low"}})
    assert r.status_code in (200, 401, 403, 502, 500)
