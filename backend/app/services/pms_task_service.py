"""PMS task CRUD, comments, kanban, my-tasks, dashboard."""
from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import and_, case, func, or_

from app import db
from app.models import User
from app.pms_models import (
    PmsProject,
    PmsSprint,
    PmsTask,
    PmsTaskAssignee,
    PmsTaskAttachment,
    PmsTaskComment,
    PmsTaskDependency,
)
from app.pms_permissions import is_pms_admin, user_has_permission
from app.schemas.pms_validators import (
    PmsValidationError,
    _normalize_task_dates,
    validate_comment,
    validate_status_patch,
    validate_task_create,
    validate_task_update,
)
from app.services import pms_access_service, pms_status_service
from app.services.pms_task_notification_service import (
    assignee_ids_for_task,
    notify_new_pms_task_assignees,
    notify_pms_comment_mentions,
)
from app.services.pms_task_sprint_rules import (
    assert_parent_may_set_sprint,
    cascade_sprint_to_descendants,
    resolve_sprint_id_for_create,
)


def _user_name(user_id: str | None) -> str | None:
    if not user_id:
        return None
    u = User.query.get(user_id)
    return u.name if u else None


def _assignees_for_task(task_id: str) -> list[dict]:
    rows = (
        PmsTaskAssignee.query.filter_by(task_id=task_id)
        .order_by(PmsTaskAssignee.created_at.asc())
        .all()
    )
    return [r.to_dict(user_name=_user_name(r.user_id)) for r in rows]


def _assignees_for_tasks(task_ids: list[str]) -> dict[str, list[dict]]:
    if not task_ids:
        return {}
    rows = (
        PmsTaskAssignee.query.filter(PmsTaskAssignee.task_id.in_(task_ids))
        .order_by(PmsTaskAssignee.created_at.asc())
        .all()
    )
    user_ids = {row.user_id for row in rows if row.user_id}
    names_by_id: dict[str, str | None] = {}
    if user_ids:
        for uid, name in db.session.query(User.id, User.name).filter(User.id.in_(user_ids)).all():
            names_by_id[uid] = name
    grouped: dict[str, list[dict]] = {}
    for row in rows:
        grouped.setdefault(row.task_id, []).append(
            row.to_dict(user_name=names_by_id.get(row.user_id))
        )
    return grouped


def _project_titles_for_ids(project_ids: list[str]) -> dict[str, str]:
    if not project_ids:
        return {}
    rows = (
        db.session.query(PmsProject.id, PmsProject.title)
        .filter(PmsProject.id.in_(project_ids))
        .all()
    )
    return {pid: title for pid, title in rows}


def _serialize_tasks_batch(
    tasks: list[PmsTask],
    *,
    include_attachment_counts: bool = False,
) -> list[dict]:
    if not tasks:
        return []
    task_ids = [t.id for t in tasks]
    project_ids = list({t.project_id for t in tasks if t.project_id})
    assignees_by_task = _assignees_for_tasks(task_ids)
    sub_counts = _subtask_counts(task_ids)
    att_counts = _attachment_counts(task_ids) if include_attachment_counts else {}
    titles_by_project = _project_titles_for_ids(project_ids)

    items: list[dict] = []
    for task in tasks:
        assignees = assignees_by_task.get(task.id, [])
        label = _assignee_names_label(assignees)
        kwargs = {
            "project_title": titles_by_project.get(task.project_id),
            "sub_task_count": sub_counts.get(task.id, 0),
        }
        if include_attachment_counts:
            kwargs["attachment_count"] = att_counts.get(task.id, 0)
        d = task.to_dict(assignee_name=label, **kwargs)
        d["assignees"] = assignees
        d["assignedTo"] = assignees[0]["userId"] if assignees else None
        d["assigneeName"] = label
        items.append(d)
    return items


def _assignee_names_label(assignees: list[dict]) -> str | None:
    if not assignees:
        return None
    names = [a.get("userName") or a.get("userId") or "" for a in assignees]
    return ", ".join(n for n in names if n)


def _sync_task_assignees(task: PmsTask, assignee_ids: list[str], assigned_by: str) -> None:
    PmsTaskAssignee.query.filter_by(task_id=task.id).delete()
    for uid in assignee_ids:
        db.session.add(
            PmsTaskAssignee(
                task_id=task.id,
                user_id=uid,
                assigned_by=assigned_by,
            )
        )
    task.assigned_to = assignee_ids[0] if assignee_ids else None
    task.assigned_by = assigned_by if assignee_ids else None


def _subtask_counts(task_ids: list[str]) -> dict[str, int]:
    if not task_ids:
        return {}
    rows = (
        db.session.query(PmsTask.parent_task_id, func.count(PmsTask.id))
        .filter(
            PmsTask.parent_task_id.in_(task_ids),
            PmsTask.deleted_at.is_(None),
        )
        .group_by(PmsTask.parent_task_id)
        .all()
    )
    return {pid: int(cnt) for pid, cnt in rows}


def _attachment_counts(task_ids: list[str]) -> dict[str, int]:
    if not task_ids:
        return {}
    rows = (
        db.session.query(PmsTaskAttachment.task_id, func.count(PmsTaskAttachment.id))
        .filter(PmsTaskAttachment.task_id.in_(task_ids))
        .group_by(PmsTaskAttachment.task_id)
        .all()
    )
    return {tid: int(cnt) for tid, cnt in rows}


def _serialize_task(task: PmsTask, **kwargs) -> dict:
    assignees = _assignees_for_task(task.id)
    label = _assignee_names_label(assignees)
    d = task.to_dict(assignee_name=label, **kwargs)
    d["assignees"] = assignees
    d["assignedTo"] = assignees[0]["userId"] if assignees else None
    d["assigneeName"] = label
    return d


def _project_title(project_id: str) -> str | None:
    p = PmsProject.query.get(project_id)
    return p.title if p else None


def _apply_sprint_filter(q, sprint_id: str):
    """sprintId=backlog → unassigned; sprintId=<id> → that sprint; empty → no filter."""
    raw = (sprint_id or "").strip()
    if not raw or raw.lower() == "all":
        return q
    if raw.lower() == "backlog":
        return q.filter(PmsTask.sprint_id.is_(None))
    return q.filter(PmsTask.sprint_id == raw)


def _resolve_sprint_id(user: User, project_id: str, sprint_id: str | None) -> str | None:
    if not sprint_id:
        return None
    sprint = PmsSprint.query.filter_by(id=sprint_id, deleted_at=None).first()
    if not sprint or sprint.project_id != project_id:
        raise PmsValidationError("Invalid sprint")
    project = pms_access_service.get_project_for_user(user, project_id)
    if not project:
        raise LookupError("Project not found")
    return sprint.id


def _sync_task_date_fields(task: PmsTask) -> None:
    start, end = _normalize_task_dates(task.start_date, task.end_date)
    task.start_date = start
    task.end_date = end


def _mine_task_ids_with_tree(user: User, project_id: str = "") -> list[str]:
    """Tasks assigned to, assigned by, or created by the user (plus parent chain for tree)."""
    base = pms_access_service.base_tasks_query(user)
    if project_id:
        base = base.filter(PmsTask.project_id == project_id)

    ids: set[str] = set()

    assigned_rows = (
        pms_access_service.filter_tasks_assigned_to_user(base, user.id)
        .with_entities(PmsTask.id)
        .all()
    )
    ids.update(row[0] for row in assigned_rows)

    created_by_rows = (
        base.filter(PmsTask.created_by == user.id).with_entities(PmsTask.id).all()
    )
    ids.update(row[0] for row in created_by_rows)

    assigned_by_rows = (
        base.filter(PmsTask.assigned_by == user.id).with_entities(PmsTask.id).all()
    )
    ids.update(row[0] for row in assigned_by_rows)

    assigner_link_rows = (
        base.join(PmsTaskAssignee, PmsTaskAssignee.task_id == PmsTask.id)
        .filter(PmsTaskAssignee.assigned_by == user.id)
        .with_entities(PmsTask.id)
        .distinct()
        .all()
    )
    ids.update(row[0] for row in assigner_link_rows)

    if not ids:
        return []

    # Walk up to parents only — do not pull in sibling subtasks assigned to others.
    pending = set(ids)
    while pending:
        parent_rows = (
            PmsTask.query.filter(
                PmsTask.id.in_(list(pending)),
                PmsTask.parent_task_id.isnot(None),
            )
            .with_entities(PmsTask.parent_task_id)
            .all()
        )
        parent_ids = {row[0] for row in parent_rows if row[0]} - ids
        if not parent_ids:
            break
        ids.update(parent_ids)
        pending = parent_ids

    return list(ids)


def _resolve_task_list_scope(
    user: User,
    *,
    mine: bool,
    assigned_to: str,
    project_id: str = "",
) -> tuple[bool, str]:
    """Hub/global lists are personal-only for user access; project-scoped lists honour filters."""
    if is_pms_admin(user):
        return mine, (assigned_to or "").strip()
    if (project_id or "").strip():
        return mine, (assigned_to or "").strip()
    return True, ""


def list_tasks(
    user: User,
    *,
    page: int = 1,
    per_page: int = 20,
    search: str = "",
    project_id: str = "",
    company_id: str = "",
    assigned_to: str = "",
    mine: bool = False,
    status: str = "",
    priority: str = "",
    due_from=None,
    due_to=None,
    sprint_id: str = "",
) -> dict:
    mine, assigned_to = _resolve_task_list_scope(
        user, mine=mine, assigned_to=assigned_to, project_id=project_id
    )
    q = pms_access_service.base_tasks_query(user)
    if search:
        term = f"%{search.strip()}%"
        q = q.filter(PmsTask.title.ilike(term))
    if project_id:
        q = q.filter(PmsTask.project_id == project_id)
    if company_id:
        q = q.filter(PmsProject.company_id == company_id.strip())
    if mine:
        mine_ids = _mine_task_ids_with_tree(user, project_id)
        if not mine_ids:
            return {"items": [], "total": 0, "page": max(1, page), "perPage": max(1, min(per_page, 100))}
        q = q.filter(PmsTask.id.in_(mine_ids))
    elif assigned_to:
        q = pms_access_service.filter_tasks_assigned_to_user(q, assigned_to)
    if status:
        from app.schemas.pms_validators import PmsValidationError

        try:
            status_val = pms_status_service.validate_pms_task_status(status)
        except PmsValidationError:
            status_val = status.strip().lower().replace(" ", "_")
        q = q.filter(PmsTask.status == status_val)
    if priority:
        q = q.filter(PmsTask.priority == priority.strip().lower())
    if due_from:
        q = q.filter(
            or_(
                PmsTask.end_date >= due_from,
                and_(PmsTask.end_date.is_(None), PmsTask.start_date >= due_from),
            )
        )
    if due_to:
        q = q.filter(
            or_(
                PmsTask.start_date <= due_to,
                and_(PmsTask.start_date.is_(None), PmsTask.end_date <= due_to),
            )
        )
    q = _apply_sprint_filter(q, sprint_id)

    total = q.count()
    per_page = max(1, min(per_page, 100))
    page = max(1, page)
    # MySQL does not support NULLS LAST — sort null due dates after dated rows
    end_nulls_last = case((PmsTask.end_date.is_(None), 1), else_=0)
    rows = (
        q.order_by(end_nulls_last, PmsTask.end_date.asc(), PmsTask.updated_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    items = _serialize_tasks_batch(rows, include_attachment_counts=True)
    return {"items": items, "total": total, "page": page, "perPage": per_page}


def create_task(user: User, data: dict) -> dict:
    if not user_has_permission(user, "pms.task.create"):
        raise PermissionError("Not allowed to create tasks")
    payload = validate_task_create(data)
    project = pms_access_service.get_project_for_user(user, payload["projectId"])
    if not project:
        raise LookupError("Project not found")
    if payload["parentTaskId"]:
        parent = pms_access_service.get_task_for_user(user, payload["parentTaskId"])
        if not parent or parent.project_id != project.id:
            raise PmsValidationError("Invalid parent task")
    else:
        parent = None
    assignee_ids = payload.get("assigneeIds") or []
    if assignee_ids:
        pms_access_service.filter_assignees_must_be_members(project.id, assignee_ids)
    inherited_sprint = resolve_sprint_id_for_create(
        parent_task=parent,
        requested_sprint_id=payload.get("sprintId"),
    )
    resolved_sprint = _resolve_sprint_id(user, project.id, inherited_sprint)

    try:
        task = PmsTask(
            project_id=payload["projectId"],
            sprint_id=resolved_sprint,
            parent_task_id=payload["parentTaskId"],
            title=payload["title"],
            description=payload["description"],
            assigned_to=assignee_ids[0] if assignee_ids else None,
            assigned_by=user.id if assignee_ids else None,
            status=payload["status"],
            priority=payload["priority"],
            start_date=payload["startDate"],
            end_date=payload["endDate"],
            estimated_hours=payload["estimatedHours"],
            actual_hours=payload["actualHours"],
            created_by=user.id,
            updated_by=user.id,
        )
        db.session.add(task)
        db.session.flush()
        _sync_task_assignees(task, assignee_ids, user.id)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    notify_new_pms_task_assignees(
        task=task,
        assigner=user,
        new_assignee_ids=assignee_ids,
        project_title=project.title,
    )

    return _serialize_task(task, project_title=project.title)


def get_task_detail(user: User, task_id: str) -> dict:
    task = pms_access_service.get_task_for_user(user, task_id)
    if not task:
        raise LookupError("Task not found")
    sub_count = PmsTask.query.filter_by(parent_task_id=task.id, deleted_at=None).count()
    comments = []
    for c in PmsTaskComment.query.filter_by(task_id=task.id).order_by(PmsTaskComment.created_at.desc()).all():
        comments.append(c.to_dict(user_name=_user_name(c.user_id)))
    sub_tasks = [
        _serialize_task(st)
        for st in PmsTask.query.filter_by(parent_task_id=task.id, deleted_at=None).all()
    ]
    deps = [d.to_dict() for d in PmsTaskDependency.query.filter_by(task_id=task.id).all()]
    attachments = [
        a.to_dict(download_url=f"/api/pms/tasks/{task.id}/attachments/{a.id}/download")
        for a in PmsTaskAttachment.query.filter_by(task_id=task.id)
        .order_by(PmsTaskAttachment.created_at.desc())
        .all()
    ]
    out = _serialize_task(
        task,
        project_title=_project_title(task.project_id),
        sub_task_count=sub_count,
    )
    out["comments"] = comments
    out["subTasks"] = sub_tasks
    out["dependencies"] = deps
    out["attachments"] = attachments
    return out


def update_task(user: User, task_id: str, data: dict) -> dict:
    task = pms_access_service.get_task_for_user(user, task_id)
    if not task:
        raise LookupError("Task not found")

    if not user_has_permission(user, "pms.task.update"):
        raise PermissionError("Not allowed to update tasks")

    payload = validate_task_update(data)
    if not payload:
        raise PmsValidationError("No fields to update")
    if "assigneeIds" in payload:
        pms_access_service.filter_assignees_must_be_members(
            task.project_id, payload["assigneeIds"]
        )

    previous_assignee_ids: list[str] = []
    if "assigneeIds" in payload:
        previous_assignee_ids = assignee_ids_for_task(task.id)

    try:
        if "title" in payload:
            task.title = payload["title"]
        if "description" in payload:
            task.description = payload["description"]
        if "assigneeIds" in payload:
            _sync_task_assignees(task, payload["assigneeIds"], user.id)
        if "status" in payload:
            task.status = payload["status"]
            if pms_status_service.is_pms_task_completed_status(payload["status"]):
                task.completed_at = datetime.utcnow()
            elif task.completed_at:
                task.completed_at = None
        if "priority" in payload:
            task.priority = payload["priority"]
        if "startDate" in payload:
            task.start_date = payload["startDate"]
        if "endDate" in payload:
            task.end_date = payload["endDate"]
        _sync_task_date_fields(task)
        if "estimatedHours" in payload:
            task.estimated_hours = payload["estimatedHours"]
        if "actualHours" in payload:
            task.actual_hours = payload["actualHours"]
        if "parentTaskId" in payload:
            new_parent_id = payload["parentTaskId"]
            task.parent_task_id = new_parent_id
            if new_parent_id:
                parent = PmsTask.query.filter_by(id=new_parent_id, deleted_at=None).first()
                if parent and parent.project_id == task.project_id:
                    task.sprint_id = parent.sprint_id
        if "sprintId" in payload:
            assert_parent_may_set_sprint(task)
            new_sprint_id = _resolve_sprint_id(user, task.project_id, payload["sprintId"])
            task.sprint_id = new_sprint_id
            cascade_sprint_to_descendants(task.id, new_sprint_id, user.id)
        task.updated_by = user.id
        task.updated_at = datetime.utcnow()
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    if "assigneeIds" in payload:
        previous_set = set(previous_assignee_ids)
        newly_added = [uid for uid in payload["assigneeIds"] if uid not in previous_set]
        notify_new_pms_task_assignees(
            task=task,
            assigner=user,
            new_assignee_ids=newly_added,
            project_title=_project_title(task.project_id),
        )

    return _serialize_task(task, project_title=_project_title(task.project_id))


def patch_task_status(user: User, task_id: str, data: dict) -> dict:
    if not user_has_permission(user, "pms.task.update_status"):
        raise PermissionError("Not allowed to update task status")
    task = pms_access_service.get_task_for_user(user, task_id)
    if not task:
        raise LookupError("Task not found")

    status = validate_status_patch(data)
    try:
        task.status = status
        task.completed_at = datetime.utcnow() if pms_status_service.is_pms_task_completed_status(status) else None
        task.updated_by = user.id
        task.updated_at = datetime.utcnow()
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    return _serialize_task(task, project_title=_project_title(task.project_id))


def bulk_update_tasks(user: User, data: dict) -> dict:
    """Apply the same field patch to many tasks. Partial success is allowed."""
    raw_ids = data.get("taskIds")
    if not raw_ids or not isinstance(raw_ids, list):
        raise PmsValidationError("taskIds must be a non-empty array")
    task_ids = [str(t).strip() for t in raw_ids if str(t).strip()]
    if not task_ids:
        raise PmsValidationError("taskIds must be a non-empty array")
    if len(task_ids) > 200:
        raise PmsValidationError("At most 200 tasks per bulk update")

    patch_data = {}
    if "status" in data:
        patch_data["status"] = data["status"]
    if "priority" in data:
        patch_data["priority"] = data["priority"]
    if "assigneeIds" in data or "assignedTo" in data:
        if "assigneeIds" in data:
            patch_data["assigneeIds"] = data["assigneeIds"]
        if "assignedTo" in data:
            patch_data["assignedTo"] = data["assignedTo"]

    if not validate_task_update(patch_data):
        raise PmsValidationError("Provide status, priority, and/or assigneeIds")

    results = []
    updated_tasks = []
    for tid in task_ids:
        try:
            task = update_task(user, tid, patch_data)
            results.append({"taskId": tid, "ok": True})
            updated_tasks.append(task)
        except (PermissionError, LookupError, PmsValidationError) as e:
            results.append({"taskId": tid, "ok": False, "error": str(e)})
        except Exception as e:
            results.append({"taskId": tid, "ok": False, "error": str(e)})

    ok_count = sum(1 for r in results if r.get("ok"))
    return {
        "updated": ok_count,
        "failed": len(results) - ok_count,
        "results": results,
        "tasks": updated_tasks,
    }


def delete_task(user: User, task_id: str) -> dict:
    from app.services.pms_task_lifecycle_service import soft_delete_task

    return soft_delete_task(user, task_id)


def add_comment(user: User, task_id: str, data: dict) -> dict:
    if not user_has_permission(user, "pms.comment.create"):
        raise PermissionError("Not allowed to comment")
    task = pms_access_service.get_task_for_user(user, task_id)
    if not task:
        raise LookupError("Task not found")
    text = validate_comment(data)
    try:
        row = PmsTaskComment(task_id=task_id, user_id=user.id, comment=text)
        db.session.add(row)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    notify_pms_comment_mentions(
        task=task,
        author=user,
        comment=text,
        project_title=_project_title(task.project_id),
    )
    return row.to_dict(user_name=user.name)


def kanban_board(
    user: User,
    *,
    project_id: str = "",
    assigned_to: str = "",
    mine: bool = False,
    priority: str = "",
    sprint_id: str = "",
) -> dict:
    mine, assigned_to = _resolve_task_list_scope(
        user, mine=mine, assigned_to=assigned_to, project_id=project_id
    )
    q = pms_access_service.base_tasks_query(user)
    if project_id:
        q = q.filter(PmsTask.project_id == project_id)
    if mine:
        mine_ids = _mine_task_ids_with_tree(user, project_id)
        if not mine_ids:
            status_values = pms_status_service.get_pms_task_status_values()
            return {"columns": {s: [] for s in status_values}}
        q = q.filter(PmsTask.id.in_(mine_ids))
    elif assigned_to:
        q = pms_access_service.filter_tasks_assigned_to_user(q, assigned_to)
    if priority:
        q = q.filter(PmsTask.priority == priority.strip().lower())
    q = _apply_sprint_filter(q, sprint_id)

    status_values = pms_status_service.get_pms_task_status_values()
    columns = {s: [] for s in status_values}
    tasks = q.order_by(PmsTask.updated_at.desc()).limit(500).all()
    serialized = _serialize_tasks_batch(tasks)
    for task, payload in zip(tasks, serialized):
        col = task.status if task.status in columns else (status_values[0] if status_values else "to_do")
        columns[col].append(payload)
    return {"columns": columns}


def my_tasks_summary(user: User) -> dict:
    today = date.today()
    tq = pms_access_service.filter_tasks_assigned_to_user(
        pms_access_service.base_tasks_query(user), user.id
    )
    all_tasks = tq.all()
    by_status = {}
    overdue = []
    upcoming = []
    completed = []
    for t in all_tasks:
        by_status[t.status] = by_status.get(t.status, 0) + 1
        brief = _serialize_task(t, project_title=_project_title(t.project_id))
        if t.status == "completed":
            completed.append(brief)
        elif t.end_date and t.end_date < today and t.status not in ("completed", "cancelled"):
            overdue.append(brief)
        elif t.end_date and t.end_date >= today:
            upcoming.append(brief)

    upcoming.sort(key=lambda x: x.get("endDate") or "")
    overdue.sort(key=lambda x: x.get("endDate") or "")
    return {
        "countsByStatus": by_status,
        "overdue": overdue[:20],
        "upcoming": upcoming[:20],
        "recentCompleted": completed[:10],
        "totalAssigned": len(all_tasks),
    }


def dashboard_stats(user: User) -> dict:
    if is_pms_admin(user):
        pq = pms_access_service.base_projects_query(user)
        tq = pms_access_service.base_tasks_query(user)
        total_projects = pq.count()
        active = pq.filter(PmsProject.status.in_(("not_started", "in_progress"))).count()
        completed_projects = pq.filter(PmsProject.status == "completed").count()
        total_tasks = tq.count()
        today = date.today()
        overdue = tq.filter(
            PmsTask.end_date < today,
            PmsTask.status.notin_(("completed", "cancelled")),
        ).count()
        by_status = {}
        for t in tq.all():
            by_status[t.status] = by_status.get(t.status, 0) + 1
        return {
            "scope": "admin",
            "totalProjects": total_projects,
            "activeProjects": active,
            "completedProjects": completed_projects,
            "totalTasks": total_tasks,
            "overdueTasks": overdue,
            "tasksByStatus": by_status,
        }

    invited = pms_access_service.base_projects_query(user).count()
    assigned_count = pms_access_service.filter_tasks_assigned_to_user(
        pms_access_service.base_tasks_query(user), user.id
    ).count()
    my = my_tasks_summary(user)
    return {
        "scope": "user",
        "invitedProjects": invited,
        "assignedTasks": assigned_count,
        "countsByStatus": my["countsByStatus"],
        "overdue": my["overdue"],
        "upcoming": my["upcoming"],
    }
