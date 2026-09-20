"""Simulation engine — the controlled "checkout service" whose health DevGuard
watches. This is the authoritative source of truth for the demo application's
state (healthy / broken / fixed) and the metric time-series shown in charts.

The real demo runtime lives in ``demo/checkout-service`` but the core product
flow depends only on this in-process engine so the demo is always reliable.
"""
from __future__ import annotations

from threading import Lock

from app.simulation import fixtures

HEALTHY = "healthy"
BROKEN = "broken"
FIXED = "fixed"


def _lerp(a: float, b: float, f: float) -> float:
    return a + (b - a) * f


class SimulationEngine:
    """Process-global model of the checkout service's health."""

    def __init__(self) -> None:
        self._state = HEALTHY
        self._lock = Lock()
        self.active_incident_id: int | None = None

    # ── state transitions ──────────────────────────────────────────────────
    @property
    def state(self) -> str:
        return self._state

    def reset(self) -> None:
        with self._lock:
            self._state = HEALTHY
            self.active_incident_id = None

    def break_service(self, incident_id: int) -> None:
        with self._lock:
            self._state = BROKEN
            self.active_incident_id = incident_id

    def recover_service(self) -> None:
        with self._lock:
            self._state = FIXED

    @property
    def is_recovered(self) -> bool:
        return self._state == FIXED

    @property
    def is_broken(self) -> bool:
        return self._state == BROKEN

    # ── metrics ────────────────────────────────────────────────────────────
    def metrics(self) -> dict:
        if self._state == BROKEN:
            return dict(fixtures.BROKEN_METRICS)
        if self._state == FIXED:
            return dict(fixtures.RECOVERED_METRICS)
        return dict(fixtures.HEALTHY_METRICS)

    def health_percent(self) -> float:
        return {HEALTHY: 99.8, BROKEN: 61.4, FIXED: 99.6}[self._state]

    # ── time-series for charts ──────────────────────────────────────────────
    def build_timeseries(self) -> list[dict]:
        """Deterministic degradation curve around the v1.8.4 deployment."""
        base = fixtures.HEALTHY_METRICS
        broken = fixtures.BROKEN_METRICS
        # (label, degradation fraction). Deploy lands at 14:32; effects lag.
        schedule = [
            ("14:30", 0.0), ("14:31", 0.0), ("14:32", 0.0),
            ("14:33", 0.12), ("14:34", 0.40), ("14:35", 0.78),
            ("14:36", 1.0), ("14:37", 1.0), ("14:38", 1.0), ("14:39", 1.0),
        ]
        points: list[dict] = []
        for i, (label, f) in enumerate(schedule):
            points.append(
                {
                    "t": i,
                    "label": label,
                    "phase": "before",
                    "latency_ms": round(_lerp(base["latency_ms"], broken["latency_ms"], f), 1),
                    "error_rate": round(_lerp(base["error_rate"], broken["error_rate"], f), 1),
                    "db_queries": round(_lerp(base["db_queries_per_request"], broken["db_queries_per_request"], f)),
                    "db_latency_ms": round(_lerp(base["db_latency_ms"], broken["db_latency_ms"], f), 1),
                }
            )
        return points

    def recovery_timeseries(self) -> list[dict]:
        """Recovery tail appended once the fix is verified (14:39 -> 14:42)."""
        broken = fixtures.BROKEN_METRICS
        rec = fixtures.RECOVERED_METRICS
        schedule = [("14:40", 0.55), ("14:41", 0.9), ("14:42", 1.0)]
        points: list[dict] = []
        for i, (label, f) in enumerate(schedule):
            points.append(
                {
                    "t": 10 + i,
                    "label": label,
                    "phase": "after",
                    "latency_ms": round(_lerp(broken["latency_ms"], rec["latency_ms"], f), 1),
                    "error_rate": round(_lerp(broken["error_rate"], rec["error_rate"], f), 1),
                    "db_queries": round(_lerp(broken["db_queries_per_request"], rec["db_queries_per_request"], f)),
                    "db_latency_ms": round(_lerp(broken["db_latency_ms"], rec["db_latency_ms"], f), 1),
                }
            )
        return points


# Process-global singleton.
simulation = SimulationEngine()
