"""Incident endpoints — the core REST surface the frontend drives.

Read: list / detail / metrics / logs / evidence / investigation / root-cause /
fix / tests / report. Action: investigate / generate-fix / approve-fix /
reject-fix / run-tests / analyze-image.

Security posture: the browser never supplies commands or code. Approving a fix
applies a *validated, pre-defined* patch inside an isolated sandbox workspace
(never the host), and production recovery only happens after the verification
suite passes. Human approval is mandatory before any of that runs.
"""
from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import HTMLResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.serialize import to_detail, to_summary
from app.core.database import get_db
from app.core.enums import ACTIVE_STATUSES, FixStatus, IncidentStatus
from app.models.models import (
    AgentRun,
    Evidence,
    Fix,
    Incident,
    Investigation,
    LogEntry,
    Metric,
    RootCause,
    TestRun,
)
from app.schemas.schemas import (
    ActionResponse,
    AgentRunOut,
    EvidenceGraph,
    EvidenceOut,
    FixOut,
    ImageAnalysisResponse,
    IncidentDetail,
    IncidentSummary,
    InvestigationOut,
    LogEntryOut,
    MetricPoint,
    RootCauseOut,
    TestRunOut,
)
from app.services import report as report_service
from app.services.image_analysis import analyze_image
from app.services.orchestrator import ensure_fix, run_investigation, run_tests_and_resolve
from app.services.ws_manager import ws_manager
from app.simulation import fixtures

router = APIRouter(prefix="/api/incidents", tags=["incidents"])


def _get_incident_or_404(db: Session, incident_id: int) -> Incident:
    incident = db.get(Incident, incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")
    return incident


def _get_fix_or_404(db: Session, incident_id: int) -> Fix:
    fix = db.scalars(select(Fix).where(Fix.incident_id == incident_id)).first()
    if fix is None:
        raise HTTPException(status_code=404, detail="No fix has been generated for this incident yet")
    return fix


# ── Static / literal routes (declared BEFORE dynamic /{incident_id}) ────────────
@router.get("", response_model=list[IncidentSummary])
@router.get("/", response_model=list[IncidentSummary], include_in_schema=False)
def list_incidents(db: Session = Depends(get_db)) -> list[IncidentSummary]:
    rows = db.scalars(select(Incident).order_by(Incident.detected_at.desc())).all()
    return [to_summary(r) for r in rows]


from pydantic import BaseModel
from typing import Optional


class ManualIncidentCreate(BaseModel):
    service: str = "Checkout API"
    severity: str = "CRITICAL"
    description: Optional[str] = "Manual incident reported"
    repository: Optional[str] = "checkout-api"
    branch: Optional[str] = "main"


@router.post("", response_model=IncidentDetail)
@router.post("/", response_model=IncidentDetail, include_in_schema=False)
async def create_incident(
    payload: Optional[ManualIncidentCreate] = None,
    db: Session = Depends(get_db),
) -> IncidentDetail:
    """Create a manual incident or inject demo incident."""
    from app.realtime.event_bus import event_bus
    from app.services.incident_service import create_demo_incident
    from app.simulation.engine import simulation

    if payload and payload.description and payload.description != "Manual incident reported":
        incident = Incident(
            service=payload.service,
            title=payload.description[:200],
            severity=payload.severity.upper(),
            status=IncidentStatus.DETECTED.value,
            error_rate=18.4,
            latency_ms=3900.0,
            requests_per_min="8.4K/min",
            db_queries_per_request=22,
            deployment_version="v1.8.4",
            is_demo=False,
        )
        db.add(incident)
        db.commit()
        db.refresh(incident)
    else:
        incident = create_demo_incident(db)
        simulation.break_service(incident.id)
        db.refresh(incident)

    detail = to_detail(incident)

    event_payload = {
        "incident_id": incident.id,
        "service": incident.service,
        "title": incident.title,
        "severity": incident.severity,
        "status": incident.status,
        "error_rate": incident.error_rate,
        "latency_ms": incident.latency_ms,
        "db_queries": incident.db_queries_per_request,
        "deployment_version": incident.deployment_version,
        "source": "Manual Report" if not incident.is_demo else "Demo Engine",
    }
    await event_bus.publish("incident_created", event_payload, incident_id=incident.id)
    await ws_manager.broadcast_global({
        "type": "incident_detected",
        "event": "incident_detected",
        **event_payload,
    })
    return detail


@router.get("/active", response_model=IncidentDetail | None)
def active_incident(db: Session = Depends(get_db)) -> IncidentDetail | None:
    inc = db.scalars(
        select(Incident)
        .where(Incident.status.in_([s.value for s in ACTIVE_STATUSES]))
        .order_by(Incident.detected_at.desc())
    ).first()
    return to_detail(inc) if inc else None


@router.post("/analyze-image", response_model=ImageAnalysisResponse)
async def analyze_error_image(
    file: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
) -> ImageAnalysisResponse:
    filename = "manual-scan"
    size = 0
    if file is not None:
        data = await file.read()
        size = len(data)
        filename = file.filename or filename
    return ImageAnalysisResponse(**analyze_image(filename, size, db))


# ── Detail + correlated signals ─────────────────────────────────────────────────
@router.get("/{incident_id}", response_model=IncidentDetail)
def get_incident(incident_id: int, db: Session = Depends(get_db)) -> IncidentDetail:
    return to_detail(_get_incident_or_404(db, incident_id))


@router.get("/{incident_id}/metrics")
def get_metrics(incident_id: int, db: Session = Depends(get_db)) -> dict:
    incident = _get_incident_or_404(db, incident_id)
    points = db.scalars(
        select(Metric).where(Metric.incident_id == incident_id).order_by(Metric.t)
    ).all()
    return {
        "points": [MetricPoint.model_validate(p).model_dump() for p in points],
        "current": {
            "latency_ms": incident.latency_ms,
            "error_rate": incident.error_rate,
            "db_queries_per_request": incident.db_queries_per_request,
            "db_latency_ms": incident.db_latency_ms,
            "requests_per_min": incident.requests_per_min,
        },
        "before": incident.metrics_before or dict(fixtures.HEALTHY_METRICS),
        "after": incident.metrics_after,
        "baseline": {
            "healthy": fixtures.HEALTHY_METRICS,
            "broken": fixtures.BROKEN_METRICS,
            "recovered": fixtures.RECOVERED_METRICS,
        },
    }


@router.get("/{incident_id}/logs", response_model=list[LogEntryOut])
def get_logs(incident_id: int, db: Session = Depends(get_db)) -> list[LogEntryOut]:
    _get_incident_or_404(db, incident_id)
    rows = db.scalars(
        select(LogEntry).where(LogEntry.incident_id == incident_id).order_by(LogEntry.id)
    ).all()
    return [LogEntryOut.model_validate(r) for r in rows]


@router.get("/{incident_id}/evidence")
def get_evidence(incident_id: int, db: Session = Depends(get_db)) -> dict:
    _get_incident_or_404(db, incident_id)
    rows = db.scalars(
        select(Evidence)
        .where(Evidence.incident_id == incident_id)
        .order_by(Evidence.relevance.desc())
    ).all()
    return {
        "items": [EvidenceOut.model_validate(r).model_dump() for r in rows],
        "graph": EvidenceGraph(**fixtures.EVIDENCE_GRAPH).model_dump(),
    }


@router.get("/{incident_id}/investigation", response_model=InvestigationOut)
def get_investigation(incident_id: int, db: Session = Depends(get_db)) -> InvestigationOut:
    incident = _get_incident_or_404(db, incident_id)
    agents = db.scalars(
        select(AgentRun).where(AgentRun.incident_id == incident_id).order_by(AgentRun.order_index)
    ).all()
    rc = db.scalars(select(RootCause).where(RootCause.incident_id == incident_id)).first()
    fix = db.scalars(select(Fix).where(Fix.incident_id == incident_id)).first()
    inv = db.scalars(
        select(Investigation).where(Investigation.incident_id == incident_id).order_by(Investigation.id.desc())
    ).first()

    return InvestigationOut(
        incident_id=incident_id,
        status=(inv.status if inv else incident.status),
        agents=[AgentRunOut.model_validate(a) for a in agents],
        root_cause=RootCauseOut.model_validate(rc) if rc else None,
        fix=FixOut.model_validate(fix) if fix else None,
    )


@router.get("/{incident_id}/root-cause", response_model=RootCauseOut)
def get_root_cause(incident_id: int, db: Session = Depends(get_db)) -> RootCauseOut:
    _get_incident_or_404(db, incident_id)
    rc = db.scalars(select(RootCause).where(RootCause.incident_id == incident_id)).first()
    if rc is None:
        raise HTTPException(status_code=404, detail="Root cause not yet determined")
    return RootCauseOut.model_validate(rc)


@router.get("/{incident_id}/fix", response_model=FixOut)
def get_fix(incident_id: int, db: Session = Depends(get_db)) -> FixOut:
    _get_incident_or_404(db, incident_id)
    return FixOut.model_validate(_get_fix_or_404(db, incident_id))


@router.get("/{incident_id}/test-run", response_model=TestRunOut)
@router.get("/{incident_id}/tests", response_model=TestRunOut)
def get_tests(incident_id: int, db: Session = Depends(get_db)) -> TestRunOut:
    _get_incident_or_404(db, incident_id)
    tr = db.scalars(
        select(TestRun).where(TestRun.incident_id == incident_id).order_by(TestRun.id.desc())
    ).first()
    if tr is None:
        raise HTTPException(status_code=404, detail="No test run for this incident yet")
    return TestRunOut.model_validate(tr)


@router.get("/{incident_id}/report", response_class=HTMLResponse)
@router.get("/{incident_id}/report.html", response_class=HTMLResponse)
def get_report_html(incident_id: int, db: Session = Depends(get_db)) -> HTMLResponse:
    html = report_service.render_report_html(db, incident_id)
    if html is None:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")
    return HTMLResponse(content=html)


# ── Actions ─────────────────────────────────────────────────────────────────────
@router.post("/{incident_id}/investigate", response_model=ActionResponse)
async def investigate(incident_id: int, db: Session = Depends(get_db)) -> ActionResponse:
    _get_incident_or_404(db, incident_id)
    asyncio.create_task(run_investigation(incident_id))
    return ActionResponse(
        status=IncidentStatus.INVESTIGATING.value,
        message="Investigation started — subscribe to the incident WebSocket for live agent events",
        incident_id=incident_id,
    )


@router.post("/{incident_id}/generate-fix", response_model=FixOut)
async def generate_fix(incident_id: int, db: Session = Depends(get_db)) -> FixOut:
    _get_incident_or_404(db, incident_id)
    fix = ensure_fix(incident_id)
    if fix is None:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")
    await ws_manager.broadcast(incident_id, {"type": "fix_generated", "incident_id": incident_id})
    return FixOut.model_validate(fix)


@router.post("/{incident_id}/approve-fix", response_model=ActionResponse)
async def approve_fix(incident_id: int, db: Session = Depends(get_db)) -> ActionResponse:
    """Human approval gate. Applies the validated patch in the sandbox only."""
    from datetime import datetime

    from app.testing import workspace

    incident = _get_incident_or_404(db, incident_id)
    fix = _get_fix_or_404(db, incident_id)

    # Apply the pre-validated patch to an isolated per-incident workspace.
    workspace.prepare_workspace(incident_id)
    patched_path = workspace.apply_fix(incident_id)

    fix.status = FixStatus.APPROVED.value
    fix.approved_at = datetime.utcnow()
    fix.workspace_path = str(patched_path)
    incident.status = IncidentStatus.TESTING.value
    db.commit()

    await ws_manager.broadcast(
        incident_id,
        {"type": "fix_approved", "incident_id": incident_id, "workspace": str(patched_path.name)},
    )
    return ActionResponse(
        status=IncidentStatus.TESTING.value,
        message="Fix approved and applied to sandbox — run verification to deploy",
        incident_id=incident_id,
    )


@router.post("/{incident_id}/reject-fix", response_model=ActionResponse)
async def reject_fix(incident_id: int, db: Session = Depends(get_db)) -> ActionResponse:
    incident = _get_incident_or_404(db, incident_id)
    fix = _get_fix_or_404(db, incident_id)
    fix.status = FixStatus.REJECTED.value
    if incident.status == IncidentStatus.TESTING.value:
        incident.status = IncidentStatus.FIX_READY.value
    db.commit()
    await ws_manager.broadcast(incident_id, {"type": "fix_rejected", "incident_id": incident_id})
    return ActionResponse(
        status=incident.status,
        message="Fix rejected — no changes were deployed",
        incident_id=incident_id,
    )


@router.post("/{incident_id}/run-tests", response_model=ActionResponse)
async def run_tests(incident_id: int, db: Session = Depends(get_db)) -> ActionResponse:
    _get_incident_or_404(db, incident_id)
    fix = _get_fix_or_404(db, incident_id)
    # Human-approval gate: verification only runs on an approved/applied fix.
    if fix.status not in (FixStatus.APPROVED.value, FixStatus.APPLIED.value):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Fix must be approved before tests can run (human approval required)",
        )
    asyncio.create_task(run_tests_and_resolve(incident_id))
    return ActionResponse(
        status=IncidentStatus.TESTING.value,
        message="Verification suite started — subscribe to the incident WebSocket for live results",
        incident_id=incident_id,
    )
