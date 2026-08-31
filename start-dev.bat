@echo off
REM start-dev.bat - Windows double-click startup
REM Calls PowerShell script with correct execution policy
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-dev.ps1"
if errorlevel 1 (
  echo.
  echo Failed to start. Try manual:
  echo   python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
  echo   npm --prefix frontend run dev
  pause
)
