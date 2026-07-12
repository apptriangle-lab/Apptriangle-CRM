"""Cross-process lock so only one worker sends a scheduled report slot."""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import text

from app import db


def _lock_name(automation_id: str, scheduled_at: datetime) -> str:
    slot = scheduled_at.astimezone(ZoneInfo("UTC")).strftime("%Y%m%d%H%M")
    return f"crm_ra_{automation_id}_{slot}"[:64]


def try_acquire_scheduled_run_lock(automation_id: str, scheduled_at: datetime) -> bool:
    """Return True when this process won the right to run this scheduled slot."""
    name = _lock_name(automation_id, scheduled_at)
    dialect = db.engine.dialect.name
    if dialect != "mysql":
        return True
    got = db.session.execute(text("SELECT GET_LOCK(:name, 0)"), {"name": name}).scalar()
    return got == 1


def release_scheduled_run_lock(automation_id: str, scheduled_at: datetime) -> None:
    name = _lock_name(automation_id, scheduled_at)
    dialect = db.engine.dialect.name
    if dialect != "mysql":
        return
    try:
        db.session.execute(text("SELECT RELEASE_LOCK(:name)"), {"name": name})
    except Exception:
        db.session.rollback()
