"""Dedicated GitHub REST API integration for DevGuard.

Provides targeted access to repositories, branches, commits, diffs, pull requests,
workflows, workflow runs, CI logs, repository trees, and raw source files.
Handles rate limits, auth errors, and permissions cleanly with structured responses.
"""
from __future__ import annotations

import base64
import io
import logging
import os
import re
import zipfile
from typing import Any, Dict, List, Optional, Tuple

import httpx

from app.core.config import settings

logger = logging.getLogger("devguard.integrations.github")


class GitHubError(Exception):
    """Base exception for GitHub API errors."""

    def __init__(self, message: str, status_code: int = 500, detail: Any = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.detail = detail


class GitHubAuthError(GitHubError):
    def __init__(self, message: str = "GitHub authentication failed. Check GITHUB_TOKEN."):
        super().__init__(message, status_code=401)


class GitHubPermissionError(GitHubError):
    def __init__(self, message: str = "Insufficient permissions to access repository."):
        super().__init__(message, status_code=403)


class GitHubRateLimitError(GitHubError):
    def __init__(self, message: str = "GitHub API rate limit exceeded."):
        super().__init__(message, status_code=429)


class GitHubNotFoundError(GitHubError):
    def __init__(self, resource: str = "Resource"):
        super().__init__(f"{resource} not found on GitHub.", status_code=404)


def parse_repo_identifier(input_str: str) -> Tuple[str, str]:
    """Parse 'owner/repo' or 'https://github.com/owner/repo' into (owner, repo)."""
    cleaned = input_str.strip().rstrip("/")
    if cleaned.endswith(".git"):
        cleaned = cleaned[:-4]

    # Handle https://github.com/owner/repo or git@github.com:owner/repo
    m = re.search(r"github\.com[:/]([^/]+)/([^/]+)", cleaned)
    if m:
        owner = m.group(1).strip()
        repo = m.group(2).strip().split("?")[0].split("#")[0]
        if repo.endswith(".git"):
            repo = repo[:-4]
        return owner, repo

    # Handle owner/repo
    parts = cleaned.split("/")
    if len(parts) == 2 and parts[0] and parts[1]:
        owner = parts[0].strip()
        repo = parts[1].strip().split("?")[0].split("#")[0]
        if repo.endswith(".git"):
            repo = repo[:-4]
        return owner, repo

    raise GitHubError(f"Invalid GitHub repository format: '{input_str}'. Expected 'owner/repo' or URL.", status_code=400)


import time


class GitHubClient:
    def __init__(self, token: Optional[str] = None, api_url: Optional[str] = None):
        self.token = token or getattr(settings, "github_token", None) or os.environ.get("GITHUB_TOKEN") or ""
        self.api_url = (api_url or getattr(settings, "github_api_url", "https://api.github.com")).rstrip("/")
        self.rate_limit_limit: int = 60
        self.rate_limit_remaining: int = 60
        self.rate_limit_reset: int = 0
        self.rate_limit_used: int = 0
        self._cache: Dict[str, Tuple[float, Any]] = {}
        self._cache_ttl: float = 60.0  # 60-second TTL cache for GET calls

    def _headers(self, accept: str = "application/vnd.github+json") -> Dict[str, str]:
        headers = {
            "Accept": accept,
            "User-Agent": "DevGuard-Incident-Investigator/2.0",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    def _track_headers(self, resp: httpx.Response) -> None:
        try:
            if "x-ratelimit-limit" in resp.headers:
                self.rate_limit_limit = int(resp.headers["x-ratelimit-limit"])
            if "x-ratelimit-remaining" in resp.headers:
                self.rate_limit_remaining = int(resp.headers["x-ratelimit-remaining"])
            if "x-ratelimit-reset" in resp.headers:
                self.rate_limit_reset = int(resp.headers["x-ratelimit-reset"])
            if "x-ratelimit-used" in resp.headers:
                self.rate_limit_used = int(resp.headers["x-ratelimit-used"])
        except Exception:
            pass

    def _get_cache(self, key: str) -> Optional[Any]:
        if key in self._cache:
            ts, val = self._cache[key]
            if time.time() - ts < self._cache_ttl:
                return val
            del self._cache[key]
        return None

    def _set_cache(self, key: str, val: Any) -> None:
        self._cache[key] = (time.time(), val)

    def _handle_error_response(self, resp: httpx.Response, resource_name: str = "Resource") -> None:
        self._track_headers(resp)
        if resp.status_code == 200 or resp.status_code == 201:
            return

        body_msg = ""
        try:
            data = resp.json()
            body_msg = data.get("message", "")
        except Exception:
            body_msg = resp.text

        if resp.status_code == 401:
            raise GitHubAuthError(f"GitHub Auth Error: {body_msg or 'Bad credentials'}")
        if resp.status_code == 403:
            if "rate limit" in body_msg.lower():
                raise GitHubRateLimitError(f"GitHub rate limit exceeded: {body_msg}")
            raise GitHubPermissionError(f"GitHub permission denied: {body_msg}")
        if resp.status_code == 404:
            raise GitHubNotFoundError(f"{resource_name} (HTTP 404: {body_msg})")
        raise GitHubError(f"GitHub API Error [{resp.status_code}]: {body_msg}", status_code=resp.status_code)

    async def get_rate_limit_status(self) -> Dict[str, Any]:
        """Fetch current GitHub rate limit and authentication status."""
        url = f"{self.api_url}/rate_limit"
        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                resp = await client.get(url, headers=self._headers())
                self._track_headers(resp)
                if resp.status_code == 200:
                    data = resp.json()
                    core = data.get("resources", {}).get("core", {})
                    reset_epoch = core.get("reset", self.rate_limit_reset)
                    from datetime import datetime, timezone
                    reset_dt = datetime.fromtimestamp(reset_epoch, tz=timezone.utc).isoformat() if reset_epoch else ""
                    return {
                        "authenticated": bool(self.token),
                        "limit": core.get("limit", self.rate_limit_limit),
                        "remaining": core.get("remaining", self.rate_limit_remaining),
                        "used": core.get("used", self.rate_limit_used),
                        "reset_epoch": reset_epoch,
                        "reset_time": reset_dt,
                    }
        except Exception as e:
            logger.warning(f"Failed to query /rate_limit endpoint: {e}")

        from datetime import datetime, timezone
        reset_dt = datetime.fromtimestamp(self.rate_limit_reset, tz=timezone.utc).isoformat() if self.rate_limit_reset else ""
        return {
            "authenticated": bool(self.token),
            "limit": self.rate_limit_limit,
            "remaining": self.rate_limit_remaining,
            "used": self.rate_limit_used,
            "reset_epoch": self.rate_limit_reset,
            "reset_time": reset_dt,
        }

    async def get_repository(self, owner: str, repo: str) -> Dict[str, Any]:
        """Fetch repository details, default branch, stars, and language stats."""
        cache_key = f"repo:{owner}/{repo}"
        cached = self._get_cache(cache_key)
        if cached:
            return cached

        url = f"{self.api_url}/repos/{owner}/{repo}"
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=self._headers())
            self._handle_error_response(resp, f"Repository '{owner}/{repo}'")
            self._track_headers(resp)
            data = resp.json()

            # Also fetch languages
            lang_resp = await client.get(f"{self.api_url}/repos/{owner}/{repo}/languages", headers=self._headers())
            languages = lang_resp.json() if lang_resp.status_code == 200 else {}

            res = {
                "owner": owner,
                "repo": repo,
                "name": repo,
                "full_name": data.get("full_name", f"{owner}/{repo}"),
                "description": data.get("description", "") or "",
                "default_branch": data.get("default_branch", "main"),
                "language": data.get("language", "Unknown") or "Unknown",
                "languages": languages,
                "stars": data.get("stargazers_count", 0),
                "forks": data.get("forks_count", 0),
                "open_issues": data.get("open_issues_count", 0),
                "is_private": data.get("private", False),
                "html_url": data.get("html_url", f"https://github.com/{owner}/{repo}"),
                "updated_at": data.get("updated_at", ""),
                "pushed_at": data.get("pushed_at", ""),
            }
            self._set_cache(cache_key, res)
            return res

    async def get_branches(self, owner: str, repo: str) -> List[Dict[str, Any]]:
        """Fetch list of branches for a repository."""
        url = f"{self.api_url}/repos/{owner}/{repo}/branches?per_page=100"
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=self._headers())
            self._handle_error_response(resp, f"Branches for '{owner}/{repo}'")
            branches = resp.json()
            return [
                {
                    "name": b.get("name"),
                    "commit_sha": b.get("commit", {}).get("sha", ""),
                    "protected": b.get("protected", False),
                }
                for b in branches
            ]

    async def get_commits(
        self, owner: str, repo: str, branch: str = "main", per_page: int = 20, page: int = 1
    ) -> List[Dict[str, Any]]:
        """Fetch commit history for a repository branch."""
        url = f"{self.api_url}/repos/{owner}/{repo}/commits"
        params = {"sha": branch, "per_page": per_page, "page": page}
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=self._headers(), params=params)
            self._handle_error_response(resp, f"Commits on '{owner}/{repo}:{branch}'")
            commits = resp.json()
            results = []
            for c in commits:
                commit_obj = c.get("commit", {})
                author_obj = commit_obj.get("author", {}) or {}
                committer_obj = c.get("author", {}) or {}
                results.append(
                    {
                        "sha": c.get("sha", ""),
                        "short_sha": c.get("sha", "")[:7],
                        "message": commit_obj.get("message", "").strip(),
                        "author": committer_obj.get("login") or author_obj.get("name") or "Unknown",
                        "date": author_obj.get("date", ""),
                        "html_url": c.get("html_url", ""),
                        "parents": [p.get("sha") for p in c.get("parents", [])],
                    }
                )
            return results

    async def get_commit(self, owner: str, repo: str, sha: str) -> Dict[str, Any]:
        """Fetch single commit details including file changes."""
        url = f"{self.api_url}/repos/{owner}/{repo}/commits/{sha}"
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=self._headers())
            self._handle_error_response(resp, f"Commit '{sha}' in '{owner}/{repo}'")
            data = resp.json()
            commit_obj = data.get("commit", {})
            author_obj = commit_obj.get("author", {}) or {}
            committer_obj = data.get("author", {}) or {}

            files = []
            for f in data.get("files", []):
                files.append(
                    {
                        "filename": f.get("filename"),
                        "status": f.get("status"),
                        "additions": f.get("additions", 0),
                        "deletions": f.get("deletions", 0),
                        "changes": f.get("changes", 0),
                        "patch": f.get("patch", ""),
                    }
                )

            return {
                "sha": data.get("sha", sha),
                "short_sha": data.get("sha", sha)[:7],
                "message": commit_obj.get("message", "").strip(),
                "author": committer_obj.get("login") or author_obj.get("name") or "Unknown",
                "date": author_obj.get("date", ""),
                "stats": data.get("stats", {}),
                "files": files,
                "html_url": data.get("html_url", ""),
            }

    async def get_commit_diff(self, owner: str, repo: str, sha: str) -> Dict[str, Any]:
        """Fetch commit diff in unified format."""
        url = f"{self.api_url}/repos/{owner}/{repo}/commits/{sha}"
        diff_headers = self._headers(accept="application/vnd.github.v3.diff")
        json_headers = self._headers()

        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            # Fetch raw diff
            diff_resp = await client.get(url, headers=diff_headers)
            self._handle_error_response(diff_resp, f"Diff for commit '{sha}'")
            diff_text = diff_resp.text

            # Fetch commit JSON for structured file stats
            json_resp = await client.get(url, headers=json_headers)
            json_data = json_resp.json() if json_resp.status_code == 200 else {}

            files = [
                {
                    "filename": f.get("filename"),
                    "status": f.get("status"),
                    "additions": f.get("additions", 0),
                    "deletions": f.get("deletions", 0),
                    "patch": f.get("patch", ""),
                }
                for f in json_data.get("files", [])
            ]

            return {
                "sha": sha,
                "short_sha": sha[:7],
                "diff": diff_text,
                "files": files,
                "total_files": len(files),
                "stats": json_data.get("stats", {}),
            }

    async def get_pull_requests(self, owner: str, repo: str, state: str = "open") -> List[Dict[str, Any]]:
        """Fetch pull requests for a repository."""
        url = f"{self.api_url}/repos/{owner}/{repo}/pulls"
        params = {"state": state, "per_page": 20}
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=self._headers(), params=params)
            self._handle_error_response(resp, f"Pull requests for '{owner}/{repo}'")
            prs = resp.json()
            return [
                {
                    "id": p.get("id"),
                    "number": p.get("number"),
                    "title": p.get("title"),
                    "state": p.get("state"),
                    "user": p.get("user", {}).get("login"),
                    "head_branch": p.get("head", {}).get("ref"),
                    "base_branch": p.get("base", {}).get("ref"),
                    "created_at": p.get("created_at"),
                    "html_url": p.get("html_url"),
                }
                for p in prs
            ]

    async def get_issues(
        self, owner: str, repo: str, state: str = "open", per_page: int = 20, page: int = 1
    ) -> List[Dict[str, Any]]:
        """Fetch repository issues (excluding pull requests)."""
        url = f"{self.api_url}/repos/{owner}/{repo}/issues"
        params = {"state": state, "per_page": per_page, "page": page}
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=self._headers(), params=params)
            self._handle_error_response(resp, f"Issues for '{owner}/{repo}'")
            items = resp.json()
            return [
                {
                    "id": item.get("id"),
                    "number": item.get("number"),
                    "title": item.get("title"),
                    "state": item.get("state"),
                    "user": item.get("user", {}).get("login"),
                    "created_at": item.get("created_at"),
                    "updated_at": item.get("updated_at"),
                    "html_url": item.get("html_url"),
                    "comments": item.get("comments", 0),
                    "body": item.get("body", "")[:500] if item.get("body") else "",
                }
                for item in items
                if "pull_request" not in item
            ]

    async def compare(self, owner: str, repo: str, base: str, head: str) -> Dict[str, Any]:
        """Compare two commits or branches to inspect ahead/behind and code diffs."""
        url = f"{self.api_url}/repos/{owner}/{repo}/compare/{base}...{head}"
        async with httpx.AsyncClient(timeout=25.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=self._headers())
            self._handle_error_response(resp, f"Comparison between '{base}' and '{head}' in '{owner}/{repo}'")
            data = resp.json()
            commits = []
            for c in data.get("commits", []):
                commits.append({
                    "sha": c.get("sha"),
                    "short_sha": c.get("sha", "")[:7],
                    "message": c.get("commit", {}).get("message", "").strip(),
                    "author": c.get("commit", {}).get("author", {}).get("name", "Unknown"),
                    "date": c.get("commit", {}).get("author", {}).get("date", ""),
                })
            files = []
            for f in data.get("files", []):
                files.append({
                    "filename": f.get("filename"),
                    "status": f.get("status"),
                    "additions": f.get("additions", 0),
                    "deletions": f.get("deletions", 0),
                    "patch": f.get("patch", ""),
                })
            return {
                "status": data.get("status"),
                "ahead_by": data.get("ahead_by", 0),
                "behind_by": data.get("behind_by", 0),
                "total_commits": data.get("total_commits", 0),
                "commits": commits,
                "files": files,
                "permalink_url": data.get("permalink_url", ""),
            }

    async def get_workflows(self, owner: str, repo: str) -> List[Dict[str, Any]]:
        """Fetch GitHub Actions workflows."""
        url = f"{self.api_url}/repos/{owner}/{repo}/actions/workflows"
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=self._headers())
            if resp.status_code == 404:
                return []
            self._handle_error_response(resp, f"Workflows for '{owner}/{repo}'")
            data = resp.json()
            return data.get("workflows", [])

    async def get_workflow_runs(
        self, owner: str, repo: str, workflow_id: Optional[str] = None, per_page: int = 20
    ) -> List[Dict[str, Any]]:
        """Fetch recent GitHub Actions workflow runs."""
        if workflow_id:
            url = f"{self.api_url}/repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs"
        else:
            url = f"{self.api_url}/repos/{owner}/{repo}/actions/runs"

        params = {"per_page": per_page}
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=self._headers(), params=params)
            if resp.status_code == 404:
                return []
            self._handle_error_response(resp, f"Workflow runs for '{owner}/{repo}'")
            data = resp.json()
            runs = []
            for r in data.get("workflow_runs", []):
                runs.append(
                    {
                        "id": r.get("id"),
                        "name": r.get("name"),
                        "head_branch": r.get("head_branch"),
                        "head_sha": r.get("head_sha"),
                        "short_sha": (r.get("head_sha") or "")[:7],
                        "status": r.get("status"),
                        "conclusion": r.get("conclusion"),
                        "event": r.get("event"),
                        "created_at": r.get("created_at"),
                        "updated_at": r.get("updated_at"),
                        "html_url": r.get("html_url"),
                        "author": r.get("head_commit", {}).get("author", {}).get("name", "Unknown"),
                        "commit_message": r.get("head_commit", {}).get("message", ""),
                    }
                )
            return runs

    async def get_workflow_run(self, owner: str, repo: str, run_id: int | str) -> Dict[str, Any]:
        """Fetch single workflow run details."""
        url = f"{self.api_url}/repos/{owner}/{repo}/actions/runs/{run_id}"
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=self._headers())
            self._handle_error_response(resp, f"Workflow run '{run_id}'")
            return resp.json()

    async def get_workflow_logs(self, owner: str, repo: str, run_id: int | str) -> str:
        """Download and extract raw text logs for a workflow run."""
        url = f"{self.api_url}/repos/{owner}/{repo}/actions/runs/{run_id}/logs"
        async with httpx.AsyncClient(timeout=45.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=self._headers())
            if resp.status_code == 404:
                return f"No logs found for workflow run {run_id} (logs may have expired)."
            self._handle_error_response(resp, f"Logs for workflow run '{run_id}'")

            # Logs are returned as a zip archive
            try:
                zf = zipfile.ZipFile(io.BytesIO(resp.content))
                log_texts = []
                for name in zf.namelist():
                    if name.endswith(".txt"):
                        with zf.open(name) as f:
                            text = f.read().decode("utf-8", errors="replace")
                            log_texts.append(f"=== File: {name} ===\n" + text)
                return "\n\n".join(log_texts) if log_texts else "Log archive was empty."
            except Exception as e:
                logger.warning(f"Failed to unpack zip logs: {e}, falling back to raw response text.")
                return resp.text

    async def get_file(self, owner: str, repo: str, path: str, ref: str = "main") -> str:
        """Targeted retrieval of single file contents from repository without full clone."""
        cleaned_path = path.lstrip("/")
        url = f"{self.api_url}/repos/{owner}/{repo}/contents/{cleaned_path}"
        params = {"ref": ref}

        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=self._headers(), params=params)
            if resp.status_code != 200:
                # Fallback to raw.githubusercontent.com
                raw_url = f"https://raw.githubusercontent.com/{owner}/{repo}/{ref}/{cleaned_path}"
                raw_resp = await client.get(raw_url, headers=self._headers())
                if raw_resp.status_code == 200:
                    return raw_resp.text
                self._handle_error_response(resp, f"File '{path}' at ref '{ref}'")

            data = resp.json()
            if isinstance(data, list):
                raise GitHubError(f"Path '{path}' is a directory, not a file.", status_code=400)

            encoding = data.get("encoding", "")
            content = data.get("content", "")
            if encoding == "base64":
                try:
                    return base64.b64decode(content).decode("utf-8", errors="replace")
                except Exception as exc:
                    raise GitHubError(f"Failed to decode base64 file content: {exc}", status_code=500)
            return content

    async def get_tree(
        self, owner: str, repo: str, ref: str = "main", recursive: bool = True
    ) -> List[Dict[str, Any]]:
        """Fetch git repository file tree."""
        url = f"{self.api_url}/repos/{owner}/{repo}/git/trees/{ref}"
        params = {"recursive": "1" if recursive else "0"}
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=self._headers(), params=params)
            self._handle_error_response(resp, f"Tree for '{owner}/{repo}:{ref}'")
            data = resp.json()
            tree = data.get("tree", [])
            return [
                {
                    "path": item.get("path"),
                    "mode": item.get("mode"),
                    "type": item.get("type"),  # "blob" or "tree"
                    "sha": item.get("sha"),
                    "size": item.get("size", 0),
                }
                for item in tree
            ]

    async def download_archive_bytes(self, owner: str, repo: str, ref: str = "main") -> bytes:
        """Download in-memory zipball stream directly into RAM with zero disk storage."""
        url = f"{self.api_url}/repos/{owner}/{repo}/zipball/{ref}"
        async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=self._headers())
            self._handle_error_response(resp, f"Archive for '{owner}/{repo}:{ref}'")
            return resp.content


# Singleton default client
github_client = GitHubClient()
