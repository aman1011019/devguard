"""Deterministic provider used in Demo Mode (the default)."""
from __future__ import annotations

from typing import Any

from app.providers.base import LLMProvider


class DemoProvider(LLMProvider):
    name = "demo"

    def is_available(self) -> bool:
        return True

    def complete(self, system: str, user: str, **kwargs: Any) -> str:
        # The agents already carry deterministic reasoning; this exists only so
        # the provider contract is satisfied without any network dependency.
        return (
            "Deterministic reasoning path executed locally (Demo Mode). "
            "No external LLM was contacted."
        )
