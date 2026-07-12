"""Request validation for PMS APIs."""
from __future__ import annotations

from datetime import date, datetime

from app.pms_models import PROJECT_PRIORITIES, PROJECT_STATUSES, SPRINT_STATUSES, TASK_PRIORITIES
from app.services import pms_status_service


class PmsValidationError(ValueError):
    pass


def _parse_date(value, field: str) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, date):
        return value
    s = str(value).strip()
    if not s:
        return None
    try:
        if "T" in s:
            return datetime.fromisoformat(s.replace("Z", "+00:00")).date()
        return date.fromisoformat(s[:10])
    except ValueError as e:
        raise PmsValidationError(f"Invalid {field}") from e


def _enum(value: str, allowed: tuple[str, ...], field: str) -> str:
    v = (value or "").strip().lower().replace(" ", "_").replace("-", "_")
    aliases = {
        "to_do": "to_do",
        "todo": "to_do",
        "not_started": "not_started",
        "in_progress": "in_progress",
        "on_hold": "on_hold",
    }
    v = aliases.get(v, v)
    if v not in allowed:
        raise PmsValidationError(f"Invalid {field}; allowed: {', '.join(allowed)}")
    return v


def validate_project_create(data: dict) -> dict:
    title = (data.get("title") or "").strip()
    if not title:
        raise PmsValidationError("title is required")
    status_raw = (data.get("status") or "").strip()
    if not status_raw:
        raise PmsValidationError("status is required")
    status = _enum(status_raw, PROJECT_STATUSES, "status")
    priority = _enum(data.get("priority") or "medium", PROJECT_PRIORITIES, "priority")
    progress = data.get("progress")
    if progress is not None:
        progress = float(progress)
        if progress < 0 or progress > 100:
            raise PmsValidationError("progress must be between 0 and 100")
    else:
        progress = 0
    company_id = (data.get("companyId") or "").strip()
    if not company_id:
        raise PmsValidationError("companyId is required")
    project_type_id = (data.get("projectTypeId") or "").strip()
    if not project_type_id:
        raise PmsValidationError("projectTypeId is required")
    return {
        "title": title[:255],
        "description": (data.get("description") or "").strip(),
        "companyId": company_id,
        "projectTypeId": project_type_id,
        "startDate": _parse_date(data.get("startDate"), "startDate"),
        "endDate": _parse_date(data.get("endDate"), "endDate"),
        "status": status,
        "priority": priority,
        "progress": progress,
    }


def validate_project_update(data: dict) -> dict:
    out = {}
    if "title" in data:
        title = (data.get("title") or "").strip()
        if not title:
            raise PmsValidationError("title cannot be empty")
        out["title"] = title[:255]
    if "description" in data:
        out["description"] = (data.get("description") or "").strip()
    if "companyId" in data:
        company_id = (data.get("companyId") or "").strip()
        if not company_id:
            raise PmsValidationError("companyId is required")
        out["companyId"] = company_id
    if "startDate" in data:
        out["startDate"] = _parse_date(data.get("startDate"), "startDate")
    if "endDate" in data:
        out["endDate"] = _parse_date(data.get("endDate"), "endDate")
    if "status" in data:
        status_raw = (data.get("status") or "").strip()
        if not status_raw:
            raise PmsValidationError("status is required")
        out["status"] = _enum(status_raw, PROJECT_STATUSES, "status")
    if "priority" in data:
        out["priority"] = _enum(data.get("priority"), PROJECT_PRIORITIES, "priority")
    if "progress" in data:
        progress = float(data.get("progress"))
        if progress < 0 or progress > 100:
            raise PmsValidationError("progress must be between 0 and 100")
        out["progress"] = progress
    if "projectTypeId" in data:
        project_type_id = (data.get("projectTypeId") or "").strip()
        if not project_type_id:
            raise PmsValidationError("projectTypeId is required")
        out["projectTypeId"] = project_type_id
    return out


def _parse_assignee_ids(data: dict) -> list[str]:
    """assigneeIds array takes precedence; assignedTo adds zero or one id."""
    if "assigneeIds" in data and data.get("assigneeIds") is not None:
        raw = data.get("assigneeIds")
        if not isinstance(raw, list):
            raise PmsValidationError("assigneeIds must be an array")
        seen: set[str] = set()
        out: list[str] = []
        for item in raw:
            uid = str(item).strip() if item is not None else ""
            if uid and uid not in seen:
                seen.add(uid)
                out.append(uid)
        return out
    single = (data.get("assignedTo") or "").strip()
    return [single] if single else []


def _parse_task_end_date(data: dict, *, required_key: bool) -> date | None:
    """Parse task end date from endDate or legacy dueDate."""
    if required_key or "endDate" in data:
        return _parse_date(data.get("endDate"), "endDate")
    if "dueDate" in data:
        return _parse_date(data.get("dueDate"), "dueDate")
    return None


def _normalize_task_dates(start: date | None, end: date | None) -> tuple[date | None, date | None]:
    if start and not end:
        end = start
    elif end and not start:
        start = end
    if start and end and end < start:
        raise PmsValidationError("endDate must be on or after startDate")
    return start, end


def validate_task_create(data: dict) -> dict:
    title = (data.get("title") or "").strip()
    if not title:
        raise PmsValidationError("title is required")
    project_id = (data.get("projectId") or "").strip()
    if not project_id:
        raise PmsValidationError("projectId is required")
    return {
        "projectId": project_id,
        "parentTaskId": (data.get("parentTaskId") or "").strip() or None,
        "title": title[:255],
        "description": (data.get("description") or "").strip(),
        "assigneeIds": _parse_assignee_ids(data),
        "status": pms_status_service.validate_pms_task_status(data.get("status") or "to_do"),
        "priority": _enum(data.get("priority") or "medium", TASK_PRIORITIES, "priority"),
        "startDate": _parse_date(data.get("startDate"), "startDate"),
        "endDate": _parse_task_end_date(data, required_key=True),
        "estimatedHours": _optional_float(data.get("estimatedHours"), "estimatedHours"),
        "actualHours": _optional_float(data.get("actualHours"), "actualHours"),
        "sprintId": (data.get("sprintId") or "").strip() or None,
    }
    start, end = _normalize_task_dates(out["startDate"], out["endDate"])
    out["startDate"] = start
    out["endDate"] = end
    return out


def validate_task_update(data: dict) -> dict:
    out = {}
    if "title" in data:
        title = (data.get("title") or "").strip()
        if not title:
            raise PmsValidationError("title cannot be empty")
        out["title"] = title[:255]
    if "description" in data:
        out["description"] = (data.get("description") or "").strip()
    if "assigneeIds" in data or "assignedTo" in data:
        out["assigneeIds"] = _parse_assignee_ids(data)
    if "status" in data:
        out["status"] = pms_status_service.validate_pms_task_status(data.get("status"))
    if "priority" in data:
        out["priority"] = _enum(data.get("priority"), TASK_PRIORITIES, "priority")
    if "startDate" in data:
        out["startDate"] = _parse_date(data.get("startDate"), "startDate")
    if "endDate" in data or "dueDate" in data:
        out["endDate"] = _parse_task_end_date(data, required_key=False)
    if "estimatedHours" in data:
        out["estimatedHours"] = _optional_float(data.get("estimatedHours"), "estimatedHours")
    if "actualHours" in data:
        out["actualHours"] = _optional_float(data.get("actualHours"), "actualHours")
    if "parentTaskId" in data:
        out["parentTaskId"] = (data.get("parentTaskId") or "").strip() or None
    if "sprintId" in data:
        raw = data.get("sprintId")
        if raw is None or raw == "":
            out["sprintId"] = None
        else:
            out["sprintId"] = str(raw).strip()
    return out


def validate_sprint_create(data: dict) -> dict:
    name = (data.get("name") or "").strip()
    if not name:
        raise PmsValidationError("name is required")
    start = _parse_date(data.get("startDate"), "startDate")
    end = _parse_date(data.get("endDate"), "endDate")
    if start and end and end < start:
        raise PmsValidationError("endDate must be on or after startDate")
    return {
        "name": name[:255],
        "goal": (data.get("goal") or "").strip(),
        "startDate": start,
        "endDate": end,
        "status": _enum(data.get("status") or "planned", SPRINT_STATUSES, "status"),
    }


def validate_sprint_update(data: dict) -> dict:
    out = {}
    if "name" in data:
        name = (data.get("name") or "").strip()
        if not name:
            raise PmsValidationError("name cannot be empty")
        out["name"] = name[:255]
    if "goal" in data:
        out["goal"] = (data.get("goal") or "").strip()
    if "startDate" in data:
        out["startDate"] = _parse_date(data.get("startDate"), "startDate")
    if "endDate" in data:
        out["endDate"] = _parse_date(data.get("endDate"), "endDate")
    if "status" in data:
        out["status"] = _enum(data.get("status"), SPRINT_STATUSES, "status")
    if "sortOrder" in data:
        try:
            out["sortOrder"] = int(data.get("sortOrder"))
        except (TypeError, ValueError) as e:
            raise PmsValidationError("Invalid sortOrder") from e
    start = out.get("startDate")
    end = out.get("endDate")
    if start and end and end < start:
        raise PmsValidationError("endDate must be on or after startDate")
    return out


def validate_status_patch(data: dict) -> str:
    return pms_status_service.validate_pms_task_status(data.get("status") or "")


def validate_comment(data: dict) -> str:
    text = (data.get("comment") or "").strip()
    if not text:
        raise PmsValidationError("comment is required")
    return text


def _optional_float(value, field: str) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError) as e:
        raise PmsValidationError(f"Invalid {field}") from e
