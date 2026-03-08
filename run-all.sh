#!/usr/bin/env bash

# run-all.sh
# Bootstraps dependencies and starts both frontend and backend services
# Usage: ./run-all.sh
# The script will try to activate a venv at .venv if present; otherwise
# it just uses whatever "python" is on PATH.
# Node.js must be installed and available as "npm".

set -e

# activate python virtualenv if available
if [ -f ".venv/bin/activate" ]; then
    # shellcheck disable=SC1091
    source .venv/bin/activate
    echo "(venv) activated .venv"
else
    echo "warning: .venv not found, using system python"
fi

# ---------- backend ----------
echo "\n[backend] installing python dependencies..."
cd gyaansetu-api
python -m pip install -e ".[dev]"

echo "[backend] starting uvicorn (app.main:app) on port 8000..."
# run in background so frontend can start too
uvicorn app.main:app --reload &
backend_pid=$!

# ---------- frontend ----------
echo "\n[frontend] installing npm packages..."
cd ../gyaansetu
npm install

echo "[frontend] starting next dev server on port 3000..."
npm run dev &
frontend_pid=$!

# wait for both processes to exit
wait $backend_pid
wait $frontend_pid
