"""CRUD and execution for report automations."""

from __future__ import annotations

import json
from datetime import date, datetime, timedelta

from app import db
from app.models import (
    HRInfo,
    ReportAutomation,
    ReportAutomationRecipient,
    ReportAutomationShift,
    ReportExecutionLog,
    User,
    generate_id,
)
from app.services.report_automation.report_email_service import send_report_to_recipients
from app.services.report_automation.report_execution_logger import (
    create_log,
    finalize_log,
    save_report_file,
)
from app.services.report_automation.report_generator_factory import ReportGeneratorFactory
from app.services.report_automation.schedule_utils import (
    compute_next_run,
    format_schedule_label,
)
from zoneinfo import ZoneInfo


REPORT_TYPES = {"attendance": "Attendance Report"}
SCHEDULE_TYPES = {"one_time", "daily", "weekly", "monthly"}


class ReportAutomationError(Exception):
    pass


def _parse_date(value) -> date:
    if not value:
        raise ReportAutomationError("startDate is required")
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value)[:10])


def _validate_payload(data: dict, *, partial: bool = False) -> dict:
    out: dict = {}
    if not partial or "reportName" in data:
        name = (data.get("reportName") or "").strip()
        if not name:
            raise ReportAutomationError("reportName is required")
        out["report_name"] = name[:255]

    if not partial or "reportType" in data:
        rtype = (data.get("reportType") or "attendance").strip().lower()
        if rtype not in REPORT_TYPES:
            raise ReportAutomationError(f"Unsupported reportType: {rtype}")
        out["report_type"] = rtype

    if "description" in data or not partial:
        out["description"] = (data.get("description") or "").strip()

    if not partial or "scheduleType" in data:
        st = (data.get("scheduleType") or "").strip().lower()
        if st not in SCHEDULE_TYPES:
            raise ReportAutomationError("Invalid scheduleType")
        out["schedule_type"] = st

    if not partial or "startDate" in data:
        out["start_date"] = _parse_date(data.get("startDate"))

    if not partial or "executionTime" in data:
        et = (data.get("executionTime") or "").strip()
        if not et or ":" not in et:
            raise ReportAutomationError("executionTime is required (HH:MM)")
        out["execution_time"] = et[:8]

    if not partial or "timezone" in data:
        out["timezone"] = (data.get("timezone") or "UTC").strip()[:64] or "UTC"

    if "isActive" in data or not partial:
        out["is_active"] = bool(data.get("isActive", True))

    return out


def _set_relations(automation: ReportAutomation, shift_ids: list[str], recipient_ids: list[str]) -> None:
    if not shift_ids:
        raise ReportAutomationError("At least one shift is required")
    if not recipient_ids:
        raise ReportAutomationError("At least one recipient is required")

    ReportAutomationShift.query.filter_by(report_automation_id=automation.id).delete()
    ReportAutomationRecipient.query.filter_by(report_automation_id=automation.id).delete()

    for sid in shift_ids:
        db.session.add(
            ReportAutomationShift(
                id=generate_id(),
                report_automation_id=automation.id,
                shift_id=sid,
            )
        )

    for uid in recipient_ids:
        db.session.add(
            ReportAutomationRecipient(
                id=generate_id(),
                report_automation_id=automation.id,
                user_id=uid,
            )
        )


def _last_execution_by_automation(automation_ids: list[str]) -> dict[str, ReportExecutionLog]:
    if not automation_ids:
        return {}
    from sqlalchemy import func

    sub = (
        db.session.query(
            ReportExecutionLog.report_automation_id,
            func.max(ReportExecutionLog.execution_time).label("max_time"),
        )
        .filter(ReportExecutionLog.report_automation_id.in_(automation_ids))
        .group_by(ReportExecutionLog.report_automation_id)
        .subquery()
    )
    rows = (
        db.session.query(ReportExecutionLog)
        .join(
            sub,
            (ReportExecutionLog.report_automation_id == sub.c.report_automation_id)
            & (ReportExecutionLog.execution_time == sub.c.max_time),
        )
        .all()
    )
    return {row.report_automation_id: row for row in rows}


def _serialize(automation: ReportAutomation, *, last_log: ReportExecutionLog | None = None) -> dict:
    next_run = compute_next_run(automation)
    next_run_utc = None
    if next_run:
        if next_run.tzinfo:
            next_run_utc = next_run.astimezone(ZoneInfo("UTC")).replace(tzinfo=None)
        else:
            next_run_utc = next_run
    d = automation.to_dict(include_relations=True, next_run_at=next_run_utc)
    d["scheduleLabel"] = format_schedule_label(automation)
    d["reportTypeLabel"] = REPORT_TYPES.get(automation.report_type, automation.report_type)
    if last_log:
        d["lastExecutionStatus"] = last_log.status
        d["lastExecutionTime"] = (
            last_log.execution_time.isoformat() + "Z" if last_log.execution_time else None
        )
        d["lastExecutionError"] = last_log.error_message or ""
    return d


def list_automations() -> list[dict]:
    rows = ReportAutomation.query.order_by(ReportAutomation.created_at.desc()).all()
    last_map = _last_execution_by_automation([r.id for r in rows])
    return [_serialize(r, last_log=last_map.get(r.id)) for r in rows]


def get_automation_stats() -> dict:
    now = datetime.utcnow()
    month_start = datetime(now.year, now.month, 1)
    week_ago = now - timedelta(days=7)
    two_weeks_ago = now - timedelta(days=14)

    total_automations = ReportAutomation.query.count()
    active_automations = ReportAutomation.query.filter_by(is_active=True).count()

    month_logs = ReportExecutionLog.query.filter(ReportExecutionLog.execution_time >= month_start).all()
    executions_this_month = len(month_logs)
    success_count = sum(1 for log in month_logs if log.status == "success")
    success_rate = round((success_count / executions_this_month) * 100, 1) if executions_this_month else 100.0

    active_last_week = ReportAutomation.query.filter(
        ReportAutomation.is_active == True,  # noqa: E712
        ReportAutomation.created_at >= week_ago,
    ).count()
    active_prior_week = ReportAutomation.query.filter(
        ReportAutomation.is_active == True,  # noqa: E712
        ReportAutomation.created_at >= two_weeks_ago,
        ReportAutomation.created_at < week_ago,
    ).count()
    active_delta = active_last_week - active_prior_week

    return {
        "successRate": success_rate,
        "executionsThisMonth": executions_this_month,
        "activeReports": active_automations,
        "totalReports": total_automations,
        "activeReportsDelta": active_delta,
    }


def get_automation(automation_id: str) -> dict:
    row = ReportAutomation.query.get(automation_id)
    if not row:
        raise ReportAutomationError("Report automation not found")
    return _serialize(row)


def create_automation(data: dict, created_by: str) -> dict:
    fields = _validate_payload(data)
    shift_ids = data.get("shiftIds") or []
    recipient_ids = data.get("recipientUserIds") or []

    automation = ReportAutomation(
        id=generate_id(),
        created_by=created_by,
        **fields,
    )
    db.session.add(automation)
    db.session.flush()
    _set_relations(automation, shift_ids, recipient_ids)
    db.session.commit()
    return _serialize(automation)


def update_automation(automation_id: str, data: dict) -> dict:
    automation = ReportAutomation.query.get(automation_id)
    if not automation:
        raise ReportAutomationError("Report automation not found")

    fields = _validate_payload(data, partial=True)
    for key, val in fields.items():
        setattr(automation, key, val)

    if "shiftIds" in data:
        _set_relations(
            automation,
            data.get("shiftIds") or [],
            data.get("recipientUserIds") or [r.user_id for r in automation.recipient_links],
        )
    elif "recipientUserIds" in data:
        _set_relations(
            automation,
            [s.shift_id for s in automation.shift_links],
            data.get("recipientUserIds") or [],
        )

    db.session.commit()
    db.session.refresh(automation)
    return _serialize(automation)


def delete_automation(automation_id: str) -> None:
    automation = ReportAutomation.query.get(automation_id)
    if not automation:
        raise ReportAutomationError("Report automation not found")
    db.session.delete(automation)
    db.session.commit()


def toggle_automation(automation_id: str, is_active: bool) -> dict:
    automation = ReportAutomation.query.get(automation_id)
    if not automation:
        raise ReportAutomationError("Report automation not found")
    automation.is_active = bool(is_active)
    db.session.commit()
    return _serialize(automation)


def _log_recipient_ids(log: ReportExecutionLog) -> list[str]:
    raw = log.recipient_user_ids or ""
    if raw:
        try:
            ids = json.loads(raw)
            if isinstance(ids, list) and ids:
                return [str(i) for i in ids]
        except (TypeError, json.JSONDecodeError):
            pass
    if log.automation:
        return [link.user_id for link in log.automation.recipient_links if link.user_id]
    return []


def _recipients_payload(user_ids: list[str]) -> list[dict]:
    if not user_ids:
        return []
    users = User.query.filter(User.id.in_(user_ids)).all()
    user_map = {u.id: u for u in users}
    hr_rows = HRInfo.query.filter(HRInfo.user_id.in_(user_ids)).all()
    pic_map = {
        h.user_id: str(h.profile_picture).strip()
        for h in hr_rows
        if h.profile_picture and str(h.profile_picture).strip()
    }
    out: list[dict] = []
    for uid in user_ids:
        user = user_map.get(uid)
        if not user:
            continue
        out.append(
            {
                "id": user.id,
                "name": user.name or "",
                "email": user.email or "",
                "profilePicture": pic_map.get(user.id),
            }
        )
    return out


def _serialize_logs(logs: list[ReportExecutionLog]) -> list[dict]:
    if not logs:
        return []
    id_lists = {log.id: _log_recipient_ids(log) for log in logs}
    all_ids = {uid for ids in id_lists.values() for uid in ids}
    payload_map = {item["id"]: item for item in _recipients_payload(list(all_ids))}
    return [
        log.to_dict(recipients=[payload_map[uid] for uid in id_lists[log.id] if uid in payload_map])
        for log in logs
    ]


def list_execution_logs(
    automation_id: str | None = None,
    *,
    limit: int = 100,
    offset: int = 0,
) -> dict:
    from sqlalchemy.orm import joinedload

    q = ReportExecutionLog.query.options(
        joinedload(ReportExecutionLog.automation).joinedload(ReportAutomation.recipient_links)
    ).order_by(ReportExecutionLog.execution_time.desc())
    if automation_id:
        q = q.filter_by(report_automation_id=automation_id)

    total = q.count()
    rows = q.offset(max(offset, 0)).limit(max(limit, 1)).all()
    items = _serialize_logs(rows)
    shown = offset + len(items)
    return {
        "items": items,
        "total": total,
        "hasMore": shown < total,
    }


def execute_automation(automation_id: str, *, manual: bool = False) -> dict:
    automation = ReportAutomation.query.get(automation_id)
    if not automation:
        raise ReportAutomationError("Report automation not found")

    log = create_log(automation, manual=manual)
    generated_at = datetime.utcnow()
    error_msg = ""
    recipient_user_ids = [link.user_id for link in automation.recipient_links if link.user_id]

    try:
        generator = ReportGeneratorFactory.get_generator(automation)
        file_bytes, filename, _, _, report_text, report_html = generator.generate(manual=manual)

        recipients: list[tuple[str, str]] = []
        seen_emails: set[str] = set()
        for link in automation.recipient_links:
            user = User.query.get(link.user_id)
            if not user or not user.email:
                continue
            email = user.email.strip().lower()
            if not email or email in seen_emails:
                continue
            seen_emails.add(email)
            recipients.append((user.email.strip(), user.name or user.email))

        sent, email_err = send_report_to_recipients(
            report_name=automation.report_name,
            recipients=recipients,
            report_text=report_text,
            report_html=report_html,
            generated_at=generated_at,
        )

        file_path = save_report_file(automation.id, log.id, file_bytes, filename)
        success = sent > 0
        error_msg = email_err or ("" if success else "Email delivery failed")

        finalize_log(
            log,
            success=success,
            recipient_count=sent,
            file_path=file_path,
            error_message=error_msg,
            recipient_user_ids=recipient_user_ids,
        )

        if automation.schedule_type == "one_time" and success:
            automation.is_active = False
            db.session.commit()

        if not success:
            raise ReportAutomationError(error_msg or "Report execution failed")

        recipients_payload = _recipients_payload(recipient_user_ids)
        return {
            "log": log.to_dict(recipients=recipients_payload),
            "recipientCount": sent,
            "filePath": file_path,
        }
    except ReportAutomationError:
        raise
    except Exception as e:
        error_msg = str(e)[:500]
        finalize_log(
            log,
            success=False,
            recipient_count=0,
            error_message=error_msg,
            recipient_user_ids=recipient_user_ids,
        )
        raise ReportAutomationError(error_msg) from e
