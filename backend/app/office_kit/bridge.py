"""Office Kit bridge.

Abstraction over the phone <-> dev-machine bridge. The simulated implementation
behaves realistically and implements the exact same interface as a future real
Office Kit integration (select via the OFFICE_KIT_URL env var).
"""
from __future__ import annotations

from datetime import datetime
from typing import Protocol

from app.core.config import settings
from app.simulation import fixtures
from app.simulation.engine import simulation

VALID_ACTIONS = {"SYNC_INCIDENT", "SEND_LOGS", "OPEN_PROJECT", "RUN_TESTS", "VIEW_CODE"}


class OfficeKitBridge(Protocol):
    def status(self) -> dict: ...
    def sync(self, action: str, payload: dict | None = None) -> dict: ...


class SimulatedOfficeKitBridge:
    """In-process bridge that mimics a connected development machine."""

    def __init__(self) -> None:
        self._last_sync: str | None = None

    def status(self) -> dict:
        return {
            "connected": True,
            "bridge": "DevGuard Bridge (simulated)",
            "machine": "DEV-MACHINE-01",
            "project": "checkout-service",
            "branch": "production",
            "commit": fixtures.BAD_COMMIT if simulation.is_broken else fixtures.FIX_COMMIT
            if simulation.is_recovered
            else fixtures.BAD_COMMIT,
            "last_sync": self._last_sync,
            "latency_ms": 34,
        }

    def sync(self, action: str, payload: dict | None = None) -> dict:
        action = (action or "").upper()
        self._last_sync = datetime.utcnow().strftime("%H:%M:%S")
        messages = {
            "SYNC_INCIDENT": "Incident context synced to DEV-MACHINE-01.",
            "SEND_LOGS": "42 correlated log lines streamed to the local log viewer.",
            "OPEN_PROJECT": "Opened checkout-service in the IDE on DEV-MACHINE-01.",
            "RUN_TESTS": "Kicked off the verification suite on the dev machine.",
            "VIEW_CODE": f"Opened {fixtures.SOURCE_FILE}:{fixtures.BUG_LINE} in the editor.",
        }
        if action not in VALID_ACTIONS:
            return {
                "ok": False,
                "action": action,
                "message": f"Unknown Office Kit action: {action}",
                "detail": {"valid_actions": sorted(VALID_ACTIONS)},
            }
        return {
            "ok": True,
            "action": action,
            "message": messages[action],
            "detail": {"machine": "DEV-MACHINE-01", "synced_at": self._last_sync},
        }


class RemoteOfficeKitBridge:
    """Talks to a real Office Kit endpoint. Falls back gracefully on error."""

    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")
        self._fallback = SimulatedOfficeKitBridge()

    def status(self) -> dict:
        import httpx  # lazy

        try:
            resp = httpx.get(f"{self.base_url}/status", timeout=1.5)
            resp.raise_for_status()
            return resp.json()
        except Exception:
            data = self._fallback.status()
            data["bridge"] = "DevGuard Bridge (offline — using simulator)"
            return data

    def sync(self, action: str, payload: dict | None = None) -> dict:
        import httpx  # lazy

        try:
            resp = httpx.post(
                f"{self.base_url}/sync", json={"action": action, "payload": payload or {}}, timeout=2.0
            )
            resp.raise_for_status()
            return resp.json()
        except Exception:
            return self._fallback.sync(action, payload)


def get_bridge() -> OfficeKitBridge:
    if settings.office_kit_url:
        return RemoteOfficeKitBridge(settings.office_kit_url)
    return SimulatedOfficeKitBridge()


bridge = get_bridge()
