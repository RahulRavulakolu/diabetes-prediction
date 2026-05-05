"""
Standalone training script (no MLflow) — quick local iteration.
Mirrors the full ml/train.py pipeline: SMOTE, SelectKBest(chi2, k=12), 5 models.
"""
import os
import json
import warnings
import joblib
import numpy as np
import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.feature_selection import SelectKBest, chi2
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, roc_auc_score,
    classification_report,
)
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import SVC
from xgboost import XGBClassifier
from imblearn.over_sampling import SMOTE

warnings.filterwarnings("ignore")

SEED        = 42
K           = 12
SVM_MAX_ROWS = 30_000   # RBF-SVM is O(n²); subsample for feasible runtime
os.makedirs("models", exist_ok=True)

# ── Load & binarise ────────────────────────────────────────────────────────────
print("Loading data…")
df = pd.read_csv("data/diabetes_012_health_indicators_BRFSS2015.csv")
df.fillna(df.median(numeric_only=True), inplace=True)
# Remove socioeconomic feature 'Income' to avoid bias
if "Income" in df.columns:
    df.drop(columns=["Income"], inplace=True)
df["Diabetes_binary"] = (df["Diabetes_012"] > 0).astype(int)
df.drop(columns=["Diabetes_012"], inplace=True)
feature_cols = [c for c in df.columns if c != "Diabetes_binary"]
X = df[feature_cols]
y = df["Diabetes_binary"].values
print(f"Shape: {df.shape}  Classes: {dict(zip(*np.unique(y, return_counts=True)))}")

# ── 70 / 15 / 15 split ────────────────────────────────────────────────────────
X_tmp, X_test, y_tmp, y_test = train_test_split(X, y, test_size=0.15, random_state=SEED, stratify=y)
X_train, X_val, y_train, y_val = train_test_split(X_tmp, y_tmp, test_size=round(0.15/0.85, 6), random_state=SEED, stratify=y_tmp)
print(f"Train: {X_train.shape}  Val: {X_val.shape}  Test: {X_test.shape}")

# ── SMOTE ─────────────────────────────────────────────────────────────────────
smote = SMOTE(random_state=SEED)
X_res, y_res = smote.fit_resample(X_train, y_train)
print(f"After SMOTE: {X_res.shape}")

# ── SelectKBest(chi2, k=12) ───────────────────────────────────────────────────
selector = SelectKBest(chi2, k=K)
X_train_sel = selector.fit_transform(X_res, y_res)
X_val_sel   = selector.transform(X_val)
X_test_sel  = selector.transform(X_test)
selected_features = list(X_train.columns[selector.get_support()])
print(f"Selected features: {selected_features}")
json.dump({"feature_names": selected_features}, open("models/feature_names.json", "w"))

# ── Models ────────────────────────────────────────────────────────────────────
models = {
    "LogisticRegression": Pipeline([("scaler", StandardScaler()), ("clf", LogisticRegression(C=1.0, max_iter=1000, random_state=SEED))]),
    "DecisionTree":       Pipeline([("scaler", StandardScaler()), ("clf", DecisionTreeClassifier(max_depth=10, random_state=SEED))]),
    "RandomForest":       Pipeline([("scaler", StandardScaler()), ("clf", RandomForestClassifier(n_estimators=200, max_depth=12, random_state=SEED, n_jobs=-1))]),
    "SVM":                Pipeline([("scaler", StandardScaler()), ("clf", SVC(kernel="rbf", C=1.0, probability=True, random_state=SEED))]),
    "XGBoost":            Pipeline([("scaler", StandardScaler()), ("clf", XGBClassifier(n_estimators=300, max_depth=6, learning_rate=0.1, random_state=SEED, eval_metric="logloss"))]),
}

results = {}
rng = np.random.default_rng(SEED)
for name, pipe in models.items():
    print(f"Training {name}…", end=" ", flush=True)
    if name == "SVM" and len(X_train_sel) > SVM_MAX_ROWS:
        idx = rng.choice(len(X_train_sel), SVM_MAX_ROWS, replace=False)
        pipe.fit(X_train_sel[idx], y_res[idx])
    else:
        pipe.fit(X_train_sel, y_res)
    yp = pipe.predict(X_test_sel)
    yb = pipe.predict_proba(X_test_sel)[:, 1]
    m = {
        "accuracy":  round(float(accuracy_score(y_test, yp)), 4),
        "precision": round(float(precision_score(y_test, yp, average="macro", zero_division=0)), 4),
        "recall":    round(float(recall_score(y_test, yp, average="macro", zero_division=0)), 4),
        "f1":        round(float(f1_score(y_test, yp, average="macro", zero_division=0)), 4),
        "roc_auc":   round(float(roc_auc_score(y_test, yb)), 4),
    }
    results[name] = {"pipe": pipe, "metrics": m}
    print(m)

# ── Best model ────────────────────────────────────────────────────────────────
best_name = max(results, key=lambda k: results[k]["metrics"]["f1"])
best_pipe = results[best_name]["pipe"]
print(f"\nBest: {best_name}  F1={results[best_name]['metrics']['f1']}")
print(classification_report(y_test, best_pipe.predict(X_test_sel),
                             target_names=["No Diabetes", "Diabetes/Pre"]))

joblib.dump(best_pipe, "models/best_model_v2.pkl")
summary = {k: v["metrics"] for k, v in results.items()}
summary["best_model"] = best_name
json.dump(summary, open("models/model_summary.json", "w"), indent=2)
print("Saved -> models/best_model_v2.pkl")
