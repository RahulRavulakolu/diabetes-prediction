"""
Diabetes Prediction — ML Training Pipeline v2
5 models · SMOTE · SelectKBest(chi2, k=12) · 70/15/15 split · MLflow tracking
New: training_stats.json for drift detection · SHAP global importance plot
"""

import os
import warnings
import json
import pandas as pd
import numpy as np
import mlflow
import mlflow.sklearn
import joblib

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.feature_selection import SelectKBest, chi2
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, roc_auc_score, classification_report,
)
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import SVC
from xgboost import XGBClassifier
from imblearn.over_sampling import SMOTE

warnings.filterwarnings("ignore")

DATA_PATH  = os.environ.get("DATA_PATH", "data/diabetes_012_health_indicators_BRFSS2015.csv")
MODEL_DIR  = os.environ.get("MODEL_DIR", "models")
MLFLOW_URI = os.environ.get("MLFLOW_TRACKING_URI", "mlruns")
SEED       = 42
K_FEATURES = 12
EXPERIMENT = "diabetes-prediction"
SVM_MAX_ROWS = 30_000

os.makedirs(MODEL_DIR, exist_ok=True)


# ── 1. Load & preprocess ───────────────────────────────────────────────────────

def load_and_preprocess(path: str):
    print(f"📂  Loading {path}")
    df = pd.read_csv(path)
    print(f"    Shape: {df.shape}")

    if df.isnull().any().any():
        df.fillna(df.median(numeric_only=True), inplace=True)
    else:
        print("✅  No missing values.")

    if "Income" in df.columns:
        df.drop(columns=["Income"], inplace=True)
        print("    Dropped column: Income (socioeconomic bias)")

    df["Diabetes_binary"] = (df["Diabetes_012"] > 0).astype(int)
    df.drop(columns=["Diabetes_012"], inplace=True)

    feature_cols = [c for c in df.columns if c != "Diabetes_binary"]
    X = df[feature_cols]
    y = df["Diabetes_binary"].values
    print(f"    Classes: {dict(zip(*np.unique(y, return_counts=True)))}")
    return X, y, feature_cols


# ── 2. Stratified 70 / 15 / 15 split ──────────────────────────────────────────

def split_data(X, y):
    X_tmp, X_test, y_tmp, y_test = train_test_split(
        X, y, test_size=0.15, random_state=SEED, stratify=y
    )
    X_train, X_val, y_train, y_val = train_test_split(
        X_tmp, y_tmp, test_size=round(0.15 / 0.85, 6), random_state=SEED, stratify=y_tmp
    )
    print(f"    Train: {X_train.shape}  Val: {X_val.shape}  Test: {X_test.shape}")
    return X_train, X_val, X_test, y_train, y_val, y_test


# ── 3. SMOTE → SelectKBest(chi2, k=12) ────────────────────────────────────────

def preprocess_features(X_train, X_val, X_test, y_train):
    smote = SMOTE(random_state=SEED)
    X_res, y_res = smote.fit_resample(X_train, y_train)
    print(f"    After SMOTE: {X_res.shape}  ({dict(zip(*np.unique(y_res, return_counts=True)))})")

    selector = SelectKBest(chi2, k=K_FEATURES)
    X_train_sel = selector.fit_transform(X_res, y_res)
    X_val_sel   = selector.transform(X_val)
    X_test_sel  = selector.transform(X_test)

    selected_features = list(X_train.columns[selector.get_support()])
    print(f"    Selected {K_FEATURES} features: {selected_features}")

    # Compute training statistics on ORIGINAL data (pre-SMOTE) for drift detection
    X_orig_sel = selector.transform(X_train)
    training_stats: dict[str, dict] = {}
    for i, feat in enumerate(selected_features):
        col = X_orig_sel[:, i].astype(float)
        training_stats[feat] = {
            "mean": round(float(col.mean()), 6),
            "std":  round(float(col.std()),  6),
            "min":  round(float(col.min()),  6),
            "max":  round(float(col.max()),  6),
        }

    return X_train_sel, X_val_sel, X_test_sel, y_res, selected_features, training_stats


# ── 4. Model catalogue ─────────────────────────────────────────────────────────

def build_models():
    return {
        "LogisticRegression": Pipeline([
            ("scaler", StandardScaler()),
            ("clf",    LogisticRegression(C=1.0, max_iter=1000, random_state=SEED)),
        ]),
        "DecisionTree": Pipeline([
            ("scaler", StandardScaler()),
            ("clf",    DecisionTreeClassifier(max_depth=10, random_state=SEED)),
        ]),
        "RandomForest": Pipeline([
            ("scaler", StandardScaler()),
            ("clf",    RandomForestClassifier(
                n_estimators=200, max_depth=12, random_state=SEED, n_jobs=-1
            )),
        ]),
        "SVM": Pipeline([
            ("scaler", StandardScaler()),
            ("clf",    SVC(kernel="rbf", C=1.0, probability=True, random_state=SEED)),
        ]),
        "XGBoost": Pipeline([
            ("scaler", StandardScaler()),
            ("clf",    XGBClassifier(
                n_estimators=300, max_depth=6, learning_rate=0.1,
                random_state=SEED, eval_metric="logloss",
            )),
        ]),
    }


# ── 5. Metrics ─────────────────────────────────────────────────────────────────

def evaluate(model, X, y):
    y_pred = model.predict(X)
    y_prob = model.predict_proba(X)[:, 1]
    return {
        "accuracy":  round(float(accuracy_score(y, y_pred)), 4),
        "precision": round(float(precision_score(y, y_pred, average="macro", zero_division=0)), 4),
        "recall":    round(float(recall_score(y, y_pred, average="macro", zero_division=0)), 4),
        "f1":        round(float(f1_score(y, y_pred, average="macro", zero_division=0)), 4),
        "roc_auc":   round(float(roc_auc_score(y, y_prob)), 4),
    }


# ── 6. Train all models with MLflow ───────────────────────────────────────────

def train_all(X_train, X_val, X_test, y_train, y_val, y_test):
    mlflow.set_tracking_uri(MLFLOW_URI)
    mlflow.set_experiment(EXPERIMENT)

    models  = build_models()
    results = {}

    for name, pipeline in models.items():
        print(f"\n🔧  Training {name} …")
        with mlflow.start_run(run_name=name):
            mlflow.set_tag("model_name", name)
            mlflow.log_params({
                "model": name, "k_features": K_FEATURES,
                "smote": True, "seed": SEED,
            })

            if name == "SVM" and len(X_train) > SVM_MAX_ROWS:
                rng = np.random.default_rng(SEED)
                idx = rng.choice(len(X_train), SVM_MAX_ROWS, replace=False)
                pipeline.fit(X_train[idx], y_train[idx])
            else:
                pipeline.fit(X_train, y_train)

            test_metrics = evaluate(pipeline, X_test, y_test)
            val_metrics  = {f"val_{k}": v for k, v in evaluate(pipeline, X_val, y_val).items()}

            mlflow.log_metrics({**test_metrics, **val_metrics})
            mlflow.sklearn.log_model(
                pipeline,
                artifact_path="model",
                registered_model_name="DiabetesClassifier",
            )

            results[name] = {"pipeline": pipeline, "metrics": test_metrics}
            print(f"    {test_metrics}")

    return results


# ── 7. Select best model & save all artifacts ──────────────────────────────────

def select_and_save(results, selected_features, X_test, y_test, training_stats):
    best_name = max(results, key=lambda k: results[k]["metrics"]["f1"])
    best      = results[best_name]

    print(f"\n🏆  Best model: {best_name}  (F1={best['metrics']['f1']})")
    print(classification_report(
        y_test,
        best["pipeline"].predict(X_test),
        target_names=["No Diabetes", "Diabetes/Pre-diabetes"],
    ))

    # Save model
    model_path = os.path.join(MODEL_DIR, "best_model_v2.pkl")
    joblib.dump(best["pipeline"], model_path)
    print(f"💾  Saved → {model_path}")

    # Save feature names
    with open(os.path.join(MODEL_DIR, "feature_names.json"), "w") as f:
        json.dump({"feature_names": selected_features}, f)

    # Save model summary (all models + best)
    summary = {k: v["metrics"] for k, v in results.items()}
    summary["best_model"] = best_name
    with open(os.path.join(MODEL_DIR, "model_summary.json"), "w") as f:
        json.dump(summary, f, indent=2)

    # Save training statistics for drift detection
    with open(os.path.join(MODEL_DIR, "training_stats.json"), "w") as f:
        json.dump(training_stats, f, indent=2)
    print(f"📊  Saved training_stats.json ({len(training_stats)} features)")

    # Generate SHAP global feature importance plot (optional)
    _save_shap_plot(best["pipeline"], X_test, selected_features)

    return best_name, best["pipeline"]


def _save_shap_plot(pipeline, X_test, feature_names):
    try:
        import shap
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        clf    = pipeline.named_steps["clf"]
        scaler = pipeline.named_steps["scaler"]

        if not hasattr(clf, "feature_importances_"):
            print("⚠️  SHAP global plot skipped (model has no feature_importances_).")
            return

        sample   = X_test[:min(300, len(X_test))]
        scaled   = scaler.transform(sample)
        explainer = shap.TreeExplainer(clf)
        sv        = explainer.shap_values(scaled)
        vals      = sv[1] if isinstance(sv, list) else sv

        shap.summary_plot(vals, scaled, feature_names=feature_names, show=False)
        plt.title("SHAP Global Feature Importance")
        plt.tight_layout()
        out = os.path.join(MODEL_DIR, "shap_global.png")
        plt.savefig(out, dpi=100, bbox_inches="tight")
        plt.close()
        print(f"📊  SHAP global importance plot saved → {out}")
    except ImportError:
        print("⚠️  SHAP not installed — skipping global importance plot.")
    except Exception as e:
        print(f"⚠️  SHAP plot failed: {e}")


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    X, y, feature_cols = load_and_preprocess(DATA_PATH)
    X_train, X_val, X_test, y_train, y_val, y_test = split_data(X, y)
    X_train_sel, X_val_sel, X_test_sel, y_res, selected_features, training_stats = \
        preprocess_features(X_train, X_val, X_test, y_train)
    results = train_all(X_train_sel, X_val_sel, X_test_sel, y_res, y_val, y_test)
    select_and_save(results, selected_features, X_test_sel, y_test, training_stats)
    print("\n✅  Training complete.")
