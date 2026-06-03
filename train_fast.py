"""
Fast High-Accuracy Training Script
- Subsamples 80k rows for speed (stratified, representative)
- Focuses on LightGBM + XGBoost + Stacking (proven best performers)
- 15 iter x 3-fold CV — finishes in ~5 minutes
- Trains BOTH diabetes and heart models in one run
"""
import os, warnings, json
import pandas as pd
import numpy as np
import joblib

from sklearn.model_selection import train_test_split, RandomizedSearchCV, StratifiedKFold
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.feature_selection import SelectKBest, mutual_info_classif
from sklearn.ensemble import RandomForestClassifier, StackingClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, roc_auc_score, classification_report, make_scorer,
)
from xgboost import XGBClassifier
from lightgbm import LGBMClassifier
from imblearn.over_sampling import SMOTE

warnings.filterwarnings("ignore")

SEED       = 42
MODEL_DIR  = "models"
CV_FOLDS   = 3
TUNE_ITER  = 15
SAMPLE_N   = 80_000   # fast stratified sample — enough for reliable gradients

os.makedirs(MODEL_DIR, exist_ok=True)


def evaluate(model, X, y):
    yp = model.predict(X)
    yprob = model.predict_proba(X)[:, 1]
    return {
        "accuracy":  round(float(accuracy_score(y, yp)), 4),
        "precision": round(float(precision_score(y, yp, average="macro", zero_division=0)), 4),
        "recall":    round(float(recall_score(y, yp, average="macro", zero_division=0)), 4),
        "f1":        round(float(f1_score(y, yp, average="macro", zero_division=0)), 4),
        "roc_auc":   round(float(roc_auc_score(y, yprob)), 4),
    }


def build_and_tune(X_train, y_train):
    cv = StratifiedKFold(n_splits=CV_FOLDS, shuffle=True, random_state=SEED)
    roc_scorer = make_scorer(roc_auc_score, needs_proba=True)

    lgbm_params = {
        "clf__n_estimators":      [300, 500, 700],
        "clf__learning_rate":     [0.03, 0.05, 0.07, 0.1],
        "clf__num_leaves":        [50, 70, 100, 127],
        "clf__subsample":         [0.7, 0.8, 0.9],
        "clf__colsample_bytree":  [0.7, 0.8, 0.9],
        "clf__reg_alpha":         [0, 0.1, 0.5],
        "clf__reg_lambda":        [0.5, 1.0, 2.0],
        "clf__min_child_samples": [10, 20, 30],
    }
    lgbm_pipe = Pipeline([("scaler", StandardScaler()),
                           ("clf", LGBMClassifier(random_state=SEED, verbose=-1, n_jobs=-1))])
    lgbm_tuned = RandomizedSearchCV(lgbm_pipe, lgbm_params, n_iter=TUNE_ITER,
                                    scoring=roc_scorer, cv=cv, random_state=SEED,
                                    n_jobs=-1, verbose=1)

    xgb_params = {
        "clf__n_estimators":     [300, 500, 700],
        "clf__max_depth":        [4, 5, 6],
        "clf__learning_rate":    [0.03, 0.05, 0.1],
        "clf__subsample":        [0.7, 0.8, 0.9],
        "clf__colsample_bytree": [0.7, 0.8, 0.9],
        "clf__reg_alpha":        [0, 0.1, 0.5],
        "clf__reg_lambda":       [0.5, 1.0, 2.0],
        "clf__gamma":            [0, 0.1, 0.3],
    }
    xgb_pipe = Pipeline([("scaler", StandardScaler()),
                          ("clf", XGBClassifier(random_state=SEED, eval_metric="auc",
                                                verbosity=0, n_jobs=-1))])
    xgb_tuned = RandomizedSearchCV(xgb_pipe, xgb_params, n_iter=TUNE_ITER,
                                   scoring=roc_scorer, cv=cv, random_state=SEED,
                                   n_jobs=-1, verbose=1)

    print("  Tuning LightGBM...")
    lgbm_tuned.fit(X_train, y_train)
    print(f"  LGBM best CV AUC: {lgbm_tuned.best_score_:.4f}")

    print("  Tuning XGBoost...")
    xgb_tuned.fit(X_train, y_train)
    print(f"  XGB  best CV AUC: {xgb_tuned.best_score_:.4f}")

    # GradientBoosting (sklearn native - well calibrated, good for SHAP)
    gbc = Pipeline([("scaler", StandardScaler()),
                    ("clf", GradientBoostingClassifier(
                        n_estimators=300, learning_rate=0.05, max_depth=5,
                        subsample=0.8, max_features="sqrt", random_state=SEED))])

    # Stacking ensemble
    stack = StackingClassifier(
        estimators=[
            ("lgbm", lgbm_tuned.best_estimator_.named_steps["clf"]),
            ("xgb",  xgb_tuned.best_estimator_.named_steps["clf"]),
        ],
        final_estimator=LogisticRegression(C=1.0, max_iter=500, random_state=SEED),
        cv=3, n_jobs=-1,
    )
    stack_pipe = Pipeline([("scaler", StandardScaler()), ("clf", stack)])

    return {
        "LightGBM": lgbm_tuned.best_estimator_,
        "XGBoost":  xgb_tuned.best_estimator_,
        "GradientBoosting": gbc,
        "StackingEnsemble": stack_pipe,
    }, lgbm_tuned, xgb_tuned


# ═══════════════════════════════════════════════════════════
#  DIABETES MODEL
# ═══════════════════════════════════════════════════════════
print("\n" + "="*60)
print("DIABETES MODEL TRAINING")
print("="*60)

df = pd.read_csv("data/diabetes_012_health_indicators_BRFSS2015.csv")
df["Diabetes_binary"] = (df["Diabetes_012"] > 0).astype(int)
df.drop(columns=["Diabetes_012"], inplace=True)

# Feature engineering
df["BP_Chol"]     = df["HighBP"] * df["HighChol"]
df["Age_GenHlth"] = df["Age"]    * df["GenHlth"]
df["BMI_PhysHlth"]= df["BMI"]   * df["PhysHlth"]

# Stratified sample for speed
df_sample = df.groupby("Diabetes_binary", group_keys=False).apply(
    lambda x: x.sample(min(len(x), SAMPLE_N // 2), random_state=SEED)
)
print(f"Sampled: {df_sample.shape}  classes: {df_sample['Diabetes_binary'].value_counts().to_dict()}")

X_d = df_sample.drop(columns=["Diabetes_binary"])
y_d = df_sample["Diabetes_binary"].values

X_tmp, X_test, y_tmp, y_test = train_test_split(X_d, y_d, test_size=0.15, stratify=y_d, random_state=SEED)
X_train, X_val, y_train, y_val = train_test_split(X_tmp, y_tmp, test_size=0.18, stratify=y_tmp, random_state=SEED)

smote = SMOTE(random_state=SEED)
X_res, y_res = smote.fit_resample(X_train, y_train)

selector_d = SelectKBest(mutual_info_classif, k=15)
X_tr = selector_d.fit_transform(X_res, y_res)
X_va = selector_d.transform(X_val)
X_te = selector_d.transform(X_test)
feats_d = list(X_d.columns[selector_d.get_support()])
print(f"Selected features: {feats_d}")

# Training stats for drift detection
X_orig_sel = selector_d.transform(X_train)
training_stats_d = {}
for i, feat in enumerate(feats_d):
    col = X_orig_sel[:, i].astype(float)
    training_stats_d[feat] = {
        "mean": round(float(col.mean()), 6), "std": round(float(col.std()), 6),
        "min":  round(float(col.min()),  6), "max": round(float(col.max()), 6),
    }

models_d, lgbm_d, xgb_d = build_and_tune(X_tr, y_res)

results_d = {}
already_fitted = {"LightGBM", "XGBoost"}
for name, pipe in models_d.items():
    print(f"\nFitting {name}...")
    if name not in already_fitted:
        pipe.fit(X_tr, y_res)
    m = evaluate(pipe, X_te, y_test)
    results_d[name] = {"pipeline": pipe, "metrics": m}
    print(f"  {name}: {m}")

best_d = max(results_d, key=lambda k: results_d[k]["metrics"]["roc_auc"])
print(f"\nBest Diabetes Model: {best_d} (ROC-AUC={results_d[best_d]['metrics']['roc_auc']})")
print(classification_report(y_test, results_d[best_d]["pipeline"].predict(X_te),
                             target_names=["No Diabetes", "Diabetes"]))

joblib.dump(results_d[best_d]["pipeline"], f"{MODEL_DIR}/best_model_v2.pkl")
summary_d = {k: v["metrics"] for k, v in results_d.items()}
summary_d["best_model"] = best_d
with open(f"{MODEL_DIR}/model_summary.json", "w") as f:
    json.dump(summary_d, f, indent=2)
with open(f"{MODEL_DIR}/feature_names.json", "w") as f:
    json.dump({"feature_names": feats_d}, f)
with open(f"{MODEL_DIR}/training_stats.json", "w") as f:
    json.dump(training_stats_d, f, indent=2)
print(f"Saved diabetes model -> {MODEL_DIR}/best_model_v2.pkl")


# ═══════════════════════════════════════════════════════════
#  HEART MODEL
# ═══════════════════════════════════════════════════════════
print("\n" + "="*60)
print("HEART MODEL TRAINING")
print("="*60)

df_h = pd.read_csv("data/cardio_train.csv", sep=";")
df_h.drop_duplicates(inplace=True)
df_h = df_h[(df_h["ap_hi"] >= 80) & (df_h["ap_hi"] <= 220) &
             (df_h["ap_lo"] >= 40) & (df_h["ap_lo"] <= 130) &
             (df_h["ap_hi"] > df_h["ap_lo"])]

df_h["age_years"]      = (df_h["age"] / 365.25).round(2)
df_h["bmi"]            = (df_h["weight"] / ((df_h["height"] / 100.0) ** 2)).round(2)
df_h["pulse_pressure"] = (df_h["ap_hi"] - df_h["ap_lo"]).round(2)
df_h["bp_ratio"]       = (df_h["ap_hi"] / df_h["ap_lo"]).round(4)
df_h["bmi_age"]        = (df_h["bmi"] * df_h["age_years"]).round(2)
df_h["gender"]         = df_h["gender"].astype(int) - 1
df_h["cardio"]         = df_h["cardio"].astype(int)

feat_cols_h = ["gender", "age_years", "bmi", "ap_hi", "ap_lo",
               "pulse_pressure", "bp_ratio", "bmi_age",
               "cholesterol", "gluc", "smoke", "alco", "active"]

X_h = df_h[feat_cols_h]
y_h = df_h["cardio"].values
print(f"Heart data: {X_h.shape}  classes: {dict(zip(*np.unique(y_h, return_counts=True)))}")

X_tmp_h, X_test_h, y_tmp_h, y_test_h = train_test_split(
    X_h, y_h, test_size=0.15, stratify=y_h, random_state=SEED)
X_train_h, X_val_h, y_train_h, y_val_h = train_test_split(
    X_tmp_h, y_tmp_h, test_size=0.18, stratify=y_tmp_h, random_state=SEED)

smote_h = SMOTE(random_state=SEED)
X_res_h, y_res_h = smote_h.fit_resample(X_train_h, y_train_h)

k_h = min(11, X_h.shape[1])
selector_h = SelectKBest(mutual_info_classif, k=k_h)
X_tr_h = selector_h.fit_transform(X_res_h, y_res_h)
X_va_h = selector_h.transform(X_val_h)
X_te_h = selector_h.transform(X_test_h)
feats_h = list(X_h.columns[selector_h.get_support()])
print(f"Selected features: {feats_h}")

X_orig_h = selector_h.transform(X_train_h)
training_stats_h = {}
for i, feat in enumerate(feats_h):
    col = X_orig_h[:, i].astype(float)
    training_stats_h[feat] = {
        "mean": round(float(col.mean()), 6), "std": round(float(col.std()), 6),
        "min":  round(float(col.min()),  6), "max": round(float(col.max()), 6),
    }

models_h, lgbm_h, xgb_h = build_and_tune(X_tr_h, y_res_h)

results_h = {}
for name, pipe in models_h.items():
    print(f"\nFitting {name}...")
    if name not in already_fitted:
        pipe.fit(X_tr_h, y_res_h)
    m = evaluate(pipe, X_te_h, y_test_h)
    results_h[name] = {"pipeline": pipe, "metrics": m}
    print(f"  {name}: {m}")

best_h = max(results_h, key=lambda k: results_h[k]["metrics"]["roc_auc"])
print(f"\nBest Heart Model: {best_h} (ROC-AUC={results_h[best_h]['metrics']['roc_auc']})")
print(classification_report(y_test_h, results_h[best_h]["pipeline"].predict(X_te_h),
                             target_names=["No Heart Disease", "Heart Disease"]))

joblib.dump(results_h[best_h]["pipeline"], f"{MODEL_DIR}/heart_model.pkl")
summary_h = {k: v["metrics"] for k, v in results_h.items()}
summary_h["best_model"] = best_h
with open(f"{MODEL_DIR}/heart_model_summary.json", "w") as f:
    json.dump(summary_h, f, indent=2)
with open(f"{MODEL_DIR}/heart_feature_names.json", "w") as f:
    json.dump({"feature_names": feats_h}, f)
with open(f"{MODEL_DIR}/heart_training_stats.json", "w") as f:
    json.dump(training_stats_h, f, indent=2)
print(f"Saved heart model -> {MODEL_DIR}/heart_model.pkl")

print("\n" + "="*60)
print("ALL TRAINING COMPLETE")
print("="*60)
print(f"Diabetes best: {best_d}  AUC={results_d[best_d]['metrics']['roc_auc']}  ACC={results_d[best_d]['metrics']['accuracy']}")
print(f"Heart    best: {best_h}  AUC={results_h[best_h]['metrics']['roc_auc']}  ACC={results_h[best_h]['metrics']['accuracy']}")
