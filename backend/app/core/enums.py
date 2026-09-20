"""Shared domain enumerations.

Stored as plain strings in the database (portable across SQLite/PostgreSQL) and
serialised as-is over the API so the frontend can rely on stable string values.
"""
from __future__ import annotations

from enum import Enum


class Severity(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class IncidentStatus(str, Enum):
    """Lifecycle of an incident. Mirrors the frontend state machine."""

    HEALTHY = "HEALTHY"
    DETECTED = "DETECTED"
    INVESTIGATING = "INVESTIGATING"
    ROOT_CAUSE_FOUND = "ROOT_CAUSE_FOUND"
    FIX_READY = "FIX_READY"
    AWAITING_APPROVAL = "AWAITING_APPROVAL"
    TESTING = "TESTING"
    RESOLVED = "RESOLVED"
    FAILED = "FAILED"


# States in which the incident is still "open" / actionable.
ACTIVE_STATUSES = {
    IncidentStatus.DETECTED,
    IncidentStatus.INVESTIGATING,
    IncidentStatus.ROOT_CAUSE_FOUND,
    IncidentStatus.FIX_READY,
    IncidentStatus.AWAITING_APPROVAL,
    IncidentStatus.TESTING,
}


class AgentType(str, Enum):
    LOG_AGENT = "log_agent"
    CODE_AGENT = "code_agent"
    TELEMETRY_AGENT = "telemetry_agent"
    REASONING_AGENT = "reasoning_agent"
    FIX_AGENT = "fix_agent"
    TEST_AGENT = "test_agent"


class AgentStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETE = "COMPLETE"
    FAILED = "FAILED"


class EvidenceType(str, Enum):
    LOGS = "LOGS"
    GIT = "GIT"
    METRICS = "METRICS"
    TRACES = "TRACES"
    DATABASE = "DATABASE"
    CONFIG = "CONFIG"
    API = "API"


class FixStatus(str, Enum):
    PROPOSED = "PROPOSED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    APPLIED = "APPLIED"


class TestStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    PASSED = "PASSED"
    FAILED = "FAILED"


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
