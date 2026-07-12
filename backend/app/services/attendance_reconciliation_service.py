"""Business logic for late attendance reconciliation requests."""
from __future__ import annotations

import re
from datetime import date, datetime

from app import db
from app.attendance_constants import DEFAULT_TIMEZONE_OFFSET
from app.models import Attendance, AttendanceReconciliation, User

STATUS_PENDING = "pending"
STATUS_APPROVED = "approved"
STATUS_REJECTED = "rejected"
BLOCKING_STATUSES = (STATUS_PENDING, STATUS_APPROVED)

_HHMM_RE = re.compile(r"^\d{1,2}:\d{2}$")


def normalize_hhmm(value: str) -> str:
    s = (value or "").strip()
    if not _HHMM_RE.match(s):
        raise ValueError("checkInTime must be HH:MM (24h)")
    h_str, m_str = s.split(":", 1)
    h, m = int(h_str), int(m_str)
    if h < 0 or h > 23 or m < 0 or m > 59:
        raise ValueError("Invalid check-in time")
    return f"{h:02d}:{m:02d}"


def recorded_check_in_local_hhmm(att: Attendance) -> str:
    """Local HH:MM for the stored check-in (UTC in DB → business local)."""
    dt = att.check_in_time
    if not dt:
        raise ValueError("Invalid attendance record")
    local = dt + DEFAULT_TIMEZONE_OFFSET
    return f"{local.hour:02d}:{local.minute:02d}"


def has_blocking_reconciliation(attendance_id: str) -> bool:
    q = (
        AttendanceReconciliation.query.filter_by(attendance_id=attendance_id)
        .filter(AttendanceReconciliation.status.in_(BLOCKING_STATUSES))
        .first()
    )
    return q is not None


def get_pending_request_id_for_attendance(attendance_id: str) -> str | None:
    row = AttendanceReconciliation.query.filter_by(
        attendance_id=attendance_id, status=STATUS_PENDING
    ).first()
    return row.id if row else None


def approved_reconciliation_id_by_attendance_ids(attendance_ids: list[str]) -> dict[str, str]:
    """Map attendance_id -> approved reconciliation request id (audit trail)."""
    ids = [i for i in attendance_ids if i]
    if not ids:
        return {}
    rows = (
        AttendanceReconciliation.query.filter(
            AttendanceReconciliation.attendance_id.in_(ids),
            AttendanceReconciliation.status == STATUS_APPROVED,
        ).all()
    )
    return {r.attendance_id: r.id for r in rows}


def enrich_attendance_dict_with_reconciliation(d: dict, attendance_id: str | None, approved_map: dict[str, str]) -> dict:
    if not attendance_id:
        d["reconciliationApproved"] = False
        d["reconciliationRequestId"] = None
        return d
    rid = approved_map.get(attendance_id)
    d["reconciliationApproved"] = rid is not None
    d["reconciliationRequestId"] = rid
    return d


def enrich_attendance_rows(rows: list) -> list[dict]:
    """ORM Attendance rows -> API dicts with reconciliation flags (batch query)."""
    ids = [r.id for r in rows if getattr(r, "id", None)]
    approved_map = approved_reconciliation_id_by_attendance_ids(ids)
    out = []
    for r in rows:
        d = r.to_dict()
        enrich_attendance_dict_with_reconciliation(d, r.id, approved_map)
        out.append(d)
    return out


def late_reconciliation_hint(attendance: Attendance | None) -> dict | None:
    """Payload fragment for GET /attendance/today when user is late."""
    if not attendance or not attendance.id or attendance.status != "late":
        return None
    blocked = has_blocking_reconciliation(attendance.id)
    return {
        "canSubmit": not blocked,
        "attendanceId": attendance.id,
        "pendingRequestId": get_pending_request_id_for_attendance(attendance.id),
    }


def create_request(
    *,
    applicant: User,
    attendance_id: str,
    reason: str,
) -> AttendanceReconciliation:
    reason = (reason or "").strip()
    if len(reason) < 3:
        raise ValueError("Reason must be at least 3 characters")

    att = Attendance.query.get(attendance_id)
    if not att:
        raise ValueError("Attendance record not found")
    if att.user_id != applicant.id:
        raise ValueError("You can only reconcile your own attendance")
    if att.status != "late":
        raise ValueError("Reconciliation applies to late attendance only")
    if not att.check_in_time:
        raise ValueError("Invalid attendance record")

    ad = att.date
    hhmm = normalize_hhmm(recorded_check_in_local_hhmm(att))

    if has_blocking_reconciliation(attendance_id):
        raise ValueError("A pending or approved reconciliation already exists for this attendance")

    row = AttendanceReconciliation(
        attendance_id=attendance_id,
        user_id=applicant.id,
        attendance_date=ad,
        requested_check_in_time=hhmm,
        reason=reason,
        applicant_note="",
        status=STATUS_PENDING,
    )
    db.session.add(row)
    db.session.commit()
    return row


def reconciliation_to_api_dict(row: AttendanceReconciliation) -> dict:
    d = row.to_dict()
    applicant = row.applicant
    d["requesterName"] = applicant.name if applicant else ""
    d["requesterEmail"] = applicant.email if applicant else ""
    reviewer = row.reviewed_by
    d["reviewedByName"] = reviewer.name if reviewer else None
    return d


def list_requests_for_applicant(user_id: str, status: str | None = None) -> list[dict]:
    q = AttendanceReconciliation.query.filter_by(user_id=user_id)
    if status and status in (STATUS_PENDING, STATUS_APPROVED, STATUS_REJECTED):
        q = q.filter_by(status=status)
    rows = q.order_by(AttendanceReconciliation.created_at.desc()).all()
    return [reconciliation_to_api_dict(r) for r in rows]


def list_requests_for_admin(
    status: str | None = None,
    *,
    user_id: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[dict]:
    q = AttendanceReconciliation.query
    if status and status in (*BLOCKING_STATUSES, STATUS_REJECTED):
        q = q.filter_by(status=status)
    if user_id:
        q = q.filter_by(user_id=user_id)
    if date_from is not None:
        q = q.filter(AttendanceReconciliation.attendance_date >= date_from)
    if date_to is not None:
        q = q.filter(AttendanceReconciliation.attendance_date <= date_to)
    rows = q.order_by(AttendanceReconciliation.created_at.desc()).all()
    return [reconciliation_to_api_dict(r) for r in rows]


def review_request(
    *,
    reviewer: User,
    reconciliation_id: str,
    decision: str,
    review_note: str | None,
) -> AttendanceReconciliation:
    decision = (decision or "").strip().lower()
    if decision not in (STATUS_APPROVED, STATUS_REJECTED):
        raise ValueError("decision must be approved or rejected")

    row = AttendanceReconciliation.query.get(reconciliation_id)
    if not row:
        raise ValueError("Request not found")
    if row.status != STATUS_PENDING:
        raise ValueError("Request is no longer pending")

    note = (review_note or "").strip()
    now = datetime.utcnow()

    if decision == STATUS_APPROVED:
        att = Attendance.query.get(row.attendance_id)
        if not att:
            raise ValueError("Attendance record missing")
        # Status only: actual check-in timestamp is unchanged.
        att.status = "present"
        att.updated_at = now

    row.status = decision
    row.reviewed_by_user_id = reviewer.id
    row.reviewed_at = now
    row.review_note = note
    row.updated_at = now
    db.session.commit()
    return row
