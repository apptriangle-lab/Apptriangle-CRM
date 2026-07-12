"""PMS task statuses from Settings → Status (status_config group pms_task_status)."""
from __future__ import annotations

from app.models import StatusConfig

GROUP_PMS_TASK_STATUS = "pms_task_status"

DEFAULT_PMS_TASK_STATUSES = ("to_do", "in_progress", "completed", "on_hold", "cancelled")


def get_pms_task_status_values() -> tuple[str, ...]:
    rows = (
        StatusConfig.query.filter_by(group=GROUP_PMS_TASK_STATUS)
        .order_by(StatusConfig.sort_order, StatusConfig.value)
        .all()
    )
    if not rows:
        return DEFAULT_PMS_TASK_STATUSES
    return tuple(r.value for r in rows if r.value)


def validate_pms_task_status(value: str, field: str = "status") -> str:
    from app.schemas.pms_validators import PmsValidationError

    allowed = get_pms_task_status_values()
    v = (value or "").strip().lower().replace(" ", "_")
    if v not in allowed:
        raise PmsValidationError(f"Invalid {field}")
    return v


def is_pms_task_completed_status(status: str) -> bool:
    """Treat status value `completed` as done; extend if more terminal statuses are added."""
    return (status or "").strip().lower() == "completed"


def is_pms_task_cancelled_status(status: str) -> bool:
    """Cancelled tasks are excluded from project progress denominator."""
    v = (status or "").strip().lower().replace(" ", "_")
    return v in ("cancelled", "canceled")
