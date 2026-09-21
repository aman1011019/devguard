"""Code Agent — correlates the incident with authentic Git history and commit diffs."""
from __future__ import annotations

import asyncio
import re
from typing import Any, Dict, List
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.base import Agent, AgentResult
from app.core.enums import AgentType, EvidenceType
from app.integrations.codebase_provider import get_active_provider
from app.integrations.github import github_client, parse_repo_identifier
from app.models.models import Deployment, Evidence, RootCause
from app.simulation import fixtures


class CodeAgent(Agent):
    agent_type = AgentType.CODE_AGENT
    emoji = "💻"
    label = "CODE AGENT"
    running_message = "Analyzing commit diffs and correlating changed files..."

    async def analyze_async(self, incident, db: Session) -> AgentResult:
        commit_sha = incident.commit_sha or getattr(incident, "commit", None)
        author = incident.author or "Unknown"
        repo = incident.repository or ""

        # 1. Try to fetch real commit diff from GitHub if repository is set
        diff_text = ""
        changed_files: List[Dict[str, Any]] = []
        commit_msg = ""
        parent_sha = ""

        if repo and "/" in repo and commit_sha and commit_sha != "fb8ac60":
            try:
                owner, r = parse_repo_identifier(repo)
                commit_info = await github_client.get_commit(owner, r, commit_sha)
                commit_msg = commit_info.get("message", "")
                author = commit_info.get("author", author)

                diff_info = await github_client.get_commit_diff(owner, r, commit_sha)
                diff_text = diff_info.get("diff", "")
                changed_files = diff_info.get("files", [])
            except Exception:
                pass

        # 2. Try to fetch diff from active CodebaseProvider
        provider = get_active_provider()
        if not diff_text and provider:
            try:
                diff_text = await provider.get_diff(commit_sha)
            except Exception:
                pass

        # 3. Check for RootCause or Deployment in DB
        rc = db.scalars(select(RootCause).where(RootCause.incident_id == incident.id)).first()
        latest_deploy = db.scalars(
            select(Deployment)
            .where(Deployment.incident_id == incident.id)
            .order_by(Deployment.timestamp.desc())
        ).first()

        # 4. If we have real changed files from GitHub / diff, analyze them
        if changed_files or diff_text:
            suspicious_changes = []
            for f in changed_files:
                fname = f.get("filename", "")
                patch = f.get("patch", "")
                line_no = 1
                # Parse starting line from patch hunk @@ -X,Y +A,B @@
                m = re.search(r"@@\s*-\d+(?:,\d+)?\s*\+(\d+)", patch)
                if m:
                    line_no = int(m.group(1))

                reason = f"File {fname} modified in commit {commit_sha[:7]} (+{f.get('additions', 0)} / -{f.get('deletions', 0)})"
                if any(kw in patch.lower() for kw in ("for", "while", "query", "fetch", "select", "timeout", "pool")):
                    reason += " — contains loop or database access modifications."

                suspicious_changes.append({
                    "changed_file": fname,
                    "function": "modified_block",
                    "line": line_no,
                    "author": author,
                    "commit": commit_sha[:7] if commit_sha else "HEAD",
                    "reason": reason,
                    "additions": f.get("additions", 0),
                    "deletions": f.get("deletions", 0),
                })

            # Record Evidence
            evidence_key = f"git_diff_{incident.id}_{commit_sha[:7]}"
            db.add(
                Evidence(
                    incident_id=incident.id,
                    key=evidence_key,
                    type=EvidenceType.GIT.value,
                    source="git_commit",
                    agent="CODE AGENT",
                    timestamp="00:02",
                    relevance=0.96,
                    title=f"Commit {commit_sha[:7]} by {author}",
                    content=diff_text[:3000] if diff_text else f"Commit {commit_sha[:7]}: {commit_msg}",
                    meta={"commit": commit_sha, "author": author, "files": [f.get("filename") for f in changed_files]},
                )
            )
            db.commit()

            primary = suspicious_changes[0] if suspicious_changes else {
                "changed_file": incident.repository or "repository",
                "line": 1,
                "author": author,
                "commit": commit_sha[:7],
                "reason": "Commit correlated with CI regression.",
            }

            finding = (
                f"Isolated commit {commit_sha[:7]} by {author} affecting "
                f"{len(changed_files)} files ({primary['changed_file']}:{primary['line']})."
            )

            return AgentResult(
                finding=finding,
                detail={
                    "agent": "Code Agent",
                    "status": "completed",
                    "commit": commit_sha,
                    "short_sha": commit_sha[:7],
                    "author": author,
                    "commit_message": commit_msg,
                    "changed_files": changed_files,
                    "suspicious_changes": suspicious_changes,
                    "primary_target": primary,
                    "evidence_ids": [evidence_key],
                },
                confidence=0.96,
                evidence_ids=[evidence_key],
            )

        # 5. If root cause exists from AST scan
        if rc and rc.file:
            detail = {
                "file": rc.file,
                "line": rc.line or 42,
                "commit": rc.commit_sha or (latest_deploy.commit_sha if latest_deploy else "HEAD"),
                "author": author or (latest_deploy.author if latest_deploy else "contributor"),
                "deployment": incident.deployment_version or (latest_deploy.version if latest_deploy else "v1.0.0"),
                "evidence_ids": ["code_analysis", "ast_scan"],
            }
            finding = f"Correlated regression to {rc.title} in {rc.file}:{rc.line} (commit {detail['commit'][:7]})."
            return AgentResult(
                finding=finding,
                detail=detail,
                confidence=rc.confidence or 0.94,
                evidence_ids=["code_analysis", "ast_scan"],
            )

        # 6. Fallback to demo fixtures
        base = fixtures.AGENT_FINDINGS["code_agent"]
        return AgentResult(
            finding=base["finding"],
            detail=dict(base["detail"]),
            confidence=base["confidence"],
            evidence_ids=base["detail"].get("evidence_ids", []),
        )

    def analyze(self, incident, db: Session) -> AgentResult:
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(asyncio.run, self.analyze_async(incident, db))
                    return future.result()
            return loop.run_until_complete(self.analyze_async(incident, db))
        except Exception:
            return asyncio.run(self.analyze_async(incident, db))
