"""Isolated fix workspace.

AI-generated patches are NEVER applied to the running host. Instead the target
source file is copied into a sandboxed per-incident workspace under
``backend/.workspaces`` and the patch is applied there as a validated,
path-checked string replacement. The test runner then verifies that workspace.
"""
from __future__ import annotations

import shutil
from pathlib import Path

from app.simulation import fixtures

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

# Fallback content if the demo source file is unavailable, so the sandbox is
# always populated with something patchable.
_FALLBACK_SOURCE = f"""public OrderView loadOrderWithProducts(Long orderId) {{
    Order order = orderRepository.findById(orderId);
{_SEARCH_BLOCK}
    return OrderView.of(order, itemViews);
}}
"""


def _incident_dir(incident_id: int) -> Path:
    return WORKSPACE_ROOT / f"incident_{incident_id}"


def _workspace_file(incident_id: int) -> Path:
    return _incident_dir(incident_id) / "OrderService.java"


def _assert_within_workspace(path: Path) -> Path:
    resolved = path.resolve()
    if WORKSPACE_ROOT.resolve() not in resolved.parents and resolved != WORKSPACE_ROOT.resolve():
        raise ValueError("Refusing to touch a path outside the sandbox workspace")
    return resolved


def prepare_workspace(incident_id: int) -> Path:
    """Copy the target source into a fresh per-incident sandbox."""
    dest = _assert_within_workspace(_workspace_file(incident_id))
    dest.parent.mkdir(parents=True, exist_ok=True)
    if DEMO_SOURCE.exists():
        shutil.copyfile(DEMO_SOURCE, dest)
    else:
        dest.write_text(_FALLBACK_SOURCE, encoding="utf-8")
    return dest


def apply_fix(incident_id: int) -> Path:
    """Apply the batch-query patch inside the sandbox. Idempotent."""
    dest = _assert_within_workspace(_workspace_file(incident_id))
    if not dest.exists():
        prepare_workspace(incident_id)

    content = dest.read_text(encoding="utf-8")
    if "fetchProductsByIds" in content:
        return dest  # already patched
    if _SEARCH_BLOCK not in content:
        raise ValueError("Patch target not found — refusing to apply an unverified patch")
    content = content.replace(_SEARCH_BLOCK, _REPLACE_BLOCK)
    dest.write_text(content, encoding="utf-8")
    return dest


def is_patched(incident_id: int) -> bool:
    dest = _workspace_file(incident_id)
    if not dest.exists():
        return False
    content = dest.read_text(encoding="utf-8")
    # Patched iff the batch call is present and the per-item N+1 loop is gone.
    return "fetchProductsByIds" in content and "fetchProduct(item.getProductId())" not in content


def cleanup(incident_id: int) -> None:
    d = _incident_dir(incident_id)
    if d.exists():
        shutil.rmtree(d, ignore_errors=True)
