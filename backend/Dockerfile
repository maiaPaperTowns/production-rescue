FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8080

# Cloud Run injects $PORT (defaults to 8080) and expects the container to bind
# to it; a hardcoded port would make the deploy fail health checks. The demo
# database is ephemeral SQLite re-seeded on every container start, matching
# docker-compose, so no Cloud SQL provisioning is needed for the hackathon deploy.
CMD python seed.py && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}
