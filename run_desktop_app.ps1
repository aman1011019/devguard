<#
.SYNOPSIS
    DevGuard Desktop Launcher (PowerShell)
#>
$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$exePath = Join-Path $repoRoot "backend\dist\DevGuard\DevGuard.exe"
$pyPath = Join-Path $repoRoot "backend\.venv\Scripts\python.exe"
$appPy = Join-Path $repoRoot "backend\desktop_app.py"

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  DevGuard - Autonomous Incident & Codebase Scanner  " -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

if (Test-Path $exePath) {
    Write-Host "[OK] Launching DevGuard.exe: $exePath" -ForegroundColor Green
    if ($args.Count -gt 0) {
        & $exePath @args
    } else {
        Start-Process -FilePath $exePath
    }
} else {
    Write-Host "[INFO] DevGuard.exe not found. Launching via Python runtime..." -ForegroundColor Yellow
    & $pyPath $appPy @args
}
