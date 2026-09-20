"""Services health and telemetry API."""
from __future__ import annotations

from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import Incident

router = APIRouter(prefix="/api/services", tags=["services"])


@router.get("")
@router.get("/")
async def list_services(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    # Check status of active incident for Checkout API
    active_inc = db.scalars(
        select(Incident).where(Incident.service == "Checkout API", Incident.status != "RESOLVED").order_by(Incident.id.desc())
    ).first()

    checkout_status = "CRITICAL" if active_inc else "HEALTHY"
    checkout_latency = active_inc.latency_ms if active_inc else 210.0
    checkout_errors = active_inc.error_rate if active_inc else 0.8
    checkout_queries = active_inc.db_queries_per_request if active_inc else 3

    return [
        {
            "id": "checkout-api",
            "name": "Checkout API",
            "status": checkout_status,
            "latency_ms": checkout_latency,
            "error_rate": checkout_errors,
            "db_queries_per_req": checkout_queries,
            "requests_per_sec": "1.8k rps",
            "version": "v1.8.4",
            "description": "Customer payment checkout & inventory reservation pipeline",
            "last_incident_id": active_inc.id if active_inc else None,
        },
        {
            "id": "payments-api",
            "name": "Payments API",
            "status": "HEALTHY",
            "latency_ms": 95.0,
            "error_rate": 0.05,
            "db_queries_per_req": 2,
            "requests_per_sec": "850 rps",
            "version": "v2.3.1",
            "description": "Third-party payment gateways (Stripe, Adyen, PayPal)",
            "last_incident_id": None,
        },
        {
            "id": "auth-service",
            "name": "Auth Service",
            "status": "HEALTHY",
            "latency_ms": 42.0,
            "error_rate": 0.01,
            "db_queries_per_req": 1,
            "requests_per_sec": "4.2k rps",
            "version": "v3.0.4",
            "description": "OAuth2 / OIDC authentication token verification",
            "last_incident_id": None,
        },
        {
            "id": "orders-service",
            "name": "Orders Service",
            "status": "DEGRADED",
            "latency_ms": 680.0,
            "error_rate": 4.2,
            "db_queries_per_req": 14,
            "requests_per_sec": "620 rps",
            "version": "v1.8.4",
            "description": "Order lifecycle, invoice rendering, and dispatch queue",
            "last_incident_id": None,
        },
        {
            "id": "database-aurora",
            "name": "Database",
            "status": "DEGRADED",
            "latency_ms": 320.0,
            "error_rate": 2.8,
            "db_queries_per_req": 25,
            "requests_per_sec": "18.4k qps",
            "version": "PostgreSQL 16.2",
            "description": "Primary transactional relational datastore cluster",
            "last_incident_id": None,
        },
    ]


@router.get("/{service_id}")
async def get_service(service_id: str, db: Session = Depends(get_db)) -> Dict[str, Any]:
    services = await list_services(db)
    matched = next((s for s in services if s["id"] == service_id or s["name"].lower().replace(" ", "-") == service_id.lower()), None)
    if not matched:
        raise HTTPException(status_code=404, detail=f"Service {service_id} not found")

    return {
        "service": matched,
        "recent_deployments": [
            {"version": "v1.8.4", "author": "j.tanaka", "timestamp": "19:14:00", "status": "FAILED"},
            {"version": "v1.8.3", "author": "s.patel", "timestamp": "3 days ago", "status": "HEALTHY"},
        ],
        "recent_logs": [
            {"timestamp": "19:21:04", "level": "ERROR", "message": "Connection pool timeout after 3000ms"},
            {"timestamp": "19:21:03", "level": "WARN", "message": "Slow query detected: SELECT * FROM products WHERE id = ?"},
            {"timestamp": "19:21:00", "level": "INFO", "message": "Health check responded in 4800ms"},
        ],
    }
