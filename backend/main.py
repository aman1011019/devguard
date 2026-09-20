"""DevGuard backend — FastAPI application entrypoint.

Run (from the ``backend`` directory):

    uvicorn main:app --reload --port 8000

Boots with zero configuration in Demo Mode: SQLite is created on first run and
a couple of resolved incidents are seeded for the history view.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import codebase, demo, health, incidents, office_kit, voice, ws
from app.core.config import settings
from app.core.database import init_db, session_scope
from app.services.incident_service import seed_historical

logger = logging.getLogger("devguard")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    with session_scope() as db:
        seed_historical(db)
    logger.info(
        "DevGuard ready · demo_mode=%s · ai_enabled=%s · db=%s",
        settings.demo_mode,
        settings.ai_enabled,
        settings.database_url,
    )
    yield


app = FastAPI(
    title="DevGuard API",
    description="AI Production Incident Investigator — backend engine",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ────────────────────────────────────────────────────────────────────────
_origins = settings.cors_origin_list
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials="*" not in _origins,  # wildcard + credentials is invalid
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(health.router)
app.include_router(incidents.router)
app.include_router(demo.router)
app.include_router(voice.router)
app.include_router(office_kit.router)
app.include_router(ws.router)
app.include_router(codebase.router)


import sys
from pathlib import Path
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
    _BASE_DIR = Path(sys._MEIPASS)
    _DIST_DIR = _BASE_DIR / "frontend" / "dist"
else:
    _BASE_DIR = Path(__file__).resolve().parents[1]
    _DIST_DIR = _BASE_DIR / "frontend" / "dist"

if _DIST_DIR.exists() and (_DIST_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=_DIST_DIR / "assets"), name="assets")

@app.get("/")
def root(request: Request):
    if _DIST_DIR.exists() and (_DIST_DIR / "index.html").exists() and "text/html" in request.headers.get("accept", ""):
        return FileResponse(_DIST_DIR / "index.html")
    return {
        "app": "DevGuard",
        "status": "ok",
        "docs": "/docs",
        "health": "/api/health",
        "demo_mode": settings.demo_mode,
    }


@app.get("/{full_path:path}")
def catch_all(request: Request, full_path: str):
    if full_path.startswith("api/") or full_path in ("docs", "redoc", "openapi.json"):
        return JSONResponse(status_code=404, content={"detail": "Not found"})
    file_path = _DIST_DIR / full_path
    if file_path.is_file():
        return FileResponse(file_path)
    if (_DIST_DIR / "index.html").exists():
        return FileResponse(_DIST_DIR / "index.html")
    return JSONResponse(status_code=404, content={"detail": "Not found"})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Never leak raw stack traces to the client."""
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "path": request.url.path},
    )
