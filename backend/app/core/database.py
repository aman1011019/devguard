"""Database engine, session factory and Base declarative class."""
from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings

# SQLite needs check_same_thread disabled because the async orchestrator touches
# the DB from worker threads. For PostgreSQL no special connect args are needed.
_connect_args = (
    {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
)

engine = create_engine(
    settings.database_url,
    connect_args=_connect_args,
    pool_pre_ping=True,
    future=True,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    pass


def get_db() -> Iterator[Session]:
    """FastAPI dependency yielding a scoped DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def session_scope() -> Iterator[Session]:
    """Context manager used by background tasks / the orchestrator."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def init_db() -> None:
    """Create all tables. Safe to call repeatedly."""
    from app.models import models  # noqa: F401  (register mappers)

    Base.metadata.create_all(bind=engine)

    # Auto-migrate SQLite schema if new columns are added to Incident
    if settings.database_url.startswith("sqlite"):
        with engine.connect() as conn:
            from sqlalchemy import text
            res = conn.execute(text("PRAGMA table_info(incidents)"))
            cols = {row[1] for row in res.fetchall()}
            for col_name, col_type in [
                ("repository", "VARCHAR(240)"),
                ("branch", "VARCHAR(120)"),
                ("commit_sha", "VARCHAR(64)"),
                ("author", "VARCHAR(120)"),
                ("is_demo", "BOOLEAN DEFAULT 0"),
            ]:
                if col_name not in cols:
                    try:
                        conn.execute(text(f"ALTER TABLE incidents ADD COLUMN {col_name} {col_type}"))
                        conn.commit()
                    except Exception:
                        pass
