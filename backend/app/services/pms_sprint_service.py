"""PMS sprint CRUD and task assignment."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import func

from app import db
from app.models import User
from app.pms_models import PmsSprint, PmsTask
from app.pms_permissions import user_has_permission
from app.schemas.pms_validators import (
    PmsValidationError,
    validate_sprint_create,
    validate_sprint_update,
)
from app.services import pms_access_service
from app.services.pms_task_sprint_rules import (
    assert_parent_may_set_sprint,
    cascade_sprint_to_descendants,
)


def _task_counts_by_sprint(project_id: str) -> dict[str, int]:
    rows = (
        db.session.query(PmsTask.sprint_id, func.count(PmsTask.id))
        .filter(
            PmsTask.project_id == project_id,
            PmsTask.deleted_at.is_(None),
            PmsTask.sprint_id.isnot(None),
        )
        .group_by(PmsTask.sprint_id)
        .all()
    )
    return {sid: int(cnt) for sid, cnt in rows if sid}


def _get_sprint_for_user(user: User, sprint_id: str) -> PmsSprint | None:
    sprint = PmsSprint.query.filter_by(id=sprint_id, deleted_at=None).first()
    if not sprint:
        return None
    project = pms_access_service.get_project_for_user(user, sprint.project_id)
    return sprint if project else None


def list_sprints(user: User, project_id: str, *, status: str = "") -> dict:
    project = pms_access_service.get_project_for_user(user, project_id)
    if not project:
        raise LookupError("Project not found")

    q = PmsSprint.query.filter_by(project_id=project_id, deleted_at=None)
    if status:
        q = q.filter(PmsSprint.status == status.strip().lower().replace(" ", "_"))

    rows = q.order_by(PmsSprint.sort_order.asc(), PmsSprint.start_date.asc(), PmsSprint.created_at.desc()).all()
    counts = _task_counts_by_sprint(project_id)
    items = [s.to_dict(task_count=counts.get(s.id, 0)) for s in rows]
    return {"items": items, "total": len(items)}


def get_sprint_detail(user: User, project_id: str, sprint_id: str) -> dict:
    sprint = _get_sprint_for_user(user, sprint_id)
    if not sprint or sprint.project_id != project_id:
        raise LookupError("Sprint not found")
    counts = _task_counts_by_sprint(project_id)
    return sprint.to_dict(task_count=counts.get(sprint.id, 0))


def create_sprint(user: User, project_id: str, data: dict) -> dict:
    if not user_has_permission(user, "pms.task.create"):
        raise PermissionError("Not allowed to create sprints")
    project = pms_access_service.get_project_for_user(user, project_id)
    if not project:
        raise LookupError("Project not found")

    payload = validate_sprint_create(data)
    max_order = (
        db.session.query(func.max(PmsSprint.sort_order))
        .filter_by(project_id=project_id, deleted_at=None)
        .scalar()
    ) or 0

    try:
        sprint = PmsSprint(
            project_id=project_id,
            name=payload["name"],
            goal=payload["goal"],
            start_date=payload["startDate"],
            end_date=payload["endDate"],
            status=payload["status"],
            sort_order=max_order + 1,
            created_by=user.id,
            updated_by=user.id,
        )
        db.session.add(sprint)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    return sprint.to_dict(task_count=0)


def update_sprint(user: User, project_id: str, sprint_id: str, data: dict) -> dict:
    if not user_has_permission(user, "pms.task.update"):
        raise PermissionError("Not allowed to update sprints")
    sprint = _get_sprint_for_user(user, sprint_id)
    if not sprint or sprint.project_id != project_id:
        raise LookupError("Sprint not found")

    payload = validate_sprint_update(data)
    if not payload:
        raise PmsValidationError("No fields to update")

    try:
        if "name" in payload:
            sprint.name = payload["name"]
        if "goal" in payload:
            sprint.goal = payload["goal"]
        if "startDate" in payload:
            sprint.start_date = payload["startDate"]
        if "endDate" in payload:
            sprint.end_date = payload["endDate"]
        if "status" in payload:
            sprint.status = payload["status"]
        if "sortOrder" in payload:
            sprint.sort_order = payload["sortOrder"]
        sprint.updated_by = user.id
        sprint.updated_at = datetime.utcnow()
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    counts = _task_counts_by_sprint(project_id)
    return sprint.to_dict(task_count=counts.get(sprint.id, 0))


def delete_sprint(user: User, project_id: str, sprint_id: str) -> None:
    if not user_has_permission(user, "pms.task.update"):
        raise PermissionError("Not allowed to delete sprints")
    sprint = _get_sprint_for_user(user, sprint_id)
    if not sprint or sprint.project_id != project_id:
        raise LookupError("Sprint not found")

    try:
        PmsTask.query.filter_by(sprint_id=sprint.id, deleted_at=None).update(
            {"sprint_id": None, "updated_by": user.id, "updated_at": datetime.utcnow()},
            synchronize_session=False,
        )
        sprint.deleted_at = datetime.utcnow()
        sprint.updated_by = user.id
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise


def assign_tasks_to_sprint(user: User, project_id: str, sprint_id: str, task_ids: list[str]) -> dict:
    if not user_has_permission(user, "pms.task.update"):
        raise PermissionError("Not allowed to assign tasks to sprint")
    sprint = _get_sprint_for_user(user, sprint_id)
    if not sprint or sprint.project_id != project_id:
        raise LookupError("Sprint not found")

    updated = 0
    for tid in task_ids:
        task = pms_access_service.get_task_for_user(user, tid)
        if not task or task.project_id != project_id:
            continue
        try:
            assert_parent_may_set_sprint(task)
        except PmsValidationError as exc:
            raise PmsValidationError(f"{exc} (task: {task.title})") from exc
        task.sprint_id = sprint.id
        task.updated_by = user.id
        task.updated_at = datetime.utcnow()
        cascade_sprint_to_descendants(task.id, sprint.id, user.id)
        updated += 1

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    counts = _task_counts_by_sprint(project_id)
    return {"updated": updated, "sprint": sprint.to_dict(task_count=counts.get(sprint.id, 0))}
