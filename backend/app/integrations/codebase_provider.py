"""Unified CodebaseProvider abstraction for DevGuard.

Enables Code Agent, Log Agent, Fix Agent, and the scanner to access source files,
file trees, diffs, and code search uniformly regardless of whether the source
originates from a GitHub repository or an uploaded ZIP archive.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
import logging
from pathlib import Path
import re
from typing import Any, Dict, List, Optional

from app.integrations.github import GitHubClient

logger = logging.getLogger("devguard.integrations.codebase_provider")


class CodebaseProvider(ABC):
    """Abstract base class for codebase access."""

    @abstractmethod
    async def get_file(self, path: str) -> str:
        """Retrieve the contents of a specific file."""
        pass

    @abstractmethod
    async def list_files(self) -> List[str]:
        """List all indexed file paths in the codebase."""
        pass

    @abstractmethod
    async def search_code(self, query: str) -> List[Dict[str, Any]]:
        """Search code files for a string or regex pattern."""
        pass

    @abstractmethod
    async def get_diff(self, target: Optional[str] = None) -> str:
        """Retrieve unified diff for the latest change or specified commit/branch."""
        pass

    @abstractmethod
    def get_metadata(self) -> Dict[str, Any]:
        """Retrieve high-level metadata (source, branch, files count, languages, commit)."""
        pass


class GitHubCodebaseProvider(CodebaseProvider):
    """GitHub REST API-driven codebase provider with targeted file retrieval."""

    def __init__(
        self,
        owner: str,
        repo: str,
        branch: str = "main",
        token: Optional[str] = None,
        commit_sha: Optional[str] = None,
        author: Optional[str] = None,
    ):
        self.owner = owner
        self.repo = repo
        self.branch = branch
        self.commit_sha = commit_sha or ""
        self.author = author or ""
        self.client = GitHubClient(token=token)
        self._cached_tree: Optional[List[Dict[str, Any]]] = None
        self._metadata: Dict[str, Any] = {
            "type": "github",
            "source": "LIVE GITHUB",
            "name": f"{owner}/{repo}",
            "repository": f"{owner}/{repo}",
            "branch": branch,
            "commit_sha": commit_sha,
            "author": author,
        }

    async def get_file(self, path: str) -> str:
        ref = self.commit_sha if self.commit_sha else self.branch
        return await self.client.get_file(self.owner, self.repo, path, ref=ref)

    async def list_files(self) -> List[str]:
        if self._cached_tree is None:
            ref = self.commit_sha if self.commit_sha else self.branch
            try:
                self._cached_tree = await self.client.get_tree(self.owner, self.repo, ref=ref, recursive=True)
            except Exception as e:
                logger.warning(f"Failed to fetch tree from GitHub: {e}")
                return []
        return [item["path"] for item in self._cached_tree if item.get("type") == "blob"]

    async def search_code(self, query: str) -> List[Dict[str, Any]]:
        """Search file paths and targeted files."""
        files = await self.list_files()
        matches = []
        pattern = re.compile(re.escape(query), re.IGNORECASE)
        # Search relevant file paths first
        matched_paths = [f for f in files if pattern.search(f)]
        for p in matched_paths[:15]:
            matches.append({"file": p, "line": 1, "match": p, "type": "filename"})

        # Search top relevant files content (up to 5 candidate files)
        candidates = [f for f in files if any(f.endswith(ext) for ext in (".ts", ".tsx", ".py", ".java", ".go", ".rs", ".js"))][:5]
        for p in candidates:
            try:
                content = await self.get_file(p)
                for line_idx, line in enumerate(content.splitlines(), start=1):
                    if pattern.search(line):
                        matches.append({"file": p, "line": line_idx, "match": line.strip(), "type": "content"})
                        if len(matches) >= 25:
                            return matches
            except Exception:
                continue
        return matches

    async def get_diff(self, target: Optional[str] = None) -> str:
        sha = target or self.commit_sha
        if not sha:
            commits = await self.client.get_commits(self.owner, self.repo, branch=self.branch, per_page=1)
            if commits:
                sha = commits[0]["sha"]
        if sha:
            diff_obj = await self.client.get_commit_diff(self.owner, self.repo, sha)
            return diff_obj.get("diff", "")
        return ""

    def get_metadata(self) -> Dict[str, Any]:
        return dict(self._metadata)

    def update_metadata(self, updates: Dict[str, Any]) -> None:
        self._metadata.update(updates)


class ZipCodebaseProvider(CodebaseProvider):
    """Local extracted ZIP workspace codebase provider."""

    def __init__(
        self,
        workspace_path: Path | str,
        name: str,
        commit_sha: str = "zip_upload",
        author: str = "Project Upload",
        scan_meta: Optional[Dict[str, Any]] = None,
    ):
        self.workspace_path = Path(workspace_path).resolve()
        self.name = name
        self.commit_sha = commit_sha
        self.author = author
        self._scan_meta = scan_meta or {}

    async def get_file(self, path: str) -> str:
        # Prevent directory traversal
        target = (self.workspace_path / path).resolve()
        if self.workspace_path not in target.parents and target != self.workspace_path:
            raise PermissionError(f"Access to path outside extraction sandbox denied: {path}")
        if not target.is_file():
            raise FileNotFoundError(f"File not found in extracted codebase: {path}")
        return target.read_text(encoding="utf-8", errors="replace")

    async def list_files(self) -> List[str]:
        files = []
        ignore_dirs = {
            "node_modules", ".git", "dist", "build", "coverage", ".venv",
            "__pycache__", "vendor", "target", ".idea", ".vscode"
        }
        for item in self.workspace_path.rglob("*"):
            if item.is_file():
                if any(part in ignore_dirs or part.startswith(".") for part in item.parts):
                    continue
                try:
                    rel = item.relative_to(self.workspace_path).as_posix()
                    files.append(rel)
                except ValueError:
                    continue
        return files

    async def search_code(self, query: str) -> List[Dict[str, Any]]:
        files = await self.list_files()
        pattern = re.compile(re.escape(query), re.IGNORECASE)
        matches = []
        for rel_path in files:
            full_path = self.workspace_path / rel_path
            try:
                # Avoid binary files
                content = full_path.read_text(encoding="utf-8", errors="ignore")
                for idx, line in enumerate(content.splitlines(), start=1):
                    if pattern.search(line):
                        matches.append({
                            "file": rel_path,
                            "line": idx,
                            "match": line.strip(),
                            "type": "content",
                        })
                        if len(matches) >= 50:
                            return matches
            except Exception:
                continue
        return matches

    async def get_diff(self, target: Optional[str] = None) -> str:
        return self._scan_meta.get("patch_diff", "")

    def get_metadata(self) -> Dict[str, Any]:
        return {
            "type": "zip",
            "source": "UPLOADED ZIP",
            "name": self.name,
            "repository": self.name,
            "branch": "main",
            "commit_sha": self.commit_sha,
            "author": self.author,
            "path": str(self.workspace_path),
            **self._scan_meta,
        }


class MemoryCodebaseProvider(CodebaseProvider):
    """Zero-storage in-memory codebase provider holding file data purely in RAM."""

    def __init__(
        self,
        files_dict: Dict[str, str],
        name: str,
        commit_sha: str = "mem_head",
        author: str = "Direct Scanner",
        scan_meta: Optional[Dict[str, Any]] = None,
    ):
        self.files_dict = files_dict
        self.name = name
        self.commit_sha = commit_sha
        self.author = author
        self._scan_meta = scan_meta or {}

    async def get_file(self, path: str) -> str:
        clean = path.lstrip("/")
        if clean in self.files_dict:
            return self.files_dict[clean]
        for k, v in self.files_dict.items():
            if k.endswith(clean) or clean.endswith(k):
                return v
        raise FileNotFoundError(f"File '{path}' not found in in-memory codebase.")

    async def list_files(self) -> List[str]:
        return sorted(list(self.files_dict.keys()))

    async def search_code(self, query: str) -> List[Dict[str, Any]]:
        pattern = re.compile(re.escape(query), re.IGNORECASE)
        matches = []
        for rel_path, content in self.files_dict.items():
            for idx, line in enumerate(content.splitlines(), start=1):
                if pattern.search(line):
                    matches.append({
                        "file": rel_path,
                        "line": idx,
                        "match": line.strip(),
                        "type": "content",
                    })
                    if len(matches) >= 50:
                        return matches
        return matches

    async def get_diff(self, target: Optional[str] = None) -> str:
        return self._scan_meta.get("patch_diff", "")

    def get_metadata(self) -> Dict[str, Any]:
        return {
            "type": "memory",
            "source": "IN-MEMORY RAM",
            "name": self.name,
            "repository": self.name,
            "branch": "main",
            "commit_sha": self.commit_sha,
            "author": self.author,
            "total_files": len(self.files_dict),
            **self._scan_meta,
        }


# ── Global Active Provider State ──────────────────────────────────────────────
_ACTIVE_PROVIDER: Optional[CodebaseProvider] = None


def get_active_provider() -> Optional[CodebaseProvider]:
    """Retrieve currently active CodebaseProvider (GitHub or ZIP)."""
    return _ACTIVE_PROVIDER


def set_active_provider(provider: Optional[CodebaseProvider]) -> None:
    """Set the currently active CodebaseProvider."""
    global _ACTIVE_PROVIDER
    _ACTIVE_PROVIDER = provider


def clear_active_provider() -> None:
    """Clear the currently active CodebaseProvider."""
    global _ACTIVE_PROVIDER
    _ACTIVE_PROVIDER = None

