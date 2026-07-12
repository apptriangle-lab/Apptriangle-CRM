"""Leave API: apply, list, approve, reject, and manage leave types."""
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional, Tuple
from flask import Blueprint, request, jsonify
from app import db
from app.models import (
    Leave,
    LeaveType,
    User,
    HRInfo,
    Weekend,
    Holiday,
    EmployeeLeaveBalance,
)
from app.auth_utils import get_current_user, require_auth, require_admin_or_hr_access

leaves_bp = Blueprint("leaves", __name__)

ALLOWED_DURATION_TYPES = frozenset({"single_day", "half_day", "multiple_day"})
ALLOWED_HALF_DAY_PERIODS = frozenset({"first_half", "second_half"})


def _parse_query_date(value: Optional[str]):
    """Parse YYYY-MM-DD from query string; return date or None if empty."""
    if not value or not str(value).strip():
        return None
    try:
        return datetime.strptime(str(value).strip()[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def calculate_working_days(start_date: date, end_date: date, user_id: str = None) -> int:
    """Calculate working days excluding weekends (from shift) and holidays."""
    # Get user's shift weekends
    weekend_days = set()
    if user_id:
        hr_info = HRInfo.query.filter_by(user_id=user_id).first()
        if hr_info and hr_info.shift:
            weekend_days = set(hr_info.shift.weekend_days)
    
    # If no user_id or no shift, fallback to global weekends for backward compatibility
    if not weekend_days:
        weekend_days = {w.day_of_week for w in Weekend.query.all()}
    # If nothing configured yet, treat Saturday/Sunday as non-working (same as typical shifts)
    if not weekend_days:
        weekend_days = {5, 6}
    
    holidays = Holiday.all_observed_dates()
    
    # Count working days
    working_days = 0
    current_date = start_date
    
    while current_date <= end_date:
        # Check if it's a weekend (weekday() returns 0=Monday, 6=Sunday)
        day_of_week = current_date.weekday()
        if day_of_week not in weekend_days and current_date not in holidays:
            working_days += 1
        current_date += timedelta(days=1)
    
    return working_days


def parse_leave_duration_and_dates(
    duration_type: str,
    start_date_str: str,
    end_date_str: str,
    user_id: str,
):
    """
    Validate duration type and dates; return (start_date, end_date, total_leave_days float).

    single_day / half_day: one working day only; total is 1.0 or 0.5.
    multiple_day: total is working-day count in range.
    """
    dt = (duration_type or "single_day").strip().lower()
    if dt not in ALLOWED_DURATION_TYPES:
        raise ValueError(
            "Invalid durationType. Use single_day, half_day, or multiple_day."
        )
    if not start_date_str:
        raise ValueError("startDate is required")
    try:
        start_date = date.fromisoformat(start_date_str)
    except ValueError as exc:
        raise ValueError("Invalid startDate format") from exc

    if dt in ("single_day", "half_day"):
        if end_date_str:
            try:
                end_date = date.fromisoformat(end_date_str)
            except ValueError as exc:
                raise ValueError("Invalid endDate format") from exc
            if end_date != start_date:
                raise ValueError(
                    "For single-day or half-day leave, start and end date must be the same."
                )
        else:
            end_date = start_date
        working = calculate_working_days(start_date, end_date, user_id)
        if working < 1:
            raise ValueError("Selected date must be a working day.")
        total = 1.0 if dt == "single_day" else 0.5
        return start_date, end_date, total

    if not end_date_str:
        raise ValueError("endDate is required for multi-day leave")
    try:
        end_date = date.fromisoformat(end_date_str)
    except ValueError as exc:
        raise ValueError("Invalid endDate format") from exc
    if start_date > end_date:
        raise ValueError("Start date cannot be after end date")
    working = calculate_working_days(start_date, end_date, user_id)
    if working < 1:
        raise ValueError("Selected date range contains no working days")
    return start_date, end_date, float(working)


def resolve_half_day_period(duration_type: str, half_day_period_raw) -> Optional[str]:
    """Return DB value for half_day_period, or None when not half-day leave."""
    dt = (duration_type or "").strip().lower()
    if dt != "half_day":
        return None
    if half_day_period_raw is None or (
        isinstance(half_day_period_raw, str) and not half_day_period_raw.strip()
    ):
        raise ValueError("Choose first half or second half for half-day leave.")
    v = str(half_day_period_raw).strip().lower()
    if v not in ALLOWED_HALF_DAY_PERIODS:
        raise ValueError("Invalid halfDayPeriod. Use first_half or second_half.")
    return v


def _inclusive_date_ranges_overlap(
    a_start: date, a_end: date, b_start: date, b_end: date
) -> bool:
    """True if inclusive calendar ranges [a_start, a_end] and [b_start, b_end] intersect."""
    return a_start <= b_end and b_start <= a_end


def _leave_date_conflicts_for_user(
    user_id: str,
    new_start: date,
    new_end: date,
    exclude_leave_id: Optional[str] = None,
):
    """Existing pending/approved leaves whose date range overlaps the new range."""
    q = Leave.query.filter(
        Leave.user_id == user_id,
        Leave.status.in_(("pending", "approved")),
    )
    if exclude_leave_id:
        q = q.filter(Leave.id != exclude_leave_id)
    conflicts = []
    for lv in q.all():
        if _inclusive_date_ranges_overlap(
            new_start, new_end, lv.start_date, lv.end_date
        ):
            conflicts.append(lv)
    return conflicts


def _conflicts_json_payload(conflicts):
    items = []
    for c in conflicts[:15]:
        items.append(
            {
                "leaveId": c.id,
                "startDate": c.start_date.isoformat(),
                "endDate": c.end_date.isoformat(),
                "leaveTypeName": c.leave_type.name if c.leave_type else "",
                "status": c.status,
            }
        )
    return items


def _entitlement_for_leave_type(user_id: str, leave_type_id: str) -> Decimal:
    """Total allocated days for this leave type (employee balance row)."""
    entry = EmployeeLeaveBalance.query.filter_by(
        user_id=user_id, leave_type_id=leave_type_id
    ).first()
    if entry and entry.balance is not None:
        return Decimal(str(entry.balance))
    return Decimal("0")


def _consumed_from_entitlement(
    user_id: str, leave_type_id: str, exclude_leave_id: Optional[str] = None
) -> Decimal:
    """Approved days drawn from quota: sum(total_leave_days - additional_leave_days)."""
    q = Leave.query.filter(
        Leave.user_id == user_id,
        Leave.leave_type_id == leave_type_id,
        Leave.status == "approved",
    )
    if exclude_leave_id:
        q = q.filter(Leave.id != exclude_leave_id)
    total = Decimal("0")
    for lv in q.all():
        t = Decimal(str(lv.total_leave_days or 0))
        a = Decimal(str(lv.additional_leave_days or 0))
        if a > t:
            a = t
        total += t - a
    return total


def _approved_additional_leave_days(
    user_id: str, leave_type_id: str, exclude_leave_id: Optional[str] = None
) -> Decimal:
    """Sum of additional_leave_days on approved leaves only (pending does not affect balance)."""
    q = Leave.query.filter(
        Leave.user_id == user_id,
        Leave.leave_type_id == leave_type_id,
        Leave.status == "approved",
    )
    if exclude_leave_id:
        q = q.filter(Leave.id != exclude_leave_id)
    total = Decimal("0")
    for lv in q.all():
        total += Decimal(str(lv.additional_leave_days or 0))
    return total


def _effective_remaining_quota(
    user_id: str, leave_type_id: str, exclude_leave_id: Optional[str] = None
) -> Decimal:
    """
    Days still available for new leave after HR credit (B) is reduced by
    entitlement usage, then any remainder of that credit offsets historical
    additional leave (approved only; pending additional is excluded until approval).

    This matches UI: new assignment first "repays" additional leave consumed earlier.
    """
    B = _entitlement_for_leave_type(user_id, leave_type_id)
    norm_used = _consumed_from_entitlement(user_id, leave_type_id, exclude_leave_id)
    add_used = _approved_additional_leave_days(user_id, leave_type_id, exclude_leave_id)
    remaining_after_norm = B - norm_used
    if remaining_after_norm < 0:
        remaining_after_norm = Decimal("0")
    offset = min(remaining_after_norm, add_used)
    return remaining_after_norm - offset


def _effective_balance_display(
    user_id: str, leave_type_id: str, assigned_balance: Decimal
) -> Tuple[Decimal, Decimal]:
    """
    Returns (remaining_balance, additional_outstanding) for API/UI.
    assigned_balance = HR-stored credit B for this type.
    additional_outstanding counts approved additional only; pending is excluded.
    """
    norm_used = _consumed_from_entitlement(user_id, leave_type_id, None)
    add_used = _approved_additional_leave_days(user_id, leave_type_id, None)
    remaining_after_norm = assigned_balance - norm_used
    if remaining_after_norm < 0:
        remaining_after_norm = Decimal("0")
    offset = min(remaining_after_norm, add_used)
    remaining_balance = remaining_after_norm - offset
    additional_outstanding = add_used - offset
    if additional_outstanding < 0:
        additional_outstanding = Decimal("0")
    return remaining_balance, additional_outstanding


def _compute_additional_leave_days(
    user_id: str,
    leave_type_id: str,
    requested: Decimal,
    exclude_leave_id: Optional[str] = None,
) -> Decimal:
    """Days of this request beyond effective remaining quota (0 if fully covered)."""
    remaining = _effective_remaining_quota(user_id, leave_type_id, exclude_leave_id)
    if requested <= remaining:
        return Decimal("0")
    return requested - remaining


def _set_leave_additional_days(lv: Leave, value: Decimal) -> None:
    """Persist additional_leave_days; clamp to [0, total_leave_days]."""
    t = Decimal(str(lv.total_leave_days or 0))
    v = value
    if v < 0:
        v = Decimal("0")
    if v > t:
        v = t
    lv.additional_leave_days = v


def _reconcile_norm_over_quota(user_id: str, leave_type_id: str, B: Decimal) -> bool:
    """
    When approved (total - additional) exceeds credited balance B, move excess
    from normal to additional (reverse chronological) so norm_used <= B.
    Returns True if any row was updated.
    """
    norm_used = _consumed_from_entitlement(user_id, leave_type_id, None)
    if norm_used <= B:
        return False
    excess = norm_used - B
    if excess <= 0:
        return False
    approved = (
        Leave.query.filter(
            Leave.user_id == user_id,
            Leave.leave_type_id == leave_type_id,
            Leave.status == "approved",
        )
        .order_by(Leave.start_date.desc(), Leave.id.desc())
        .all()
    )
    changed = False
    for lv in approved:
        if excess <= 0:
            break
        t = Decimal(str(lv.total_leave_days or 0))
        a = Decimal(str(lv.additional_leave_days or 0))
        norm_part = t - a
        if norm_part <= 0:
            continue
        take = min(norm_part, excess)
        _set_leave_additional_days(lv, a + take)
        excess -= take
        changed = True
    return changed


def _apply_additional_sum_delta(
    user_id: str, leave_type_id: str, delta: Decimal
) -> bool:
    """
    Change total additional_leave_days on approved leaves only by delta
    (negative = reduce additional, FIFO; positive = increase, reverse FIFO).
    Pending leaves are not adjusted here — they do not affect balance until approved.
    """
    if delta == 0:
        return False
    leaves = (
        Leave.query.filter(
            Leave.user_id == user_id,
            Leave.leave_type_id == leave_type_id,
            Leave.status == "approved",
        )
        .order_by(Leave.start_date.asc(), Leave.id.asc())
        .all()
    )
    changed = False
    if delta < 0:
        rem = -delta
        for lv in leaves:
            if rem <= 0:
                break
            a = Decimal(str(lv.additional_leave_days or 0))
            if a <= 0:
                continue
            cut = min(a, rem)
            _set_leave_additional_days(lv, a - cut)
            rem -= cut
            changed = True
    else:
        rem = delta
        for lv in reversed(leaves):
            if rem <= 0:
                break
            t = Decimal(str(lv.total_leave_days or 0))
            a = Decimal(str(lv.additional_leave_days or 0))
            room = t - a
            if room <= 0:
                continue
            add = min(room, rem)
            _set_leave_additional_days(lv, a + add)
            rem -= add
            changed = True
    return changed


def _reconcile_stored_additional_for_type(user_id: str, leave_type_id: str) -> None:
    """
    After HR updates credited balance, rewrite additional_leave_days on approved
    leaves so stored rows match balance math (pending leaves are not adjusted here).
    Iterates until stable (norm vs credit vs additional).
    """
    for _ in range(24):
        B = _entitlement_for_leave_type(user_id, leave_type_id)
        if _reconcile_norm_over_quota(user_id, leave_type_id, B):
            continue
        norm_used = _consumed_from_entitlement(user_id, leave_type_id, None)
        add_used = _approved_additional_leave_days(user_id, leave_type_id, None)
        remaining_after_norm = B - norm_used
        if remaining_after_norm < 0:
            remaining_after_norm = Decimal("0")
        offset = min(remaining_after_norm, add_used)
        target_add_sum = add_used - offset
        delta = target_add_sum - add_used
        if delta == 0:
            return
        _apply_additional_sum_delta(user_id, leave_type_id, delta)


def _can_manage_employee_balances(current_user, target_user_id: str) -> bool:
    """HR module access, target user, or the target's reporting manager can manage/view balances."""
    from app.services.rbac_service import can_access_page

    if can_access_page(current_user, "hr"):
        return True
    if current_user.id == target_user_id:
        return True
    hr_info = HRInfo.query.filter_by(user_id=target_user_id).first()
    return bool(hr_info and hr_info.reporting_manager_id == current_user.id)


def _can_view_leave_detail(current_user, leave: Leave) -> bool:
    """Owner, HR staff, or the employee's reporting manager."""
    from app.services.rbac_service import can_access_page

    if leave.user_id == current_user.id:
        return True
    if can_access_page(current_user, "hr"):
        return True
    hr_info = HRInfo.query.filter_by(user_id=leave.user_id).first()
    return bool(hr_info and hr_info.reporting_manager_id == current_user.id)


def _can_approve_or_reject_leave(current_user, leave: Leave) -> bool:
    """HR staff, or reporting manager for this employee (not self-approval)."""
    from app.services.rbac_service import can_access_page

    if can_access_page(current_user, "hr"):
        return True
    if leave.user_id == current_user.id:
        return False
    hr_info = HRInfo.query.filter_by(user_id=leave.user_id).first()
    return bool(hr_info and hr_info.reporting_manager_id == current_user.id)


def _build_employee_balance_rows(user_id: str):
    leave_types = LeaveType.query.filter_by(is_active=True).order_by(LeaveType.name.asc()).all()
    existing = EmployeeLeaveBalance.query.filter_by(user_id=user_id).all()
    by_type = {e.leave_type_id: e for e in existing}
    rows = []
    for lt in leave_types:
        entry = by_type.get(lt.id)
        B = (
            Decimal(str(entry.balance))
            if entry and entry.balance is not None
            else Decimal("0")
        )
        rem, add_out = _effective_balance_display(user_id, lt.id, B)
        rows.append(
            {
                "leaveTypeId": lt.id,
                "leaveTypeName": lt.name,
                "isActive": lt.is_active,
                "balance": float(B),
                "remainingBalance": float(rem),
                "additionalOutstanding": float(add_out),
            }
        )
    return rows


# --- Leave Types ---

@leaves_bp.route("/types", methods=["GET"])
@require_auth
def get_leave_types(current_user):
    """Get all active leave types."""
    types = LeaveType.query.filter_by(is_active=True).all()
    return jsonify([t.to_dict() for t in types]), 200

@leaves_bp.route("/types", methods=["POST"])
@require_admin_or_hr_access
def create_leave_type(current_user):
    """Admin only: Create a new leave type."""
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    
    if not name:
        return jsonify({"error": "Name is required"}), 400
    
    if LeaveType.query.filter_by(name=name).first():
        return jsonify({"error": "Leave type already exists"}), 400
    
    new_type = LeaveType(name=name)
    db.session.add(new_type)
    db.session.commit()
    return jsonify(new_type.to_dict()), 201

@leaves_bp.route("/types/<type_id>", methods=["PUT"])
@require_admin_or_hr_access
def update_leave_type(current_user, type_id):
    """Admin only: Update a leave type."""
    leave_type = LeaveType.query.get(type_id)
    if not leave_type:
        return jsonify({"error": "Leave type not found"}), 404
    
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    is_active = data.get("isActive")
    
    if not name:
        return jsonify({"error": "Name is required"}), 400
    
    # Check if another leave type with the same name exists
    existing = LeaveType.query.filter_by(name=name).first()
    if existing and existing.id != type_id:
        return jsonify({"error": "Leave type with this name already exists"}), 400
    
    leave_type.name = name
    if is_active is not None:
        leave_type.is_active = is_active
    db.session.commit()
    return jsonify(leave_type.to_dict()), 200

@leaves_bp.route("/types/<type_id>", methods=["DELETE"])
@require_admin_or_hr_access
def delete_leave_type(current_user, type_id):
    """Admin only: Delete a leave type."""
    leave_type = LeaveType.query.get(type_id)
    if not leave_type:
        return jsonify({"error": "Leave type not found"}), 404
    
    # Check if any leaves are using this type
    leaves_count = Leave.query.filter_by(leave_type_id=type_id).count()
    if leaves_count > 0:
        return jsonify({"error": f"Cannot delete leave type that is used by {leaves_count} leave request(s)"}), 400

    # Remove per-employee balance rows (FK to leave_types); not covered by leave request check
    EmployeeLeaveBalance.query.filter_by(leave_type_id=type_id).delete(
        synchronize_session=False
    )
    db.session.flush()

    db.session.delete(leave_type)
    db.session.commit()
    return jsonify({"message": "Leave type deleted"}), 200

@leaves_bp.route("/types/all", methods=["GET"])
@require_admin_or_hr_access
def get_all_leave_types(current_user):
    """Admin only: Get all leave types (including inactive)."""
    types = LeaveType.query.order_by(LeaveType.created_at.desc()).all()
    return jsonify([t.to_dict() for t in types]), 200


# --- Employee Leave Balances ---

@leaves_bp.route("/balances/<user_id>", methods=["GET"])
@require_auth
def get_employee_leave_balances(current_user, user_id):
    """Get leave balances for one employee against active leave types."""
    if not _can_manage_employee_balances(current_user, user_id):
        return jsonify({"error": "Unauthorized"}), 403

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "Employee not found"}), 404

    return jsonify({"userId": user_id, "balances": _build_employee_balance_rows(user_id)}), 200


@leaves_bp.route("/balances/<user_id>", methods=["PUT"])
@require_auth
def upsert_employee_leave_balances(current_user, user_id):
    """Create/update per-leave-type balances for an employee."""
    if not _can_manage_employee_balances(current_user, user_id):
        return jsonify({"error": "Unauthorized"}), 403

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "Employee not found"}), 404

    data = request.get_json() or {}
    rows = data.get("balances")
    if not isinstance(rows, list) or not rows:
        return jsonify({"error": "balances must be a non-empty array"}), 400

    leave_types = LeaveType.query.all()
    leave_type_ids = {lt.id for lt in leave_types}

    existing = EmployeeLeaveBalance.query.filter_by(user_id=user_id).all()
    existing_by_type = {e.leave_type_id: e for e in existing}

    types_updated = []
    for row in rows:
        if not isinstance(row, dict):
            return jsonify({"error": "Each balance row must be an object"}), 400
        leave_type_id = str(row.get("leaveTypeId", "")).strip()
        if not leave_type_id:
            return jsonify({"error": "leaveTypeId is required for each balance row"}), 400
        if leave_type_id not in leave_type_ids:
            return jsonify({"error": f"Invalid leaveTypeId: {leave_type_id}"}), 400

        raw_balance = row.get("balance")
        try:
            balance = Decimal(str(raw_balance))
        except Exception:
            return jsonify({"error": "balance must be a numeric value"}), 400
        if balance < 0:
            return jsonify({"error": "balance cannot be negative"}), 400

        entry = existing_by_type.get(leave_type_id)
        if entry:
            entry.balance = balance
        else:
            entry = EmployeeLeaveBalance(
                user_id=user_id,
                leave_type_id=leave_type_id,
                balance=balance,
            )
            db.session.add(entry)
        types_updated.append(leave_type_id)

    db.session.flush()
    for ltid in dict.fromkeys(types_updated):
        _reconcile_stored_additional_for_type(user_id, ltid)
    db.session.commit()
    return jsonify({"userId": user_id, "balances": _build_employee_balance_rows(user_id)}), 200


# --- Leave Requests ---

@leaves_bp.route("/apply", methods=["POST"])
@require_auth
def apply_leave(current_user):
    """Apply for a leave. Duration type drives how days are counted and stored."""
    data = request.get_json() or {}
    leave_type_id = data.get("leaveTypeId")
    start_date_str = data.get("startDate")
    end_date_str = data.get("endDate")
    duration_type = (data.get("durationType") or "single_day").strip().lower()
    reason = data.get("reason", "").strip()
    attachment_filename = data.get("attachmentFileName", "")
    attachment_data = data.get("attachmentData", "") # base64

    if not leave_type_id or not reason:
        return jsonify({"error": "Missing required fields"}), 400
    if duration_type in ("single_day", "half_day") and not start_date_str:
        return jsonify({"error": "startDate is required"}), 400
    if duration_type == "multiple_day" and not (start_date_str and end_date_str):
        return jsonify({"error": "startDate and endDate are required"}), 400

    try:
        start_date, end_date, total_leave_days = parse_leave_duration_and_dates(
            duration_type,
            start_date_str,
            end_date_str,
            current_user.id,
        )
        half_period = resolve_half_day_period(duration_type, data.get("halfDayPeriod"))
    except ValueError as err:
        return jsonify({"error": str(err)}), 400

    conflicts = _leave_date_conflicts_for_user(
        current_user.id, start_date, end_date, None
    )
    if conflicts:
        return (
            jsonify(
                {
                    "error": "Selected leave dates overlap with an existing leave request.",
                    "conflicts": _conflicts_json_payload(conflicts),
                }
            ),
            400,
        )

    req_dec = Decimal(str(total_leave_days))
    add_dec = _compute_additional_leave_days(
        current_user.id, leave_type_id, req_dec, None
    )

    new_leave = Leave(
        user_id=current_user.id,
        leave_type_id=leave_type_id,
        start_date=start_date,
        end_date=end_date,
        duration_type=duration_type,
        total_leave_days=req_dec,
        additional_leave_days=add_dec,
        half_day_period=half_period,
        reason=reason,
        attachment_filename=attachment_filename,
        attachment_data=attachment_data,
        status="pending"
    )
    db.session.add(new_leave)
    db.session.commit()
    return jsonify(new_leave.to_dict()), 201

@leaves_bp.route("/my", methods=["GET"])
@require_auth
def get_my_leaves(current_user):
    """Get leave requests for the current user."""
    leaves = Leave.query.filter_by(user_id=current_user.id).order_by(Leave.created_at.desc()).all()
    return jsonify([l.to_dict() for l in leaves]), 200

@leaves_bp.route("/all", methods=["GET"])
@require_admin_or_hr_access
def get_all_leaves(current_user):
    """Admin only: Get all leave requests.

    Optional query params:
      startDate, endDate — ISO date (YYYY-MM-DD). Returns leaves overlapping the range.
      userIds — comma-separated user ids; omit or empty for all users.
    """
    query = Leave.query

    start_raw = request.args.get("startDate")
    end_raw = request.args.get("endDate")
    start_d = _parse_query_date(start_raw) if start_raw else None
    end_d = _parse_query_date(end_raw) if end_raw else None
    if start_raw and start_d is None:
        return jsonify({"error": "Invalid startDate; use YYYY-MM-DD"}), 400
    if end_raw and end_d is None:
        return jsonify({"error": "Invalid endDate; use YYYY-MM-DD"}), 400
    if start_d and end_d and start_d > end_d:
        return jsonify({"error": "startDate must be on or before endDate"}), 400

    if start_d and end_d:
        query = query.filter(Leave.start_date <= end_d, Leave.end_date >= start_d)
    elif start_d:
        query = query.filter(Leave.end_date >= start_d)
    elif end_d:
        query = query.filter(Leave.start_date <= end_d)

    user_ids_param = request.args.get("userIds", "").strip()
    if user_ids_param:
        ids = [x.strip() for x in user_ids_param.split(",") if x.strip()]
        if ids:
            query = query.filter(Leave.user_id.in_(ids))

    leaves = query.order_by(Leave.created_at.desc()).all()
    return jsonify([l.to_dict() for l in leaves]), 200

@leaves_bp.route("/team", methods=["GET"])
@require_auth
def get_team_leaves(current_user):
    """Get leave requests for employees managed by the current user (as reporting manager)."""
    # Find all users where current_user is their reporting manager
    hr_infos = HRInfo.query.filter_by(reporting_manager_id=current_user.id).all()
    managed_user_ids = [hr.user_id for hr in hr_infos]
    
    if not managed_user_ids:
        return jsonify([]), 200
    
    # Get all leaves for managed users
    leaves = Leave.query.filter(Leave.user_id.in_(managed_user_ids)).order_by(Leave.created_at.desc()).all()
    return jsonify([l.to_dict() for l in leaves]), 200

@leaves_bp.route("/is-reporting-manager", methods=["GET"])
@require_auth
def is_reporting_manager(current_user):
    """Check if the current user is a reporting manager for any employees."""
    count = HRInfo.query.filter_by(reporting_manager_id=current_user.id).count()
    return jsonify({"isReportingManager": count > 0, "teamSize": count}), 200

# --- Weekends Management ---

@leaves_bp.route("/weekends", methods=["GET"])
@require_auth
def get_weekends(current_user):
    """Get all configured weekend days."""
    weekends = Weekend.query.order_by(Weekend.day_of_week).all()
    return jsonify([w.to_dict() for w in weekends]), 200

@leaves_bp.route("/weekends", methods=["POST"])
@require_admin_or_hr_access
def create_weekend(current_user):
    """Admin only: Add a weekend day."""
    data = request.get_json() or {}
    day_of_week = data.get("dayOfWeek")
    
    if day_of_week is None or not isinstance(day_of_week, int) or day_of_week < 0 or day_of_week > 6:
        return jsonify({"error": "dayOfWeek must be an integer between 0 (Monday) and 6 (Sunday)"}), 400
    
    # Check if already exists
    existing = Weekend.query.filter_by(day_of_week=day_of_week).first()
    if existing:
        return jsonify({"error": "This weekend day is already configured"}), 400
    
    weekend = Weekend(day_of_week=day_of_week)
    db.session.add(weekend)
    db.session.commit()
    return jsonify(weekend.to_dict()), 201

@leaves_bp.route("/weekends/<weekend_id>", methods=["DELETE"])
@require_admin_or_hr_access
def delete_weekend(current_user, weekend_id):
    """Admin only: Remove a weekend day."""
    weekend = Weekend.query.get(weekend_id)
    if not weekend:
        return jsonify({"error": "Weekend not found"}), 404
    
    db.session.delete(weekend)
    db.session.commit()
    return jsonify({"message": "Weekend removed"}), 200

# --- Holidays Management ---

@leaves_bp.route("/holidays", methods=["GET"])
@require_auth
def get_holidays(current_user):
    """Get all configured holidays."""
    holidays = Holiday.query.order_by(Holiday.start_date, Holiday.end_date).all()
    return jsonify([h.to_dict() for h in holidays]), 200

@leaves_bp.route("/holidays", methods=["POST"])
@require_admin_or_hr_access
def create_holiday(current_user):
    """Admin only: Add a holiday (single or multi-day inclusive range)."""
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    start_str = data.get("startDate") or data.get("date")
    end_str = data.get("endDate") or data.get("date")

    if not name:
        return jsonify({"error": "name is required"}), 400
    if not start_str or not end_str:
        return jsonify(
            {"error": "startDate and endDate are required (use the same value for a single-day holiday)"}
        ), 400

    try:
        start_d = date.fromisoformat(str(start_str).strip()[:10])
        end_d = date.fromisoformat(str(end_str).strip()[:10])
    except ValueError:
        return jsonify({"error": "Invalid date format; use YYYY-MM-DD"}), 400

    if end_d < start_d:
        return jsonify({"error": "endDate cannot be before startDate"}), 400

    holiday = Holiday(name=name, start_date=start_d, end_date=end_d)
    db.session.add(holiday)
    db.session.commit()
    return jsonify(holiday.to_dict()), 201

@leaves_bp.route("/holidays/<holiday_id>", methods=["PUT"])
@require_admin_or_hr_access
def update_holiday(current_user, holiday_id):
    """Admin only: Update a holiday range."""
    holiday = Holiday.query.get(holiday_id)
    if not holiday:
        return jsonify({"error": "Holiday not found"}), 404

    data = request.get_json() or {}
    name = data.get("name", "").strip()
    if name:
        holiday.name = name

    raw_start = data.get("startDate")
    raw_end = data.get("endDate")
    raw_legacy = data.get("date")
    if raw_legacy is not None and raw_start is None:
        raw_start = raw_legacy
    if raw_legacy is not None and raw_end is None:
        raw_end = raw_legacy

    if raw_start is not None or raw_end is not None:
        try:
            sd = (
                date.fromisoformat(str(raw_start).strip()[:10])
                if raw_start is not None
                else holiday.start_date
            )
            ed = (
                date.fromisoformat(str(raw_end).strip()[:10])
                if raw_end is not None
                else holiday.end_date
            )
        except ValueError:
            return jsonify({"error": "Invalid date format; use YYYY-MM-DD"}), 400
        if ed < sd:
            return jsonify({"error": "endDate cannot be before startDate"}), 400
        holiday.start_date = sd
        holiday.end_date = ed

    db.session.commit()
    return jsonify(holiday.to_dict()), 200

@leaves_bp.route("/holidays/<holiday_id>", methods=["DELETE"])
@require_admin_or_hr_access
def delete_holiday(current_user, holiday_id):
    """Admin only: Remove a holiday."""
    holiday = Holiday.query.get(holiday_id)
    if not holiday:
        return jsonify({"error": "Holiday not found"}), 404
    
    db.session.delete(holiday)
    db.session.commit()
    return jsonify({"message": "Holiday removed"}), 200

@leaves_bp.route("/calculate-days", methods=["POST"])
@require_auth
def calculate_leave_days(current_user):
    """Calculate working days for a date range (excluding weekends and holidays).

    Optional body field ``userId``: use that employee's shift/weekend rules.
    Same as current user is always allowed. Otherwise: admins, or that employee's
    reporting manager. If omitted, uses the current user's rules.
    """
    data = request.get_json() or {}
    start_date_str = data.get("startDate")
    end_date_str = data.get("endDate")
    target_user_id = data.get("userId") or data.get("user_id")

    if not start_date_str or not end_date_str:
        return jsonify({"error": "startDate and endDate are required"}), 400

    try:
        start_date = date.fromisoformat(start_date_str)
        end_date = date.fromisoformat(end_date_str)
    except ValueError:
        return jsonify({"error": "Invalid date format"}), 400

    if start_date > end_date:
        return jsonify({"error": "Start date cannot be after end date"}), 400

    from app.services.rbac_service import can_access_page

    user_id_for_calc = current_user.id
    if target_user_id:
        # Same user: always allowed (client often sends userId for self; managers
        # are checked below when calculating for someone else).
        if target_user_id == current_user.id:
            user_id_for_calc = current_user.id
        elif can_access_page(current_user, "hr"):
            user_id_for_calc = target_user_id
        else:
            hr_info = HRInfo.query.filter_by(user_id=target_user_id).first()
            if hr_info and hr_info.reporting_manager_id == current_user.id:
                user_id_for_calc = target_user_id
            else:
                return jsonify({"error": "Unauthorized"}), 403

    working_days = calculate_working_days(start_date, end_date, user_id_for_calc)
    return jsonify({"workingDays": working_days}), 200

@leaves_bp.route("/<leave_id>/approve", methods=["POST"])
@require_auth
def approve_leave(current_user, leave_id):
    """HR staff or reporting manager: Approve a leave request."""
    leave = Leave.query.get(leave_id)
    if not leave:
        return jsonify({"error": "Leave request not found"}), 404
    
    if leave.status != "pending":
        return jsonify({"error": f"Leave is already {leave.status}"}), 400

    if not _can_approve_or_reject_leave(current_user, leave):
        return jsonify({"error": "Unauthorized. Only HR or the employee's reporting manager can approve leaves"}), 403

    leave.status = "approved"
    leave.approved_by_user_id = current_user.id
    leave.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify(leave.to_dict()), 200

@leaves_bp.route("/<leave_id>/reject", methods=["POST"])
@require_auth
def reject_leave(current_user, leave_id):
    """HR staff or reporting manager: Reject a leave request."""
    data = request.get_json() or {}
    reason = data.get("reason", "").strip()
    
    if not reason:
        return jsonify({"error": "Rejection reason is required"}), 400
        
    leave = Leave.query.get(leave_id)
    if not leave:
        return jsonify({"error": "Leave request not found"}), 404
    
    if leave.status != "pending":
        return jsonify({"error": f"Leave is already {leave.status}"}), 400

    if not _can_approve_or_reject_leave(current_user, leave):
        return jsonify({"error": "Unauthorized. Only HR or the employee's reporting manager can reject leaves"}), 403

    leave.status = "rejected"
    leave.rejection_reason = reason
    leave.approved_by_user_id = current_user.id
    leave.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify(leave.to_dict()), 200

@leaves_bp.route("/<leave_id>", methods=["GET"])
@require_auth
def get_leave_details(current_user, leave_id):
    """Get leave details, including attachment data."""
    leave = Leave.query.get(leave_id)
    if not leave:
        return jsonify({"error": "Leave request not found"}), 404

    if not _can_view_leave_detail(current_user, leave):
        return jsonify({"error": "Unauthorized"}), 403

    return jsonify(leave.to_dict(include_attachment_data=True)), 200

@leaves_bp.route("/<leave_id>", methods=["PUT"])
@require_auth
def update_leave(current_user, leave_id):
    """Update a leave request. Only the user who created it can update, and only if status is pending."""
    leave = Leave.query.get(leave_id)
    if not leave:
        return jsonify({"error": "Leave request not found"}), 404
    
    # Only the user who applied can update
    if leave.user_id != current_user.id:
        return jsonify({"error": "Unauthorized"}), 403
    
    # Only pending leaves can be updated
    if leave.status != "pending":
        return jsonify({"error": f"Cannot update leave that is already {leave.status}"}), 400
    
    data = request.get_json() or {}
    leave_type_id = data.get("leaveTypeId")
    start_date_str = data.get("startDate")
    end_date_str = data.get("endDate")
    duration_type = (data.get("durationType") or leave.duration_type or "single_day").strip().lower()
    reason = data.get("reason", "").strip()
    attachment_filename = data.get("attachmentFileName")
    attachment_data = data.get("attachmentData")

    if not leave_type_id or not reason:
        return jsonify({"error": "Missing required fields"}), 400
    if duration_type in ("single_day", "half_day") and not start_date_str:
        return jsonify({"error": "startDate is required"}), 400
    if duration_type == "multiple_day" and not (start_date_str and end_date_str):
        return jsonify({"error": "startDate and endDate are required"}), 400

    raw_half = data.get("halfDayPeriod")
    if duration_type == "half_day" and (
        raw_half is None or (isinstance(raw_half, str) and not str(raw_half).strip())
    ):
        raw_half = leave.half_day_period

    try:
        start_date, end_date, total_leave_days = parse_leave_duration_and_dates(
            duration_type,
            start_date_str,
            end_date_str,
            current_user.id,
        )
        half_period = resolve_half_day_period(duration_type, raw_half)
    except ValueError as err:
        return jsonify({"error": str(err)}), 400

    conflicts = _leave_date_conflicts_for_user(
        current_user.id, start_date, end_date, leave.id
    )
    if conflicts:
        return (
            jsonify(
                {
                    "error": "Selected leave dates overlap with an existing leave request.",
                    "conflicts": _conflicts_json_payload(conflicts),
                }
            ),
            400,
        )

    req_dec = Decimal(str(total_leave_days))
    add_dec = _compute_additional_leave_days(
        current_user.id, leave_type_id, req_dec, leave.id
    )

    leave.leave_type_id = leave_type_id
    leave.start_date = start_date
    leave.end_date = end_date
    leave.duration_type = duration_type
    leave.total_leave_days = req_dec
    leave.additional_leave_days = add_dec
    leave.half_day_period = half_period
    leave.reason = reason
    if attachment_filename is not None:
        leave.attachment_filename = attachment_filename
    if attachment_data is not None:
        leave.attachment_data = attachment_data
    leave.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify(leave.to_dict()), 200
