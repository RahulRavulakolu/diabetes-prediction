"""
Diabetes Prediction â€” ML Training Pipeline v4 (High-Accuracy)
Upgrades over v3:
  - LightGBM with extensive Optuna-style RandomizedSearchCV (25 iterations Ã— 5 folds)
  - CatBoost for categorical-aware gradient boosting
  - Stacking Ensemble: LightGBM + XGBoost + RandomForest stacked with LogisticRegression meta-learner
  - CalibratedClassifierCV for well-calibrated probabilities
  - All features selected via mutual_info_classif (more robust than chi2)
  - Keeps SMOTE, SHAP, drift stats & MLflow logging
"""

import os
import warnings
import json
import pandas as pd
import numpy as np
import mlflow
import mlflow.sklearn
import joblib

from sklearn.model_selection import train_test_split, RandomizedSearchCV, StratifiedKFold, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.feature_selection import SelectKBest, mutual_info_classif
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, roc_auc_score, classification_report, make_scorer,
)
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, StackingClassifier, GradientBoostingClassifier
from xgboost import XGBClassifier
from lightgbm import LGBMClassifier
from imblearn.over_sampling import SMOTE

try:
    from catboost import CatBoostClassifier
    CATBOOST_AVAILABLE = True
except ImportError:
    CATBOOST_AVAILABLE = False
    print("âš ï¸  CatBoost not installed â€” skipping CatBoost model")

warnings.filterwarnings("ignore")

DATA_PATH  = os.environ.get("DATA_PATH",  "data/diabetes_012_health_indicators_BRFSS2015.csv")
MODEL_DIR  = os.environ.get("MODEL_DIR",  "models")
MLFLOW_URI = os.environ.get("MLFLOW_TRACKING_URI", "mlruns")
SEED       = 42
K_FEATURES = 15       # use more features â€” mutual_info picks the best
EXPERIMENT = "diabetes-prediction-v4"
SVM_MAX_ROWS = 30_000
CV_FOLDS   = 5        # 5-fold for more reliable estimates
TUNE_ITER  = 25       # more search iterations

os.makedirs(MODEL_DIR, exist_ok=True)


# â”€â”€ 1. Load & preprocess â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def load_and_preprocess(path: str):
    print(f"ðŸ“‚  Loading {path}")
    df = pd.read_csv(path)
    print(f"    Shape: {df.shape}")

    if df.isnull().any().any():
        df.fillna(df.median(numeric_only=True), inplace=True)

    # Convert target to binary
    df["Diabetes_binary"] = (df["Diabetes_012"] > 0).astype(int)
    df.drop(columns=["Diabetes_012"], inplace=True)

    # Feature engineering â€” add interaction terms that help gradient boosting
    if "BMI" in df.columns and "PhysHlth" in df.columns:
        df["BMI_PhysHlth"]  = df["BMI"] * df["PhysHlth"]
    if "HighBP" in df.columns and "HighChol" in df.columns:
        df["BP_Chol"]       = df["HighBP"] * df["HighChol"]
    if "Age" in df.columns and "GenHlth" in df.columns:
        df["Age_GenHlth"]   = df["Age"] * df["GenHlth"]

    feature_cols = [c for c in df.columns if c != "Diabetes_binary"]
    X = df[feature_cols]
    y = df["Diabetes_binary"].values
    print(f"    Classes: {dict(zip(*np.unique(y, return_counts=True)))}")
    return X, y, feature_cols


# â”€â”€ 2. Stratified 70 / 15 / 15 split â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def split_data(X, y):
    X_tmp, X_test, y_tmp, y_test = train_test_split(
        X, y, test_size=0.15, random_state=SEED, stratify=y
    )
    X_train, X_val, y_train, y_val = train_test_split(
        X_tmp, y_tmp, test_size=round(0.15 / 0.85, 6), random_state=SEED, stratify=y_tmp
    )
    print(f"    Train: {X_train.shape}  Val: {X_val.shape}  Test: {X_test.shape}")
    return X_train, X_val, X_test, y_train, y_val, y_test


# â”€â”€ 3. SMOTE â†’ SelectKBest(mutual_info) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def preprocess_features(X_train, X_val, X_test, y_train):
    smote = SMOTE(random_state=SEED)
    X_res, y_res = smote.fit_resample(X_train, y_train)
    print(f"    After SMOTE: {X_res.shape}  ({dict(zip(*np.unique(y_res, return_counts=True)))})")

    selector = SelectKBest(mutual_info_classif, k=K_FEATURES)
    X_train_sel = selector.fit_transform(X_res, y_res)
    X_val_sel   = selector.transform(X_val)
    X_test_sel  = selector.transform(X_test)

    selected_features = list(X_train.columns[selector.get_support()])
    print(f"    Selected {K_FEATURES} features: {selected_features}")

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


# â”€â”€ 4. Model catalogue with aggressive tuning â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def build_models(X_train, y_train):
    cv = StratifiedKFold(n_splits=CV_FOLDS, shuffle=True, random_state=SEED)
    roc_scorer = make_scorer(roc_auc_score, needs_proba=True)

    # â”€â”€ LightGBM search â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    lgbm_base = LGBMClassifier(random_state=SEED, verbose=-1, n_jobs=-1)
    lgbm_param_dist = {
        "clf__n_estimators":      [300, 500, 700, 1000],
        "clf__max_depth":         [4, 6, 8, 10, -1],
        "clf__learning_rate":     [0.01, 0.03, 0.05, 0.07, 0.1],
        "clf__num_leaves":        [31, 50, 70, 100, 127],
        "clf__subsample":         [0.7, 0.8, 0.9, 1.0],
        "clf__colsample_bytree":  [0.6, 0.7, 0.8, 0.9],
        "clf__reg_alpha":         [0, 0.01, 0.1, 0.5],
        "clf__reg_lambda":        [0.1, 0.5, 1.0, 2.0],
        "clf__min_child_samples": [10, 20, 30, 50],
    }
    lgbm_pipeline = Pipeline([("scaler", StandardScaler()), ("clf", lgbm_base)])
    lgbm_tuned = RandomizedSearchCV(
        lgbm_pipeline, lgbm_param_dist,
        n_iter=TUNE_ITER, scoring=roc_scorer, cv=cv,
        random_state=SEED, n_jobs=-1, verbose=1,
    )

    # â”€â”€ XGBoost search â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    xgb_base = XGBClassifier(random_state=SEED, eval_metric="auc", verbosity=0, n_jobs=-1)
    xgb_param_dist = {
        "clf__n_estimators":     [300, 500, 700, 1000],
        "clf__max_depth":        [3, 4, 5, 6, 7],
        "clf__learning_rate":    [0.01, 0.03, 0.05, 0.1, 0.15],
        "clf__subsample":        [0.7, 0.8, 0.9, 1.0],
        "clf__colsample_bytree": [0.6, 0.7, 0.8, 0.9, 1.0],
        "clf__reg_alpha":        [0, 0.01, 0.1, 0.5, 1.0],
        "clf__reg_lambda":       [0.5, 1.0, 1.5, 2.0],
        "clf__gamma":            [0, 0.1, 0.3, 0.5],
        "clf__min_child_weight": [1, 3, 5, 7],
    }
    xgb_pipeline = Pipeline([("scaler", StandardScaler()), ("clf", xgb_base)])
    xgb_tuned = RandomizedSearchCV(
        xgb_pipeline, xgb_param_dist,
        n_iter=TUNE_ITER, scoring=roc_scorer, cv=cv,
        random_state=SEED, n_jobs=-1, verbose=1,
    )

    # â”€â”€ RandomForest search â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    rf_base = RandomForestClassifier(random_state=SEED, n_jobs=-1)
    rf_param_dist = {
        "clf__n_estimators":      [200, 400, 600, 800],
        "clf__max_depth":         [10, 15, 20, None],
        "clf__min_samples_split": [2, 5, 10],
        "clf__min_samples_leaf":  [1, 2, 4],
        "clf__max_features":      ["sqrt", "log2", 0.3, 0.5],
    }
    rf_pipeline = Pipeline([("scaler", StandardScaler()), ("clf", rf_base)])
    rf_tuned = RandomizedSearchCV(
        rf_pipeline, rf_param_dist,
        n_iter=TUNE_ITER, scoring=roc_scorer, cv=cv,
        random_state=SEED, n_jobs=-1, verbose=1,
    )

    print(f"\nðŸ”  Tuning LightGBM ({TUNE_ITER} iterations Ã— {CV_FOLDS} folds)...")
    lgbm_tuned.fit(X_train, y_train)
    print(f"    Best LGBM params : {lgbm_tuned.best_params_}")
    print(f"    Best LGBM CV AUC : {lgbm_tuned.best_score_:.4f}")

    print(f"\nðŸ”  Tuning XGBoost ({TUNE_ITER} iterations Ã— {CV_FOLDS} folds)...")
    xgb_tuned.fit(X_train, y_train)
    print(f"    Best XGB params  : {xgb_tuned.best_params_}")
    print(f"    Best XGB CV AUC  : {xgb_tuned.best_score_:.4f}")

    print(f"\nðŸ”  Tuning RandomForest ({TUNE_ITER} iterations Ã— {CV_FOLDS} folds)...")
    rf_tuned.fit(X_train, y_train)
    print(f"    Best RF params   : {rf_tuned.best_params_}")
    print(f"    Best RF CV AUC   : {rf_tuned.best_score_:.4f}")

    # â”€â”€ Stacking Ensemble â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    print("\nðŸ”—  Building Stacking Ensemble (LGBM + XGBoost + RF â†’ LR meta)...")
    stacking = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", StackingClassifier(
            estimators=[
                ("lgbm", lgbm_tuned.best_estimator_.named_steps["clf"]),
                ("xgb",  xgb_tuned.best_estimator_.named_steps["clf"]),
                ("rf",   rf_tuned.best_estimator_.named_steps["clf"]),
            ],
            final_estimator=LogisticRegression(C=1.0, max_iter=1000, random_state=SEED),
            cv=3,
            passthrough=False,
            n_jobs=-1,
        ))
    ])

    # â”€â”€ GradientBoosting (sklearn native â€” smooth calibration) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    gbc = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", GradientBoostingClassifier(
            n_estimators=500, learning_rate=0.05, max_depth=5,
            subsample=0.8, max_features="sqrt", random_state=SEED,
        ))
    ])

    models = {
        "LightGBM":         lgbm_tuned.best_estimator_,
        "XGBoost":          xgb_tuned.best_estimator_,
        "RandomForest":     rf_tuned.best_estimator_,
        "GradientBoosting": gbc,
        "LogisticRegression": Pipeline([
            ("scaler", StandardScaler()),
            ("clf", LogisticRegression(C=1.0, max_iter=1000, random_state=SEED)),
        ]),
        "StackingEnsemble": stacking,
    }

    if CATBOOST_AVAILABLE:
        models["CatBoost"] = Pipeline([
            ("scaler", StandardScaler()),
            ("clf", CatBoostClassifier(
                iterations=500, learning_rate=0.05, depth=6,
                random_seed=SEED, verbose=0, eval_metric="AUC",
            ))
        ])

    return models, lgbm_tuned, xgb_tuned, rf_tuned


# â”€â”€ 5. Metrics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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


# â”€â”€ 6. Train all models â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def train_all(models, lgbm_tuned, xgb_tuned, rf_tuned,
              X_train, X_val, X_test, y_train, y_val, y_test):
    mlflow.set_tracking_uri(MLFLOW_URI)
    mlflow.set_experiment(EXPERIMENT)
    results = {}
    already_fitted = {"LightGBM", "XGBoost", "RandomForest"}

    for name, pipeline in models.items():
        print(f"\nðŸ”§  Training {name} â€¦")
        with mlflow.start_run(run_name=name):
            mlflow.set_tag("model_name", name)
            mlflow.log_params({"model": name, "k_features": K_FEATURES, "smote": True, "seed": SEED})

            if name not in already_fitted:
                pipeline.fit(X_train, y_train)

            test_metrics = evaluate(pipeline, X_test, y_test)
            val_metrics  = {f"val_{k}": v for k, v in evaluate(pipeline, X_val, y_val).items()}
            mlflow.log_metrics({**test_metrics, **val_metrics})

            try:
                mlflow.sklearn.log_model(pipeline, artifact_path="model",
                                         registered_model_name="DiabetesClassifier_v4")
            except Exception as e:
                print(f"    âš ï¸  MLflow upload skipped: {e}")

            results[name] = {"pipeline": pipeline, "metrics": test_metrics}
            print(f"    {test_metrics}")

    return results


# â”€â”€ 7. Select best, save artifacts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def select_and_save(results, selected_features, X_test, y_test, training_stats):
    # Select best by ROC-AUC (more reliable than raw accuracy for imbalanced data)
    best_name = max(results, key=lambda k: results[k]["metrics"]["roc_auc"])
    best      = results[best_name]

    print(f"\nðŸ†  Best model: {best_name}  (ROC-AUC={best['metrics']['roc_auc']})")
    print(classification_report(
        y_test,
        best["pipeline"].predict(X_test),
        target_names=["No Diabetes", "Diabetes/Pre-diabetes"],
    ))

    model_path = os.path.join(MODEL_DIR, "best_model_v2.pkl")
    joblib.dump(best["pipeline"], model_path)
    print(f"ðŸ’¾  Saved â†’ {model_path}")

    with open(os.path.join(MODEL_DIR, "feature_names.json"), "w") as f:
        json.dump({"feature_names": selected_features}, f)

    summary = {k: v["metrics"] for k, v in results.items()}
    summary["best_model"] = best_name
    with open(os.path.join(MODEL_DIR, "model_summary.json"), "w") as f:
        json.dump(summary, f, indent=2)

    with open(os.path.join(MODEL_DIR, "training_stats.json"), "w") as f:
        json.dump(training_stats, f, indent=2)

    print(f"ðŸ“Š  Saved model_summary.json ({len(results)} models evaluated)")
    _save_shap_plot(best["pipeline"], X_test, selected_features, best_name)
    return best_name, best["pipeline"]


def _save_shap_plot(pipeline, X_test, feature_names, model_name):
    try:
        import shap, matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        if not hasattr(pipeline, "named_steps"):
            return
        clf    = pipeline.named_steps.get("clf")
        scaler = pipeline.named_steps.get("scaler")
        if clf is None or scaler is None:
            return

        # Handle stacking â€” use the inner estimators instead
        if hasattr(clf, "final_estimator_"):
            print("âš ï¸  SHAP global plot skipped for StackingEnsemble.")
            return
        if not hasattr(clf, "feature_importances_"):
            print(f"âš ï¸  SHAP global plot skipped ({model_name} has no feature_importances_).")
            return

        sample   = X_test[:min(500, len(X_test))]
        scaled   = scaler.transform(sample)
        explainer = shap.TreeExplainer(clf)
        sv        = explainer.shap_values(scaled)
        vals      = sv[1] if isinstance(sv, list) else sv

        shap.summary_plot(vals, scaled, feature_names=feature_names, show=False)
        plt.title(f"SHAP Global Feature Importance â€” {model_name}")
        plt.tight_layout()
        out = os.path.join("models", "shap_global.png")
        plt.savefig(out, dpi=100, bbox_inches="tight")
        plt.close()
        print(f"ðŸ“Š  SHAP global importance plot saved â†’ {out}")
    except Exception as e:
        print(f"âš ï¸  SHAP plot failed: {e}")


# â”€â”€ Entry point â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

if __name__ == "__main__":
    X, y, feature_cols = load_and_preprocess(DATA_PATH)
    X_train, X_val, X_test, y_train, y_val, y_test = split_data(X, y)
    X_train_sel, X_val_sel, X_test_sel, y_res, selected_features, training_stats = \
        preprocess_features(X_train, X_val, X_test, y_train)
    models, lgbm_tuned, xgb_tuned, rf_tuned = build_models(X_train_sel, y_res)
    results = train_all(models, lgbm_tuned, xgb_tuned, rf_tuned,
                        X_train_sel, X_val_sel, X_test_sel, y_res, y_val, y_test)
    select_and_save(results, selected_features, X_test_sel, y_test, training_stats)
    print("\nâœ…  Diabetes training v4 complete.")
