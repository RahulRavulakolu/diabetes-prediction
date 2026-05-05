"""
Tests for the ML training pipeline components.
Run: pytest tests/ -v
"""

import pytest
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.feature_selection import SelectKBest, chi2
from imblearn.over_sampling import SMOTE

DATA_FILE  = "data/diabetes_012_health_indicators_BRFSS2015.csv"
K_FEATURES = 12


def test_pipeline_fit_predict():
    """Smoke test: full pipeline (scaler + classifier) trains and predicts."""
    X = np.random.rand(300, K_FEATURES)
    y = np.random.randint(0, 2, 300)
    pipe = Pipeline([("scaler", StandardScaler()), ("clf", LogisticRegression(max_iter=200))])
    pipe.fit(X, y)
    preds = pipe.predict(X)
    assert preds.shape == (300,)
    assert set(preds).issubset({0, 1})


def test_smote_balances_classes():
    """SMOTE should produce near-equal class counts."""
    X = np.random.rand(200, K_FEATURES)
    y = np.array([0] * 170 + [1] * 30)     # highly imbalanced
    smote = SMOTE(random_state=42)
    X_res, y_res = smote.fit_resample(X, y)
    counts = np.bincount(y_res)
    assert counts[0] == counts[1], "SMOTE should balance classes exactly"


def test_select_kbest_reduces_features():
    """SelectKBest(chi2) should return exactly K_FEATURES columns."""
    X = np.abs(np.random.rand(500, 21))   # chi2 requires non-negative
    y = np.random.randint(0, 2, 500)
    sel = SelectKBest(chi2, k=K_FEATURES)
    X_sel = sel.fit_transform(X, y)
    assert X_sel.shape[1] == K_FEATURES


def test_dataset_columns():
    """Dataset must have exactly 22 columns (21 features + Diabetes_012 target)."""
    df = pd.read_csv(DATA_FILE, nrows=100)
    assert df.shape[1] == 22, f"Expected 22 columns, got {df.shape[1]}"


def test_no_nulls_after_fill():
    """No nulls should remain after median imputation."""
    df = pd.read_csv(DATA_FILE, nrows=1000)
    df.fillna(df.median(numeric_only=True), inplace=True)
    assert df.isnull().sum().sum() == 0


def test_target_binarisation():
    """Binarised target must contain only {0, 1}."""
    df = pd.read_csv(DATA_FILE, nrows=1000)
    binary = (df["Diabetes_012"] > 0).astype(int)
    assert set(binary.unique()).issubset({0, 1})


def test_xgboost_importable():
    """XGBoost must be installed and importable."""
    from xgboost import XGBClassifier
    clf = XGBClassifier(n_estimators=5)
    X = np.random.rand(50, K_FEATURES)
    y = np.random.randint(0, 2, 50)
    clf.fit(X, y)
    assert clf.predict(X).shape == (50,)
