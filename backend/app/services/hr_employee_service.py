"""HR employee list: paginated directory + lightweight lookup (no N+1 profile fetches)."""

from __future__ import annotations

from sqlalchemy import func, or_
from sqlalchemy.orm import aliased

from app import db
from app.models import EmploymentHistory, HRInfo, User

DEFAULT_PER_PAGE = 25
MAX_PER_PAGE = 100


def _hr_summary_dict(hr: HRInfo | None) -> dict | None:
    if not hr:
        return None
    return {
        "id": hr.id,
        "userId": hr.user_id,
        "department": hr.department or "",
        "designation": hr.designation or "",
        "employeeType": hr.employee_type or "",
        "joiningDate": hr.joining_date.isoformat() if hr.joining_date else None,
        "reportingManagerId": hr.reporting_manager_id or "",
        "shiftId": hr.shift_id or "",
        "employeeId": hr.employee_id or "",
    }


def _latest_employment_for_hr_info_ids(hr_info_ids: list[str]) -> dict[str, dict]:
    """Latest employment row per hr_info_id that has nextActivityDate (matches UI logic)."""
    if not hr_info_ids:
        return {}
    rows = (
        EmploymentHistory.query.filter(EmploymentHistory.hr_info_id.in_(hr_info_ids))
        .order_by(
            EmploymentHistory.hr_info_id.asc(),
            EmploymentHistory.updated_at.desc(),
            EmploymentHistory.created_at.desc(),
        )
        .all()
    )
    out: dict[str, dict] = {}
    for row in rows:
        if row.hr_info_id in out:
            continue
        if not row.next_activity_date:
            continue
        out[row.hr_info_id] = {
            "nextActivity": row.next_activity or "",
            "nextActivityDate": row.next_activity_date.isoformat(),
            "appraisalDate": row.appraisal_date.isoformat() if row.appraisal_date else None,
            "updatedAt": row.updated_at.isoformat() + "Z" if row.updated_at else None,
            "createdAt": row.created_at.isoformat() + "Z" if row.created_at else None,
        }
    return out


def _manager_names(manager_ids: set[str]) -> dict[str, str]:
    if not manager_ids:
        return {}
    managers = User.query.filter(User.id.in_(list(manager_ids))).all()
    return {m.id: m.name or "" for m in managers}


def _apply_list_filters(q, search: str, department: str, designation: str, role: str):
    if role and role != "all":
        q = q.filter(User.role == role)
    if department and department != "all":
        q = q.filter(HRInfo.department == department)
    if designation and designation != "all":
        q = q.filter(HRInfo.designation == designation)
    term = (search or "").strip().lower()
    if term:
        like = f"%{term}%"
        q = q.filter(
            or_(
                func.lower(User.name).like(like),
                func.lower(User.email).like(like),
                func.lower(func.coalesce(User.phone, "")).like(like),
                func.lower(func.coalesce(HRInfo.employee_id, "")).like(like),
                func.lower(func.coalesce(HRInfo.department, "")).like(like),
                func.lower(func.coalesce(HRInfo.designation, "")).like(like),
            )
        )
    return q


def list_employees_paginated(
    *,
    page: int = 1,
    per_page: int = DEFAULT_PER_PAGE,
    search: str = "",
    department: str = "",
    designation: str = "",
    role: str = "",
) -> dict:
    page = max(1, page)
    per_page = min(max(1, per_page), MAX_PER_PAGE)

    base = db.session.query(User, HRInfo).outerjoin(HRInfo, User.id == HRInfo.user_id)
    filtered = _apply_list_filters(base, search, department, designation, role)

    total = filtered.with_entities(func.count(User.id)).scalar() or 0
    total_pages = max(1, (total + per_page - 1) // per_page) if total else 1
    if page > total_pages:
        page = total_pages

    rows = (
        filtered.order_by(User.name.asc(), User.id.asc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    hr_info_ids = [hr.id for _, hr in rows if hr]
    latest_emp = _latest_employment_for_hr_info_ids(hr_info_ids)

    manager_ids = {
        hr.reporting_manager_id
        for _, hr in rows
        if hr and hr.reporting_manager_id
    }
    mgr_names = _manager_names(manager_ids)

    items = []
    for user, hr in rows:
        hr_dict = _hr_summary_dict(hr)
        if hr_dict and hr and hr.reporting_manager_id:
            hr_dict["reportingManagerName"] = mgr_names.get(hr.reporting_manager_id, "")
        elif hr_dict:
            hr_dict["reportingManagerName"] = ""

        latest = latest_emp.get(hr.id) if hr else None
        items.append(
            {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "phone": user.phone or "",
                "role": user.role,
                "isActive": user.is_active,
                "hr": hr_dict,
                "latestEmployment": latest,
            }
        )

    return {
        "items": items,
        "total": int(total),
        "page": page,
        "perPage": per_page,
        "totalPages": int(total_pages),
    }


def list_employees_lookup() -> list[dict]:
    """
    Lightweight list for attendance, leaves filter, office shifts (all users).
    Omits profile pictures and nested employment/certification payloads.
    """
    Manager = aliased(User)
    rows = (
        db.session.query(User, HRInfo, Manager.name)
        .outerjoin(HRInfo, User.id == HRInfo.user_id)
        .outerjoin(Manager, HRInfo.reporting_manager_id == Manager.id)
        .order_by(User.name.asc(), User.id.asc())
        .all()
    )

    result = []
    for user, hr, manager_name in rows:
        entry = {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "phone": user.phone or "",
            "role": user.role,
            "isActive": user.is_active,
            "profilePicture": None,
            "hr": None,
        }
        if hr:
            entry["hr"] = {
                **_hr_summary_dict(hr),
                "reportingManagerName": manager_name or "",
            }
        result.append(entry)
    return result
