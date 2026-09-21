"""Real GitHub API Service for DevGuard.

Provides repository inspection, commit history fetching, and archive extraction.
Delegates to the dedicated app.integrations.github.GitHubClient.
"""
from __future__ import annotations

import io
import logging
import os
import shutil
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
import zipfile

import httpx

from app.core.config import settings
from app.integrations.github import (
    GitHubClient,
    github_client,
    parse_repo_identifier,
)

logger = logging.getLogger("devguard.github")


def parse_github_repo(input_str: str) -> Tuple[str, str]:
    """Parse 'owner/repo' or 'https://github.com/owner/repo' into (owner, repo)."""
    return parse_repo_identifier(input_str)


# ── In-Memory Active Codebase State ──────────────────────────────────────────
_ACTIVE_CODEBASE: Optional[Dict[str, Any]] = None


def get_active_codebase() -> Dict[str, Any]:
    """Retrieve metadata of currently active connected codebase."""
    if _ACTIVE_CODEBASE is not None and _ACTIVE_CODEBASE:
        return dict(_ACTIVE_CODEBASE)
    return {
        "type": "none",
        "name": "",
        "repository": "",
        "branch": "main",
        "commit_sha": "",
        "author": "",
        "total_files": 0,
        "total_lines": 0,
        "health_score": 100,
        "issues_count": 0,
    }


def set_active_codebase(info: Dict[str, Any]) -> None:
    """Update metadata of currently active connected codebase."""
    global _ACTIVE_CODEBASE
    if _ACTIVE_CODEBASE is None:
        _ACTIVE_CODEBASE = {}
    _ACTIVE_CODEBASE.clear()
    _ACTIVE_CODEBASE.update(info)


def clear_active_codebase() -> None:
    """Clear currently active connected codebase."""
    global _ACTIVE_CODEBASE
    _ACTIVE_CODEBASE = None


class GitHubService:
    def __init__(self, token: str | None = None):
        self.token = token or getattr(settings, "github_token", None) or os.environ.get("GITHUB_TOKEN")
        self.client = GitHubClient(token=self.token)

    async def get_repo_info(self, owner: str, repo: str) -> Dict[str, Any]:
        """Fetch repository metadata from GitHub REST API."""
        return await self.client.get_repository(owner, repo)

    async def get_latest_commit(self, owner: str, repo: str, branch: str = "main") -> Dict[str, Any]:
        """Fetch the latest commit info for a given branch."""
        commits = await self.client.get_commits(owner, repo, branch=branch, per_page=1)
        if commits:
            return commits[0]
        return {
            "sha": "",
            "short_sha": "",
            "author": "Unknown",
            "message": f"No commits found on {branch}",
            "date": "",
        }

    async def download_repo_archive(self, owner: str, repo: str, branch: str, dest_dir: Path) -> Path:
        """Download zipball archive of the repository and extract into dest_dir."""
        dest_dir.mkdir(parents=True, exist_ok=True)
        url = f"https://api.github.com/repos/{owner}/{repo}/zipball/{branch}"
        headers = {
            "Accept": "application/vnd.github+json",
            "User-Agent": "DevGuard-Incident-Investigator/2.0",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        async with httpx.AsyncClient(timeout=45.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code != 200:
                fallback_url = f"https://github.com/{owner}/{repo}/archive/refs/heads/{branch}.zip"
                resp = await client.get(fallback_url)
            if resp.status_code != 200:
                raise ValueError(f"Failed to download repository archive for '{owner}/{repo}': HTTP {resp.status_code}")

            try:
                from app.services.codebase_scanner import safe_extract_zip
                return safe_extract_zip(resp.content, dest_dir)
            except Exception as exc:
                raise ValueError(f"Failed to extract repository archive: {exc}")

    @classmethod
    async def fetch_repo_metadata(cls, owner: str, repo: str, token: str | None = None) -> Dict[str, Any]:
        svc = cls(token=token)
        return await svc.get_repo_info(owner, repo)

    @classmethod
    async def fetch_latest_commit(
        cls, owner: str, repo: str, branch: str = "main", token: str | None = None
    ) -> Dict[str, Any]:
        svc = cls(token=token)
        return await svc.get_latest_commit(owner, repo, branch)

    @classmethod
    async def download_and_extract_repo(
        cls, owner: str, repo: str, branch: str = "main", token: str | None = None
    ) -> Path:
        svc = cls(token=token)
        backend_dir = Path(__file__).resolve().parents[2]
        workspaces_dir = backend_dir / ".workspaces" / f"{owner}_{repo}_{branch}"
        if workspaces_dir.exists():
            shutil.rmtree(workspaces_dir, ignore_errors=True)
        return await svc.download_repo_archive(owner, repo, branch, workspaces_dir)


github_service = GitHubService()
