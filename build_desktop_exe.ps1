<#
.SYNOPSIS
    Builds the standalone DevGuard.exe Windows application.
#>
$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $repoRoot

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  Building DevGuard Standalone Windows Executable  " -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

# 1. Build Frontend
Write-Host "`n[1/3] Building React Frontend Bundle..." -ForegroundColor Yellow
Set-Location (Join-Path $repoRoot "frontend")
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Frontend build failed"
    exit 1
}

# 2. Package with PyInstaller
Write-Host "`n[2/3] Compiling Standalone Executable with PyInstaller..." -ForegroundColor Yellow
Set-Location (Join-Path $repoRoot "backend")
$pyinstaller = Join-Path $repoRoot "backend\.venv\Scripts\pyinstaller.exe"
& $pyinstaller --noconfirm devguard.spec
if ($LASTEXITCODE -ne 0) {
    Write-Error "PyInstaller build failed"
    exit 1
}

# 3. Done
$exePath = Join-Path $repoRoot "backend\dist\DevGuard\DevGuard.exe"
Write-Host "`n[3/3] Build Complete!" -ForegroundColor Green
Write-Host "Executable is ready at: $exePath" -ForegroundColor Green
Set-Location $repoRoot
