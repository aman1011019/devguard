"""Agent base class and shared result type."""
from __future__ import annotations

from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.enums import AgentType
from app.models.models import Incident
from app.providers.base import LLMProvider


@dataclass
class AgentResult:
    finding: str
    detail: dict = field(default_factory=dict)
    confidence: float = 0.0
    evidence_ids: list[str] = field(default_factory=list)


class Agent:
    agent_type: AgentType
    emoji: str = "🤖"
    label: str = "Agent"
    running_message: str = "Working..."

    def __init__(self, provider: LLMProvider) -> None:
        self.provider = provider

    def analyze(self, incident: Incident, db: Session) -> AgentResult:  # pragma: no cover
        raise NotImplementedError

    # Optional narrative enrichment — only touches the network when a real
    # provider is configured; otherwise returns the deterministic fallback.
    def _enrich(self, system: str, user: str, fallback: str) -> str:
        if not settings.ai_enabled:
            return fallback
        return self.provider.enrich(system, user, fallback)
