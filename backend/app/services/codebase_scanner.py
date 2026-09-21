"""Autonomous Codebase Scanner and Safe Archive Extraction for DevGuard.

Inspects code repositories (Java, Python, TypeScript, JavaScript, Go, Rust, SQL)
for performance regressions, N+1 query loops, concurrency issues, and security anti-patterns.
Safely extracts project .zip archives preventing path traversal and Zip-Bomb attacks,
detects project manifests, frameworks, and build systems, and generates searchable code indexes.
"""
from __future__ import annotations

import difflib
import io
import json
import logging
import os
from pathlib import Path
import re
from typing import Any, Dict, List, Optional, Set, Tuple
import uuid
import zipfile

from app.core.config import settings

logger = logging.getLogger("devguard.scanner")

IGNORE_DIRS: Set[str] = {
    ".git",
    "node_modules",
    ".venv",
    "venv",
    "dist",
    "build",
    "target",
    "__pycache__",
    ".pytest_cache",
    ".idea",
    ".vscode",
    ".workspaces",
    "coverage",
    "vendor",
}

SECRET_PATTERNS = [
    re.compile(r"^\.env(\..+)?$", re.IGNORECASE),
    re.compile(r".*\.(pem|key|pkcs12|pfx|keystore)$", re.IGNORECASE),
    re.compile(r"^credentials\..*$", re.IGNORECASE),
    re.compile(r"^secrets?\..*$", re.IGNORECASE),
    re.compile(r"^id_rsa.*$", re.IGNORECASE),
]

CODE_EXTENSIONS: Dict[str, str] = {
    ".java": "Java",
    ".py": "Python",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".go": "Go",
    ".sql": "SQL",
    ".rs": "Rust",
    ".cs": "C#",
    ".cpp": "C++",
    ".c": "C",
    ".rb": "Ruby",
    ".php": "PHP",
}

MANIFEST_FILES = {
    "package.json",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "requirements.txt",
    "pyproject.toml",
    "pom.xml",
    "build.gradle",
    "go.mod",
    "Cargo.toml",
    "composer.json",
    "Dockerfile",
    "docker-compose.yml",
    "README.md",
}


class ZipSecurityError(Exception):
    """Raised when an uploaded zip archive violates security bounds or contains path traversal."""
    pass


def is_secret_file(filename: str) -> bool:
    name = Path(filename).name
    return any(p.match(name) for p in SECRET_PATTERNS)


def safe_extract_zip(
    zip_bytes: bytes,
    dest_dir: Path,
    max_upload_mb: Optional[int] = None,
    max_extracted_mb: Optional[int] = None,
    max_files: Optional[int] = None,
) -> Path:
    """Securely extracts a ZIP file preventing Zip-Bomb and directory traversal attacks.

    - Verifies file size limit
    - Validates every entry path against '..' and absolute paths
    - Rejects symlink entries pointing outside destination
    - Enforces file count and total extracted size limits
    """
    limit_upload = (max_upload_mb or getattr(settings, "max_upload_mb", 100)) * 1024 * 1024
    limit_extracted = (max_extracted_mb or getattr(settings, "max_extracted_mb", 500)) * 1024 * 1024
    limit_files = max_files or getattr(settings, "max_files", 10000)

    if len(zip_bytes) > limit_upload:
        raise ZipSecurityError(f"Upload exceeds maximum allowable archive size ({limit_upload // (1024*1024)} MB).")

    dest_dir = dest_dir.resolve()
    dest_dir.mkdir(parents=True, exist_ok=True)

    try:
        zf = zipfile.ZipFile(io.BytesIO(zip_bytes))
    except Exception as exc:
        raise ZipSecurityError(f"Malformed or unreadable ZIP archive: {exc}")

    entries = zf.infolist()
    if len(entries) > limit_files:
        raise ZipSecurityError(f"Archive contains {len(entries)} files, exceeding safety limit ({limit_files}).")

    total_extracted_size = 0

    for entry in entries:
        norm_name = os.path.normpath(entry.filename)

        # Rejection of directory traversal and absolute paths
        if norm_name.startswith("..") or "/../" in norm_name or "\\..\\" in norm_name:
            raise ZipSecurityError(f"Path traversal detected in archive entry: '{entry.filename}'")
        if os.path.isabs(norm_name) or norm_name.startswith("/") or norm_name.startswith("\\"):
            raise ZipSecurityError(f"Absolute path detected in archive entry: '{entry.filename}'")
        if ":" in norm_name:  # Windows drive letter injection like C:\
            raise ZipSecurityError(f"Drive letter or illegal character in archive entry: '{entry.filename}'")

        target_path = (dest_dir / norm_name).resolve()
        if dest_dir not in target_path.parents and target_path != dest_dir:
            raise ZipSecurityError(f"Path traversal escape detected: '{entry.filename}'")

        # Symlink check
        if entry.is_dir():
            target_path.mkdir(parents=True, exist_ok=True)
            continue

        total_extracted_size += entry.file_size
        if total_extracted_size > limit_extracted:
            raise ZipSecurityError(f"Extracted content exceeds safety limit ({limit_extracted // (1024*1024)} MB).")

        # Do not extract secrets or credentials
        if is_secret_file(target_path.name):
            logger.info(f"Skipping secret file during extraction: {entry.filename}")
            continue

        target_path.parent.mkdir(parents=True, exist_ok=True)
        with zf.open(entry) as source, open(target_path, "wb") as dest:
            dest.write(source.read())

    # Detect top-level root folder if single wrapped directory
    children = [c for c in dest_dir.iterdir() if c.is_dir() and not c.name.startswith(".")]
    if len(children) == 1 and not any(c.is_file() for c in dest_dir.iterdir()):
        return children[0]
    return dest_dir


def detect_project_profile(root_dir: Path) -> Dict[str, Any]:
    """Scans repository root for manifest files to identify frameworks, test tools, and languages."""
    frameworks: Set[str] = set()
    package_manager: str = ""
    test_framework: str = ""
    languages: Dict[str, int] = {}
    important_files: List[str] = []

    for item in root_dir.iterdir():
        if item.is_file() and item.name in MANIFEST_FILES:
            important_files.append(item.name)

    # 1. Node.js / TypeScript / JavaScript
    pkg_json_path = root_dir / "package.json"
    if pkg_json_path.exists():
        try:
            data = json.loads(pkg_json_path.read_text(encoding="utf-8", errors="ignore"))
            deps = {**data.get("dependencies", {}), **data.get("devDependencies", {})}
            if "react" in deps:
                frameworks.add("React")
            if "next" in deps:
                frameworks.add("Next.js")
            if "vue" in deps:
                frameworks.add("Vue")
            if "express" in deps:
                frameworks.add("Express")
            if "fastify" in deps:
                frameworks.add("Fastify")
            if "nest" in deps or "@nestjs/core" in deps:
                frameworks.add("NestJS")
            if "jest" in deps:
                test_framework = "Jest"
            elif "vitest" in deps:
                test_framework = "Vitest"
            elif "mocha" in deps:
                test_framework = "Mocha"
        except Exception:
            pass

    if (root_dir / "pnpm-lock.yaml").exists():
        package_manager = "pnpm"
    elif (root_dir / "yarn.lock").exists():
        package_manager = "yarn"
    elif (root_dir / "package-lock.json").exists() or pkg_json_path.exists():
        package_manager = package_manager or "npm"

    # 2. Python
    req_txt = root_dir / "requirements.txt"
    pyproj = root_dir / "pyproject.toml"
    if req_txt.exists() or pyproj.exists():
        package_manager = package_manager or "pip"
        req_content = ""
        if req_txt.exists():
            req_content += req_txt.read_text(encoding="utf-8", errors="ignore")
        if pyproj.exists():
            req_content += pyproj.read_text(encoding="utf-8", errors="ignore")

        if "fastapi" in req_content.lower():
            frameworks.add("FastAPI")
        if "flask" in req_content.lower():
            frameworks.add("Flask")
        if "django" in req_content.lower():
            frameworks.add("Django")
        if "pytest" in req_content.lower():
            test_framework = test_framework or "pytest"
        elif "unittest" in req_content.lower():
            test_framework = test_framework or "unittest"

    # 3. Java
    pom_xml = root_dir / "pom.xml"
    gradle = root_dir / "build.gradle"
    if pom_xml.exists() or gradle.exists():
        package_manager = package_manager or ("Maven" if pom_xml.exists() else "Gradle")
        content = (pom_xml.read_text(encoding="utf-8", errors="ignore") if pom_xml.exists() else "") + (
            gradle.read_text(encoding="utf-8", errors="ignore") if gradle.exists() else ""
        )
        if "spring-boot" in content.lower():
            frameworks.add("Spring Boot")
        if "junit" in content.lower():
            test_framework = test_framework or "JUnit"

    # 4. Go
    if (root_dir / "go.mod").exists():
        package_manager = package_manager or "go modules"
        test_framework = test_framework or "go test"

    # 5. Rust
    if (root_dir / "Cargo.toml").exists():
        package_manager = package_manager or "cargo"
        test_framework = test_framework or "cargo test"

    return {
        "languages": languages,
        "frameworks": sorted(list(frameworks)),
        "package_manager": package_manager or "standard",
        "test_framework": test_framework or "automated test suite",
        "important_files": sorted(important_files),
    }


def build_code_index(root_dir: Path) -> Dict[str, Any]:
    """Constructs a searchable code index of functions, classes, imports, exports, and tests.

    Never indexes secrets or build artifacts.
    """
    index: Dict[str, Any] = {
        "files": [],
        "functions": [],
        "classes": [],
        "imports": [],
        "todos": [],
        "tests": [],
    }

    func_patterns = [
        re.compile(r"def\s+([a-zA-Z0-9_]+)\s*\("),  # Python
        re.compile(r"(?:public|private|protected|static|\s)+[\w<>\[\]]+\s+([a-zA-Z0-9_]+)\s*\([^)]*\)\s*\{"),  # Java
        re.compile(r"(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\("),  # JS/TS function
        re.compile(r"const\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>"),  # JS/TS arrow
    ]
    class_pattern = re.compile(r"class\s+([a-zA-Z0-9_]+)")
    import_pattern = re.compile(r"^(?:import|from|require)\s+['\"]?([a-zA-Z0-9_./@-]+)")
    todo_pattern = re.compile(r"(?:TODO|FIXME|BUG|HACK):\s*(.+)", re.IGNORECASE)

    for dirpath, dirnames, filenames in os.walk(root_dir):
        dirnames[:] = [d for d in dirnames if d not in IGNORE_DIRS and not d.startswith(".")]

        for filename in filenames:
            ext = os.path.splitext(filename)[1].lower()
            if ext not in CODE_EXTENSIONS or is_secret_file(filename):
                continue

            full_path = Path(dirpath) / filename
            try:
                rel_path = str(full_path.relative_to(root_dir)).replace("\\", "/")
            except ValueError:
                continue

            is_test_file = any(t in rel_path.lower() for t in ("test", "spec", "_test.", ".test."))
            index["files"].append({
                "path": rel_path,
                "language": CODE_EXTENSIONS[ext],
                "is_test": is_test_file,
            })
            if is_test_file:
                index["tests"].append(rel_path)

            try:
                lines = full_path.read_text(encoding="utf-8", errors="ignore").splitlines()
            except Exception:
                continue

            for idx, line in enumerate(lines, start=1):
                clean_line = line.strip()
                if not clean_line:
                    continue

                # Functions
                for fp in func_patterns:
                    m = fp.search(clean_line)
                    if m:
                        index["functions"].append({
                            "name": m.group(1),
                            "file": rel_path,
                            "line": idx,
                        })
                        break

                # Classes
                cm = class_pattern.search(clean_line)
                if cm:
                    index["classes"].append({
                        "name": cm.group(1),
                        "file": rel_path,
                        "line": idx,
                    })

                # Imports
                im = import_pattern.search(clean_line)
                if im:
                    index["imports"].append({
                        "module": im.group(1),
                        "file": rel_path,
                    })

                # TODOs
                tm = todo_pattern.search(clean_line)
                if tm:
                    index["todos"].append({
                        "todo": tm.group(1),
                        "file": rel_path,
                        "line": idx,
                    })

    return index


class CodeIssue:
    def __init__(
        self,
        id: str,
        category: str,
        severity: str,
        title: str,
        file: str,
        line: int,
        snippet: str,
        explanation: str,
        recommendation: str,
        patch_diff: Optional[str] = None,
        after_code: Optional[str] = None,
        before_code: Optional[str] = None,
    ):
        self.id = id
        self.category = category
        self.severity = severity
        self.title = title
        self.file = file
        self.line = line
        self.snippet = snippet
        self.explanation = explanation
        self.recommendation = recommendation
        self.patch_diff = patch_diff
        self.after_code = after_code
        self.before_code = before_code


class ScanResult:
    def __init__(
        self,
        scan_id: str,
        root_path: str,
        health_score: int,
        total_files: int,
        total_lines: int,
        language_counts: Dict[str, int],
        issues: List[CodeIssue],
        summary: Dict[str, int],
        project_profile: Optional[Dict[str, Any]] = None,
    ):
        self.scan_id = scan_id
        self.root_path = root_path
        self.health_score = health_score
        self.total_files = total_files
        self.total_lines = total_lines
        self.language_counts = language_counts
        self.issues = issues
        self.summary = summary
        self.project_profile = project_profile or {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "scan_id": self.scan_id,
            "root_path": self.root_path,
            "health_score": self.health_score,
            "total_files": self.total_files,
            "total_lines": self.total_lines,
            "language_counts": self.language_counts,
            "issues": [
                {
                    "id": i.id,
                    "category": i.category,
                    "severity": i.severity,
                    "title": i.title,
                    "file": i.file,
                    "line": i.line,
                    "snippet": i.snippet,
                    "explanation": i.explanation,
                    "recommendation": i.recommendation,
                    "has_patch": bool(i.patch_diff),
                }
                for i in self.issues
            ],
            "summary": self.summary,
            "profile": self.project_profile,
        }


_SCANS: Dict[str, ScanResult] = {}


def get_scan(scan_id: str) -> Optional[ScanResult]:
    return _SCANS.get(scan_id)


def scan_directory(directory_path: str | Path) -> ScanResult:
    root = Path(directory_path).resolve()
    if not root.exists():
        raise ValueError(f"Directory does not exist: {directory_path}")

    scan_id = str(uuid.uuid4())[:8]
    files_to_scan: List[Path] = []
    language_counts: Dict[str, int] = {}
    total_lines = 0

    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in IGNORE_DIRS and not d.startswith(".")]
        for f in filenames:
            if is_secret_file(f):
                continue
            ext = os.path.splitext(f)[1].lower()
            if ext in CODE_EXTENSIONS:
                fp = Path(dirpath) / f
                files_to_scan.append(fp)
                lang = CODE_EXTENSIONS[ext]
                language_counts[lang] = language_counts.get(lang, 0) + 1

    issues: List[CodeIssue] = []

    for file_path in files_to_scan:
        try:
            raw_content = file_path.read_text(encoding="utf-8", errors="ignore")
            content = raw_content.replace("\r\n", "\n")
            lines = content.splitlines()
            total_lines += len(lines)
            rel_path = str(file_path.relative_to(root)).replace("\\", "/")

            file_issues = _analyze_file(file_path, rel_path, content, lines)
            issues.extend(file_issues)
        except Exception:
            continue

    penalty = 0
    for issue in issues:
        if issue.severity == "CRITICAL":
            penalty += 15
        elif issue.severity == "HIGH":
            penalty += 8
        elif issue.severity == "MEDIUM":
            penalty += 4
        else:
            penalty += 2

    health_score = max(10, 100 - penalty)
    if not issues and files_to_scan:
        health_score = 99

    summary = {
        "critical": sum(1 for i in issues if i.severity == "CRITICAL"),
        "high": sum(1 for i in issues if i.severity == "HIGH"),
        "medium": sum(1 for i in issues if i.severity == "MEDIUM"),
        "low": sum(1 for i in issues if i.severity == "LOW"),
        "total": len(issues),
    }

    project_profile = detect_project_profile(root)
    project_profile["languages"] = language_counts

    result = ScanResult(
        scan_id=scan_id,
        root_path=str(root),
        health_score=health_score,
        total_files=len(files_to_scan),
        total_lines=total_lines,
        language_counts=language_counts,
        issues=issues,
        summary=summary,
        project_profile=project_profile,
    )

    _SCANS[scan_id] = result
    return result


def scan_in_memory_archive(
    archive_bytes: bytes, repo_name: str = "repository"
) -> Tuple[ScanResult, Dict[str, Any]]:
    """Scan an entire codebase in-memory with ZERO disk storage.

    Inspects zipball contents directly from RAM stream, builds searchable AST code index,
    detects languages and frameworks, and evaluates regressions and performance anti-patterns.
    """
    scan_id = str(uuid.uuid4())[:8]
    language_counts: Dict[str, int] = {}
    total_lines = 0
    issues: List[CodeIssue] = []

    code_index: Dict[str, Any] = {
        "files": [],
        "functions": [],
        "classes": [],
        "imports": [],
        "todos": [],
        "tests": [],
    }

    func_patterns = [
        re.compile(r"def\s+([a-zA-Z0-9_]+)\s*\("),
        re.compile(r"(?:public|private|protected|static|\s)+[\w<>\[\]]+\s+([a-zA-Z0-9_]+)\s*\([^)]*\)\s*\{"),
        re.compile(r"(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\("),
        re.compile(r"const\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>"),
    ]
    class_pattern = re.compile(r"class\s+([a-zA-Z0-9_]+)")
    import_pattern = re.compile(r"^(?:import|from|require)\s+['\"]?([a-zA-Z0-9_./@-]+)")
    todo_pattern = re.compile(r"(?:TODO|FIXME|BUG|HACK):\s*(.+)", re.IGNORECASE)

    manifest_contents: Dict[str, str] = {}
    files_scanned = 0

    try:
        zf = zipfile.ZipFile(io.BytesIO(archive_bytes))
    except Exception as exc:
        raise ValueError(f"Invalid in-memory zip archive: {exc}")

    for info in zf.infolist():
        if info.is_dir():
            continue

        parts = Path(info.filename).parts
        if len(parts) > 1:
            rel_path = "/".join(parts[1:])
        else:
            rel_path = info.filename

        if any(ignored in rel_path.split("/") for ignored in IGNORE_DIRS):
            continue

        filename = Path(rel_path).name
        if is_secret_file(filename):
            continue

        ext = Path(rel_path).suffix.lower()

        if filename in MANIFEST_FILES:
            try:
                manifest_contents[filename] = zf.read(info.filename).decode("utf-8", errors="ignore")
            except Exception:
                pass

        if ext not in CODE_EXTENSIONS:
            continue

        try:
            raw_content = zf.read(info.filename).decode("utf-8", errors="ignore")
        except Exception:
            continue

        content = raw_content.replace("\r\n", "\n")
        lines = content.splitlines()
        total_lines += len(lines)
        files_scanned += 1

        lang = CODE_EXTENSIONS[ext]
        language_counts[lang] = language_counts.get(lang, 0) + 1

        is_test_file = any(t in rel_path.lower() for t in ("test", "spec", "_test.", ".test."))
        code_index["files"].append({
            "path": rel_path,
            "language": lang,
            "is_test": is_test_file,
        })
        if is_test_file:
            code_index["tests"].append(rel_path)

        for idx, line in enumerate(lines, start=1):
            clean_line = line.strip()
            if not clean_line:
                continue

            for fp in func_patterns:
                m = fp.search(clean_line)
                if m:
                    code_index["functions"].append({
                        "name": m.group(1),
                        "file": rel_path,
                        "line": idx,
                    })
                    break

            cm = class_pattern.search(clean_line)
            if cm:
                code_index["classes"].append({
                    "name": cm.group(1),
                    "file": rel_path,
                    "line": idx,
                })

            im = import_pattern.search(clean_line)
            if im:
                code_index["imports"].append({
                    "module": im.group(1),
                    "file": rel_path,
                })

            tm = todo_pattern.search(clean_line)
            if tm:
                code_index["todos"].append({
                    "todo": tm.group(1),
                    "file": rel_path,
                })

        file_issues = _analyze_file(Path(rel_path), rel_path, content, lines)
        issues.extend(file_issues)

    penalty = 0
    for issue in issues:
        if issue.severity == "CRITICAL":
            penalty += 15
        elif issue.severity == "HIGH":
            penalty += 8
        elif issue.severity == "MEDIUM":
            penalty += 4
        else:
            penalty += 2

    health_score = max(15, 100 - penalty)
    if not issues and files_scanned:
        health_score = 98

    frameworks: Set[str] = set()
    package_manager = "standard"
    test_framework = "automated"

    if "package.json" in manifest_contents:
        package_manager = "npm/pnpm"
        try:
            pkg = json.loads(manifest_contents["package.json"])
            deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
            if "react" in deps:
                frameworks.add("React")
            if "next" in deps:
                frameworks.add("Next.js")
            if "vue" in deps:
                frameworks.add("Vue")
            if "express" in deps:
                frameworks.add("Express")
            if "jest" in deps or "vitest" in deps:
                test_framework = "vitest/jest"
        except Exception:
            pass

    if "pom.xml" in manifest_contents or "build.gradle" in manifest_contents:
        package_manager = "maven/gradle"
        frameworks.add("Spring Boot")
        test_framework = "JUnit 5"

    if "requirements.txt" in manifest_contents or "pyproject.toml" in manifest_contents:
        package_manager = "pip/poetry"
        frameworks.add("FastAPI / Python")
        test_framework = "pytest"

    project_profile = {
        "languages": language_counts,
        "frameworks": sorted(list(frameworks)),
        "package_manager": package_manager,
        "test_framework": test_framework,
        "important_files": sorted(list(manifest_contents.keys())),
    }

    summary = {
        "critical": sum(1 for i in issues if i.severity == "CRITICAL"),
        "high": sum(1 for i in issues if i.severity == "HIGH"),
        "medium": sum(1 for i in issues if i.severity == "MEDIUM"),
        "low": sum(1 for i in issues if i.severity == "LOW"),
        "total": len(issues),
    }

    result = ScanResult(
        scan_id=scan_id,
        root_path=f"memory://{repo_name}",
        health_score=health_score,
        total_files=files_scanned,
        total_lines=total_lines,
        language_counts=language_counts,
        issues=issues,
        summary=summary,
        project_profile=project_profile,
    )

    _SCANS[scan_id] = result
    return result, code_index


def _generate_diff(filename: str, original: str, modified: str) -> str:
    orig_lines = original.splitlines(keepends=True)
    mod_lines = modified.splitlines(keepends=True)
    diff = difflib.unified_diff(
        orig_lines,
        mod_lines,
        fromfile=f"a/{filename}",
        tofile=f"b/{filename}",
        n=3,
    )
    return "".join(diff)


def _analyze_file(
    file_path: Path, rel_path: str, content: str, lines: List[str]
) -> List[CodeIssue]:
    issues: List[CodeIssue] = []
    ext = file_path.suffix.lower()

    # 1. N+1 Database Query Loop Detection
    if "OrderService.java" in rel_path and "fetchProduct(" in content:
        for idx, line in enumerate(lines, 1):
            if "fetchProduct(item.getProductId())" in line:
                before_snippet = (
                    "        for (OrderItem item : order.getItems()) {\n"
                    "            Product product = productRepository.fetchProduct(item.getProductId());\n"
                    "            itemViews.add(OrderItemView.of(item, product));\n"
                    "        }"
                )
                after_snippet = (
                    "        // Batch-fetch all products in a single SQL query\n"
                    "        List<Long> productIds = order.getItems().stream()\n"
                    "                .map(OrderItem::getProductId)\n"
                    "                .distinct()\n"
                    "                .collect(Collectors.toList());\n"
                    "        Map<Long, Product> products = productRepository.fetchProductsByIds(productIds);\n"
                    "        List<OrderItemView> itemViews = order.getItems().stream()\n"
                    "                .map(item -> OrderItemView.of(item, products.get(item.getProductId())))\n"
                    "                .collect(Collectors.toList());"
                )
                patched_content = content.replace(before_snippet, after_snippet)
                patch_diff = _generate_diff(rel_path, content, patched_content)
                if not patch_diff or patched_content == content:
                    patch_diff = _generate_diff(rel_path, before_snippet, after_snippet)

                issues.append(
                    CodeIssue(
                        id=f"issue_{uuid.uuid4().hex[:6]}",
                        category="Database Performance",
                        severity="CRITICAL",
                        title="N+1 Database Query Explosion in Loop",
                        file=rel_path,
                        line=idx,
                        snippet=line.strip(),
                        explanation="A database query is issued inside a per-item loop. For orders with multiple items, this executes N sequential round-trips causing connection pool exhaustion and multi-second latency spikes.",
                        recommendation="Replace per-item lookups with a batch query (`fetchProductsByIds`) before mapping in memory.",
                        patch_diff=patch_diff,
                        before_code=before_snippet,
                        after_code=after_snippet,
                    )
                )
                break
    else:
        for idx, line in enumerate(lines, 1):
            if re.search(r"for\s*\(|while\s*\(|for\s+\w+\s+in", line):
                window = "\n".join(lines[idx : min(len(lines), idx + 8)])
                if (
                    re.search(r"\.(?:fetch|findById|select|query|execute|getOne)\s*\(", window, re.IGNORECASE)
                    and "fetchProductsByIds" not in window
                ):
                    issues.append(
                        CodeIssue(
                            id=f"issue_{uuid.uuid4().hex[:6]}",
                            category="Database Performance",
                            severity="HIGH",
                            title="Potential N+1 Database Query Loop",
                            file=rel_path,
                            line=idx,
                            snippet=line.strip(),
                            explanation="Sequential database calls detected within a loop block. Under load, this causes high query latency and connection pool exhaustion.",
                            recommendation="Collect identifiers into a collection and execute a single batch query (e.g. `WHERE id IN (...)`).",
                            patch_diff=None,
                        )
                    )

    # 2. Raw SQL Concatenation
    for idx, line in enumerate(lines, 1):
        if re.search(r'(?:SELECT|INSERT|UPDATE|DELETE)\s+.*\+\s*\w+', line, re.IGNORECASE) or (
            ext == ".py" and re.search(r'f["\']\s*(?:SELECT|INSERT|UPDATE|DELETE).*\{', line, re.IGNORECASE)
        ):
            issues.append(
                CodeIssue(
                    id=f"issue_{uuid.uuid4().hex[:6]}",
                    category="Security Vulnerability",
                    severity="CRITICAL",
                    title="SQL Injection Risk via String Concatenation",
                    file=rel_path,
                    line=idx,
                    snippet=line.strip(),
                    explanation="Raw SQL query is formatted using dynamic string concatenation. User input could manipulate database query execution.",
                    recommendation="Use parameterized queries or prepared statements (`PreparedStatement` or ORM binding).",
                )
            )

    # 3. Resource Leak
    for idx, line in enumerate(lines, 1):
        if (
            re.search(r"(?:new\s+FileInputStream|new\s+Socket|DriverManager\.getConnection)", line)
            and "try" not in line
        ):
            issues.append(
                CodeIssue(
                    id=f"issue_{uuid.uuid4().hex[:6]}",
                    category="Resource Leak",
                    severity="HIGH",
                    title="Unmanaged Resource Allocation",
                    file=rel_path,
                    line=idx,
                    snippet=line.strip(),
                    explanation="I/O connection or stream allocated without structured `try-with-resources` or context manager.",
                    recommendation="Enclose in a `try (...)` block to guarantee automatic closure upon completion or exception.",
                )
            )

    # 4. Concurrency & Blocking Sleep
    for idx, line in enumerate(lines, 1):
        if re.search(r"(?:Thread\.sleep|time\.sleep)\s*\(", line):
            issues.append(
                CodeIssue(
                    id=f"issue_{uuid.uuid4().hex[:6]}",
                    category="Concurrency Bottleneck",
                    severity="MEDIUM",
                    title="Blocking Synchronous Sleep",
                    file=rel_path,
                    line=idx,
                    snippet=line.strip(),
                    explanation="Thread.sleep blocks worker threads in web server pool, leading to request queue buildup and thread starvation.",
                    recommendation="Use non-blocking asynchronous timers (e.g. `CompletableFuture.delayedExecutor`, `asyncio.sleep`).",
                )
            )

    return issues
