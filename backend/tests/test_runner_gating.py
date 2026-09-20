"""Verification runner gating tests.

The suite must genuinely fail when the fix has not been applied to the sandbox,
and pass (44/44) only once it has. This proves the tests gate on real state
rather than replaying a scripted animation.
"""
import asyncio

from app.testing import runner, workspace


async def _collect(iid):
    events = []

    async def emit(e):
        events.append(e)

    result = await runner.run_verification(iid, emit)
    return result, events


def test_runner_fails_without_patch():
    iid = 999002
    workspace.cleanup(iid)
    workspace.prepare_workspace(iid)  # deliberately NOT patched
    result, events = asyncio.run(_collect(iid))
    assert result["passed"] is False
    assert result["status"] == "FAILED"
    assert any(e["type"] == "test_started" for e in events)
    workspace.cleanup(iid)


def test_runner_passes_with_patch():
    iid = 999003
    workspace.cleanup(iid)
    workspace.prepare_workspace(iid)
    workspace.apply_fix(iid)
    result, events = asyncio.run(_collect(iid))
    assert result["passed"] is True
    assert result["status"] == "PASSED"
    assert result["total_passed"] == 44
    assert result["total"] == 44
    # Four suites reported (unit, integration, regression, load).
    assert sum(1 for e in events if e["type"] == "test_suite_completed") == 4
    workspace.cleanup(iid)
