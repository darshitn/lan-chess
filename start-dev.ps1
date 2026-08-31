# start-dev.ps1 - Single-command Windows dev startup
# Usage: powershell -ExecutionPolicy Bypass -File ./start-dev.ps1
# or: npm run dev  (from repo root, calls this script)

$ErrorActionPreference = "Stop"
# Do not make native command non-zero exit a terminating error (needed for "import fastapi" check)
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
  $PSNativeCommandUseErrorActionPreference = $false
}
$root = $PSScriptRoot
Set-Location $root

function Write-Status($msg, $color="Cyan") { Write-Host $msg -ForegroundColor $color }
function Test-Command($cmd) { Get-Command $cmd -ErrorAction SilentlyContinue }

# 0) Checks
Write-Status "== Multi-Agent Workspace - dev startup ==" White
if (-not (Test-Command python)) { Write-Host "ERROR: python not found on PATH" -ForegroundColor Red; exit 1 }
if (-not (Test-Command npm)) { Write-Host "ERROR: npm not found" -ForegroundColor Red; exit 1 }

# 1) Env files
if (-not (Test-Path ".env")) {
  Write-Status "Creating .env from .env.example..."
  Copy-Item ".env.example" ".env" -Force
} else { Write-Status ".env exists" DarkGray }
if (-not (Test-Path "frontend\.env")) {
  Write-Status "Creating frontend\.env..."
  @("VITE_API_BASE_URL=http://127.0.0.1:8000", "VITE_APP_NAME=Multi-Agent AI Workspace") | Set-Content "frontend\.env"
}

# 2) Python venv check (optional)
$venvPython = ".\.venv\Scripts\python.exe"
$pythonCmd = "python"
if (Test-Path $venvPython) {
  Write-Status "Using venv: $venvPython" Green
  $pythonCmd = $venvPython
  # Verify venv has deps, fallback to system python if not
  $oldErr = $ErrorActionPreference; $ErrorActionPreference = "Continue"
  & $pythonCmd -c "import fastapi" 2>&1 | Out-Null
  $exit = $LASTEXITCODE
  $ErrorActionPreference = $oldErr
  if ($exit -ne 0) {
    Write-Status "Venv missing deps, trying system python..." Yellow
    $pythonCmd = "python"
  }
} else {
  Write-Status "No .venv found - using system python (consider: python -m venv .venv; .\.venv\Scripts\Activate.ps1; pip install -r backend/requirements.txt)" Yellow
}

# 3) Install check (fast)
Write-Status "Checking backend deps..."
$oldErr = $ErrorActionPreference; $ErrorActionPreference = "Continue"
& $pythonCmd -c "import fastapi" 2>&1 | Out-Null
$exit = $LASTEXITCODE
$ErrorActionPreference = $oldErr
if ($exit -ne 0) {
  Write-Host "Installing backend deps..." -ForegroundColor Yellow
  & $pythonCmd -m pip install -r backend/requirements.txt
  if ($LASTEXITCODE -ne 0) { Write-Host "pip install failed" -ForegroundColor Red; exit 1 }
}
if (-not (Test-Path "frontend\node_modules")) {
  Write-Host "Installing frontend deps..." -ForegroundColor Yellow
  npm --prefix frontend install
}

# 4) Start backend
Write-Status "Starting backend on http://127.0.0.1:8000 ..." Green
$backendArgs = "-m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload"
$backend = Start-Process -FilePath $pythonCmd -ArgumentList $backendArgs.Split(" ") -PassThru
Start-Sleep -Seconds 3
if ($backend.HasExited) {
  Write-Host "Backend failed to start - check error above. Try: python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000" -ForegroundColor Red
  exit 1
}
# health probe
try {
  $h = curl.exe -s http://127.0.0.1:8000/api/health 2>&1 | ConvertFrom-Json
  Write-Status "Backend: $($h.status) v$($h.version) ($($h.environment)) - http://127.0.0.1:8000/api/health  [OK]" Green
  Write-Status "Swagger: http://127.0.0.1:8000/docs" DarkGray
} catch {
  Write-Status "Backend started but /api/health not yet ready - waiting 2s..." Yellow
  Start-Sleep -Seconds 2
}

# 5) Start frontend
Write-Status "Starting frontend on http://localhost:5173 ..." Green
# Use cmd /c for npm.cmd on Windows
$frontend = Start-Process -FilePath "cmd" -ArgumentList "/c","npm","--prefix","frontend","run","dev" -PassThru

Write-Status "" White
Write-Status "Both servers launched:" White
Write-Host "  Backend  http://127.0.0.1:8000  (health: /api/health)" -ForegroundColor Cyan
Write-Host "  Frontend http://localhost:5173" -ForegroundColor Cyan
Write-Host "  Frontend shows Backend: CONNECTED when both are up - click Retry if needed." -ForegroundColor DarkGray
Write-Host ""
Write-Host "To stop: close the two new windows or press Ctrl+C in this window (then run: taskkill /F /IM python.exe; taskkill /F /IM node.exe if needed)" -ForegroundColor Yellow
Write-Host ""
Write-Host "Logs: backend window shows uvicorn, frontend window shows vite." -ForegroundColor DarkGray

# Optional: wait and show status
Start-Sleep -Seconds 2
try { $b = curl.exe -s http://127.0.0.1:8000/api/health 2>&1; Write-Status "Health check: $b" DarkGray } catch {}

# Keep this window open so user sees status; do not exit immediately
Write-Status "Dev startup script done. Leave this window open." DarkGray
