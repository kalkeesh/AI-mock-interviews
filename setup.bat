@echo off
setlocal

set "ROOT_DIR=%~dp0"
set "BACKEND_DIR=%ROOT_DIR%backend"
set "FRONTEND_DIR=%ROOT_DIR%frontend"
set "VENV_DIR=%BACKEND_DIR%\.venv"

echo [1/4] Checking backend folder...
if not exist "%BACKEND_DIR%" (
  echo Backend folder not found at "%BACKEND_DIR%".
  exit /b 1
)

echo [2/4] Creating virtual environment in backend\.venv (if needed)...
if not exist "%VENV_DIR%\Scripts\activate.bat" (
  python -m venv "%VENV_DIR%"
  if errorlevel 1 (
    echo Failed to create virtual environment.
    exit /b 1
  )
)

echo [3/4] Installing backend Python dependencies...
call "%VENV_DIR%\Scripts\activate.bat"
python -m pip install --upgrade pip
if errorlevel 1 (
  echo Failed to upgrade pip.
  exit /b 1
)

pip install -r "%BACKEND_DIR%\requirements.txt"
if errorlevel 1 (
  echo Failed to install backend requirements.
  exit /b 1
)

echo [4/4] Installing frontend node modules...
if not exist "%FRONTEND_DIR%" (
  echo Frontend folder not found at "%FRONTEND_DIR%".
  exit /b 1
)

pushd "%FRONTEND_DIR%"
npm install
if errorlevel 1 (
  popd
  echo Failed to install frontend dependencies.
  exit /b 1
)
popd

echo Setup completed successfully.
exit /b 0
