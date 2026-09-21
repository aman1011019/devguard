"""Global search endpoint across incidents, services, commits, and evidence."""
from __future__ import annotations

from typing import Any, Dict, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import Incident, Deployment, Evidence

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("")
@router.get("/")
async def search_all(
    q: str = Query(..., min_length=1, description="Search query"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    query_str = f"%{q.strip()}%"

    # Search Incidents
    incidents = db.scalars(
        select(Incident)
        .where(
            or_(
                Incident.title.ilike(query_str),
                Incident.service.ilike(query_str),
                Incident.root_cause_summary.ilike(query_str),
                Incident.severity.ilike(query_str),
            )
        )
        .limit(6)
    ).all()

    # Search Deployments
    deployments = db.scalars(
        select(Deployment)
        .where(
            or_(
                Deployment.version.ilike(query_str),
                Deployment.commit_sha.ilike(query_str),
                Deployment.author.ilike(query_str),
                Deployment.description.ilike(query_str),
            )
        )
        .limit(6)
    ).all()

    # Search Evidence
    evidence_items = db.scalars(
        select(Evidence)
        .where(
            or_(
                Evidence.title.ilike(query_str),
                Evidence.content.ilike(query_str),
                Evidence.key.ilike(query_str),
                Evidence.source.ilike(query_str),
            )
        )
        .limit(6)
    ).all()

    # Fixed core services check
    core_services = [
        {"id": "checkout-api", "name": "Checkout API", "status": "CRITICAL"},
        {"id": "payments-api", "name": "Payments API", "status": "HEALTHY"},
        {"id": "auth-service", "name": "Auth Service", "status": "HEALTHY"},
        {"id": "orders-service", "name": "Orders Service", "status": "DEGRADED"},
        {"id": "database-aurora", "name": "Database", "status": "DEGRADED"},
    ]
    matched_services = [
        s for s in core_services if q.lower() in s["name"].lower() or q.lower() in s["id"].lower()
    ]

    # Search Active Codebase files & symbols
    from app.api.codebase import _ACTIVE_CODE_INDEX
    matched_code = []
    if _ACTIVE_CODE_INDEX:
        files = _ACTIVE_CODE_INDEX.get("files", [])
        for f in files:
            file_path = f.get("path", "")
            if q.lower() in file_path.lower():
                matched_code.append({
                    "type": "file",
                    "path": file_path,
                    "language": f.get("language", ""),
                    "lines": f.get("lines", 0),
                })
            for sym in f.get("functions", []) + f.get("classes", []):
                if q.lower() in sym.lower():
                    matched_code.append({
                        "type": "symbol",
                        "symbol": sym,
                        "path": file_path,
                        "language": f.get("language", ""),
                    })
            if len(matched_code) >= 6:
                break

    # Search Recent Events and Logs
    from app.realtime.event_store import event_store
    matched_logs = []
    try:
        events = event_store.get_events(limit=50)
        for ev in events:
            ev_str = str(ev.get("message") or ev.get("content") or ev.get("payload") or ev.get("event") or "")
            if q.lower() in ev_str.lower():
                matched_logs.append({
                    "event_id": ev.get("event_id"),
                    "timestamp": ev.get("timestamp"),
                    "event": ev.get("event"),
                    "message": ev.get("message") or str(ev.get("payload", ""))[:120],
                    "incident_id": ev.get("incident_id"),
                })
            if len(matched_logs) >= 6:
                break
    except Exception:
        pass

    return {
        "query": q,
        "results": {
            "incidents": [
                {
                    "id": inc.id,
                    "service": inc.service,
                    "title": inc.title,
                    "severity": inc.severity,
                    "status": inc.status,
                    "deployment": inc.deployment_version,
                }
                for inc in incidents
            ],
            "services": matched_services,
            "deployments": [
                {
                    "version": d.version,
                    "commit_sha": d.commit_sha,
                    "author": d.author,
                    "description": d.description,
                    "incident_id": d.incident_id,
                }
                for d in deployments
            ],
            "evidence": [
                {
                    "id": ev.id,
                    "key": ev.key,
                    "title": ev.title,
                    "type": ev.type,
                    "incident_id": ev.incident_id,
                }
                for ev in evidence_items
            ],
            "code": matched_code[:6],
            "logs": matched_logs[:6],
        },
    }

