"""Attendance business rules: shift assignment is mandatory for check-in/out."""
from flask import jsonify

from app.models import HRInfo

SHIFT_REQUIRED_MSG = (
    "You are not assigned to any shift. Please contact admin."
)


def user_has_assigned_shift(user_id: str) -> bool:
    """True if HR row exists and references a valid Shift."""
    hr = HRInfo.query.filter_by(user_id=user_id).first()
    if not hr or not hr.shift_id:
        return False
    return hr.shift is not None


def shift_required_error_response():
    """Standard 422 payload when attendance is blocked (no shift)."""
    return jsonify({"error": SHIFT_REQUIRED_MSG}), 422
