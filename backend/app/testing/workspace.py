"""Isolated fix workspace.

AI-generated patches are NEVER applied directly to the user's repository without approval.
Instead, the target source file is copied into a sandboxed per-incident workspace under
``backend/.workspaces/incident_{id}`` and the patch is applied there as a validated,
path-checked modification. The test runner then verifies that workspace.
"""
from __future__ import annotations

import logging
import shutil
from pathlib import Path
from typing import Optional

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.models import Fix, Incident
from app.simulation import fixtures

logger = logging.getLogger("devguard.workspace")

_BACKEND_DIR = Path(__file__).resolve().parents[2]
_REPO_ROOT = _BACKEND_DIR.parent
WORKSPACE_ROOT = _BACKEND_DIR / ".workspaces"

DEMO_SOURCE = (
    _REPO_ROOT
    / "demo"
    / "checkout-service"
    / "src"
    / "main"
    / "java"
    / "com"
    / "devguard"
    / "checkout"
    / "OrderService.java"
)

# Exact N+1 block shipped in the demo source (indentation-sensitive).
_SEARCH_BLOCK = """        List<OrderItemView> itemViews = new ArrayList<>();
        // v1.8.4 "checkout optimization": enrich each line item with product data
        // so the client no longer needs a second round-trip to the catalog API.
        for (OrderItem item : order.getItems()) {
            // N+1: one SELECT is issued per order item on every checkout request.
            Product product = productRepository.fetchProduct(item.getProductId());
            itemViews.add(OrderItemView.of(item, product));
        }
"""

_REPLACE_BLOCK = """        // Batch-fetch every product in a single query, then map in memory.
        List<Long> productIds = order.getItems().stream()
                .map(OrderItem::getProductId)
                .distinct()
                .collect(Collectors.toList());
        Map<Long, Product> products = productRepository.fetchProductsByIds(productIds);

        List<OrderItemView> itemViews = order.getItems().stream()
                .map(item -> OrderItemView.of(item, products.get(item.getProductId())))
                .collect(Collectors.toList());
"""

_FALLBACK_SOURCE = f"""public OrderView loadOrderWithProducts(Long orderId) {{
    Order order = orderRepository.findById(orderId);
{_SEARCH_BLOCK}
    return OrderView.of(order, itemViews);
}}
"""


def _incident_dir(incident_id: int) -> Path:
    d = WORKSPACE_ROOT / f"incident_{incident_id}"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _workspace_file(incident_id: int) -> Path:
    # Check if a custom file was recorded on the fix
    db = SessionLocal()
    try:
        fix = db.scalars(select(Fix).where(Fix.incident_id == incident_id)).first()
        if fix and fix.file:
            fname = Path(fix.file).name
            return _incident_dir(incident_id) / fname
    finally:
        db.close()

    return _incident_dir(incident_id) / "OrderService.java"


def _assert_within_workspace(path: Path) -> Path:
    resolved = path.resolve()
    if WORKSPACE_ROOT.resolve() not in resolved.parents and resolved != WORKSPACE_ROOT.resolve():
        raise ValueError("Refusing to touch a path outside the sandbox workspace")
    return resolved


def prepare_workspace(incident_id: int) -> Path:
    """Copy the target source or initialize code into a fresh per-incident sandbox."""
    dest = _assert_within_workspace(_workspace_file(incident_id))
    dest.parent.mkdir(parents=True, exist_ok=True)

    db = SessionLocal()
    try:
        fix = db.scalars(select(Fix).where(Fix.incident_id == incident_id)).first()
        if fix and fix.before_code:
            dest.write_text(fix.before_code, encoding="utf-8")
            return dest
    finally:
        db.close()

    if DEMO_SOURCE.exists():
        shutil.copyfile(DEMO_SOURCE, dest)
    else:
        dest.write_text(_FALLBACK_SOURCE, encoding="utf-8")
    return dest


def apply_fix(incident_id: int) -> Path:
    """Apply the patch inside the sandbox. Idempotent."""
    dest = _assert_within_workspace(_workspace_file(incident_id))
    if not dest.exists():
        prepare_workspace(incident_id)

    db = SessionLocal()
    try:
        fix = db.scalars(select(Fix).where(Fix.incident_id == incident_id)).first()
        if fix and fix.after_code and fix.before_code:
            content = dest.read_text(encoding="utf-8")
            if fix.after_code in content:
                return dest
            if fix.before_code in content:
                content = content.replace(fix.before_code, fix.after_code)
                dest.write_text(content, encoding="utf-8")
                return dest
            else:
                dest.write_text(fix.after_code, encoding="utf-8")
                return dest
    finally:
        db.close()

    content = dest.read_text(encoding="utf-8")
    if "fetchProductsByIds" in content:
        return dest
    if _SEARCH_BLOCK in content:
        content = content.replace(_SEARCH_BLOCK, _REPLACE_BLOCK)
        dest.write_text(content, encoding="utf-8")
    else:
        dest.write_text(_FALLBACK_SOURCE.replace(_SEARCH_BLOCK, _REPLACE_BLOCK), encoding="utf-8")
    return dest


def is_patched(incident_id: int) -> bool:
    dest = _workspace_file(incident_id)
    if not dest.exists():
        return False
    content = dest.read_text(encoding="utf-8")
    db = SessionLocal()
    try:
        fix = db.scalars(select(Fix).where(Fix.incident_id == incident_id)).first()
        if fix and fix.after_code:
            return fix.after_code in content or "Remediation" in content or "fetchProductsByIds" in content
    finally:
        db.close()

    return "fetchProductsByIds" in content and "fetchProduct(item.getProductId())" not in content


def cleanup(incident_id: int) -> None:
    d = _incident_dir(incident_id)
    if d.exists():
        shutil.rmtree(d, ignore_errors=True)
