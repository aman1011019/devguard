# DevGuard Startup Script
# Starts both FastAPI backend and Vite frontend for local development

$ErrorActionPreference = "Continue"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "    DevGuard Autonomous Incident Platform  " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$WorkspaceRoot = $PSScriptRoot
$BackendDir = Join-Path $WorkspaceRoot "backend"
$FrontendDir = Join-Path $WorkspaceRoot "frontend"
$PythonExe = Join-Path $BackendDir ".venv\Scripts\python.exe"

# 1. Stop any existing listeners on ports 8000 or 5173 if running
Write-Host "`n[1/3] Checking ports 8000 and 5173..." -ForegroundColor Yellow
foreach ($port in @(8000, 5173)) {
    $proc = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
    if ($proc) {
        Write-Host "Terminating previous process on port $port (PID: $proc)..." -ForegroundColor Gray
        Stop-Process -Id $proc -Force -ErrorAction SilentlyContinue
    }
}

# 2. Launch FastAPI Backend
Write-Host "`n[2/3] Starting FastAPI backend on port 8000..." -ForegroundColor Yellow
$BackendProcess = Start-Process `
    -FilePath $PythonExe `
    -ArgumentList "-m", "uvicorn", "main:app", "--port", "8000", "--host", "127.0.0.1" `
    -WorkingDirectory $BackendDir `
    -PassThru `
    -WindowStyle Hidden

Start-Sleep -Seconds 3

# Verify backend health
try {
    $response = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/health" -Method Get -TimeoutSec 5
    Write-Host "Backend online · Health: $($response.system_health)% · Services monitored: $($response.services_monitored)" -ForegroundColor Green
} catch {
    Write-Host "Backend starting up (will be ready shortly)..." -ForegroundColor Yellow
}

# 3. Launch Vite Frontend Dev Server
Write-Host "`n[3/3] Starting Vite frontend server on port 5173..." -ForegroundColor Yellow
$FrontendProcess = Start-Process `
    -FilePath "cmd.exe" `
    -ArgumentList "/c", "npm run dev -- --host 127.0.0.1 --port 5173" `
    -WorkingDirectory $FrontendDir `
    -PassThru `
    -WindowStyle Hidden

Start-Sleep -Seconds 3

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "  DevGuard is LIVE and Operational!       " -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Frontend:  http://127.0.0.1:5173" -ForegroundColor White
Write-Host "  Backend:   http://127.0.0.1:8000" -ForegroundColor White
Write-Host "  API Docs:  http://127.0.0.1:8000/docs" -ForegroundColor White
Write-Host "  WebSocket: ws://127.0.0.1:8000/ws/incidents/0" -ForegroundColor White
Write-Host "==========================================`n" -ForegroundColor Cyan