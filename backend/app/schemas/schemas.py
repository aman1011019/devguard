"""Pydantic schemas — the API response/request contract shared with the frontend."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ── Health ───────────────────────────────────────────────────────────────────
class HealthResponse(BaseModel):
    status: str = "healthy"
    app: str = "DevGuard"
    version: str = "2.0.0"
    database: str = "connected"
    websocket: str = "available"
    github: str = "demo"
    llm: str = "demo"
    demo_mode: bool = True
    ai_provider: str = "demo"
    ai_enabled: bool = False
    services_monitored: int = 5
    active_incidents: int = 1
    critical_services: int = 1
    investigating: int = 1
    resolved_today: int = 7
    system_health: float = 99.8


# ── Metrics ──────────────────────────────────────────────────────────────────
class MetricSnapshot(BaseModel):
    latency_ms: float
    error_rate: float
    db_queries_per_request: float
    db_latency_ms: float
    requests_per_min: str = "0"


class MetricPoint(ORMModel):
    t: int
    label: str
    phase: str
    latency_ms: float
    error_rate: float
    db_queries: float
    db_latency_ms: float


# ── Timeline / deployments / logs ─────────────────────────────────────────────
class TimelineEventOut(ORMModel):
    id: int
    time_label: str
    title: str
    detail: str
    kind: str
    order_index: int


class DeploymentOut(ORMModel):
    id: int
    version: str
    description: str
    author: str
    commit_sha: str
    timestamp: datetime


class LogEntryOut(ORMModel):
    id: int
    timestamp: str
    level: str
    service: str
    message: str


# ── Evidence ──────────────────────────────────────────────────────────────────
class EvidenceOut(ORMModel):
    id: int
    key: str
    type: str
    source: str
    agent: str
    timestamp: str
    relevance: float
    title: str
    content: str
    meta: dict[str, Any] = {}


class EvidenceGraphNode(BaseModel):
    id: str
    label: str
    type: str
    detail: str = ""
    evidence_key: Optional[str] = None


class EvidenceGraphEdge(BaseModel):
    source: str
    target: str
    label: str = ""


class EvidenceGraph(BaseModel):
    nodes: list[EvidenceGraphNode]
    edges: list[EvidenceGraphEdge]


# ── Agents / investigation ────────────────────────────────────────────────────
class AgentRunOut(ORMModel):
    id: int
    agent: str
    status: str
    finding: str
    detail: dict[str, Any] = {}
    confidence: Optional[float] = None
    order_index: int
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class InvestigationOut(BaseModel):
    incident_id: int
    status: str
    agents: list[AgentRunOut]
    root_cause: Optional["RootCauseOut"] = None
    fix: Optional["FixOut"] = None


# ── Root cause ────────────────────────────────────────────────────────────────
class AlternativeHypothesis(BaseModel):
    name: str
    confidence: float


class RootCauseOut(ORMModel):
    id: int
    title: str
    category: str
    file: str
    line: Optional[int] = None
    commit_sha: str
    confidence: float
    explanation: str
    reasons: list[str] = []
    evidence_ids: list[str] = []
    alternatives: list[AlternativeHypothesis] = []


# ── Fixes ─────────────────────────────────────────────────────────────────────
class FixOut(ORMModel):
    id: int
    file: str
    language: str
    risk: str
    expected_impact: str
    summary: str
    explanation: str
    before_code: str
    after_code: str
    diff: str
    status: str


# ── Tests ─────────────────────────────────────────────────────────────────────
class TestSuiteResult(BaseModel):
    name: str
    passed: int
    total: int
    status: str
    duration_ms: int = 0


class TestRunOut(ORMModel):
    id: int
    status: str
    suites: list[TestSuiteResult] = []
    total_passed: int
    total: int


# ── Incidents ─────────────────────────────────────────────────────────────────
class IncidentSummary(ORMModel):
    id: int
    service: str
    title: str
    severity: str
    status: str
    error_rate: float
    latency_ms: float
    requests_per_min: str
    root_cause_summary: Optional[str] = None
    confidence: Optional[float] = None
    deployment_version: str
    detected_at: datetime
    resolved_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None


class IncidentDetail(IncidentSummary):
    db_latency_ms: float
    db_queries_per_request: int
    recovery_version: str
    metrics_before: dict[str, Any] = {}
    metrics_after: Optional[dict[str, Any]] = None
    timeline: list[TimelineEventOut] = []
    deployments: list[DeploymentOut] = []


# ── Voice / image ─────────────────────────────────────────────────────────────
class VoiceCommandRequest(BaseModel):
    command: str = Field(..., min_length=1)


class VoiceCommandResponse(BaseModel):
    intent: str
    incident_id: Optional[int] = None
    response: str
    action: Optional[str] = None


class ImageAnalysisResponse(BaseModel):
    detected_service: str
    error_code: str
    message: str
    suggested_incident: Optional[int] = None
    confidence: float = 0.0
    detected_metrics: dict[str, Any] = {}


# ── Office Kit ────────────────────────────────────────────────────────────────
class OfficeKitStatus(BaseModel):
    connected: bool
    bridge: str
    machine: str
    project: str
    branch: str
    commit: str
    last_sync: Optional[str] = None
    latency_ms: int = 0


class OfficeKitSyncResponse(BaseModel):
    ok: bool
    action: str
    message: str
    detail: dict[str, Any] = {}


# ── Generic ───────────────────────────────────────────────────────────────────
class ActionResponse(BaseModel):
    ok: bool = True
    status: str
    message: str = ""
    incident_id: Optional[int] = None


InvestigationOut.model_rebuild()
