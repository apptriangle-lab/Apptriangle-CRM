"""PMS project CRUD and member management."""
from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import and_, case, func, or_, select

from app import db
from app.models import Company, User
from app.notification_service import notification_service
from app.pms_models import PmsProject, PmsProjectMember, PmsProjectStar, PmsProjectType
from app.pms_permissions import is_pms_admin, user_has_permission
from app.schemas.pms_validators import PmsValidationError, validate_project_create, validate_project_update
from app.services import pms_access_service, pms_status_service


def _csv_filter_values(raw: str) -> list[str]:
    if not raw or not raw.strip():
        return []
    return [part.strip() for part in raw.split(",") if part.strip()]


def _normalize_project_status(value: str) -> str:
    return value.strip().lower().replace(" ", "_")


def can_invite_project_members(user: User, project: PmsProject) -> bool:
    """PMS admin or project owner may invite members."""
    if user_has_permission(user, "pms.project.invite_user"):
        return True
    return project.created_by == user.id


def can_update_project(user: User, project: PmsProject) -> bool:
    """PMS admin or project owner may update project details."""
    if user_has_permission(user, "pms.project.update"):
        return True
    return project.created_by == user.id


def _next_project_code() -> str:
    year = datetime.utcnow().year
    prefix = f"PRJ-{year}-"
    last = (
        PmsProject.query.filter(PmsProject.project_code.like(f"{prefix}%"))
        .order_by(PmsProject.project_code.desc())
        .first()
    )
    seq = 1
    if last:
        try:
            seq = int(last.project_code.split("-")[-1]) + 1
        except ValueError:
            seq = 1
    return f"{prefix}{seq:04d}"


def _company_name(company_id: str | None) -> str | None:
    if not company_id:
        return None
    c = Company.query.get(company_id)
    return c.name if c else None


def _project_type_name(project_type_id: str | None) -> str | None:
    if not project_type_id:
        return None
    pt = PmsProjectType.query.get(project_type_id)
    return pt.name if pt else None


def _serialize_project(project: PmsProject, **kwargs) -> dict:
    d = project.to_dict(project_type_name=_project_type_name(project.project_type_id), **kwargs)
    d["companyName"] = _company_name(project.company_id)
    return d


def _owner_info(user_id: str | None) -> dict:
    if not user_id:
        return {"ownerName": None, "ownerEmail": None}
    u = User.query.get(user_id)
    return {
        "ownerName": u.name if u else None,
        "ownerEmail": u.email if u else None,
    }


def _compute_project_progress_percentage(completed: int, non_cancelled: int) -> int:
    """Completed / non-cancelled tasks * 100, rounded; 0% when denominator is 0."""
    if non_cancelled <= 0:
        return 0
    return round(completed / non_cancelled * 100)


def _task_progress_stats_for_projects(project_ids: list[str]) -> dict[str, dict]:
    """Aggregate task counts per project in one query (no N+1)."""
    if not project_ids:
        return {}
    from app.pms_models import PmsTask

    rows = (
        db.session.query(PmsTask.project_id, PmsTask.status, func.count(PmsTask.id))
        .filter(PmsTask.project_id.in_(project_ids), PmsTask.deleted_at.is_(None))
        .group_by(PmsTask.project_id, PmsTask.status)
        .all()
    )
    counts: dict[str, dict[str, int]] = {
        pid: {"total": 0, "completed": 0, "cancelled": 0} for pid in project_ids
    }
    for project_id, status, count in rows:
        bucket = counts[project_id]
        bucket["total"] += count
        if pms_status_service.is_pms_task_completed_status(status):
            bucket["completed"] += count
        if pms_status_service.is_pms_task_cancelled_status(status):
            bucket["cancelled"] += count

    out: dict[str, dict] = {}
    for pid, c in counts.items():
        non_cancelled = max(0, c["total"] - c["cancelled"])
        out[pid] = {
            "total": c["total"],
            "completed": c["completed"],
            "cancelled": c["cancelled"],
            "nonCancelled": non_cancelled,
            "progressPercentage": _compute_project_progress_percentage(c["completed"], non_cancelled),
        }
    return out


def _members_preview_for_projects(project_ids: list[str]) -> dict[str, list[dict]]:
    if not project_ids:
        return {}
    rows = (
        db.session.query(PmsProjectMember, User)
        .join(User, PmsProjectMember.user_id == User.id)
        .filter(PmsProjectMember.project_id.in_(project_ids))
        .order_by(PmsProjectMember.joined_at.asc(), PmsProjectMember.created_at.asc())
        .all()
    )
    out: dict[str, list[dict]] = {pid: [] for pid in project_ids}
    for member, user in rows:
        out[member.project_id].append(
            {
                "userId": member.user_id,
                "userName": user.name if user else None,
                "userEmail": user.email if user else None,
                "roleLabel": member.role_label,
            }
        )
    return out


def _starred_project_ids(user_id: str, project_ids: list[str] | None = None) -> set[str]:
    q = PmsProjectStar.query.filter(PmsProjectStar.user_id == user_id)
    if project_ids is not None:
        if not project_ids:
            return set()
        q = q.filter(PmsProjectStar.project_id.in_(project_ids))
    return {row.project_id for row in q.all()}


def _apply_project_list_order(q, user: User, *, for_filter: bool):
    if for_filter:
        return q.order_by(PmsProject.updated_at.desc())
    return (
        q.outerjoin(
            PmsProjectStar,
            and_(
                PmsProjectStar.project_id == PmsProject.id,
                PmsProjectStar.user_id == user.id,
            ),
        )
        .order_by(
            case((PmsProjectStar.id.isnot(None), 0), else_=1),
            PmsProject.updated_at.desc(),
        )
    )


def list_projects(
    user: User,
    *,
    page: int = 1,
    per_page: int = 20,
    search: str = "",
    status: str = "",
    priority: str = "",
    project_type_id: str = "",
    company_id: str = "",
    member_user_id: str = "",
    start_from=None,
    start_to=None,
    for_filter: bool = False,
) -> dict:
    q = pms_access_service.base_projects_query(user)
    if search:
        term = f"%{search.strip()}%"
        q = q.filter(
            or_(
                PmsProject.title.ilike(term),
                PmsProject.project_code.ilike(term),
            )
        )
    status_values = [_normalize_project_status(s) for s in _csv_filter_values(status)]
    if status_values:
        q = q.filter(PmsProject.status.in_(status_values))
    priority_values = [p.strip().lower() for p in _csv_filter_values(priority)]
    if priority_values:
        q = q.filter(PmsProject.priority.in_(priority_values))
    project_type_values = _csv_filter_values(project_type_id)
    if project_type_values:
        if len(project_type_values) == 1 and project_type_values[0].lower() == "none":
            q = q.filter(PmsProject.project_type_id.is_(None))
        else:
            q = q.filter(PmsProject.project_type_id.in_(project_type_values))
    if company_id:
        q = q.filter(PmsProject.company_id == company_id.strip())
    member_user_values = _csv_filter_values(member_user_id)
    if member_user_values:
        member_project_ids = (
            select(PmsProjectMember.project_id)
            .where(PmsProjectMember.user_id.in_(member_user_values))
            .distinct()
        )
        q = q.filter(PmsProject.id.in_(member_project_ids))
    if start_from:
        q = q.filter(PmsProject.start_date >= start_from)
    if start_to:
        q = q.filter(PmsProject.start_date <= start_to)

    total = q.count()
    per_page = max(1, min(per_page, 100))
    page = max(1, page)
    rows = (
        _apply_project_list_order(q, user, for_filter=for_filter)
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    if for_filter:
        items = [_serialize_project(p) for p in rows]
        return {"items": items, "total": total, "page": page, "perPage": per_page}

    project_ids = [p.id for p in rows]
    starred_ids = _starred_project_ids(user.id, project_ids)
    members_by_project = _members_preview_for_projects(project_ids)
    task_stats_by_project = _task_progress_stats_for_projects(project_ids)
    items = []
    for p in rows:
        d = _serialize_project(p, include_member_count=True)
        d.update(_owner_info(p.created_by))
        d["members"] = members_by_project.get(p.id, [])
        d["taskStats"] = task_stats_by_project.get(
            p.id,
            {
                "total": 0,
                "completed": 0,
                "cancelled": 0,
                "nonCancelled": 0,
                "progressPercentage": 0,
            },
        )
        d["isStarred"] = p.id in starred_ids
        items.append(d)
    return {"items": items, "total": total, "page": page, "perPage": per_page}


def create_project(user: User, data: dict) -> dict:
    if not user_has_permission(user, "pms.project.create"):
        raise PermissionError("Not allowed to create projects")
    payload = validate_project_create(data)
    if payload["companyId"] and not Company.query.get(payload["companyId"]):
        raise PmsValidationError("companyId not found")
    project_type = PmsProjectType.query.filter_by(
        id=payload["projectTypeId"], is_active=True
    ).first()
    if not project_type:
        raise PmsValidationError("Invalid or inactive project type")

    try:
        project = PmsProject(
            project_code=_next_project_code(),
            title=payload["title"],
            description=payload["description"],
            company_id=payload["companyId"],
            project_type_id=payload["projectTypeId"],
            start_date=payload["startDate"],
            end_date=payload["endDate"],
            status=payload["status"],
            priority=payload["priority"],
            progress=payload["progress"],
            created_by=user.id,
            updated_by=user.id,
        )
        db.session.add(project)
        db.session.flush()
        member = PmsProjectMember(
            project_id=project.id,
            user_id=user.id,
            invited_by=user.id,
            joined_at=datetime.utcnow(),
            role_label="Owner",
        )
        db.session.add(member)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    out = _serialize_project(project, include_member_count=True)
    return out


def _task_brief(task, **kwargs) -> dict:
    from app.services.pms_task_service import _serialize_task

    return _serialize_task(task, **kwargs)


def project_dashboard(user: User, project_id: str) -> dict:
    """Project-scoped dashboard: KPIs, status breakdown, overdue/upcoming/recent tasks."""
    from app.pms_models import PmsTask

    project = pms_access_service.get_project_for_user(user, project_id)
    if not project:
        raise LookupError("Project not found")

    today = date.today()
    base = PmsTask.query.filter_by(project_id=project.id, deleted_at=None)
    total_tasks = base.count()

    by_status_rows = (
        db.session.query(PmsTask.status, func.count(PmsTask.id))
        .filter(PmsTask.project_id == project.id, PmsTask.deleted_at.is_(None))
        .group_by(PmsTask.status)
        .all()
    )
    tasks_by_status = {status: count for status, count in by_status_rows}

    completed_tasks = sum(
        c for s, c in by_status_rows if pms_status_service.is_pms_task_completed_status(s)
    )
    cancelled_tasks = tasks_by_status.get("cancelled", 0)
    open_tasks = max(0, total_tasks - completed_tasks - cancelled_tasks)

    completed_values = [
        s for s in pms_status_service.get_pms_task_status_values() if pms_status_service.is_pms_task_completed_status(s)
    ]
    active_open = base.filter(PmsTask.status != "cancelled")
    if completed_values:
        active_open = active_open.filter(~PmsTask.status.in_(completed_values))
    else:
        active_open = active_open.filter(PmsTask.status != "completed")

    overdue_q = active_open.filter(PmsTask.end_date < today)
    overdue_count = overdue_q.count()
    overdue_rows = overdue_q.order_by(PmsTask.end_date.asc()).limit(10).all()
    overdue_items = [_task_brief(t) for t in overdue_rows]

    upcoming_q = active_open.filter(PmsTask.end_date >= today)
    upcoming_rows = upcoming_q.order_by(PmsTask.end_date.asc()).limit(10).all()
    upcoming_items = [_task_brief(t) for t in upcoming_rows]

    recent_rows = base.order_by(PmsTask.updated_at.desc()).limit(8).all()
    recent_tasks = [_task_brief(t) for t in recent_rows]

    end_nulls_last = case((PmsTask.end_date.is_(None), 1), else_=0)
    my_rows = (
        pms_access_service.filter_tasks_assigned_to_user(base, user.id)
        .order_by(end_nulls_last, PmsTask.end_date.asc(), PmsTask.updated_at.desc())
        .limit(8)
        .all()
    )
    my_tasks = [_task_brief(t) for t in my_rows]

    member_count = PmsProjectMember.query.filter_by(project_id=project.id).count()
    my_assigned = pms_access_service.filter_tasks_assigned_to_user(base, user.id).count()

    in_progress = tasks_by_status.get("in_progress", 0)

    return {
        "canInviteMembers": can_invite_project_members(user, project),
        "project": {
            "id": project.id,
            "projectCode": project.project_code,
            "title": project.title,
            "status": project.status,
            "priority": project.priority,
            "progress": project.progress,
            "createdBy": project.created_by,
            "startDate": project.start_date.isoformat() if project.start_date else None,
            "endDate": project.end_date.isoformat() if project.end_date else None,
            "companyName": _company_name(project.company_id),
            "description": project.description or "",
        },
        "kpis": {
            "totalTasks": total_tasks,
            "completedTasks": completed_tasks,
            "openTasks": open_tasks,
            "inProgressTasks": in_progress,
            "overdueTasks": overdue_count,
            "memberCount": member_count,
            "myAssignedTasks": my_assigned,
        },
        "tasksByStatus": tasks_by_status,
        "overdueTasks": overdue_items,
        "upcomingTasks": upcoming_items,
        "recentTasks": recent_tasks,
        "myTasks": my_tasks,
    }


def _member_name(user_id: str | None) -> str | None:
    if not user_id:
        return None
    u = User.query.get(user_id)
    return u.name if u else None


def get_project_detail(user: User, project_id: str) -> dict:
    project = pms_access_service.get_project_for_user(user, project_id)
    if not project:
        raise LookupError("Project not found")
    members = []
    for m in PmsProjectMember.query.filter_by(project_id=project.id).all():
        u = User.query.get(m.user_id)
        members.append(m.to_dict(user_name=u.name if u else None, user_email=u.email if u else None))

    stats = _task_progress_stats_for_projects([project.id]).get(
        project.id,
        {
            "total": 0,
            "completed": 0,
            "cancelled": 0,
            "nonCancelled": 0,
            "progressPercentage": 0,
        },
    )
    out = _serialize_project(project, include_member_count=True)
    out["members"] = members
    out["taskStats"] = stats
    out["isStarred"] = project.id in _starred_project_ids(user.id, [project.id])
    return out


def update_project(user: User, project_id: str, data: dict) -> dict:
    project = pms_access_service.get_project_for_user(user, project_id)
    if not project:
        raise LookupError("Project not found")
    if not can_update_project(user, project):
        raise PermissionError("Not allowed to update projects")
    payload = validate_project_update(data)
    if not payload:
        raise PmsValidationError("No fields to update")
    if "companyId" in payload and payload["companyId"] and not Company.query.get(payload["companyId"]):
        raise PmsValidationError("companyId not found")
    if "projectTypeId" in payload:
        project_type = PmsProjectType.query.filter_by(
            id=payload["projectTypeId"], is_active=True
        ).first()
        if not project_type:
            raise PmsValidationError("Invalid or inactive project type")

    try:
        if "title" in payload:
            project.title = payload["title"]
        if "description" in payload:
            project.description = payload["description"]
        if "companyId" in payload:
            project.company_id = payload["companyId"]
        if "projectTypeId" in payload:
            project.project_type_id = payload["projectTypeId"]
        if "startDate" in payload:
            project.start_date = payload["startDate"]
        if "endDate" in payload:
            project.end_date = payload["endDate"]
        if "status" in payload:
            project.status = payload["status"]
        if "priority" in payload:
            project.priority = payload["priority"]
        if "progress" in payload:
            project.progress = payload["progress"]
        project.updated_by = user.id
        project.updated_at = datetime.utcnow()
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    out = _serialize_project(project, include_member_count=True)
    out.update(_owner_info(project.created_by))
    return out


def delete_project(user: User, project_id: str) -> None:
    if not user_has_permission(user, "pms.project.delete"):
        raise PermissionError("Not allowed to delete projects")
    project = pms_access_service.get_project_for_user(user, project_id)
    if not project:
        raise LookupError("Project not found")
    try:
        project.deleted_at = datetime.utcnow()
        project.updated_by = user.id
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise


def invite_member(user: User, project_id: str, target_user_id: str, role_label: str = "") -> dict:
    project = pms_access_service.get_project_for_user(user, project_id)
    if not project:
        raise LookupError("Project not found")
    if not can_invite_project_members(user, project):
        raise PermissionError("Not allowed to invite members")
    target = User.query.get(target_user_id)
    if not target or not target.is_active:
        raise PmsValidationError("User not found or inactive")
    if PmsProjectMember.query.filter_by(project_id=project_id, user_id=target_user_id).first():
        raise PmsValidationError("User is already a project member")

    try:
        row = PmsProjectMember(
            project_id=project_id,
            user_id=target_user_id,
            invited_by=user.id,
            joined_at=datetime.utcnow(),
            role_label=(role_label or "").strip()[:64] or None,
        )
        db.session.add(row)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    if target_user_id != user.id:
        notification_service.create_notification(
            user_id=target_user_id,
            title="PMS · Added to project",
            message=f'{user.name} added you to the project "{project.title}".',
            n_type="info",
            category="pms",
        )

    return row.to_dict(user_name=target.name, user_email=target.email)


def remove_member(user: User, project_id: str, target_user_id: str) -> None:
    if not user_has_permission(user, "pms.project.remove_user"):
        raise PermissionError("Not allowed to remove members")
    project = pms_access_service.get_project_for_user(user, project_id)
    if not project:
        raise LookupError("Project not found")
    row = PmsProjectMember.query.filter_by(project_id=project_id, user_id=target_user_id).first()
    if not row:
        raise LookupError("Member not found")
    if project.created_by == target_user_id and not is_pms_admin(user):
        raise PmsValidationError("Cannot remove project owner")
    try:
        db.session.delete(row)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise


def set_project_starred(user: User, project_id: str, starred: bool) -> dict:
    project = pms_access_service.get_project_for_user(user, project_id)
    if not project:
        raise LookupError("Project not found")
    row = PmsProjectStar.query.filter_by(user_id=user.id, project_id=project_id).first()
    try:
        if starred:
            if not row:
                db.session.add(PmsProjectStar(user_id=user.id, project_id=project_id))
        elif row:
            db.session.delete(row)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return {"ok": True, "isStarred": starred}
