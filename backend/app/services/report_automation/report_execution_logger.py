"""Persist report execution logs and generated files."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from app import db
from app.models import ReportAutomation, ReportExecutionLog, generate_id

from app.config import INSTANCE_DIR

REPORT_FILES_DIR = INSTANCE_DIR / "report_automation"


def save_report_file(automation_id: str, log_id: str, file_bytes: bytes, filename: str) -> str:
    REPORT_FILES_DIR.mkdir(parents=True, exist_ok=True)
    dest_dir = REPORT_FILES_DIR / automation_id
    dest_dir.mkdir(parents=True, exist_ok=True)
    safe_name = Path(filename).name
    path = dest_dir / f"{log_id}_{safe_name}"
    path.write_bytes(file_bytes)
    return str(path.relative_to(INSTANCE_DIR)).replace("\\", "/")


def create_log(automation: ReportAutomation, *, manual: bool = False) -> ReportExecutionLog:
    log = ReportExecutionLog(
        id=generate_id(),
        report_automation_id=automation.id,
        execution_time=datetime.utcnow(),
        status="failed",
        is_manual=manual,
        recipient_count=0,
    )
    db.session.add(log)
    db.session.flush()
    return log


def finalize_log(
    log: ReportExecutionLog,
    *,
    success: bool,
    recipient_count: int,
    file_path: str = "",
    error_message: str = "",
    recipient_user_ids: list[str] | None = None,
) -> ReportExecutionLog:
    log.status = "success" if success else "failed"
    log.recipient_count = recipient_count
    log.file_path = file_path or ""
    log.error_message = error_message or ""
    if recipient_user_ids is not None:
        log.recipient_user_ids = json.dumps(recipient_user_ids)
    db.session.commit()
    return log
