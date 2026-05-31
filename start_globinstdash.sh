#!/bin/bash

trap 'echo -e "\nShutting down Uvicorn..."; kill $(jobs -p)' EXIT

echo "=== Global Instability Dashboard ==="

if [ ! "$(docker ps -q -f name=globinst-db)" ]; then
  echo "Waking up PostgreSQL database..."
  docker start globinst-db
  sleep 2
else
  echo "Database is already running."
fi

# 3. START THE BACKEND (Added --host 0.0.0.0)
echo "Starting FastAPI Backend..."
source .venv/bin/activate
uvicorn api:app --host 0.0.0.0 --port 8000 --reload &

sleep 2

# 4. START THE FRONTEND (Added --host)
echo "Starting React Frontend..."
cd frontend
rm -rf node_modules/.vite
sleep 2
npm run dev -- --host --force
