"""Read-only data assembly for external integration APIs."""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import func

from app import db
from app.attendance_constants import DEFAULT_TIMEZONE_OFFSET
from app.models import Attendance, Expense, HRInfo, Leave, User
from app.services import lunch_service

SOURCE_TABLE_NOTES = {
    "employees": "users + hr_info (logical crm_employees)",
    "attendance": "attendance (logical crm_attendance_cache)",
    "leaves": "leaves (logical crm_leave_cache)",
    "expenses": "expenses (logical crm_expense_entries)",
    "food_allowances": "lunch_votes + lunch_polls (logical crm_food_allowance_cache)",
}


def _employee_code(user: User, hr: HRInfo | None) -> str:
    if hr and (hr.employee_id or "").strip():
        return hr.employee_id.strip()
    return user.id


def _employee_name(user: User, hr: HRInfo | None) -> str:
    if hr and (hr.name or "").strip():
        return hr.name.strip()
    return user.name or ""


def _employee_email(user: User, hr: HRInfo | None) -> str:
    if hr:
        for candidate in (hr.office_mail, hr.personal_mail):
            if candidate and candidate.strip():
                return candidate.strip()
    return user.email or ""


def _user_hr_map() -> dict[str, tuple[User, HRInfo | None]]:
    rows = (
        db.session.query(User, HRInfo)
        .outerjoin(HRInfo, HRInfo.user_id == User.id)
        .filter(User.is_active.is_(True))
        .all()
    )
    return {user.id: (user, hr) for user, hr in rows}


def list_integration_employees() -> list[dict]:
    rows = (
        db.session.query(User, HRInfo)
        .outerjoin(HRInfo, HRInfo.user_id == User.id)
        .order_by(User.name.asc())
        .all()
    )
    items: list[dict] = []
    for user, hr in rows:
        items.append(
            {
                "employeeId": _employee_code(user, hr),
                "userId": user.id,
                "name": _employee_name(user, hr),
                "email": _employee_email(user, hr),
                "department": (hr.department if hr else "") or "",
                "designation": (hr.designation if hr else "") or "",
                "mobile": (hr.mobile if hr else user.phone) or "",
                "bankName": None,
                "bankRoutingNumber": (hr.bank_routing_number if hr else "") or "",
                "beneficiaryBankAccountNumber": (hr.beneficiary_bank_account_number if hr else "") or "",
                "receiverName": (hr.receiver_name if hr else "") or "",
                "joiningDate": hr.joining_date.isoformat() if hr and hr.joining_date else None,
                "isActive": bool(user.is_active),
            }
        )
    return items


def _format_local_time(dt: datetime | None) -> str | None:
    if not dt:
        return None
    local = dt + DEFAULT_TIMEZONE_OFFSET
    return local.strftime("%H:%M")


def _working_hours(check_in: datetime | None, check_out: datetime | None) -> float | None:
    if not check_in or not check_out:
        return None
    seconds = (check_out - check_in).total_seconds()
    if seconds < 0:
        return None
    return round(seconds / 3600, 2)


def _late_minutes(att: Attendance, hr: HRInfo | None) -> int | None:
    if att.status != "late" or not att.check_in_time:
        return None
    shift = hr.shift if hr else None
    if not shift or not shift.start_time:
        return None
    try:
        start_h, start_m = map(int, shift.start_time.split(":"))
        grace = int(shift.grace_period or 0)
        threshold = start_h * 60 + start_m + grace
        local = att.check_in_time + DEFAULT_TIMEZONE_OFFSET
        actual = local.hour * 60 + local.minute
        if actual <= threshold:
            return 0
        return actual - threshold
    except (ValueError, TypeError, AttributeError):
        return None


def list_integration_attendance(month: str, start: date, end: date) -> list[dict]:
    hr_map = _user_hr_map()
    rows = (
        Attendance.query.filter(Attendance.date >= start, Attendance.date <= end)
        .order_by(Attendance.date.asc(), Attendance.user_id.asc())
        .all()
    )
    items: list[dict] = []
    for row in rows:
        user, hr = hr_map.get(row.user_id, (None, None))
        if not user:
            user = User.query.get(row.user_id)
            hr = HRInfo.query.filter_by(user_id=row.user_id).first()
        items.append(
            {
                "employeeId": _employee_code(user, hr) if user else row.user_id,
                "employeeName": _employee_name(user, hr) if user else "",
                "date": row.date.isoformat() if row.date else None,
                "checkIn": _format_local_time(row.check_in_time),
                "checkOut": _format_local_time(row.check_out_time),
                "status": row.status or "",
                "totalWorkingHours": _working_hours(row.check_in_time, row.check_out_time),
                "lateMinutes": _late_minutes(row, hr),
                "overtime": None,
                "month": month,
            }
        )
    return items


def list_integration_leaves(month: str, start: date, end: date) -> list[dict]:
    rows = (
        Leave.query.filter(
            Leave.start_date <= end,
            Leave.end_date >= start,
        )
        .order_by(Leave.start_date.asc(), Leave.user_id.asc())
        .all()
    )
    items: list[dict] = []
    for row in rows:
        user = row.user
        hr = HRInfo.query.filter_by(user_id=row.user_id).first()
        total_days = float(row.total_leave_days) if row.total_leave_days is not None else None
        items.append(
            {
                "employeeId": _employee_code(user, hr) if user else row.user_id,
                "employeeName": _employee_name(user, hr) if user else (row.user.name if row.user else ""),
                "leaveType": row.leave_type.name if row.leave_type else "",
                "startDate": row.start_date.isoformat() if row.start_date else None,
                "endDate": row.end_date.isoformat() if row.end_date else None,
                "totalDays": total_days,
                "status": row.status or "",
                "reason": row.reason or "",
                "month": month,
            }
        )
    return items


def _expense_amount(expense: Expense) -> float:
    base = float(expense.amount or 0)
    ret = float(expense.amount_return or 0) if expense.amount_return is not None else 0.0
    if (expense.trip_type or "") == "round_trip":
        return base + ret
    return base


def _unpaid_expenses_for_month(start: date, end: date, user_ids: list[str] | None = None):
    query = Expense.query.filter(
        Expense.deleted_at.is_(None),
        Expense.date >= start,
        Expense.date <= end,
        func.lower(func.coalesce(Expense.status, "unpaid")) == "unpaid",
    )
    if user_ids is not None:
        query = query.filter(Expense.created_by_user_id.in_(user_ids))
    return query


def list_integration_expenses(month: str, start: date, end: date) -> dict:
    rows = (
        _unpaid_expenses_for_month(start, end)
        .order_by(Expense.date.asc(), Expense.created_at.asc())
        .all()
    )
    user_ids = {r.created_by_user_id for r in rows if r.created_by_user_id}
    users = {u.id: u for u in User.query.filter(User.id.in_(list(user_ids) or [""])).all()}
    hr_by_user = {
        hr.user_id: hr for hr in HRInfo.query.filter(HRInfo.user_id.in_(list(user_ids) or [""])).all()
    }

    entries: list[dict] = []
    total_amount = 0.0

    for row in rows:
        user = users.get(row.created_by_user_id) if row.created_by_user_id else None
        hr = hr_by_user.get(row.created_by_user_id) if row.created_by_user_id else None
        amount = _expense_amount(row)
        total_amount += amount

        purpose_name = ""
        if row.purpose_id and row.purpose_id:
            from app.models import ExpensePurpose

            purpose = ExpensePurpose.query.get(row.purpose_id)
            if purpose:
                purpose_name = purpose.name or ""

        entries.append(
            {
                "employeeId": _employee_code(user, hr) if user else (row.created_by_user_id or ""),
                "employeeName": _employee_name(user, hr) if user else "",
                "expenseType": purpose_name or (row.trip_type or ""),
                "amount": amount,
                "date": row.date.isoformat() if row.date else None,
                "status": row.status or "",
                "remarks": row.purpose or "",
                "fromLocation": row.from_location or "",
                "toLocation": row.to_location or "",
                "month": month,
            }
        )

    summary = {
        "totalAmount": round(total_amount, 2),
        "paidAmount": 0,
        "unpaidAmount": round(total_amount, 2),
        "entryCount": len(entries),
    }
    return {"entries": entries, "summary": summary}


def mark_integration_expenses_paid(month: str, start: date, end: date, user_ids: list[str]) -> dict:
    """Mark unpaid expenses in the month as paid for the given user IDs."""
    rows = _unpaid_expenses_for_month(start, end, user_ids).all()
    total_amount = 0.0
    for row in rows:
        total_amount += _expense_amount(row)
        row.status = "paid"
    db.session.commit()
    return {
        "month": month,
        "userIds": user_ids,
        "updatedCount": len(rows),
        "totalAmountMarkedPaid": round(total_amount, 2),
    }


def list_integration_food_allowances(month: str, start: date, end: date) -> list[dict]:
    """Monthly food allowance total per active employee (not per-meal rows)."""
    period_totals = lunch_service.sum_vote_balance_changes_by_user(from_date=start, to_date=end)

    rows = (
        db.session.query(User, HRInfo)
        .outerjoin(HRInfo, HRInfo.user_id == User.id)
        .filter(User.is_active.is_(True))
        .order_by(User.name.asc())
        .all()
    )

    items: list[dict] = []
    for user, hr in rows:
        net_change = float(period_totals.get(user.id, 0))
        food_balance_total = round(net_change, 2)
        items.append(
            {
                "employeeId": _employee_code(user, hr),
                "employeeName": _employee_name(user, hr),
                "month": month,
                "foodBalanceTotal": food_balance_total,
            }
        )
    return items


def food_allowances_month_meta_totals(items: list[dict]) -> dict[str, float]:
    positive = Decimal("0")
    negative = Decimal("0")
    for row in items:
        amount = Decimal(str(row.get("foodBalanceTotal") or 0))
        if amount > 0:
            positive += amount
        elif amount < 0:
            negative += amount
    return {
        "totalFoodBalance": float(round(positive + negative, 2)),
        "totalPositiveFoodBalance": float(round(positive, 2)),
        "totalNegativeFoodBalance": float(round(negative, 2)),
    }


def food_allowances_month_grand_total(items: list[dict]) -> float:
    return food_allowances_month_meta_totals(items)["totalFoodBalance"]
