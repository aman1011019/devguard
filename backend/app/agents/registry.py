"""Registry of the investigation agents in execution order."""
from __future__ import annotations

from app.agents.code_agent import CodeAgent
from app.agents.fix_agent import FixAgent
from app.agents.log_agent import LogAgent
from app.agents.reasoning_agent import ReasoningAgent
from app.agents.telemetry_agent import TelemetryAgent

# Order matters — this is the pipeline the orchestrator walks:
# Log -> Code -> Telemetry -> Reasoning -> Fix
INVESTIGATION_SEQUENCE = [
    LogAgent,
    CodeAgent,
    TelemetryAgent,
    ReasoningAgent,
    FixAgent,
]


def agent_catalog() -> list[dict]:
    """Metadata for the frontend investigation pipeline."""
    catalog = []
    for idx, cls in enumerate(INVESTIGATION_SEQUENCE):
        catalog.append(
            {
                "agent": cls.agent_type.value,
                "label": cls.label,
                "emoji": cls.emoji,
                "running_message": cls.running_message,
                "order_index": idx,
            }
        )
    return catalog
