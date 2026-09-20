"""Provider factory — resolves the configured provider, always degrading
gracefully to the deterministic DemoProvider."""
from __future__ import annotations

from app.core.config import settings
from app.providers.base import LLMProvider
from app.providers.demo import DemoProvider


def get_provider() -> LLMProvider:
    provider = (settings.llm_provider or "demo").lower()

    if settings.demo_mode or provider in ("demo", ""):
        return DemoProvider()

    try:
        from app.providers.remote import (
            GeminiProvider,
            OllamaProvider,
            OpenAICompatibleProvider,
        )

        if provider == "gemini":
            candidate: LLMProvider = GeminiProvider(settings.llm_api_key, settings.model_name)
        elif provider in ("openai", "openai-compatible", "openai_compatible"):
            candidate = OpenAICompatibleProvider(
                settings.llm_api_key, settings.model_name, settings.llm_base_url
            )
        elif provider == "ollama":
            candidate = OllamaProvider(settings.model_name, settings.llm_base_url)
        else:
            return DemoProvider()

        if candidate.is_available():
            return candidate
    except Exception:
        pass

    return DemoProvider()


def provider_label() -> str:
    """Human-readable provider name for the health endpoint / settings UI."""
    if settings.demo_mode:
        return "demo"
    return (settings.llm_provider or "demo").lower()
