# ─── Stage 1: Train ────────────────────────────────────────────────────────────
FROM python:3.11-slim AS trainer

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY data/       ./data/
COPY ml/         ./ml/
COPY models/     ./models/

# Train to produce best_model_v2.pkl (SMOTE + SelectKBest + 5 models)
RUN python ml/train.py || true


# ─── Stage 2: API ─────────────────────────────────────────────────────────────
FROM python:3.11-slim AS api

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy API source and trained artifacts
COPY api/          ./api/
COPY --from=trainer /app/models/ ./models/

ENV MODEL_DIR=models
ENV PYTHONPATH=/app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
