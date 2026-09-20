"""Real LLM providers. All imports are lazy so missing packages never break
startup — a provider simply reports itself unavailable and DevGuard falls back
to deterministic reasoning.
"""
from __future__ import annotations

from typing import Any

from app.providers.base import LLMProvider


class GeminiProvider(LLMProvider):
    name = "gemini"

    def __init__(self, api_key: str, model: str) -> None:
        self.api_key = api_key
        self.model = model or "gemini-1.5-flash"

    def is_available(self) -> bool:
        return bool(self.api_key)

    def complete(self, system: str, user: str, **kwargs: Any) -> str:
        import google.generativeai as genai  # lazy

        genai.configure(api_key=self.api_key)
        model = genai.GenerativeModel(self.model, system_instruction=system)
        resp = model.generate_content(user)
        return resp.text or ""


class OpenAICompatibleProvider(LLMProvider):
    """Works with OpenAI and any OpenAI-compatible endpoint (base_url)."""

    name = "openai"

    def __init__(self, api_key: str, model: str, base_url: str) -> None:
        self.api_key = api_key
        self.model = model or "gpt-4o-mini"
        self.base_url = base_url or None

    def is_available(self) -> bool:
        return bool(self.api_key or self.base_url)

    def complete(self, system: str, user: str, **kwargs: Any) -> str:
        from openai import OpenAI  # lazy

        client = OpenAI(api_key=self.api_key or "not-needed", base_url=self.base_url)
        resp = client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=0.2,
        )
        return resp.choices[0].message.content or ""


class OllamaProvider(LLMProvider):
    """Uses Ollama's OpenAI-compatible endpoint (/v1/chat/completions).

    Works with any model hosted by Ollama (llama3.2, qwen3, mistral, …).
    The ``think`` / reasoning tokens that some models emit (e.g. qwen3) are
    stripped so only the final answer is returned.
    """

    name = "ollama"

    def __init__(self, model: str, base_url: str) -> None:
        self.model = model or "llama3"
        # Normalise the URL — strip a trailing /v1 if the user already added it.
        self.base_url = (base_url or "http://localhost:11434").rstrip("/")
        if self.base_url.endswith("/v1"):
            self.base_url = self.base_url[:-3]

    def is_available(self) -> bool:
        import httpx  # lazy

        try:
            # The /v1/models endpoint works on any OpenAI-compat Ollama build.
            httpx.get(f"{self.base_url}/v1/models", timeout=1.2)
            return True
        except Exception:
            try:
                httpx.get(f"{self.base_url}/api/tags", timeout=1.2)
                return True
            except Exception:
                return False

    def complete(self, system: str, user: str, **kwargs: Any) -> str:
        import httpx  # lazy

        resp = httpx.post(
            f"{self.base_url}/v1/chat/completions",
            json={
                "model": self.model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "temperature": 0.2,
                "stream": False,
            },
            timeout=45,
        )
        resp.raise_for_status()
        content: str = resp.json()["choices"][0]["message"]["content"] or ""
        # Strip <think>…</think> reasoning blocks emitted by qwen3 / deepseek.
        import re
        content = re.sub(r"<think>[\s\S]*?</think>", "", content, flags=re.IGNORECASE).strip()
        return content
