"""Sprint assignment rules for parent tasks and subtasks."""
from __future__ import annotations

from datetime import datetime

from app import db
from app.pms_models import PmsTask
from app.schemas.pms_validators import PmsValidationError

SUBTASK_SPRINT_ERROR = "Subtasks inherit sprint from their parent task and cannot be moved independently"


def collect_descendant_task_ids(parent_id: str) -> list[str]:
    """Return all nested subtask ids under a parent (depth-first)."""
    ids: list[str] = []
    children = PmsTask.query.filter_by(parent_task_id=parent_id, deleted_at=None).all()
    for child in children:
        ids.append(child.id)
        ids.extend(collect_descendant_task_ids(child.id))
    return ids


def cascade_sprint_to_descendants(
    parent_id: str,
    sprint_id: str | None,
    user_id: str,
) -> int:
    """Sync sprint_id on every descendant when a parent task sprint changes."""
    descendant_ids = collect_descendant_task_ids(parent_id)
    if not descendant_ids:
        return 0
    now = datetime.utcnow()
    return (
        PmsTask.query.filter(
            PmsTask.id.in_(descendant_ids),
            PmsTask.deleted_at.is_(None),
        ).update(
            {
                PmsTask.sprint_id: sprint_id,
                PmsTask.updated_by: user_id,
                PmsTask.updated_at: now,
            },
            synchronize_session=False,
        )
    )


def assert_parent_may_set_sprint(task: PmsTask) -> None:
    if task.parent_task_id:
        raise PmsValidationError(SUBTASK_SPRINT_ERROR)


def resolve_sprint_id_for_create(
    *,
    parent_task: PmsTask | None,
    requested_sprint_id: str | None,
) -> str | None:
    """Subtasks always inherit the parent sprint; parents use the requested value."""
    if not parent_task:
        return requested_sprint_id
    if requested_sprint_id is not None and requested_sprint_id != parent_task.sprint_id:
        raise PmsValidationError(SUBTASK_SPRINT_ERROR)
    return parent_task.sprint_id
