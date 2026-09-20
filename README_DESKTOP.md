# DevGuard — Quick Start & Usage Guide

## 1. Web Demo Format
The live interactive web application is active on your machine:
- **Web App URL**: [http://127.0.0.1:5173/](http://127.0.0.1:5173/)
- **Codebase Inspector URL**: [http://127.0.0.1:5173/codebase](http://127.0.0.1:5173/codebase)
- **Backend API**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

## 2. Real Product: Standalone Windows Application (`DevGuard.exe`)
The desktop application is compiled and ready in:
`backend\dist\DevGuard\DevGuard.exe`

### How to Launch

#### Option A: One-Click Desktop Launchers
Double-click `run_desktop_app.bat` or run in PowerShell:
```powershell
.\run_desktop_app.ps1
```
This opens the native 1440x920 desktop GUI window with full offline capabilities and native Windows directory selection.

#### Option B: Direct CLI Quick Scan
You can run automated codebase inspection directly from your terminal:
```powershell
.\backend\dist\DevGuard\DevGuard.exe --scan "C:\path\to\your\project"
```

#### Option C: Headless / Daemon Server Mode
```powershell
.\backend\dist\DevGuard\DevGuard.exe --headless --port 8080
```

---

## 3. How to Rebuild the Executable
If you modify code in `frontend/` or `backend/`, simply run:
```powershell
.\build_desktop_exe.ps1
```
or double-click `build_desktop_exe.bat`.
