# Bluebit

Run the full stack (frontend + backend) with a single script.

## Prerequisites

- Node.js 18+
- Python 3.10+
- `pip`

## Quick Start

```bash
# from repository root
chmod +x run-all.sh
./run-all.sh
```

This script installs dependencies and starts:

- Frontend (Next.js): `http://localhost:3000`
- Backend (FastAPI/Uvicorn): `http://localhost:8000`

## Run Services Manually

If you want separate terminals:

### Frontend

```bash
cd gyaansetu
npm install
npm run dev
```

### Backend

```bash
cd gyaansetu-api
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Notes

- If `run-all.sh` is not executable, run `chmod +x run-all.sh` once.
- If a port is already in use, stop the process using it or change the port in the launch command.