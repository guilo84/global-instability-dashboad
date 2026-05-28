#!/bin/bash

# 1. FIXED TYPO: 'trap' ensures background processes die when you exit the script
trap 'echo -e "\nShutting down Uvicorn..."; kill $(jobs -p)' EXIT

echo "=== Global Instability Dashboard ==="

# 2. WAKE THE DB: Ensure the database is running (in case of a reboot)
if [ ! "$(docker ps -q -f name=globinst-db)" ]; then
    echo "Waking up PostgreSQL database..."
    docker start globinst-db
    sleep 2 # Give it a second to accept connections
else
    echo "Database is already running."
fi

# 3. START THE BACKEND
echo "Starting FastAPI Backend..."
source .venv/bin/activate
uvicorn api:app --reload &

# Wait a brief moment to ensure Uvicorn doesn't crash on startup
sleep 2 

# 4. START THE FRONTEND
echo "Starting React Frontend..."
cd frontend
rm -rf node_modules/.vite
sleep 2
npm run dev -- --force
