"""Safe Command Resolver & Allowlisted Test Runner for DevGuard.

Enforces strict allowlisting of test commands based on detected project type.
Never executes arbitrary commands, shell injection tokens, or destructive binaries.
"""
from __future__ import annotations

import logging
from pathlib import Path
import shlex
import subprocess
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("devguard.command_resolver")

ALLOWED_COMMANDS_BY_ECOSYSTEM: Dict[str, List[List[str]]] = {
    "node": [
        ["npm", "test"],
        ["npm", "run", "test"],
        ["pnpm", "test"],
        ["yarn", "test"],
        ["npx", "vitest", "run"],
        ["npx", "jest"],
    ],
    "python": [
        ["pytest"],
        ["python", "-m", "pytest"],
        ["python", "-m", "unittest"],
    ],
    "java": [
        ["mvn", "test"],
        ["./gradlew", "test"],
        ["gradle", "test"],
    ],
    "go": [
        ["go", "test", "./..."],
    ],
    "rust": [
        ["cargo", "test"],
    ],
}

FORBIDDEN_TOKENS = {
    "rm",
    "curl",
    "wget",
    "sh",
    "bash",
    "zsh",
    "sudo",
    "chmod",
    "chown",
    "ssh",
    "scp",
    "nc",
    "netcat",
    "eval",
    "exec",
    "kill",
    "pkill",
    ";",
    "|",
    "&",
    ">",
    "<",
    "`",
    "$",
}


def is_safe_command(cmd_args: List[str]) -> bool:
    """Validate that command arguments conform to allowlisted structure without forbidden tokens."""
    if not cmd_args:
        return False

    # Check for forbidden tokens
    for token in cmd_args:
        lower_token = token.lower()
        if lower_token in FORBIDDEN_TOKENS or any(fb in lower_token for fb in (";", "|", "&", "`", "$(")):
            logger.warning(f"Rejected command containing forbidden token: {token}")
            return False

    # Check if matches any known allowed command prefix
    for ecosystem, allowed_list in ALLOWED_COMMANDS_BY_ECOSYSTEM.items():
        for allowed in allowed_list:
            if cmd_args[:len(allowed)] == allowed:
                return True

    return False


def resolve_test_command(profile: Dict[str, Any], root_dir: Optional[Path] = None) -> List[str]:
    """Detect the safe allowlisted test command for the given codebase."""
    pkg_mgr = (profile.get("package_manager") or "").lower()
    test_framework = (profile.get("test_framework") or "").lower()

    if root_dir:
        if (root_dir / "package.json").exists():
            if (root_dir / "pnpm-lock.yaml").exists():
                return ["pnpm", "test"]
            if (root_dir / "yarn.lock").exists():
                return ["yarn", "test"]
            return ["npm", "test"]

        if (root_dir / "pytest.ini").exists() or (root_dir / "requirements.txt").exists():
            return ["pytest"]

        if (root_dir / "pom.xml").exists():
            return ["mvn", "test"]

        if (root_dir / "build.gradle").exists():
            return ["gradle", "test"]

    if "pytest" in test_framework:
        return ["pytest"]
    if "pnpm" in pkg_mgr:
        return ["pnpm", "test"]
    if "yarn" in pkg_mgr:
        return ["yarn", "test"]
    if "maven" in pkg_mgr:
        return ["mvn", "test"]
    if "gradle" in pkg_mgr:
        return ["gradle", "test"]

    return ["npm", "test"]


def run_allowlisted_test(cmd_args: List[str], cwd: Path, timeout_seconds: int = 30) -> Tuple[bool, str]:
    """Executes an allowlisted test command inside cwd."""
    if not is_safe_command(cmd_args):
        return False, f"Command '{' '.join(cmd_args)}' is not in the safe allowlist."

    try:
        proc = subprocess.run(
            cmd_args,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            shell=False,
        )
        output = f"{proc.stdout}\n{proc.stderr}".strip()
        passed = proc.returncode == 0
        return passed, output
    except subprocess.TimeoutExpired:
        return False, f"Test execution timed out after {timeout_seconds}s."
    except Exception as exc:
        return False, f"Execution failed: {exc}"
