# ─── Single Stage: API with pre-trained models ────────────────────────────────
# Models are already trained and committed to the repo.
# No training stage needed — just copy and serve.
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy API source
COPY api/       ./api/

# Copy pre-trained model artifacts directly from repo
COPY models/    ./models/

# Copy database directory if exists
COPY database/  ./database/

ENV MODEL_DIR=models
ENV PYTHONPATH=/app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
