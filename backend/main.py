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

from app.api import (
    codebase,
    demo,
    events,
    github,
    health,
    incidents,
    logs,
    office_kit,
    search,
    services,
    telemetry,
    voice,
    webhooks,
    ws,
)
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
    description="AI Production Incident Investigator — real-time backend engine",
    version="2.0.0",
    lifespan=lifespan,
)

# ── CORS ────────────────────────────────────────────────────────────────────────
_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "https://devguard.pages.dev",
]
for origin in settings.cors_origin_list:
    if origin not in _origins and origin != "*":
        _origins.append(origin)
if "*" in settings.cors_origin_list and settings.app_env != "production":
    _origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True if "*" not in _origins else False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(health.router)
app.include_router(incidents.router)
app.include_router(demo.router)
app.include_router(services.router)
app.include_router(search.router)
app.include_router(events.router)
app.include_router(webhooks.router)
app.include_router(logs.router)
app.include_router(telemetry.router)
app.include_router(voice.router)
app.include_router(office_kit.router)
app.include_router(ws.router)
app.include_router(codebase.router)
app.include_router(github.router)


import sys
from pathlib import Path
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

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


@app.api_route("/{full_path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
async def catch_all(request: Request, full_path: str):
    if full_path.startswith("api/") or full_path in ("docs", "redoc", "openapi.json"):
        return JSONResponse(
            status_code=404,
            content={
                "success": False,
                "error": {
                    "code": "NOT_FOUND",
                    "message": f"Endpoint not found: {request.method} /{full_path}",
                    "details": f"No route registered for {request.method} /{full_path}",
                },
            },
        )
    if request.method != "GET":
        return JSONResponse(
            status_code=405,
            content={
                "success": False,
                "error": {
                    "code": "METHOD_NOT_ALLOWED",
                    "message": f"Method {request.method} not allowed on route /{full_path}",
                    "details": "Static resources only support GET requests",
                },
            },
            headers={"Allow": "GET"},
        )
    file_path = _DIST_DIR / full_path
    if file_path.is_file():
        return FileResponse(file_path)
    if (_DIST_DIR / "index.html").exists():
        return FileResponse(_DIST_DIR / "index.html")
    return JSONResponse(
        status_code=404,
        content={
            "success": False,
            "error": {
                "code": "NOT_FOUND",
                "message": "Resource not found",
                "details": f"File /{full_path} not found",
            },
        },
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """Format HTTP exceptions into consistent error response structures."""
    if exc.status_code == 405:
        return JSONResponse(
            status_code=405,
            content={
                "success": False,
                "error": {
                    "code": "METHOD_NOT_ALLOWED",
                    "message": "The investigation endpoint received an unsupported HTTP method.",
                    "details": f"Received {request.method} {request.url.path}. Expected POST /api/incidents/{{id}}/investigate",
                },
            },
            headers=dict(exc.headers or {"Allow": "POST"}),
        )

    code = "NOT_FOUND" if exc.status_code == 404 else f"HTTP_{exc.status_code}"
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": code,
                "message": str(exc.detail),
                "details": str(exc.detail),
            },
            "detail": str(exc.detail),
        },
        headers=dict(exc.headers or {}),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Never leak raw stack traces to the client."""
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "Internal server error occurred.",
                "details": str(exc),
            },
            "detail": "Internal server error",
            "path": request.url.path,
        },
    )
