"""Send email when a task is assigned or reassigned."""

from __future__ import annotations

from datetime import datetime

from flask import current_app

from app.email_templates.task_assigned import build_task_assigned_email
from app.email_utils import send_transactional_email
from app.models import Company, Task, User


def _display_name(user: User | None, fallback: str = "Someone") -> str:
    if not user:
        return fallback
    name = (user.name or "").strip()
    if name:
        return name
    return (user.email or "").strip() or fallback


def _format_due(dt: datetime | None) -> str:
    if not dt:
        return "—"
    return dt.strftime("%d %b %Y, %H:%M UTC")


def _task_detail_url(task_id: str) -> str:
    base = (current_app.config.get("FRONTEND_URL") or "http://localhost:8080").rstrip("/")
    return f"{base}/tasks/{task_id}"


def notify_task_assignee_email(task: Task, *, event: str) -> None:
    """
    Notify the assignee by email. Call only after the session is committed.

    event: 'created' (POST with assignee), 'first_assign' (PATCH from unassigned),
    or 'reassigned' (PATCH changed assignee from one user to another).
    """
    assignee_id = task.assign_to_user_id
    if not assignee_id:
        return

    assignee = User.query.get(assignee_id)
    if not assignee:
        return

    to_email = (assignee.email or "").strip()
    if not to_email:
        current_app.logger.debug(
            "Task email skipped: assignee %s has no email (task %s)",
            assignee_id,
            task.id,
        )
        return

    assigner = User.query.get(task.assign_by_user_id) if task.assign_by_user_id else None
    assigner_name = _display_name(assigner, "Someone")

    company = Company.query.get(task.company_id)
    company_name = (company.name or "").strip() if company else ""

    is_self_assigned = bool(
        task.assign_by_user_id
        and task.assign_to_user_id
        and task.assign_by_user_id == task.assign_to_user_id
    )
    is_reassignment = event == "reassigned"

    assignee_name = _display_name(assignee, "there")

    subject, text_body, html_body = build_task_assigned_email(
        assignee_display_name=assignee_name,
        assigner_display_name=assigner_name,
        task_title=task.title or "",
        task_note_plain=task.note,
        company_name=company_name,
        due_label=_format_due(task.due_datetime),
        tasks_deep_link=_task_detail_url(task.id),
        is_reassignment=is_reassignment,
        is_self_assigned=is_self_assigned,
    )

    send_transactional_email(to_email, assignee_name, subject, text_body, html_body)
