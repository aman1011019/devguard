"""Codebase Inspector API endpoints for DevGuard.

Supports uploading project zip files or selecting local filesystem directories.
Executes autonomous code scanning, identifies N+1 queries, leaks, and security flaws,
and generates ready-to-apply diff patches.
"""
from __future__ import annotations

import io
import shutil
import zipfile
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

from app.services.codebase_scanner import get_scan, scan_directory

router = APIRouter(prefix="/api/codebase", tags=["codebase"])

_BACKEND_DIR = Path(__file__).resolve().parents[2]
_UPLOAD_DIR = _BACKEND_DIR / ".workspaces" / "uploads"
_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


class LocalScanRequest(BaseModel):
    path: str


@router.get("/scan")
def scan_workspace() -> dict[str, Any]:
    """Scan the current workspace safely (Section 41 specification)."""
    workspace_root = _BACKEND_DIR.parent
    ignored_dirs = {".git", "node_modules", ".venv", "venv", "dist", "build", "__pycache__", ".pytest_cache", ".claude"}
    secret_patterns = {".env", "id_rsa", "id_ed25519", "key.pem", "token", "credentials"}

    ext_to_lang = {
        ".java": "Java",
        ".ts": "TypeScript",
        ".tsx": "TypeScript",
        ".js": "JavaScript",
        ".jsx": "JavaScript",
        ".py": "Python",
        ".json": "JSON",
        ".css": "CSS",
        ".html": "HTML",
        ".sql": "SQL",
        ".md": "Markdown",
        ".yml": "YAML",
        ".yaml": "YAML",
    }

    file_count = 0
    dir_count = 0
    languages: dict[str, int] = {}

    try:
        for item in workspace_root.rglob("*"):
            parts = item.relative_to(workspace_root).parts
            if any(p in ignored_dirs or p.startswith(".") for p in parts[:-1]):
                continue
            if item.is_dir():
                if item.name not in ignored_dirs and not item.name.startswith("."):
                    dir_count += 1
            elif item.is_file():
                if any(s in item.name.lower() for s in secret_patterns):
                    continue
                file_count += 1
                ext = item.suffix.lower()
                if ext in ext_to_lang:
                    lang = ext_to_lang[ext]
                    languages[lang] = languages.get(lang, 0) + 1
    except Exception:
        pass

    return {
        "files": file_count,
        "languages": dict(sorted(languages.items(), key=lambda x: x[1], reverse=True)),
        "directories": dir_count,
    }


@router.post("/upload")
async def upload_codebase(file: UploadFile = File(...)) -> dict[str, Any]:
    """Upload a zipped codebase for automated autonomous inspection."""
    if not file.filename or not file.filename.endswith(".zip"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a .zip archive of your project repository",
        )

    content = await file.read()
    try:
        zf = zipfile.ZipFile(io.BytesIO(content))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid zip archive: {exc}")

    import uuid
    dest_id = f"upload_{uuid.uuid4().hex[:8]}"
    extract_path = _UPLOAD_DIR / dest_id
    extract_path.mkdir(parents=True, exist_ok=True)

    try:
        zf.extractall(extract_path)
    except Exception as exc:
        shutil.rmtree(extract_path, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"Failed to extract zip: {exc}")

    # If the zip has a single root folder, scan that
    children = [c for c in extract_path.iterdir() if c.is_dir() and not c.name.startswith(".")]
    scan_target = children[0] if len(children) == 1 else extract_path

    try:
        result = scan_directory(scan_target)
        return result.to_dict()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {exc}")


@router.post("/scan-local")
def scan_local_folder(req: LocalScanRequest) -> dict[str, Any]:
    """Scan an arbitrary local directory on the machine (used by desktop app & demo)."""
    p = Path(req.path).resolve()
    if not p.exists():
        raise HTTPException(status_code=404, detail=f"Path not found: {req.path}")
    if not p.is_dir():
        raise HTTPException(status_code=400, detail=f"Path is not a directory: {req.path}")

    try:
        result = scan_directory(p)
        return result.to_dict()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {exc}")


@router.get("/scans/{scan_id}")
def get_scan_result(scan_id: str) -> dict[str, Any]:
    """Retrieve results for an existing codebase scan."""
    result = get_scan(scan_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"Scan {scan_id} not found")
    return result.to_dict()


@router.get("/scans/{scan_id}/patch/{issue_id}", response_class=PlainTextResponse)
def get_patch_diff(scan_id: str, issue_id: str) -> str:
    """Download the unified diff patch for an identified code issue."""
    result = get_scan(scan_id)
    if not result:
        raise HTTPException(status_code=404, detail="Scan not found")

    issue = next((i for i in result.issues if i.id == issue_id), None)
    if not issue or not issue.patch_diff:
        raise HTTPException(status_code=404, detail="No patch diff available for this issue")

    return issue.patch_diff
