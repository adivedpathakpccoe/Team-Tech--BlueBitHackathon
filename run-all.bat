@echo off
echo Starting Gyaansetu...

REM ---------- activate python venv ----------
IF EXIST ".venv\Scripts\activate.bat" (
    call .venv\Scripts\activate.bat
    echo venv activated
) ELSE (
    echo warning: .venv not found, using system python
)

REM ---------- backend ----------
echo.
echo [backend] installing python dependencies...
cd gyaansetu-api
python -m pip install -e ".[dev]"

echo [backend] starting uvicorn on port 8000...
start "backend" cmd /k uvicorn app.main:app --reload

REM ---------- frontend ----------
echo.
cd ..\gyaansetu
echo [frontend] installing npm packages...
npm install

echo [frontend] starting next dev server on port 3000...
start "frontend" cmd /k npm run dev

echo.
echo Both services started.
pause