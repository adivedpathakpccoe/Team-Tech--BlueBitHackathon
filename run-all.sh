#!/usr/bin/env bash

# run-all.sh
# Bootstraps dependencies and starts frontend, backend, and extractor.
#
# Optional env vars:
# - SKIP_INSTALL=1                 Skip dependency installs
# - FRONTEND_PORT=3000            Next.js port
# - BACKEND_PORT=8000             FastAPI backend port
# - EXTRACTOR_PORT=8001           Extractor FastAPI port
# - GYAANSETU_DEV=1               Use uvicorn --reload for backend (default: 1)

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR"
BACKEND_DIR="$ROOT_DIR/gyaansetu-api"
FRONTEND_DIR="$ROOT_DIR/gyaansetu"
EXTRACTOR_DIR="$ROOT_DIR/gyaansetu-extractor"

FRONTEND_PORT="${FRONTEND_PORT:-3000}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
EXTRACTOR_PORT="${EXTRACTOR_PORT:-8001}"
GYAANSETU_DEV="${GYAANSETU_DEV:-1}"

backend_pid=""
frontend_pid=""
extractor_pid=""

log() {
    printf '%s\n' "$*"
}

require_cmd() {
    local cmd="$1"
    if ! command -v "$cmd" >/dev/null 2>&1; then
        log "error: required command not found: $cmd"
        exit 1
    fi
}

cleanup() {
    local code=$?
    for pid in "$backend_pid" "$frontend_pid" "$extractor_pid"; do
        if [ -n "$pid" ] && kill -0 "$pid" >/dev/null 2>&1; then
            kill "$pid" >/dev/null 2>&1 || true
        fi
    done
    exit "$code"
}

wait_for_any_exit() {
    while :; do
        for pid in "$backend_pid" "$frontend_pid" "$extractor_pid"; do
            if [ -n "$pid" ] && ! kill -0 "$pid" >/dev/null 2>&1; then
                wait "$pid" || return $?
                return 0
            fi
        done
        sleep 1
    done
}

trap cleanup EXIT INT TERM

require_cmd npm
require_cmd uvicorn

if command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
    PYTHON_BIN="python"
else
    log "error: python3/python not found"
    exit 1
fi

if [ -f "$ROOT_DIR/.venv/bin/activate" ]; then
    # shellcheck disable=SC1091
    source "$ROOT_DIR/.venv/bin/activate"
    log "(venv) activated .venv"
else
    log "warning: .venv not found, using system python"
fi

if [ ! -d "$BACKEND_DIR" ] || [ ! -d "$FRONTEND_DIR" ] || [ ! -d "$EXTRACTOR_DIR" ]; then
    log "error: expected project directories are missing"
    exit 1
fi

if [ "${SKIP_INSTALL:-0}" != "1" ]; then
    log ""
    log "[backend] installing python dependencies..."
    cd "$BACKEND_DIR"
    "$PYTHON_BIN" -m pip install -e ".[dev]"

    log ""
    log "[frontend] installing npm packages..."
    cd "$FRONTEND_DIR"
    if [ -f package-lock.json ]; then
        npm ci
    else
        npm install
    fi

    log ""
    log "[extractor] installing python dependencies..."
    cd "$EXTRACTOR_DIR"
    "$PYTHON_BIN" -m pip install -r requirements.txt
fi

log ""
log "[backend] starting uvicorn on port $BACKEND_PORT..."
cd "$BACKEND_DIR"
if [ "$GYAANSETU_DEV" = "1" ]; then
    uvicorn app.main:app --reload --host 0.0.0.0 --port "$BACKEND_PORT" &
else
    uvicorn app.main:app --workers 4 --host 0.0.0.0 --port "$BACKEND_PORT" &
fi
backend_pid=$!

log ""
log "[frontend] starting next dev server on port $FRONTEND_PORT..."
cd "$FRONTEND_DIR"
npm run dev -- --port "$FRONTEND_PORT" &
frontend_pid=$!

log ""
log "[extractor] starting uvicorn on port $EXTRACTOR_PORT..."
cd "$EXTRACTOR_DIR"
uvicorn main:app --reload --host 0.0.0.0 --port "$EXTRACTOR_PORT" &
extractor_pid=$!

log ""
log "services started"
log "backend:   http://localhost:$BACKEND_PORT"
log "frontend:  http://localhost:$FRONTEND_PORT"
log "extractor: http://localhost:$EXTRACTOR_PORT"
log ""
log "Press Ctrl+C to stop all services."

wait_for_any_exit
