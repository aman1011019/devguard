"""Pytest fixtures.

Isolates the test database and speeds up demo timing *before* the app (and its
cached settings / DB engine) are imported.
"""
import os
import tempfile

import pytest

_tmp = tempfile.mkdtemp(prefix="devguard_test_")
_db_path = os.path.join(_tmp, "test.db").replace("\\", "/")
os.environ["DATABASE_URL"] = f"sqlite:///{_db_path}"
os.environ["AGENT_STEP_SECONDS"] = "0.02"
os.environ["TEST_STEP_SECONDS"] = "0.01"
os.environ["DEMO_MODE"] = "true"
os.environ["CORS_ORIGINS"] = "*"

from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture(scope="session")
def client():
    import main

    with TestClient(main.app) as c:
        yield c
