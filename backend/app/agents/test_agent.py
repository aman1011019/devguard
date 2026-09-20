"""Test Agent — owns the verification plan. Actual execution (streamed live) is
performed by ``app.testing.runner`` against the recovered simulation state."""
from __future__ import annotations

from app.core.enums import AgentType
from app.simulation import fixtures


class TestAgent:
    agent_type = AgentType.TEST_AGENT
    emoji = "🧪"
    label = "Test Agent"
    running_message = "Running verification suite..."

    def plan(self) -> list[dict]:
        return list(fixtures.TEST_PLAN)
