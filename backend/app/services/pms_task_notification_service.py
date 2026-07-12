"""In-app notifications for PMS task assignment events."""
from __future__ import annotations

import re

from app.models import User
from app.notification_service import notification_service
from app.pms_models import PmsProjectMember, PmsTask, PmsTaskAssignee

MENTION_TOKEN_RE = re.compile(r"@\[([^\]]+)\]\(([^)]+)\)")


def assignee_ids_for_task(task_id: str) -> list[str]:
    rows = PmsTaskAssignee.query.filter_by(task_id=task_id).all()
    return [row.user_id for row in rows]


def notify_new_pms_task_assignees(
    *,
    task: PmsTask,
    assigner: User,
    new_assignee_ids: list[str],
    project_title: str | None = None,
) -> None:
    """
    Notify users newly assigned to a PMS task.
    Skips self-assignment (assigner assigns only themselves).
    """
    if not new_assignee_ids:
        return

    title = (task.title or "Untitled task").strip()
    project_label = (project_title or "a project").strip() or "a project"
    assigner_name = (assigner.name or "Someone").strip() or "Someone"
    assigner_id = assigner.id

    seen: set[str] = set()
    for user_id in new_assignee_ids:
        if not user_id or user_id in seen:
            continue
        seen.add(user_id)
        if user_id == assigner_id:
            continue
        notification_service.create_notification(
            user_id=user_id,
            title="PMS · Task assigned",
            message=f'{assigner_name} assigned you to "{title}" in {project_label}.',
            n_type="info",
            category="pms",
        )


def parse_comment_mention_user_ids(comment: str) -> list[str]:
    """Return unique mentioned user IDs in comment order."""
    if not comment:
        return []

    seen: set[str] = set()
    ordered: list[str] = []
    for _name, user_id in MENTION_TOKEN_RE.findall(comment):
        uid = (user_id or "").strip()
        if not uid or uid in seen:
            continue
        seen.add(uid)
        ordered.append(uid)
    return ordered


def project_member_user_ids(project_id: str) -> set[str]:
    rows = PmsProjectMember.query.filter_by(project_id=project_id).all()
    return {row.user_id for row in rows if row.user_id}


def notify_pms_comment_mentions(
    *,
    task: PmsTask,
    author: User,
    comment: str,
    project_title: str | None = None,
) -> None:
    """Notify project members mentioned in a PMS task comment."""
    mentioned_ids = parse_comment_mention_user_ids(comment)
    if not mentioned_ids:
        return

    allowed_member_ids = project_member_user_ids(task.project_id)
    task_title = (task.title or "Untitled task").strip()
    project_label = (project_title or "a project").strip() or "a project"
    author_name = (author.name or "Someone").strip() or "Someone"
    author_id = author.id

    for user_id in mentioned_ids:
        if user_id not in allowed_member_ids:
            continue
        if user_id == author_id:
            continue
        notification_service.create_notification(
            user_id=user_id,
            title="PMS · Mentioned in comment",
            message=(
                f'{author_name} mentioned you in a comment on "{task_title}" in {project_label}.'
            ),
            n_type="info",
            category="pms",
        )
