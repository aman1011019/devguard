"""Deterministic golden fixtures for the flagship DevGuard demo.

Everything the demo needs to run *without* any external service or LLM lives
here. The numbers, code, logs and evidence are intentionally fixed so the
BREAK -> INVESTIGATE -> EXPLAIN -> FIX -> VERIFY -> RECOVER story is identical
every single time it is presented to a judge.
"""
from __future__ import annotations

# ── Service identity ──────────────────────────────────────────────────────────
SERVICE = "Checkout API"
INCIDENT_TITLE = "Checkout API Failure"
SEVERITY = "CRITICAL"
BAD_DEPLOYMENT = "v1.8.4"
RECOVERY_DEPLOYMENT = "v1.8.5"
BAD_COMMIT = "8f41c2a"
FIX_COMMIT = "9e2f7b1"
SOURCE_FILE = "OrderService.java"
SOURCE_PATH = "src/main/java/com/devguard/checkout/OrderService.java"
BUG_LINE = 184

# ── Metric snapshots ────────────────────────────────────────────────────────────
HEALTHY_METRICS = {
    "latency_ms": 200.0,
    "error_rate": 1.0,
    "db_queries_per_request": 3,
    "db_latency_ms": 40.0,
    "requests_per_min": "8.2K/min",
}

BROKEN_METRICS = {
    "latency_ms": 4800.0,
    "error_rate": 21.8,
    "db_queries_per_request": 25,
    "db_latency_ms": 3900.0,
    "requests_per_min": "12.4K/min",
}

RECOVERED_METRICS = {
    "latency_ms": 210.0,
    "error_rate": 0.8,
    "db_queries_per_request": 3,
    "db_latency_ms": 42.0,
    "requests_per_min": "11.8K/min",
}

# Human-facing deltas quoted by the Telemetry Agent (verbatim from the brief).
TELEMETRY_DELTAS = {
    "query_count": "+840%",
    "db_latency": "+620%",
    "checkout_latency": "+580%",
}

# ── Deployments (the fixture git history) ────────────────────────────────────────
DEPLOYMENTS = [
    {
        "version": "v1.8.2",
        "description": "baseline checkout",
        "author": "priya.n",
        "commit_sha": "a1b2c3d",
        "offset_min": -220,
    },
    {
        "version": "v1.8.3",
        "description": "payment improvements",
        "author": "marco.r",
        "commit_sha": "c4d5e6f",
        "offset_min": -95,
    },
    {
        "version": "v1.8.4",
        "description": "checkout optimization (enrich order items with product data)",
        "author": "j.tanaka",
        "commit_sha": BAD_COMMIT,
        "offset_min": -6,
    },
]

# ── Incident timeline ────────────────────────────────────────────────────────────
TIMELINE = [
    {"time_label": "14:32", "title": "Deployment v1.8.4 released", "detail": "checkout optimization — OrderService modified", "kind": "deploy"},
    {"time_label": "14:34", "title": "Database latency increased", "detail": "avg query time 40ms → 3.9s", "kind": "event"},
    {"time_label": "14:35", "title": "Checkout latency increased", "detail": "p95 200ms → 4.8s", "kind": "event"},
    {"time_label": "14:36", "title": "Error rate exceeded threshold", "detail": "error rate 1% → 21.8% (threshold 5%)", "kind": "alert"},
    {"time_label": "14:37", "title": "DevGuard investigation started", "detail": "autonomous agents dispatched", "kind": "action"},
]

# ── Application logs ────────────────────────────────────────────────────────────
LOGS = [
    {"timestamp": "14:32:01", "level": "INFO", "message": "Deployment v1.8.4 rolled out to 12 checkout pods"},
    {"timestamp": "14:34:11", "level": "INFO", "message": "Checkout request received order=9182 items=22"},
    {"timestamp": "14:34:12", "level": "INFO", "message": "Fetching order 9182 with product enrichment"},
    {"timestamp": "14:34:14", "level": "WARN", "message": "Database query latency 1832ms on product lookup"},
    {"timestamp": "14:35:02", "level": "WARN", "message": "Connection pool utilisation 92% (46/50 active)"},
    {"timestamp": "14:35:19", "level": "WARN", "message": "Database query latency 3901ms on product lookup"},
    {"timestamp": "14:35:22", "level": "ERROR", "message": "Database query timeout after 3000ms (SELECT * FROM products WHERE id = ?)"},
    {"timestamp": "14:35:23", "level": "ERROR", "message": "Checkout request timeout order=9182 elapsed=4812ms"},
    {"timestamp": "14:35:24", "level": "ERROR", "message": "SQL timeout exceeded — 25 queries issued for a single checkout"},
    {"timestamp": "14:35:41", "level": "ERROR", "message": "HTTP 500 returned for POST /checkout order=9184"},
    {"timestamp": "14:36:02", "level": "ERROR", "message": "Circuit breaker OPEN for productRepository.fetchProduct"},
    {"timestamp": "14:36:03", "level": "ERROR", "message": "Checkout error rate 21.8% over trailing 60s window"},
]

# ── Java source: buggy vs fixed method (as shipped in demo/checkout-service) ──────
BUGGY_METHOD = """List<OrderItemView> itemViews = new ArrayList<>();
// v1.8.4 "checkout optimization": enrich each line item with product data.
for (OrderItem item : order.getItems()) {
    // N+1: one SELECT is issued per order item on every checkout request.
    Product product = productRepository.fetchProduct(item.getProductId());
    itemViews.add(OrderItemView.of(item, product));
}
return OrderView.of(order, itemViews);"""

FIXED_METHOD = """// Batch-fetch every product in a single query, then map in memory.
List<Long> productIds = order.getItems().stream()
        .map(OrderItem::getProductId)
        .distinct()
        .collect(Collectors.toList());
Map<Long, Product> products = productRepository.fetchProductsByIds(productIds);

List<OrderItemView> itemViews = order.getItems().stream()
        .map(item -> OrderItemView.of(item, products.get(item.getProductId())))
        .collect(Collectors.toList());
return OrderView.of(order, itemViews);"""

# The commit that INTRODUCED the incident (v1.8.4) — shown in the diff viewer.
CAUSE_DIFF = """--- a/src/main/java/com/devguard/checkout/OrderService.java
+++ b/src/main/java/com/devguard/checkout/OrderService.java
@@ -181,7 +181,13 @@ public OrderView loadOrderWithProducts(Long orderId) {
-        Order order = orderRepository.findById(orderId);
-        return OrderView.of(order, order.getItems());
+        Order order = orderRepository.findById(orderId);
+
+        List<OrderItemView> itemViews = new ArrayList<>();
+        // v1.8.4 "checkout optimization": enrich each line item with product data.
+        for (OrderItem item : order.getItems()) {
+            Product product = productRepository.fetchProduct(item.getProductId());
+            itemViews.add(OrderItemView.of(item, product));
+        }
+        return OrderView.of(order, itemViews);"""

# The proposed fix (v1.8.5) — batch query.
FIX_DIFF = """--- a/src/main/java/com/devguard/checkout/OrderService.java
+++ b/src/main/java/com/devguard/checkout/OrderService.java
@@ -181,11 +181,13 @@ public OrderView loadOrderWithProducts(Long orderId) {
-        List<OrderItemView> itemViews = new ArrayList<>();
-        // v1.8.4 "checkout optimization": enrich each line item with product data.
-        for (OrderItem item : order.getItems()) {
-            // N+1: one SELECT is issued per order item on every checkout request.
-            Product product = productRepository.fetchProduct(item.getProductId());
-            itemViews.add(OrderItemView.of(item, product));
-        }
+        // Batch-fetch every product in a single query, then map in memory.
+        List<Long> productIds = order.getItems().stream()
+                .map(OrderItem::getProductId)
+                .distinct()
+                .collect(Collectors.toList());
+        Map<Long, Product> products = productRepository.fetchProductsByIds(productIds);
+        List<OrderItemView> itemViews = order.getItems().stream()
+                .map(item -> OrderItemView.of(item, products.get(item.getProductId())))
+                .collect(Collectors.toList());
         return OrderView.of(order, itemViews);"""

FIX_EXPLANATION = (
    "Replace the per-item product lookup with a single batched query. "
    "Instead of calling productRepository.fetchProduct() once per order item "
    "(the N+1 pattern introduced in v1.8.4), collect all product IDs and fetch "
    "them in one round-trip with fetchProductsByIds(), then map results in "
    "memory. This restores a constant 3 queries per checkout regardless of "
    "cart size."
)
FIX_SUMMARY = "Batch product lookups into a single query (remove N+1)"
FIX_EXPECTED_IMPACT = "~87% fewer database queries"
FIX_RISK = "LOW"

# ── Root cause ────────────────────────────────────────────────────────────────
ROOT_CAUSE = {
    "title": "N+1 Database Query",
    "category": "Database / ORM",
    "file": SOURCE_FILE,
    "line": BUG_LINE,
    "commit_sha": BAD_COMMIT,
    "confidence": 0.96,
    "explanation": (
        "An N+1 database query introduced in OrderService.java:184 during deployment v1.8.4 "
        "caused database queries to increase from 3 to 25 per request, driving latency from 200ms to 4800ms."
    ),
    "reasons": [
        "Recent deployment v1.8.4 changed OrderService",
        "Query count increased 8.4× (3 → 25/request)",
        "Database latency increased 40ms → 3.9s",
        "Checkout latency increased 200ms → 4.8s",
        "Error pattern matches database timeout",
        "Timing correlates with deployment v1.8.4 by j.tanaka",
    ],
    "evidence_ids": ["git_4", "metric_7", "log_12", "trace_2", "db_1"],
    "hypothesis_label": "Evidence-weighted hypothesis score",
    "alternatives": [
        {"name": "N+1 database query", "confidence": 0.96, "selected": True},
        {"name": "Database outage", "confidence": 0.04, "selected": False},
        {"name": "Network degradation", "confidence": 0.01, "selected": False},
    ],
}

# ── Agent findings (deterministic) ────────────────────────────────────────────
AGENT_FINDINGS = {
    "log_agent": {
        "finding": "Detected repeated timeout patterns in Checkout API.",
        "detail": {
            "pattern": "Database query timeout after 3000ms",
            "relevant_entries": 37,
            "error_entries": 6,
            "first_error": "14:35:22",
            "evidence_ids": ["log_12", "log_9"],
        },
        "confidence": 0.91,
    },
    "code_agent": {
        "finding": "OrderService.java:184 changed in v1.8.4 by j.tanaka",
        "detail": {
            "file": SOURCE_FILE,
            "path": SOURCE_PATH,
            "line": BUG_LINE,
            "commit": BAD_COMMIT,
            "deployment": BAD_DEPLOYMENT,
            "author": "j.tanaka",
            "evidence_ids": ["git_4"],
        },
        "confidence": 0.96,
    },
    "telemetry_agent": {
        "finding": "Latency and database query volume increased immediately after deployment v1.8.4.",
        "detail": {
            "query_count": TELEMETRY_DELTAS["query_count"],
            "db_latency": TELEMETRY_DELTAS["db_latency"],
            "checkout_latency": TELEMETRY_DELTAS["checkout_latency"],
            "evidence_ids": ["metric_7", "trace_2"],
        },
        "confidence": 0.98,
    },
    "reasoning_agent": {
        "finding": "Root cause confidence: 96% — N+1 database query in OrderService.java:184",
        "detail": {
            "confidence": 0.96,
            "evidence_ids": ROOT_CAUSE["evidence_ids"],
            "hypothesis_label": "Evidence-weighted hypothesis score",
            "hypotheses": ROOT_CAUSE["alternatives"],
        },
        "confidence": 0.96,
    },
    "fix_agent": {
        "finding": "Patch generated",
        "detail": {
            "file": SOURCE_FILE,
            "risk": FIX_RISK,
            "expected_impact": FIX_EXPECTED_IMPACT,
        },
        "confidence": 0.96,
    },
}

# ── Evidence catalogue ────────────────────────────────────────────────────────
# key, type, source, agent, timestamp, relevance, title, content
EVIDENCE = [
    {
        "key": "log_12", "type": "LOG", "source": "Application Logs", "agent": "LOG AGENT",
        "timestamp": "14:35:22", "relevance": 0.98,
        "title": "Checkout request exceeded timeout threshold.",
        "content": "ERROR Checkout request exceeded timeout threshold (3000ms).\nDatabase query timeout after 3000ms (SELECT * FROM products WHERE id = ?)\nContext: order=9182 query_index=18/25 pool=46/50 elapsed=4812ms",
        "meta": {"level": "ERROR", "count": 37, "timeout_ms": 3000},
    },
    {
        "key": "git_4", "type": "CODE", "source": "Git Repository — OrderService.java", "agent": "CODE AGENT",
        "timestamp": "14:32:00", "relevance": 0.96,
        "title": "OrderService.java:184",
        "content": CAUSE_DIFF,
        "meta": {"file": SOURCE_FILE, "line": BUG_LINE, "commit": BAD_COMMIT, "author": "j.tanaka"},
    },
    {
        "key": "deploy_1", "type": "DEPLOYMENT", "source": "Deployment Pipeline", "agent": "CODE AGENT",
        "timestamp": "14:31:45", "relevance": 0.95,
        "title": "v1.8.4",
        "content": "Deployment v1.8.4 released to 12 checkout pods by j.tanaka.\nCommit: 8f41c2a (checkout optimization — enrich order items with product data).\nResulted in immediate latency and error spike.",
        "meta": {"version": BAD_DEPLOYMENT, "commit": BAD_COMMIT, "author": "j.tanaka"},
    },
    {
        "key": "metric_7", "type": "TELEMETRY", "source": "Telemetry — Prometheus", "agent": "TELEMETRY AGENT",
        "timestamp": "14:35:00", "relevance": 0.97,
        "title": "DB queries: 3 → 25/request",
        "content": "db.queries_per_request increased from 3 to 25 per request (+840%) immediately following deployment v1.8.4.\nDB latency surged 40ms → 3900ms (+620%).\nCheckout latency rose from 200ms to 4800ms.",
        "meta": {"query_count": "+840%", "db_latency": "+620%", "queries_per_req": "3 → 25"},
    },
    {
        "key": "author_1", "type": "AUTHOR", "source": "Git Blame / Commit Log", "agent": "CODE AGENT",
        "timestamp": "14:32:00", "relevance": 0.92,
        "title": "j.tanaka",
        "content": "Author: j.tanaka <j.tanaka@devguard.internal>\nCommit: 8f41c2a\nMessage: 'checkout optimization: enrich line items with product details'\nIntroduced sequential loop calling productRepository.fetchProduct() at OrderService.java:184",
        "meta": {"author": "j.tanaka", "commit": BAD_COMMIT, "file": SOURCE_FILE},
    },
    {
        "key": "trace_2", "type": "TRACES", "source": "Distributed Tracing — Jaeger", "agent": "TELEMETRY AGENT",
        "timestamp": "14:35:10", "relevance": 0.9,
        "title": "Checkout span shows 25 sequential DB child spans",
        "content": "trace 4f9a… POST /checkout (4812ms) → OrderService.loadOrderWithProducts → 25× productRepository.fetchProduct (avg 190ms each, sequential).",
        "meta": {"spans": 25, "duration_ms": 4812},
    },
    {
        "key": "db_1", "type": "DATABASE", "source": "PostgreSQL — pg_stat_statements", "agent": "TELEMETRY AGENT",
        "timestamp": "14:35:15", "relevance": 0.86,
        "title": "SELECT products WHERE id = ? called 25× per checkout",
        "content": "calls=312480 mean_time=178ms  query='SELECT * FROM products WHERE id = $1'  — up from 3 calls/checkout baseline.",
        "meta": {"calls_per_checkout": 25},
    },
    {
        "key": "api_1", "type": "API", "source": "API Gateway", "agent": "LOG AGENT",
        "timestamp": "14:35:41", "relevance": 0.82,
        "title": "HTTP 500 rate 21.8% on POST /checkout",
        "content": "POST /checkout 5xx rate 21.8% (trailing 60s). Upstream: checkout-service. Timeout budget 3000ms exceeded.",
        "meta": {"status": 500, "error_rate": 21.8},
    },
]

# ── Evidence correlation graph ────────────────────────────────────────────────
EVIDENCE_GRAPH = {
    "nodes": [
        {"id": "deploy", "label": "Deployment v1.8.4", "type": "deploy", "detail": "checkout optimization", "evidence_key": "git_4"},
        {"id": "code", "label": "OrderService.java modified", "type": "code", "detail": f"line {BUG_LINE}", "evidence_key": "git_4"},
        {"id": "query", "label": "New database query", "type": "code", "detail": "per-item product fetch", "evidence_key": "git_4"},
        {"id": "querycount", "label": "Query count +840%", "type": "metric", "detail": "3 → 25 / request", "evidence_key": "metric_7"},
        {"id": "dblatency", "label": "Database latency +620%", "type": "metric", "detail": "40ms → 3.9s", "evidence_key": "metric_7"},
        {"id": "apilatency", "label": "Checkout latency +580%", "type": "metric", "detail": "200ms → 4.8s", "evidence_key": "trace_2"},
        {"id": "errors", "label": "HTTP 500 errors", "type": "error", "detail": "error rate 21.8%", "evidence_key": "api_1"},
    ],
    "edges": [
        {"source": "deploy", "target": "code", "label": "changed"},
        {"source": "code", "target": "query", "label": "introduced"},
        {"source": "query", "target": "querycount", "label": "caused"},
        {"source": "querycount", "target": "dblatency", "label": "drove"},
        {"source": "dblatency", "target": "apilatency", "label": "propagated"},
        {"source": "apilatency", "target": "errors", "label": "resulted in"},
    ],
}

# ── Test plan (executed for real against the recovered simulation state) ─────────
TEST_PLAN = [
    {"name": "CheckoutServiceTest", "count": 12, "kind": "unit"},
    {"name": "OrderServiceTest", "count": 14, "kind": "unit"},
    {"name": "ProductRepositoryTest", "count": 10, "kind": "integration"},
    {"name": "PaymentFlowTest", "count": 8, "kind": "regression"},
]
# Headline shown in the UI: 12 + 14 + 10 + 8 = 44
TEST_HEADLINE_TOTAL = 12 + 14 + 10 + 8  # 44

# ── Recovery ─────────────────────────────────────────────────────────────────
RECOVERY_DURATION_SECONDS = 6 * 60 + 42  # 6m 42s
