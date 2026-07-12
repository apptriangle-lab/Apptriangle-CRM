"""PMS resource activity — user workload across projects in a date range."""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta

from app import db
from app.models import Company, User
from app.pms_models import PmsProject, PmsProjectMember, PmsSprint, PmsTask, PmsTaskAssignee
from app.schemas.pms_validators import PmsValidationError
from app.services import pms_access_service
from app.services.pms_status_service import is_pms_task_completed_status
from app.services.pms_task_service import _project_title, _serialize_task


def _validate_date_range(date_from: date, date_to: date) -> None:
    if not date_from or not date_to:
        raise PmsValidationError("from and to dates are required")
    if date_from > date_to:
        raise PmsValidationError("from must be on or before to")


def _task_span_days(task: PmsTask, date_from: date, date_to: date) -> list[date]:
    start = task.start_date
    due = task.end_date
    if start and due:
        span_start = min(start, due)
        span_end = max(start, due)
    elif due:
        span_start = span_end = due
    elif start:
        span_start = span_end = start
    else:
        return []

    clip_start = max(span_start, date_from)
    clip_end = min(span_end, date_to)
    if clip_start > clip_end:
        return []

    days: list[date] = []
    cursor = clip_start
    while cursor <= clip_end:
        days.append(cursor)
        cursor += timedelta(days=1)
    return days


def _task_overlaps_range(task: PmsTask, date_from: date, date_to: date) -> bool:
    if not task.start_date and not task.end_date:
        return True
    start = task.start_date
    due = task.end_date
    if start and due:
        return start <= date_to and due >= date_from
    if due:
        return date_from <= due <= date_to
    return date_from <= start <= date_to


def _sprint_labels(sprint_ids: set[str]) -> dict[str, str]:
    if not sprint_ids:
        return {}
    rows = PmsSprint.query.filter(PmsSprint.id.in_(sprint_ids), PmsSprint.deleted_at.is_(None)).all()
    return {s.id: s.name for s in rows}


def _enrich_task(task: PmsTask, sprint_names: dict[str, str]) -> dict:
    data = _serialize_task(task, project_title=_project_title(task.project_id))
    data["sprintName"] = sprint_names.get(task.sprint_id) if task.sprint_id else None
    return data


def _tasks_by_date_for_user(
    task_pairs: list[tuple[PmsTask, dict]],
    date_from: date,
    date_to: date,
) -> dict[str, list[dict]]:
    tasks_by_date: dict[str, list[dict]] = defaultdict(list)
    seen_per_date: dict[str, set[str]] = defaultdict(set)
    unscheduled: list[dict] = []

    for task_obj, task_data in task_pairs:
        span_days = _task_span_days(task_obj, date_from, date_to)
        if not span_days:
            unscheduled.append(task_data)
            continue
        for day in span_days:
            key = day.isoformat()
            if task_data["id"] in seen_per_date[key]:
                continue
            seen_per_date[key].add(task_data["id"])
            tasks_by_date[key].append(task_data)

    tasks_by_date_out = {k: tasks_by_date[k] for k in sorted(tasks_by_date.keys())}
    if unscheduled:
        tasks_by_date_out["unscheduled"] = unscheduled
    return tasks_by_date_out


def _parse_task_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        if "T" in value:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
        return date.fromisoformat(value[:10])
    except ValueError:
        return None


def _task_date_span(task: PmsTask) -> tuple[date | None, date | None]:
    start = task.start_date
    end = task.end_date
    if start and end:
        return (min(start, end), max(start, end))
    if end:
        return (end, end)
    if start:
        return (start, start)
    return (None, None)


def _is_resource_task_completed(task_data: dict) -> bool:
    status = (task_data.get("status") or "").strip().lower()
    if is_pms_task_completed_status(status) or "done" in status:
        return True
    return bool(task_data.get("completedAt"))


def _task_day_visual_status(task_data: dict, day: date, today: date) -> str | None:
    start, end = _task_date_span_from_data(task_data)
    if not start or not end:
        return None
    if day < start or day > end:
        return None

    if _is_resource_task_completed(task_data):
        return "future-complete" if day > today else "complete"

    if end < today:
        return "overdue"
    return "ongoing"


def _task_date_span_from_data(task_data: dict) -> tuple[date | None, date | None]:
    start = _parse_task_date(task_data.get("startDate"))
    end = _parse_task_date(task_data.get("endDate"))
    if start and end:
        return (min(start, end), max(start, end))
    if end:
        return (end, end)
    if start:
        return (start, start)
    return (None, None)


def _summarize_tasks_by_date(tasks_by_date: dict[str, list[dict]]) -> dict[str, dict]:
    summaries: dict[str, dict] = {}
    today = date.today()
    for key, day_tasks in tasks_by_date.items():
        if key == "unscheduled":
            continue
        try:
            day = date.fromisoformat(key)
        except ValueError:
            continue
        total = len(day_tasks)
        incomplete = 0
        for task in day_tasks:
            status = _task_day_visual_status(task, day, today)
            if status is None:
                continue
            if day > today:
                if status == "ongoing":
                    incomplete += 1
            elif status == "overdue":
                incomplete += 1
        summaries[key] = {
            "totalTasks": total,
            "completedTasks": total - incomplete,
            "incompleteTasks": incomplete,
        }
    return summaries


def _collect_assignee_ids(user: User) -> set[str]:
    """Distinct users assigned on any task visible to the requester."""
    base_q = pms_access_service.base_tasks_query(user)
    task_ids_sq = base_q.with_entities(PmsTask.id).subquery()

    assignee_ids: set[str] = set()
    rows = (
        db.session.query(PmsTaskAssignee.user_id)
        .filter(PmsTaskAssignee.task_id.in_(task_ids_sq))
        .distinct()
        .all()
    )
    assignee_ids.update(r[0] for r in rows if r[0])

    primary_rows = (
        base_q.filter(PmsTask.assigned_to.isnot(None))
        .with_entities(PmsTask.assigned_to)
        .distinct()
        .all()
    )
    assignee_ids.update(r[0] for r in primary_rows if r[0])
    return assignee_ids


def _user_tasks_in_range(user: User, target_user_id: str, date_from: date, date_to: date) -> list[PmsTask]:
    q = pms_access_service.base_tasks_query(user)
    q = pms_access_service.filter_tasks_assigned_to_user(q, target_user_id)
    tasks = q.order_by(PmsTask.end_date.asc(), PmsTask.start_date.asc(), PmsTask.title.asc()).all()
    return [t for t in tasks if _task_overlaps_range(t, date_from, date_to)]


def _projects_preview_for_tasks(tasks: list[PmsTask], target_user_id: str | None = None) -> list[dict]:
    by_project: dict[str, list[PmsTask]] = defaultdict(list)
    for task in tasks:
        by_project[task.project_id].append(task)

    member_project_ids: list[str] = []
    if target_user_id:
        member_project_ids = [
            m.project_id
            for m in PmsProjectMember.query.filter_by(user_id=target_user_id).all()
        ]

    project_ids = member_project_ids or list(by_project.keys())
    if not project_ids:
        return []

    projects_meta = {
        p.id: p
        for p in PmsProject.query.filter(
            PmsProject.id.in_(project_ids),
            PmsProject.deleted_at.is_(None),
        ).all()
    }
    company_ids = {p.company_id for p in projects_meta.values() if p.company_id}
    companies = (
        {c.id: c.name for c in Company.query.filter(Company.id.in_(company_ids)).all()}
        if company_ids
        else {}
    )

    rows = []
    for project_id in sorted(
        project_ids,
        key=lambda pid: (projects_meta.get(pid).title if projects_meta.get(pid) else "").lower(),
    ):
        project = projects_meta.get(project_id)
        if not project:
            continue
        rows.append(
            {
                "projectId": project.id,
                "projectCode": project.project_code,
                "projectTitle": project.title,
                "status": project.status,
                "priority": project.priority,
                "companyName": companies.get(project.company_id) if project.company_id else None,
                "taskCount": len(by_project.get(project_id, [])),
            }
        )

    if rows:
        return rows

    # Fallback when membership metadata is unavailable.
    for project_id in sorted(
        by_project.keys(),
        key=lambda pid: (_project_title(pid) or "").lower(),
    ):
        sample = by_project[project_id][0]
        rows.append(
            {
                "projectId": project_id,
                "projectCode": "",
                "projectTitle": _project_title(project_id) or sample.title or "Project",
                "status": "",
                "priority": "",
                "companyName": None,
                "taskCount": len(by_project[project_id]),
            }
        )
    return rows


def _build_user_row(
    target_user_id: str,
    tasks: list[PmsTask],
    date_from: date,
    date_to: date,
    sprint_names: dict[str, str],
) -> dict:
    target = User.query.get(target_user_id)
    serialized_pairs = [(t, _enrich_task(t, sprint_names)) for t in tasks]
    serialized = [data for _, data in serialized_pairs]
    projects = _projects_preview_for_tasks(tasks, target_user_id)

    tasks_by_date = _tasks_by_date_for_user(serialized_pairs, date_from, date_to)
    return {
        "userId": target_user_id,
        "userName": target.name if target else None,
        "userEmail": target.email if target else None,
        "taskCount": len(serialized),
        "projectCount": len(projects),
        "projects": projects,
        "tasks": serialized,
        "tasksByDate": tasks_by_date,
        "tasksByDateSummary": _summarize_tasks_by_date(tasks_by_date),
    }


def get_resource_overview(
    user: User,
    *,
    date_from: date,
    date_to: date,
) -> dict:
    _validate_date_range(date_from, date_to)

    assignee_ids = _collect_assignee_ids(user)
    if not assignee_ids:
        return {
            "from": date_from.isoformat(),
            "to": date_to.isoformat(),
            "users": [],
            "summary": {"userCount": 0, "taskCount": 0},
        }

    users_meta = {u.id: u for u in User.query.filter(User.id.in_(assignee_ids)).all()}

    user_rows = []
    total_tasks = 0
    all_sprint_ids: set[str] = set()

    sorted_ids = sorted(
        assignee_ids,
        key=lambda x: (users_meta.get(x).name if users_meta.get(x) else x).lower(),
    )

    tasks_by_user: dict[str, list[PmsTask]] = {}
    for uid in sorted_ids:
        tasks = _user_tasks_in_range(user, uid, date_from, date_to)
        tasks_by_user[uid] = tasks
        total_tasks += len(tasks)
        all_sprint_ids.update(t.sprint_id for t in tasks if t.sprint_id)

    sprint_names = _sprint_labels(all_sprint_ids)

    for uid in sorted_ids:
        user_rows.append(_build_user_row(uid, tasks_by_user[uid], date_from, date_to, sprint_names))

    return {
        "from": date_from.isoformat(),
        "to": date_to.isoformat(),
        "users": user_rows,
        "summary": {
            "userCount": len(user_rows),
            "taskCount": total_tasks,
        },
    }


def get_resource_activity(
    user: User,
    *,
    target_user_id: str,
    date_from: date,
    date_to: date,
) -> dict:
    if not target_user_id:
        raise PmsValidationError("userId is required")
    _validate_date_range(date_from, date_to)

    tasks = _user_tasks_in_range(user, target_user_id, date_from, date_to)
    sprint_names = _sprint_labels({t.sprint_id for t in tasks if t.sprint_id})

    user_row = _build_user_row(target_user_id, tasks, date_from, date_to, sprint_names)

    by_project: dict[str, list[PmsTask]] = defaultdict(list)
    for task in tasks:
        by_project[task.project_id].append(task)

    project_ids = list(by_project.keys())
    projects_meta = (
        {
            p.id: p
            for p in PmsProject.query.filter(
                PmsProject.id.in_(project_ids), PmsProject.deleted_at.is_(None)
            ).all()
        }
        if project_ids
        else {}
    )

    project_rows = []
    for project_id in sorted(
        project_ids,
        key=lambda pid: (projects_meta.get(pid).title if projects_meta.get(pid) else "").lower(),
    ):
        project = projects_meta.get(project_id)
        if not project:
            continue
        project_tasks = by_project[project_id]
        serialized_pairs = [(t, _enrich_task(t, sprint_names)) for t in project_tasks]
        serialized = [data for _, data in serialized_pairs]
        tasks_by_date = _tasks_by_date_for_user(serialized_pairs, date_from, date_to)
        project_rows.append(
            {
                "projectId": project.id,
                "projectCode": project.project_code,
                "projectTitle": project.title,
                "status": project.status,
                "taskCount": len(serialized),
                "tasks": serialized,
                "tasksByDate": tasks_by_date,
                "tasksByDateSummary": _summarize_tasks_by_date(tasks_by_date),
            }
        )

    return {
        "userId": target_user_id,
        "userName": user_row["userName"],
        "from": date_from.isoformat(),
        "to": date_to.isoformat(),
        "projects": project_rows,
        "summary": {
            "projectCount": len(project_rows),
            "taskCount": len(tasks),
        },
    }
