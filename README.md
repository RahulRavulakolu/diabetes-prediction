# DiabetesRisk AI — MLOps Workflow

End-to-end diabetes risk prediction project built around a BRFSS 2015 dataset, a scikit-learn training pipeline, a FastAPI inference service, a React frontend, MLflow experiment tracking, Docker-based deployment, and GitHub Actions automation.

## 01 — Data Pipeline

The project starts from a single source of truth: `data/diabetes_012_health_indicators_BRFSS2015.csv`.

The training flow in [ml/train.py](ml/train.py) does the following:

1. Loads the CSV with pandas.
2. Cleans missing values when present.
3. Binarizes `Diabetes_012` into a target label.
4. Splits data with a stratified train/test split.
5. Saves feature names to `models/feature_names.json`.

The dataset includes 253,680 rows and 21 health indicators covering lifestyle, medical history, and demographics.

## 02 — Model Training

The current pipeline trains six models:

- Logistic Regression
- Decision Tree
- Random Forest
- Gradient Boosting
- SVM
- KNN

Each model is wrapped in a scikit-learn `Pipeline` with `StandardScaler` so preprocessing stays consistent during training and inference. Training runs are tracked in MLflow with parameters, metrics, and registered model artifacts.

The best model is selected by F1 score, which is more suitable than accuracy for this imbalanced medical classification problem.

## 03 — Evaluation & Model Selection

The training script evaluates every model on the test split and records:

- Accuracy
- Precision
- Recall
- F1 score
- ROC-AUC

The winning pipeline is saved to `models/best_model.joblib`, and the full score summary is written to `models/model_summary.json`.

## 04 — System Architecture

The runtime architecture is intentionally simple:

1. The React frontend collects health indicators.
2. The frontend sends a `POST /predict` request to FastAPI.
3. FastAPI loads the saved pipeline from `models/best_model.joblib`.
4. The model returns a prediction and probabilities.
5. The frontend shows the result as a clinical-style assessment.

The backend surface in [api/main.py](api/main.py) exposes:

- `GET /health`
- `GET /model-info`
- `POST /predict`

## 05 — MLOps Stack

The supporting tooling is designed for repeatability:

- MLflow tracks experiments, metrics, and registered artifacts.
- Docker and Docker Compose package the services for local and deployment use.
- GitHub Actions is intended to run tests, trigger training, and publish the build.

The key runtime environment variables are:

- `DATA_PATH`
- `MODEL_DIR`
- `MLFLOW_TRACKING_URI`
- `VITE_API_URL`

## 06 — Frontend Output

The current React app in [frontend/src/App.jsx](frontend/src/App.jsx) presents a compact assessment UI rather than a broad dashboard. It focuses on:

- entering the most relevant health indicators
- submitting them to the API
- showing the prediction state
- displaying the returned risk label and probability

This keeps the frontend lightweight while leaving the actual inference logic in the backend.

## 07 — Tech Stack

Core technologies used in this project:

- Python 3.11
- pandas
- scikit-learn
- MLflow
- FastAPI
- Pydantic
- Uvicorn
- React
- Vite
- Docker
- GitHub Actions

## Project Layout

```text
diabetes-mlops/
├── data/                         # BRFSS 2015 CSV dataset
├── ml/train.py                   # Training and MLflow logging pipeline
├── api/main.py                   # FastAPI inference service
├── frontend/                     # React + Vite application
├── models/                       # Saved model artifacts and summaries
├── tests/                        # API and training tests
├── docker-compose.yml            # Local service orchestration
├── Dockerfile                    # Container build definition
└── requirements.txt              # Python dependencies
```

## Local Setup

### Python environment

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

### Train the model

```bash
python ml/train.py
```

### Start the API

```bash
uvicorn api.main:app --reload --port 8000
```

### Start the frontend

```bash
cd frontend
npm install
npm run dev
```

### Start MLflow

```bash
mlflow ui --port 5000
```

### Run the full stack

```bash
docker compose up --build
```

## API Behavior

### `GET /health`

Returns whether the service is running and whether the model loaded successfully.

### `GET /model-info`

Returns the latest model summary produced by the training pipeline.

### `POST /predict`

Accepts BRFSS health indicators and returns:

- `prediction`
- `label`
- `probability_no`
- `probability_yes`
- `risk_level`
- `model_used`

Risk levels are mapped as:

- Low: below 25%
- Moderate: 25% to below 50%
- High: 50% to below 75%
- Very High: 75% and above

## Testing

```bash
pytest tests/ -v
```

The tests cover API responses, model loading, and training pipeline behavior.

## Disclaimer

This project is for educational and research purposes only. It is not a medical device and should not be used for clinical diagnosis or treatment decisions.

## License

MIT License. See `LICENSE` if present in the repository.