"""Incident service — creation, seeding and lookups.

Creating a demo incident deterministically populates every correlated signal:
deployments, logs, metric time-series, timeline and evidence.
"""
from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.enums import ACTIVE_STATUSES, IncidentStatus
from app.models.models import (
    AgentRun,
    Deployment,
    Evidence,
    Fix,
    Incident,
    LogEntry,
    Metric,
    RootCause,
    TestRun,
    TimelineEvent,
)
from app.simulation import fixtures
from app.simulation.engine import simulation


def _clear_incident_children(db: Session, incident_id: int) -> None:
    for model in (Evidence, AgentRun, LogEntry, Metric, Deployment, TimelineEvent, RootCause, Fix, TestRun):
        for row in db.scalars(select(model).where(model.incident_id == incident_id)).all():
            db.delete(row)


def create_demo_incident(db: Session) -> Incident:
    """Create the flagship broken-checkout incident with all evidence."""
    now = datetime.utcnow()
    broken = fixtures.BROKEN_METRICS

    incident = Incident(
        service=fixtures.SERVICE,
        title=fixtures.INCIDENT_TITLE,
        severity=fixtures.SEVERITY,
        status=IncidentStatus.DETECTED.value,
        error_rate=broken["error_rate"],
        latency_ms=broken["latency_ms"],
        requests_per_min=broken["requests_per_min"],
        db_latency_ms=broken["db_latency_ms"],
        db_queries_per_request=broken["db_queries_per_request"],
        deployment_version=fixtures.BAD_DEPLOYMENT,
        recovery_version=fixtures.RECOVERY_DEPLOYMENT,
        metrics_before=dict(fixtures.HEALTHY_METRICS),
        metrics_after=None,
        detected_at=now,
        is_demo=True,
    )
    db.add(incident)
    db.flush()  # assign id

    # Deployments (fixture git history)
    for dep in fixtures.DEPLOYMENTS:
        db.add(
            Deployment(
                incident_id=incident.id,
                version=dep["version"],
                description=dep["description"],
                author=dep["author"],
                commit_sha=dep["commit_sha"],
                timestamp=now + timedelta(minutes=dep["offset_min"]),
            )
        )

    # Logs
    for log in fixtures.LOGS:
        db.add(
            LogEntry(
                incident_id=incident.id,
                timestamp=log["timestamp"],
                level=log["level"],
                message=log["message"],
                service="checkout-service",
            )
        )

    # Metric time-series
    for pt in simulation.build_timeseries():
        db.add(
            Metric(
                incident_id=incident.id,
                t=pt["t"],
                label=pt["label"],
                phase=pt["phase"],
                latency_ms=pt["latency_ms"],
                error_rate=pt["error_rate"],
                db_queries=pt["db_queries"],
                db_latency_ms=pt["db_latency_ms"],
            )
        )

    # Timeline
    for idx, ev in enumerate(fixtures.TIMELINE):
        db.add(
            TimelineEvent(
                incident_id=incident.id,
                time_label=ev["time_label"],
                title=ev["title"],
                detail=ev["detail"],
                kind=ev["kind"],
                order_index=idx,
            )
        )

    # Evidence
    for ev in fixtures.EVIDENCE:
        db.add(
            Evidence(
                incident_id=incident.id,
                key=ev["key"],
                type=ev["type"],
                source=ev["source"],
                agent=ev["agent"],
                timestamp=ev["timestamp"],
                relevance=ev["relevance"],
                title=ev["title"],
                content=ev["content"],
                meta=ev.get("meta", {}),
            )
        )

    db.commit()
    db.refresh(incident)

    # Flip the controlled service into its broken state.
    simulation.break_service(incident.id)
    return incident


def seed_historical(db: Session) -> None:
    """Seed a couple of already-resolved incidents for the list/history views."""
    existing = db.scalar(select(func.count(Incident.id)))
    if existing and existing > 0:
        return

    now = datetime.utcnow()
    resolved = [
        {
            "id": 1041,
            "service": "Payment API",
            "title": "Payment API Latency",
            "severity": "HIGH",
            "root_cause_summary": "Database Timeout",
            "confidence": 0.91,
            "error_rate": 0.6,
            "latency_ms": 240.0,
            "requests_per_min": "6.1K/min",
            "deployment_version": "v2.3.1",
            "duration": 512,
            "ago_min": 60 * 26,
        },
        {
            "id": 1040,
            "service": "Search API",
            "title": "Search Cache Stampede",
            "severity": "MEDIUM",
            "root_cause_summary": "Cache Stampede",
            "confidence": 0.88,
            "error_rate": 0.4,
            "latency_ms": 180.0,
            "requests_per_min": "9.7K/min",
            "deployment_version": "v4.1.0",
            "duration": 386,
            "ago_min": 60 * 51,
        },
    ]
    for r in resolved:
        detected = now - timedelta(minutes=r["ago_min"])
        inc = Incident(
            id=r["id"],
            service=r["service"],
            title=r["title"],
            severity=r["severity"],
            status=IncidentStatus.RESOLVED.value,
            error_rate=r["error_rate"],
            latency_ms=r["latency_ms"],
            requests_per_min=r["requests_per_min"],
            db_latency_ms=45.0,
            db_queries_per_request=3,
            deployment_version=r["deployment_version"],
            recovery_version="",
            metrics_before=dict(fixtures.HEALTHY_METRICS),
            metrics_after=dict(fixtures.RECOVERED_METRICS),
            root_cause_summary=r["root_cause_summary"],
            confidence=r["confidence"],
            detected_at=detected,
            resolved_at=detected + timedelta(seconds=r["duration"]),
            duration_seconds=r["duration"],
            is_demo=False,
        )
        db.add(inc)
    db.commit()


def get_incident(db: Session, incident_id: int) -> Incident | None:
    return db.get(Incident, incident_id)


def count_active(db: Session) -> int:
    statuses = [s.value for s in ACTIVE_STATUSES]
    return db.scalar(
        select(func.count(Incident.id)).where(Incident.status.in_(statuses))
    ) or 0
