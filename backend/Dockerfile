FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libgomp1 && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

RUN python train_model.py

EXPOSE 10000

CMD ["gunicorn", "-w", "2", "-b", "0.0.0.0:10000", "--timeout", "120", "app:app"]
