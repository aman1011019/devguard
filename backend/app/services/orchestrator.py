"""Investigation orchestrator.

Runs the multi-agent pipeline as an asyncio task, orchestrating:
Log Agent + Code Agent + Telemetry Agent concurrently -> Reasoning Agent -> Fix Agent
Persists each step and emits WebSocket events through the real-time EventBus.
"""
from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Optional

from sqlalchemy import select

from app.agents.code_agent import CodeAgent
from app.agents.fix_agent import FixAgent
from app.agents.log_agent import LogAgent
from app.agents.reasoning_agent import ReasoningAgent
from app.agents.telemetry_agent import TelemetryAgent
from app.core.config import settings
from app.core.database import SessionLocal
from app.core.enums import AgentStatus, FixStatus, IncidentStatus, TestStatus
from app.models.models import (
    AgentRun,
    Fix,
    Incident,
    Investigation,
    Metric,
    RootCause,
    TestRun,
    TimelineEvent,
)
from app.providers.factory import get_provider
from app.realtime.event_bus import event_bus
from app.services.ws_manager import ws_manager
from app.simulation import fixtures
from app.simulation.engine import simulation
from app.testing import runner, workspace

# Guard against concurrent duplicate runs per incident.
_running: set[int] = set()


async def _emit(incident_id: int, event: dict) -> None:
    ev_type = event.get("event") or event.get("type") or "event"
    await event_bus.publish(ev_type, event, incident_id=incident_id)


def _persist_root_cause(db, incident: Incident, detail: dict) -> RootCause:
    rc_data = detail.get("root_cause")
    if isinstance(rc_data, str):
        rc_title = rc_data
        rc_category = "Code Regression"
        rc_file = detail.get("affected_files", ["unknown"])[0] if detail.get("affected_files") else "unknown"
        rc_line = 42
        rc_commit = incident.commit_sha or "HEAD"
        rc_explanation = f"Root cause correlated to {rc_title}"
        rc_reasons = ["Correlated by DevGuard Multi-Agent Swarm"]
        rc_evidence = detail.get("evidence_ids", [])
        rc_alternatives = []
    else:
        rc_data = rc_data or {}
        rc_title = rc_data.get("title") or detail.get("root_cause") or "Identified Regression"
        rc_category = rc_data.get("category", "Code Regression")
        rc_file = rc_data.get("file", "unknown")
        rc_line = rc_data.get("line", 42)
        rc_commit = rc_data.get("commit_sha", incident.commit_sha or "HEAD")
        rc_explanation = rc_data.get("explanation", "")
        rc_reasons = rc_data.get("reasons", [])
        rc_evidence = rc_data.get("evidence_ids", detail.get("evidence_ids", []))
        rc_alternatives = rc_data.get("alternatives", [])

    rc = RootCause(
        incident_id=incident.id,
        title=rc_title,
        category=rc_category,
        file=rc_file,
        line=rc_line,
        commit_sha=rc_commit,
        confidence=detail.get("confidence", 0.95),
        explanation=rc_explanation,
        reasons=rc_reasons,
        evidence_ids=rc_evidence,
        alternatives=rc_alternatives,
    )
    db.add(rc)
    incident.confidence = detail.get("confidence", 0.95)
    incident.root_cause_summary = rc_title
    return rc


def _persist_fix(db, incident: Incident, fix_data: dict) -> Fix:
    fix = Fix(
        incident_id=incident.id,
        file=fix_data["file"],
        language=fix_data.get("language", "java"),
        risk=fix_data.get("risk", "LOW"),
        expected_impact=fix_data.get("expected_impact", ""),
        summary=fix_data.get("summary", ""),
        explanation=fix_data.get("explanation", ""),
        before_code=fix_data.get("before_code", ""),
        after_code=fix_data.get("after_code", ""),
        diff=fix_data.get("diff", ""),
        status=FixStatus.PROPOSED.value,
    )
    db.add(fix)
    return fix


async def run_investigation(
    incident_id: int,
    workflow_run_id: Optional[str] = None,
    repo: Optional[str] = None,
    commit_sha: Optional[str] = None,
) -> None:
    if incident_id in _running:
        return
    _running.add(incident_id)
    provider = get_provider()
    db = SessionLocal()
    try:
        incident = db.get(Incident, incident_id)
        if incident is None:
            return

        if workflow_run_id:
            setattr(incident, "workflow_run_id", workflow_run_id)
        if repo and not incident.repository:
            incident.repository = repo
        if commit_sha and not incident.commit_sha:
            incident.commit_sha = commit_sha
        db.commit()

        # Reset any prior investigation artifacts (supports re-runs).
        for model in (AgentRun, RootCause, Fix, TestRun):
            for row in db.scalars(select(model).where(model.incident_id == incident_id)).all():
                db.delete(row)
        incident.status = IncidentStatus.INVESTIGATING.value
        investigation = Investigation(incident_id=incident_id, status="RUNNING")
        db.add(investigation)
        db.commit()

        await _emit(incident_id, {"type": "investigation_started", "incident_id": incident_id})

        # ── Phase 1: Parallel Diagnostic Swarm (Log, Code, Telemetry) ────────
        first_phase_agents = [
            (0, LogAgent(provider)),
            (1, CodeAgent(provider)),
            (2, TelemetryAgent(provider)),
        ]

        runs = {}
        for idx, agent in first_phase_agents:
            run = AgentRun(
                incident_id=incident_id,
                agent=agent.agent_type.value,
                status=AgentStatus.RUNNING.value,
                order_index=idx,
                started_at=datetime.utcnow(),
            )
            db.add(run)
            db.commit()
            runs[idx] = run

            await _emit(
                incident_id,
                {
                    "type": "agent_started",
                    "agent": agent.agent_type.value,
                    "label": agent.label,
                    "message": agent.running_message,
                    "order_index": idx,
                },
            )

        # Broadcast progress
        await asyncio.sleep(min(0.6, settings.agent_step_seconds / 2))
        for idx, agent in first_phase_agents:
            await _emit(
                incident_id,
                {
                    "type": "agent_progress",
                    "agent": agent.agent_type.value,
                    "progress": 55,
                    "order_index": idx,
                },
            )

        await asyncio.sleep(settings.agent_step_seconds)

        # Run analysis for first phase
        for idx, agent in first_phase_agents:
            result = agent.analyze(incident, db)
            run = runs[idx]
            run.status = AgentStatus.COMPLETE.value
            run.finding = result.finding
            run.detail = result.detail
            run.confidence = result.confidence
            run.completed_at = datetime.utcnow()
            db.commit()

            await _emit(
                incident_id,
                {
                    "type": "agent_completed",
                    "agent": agent.agent_type.value,
                    "label": agent.label,
                    "finding": result.finding,
                    "detail": result.detail,
                    "confidence": result.confidence,
                    "order_index": idx,
                },
            )

        # ── Phase 2: Reasoning Agent (Correlates Evidence) ────────────────────
        reasoning_agent = ReasoningAgent(provider)
        reasoning_run = AgentRun(
            incident_id=incident_id,
            agent=reasoning_agent.agent_type.value,
            status=AgentStatus.RUNNING.value,
            order_index=3,
            started_at=datetime.utcnow(),
        )
        db.add(reasoning_run)
        db.commit()

        await _emit(
            incident_id,
            {
                "type": "agent_started",
                "agent": reasoning_agent.agent_type.value,
                "label": reasoning_agent.label,
                "message": reasoning_agent.running_message,
                "order_index": 3,
            },
        )

        await asyncio.sleep(settings.agent_step_seconds)
        reasoning_res = reasoning_agent.analyze(incident, db)

        reasoning_run.status = AgentStatus.COMPLETE.value
        reasoning_run.finding = reasoning_res.finding
        reasoning_run.detail = reasoning_res.detail
        reasoning_run.confidence = reasoning_res.confidence
        reasoning_run.completed_at = datetime.utcnow()

        _persist_root_cause(db, incident, reasoning_res.detail)
        incident.status = IncidentStatus.ROOT_CAUSE_FOUND.value
        db.commit()

        await _emit(
            incident_id,
            {
                "type": "root_cause_found",
                "root_cause": reasoning_res.detail.get("root_cause", {}).get("title")
                if isinstance(reasoning_res.detail.get("root_cause"), dict)
                else reasoning_res.detail.get("root_cause"),
                "file": reasoning_res.detail.get("affected_files", ["unknown"])[0]
                if reasoning_res.detail.get("affected_files")
                else "unknown",
                "confidence": reasoning_res.confidence,
            },
        )

        await _emit(
            incident_id,
            {
                "type": "agent_completed",
                "agent": reasoning_agent.agent_type.value,
                "label": reasoning_agent.label,
                "finding": reasoning_res.finding,
                "detail": reasoning_res.detail,
                "confidence": reasoning_res.confidence,
                "order_index": 3,
            },
        )

        # ── Phase 3: Fix Agent (Synthesizes Reviewable Patch) ────────────────
        fix_agent = FixAgent(provider)
        fix_run = AgentRun(
            incident_id=incident_id,
            agent=fix_agent.agent_type.value,
            status=AgentStatus.RUNNING.value,
            order_index=4,
            started_at=datetime.utcnow(),
        )
        db.add(fix_run)
        db.commit()

        await _emit(
            incident_id,
            {
                "type": "agent_started",
                "agent": fix_agent.agent_type.value,
                "label": fix_agent.label,
                "message": fix_agent.running_message,
                "order_index": 4,
            },
        )

        await asyncio.sleep(settings.agent_step_seconds)
        fix_res = fix_agent.analyze(incident, db)

        fix_run.status = AgentStatus.COMPLETE.value
        fix_run.finding = fix_res.finding
        fix_run.detail = fix_res.detail
        fix_run.confidence = fix_res.confidence
        fix_run.completed_at = datetime.utcnow()

        fix_data = fix_res.detail["fix"]
        _persist_fix(db, incident, fix_data)
        incident.status = IncidentStatus.FIX_READY.value
        db.commit()

        await _emit(
            incident_id,
            {
                "type": "fix_generated",
                "incident_id": incident_id,
                "file": fix_data.get("file"),
                "risk": fix_data.get("risk"),
            },
        )

        await _emit(
            incident_id,
            {
                "type": "agent_completed",
                "agent": fix_agent.agent_type.value,
                "label": fix_agent.label,
                "finding": fix_res.finding,
                "detail": fix_res.detail,
                "confidence": fix_res.confidence,
                "order_index": 4,
            },
        )

        investigation.status = "COMPLETE"
        investigation.completed_at = datetime.utcnow()
        db.commit()

        await _emit(
            incident_id,
            {"type": "investigation_completed", "incident_id": incident_id, "status": incident.status},
        )
    except Exception as exc:
        db.rollback()
        await _emit(incident_id, {"type": "investigation_error", "error": str(exc)})
    finally:
        db.close()
        _running.discard(incident_id)


def ensure_fix(incident_id: int) -> Fix | None:
    """Idempotently ensure a Fix exists (used by the generate-fix endpoint)."""
    db = SessionLocal()
    try:
        incident = db.get(Incident, incident_id)
        if incident is None:
            return None
        fix = db.scalars(select(Fix).where(Fix.incident_id == incident_id)).first()
        if fix is None:
            fix_res = FixAgent(get_provider()).analyze(incident, db)
            fix_data = fix_res.detail["fix"]
            fix = _persist_fix(db, incident, fix_data)
            if incident.status in (IncidentStatus.ROOT_CAUSE_FOUND.value, IncidentStatus.INVESTIGATING.value):
                incident.status = IncidentStatus.FIX_READY.value
            db.commit()
            db.refresh(fix)
        return fix
    finally:
        db.close()


async def run_tests_and_resolve(incident_id: int) -> None:
    """Execute the verification suite; on success recover the service."""
    if incident_id in _running:
        return
    _running.add(incident_id)
    db = SessionLocal()
    try:
        incident = db.get(Incident, incident_id)
        if incident is None:
            return

        incident.status = IncidentStatus.TESTING.value
        for row in db.scalars(select(TestRun).where(TestRun.incident_id == incident_id)).all():
            db.delete(row)
        test_run = TestRun(incident_id=incident_id, status=TestStatus.RUNNING.value, started_at=datetime.utcnow())
        db.add(test_run)
        db.commit()

        async def emit(event: dict) -> None:
            await _emit(incident_id, event)

        result = await runner.run_verification(incident_id, emit)

        test_run.status = TestStatus.PASSED.value if result["passed"] else TestStatus.FAILED.value
        test_run.suites = result["suites"]
        test_run.total_passed = result["total_passed"]
        test_run.total = result["total"]
        test_run.completed_at = datetime.utcnow()

        if result["passed"]:
            simulation.recover_service()
            rec = fixtures.RECOVERED_METRICS
            incident.status = IncidentStatus.RESOLVED.value
            incident.resolved_at = datetime.utcnow()
            incident.duration_seconds = fixtures.RECOVERY_DURATION_SECONDS
            incident.metrics_after = dict(rec)
            incident.latency_ms = rec["latency_ms"]
            incident.error_rate = rec["error_rate"]
            incident.db_latency_ms = rec["db_latency_ms"]
            incident.db_queries_per_request = rec["db_queries_per_request"]
            incident.requests_per_min = rec["requests_per_min"]

            # Append recovery telemetry points
            for pt in simulation.recovery_timeseries():
                db.add(
                    Metric(
                        incident_id=incident_id,
                        t=pt["t"],
                        label=pt["label"],
                        phase="after",
                        latency_ms=pt["latency_ms"],
                        error_rate=pt["error_rate"],
                        db_queries=pt["db_queries"],
                        db_latency_ms=pt["db_latency_ms"],
                    )
                )
            db.add(
                TimelineEvent(
                    incident_id=incident_id,
                    time_label=datetime.utcnow().strftime("%H:%M"),
                    title=f"Recovery deployment {incident.recovery_version or 'v1.8.5'} verified",
                    detail=f"{result['total_passed']}/{result['total']} tests passed — service healthy",
                    kind="action",
                    order_index=99,
                )
            )
            # Mark fix applied
            fix = db.scalars(select(Fix).where(Fix.incident_id == incident_id)).first()
            if fix:
                fix.status = FixStatus.APPLIED.value
            db.commit()

            await _emit(
                incident_id,
                {
                    "type": "incident_resolved",
                    "incident_id": incident_id,
                    "recovery_version": incident.recovery_version or "v1.8.5",
                    "duration_seconds": fixtures.RECOVERY_DURATION_SECONDS,
                },
            )
        else:
            incident.status = IncidentStatus.FAILED.value
            db.commit()
            await _emit(incident_id, {"type": "incident_failed", "incident_id": incident_id})
    except Exception as exc:
        db.rollback()
        await _emit(incident_id, {"type": "test_error", "error": str(exc)})
    finally:
        db.close()
        _running.discard(incident_id)
