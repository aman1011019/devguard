"""Sandbox workspace tests.

Proves patches are applied inside the isolated workspace only, are idempotent,
and that path-escape attempts are rejected.
"""
from pathlib import Path

import pytest

from app.testing import workspace


def test_apply_and_detect_patch():
    iid = 999001
    workspace.cleanup(iid)
    workspace.prepare_workspace(iid)
    assert workspace.is_patched(iid) is False

    workspace.apply_fix(iid)
    assert workspace.is_patched(iid) is True

    # Idempotent: applying again is a no-op and stays patched.
    workspace.apply_fix(iid)
    assert workspace.is_patched(iid) is True

    content = workspace._workspace_file(iid).read_text(encoding="utf-8")
    assert "fetchProductsByIds" in content
    assert "fetchProduct(item.getProductId())" not in content
    workspace.cleanup(iid)


def test_path_escape_is_rejected():
    outside = Path(workspace.WORKSPACE_ROOT).parent / "evil.java"
    with pytest.raises(ValueError):
        workspace._assert_within_workspace(outside)


def test_workspace_is_isolated_from_demo_source():
    """Patching the sandbox must never mutate the shipped demo source file."""
    iid = 999005
    original = workspace.DEMO_SOURCE.read_text(encoding="utf-8") if workspace.DEMO_SOURCE.exists() else None
    workspace.cleanup(iid)
    workspace.prepare_workspace(iid)
    workspace.apply_fix(iid)
    if original is not None:
        assert workspace.DEMO_SOURCE.read_text(encoding="utf-8") == original
    workspace.cleanup(iid)
