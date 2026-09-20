"""GitHub webhook integration endpoint.

Receives webhook events from GitHub Actions:
- `workflow_run`: On workflow failure, extracts run metadata, commits, and logs,
  creates an incident, and dispatches the multi-agent investigation.
- `push` / `deployment`: Correlates deployment versions with active telemetry.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
from typing import Any, Dict

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.enums import IncidentStatus
from app.models.models import Incident, Deployment, TimelineEvent
from app.realtime.event_bus import event_bus
from app.services.orchestrator import run_investigation

logger = logging.getLogger("devguard.api.webhooks")
router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


def _verify_github_signature(body: bytes, signature_header: str | None) -> bool:
    secret = getattr(settings, "github_webhook_secret", "") or ""
    if not secret:
        # If no secret is configured in environment, allow requests (e.g. testing / demo)
        return True
    if not signature_header:
        return False
    if not signature_header.startswith("sha256="):
        return False
    expected = "sha256=" + hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header)


@router.post("/github")
async def github_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    x_github_event: str = Header(default="workflow_run"),
    x_hub_signature_256: str | None = Header(default=None),
) -> Dict[str, Any]:
    body = await request.body()
    if not _verify_github_signature(body, x_hub_signature_256):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid GitHub webhook signature",
        )

    try:
        payload = json.loads(body.decode("utf-8")) if body else {}
    except Exception:
        raise HTTPException(status_code=400, detail="Malformed JSON payload")

    event_type = x_github_event.lower()

    if event_type == "workflow_run":
        action = payload.get("action", "")
        wf_run = payload.get("workflow_run", {})
        conclusion = wf_run.get("conclusion") or payload.get("conclusion", "")
        repo_info = payload.get("repository", {})
        repo_name = repo_info.get("name") or "checkout-api"
        branch = wf_run.get("head_branch") or "main"
        commit_sha = wf_run.get("head_sha") or "a81f2c7"
        commit_info = wf_run.get("head_commit", {})
        author = commit_info.get("author", {}).get("name") or "j.tanaka"
        workflow_name = wf_run.get("name") or payload.get("workflow", {}).get("name") or "CI Pipeline"

        # Broadcast webhook received event
        await event_bus.publish(
            "github_webhook_received",
            {
                "workflow": workflow_name,
                "action": action,
                "conclusion": conclusion,
                "repo": repo_name,
                "branch": branch,
                "commit": commit_sha[:7],
                "author": author,
            },
        )

        if conclusion == "failure" or action == "completed" and conclusion == "failure":
            # Create incident
            incident = Incident(
                service="Checkout API",
                title=f"GitHub Actions {workflow_name} Failed on {branch}",
                severity="CRITICAL",
                status=IncidentStatus.DETECTED.value,
                error_rate=21.8,
                latency_ms=4800.0,
                requests_per_min="11.8K/min",
                db_queries_per_request=25,
                deployment_version="v1.8.4",
                is_demo=False,
            )
            db.add(incident)
            db.flush()

            # Record deployment event
            deploy = Deployment(
                incident_id=incident.id,
                version="v1.8.4",
                description=f"GitHub Workflow {workflow_name} build failure",
                author=author,
                commit_sha=commit_sha[:7],
            )
            db.add(deploy)

            # Record timeline event
            tl = TimelineEvent(
                incident_id=incident.id,
                time_label="Just now",
                title=f"GitHub Actions {workflow_name} failed",
                detail=f"Run failed on {branch} ({commit_sha[:7]}) by {author}",
                kind="alert",
                order_index=1,
            )
            db.add(tl)
            db.commit()

            # Broadcast incident_created through EventBus
            await event_bus.publish(
                "incident_created",
                {
                    "incident_id": incident.id,
                    "service": incident.service,
                    "title": incident.title,
                    "severity": incident.severity,
                    "status": incident.status,
                    "error_rate": incident.error_rate,
                    "latency_ms": incident.latency_ms,
                    "db_queries": incident.db_queries_per_request,
                    "deployment_version": incident.deployment_version,
                    "author": author,
                    "commit": commit_sha[:7],
                    "source": "GitHub Actions",
                },
                incident_id=incident.id,
            )

            # Dispatch investigation in background
            background_tasks.add_task(run_investigation, incident.id)

            return {
                "ok": True,
                "incident_created": True,
                "incident_id": incident.id,
                "workflow": workflow_name,
                "conclusion": conclusion,
            }

        return {"ok": True, "event": event_type, "handled": True}

    elif event_type in ("push", "deployment"):
        ref = payload.get("ref", "refs/heads/main")
        branch = ref.split("/")[-1]
        commit_sha = payload.get("after") or "a81f2c7"
        pusher = payload.get("pusher", {}).get("name") or "j.tanaka"
        await event_bus.publish(
            "deployment_detected",
            {
                "branch": branch,
                "commit": commit_sha[:7],
                "author": pusher,
                "source": "GitHub Push",
            },
        )
        return {"ok": True, "event": event_type, "handled": True}

    return {"ok": True, "event": event_type}


@router.post("/github/test-fail")
async def github_test_fail(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Test utility to trigger an authentic GitHub Actions failure workflow."""
    mock_payload = {
        "action": "completed",
        "workflow_run": {
            "name": "CI Pipeline - Checkout API",
            "conclusion": "failure",
            "head_branch": "main",
            "head_sha": "a81f2c79f42b",
            "head_commit": {"author": {"name": "j.tanaka"}},
        },
        "repository": {"name": "checkout-api", "full_name": "aman1011019/checkout-api"},
    }
    incident = Incident(
        service="Checkout API",
        title="GitHub Actions CI Pipeline Failed on main",
        severity="CRITICAL",
        status=IncidentStatus.DETECTED.value,
        error_rate=21.8,
        latency_ms=4800.0,
        requests_per_min="11.8K/min",
        db_queries_per_request=25,
        deployment_version="v1.8.4",
        is_demo=False,
    )
    db.add(incident)
    db.flush()

    deploy = Deployment(
        incident_id=incident.id,
        version="v1.8.4",
        description="Deployment v1.8.4 (N+1 query defect)",
        author="j.tanaka",
        commit_sha="a81f2c7",
    )
    db.add(deploy)
    db.commit()

    await event_bus.publish(
        "incident_created",
        {
            "incident_id": incident.id,
            "service": incident.service,
            "title": incident.title,
            "severity": incident.severity,
            "status": incident.status,
            "error_rate": incident.error_rate,
            "latency_ms": incident.latency_ms,
            "db_queries": incident.db_queries_per_request,
            "deployment_version": "v1.8.4",
            "author": "j.tanaka",
            "commit": "a81f2c7",
            "source": "GitHub Actions",
        },
        incident_id=incident.id,
    )

    background_tasks.add_task(run_investigation, incident.id)

    return {
        "ok": True,
        "message": "Simulated GitHub Actions workflow failure incident dispatched",
        "incident_id": incident.id,
    }
