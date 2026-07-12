"""PMS project visibility and access guards — enforced at query level."""
from __future__ import annotations

from sqlalchemy import and_, or_

from app import db
from app.models import User
from app.pms_models import PmsProject, PmsProjectMember, PmsTask, PmsTaskAssignee
from app.pms_permissions import is_pms_admin


def invited_project_ids(user_id: str) -> list[str]:
    rows = PmsProjectMember.query.filter_by(user_id=user_id).all()
    return [r.project_id for r in rows]


def base_projects_query(user: User | None, include_deleted: bool = False):
    q = PmsProject.query
    if not include_deleted:
        q = q.filter(PmsProject.deleted_at.is_(None))
    if is_pms_admin(user):
        return q
    if not user:
        return q.filter(False)
    ids = invited_project_ids(user.id)
    if not ids:
        return q.filter(False)
    return q.filter(PmsProject.id.in_(ids))


def user_can_access_project(user: User | None, project: PmsProject | None) -> bool:
    if not project or project.deleted_at is not None:
        return False
    if not user or not getattr(user, "is_active", True):
        return False
    if is_pms_admin(user):
        return True
    return (
        PmsProjectMember.query.filter_by(project_id=project.id, user_id=user.id).first()
        is not None
    )


def get_project_for_user(user: User | None, project_id: str) -> PmsProject | None:
    project = PmsProject.query.filter_by(id=project_id).first()
    if not user_can_access_project(user, project):
        return None
    return project


def base_tasks_query(user: User | None, include_deleted: bool = False):
    q = PmsTask.query.join(PmsProject, PmsTask.project_id == PmsProject.id)
    if not include_deleted:
        q = q.filter(PmsTask.deleted_at.is_(None), PmsProject.deleted_at.is_(None))
    if is_pms_admin(user):
        return q
    if not user:
        return q.filter(False)
    ids = invited_project_ids(user.id)
    if not ids:
        return q.filter(False)
    return q.filter(PmsTask.project_id.in_(ids))


def get_task_for_user(user: User | None, task_id: str) -> PmsTask | None:
    task = PmsTask.query.filter_by(id=task_id, deleted_at=None).first()
    if not task:
        return None
    project = PmsProject.query.get(task.project_id)
    if not user_can_access_project(user, project):
        return None
    return task


def filter_assignee_must_be_member(project_id: str, assignee_id: str | None) -> None:
    if not assignee_id:
        return
    if not PmsProjectMember.query.filter_by(project_id=project_id, user_id=assignee_id).first():
        raise ValueError("Assigned user must be a member of the project")


def filter_assignees_must_be_members(project_id: str, assignee_ids: list[str]) -> None:
    for assignee_id in assignee_ids:
        filter_assignee_must_be_member(project_id, assignee_id)


def filter_tasks_assigned_to_user(query, user_id: str):
    """Tasks where user is primary assignee or in pms_task_assignees."""
    assignee_task_ids = db.session.query(PmsTaskAssignee.task_id).filter(
        PmsTaskAssignee.user_id == user_id
    )
    return query.filter(or_(PmsTask.assigned_to == user_id, PmsTask.id.in_(assignee_task_ids)))
