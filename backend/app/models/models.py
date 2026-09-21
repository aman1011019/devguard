"""SQLAlchemy ORM models — the full DevGuard schema.

Tables: incidents, deployments, metrics, logs, evidence, investigations,
agent_runs, root_causes, fixes, test_runs.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def _utcnow() -> datetime:
    return datetime.utcnow()


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    service: Mapped[str] = mapped_column(String(120))
    title: Mapped[str] = mapped_column(String(240))
    severity: Mapped[str] = mapped_column(String(16), default="CRITICAL")
    status: Mapped[str] = mapped_column(String(32), default="DETECTED", index=True)

    # Live / "broken" metrics.
    error_rate: Mapped[float] = mapped_column(Float, default=0.0)
    latency_ms: Mapped[float] = mapped_column(Float, default=0.0)
    requests_per_min: Mapped[str] = mapped_column(String(32), default="0")
    db_latency_ms: Mapped[float] = mapped_column(Float, default=0.0)
    db_queries_per_request: Mapped[int] = mapped_column(Integer, default=0)

    deployment_version: Mapped[str] = mapped_column(String(32), default="")
    recovery_version: Mapped[str] = mapped_column(String(32), default="")

    # Snapshots for the before/after comparison (JSON metric dicts).
    metrics_before: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    metrics_after: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)

    root_cause_summary: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    detected_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    duration_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    # Real Codebase & Git connection fields
    repository: Mapped[Optional[str]] = mapped_column(String(240), nullable=True)
    branch: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    commit_sha: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    author: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)

    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)

    # Relationships
    evidence: Mapped[list["Evidence"]] = relationship(
        back_populates="incident", cascade="all, delete-orphan"
    )
    agent_runs: Mapped[list["AgentRun"]] = relationship(
        back_populates="incident", cascade="all, delete-orphan"
    )
    logs: Mapped[list["LogEntry"]] = relationship(
        back_populates="incident", cascade="all, delete-orphan"
    )
    metrics: Mapped[list["Metric"]] = relationship(
        back_populates="incident", cascade="all, delete-orphan"
    )
    deployments: Mapped[list["Deployment"]] = relationship(
        back_populates="incident", cascade="all, delete-orphan"
    )
    timeline: Mapped[list["TimelineEvent"]] = relationship(
        back_populates="incident", cascade="all, delete-orphan"
    )


class Deployment(Base):
    __tablename__ = "deployments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    incident_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("incidents.id"), nullable=True, index=True
    )
    version: Mapped[str] = mapped_column(String(32))
    description: Mapped[str] = mapped_column(String(240), default="")
    author: Mapped[str] = mapped_column(String(120), default="")
    commit_sha: Mapped[str] = mapped_column(String(16), default="")
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    incident: Mapped[Optional[Incident]] = relationship(back_populates="deployments")


class Metric(Base):
    """A single point on the incident time-series (used for charts)."""

    __tablename__ = "metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.id"), index=True)
    t: Mapped[int] = mapped_column(Integer)  # ordinal index along the timeline
    label: Mapped[str] = mapped_column(String(16), default="")  # e.g. "14:32"
    phase: Mapped[str] = mapped_column(String(16), default="before")  # before|after
    latency_ms: Mapped[float] = mapped_column(Float, default=0.0)
    error_rate: Mapped[float] = mapped_column(Float, default=0.0)
    db_queries: Mapped[float] = mapped_column(Float, default=0.0)
    db_latency_ms: Mapped[float] = mapped_column(Float, default=0.0)

    incident: Mapped[Incident] = relationship(back_populates="metrics")


class LogEntry(Base):
    __tablename__ = "logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.id"), index=True)
    timestamp: Mapped[str] = mapped_column(String(16))  # "14:35:22"
    level: Mapped[str] = mapped_column(String(8))  # INFO|WARN|ERROR
    service: Mapped[str] = mapped_column(String(60), default="checkout-service")
    message: Mapped[str] = mapped_column(Text)

    incident: Mapped[Incident] = relationship(back_populates="logs")


class Evidence(Base):
    __tablename__ = "evidence"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.id"), index=True)
    key: Mapped[str] = mapped_column(String(32), index=True)  # "log_12", "git_4"
    type: Mapped[str] = mapped_column(String(16))
    source: Mapped[str] = mapped_column(String(120))
    agent: Mapped[str] = mapped_column(String(60))
    timestamp: Mapped[str] = mapped_column(String(16), default="")
    relevance: Mapped[float] = mapped_column(Float, default=0.0)
    title: Mapped[str] = mapped_column(String(200))
    content: Mapped[str] = mapped_column(Text, default="")
    meta: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    incident: Mapped[Incident] = relationship(back_populates="evidence")


class Investigation(Base):
    __tablename__ = "investigations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.id"), index=True)
    status: Mapped[str] = mapped_column(String(16), default="RUNNING")
    started_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.id"), index=True)
    agent: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(16), default="PENDING")
    finding: Mapped[str] = mapped_column(Text, default="")
    detail: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    incident: Mapped[Incident] = relationship(back_populates="agent_runs")


class RootCause(Base):
    __tablename__ = "root_causes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.id"), index=True)
    title: Mapped[str] = mapped_column(String(120))
    category: Mapped[str] = mapped_column(String(60), default="")
    file: Mapped[str] = mapped_column(String(200), default="")
    line: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    commit_sha: Mapped[str] = mapped_column(String(16), default="")
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    explanation: Mapped[str] = mapped_column(Text, default="")
    reasons: Mapped[list[Any]] = mapped_column(JSON, default=list)
    evidence_ids: Mapped[list[Any]] = mapped_column(JSON, default=list)
    alternatives: Mapped[list[Any]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)


class Fix(Base):
    __tablename__ = "fixes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.id"), index=True)
    file: Mapped[str] = mapped_column(String(200))
    language: Mapped[str] = mapped_column(String(24), default="java")
    risk: Mapped[str] = mapped_column(String(16), default="LOW")
    expected_impact: Mapped[str] = mapped_column(String(200), default="")
    summary: Mapped[str] = mapped_column(String(240), default="")
    explanation: Mapped[str] = mapped_column(Text, default="")
    before_code: Mapped[str] = mapped_column(Text, default="")
    after_code: Mapped[str] = mapped_column(Text, default="")
    diff: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(16), default="PROPOSED")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    workspace_path: Mapped[Optional[str]] = mapped_column(String(400), nullable=True)


class TestRun(Base):
    __tablename__ = "test_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.id"), index=True)
    status: Mapped[str] = mapped_column(String(16), default="PENDING")
    suites: Mapped[list[Any]] = mapped_column(JSON, default=list)
    total_passed: Mapped[int] = mapped_column(Integer, default=0)
    total: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class TimelineEvent(Base):
    __tablename__ = "timeline_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.id"), index=True)
    time_label: Mapped[str] = mapped_column(String(16))  # "14:32"
    title: Mapped[str] = mapped_column(String(200))
    detail: Mapped[str] = mapped_column(String(240), default="")
    kind: Mapped[str] = mapped_column(String(24), default="event")  # event|deploy|alert|action
    order_index: Mapped[int] = mapped_column(Integer, default=0)

    incident: Mapped[Incident] = relationship(back_populates="timeline")
 
 
class Repository(Base):
    __tablename__ = "repositories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner: Mapped[str] = mapped_column(String(120), index=True)
    name: Mapped[str] = mapped_column(String(120), index=True)
    full_name: Mapped[str] = mapped_column(String(240), unique=True, index=True)
    url: Mapped[str] = mapped_column(String(300))
    default_branch: Mapped[str] = mapped_column(String(120), default="main")
    private: Mapped[bool] = mapped_column(Boolean, default=False)
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    stars_count: Mapped[int] = mapped_column(Integer, default=0)
    forks_count: Mapped[int] = mapped_column(Integer, default=0)
    open_issues_count: Mapped[int] = mapped_column(Integer, default=0)
    language: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    last_commit_sha: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    last_commit_message: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    connected_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
