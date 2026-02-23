@echo off
setlocal

set "ROOT_DIR=%~dp0"
set "BACKEND_DIR=%ROOT_DIR%backend"
set "FRONTEND_DIR=%ROOT_DIR%frontend"
set "VENV_ACTIVATE=%BACKEND_DIR%\.venv\Scripts\activate.bat"

if not exist "%VENV_ACTIVATE%" (
  echo Virtual environment not found at "%VENV_ACTIVATE%".
  echo Run setup.bat first.
  exit /b 1
)

if not exist "%FRONTEND_DIR%\package.json" (
  echo Frontend package.json not found in "%FRONTEND_DIR%".
  exit /b 1
)

echo Starting backend API on http://127.0.0.1:8000 ...
start "AI Mock Interviews - Backend" cmd /k "cd /d ""%BACKEND_DIR%"" && call ""%VENV_ACTIVATE%"" && uvicorn main:app --host 127.0.0.1 --port 8000 --reload"

echo Starting frontend on http://localhost:5173 ...
start "AI Mock Interviews - Frontend" cmd /k "cd /d ""%FRONTEND_DIR%"" && npm run dev"

timeout /t 4 /nobreak >nul
start "" "http://localhost:5173"

echo Backend and frontend launched.
exit /b 0
