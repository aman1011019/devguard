@echo off
title Build DevGuard Executable
echo ====================================================
echo   Building DevGuard Standalone Windows Executable   
echo ====================================================

set SCRIPT_DIR=%~dp0

echo [1/2] Building React frontend...
cd /d "%SCRIPT_DIR%frontend"
call npm run build
if %ERRORLEVEL% neq 0 (
    echo Frontend build failed!
    pause
    exit /b 1
)

echo.
echo [2/2] Running PyInstaller...
cd /d "%SCRIPT_DIR%backend"
call ".\.venv\Scripts\pyinstaller.exe" --noconfirm devguard.spec
if %ERRORLEVEL% neq 0 (
    echo PyInstaller build failed!
    pause
    exit /b 1
)

echo.
echo ====================================================
echo Build Successful!
echo Executable located at:
echo %SCRIPT_DIR%backend\dist\DevGuard\DevGuard.exe
echo ====================================================
pause
