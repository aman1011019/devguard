@echo off
title DevGuard Desktop
echo ====================================================
echo  DevGuard - Autonomous Incident & Codebase Scanner
echo ====================================================
echo.

set SCRIPT_DIR=%~dp0
set EXE_PATH=%SCRIPT_DIR%backend\dist\DevGuard\DevGuard.exe
set PY_PATH=%SCRIPT_DIR%backend\.venv\Scripts\python.exe
set APP_PY=%SCRIPT_DIR%backend\desktop_app.py

if exist "%EXE_PATH%" (
    echo [OK] Launching compiled DevGuard.exe...
    start "" "%EXE_PATH%" %*
) else (
    echo [INFO] DevGuard.exe not found. Launching via Python runtime...
    "%PY_PATH%" "%APP_PY%" %*
)
