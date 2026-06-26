#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

pip3 install -q -r requirements.txt 2>/dev/null || true

echo "Starting backend..."
uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload --log-level warning &
BACKEND_PID=$!

sleep 2

python3 scripts/seed.py

echo "Starting frontend..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT INT TERM

echo ""
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:8000"
echo ""

wait
