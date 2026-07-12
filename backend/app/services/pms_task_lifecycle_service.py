"""PMS task soft-delete, restore, permanent delete, and audit logging."""
from __future__ import annotations

import json
from datetime import datetime

from app import db
from app.models import User
from app.pms_models import PmsProject, PmsTask, PmsTaskActivityLog
from app.pms_permissions import is_pms_admin, user_has_permission
from app.services import pms_access_service


def _log_activity(
    *,
    task: PmsTask,
    action_type: str,
    actor_user_id: str,
    affected_task_ids: list[str],
) -> None:
    row = PmsTaskActivityLog(
        task_id=task.id,
        project_id=task.project_id,
        action_type=action_type,
        actor_user_id=actor_user_id,
        details=json.dumps({"affectedTaskIds": affected_task_ids}),
    )
    db.session.add(row)


def _collect_active_descendant_ids(root_id: str) -> list[str]:
    """Active (non-deleted) descendants for cascading soft-delete."""
    collected: list[str] = []
    queue = [root_id]
    seen: set[str] = set()
    while queue:
        parent_id = queue.pop(0)
        if parent_id in seen:
            continue
        seen.add(parent_id)
        children = (
            PmsTask.query.filter_by(parent_task_id=parent_id)
            .filter(PmsTask.deleted_at.is_(None))
            .all()
        )
        for child in children:
            collected.append(child.id)
            queue.append(child.id)
    return collected


def _collect_deleted_ancestor_ids(task: PmsTask) -> list[str]:
    """Deleted ancestors up to project root (restore keeps hierarchy intact)."""
    collected: list[str] = []
    current = task
    while current.parent_task_id:
        parent = PmsTask.query.get(current.parent_task_id)
        if not parent:
            break
        if parent.deleted_at is not None:
            collected.append(parent.id)
        current = parent
    return collected


def _collect_deleted_descendant_ids(root_id: str) -> list[str]:
    """Deleted descendants for cascading restore."""
    collected: list[str] = []
    queue = [root_id]
    seen: set[str] = set()
    while queue:
        parent_id = queue.pop(0)
        if parent_id in seen:
            continue
        seen.add(parent_id)
        children = (
            PmsTask.query.filter_by(parent_task_id=parent_id)
            .filter(PmsTask.deleted_at.isnot(None))
            .all()
        )
        for child in children:
            collected.append(child.id)
            queue.append(child.id)
    return collected


def _deleted_subtree_postorder(root_id: str) -> list[str]:
    """Deleted subtree ids, children before parents (safe for hard delete)."""
    ordered: list[str] = []

    def walk(task_id: str) -> None:
        children = PmsTask.query.filter_by(parent_task_id=task_id).filter(
            PmsTask.deleted_at.isnot(None)
        ).all()
        for child in children:
            walk(child.id)
        ordered.append(task_id)

    walk(root_id)
    return ordered


def get_deleted_task_for_user(user: User, task_id: str) -> PmsTask | None:
    task = PmsTask.query.filter_by(id=task_id).filter(PmsTask.deleted_at.isnot(None)).first()
    if not task:
        return None
    project = PmsProject.query.get(task.project_id)
    if not pms_access_service.user_can_access_project(user, project):
        return None
    return task


def soft_delete_task(user: User, task_id: str) -> dict:
    if not user_has_permission(user, "pms.task.delete"):
        raise PermissionError("Not allowed to delete tasks")

    task = pms_access_service.get_task_for_user(user, task_id)
    if not task:
        raise LookupError("Task not found")

    descendant_ids = _collect_active_descendant_ids(task.id)
    affected_ids = [task.id, *descendant_ids]
    now = datetime.utcnow()

    try:
        for tid in affected_ids:
            row = PmsTask.query.get(tid)
            if row and row.deleted_at is None:
                row.deleted_at = now
                row.updated_by = user.id
        _log_activity(
            task=task,
            action_type="deleted",
            actor_user_id=user.id,
            affected_task_ids=affected_ids,
        )
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    return {"ok": True, "deletedTaskIds": affected_ids, "count": len(affected_ids)}


def list_deleted_tasks(user: User, project_id: str) -> dict:
    if not is_pms_admin(user):
        raise PermissionError("Not allowed to view deleted tasks")

    project = pms_access_service.get_project_for_user(user, project_id)
    if not project:
        raise LookupError("Project not found")

    rows = (
        PmsTask.query.filter_by(project_id=project_id)
        .filter(PmsTask.deleted_at.isnot(None))
        .order_by(PmsTask.deleted_at.desc())
        .all()
    )

    parent_titles: dict[str, str] = {}
    for row in rows:
        if row.parent_task_id and row.parent_task_id not in parent_titles:
            parent = PmsTask.query.get(row.parent_task_id)
            parent_titles[row.parent_task_id] = parent.title if parent else ""

    items = []
    for row in rows:
        d = row.to_dict(project_title=project.title)
        d["parentTitle"] = parent_titles.get(row.parent_task_id or "", "") if row.parent_task_id else None
        items.append(d)

    return {"items": items, "total": len(items)}


def restore_task(user: User, task_id: str) -> dict:
    if not is_pms_admin(user):
        raise PermissionError("Not allowed to restore tasks")

    task = get_deleted_task_for_user(user, task_id)
    if not task:
        raise LookupError("Deleted task not found")

    descendant_ids = _collect_deleted_descendant_ids(task.id)
    ancestor_ids = _collect_deleted_ancestor_ids(task)
    affected_ids = list(dict.fromkeys([*ancestor_ids, task.id, *descendant_ids]))

    try:
        for tid in affected_ids:
            row = PmsTask.query.get(tid)
            if row and row.deleted_at is not None:
                row.deleted_at = None
                row.updated_by = user.id
        _log_activity(
            task=task,
            action_type="restored",
            actor_user_id=user.id,
            affected_task_ids=affected_ids,
        )
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    return {"ok": True, "restoredTaskIds": affected_ids, "count": len(affected_ids)}


def permanent_delete_task(user: User, task_id: str) -> dict:
    if not is_pms_admin(user):
        raise PermissionError("Not allowed to permanently delete tasks")

    task = get_deleted_task_for_user(user, task_id)
    if not task:
        raise LookupError("Deleted task not found")

    ordered_ids = _deleted_subtree_postorder(task.id)
    project_id = task.project_id
    root_id = task.id

    try:
        _log_activity(
            task=task,
            action_type="permanently_deleted",
            actor_user_id=user.id,
            affected_task_ids=ordered_ids,
        )
        for tid in ordered_ids:
            row = PmsTask.query.get(tid)
            if row and row.deleted_at is not None:
                db.session.delete(row)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    return {"ok": True, "deletedTaskIds": ordered_ids, "count": len(ordered_ids), "projectId": project_id, "rootTaskId": root_id}
