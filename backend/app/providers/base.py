"""LLMProvider abstraction.

DevGuard never *depends* on an external LLM: the agents produce structured,
deterministic findings on their own. When a real provider is configured it is
used only to enrich natural-language explanations. Any failure falls back to
the deterministic path, so the UI is never blocked on an unavailable API.
"""
from __future__ import annotations

from typing import Any


class LLMProvider:
    """Base interface. Implementations return plain text completions."""

    name: str = "base"

    def is_available(self) -> bool:
        return False

    def complete(self, system: str, user: str, **kwargs: Any) -> str:
        raise NotImplementedError

    def enrich(self, system: str, user: str, fallback: str) -> str:
        """Best-effort enrichment: return the model's text, or ``fallback``."""
        try:
            if not self.is_available():
                return fallback
            text = self.complete(system, user)
            return text.strip() or fallback
        except Exception:
            return fallback
