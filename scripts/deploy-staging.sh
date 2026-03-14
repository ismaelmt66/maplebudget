#!/usr/bin/env bash
set -euo pipefail

echo "=== NexLedger Staging Deploy ==="

if [ ! -f ".env" ]; then
    echo "ERROR: .env file not found. Copy .env.example and configure it."
    exit 1
fi

echo "[1/4] Building Docker images..."
docker compose build --no-cache

echo "[2/4] Running database migrations..."
docker compose run --rm api alembic upgrade head

echo "[3/4] Starting services..."
docker compose up -d

echo "[4/4] Waiting for health check..."
for i in $(seq 1 30); do
    if curl -sf http://localhost:8000/healthz > /dev/null 2>&1; then
        echo "API is healthy!"
        break
    fi
    echo "Waiting for API... ($i/30)"
    sleep 2
done

echo ""
echo "=== Staging deployment complete ==="
echo "  API:  http://localhost:8000/docs"
echo "  Web:  http://localhost:3000"
echo "  DB:   localhost:5432"
