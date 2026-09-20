"""Investigation orchestrator.

Runs the agent pipeline as an asyncio task, persisting each step and emitting
the WebSocket event stream the frontend animates against. Also drives the
approve -> test -> resolve verification flow.
"""
from __future__ import annotations

import asyncio
from datetime import datetime

from sqlalchemy import select

from app.agents.registry import INVESTIGATION_SEQUENCE
from app.agents.reasoning_agent import ReasoningAgent
from app.agents.fix_agent import FixAgent
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
from app.services.ws_manager import ws_manager
from app.simulation import fixtures
from app.simulation.engine import simulation
from app.testing import runner, workspace

# Guard against concurrent duplicate runs per incident.
_running: set[int] = set()


async def _emit(incident_id: int, event: dict) -> None:
    await ws_manager.broadcast(incident_id, event)


def _persist_root_cause(db, incident: Incident, detail: dict) -> RootCause:
    rc_data = detail["root_cause"]
    rc = RootCause(
        incident_id=incident.id,
        title=rc_data["title"],
        category=rc_data.get("category", ""),
        file=rc_data.get("file", ""),
        line=rc_data.get("line"),
        commit_sha=rc_data.get("commit_sha", ""),
        confidence=rc_data["confidence"],
        explanation=rc_data.get("explanation", ""),
        reasons=rc_data.get("reasons", []),
        evidence_ids=rc_data.get("evidence_ids", []),
        alternatives=rc_data.get("alternatives", []),
    )
    db.add(rc)
    incident.confidence = rc_data["confidence"]
    incident.root_cause_summary = rc_data["title"]
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


async def run_investigation(incident_id: int) -> None:
    if incident_id in _running:
        return
    _running.add(incident_id)
    provider = get_provider()
    db = SessionLocal()
    try:
        incident = db.get(Incident, incident_id)
        if incident is None:
            return

        # Reset any prior investigation artifacts (supports re-runs).
        for model in (AgentRun, RootCause, Fix, TestRun):
            for row in db.scalars(select(model).where(model.incident_id == incident_id)).all():
                db.delete(row)
        incident.status = IncidentStatus.INVESTIGATING.value
        investigation = Investigation(incident_id=incident_id, status="RUNNING")
        db.add(investigation)
        db.commit()

        await _emit(incident_id, {"type": "investigation_started", "incident_id": incident_id})

        for idx, agent_cls in enumerate(INVESTIGATION_SEQUENCE):
            agent = agent_cls(provider)
            run = AgentRun(
                incident_id=incident_id,
                agent=agent.agent_type.value,
                status=AgentStatus.RUNNING.value,
                order_index=idx,
                started_at=datetime.utcnow(),
            )
            db.add(run)
            db.commit()
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

            await asyncio.sleep(settings.agent_step_seconds)

            result = agent.analyze(incident, db)

            run.status = AgentStatus.COMPLETE.value
            run.finding = result.finding
            run.detail = result.detail
            run.confidence = result.confidence
            run.completed_at = datetime.utcnow()

            # Side effects for the specialised agents.
            if isinstance(agent, ReasoningAgent):
                _persist_root_cause(db, incident, result.detail)
                incident.status = IncidentStatus.ROOT_CAUSE_FOUND.value
                db.commit()
                await _emit(
                    incident_id,
                    {
                        "type": "root_cause_found",
                        "root_cause": result.detail["root_cause"]["title"],
                        "file": result.detail["root_cause"].get("file"),
                        "line": result.detail["root_cause"].get("line"),
                        "confidence": result.confidence,
                    },
                )
            elif isinstance(agent, FixAgent):
                _persist_fix(db, incident, result.detail["fix"])
                incident.status = IncidentStatus.FIX_READY.value
                db.commit()
                await _emit(incident_id, {"type": "fix_generated", "incident_id": incident_id})
            else:
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

        investigation.status = "COMPLETE"
        investigation.completed_at = datetime.utcnow()
        db.commit()
        await _emit(
            incident_id,
            {"type": "investigation_completed", "incident_id": incident_id, "status": incident.status},
        )
    except Exception as exc:  # pragma: no cover - defensive
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
            fix_data = FixAgent(get_provider()).build_fix()
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
        # Clear prior test runs.
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

            # Append the recovery tail to the metric series.
            for pt in simulation.recovery_timeseries():
                db.add(
                    Metric(
                        incident_id=incident_id, t=pt["t"], label=pt["label"], phase="after",
                        latency_ms=pt["latency_ms"], error_rate=pt["error_rate"],
                        db_queries=pt["db_queries"], db_latency_ms=pt["db_latency_ms"],
                    )
                )
            db.add(
                TimelineEvent(
                    incident_id=incident_id, time_label="14:42",
                    title=f"Recovery deployment {fixtures.RECOVERY_DEPLOYMENT} verified",
                    detail="44/44 tests passed — service healthy", kind="action", order_index=99,
                )
            )
            # Mark the fix applied.
            fix = db.scalars(select(Fix).where(Fix.incident_id == incident_id)).first()
            if fix:
                fix.status = FixStatus.APPLIED.value
            db.commit()
            await _emit(
                incident_id,
                {
                    "type": "incident_resolved",
                    "incident_id": incident_id,
                    "recovery_version": fixtures.RECOVERY_DEPLOYMENT,
                    "duration_seconds": fixtures.RECOVERY_DURATION_SECONDS,
                },
            )
        else:
            incident.status = IncidentStatus.FAILED.value
            db.commit()
            await _emit(incident_id, {"type": "incident_failed", "incident_id": incident_id})
    except Exception as exc:  # pragma: no cover
        db.rollback()
        await _emit(incident_id, {"type": "test_error", "error": str(exc)})
    finally:
        db.close()
        _running.discard(incident_id)
