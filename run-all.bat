@echo off
setlocal EnableExtensions EnableDelayedExpansion

echo Starting Gyaansetu...

set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

if "%FRONTEND_PORT%"=="" set "FRONTEND_PORT=3000"
if "%BACKEND_PORT%"=="" set "BACKEND_PORT=8000"
if "%EXTRACTOR_PORT%"=="" set "EXTRACTOR_PORT=8001"

where python >nul 2>&1
if errorlevel 1 (
    echo error: python not found in PATH
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo error: npm not found in PATH
    exit /b 1
)

where uvicorn >nul 2>&1
if errorlevel 1 (
    echo error: uvicorn not found in PATH
    echo hint: activate your venv or install backend dependencies first
    exit /b 1
)

if exist ".venv\Scripts\activate.bat" (
    call .venv\Scripts\activate.bat
    echo venv activated
) else (
    echo warning: .venv not found, using system python
)

if not "%SKIP_INSTALL%"=="1" (
    echo.
    echo [backend] installing python dependencies...
    pushd gyaansetu-api
    python -m pip install -e ".[dev]"
    if errorlevel 1 exit /b 1
    popd

    echo.
    echo [frontend] installing npm packages...
    pushd gyaansetu
    if exist package-lock.json (
        call npm ci
    ) else (
        call npm install
    )
    if errorlevel 1 exit /b 1
    popd

    echo.
    echo [extractor] installing python dependencies...
    pushd gyaansetu-extractor
    python -m pip install -r requirements.txt
    if errorlevel 1 exit /b 1
    popd
)

echo.
echo [backend] starting uvicorn on port %BACKEND_PORT%...
start "backend" cmd /k "cd /d "%ROOT_DIR%gyaansetu-api" && uvicorn app.main:app --reload --host 0.0.0.0 --port %BACKEND_PORT%"

echo.
echo [frontend] starting next dev server on port %FRONTEND_PORT%...
start "frontend" cmd /k "cd /d "%ROOT_DIR%gyaansetu" && npm run dev -- --port %FRONTEND_PORT%"

echo.
echo [extractor] starting uvicorn on port %EXTRACTOR_PORT%...
start "extractor" cmd /k "cd /d "%ROOT_DIR%gyaansetu-extractor" && uvicorn main:app --reload --host 0.0.0.0 --port %EXTRACTOR_PORT%"

echo.
echo Services started:
echo backend:   http://localhost:%BACKEND_PORT%
echo frontend:  http://localhost:%FRONTEND_PORT%
echo extractor: http://localhost:%EXTRACTOR_PORT%

endlocal