#!/usr/bin/env bash
set -euo pipefail

echo "=== NexLedger Production Deploy ==="

# Validate required environment variables
for var in SECRET_KEY DATABASE_URL; do
    if [ -z "${!var:-}" ]; then
        echo "ERROR: $var is not set. Aborting production deploy."
        exit 1
    fi
done

echo "[1/5] Building optimized Docker images..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml build

echo "[2/5] Running database migrations..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm api alembic upgrade head

echo "[3/5] Starting services..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

echo "[4/5] Waiting for health check..."
for i in $(seq 1 60); do
    if curl -sf http://localhost:8000/healthz > /dev/null 2>&1; then
        echo "API is healthy!"
        break
    fi
    echo "Waiting for API... ($i/60)"
    sleep 2
done

echo "[5/5] Running readiness check..."
curl -sf http://localhost:8000/readyz || echo "WARNING: Readiness check failed"

echo ""
echo "=== Production deployment complete ==="
