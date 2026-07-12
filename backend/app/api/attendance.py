"""Attendance API: check-in, check-out, and get attendance records."""
from datetime import date, datetime, timedelta
from flask import Blueprint, request, jsonify
from app import db
from app.models import Attendance, User, HRInfo, Holiday
from app.auth_utils import (
    require_attendance_module_access,
    require_attendance_all_records_view,
    require_attendance_reconciliation_review,
    require_admin_or_hr_access,
)
from app.attendance_constants import DEFAULT_TIMEZONE_OFFSET
from app.utils.attendance_period import current_work_week_range, previous_work_week_range
from app.services.attendance_validation import (
    user_has_assigned_shift,
    shift_required_error_response,
)
from app.services.attendance_reconciliation_service import (
    late_reconciliation_hint,
    create_request,
    list_requests_for_applicant,
    list_requests_for_admin,
    review_request,
    reconciliation_to_api_dict,
    approved_reconciliation_id_by_attendance_ids,
    enrich_attendance_dict_with_reconciliation,
    enrich_attendance_rows,
)

attendance_bp = Blueprint("attendance", __name__)


def _merge_reconciliation_flags(payload: dict, attendance_id: str | None) -> dict:
    m = approved_reconciliation_id_by_attendance_ids([attendance_id] if attendance_id else [])
    return enrich_attendance_dict_with_reconciliation(payload, attendance_id, m)


def _attach_late_reconciliation(payload: dict, attendance) -> dict:
    if attendance and attendance.id:
        hint = late_reconciliation_hint(attendance)
        if hint:
            payload["lateReconciliation"] = hint
    return payload


@attendance_bp.route("/today", methods=["GET"])
@require_attendance_module_access
def get_today_attendance(current_user):
    """Get today's attendance for the current user."""
    today = date.today()
    has_shift = user_has_assigned_shift(current_user.id)
    attendance = Attendance.query.filter_by(
        user_id=current_user.id,
        date=today
    ).first()

    if attendance:
        payload = attendance.to_dict()
        _merge_reconciliation_flags(payload, attendance.id)
        payload["hasShiftAssigned"] = has_shift
        hr_info = HRInfo.query.filter_by(user_id=current_user.id).first()
        is_weekend = bool(
            hr_info
            and hr_info.shift
            and today.weekday() in hr_info.shift.weekend_days
        )
        is_holiday = (
            Holiday.query.filter(
                Holiday.start_date <= today,
                Holiday.end_date >= today,
            ).first()
            is not None
        )
        payload["isWeekend"] = is_weekend
        payload["isHoliday"] = is_holiday
        _attach_late_reconciliation(payload, attendance)
        return jsonify(payload), 200

    hr_info = HRInfo.query.filter_by(user_id=current_user.id).first()
    if not has_shift:
        return jsonify(
            _merge_reconciliation_flags(
                {
                    "id": None,
                    "userId": current_user.id,
                    "date": today.isoformat(),
                    "checkInTime": None,
                    "checkOutTime": None,
                    "checkInLocation": None,
                    "checkOutLocation": None,
                    "status": "no_shift",
                    "hasShiftAssigned": False,
                    "isWeekend": False,
                    "isHoliday": False,
                    "createdAt": None,
                    "updatedAt": None,
                },
                None,
            )
        ), 200

    is_weekend = False
    if hr_info and hr_info.shift:
        if today.weekday() in hr_info.shift.weekend_days:
            is_weekend = True

    is_holiday = (
        Holiday.query.filter(
            Holiday.start_date <= today,
            Holiday.end_date >= today,
        ).first()
        is not None
    )

    status = "absent"
    if is_weekend or is_holiday:
        status = "off_day"

    return jsonify(
        _merge_reconciliation_flags(
            {
                "id": None,
                "userId": current_user.id,
                "date": today.isoformat(),
                "checkInTime": None,
                "checkOutTime": None,
                "checkInLocation": None,
                "checkOutLocation": None,
                "status": status,
                "hasShiftAssigned": True,
                "isWeekend": is_weekend,
                "isHoliday": is_holiday,
                "createdAt": None,
                "updatedAt": None,
            },
            None,
        )
    ), 200


@attendance_bp.route("/check-in", methods=["POST"])
@require_attendance_module_access
def check_in(current_user):
    """Check in for today. Calculate status based on shift configuration."""
    today = date.today()
    now = datetime.utcnow()
    
    # Get data from request body
    data = request.get_json() or {}
    check_in_location = data.get("location", "").strip()
    
    if not check_in_location:
        return jsonify({"error": "Location is required for check-in"}), 400

    if not user_has_assigned_shift(current_user.id):
        return shift_required_error_response()

    hr_info = HRInfo.query.filter_by(user_id=current_user.id).first()
    shift = hr_info.shift if hr_info else None
    if not shift:
        return shift_required_error_response()

    if today.weekday() in shift.weekend_days:
        return jsonify({"error": "Today is a weekend for your shift"}), 400

    try:
        start_h, start_m = map(int, shift.start_time.split(":"))
        late_threshold_minutes = (start_h * 60 + start_m) + shift.grace_period
        late_hour = late_threshold_minutes // 60
        late_minute = late_threshold_minutes % 60
        late_count_time = f"{late_hour:02d}:{late_minute:02d}"
    except (ValueError, TypeError, AttributeError):
        late_count_time = shift.start_time

    # Parse late threshold
    try:
        late_hour, late_minute = map(int, late_count_time.split(":"))
    except (ValueError, AttributeError):
        late_hour, late_minute = 9, 15
    
    local_time = now + DEFAULT_TIMEZONE_OFFSET
    check_in_total_minutes = local_time.hour * 60 + local_time.minute
    late_threshold_total_minutes = late_hour * 60 + late_minute
    
    status = "late" if check_in_total_minutes > late_threshold_total_minutes else "present"
    
    # Check if already checked in today
    existing = Attendance.query.filter_by(
        user_id=current_user.id,
        date=today
    ).first()
    
    if existing:
        if existing.check_in_time:
            return jsonify({"error": "Already checked in today"}), 400
        existing.check_in_time = now
        existing.check_in_location = check_in_location
        existing.status = status
    else:
        existing = Attendance(
            user_id=current_user.id,
            date=today,
            check_in_time=now,
            check_in_location=check_in_location,
            status=status
        )
        db.session.add(existing)
    
    existing.updated_at = now
    db.session.commit()

    payload = existing.to_dict()
    _merge_reconciliation_flags(payload, existing.id)
    payload["hasShiftAssigned"] = True
    _attach_late_reconciliation(payload, existing)
    return jsonify(payload), 200


@attendance_bp.route("/check-out", methods=["POST"])
@require_attendance_module_access
def check_out(current_user):
    """Check out for today. Location is mandatory."""
    today = date.today()
    now = datetime.utcnow()
    
    # Get location from request body (mandatory for check-out)
    data = request.get_json() or {}
    check_out_location = data.get("location", "").strip()
    
    if not check_out_location:
        return jsonify({"error": "Location is required for check-out"}), 400

    if not user_has_assigned_shift(current_user.id):
        return shift_required_error_response()

    # Find today's attendance
    attendance = Attendance.query.filter_by(
        user_id=current_user.id,
        date=today
    ).first()
    
    if not attendance:
        return jsonify({"error": "Please check in first"}), 400
    
    if not attendance.check_in_time:
        return jsonify({"error": "Please check in first"}), 400
    
    if attendance.check_out_time:
        return jsonify({"error": "Already checked out today"}), 400
    
    attendance.check_out_time = now
    attendance.check_out_location = check_out_location
    attendance.updated_at = now
    db.session.commit()

    payload = attendance.to_dict()
    _merge_reconciliation_flags(payload, attendance.id)
    payload["hasShiftAssigned"] = user_has_assigned_shift(current_user.id)
    _attach_late_reconciliation(payload, attendance)
    return jsonify(payload), 200


@attendance_bp.route("/records", methods=["GET"])
@require_attendance_module_access
def get_attendance_records(current_user):
    """Get attendance records for the current user."""
    from datetime import timedelta
    
    period = request.args.get("period", "today")  # today, yesterday, week, last_week, month, last_month, year, last_year
    today = date.today()
    
    if period == "today":
        start_date = today
        end_date = today
    elif period == "yesterday":
        yesterday = today - timedelta(days=1)
        start_date = yesterday
        end_date = yesterday
    elif period == "week":
        start_date, end_date = current_work_week_range(today)
    elif period == "last_week":
        start_date, end_date = previous_work_week_range(today)
    elif period == "month":
        # Current month
        start_date = today.replace(day=1)
        end_date = today
    elif period == "last_month":
        # Last month
        if today.month == 1:
            start_date = date(today.year - 1, 12, 1)
            end_date = date(today.year - 1, 12, 31)
        else:
            start_date = date(today.year, today.month - 1, 1)
            if today.month - 1 in [1, 3, 5, 7, 8, 10, 12]:
                last_day = 31
            elif today.month - 1 in [4, 6, 9, 11]:
                last_day = 30
            else:  # February
                year = today.year
                if (year % 4 == 0 and year % 100 != 0) or (year % 400 == 0):
                    last_day = 29
                else:
                    last_day = 28
            end_date = date(today.year, today.month - 1, last_day)
    elif period == "year":
        # Current year
        start_date = date(today.year, 1, 1)
        end_date = today
    elif period == "last_year":
        # Last year
        start_date = date(today.year - 1, 1, 1)
        end_date = date(today.year - 1, 12, 31)
    else:
        start_date = today
        end_date = today
    
    # Ensure attendance records exist for this user for the period
    ensure_attendance_records_for_period(start_date, end_date, current_user.id)
    
    records = Attendance.query.filter(
        Attendance.user_id == current_user.id,
        Attendance.date >= start_date,
        Attendance.date <= end_date
    ).order_by(Attendance.date.desc()).all()
    
    return jsonify(enrich_attendance_rows(records)), 200


def ensure_attendance_records_for_period(start_date: date, end_date: date, user_id: str = None):
    """Ensure attendance records exist. Skip weekends (based on shift) and holidays."""
    now = datetime.utcnow()
    
    if user_id:
        users = User.query.filter(User.id == user_id, User.is_active == True).all()
    else:
        users = User.query.filter(User.is_active == True).all()
    
    holidays = Holiday.all_observed_dates()
    
    current_date = start_date
    dates_to_process = []
    while current_date <= end_date:
        dates_to_process.append(current_date)
        current_date = current_date + timedelta(days=1)
    
    records_created = 0
    for target_date in dates_to_process:
        is_holiday = target_date in holidays
        
        for user in users:
            hr_info = HRInfo.query.filter_by(user_id=user.id).first()
            if not hr_info or not hr_info.shift_id or not hr_info.shift:
                continue
            is_weekend = target_date.weekday() in hr_info.shift.weekend_days

            # Skip if it's a weekend or holiday
            if is_weekend or is_holiday:
                continue

            existing = Attendance.query.filter_by(
                user_id=user.id,
                date=target_date
            ).first()
            
            if not existing:
                absent_record = Attendance(
                    user_id=user.id,
                    date=target_date,
                    status="absent"
                )
                db.session.add(absent_record)
                records_created += 1
    
    if records_created > 0:
        db.session.commit()
    
    return records_created


@attendance_bp.route("/all", methods=["GET"])
@require_attendance_all_records_view
def get_all_attendance(current_user):
    """Admin only. Get attendance records for all users or filtered by user_id."""
    from datetime import timedelta
    
    period = request.args.get("period", "today")  # today, yesterday, week, last_week, month, last_month, year, last_year
    user_id = request.args.get("userId")  # Optional: filter by specific user
    today = date.today()
    
    if period == "today":
        start_date = today
        end_date = today
    elif period == "yesterday":
        yesterday = today - timedelta(days=1)
        start_date = yesterday
        end_date = yesterday
    elif period == "week":
        start_date, end_date = current_work_week_range(today)
    elif period == "last_week":
        start_date, end_date = previous_work_week_range(today)
    elif period == "month":
        # Current month
        start_date = today.replace(day=1)
        end_date = today
    elif period == "last_month":
        # Last month
        if today.month == 1:
            start_date = date(today.year - 1, 12, 1)
            # Last day of December
            end_date = date(today.year - 1, 12, 31)
        else:
            start_date = date(today.year, today.month - 1, 1)
            # Last day of previous month
            if today.month - 1 in [1, 3, 5, 7, 8, 10, 12]:
                last_day = 31
            elif today.month - 1 in [4, 6, 9, 11]:
                last_day = 30
            else:  # February
                # Check for leap year
                year = today.year
                if (year % 4 == 0 and year % 100 != 0) or (year % 400 == 0):
                    last_day = 29
                else:
                    last_day = 28
            end_date = date(today.year, today.month - 1, last_day)
    elif period == "year":
        # Current year
        start_date = date(today.year, 1, 1)
        end_date = today
    elif period == "last_year":
        # Last year
        start_date = date(today.year - 1, 1, 1)
        end_date = date(today.year - 1, 12, 31)
    else:
        start_date = today
        end_date = today
    
    # Ensure all employees have attendance records for the period
    ensure_attendance_records_for_period(start_date, end_date, user_id)
    
    # Query records strictly within the date range
    query = Attendance.query.filter(
        Attendance.date >= start_date,
        Attendance.date <= end_date
    )
    
    if user_id:
        query = query.filter(Attendance.user_id == user_id)
    
    # Order by date descending, then by user_id for consistent results
    records = query.order_by(Attendance.date.desc(), Attendance.user_id).all()
    
    # Additional validation: filter out any records that might be outside the period
    # (defensive programming in case of timezone or date calculation issues)
    filtered_records = [
        r for r in records 
        if r.date and r.date >= start_date and r.date <= end_date
    ]
    
    return jsonify(enrich_attendance_rows(filtered_records)), 200


@attendance_bp.route("/initialize-today", methods=["POST"])
@require_admin_or_hr_access
def initialize_today_attendance(current_user):
    """Admin only. Initialize attendance records for today for all active employees.
    Creates 'absent' records for employees who haven't checked in today.
    This can be called daily (e.g., via cron job) to ensure all employees have records."""
    today = date.today()
    records_created = ensure_attendance_records_for_period(today, today)
    
    return jsonify({
        "message": f"Initialized attendance records for today",
        "recordsCreated": records_created
    }), 200


def _parse_reconciliation_query_date(key: str) -> date | None:
    raw = (request.args.get(key) or "").strip()
    if not raw:
        return None
    try:
        return date.fromisoformat(raw[:10])
    except ValueError:
        return None


@attendance_bp.route("/reconciliations", methods=["GET"])
@require_attendance_module_access
def list_attendance_reconciliations(current_user):
    from app.services.rbac_service import is_page_scope_admin

    status = (request.args.get("status") or "").strip().lower()
    status_filter = status if status in ("pending", "approved", "rejected") else None
    if current_user.role == "admin" or is_page_scope_admin(current_user, "attendance"):
        user_id_filter = (request.args.get("userId") or "").strip() or None
        date_from = _parse_reconciliation_query_date("dateFrom")
        date_to = _parse_reconciliation_query_date("dateTo")
        if date_from and date_to and date_from > date_to:
            date_from, date_to = date_to, date_from
        items = list_requests_for_admin(
            status_filter,
            user_id=user_id_filter,
            date_from=date_from,
            date_to=date_to,
        )
    else:
        items = list_requests_for_applicant(current_user.id, status_filter)
    return jsonify(items), 200


@attendance_bp.route("/reconciliations", methods=["POST"])
@require_attendance_module_access
def create_attendance_reconciliation(current_user):
    data = request.get_json() or {}
    try:
        row = create_request(
            applicant=current_user,
            attendance_id=(data.get("attendanceId") or "").strip(),
            reason=(data.get("reason") or "").strip(),
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify(reconciliation_to_api_dict(row)), 201


@attendance_bp.route("/reconciliations/<req_id>/review", methods=["PATCH"])
@require_attendance_reconciliation_review
def review_attendance_reconciliation(current_user, req_id):
    data = request.get_json() or {}
    decision = (data.get("status") or "").strip().lower()
    try:
        row = review_request(
            reviewer=current_user,
            reconciliation_id=req_id,
            decision=decision,
            review_note=data.get("reviewNote"),
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify(reconciliation_to_api_dict(row)), 200
