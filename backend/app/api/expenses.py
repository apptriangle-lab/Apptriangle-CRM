"""Expenses API: list (page admin=all, page user=own), create, get, update, soft delete, bin, restore.

Payment status (paid/unpaid) may only be set or changed by users with Expenses admin scope (RBAC).
"""
from datetime import date, datetime
from flask import Blueprint, request, jsonify
from app import db
from app.models import Expense
from app.auth_utils import get_current_user
from app.services.rbac_service import ACCESS_NONE, ACCESS_ADMIN, get_effective_page_access

expenses_bp = Blueprint("expenses", __name__)

PAGE_KEY_EXPENSES = "expenses"


def _expenses_access(user) -> str:
    return get_effective_page_access(user, PAGE_KEY_EXPENSES)


def _is_expenses_admin(user) -> bool:
    return _expenses_access(user) == ACCESS_ADMIN


def _parse_date(s):
    if not s:
        return None
    try:
        if "T" in s:
            return datetime.fromisoformat(s.replace("Z", "+00:00")).date()
        return date.fromisoformat(s)
    except Exception:
        return None


def _active_expense_query():
    return Expense.query.filter(Expense.deleted_at.is_(None))


@expenses_bp.route("/bin", methods=["GET"])
def list_deleted_expenses():
    """Soft-deleted expenses (Settings Bin). Expenses admin scope: all. User scope: own only."""
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Authentication required"}), 401
    if _expenses_access(current_user) == ACCESS_NONE:
        return jsonify({"error": "No access to Expenses"}), 403
    q = Expense.query.filter(Expense.deleted_at.isnot(None))
    if not _is_expenses_admin(current_user):
        q = q.filter(Expense.created_by_user_id == current_user.id)
    expenses = q.order_by(Expense.deleted_at.desc(), Expense.date.desc()).all()
    return jsonify([e.to_dict() for e in expenses]), 200


@expenses_bp.route("/bulk-soft-delete", methods=["POST"])
def bulk_soft_delete_expenses():
    """Soft-delete multiple expenses. Expenses admin: any. User scope: own only."""
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Authentication required"}), 401
    if _expenses_access(current_user) == ACCESS_NONE:
        return jsonify({"error": "No access to Expenses"}), 403
    data = request.get_json() or {}
    raw_ids = data.get("ids")
    if not isinstance(raw_ids, list) or not raw_ids:
        return jsonify({"error": "ids must be a non-empty array of expense ids"}), 400
    ids = [str(x).strip() for x in raw_ids if str(x).strip()]
    if not ids:
        return jsonify({"error": "ids must be a non-empty array of expense ids"}), 400

    expenses = (
        _active_expense_query()
        .filter(Expense.id.in_(ids))
        .all()
    )
    now = datetime.utcnow()
    deleted_ids = []
    for expense in expenses:
        if not _is_expenses_admin(current_user) and expense.created_by_user_id != current_user.id:
            continue
        expense.deleted_at = now
        deleted_ids.append(expense.id)
    db.session.commit()
    return jsonify({"deletedIds": deleted_ids, "count": len(deleted_ids)}), 200


@expenses_bp.route("/restore", methods=["POST"])
def restore_expenses():
    """Restore soft-deleted expenses from bin. Expenses admin: any. User scope: own only."""
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Authentication required"}), 401
    if _expenses_access(current_user) == ACCESS_NONE:
        return jsonify({"error": "No access to Expenses"}), 403
    data = request.get_json() or {}
    raw_ids = data.get("ids")
    if not isinstance(raw_ids, list) or not raw_ids:
        return jsonify({"error": "ids must be a non-empty array of expense ids"}), 400
    ids = [str(x).strip() for x in raw_ids if str(x).strip()]
    if not ids:
        return jsonify({"error": "ids must be a non-empty array of expense ids"}), 400

    expenses = (
        Expense.query.filter(Expense.id.in_(ids), Expense.deleted_at.isnot(None))
        .all()
    )
    restored_ids = []
    for expense in expenses:
        if not _is_expenses_admin(current_user) and expense.created_by_user_id != current_user.id:
            continue
        expense.deleted_at = None
        restored_ids.append(expense.id)
    db.session.commit()
    return jsonify({"restoredIds": restored_ids, "count": len(restored_ids)}), 200


@expenses_bp.route("", methods=["GET"])
def list_expenses():
    """Expenses admin scope: all active. User scope: only their own active."""
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Authentication required"}), 401
    if _expenses_access(current_user) == ACCESS_NONE:
        return jsonify({"error": "No access to Expenses"}), 403
    q = _active_expense_query()
    if not _is_expenses_admin(current_user):
        q = q.filter(Expense.created_by_user_id == current_user.id)
    expenses = q.order_by(Expense.date.desc(), Expense.created_at.desc()).all()
    return jsonify([e.to_dict() for e in expenses]), 200


@expenses_bp.route("", methods=["POST"])
def create_expense():
    """Create expense. createdByUserId set from current user."""
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Authentication required"}), 401
    if _expenses_access(current_user) == ACCESS_NONE:
        return jsonify({"error": "No access to Expenses"}), 403
    data = request.get_json() or {}
    company_id = data.get("companyId")
    exp_date = _parse_date(data.get("date"))
    amount_val = data.get("amount")
    purpose_notes = (data.get("purpose") or "").strip()[:500]
    purpose_id = (data.get("purposeId") or "").strip() or None
    from_location = (data.get("fromLocation") or "").strip()[:200]
    to_location = (data.get("toLocation") or "").strip()[:200]
    if not from_location:
        return jsonify({"error": "fromLocation is required"}), 400
    if not to_location:
        return jsonify({"error": "toLocation is required"}), 400
    trip_type = (data.get("tripType") or "single_trip").strip()
    if trip_type not in ("single_trip", "round_trip"):
        trip_type = "single_trip"

    if not company_id:
        return jsonify({"error": "companyId is required"}), 400
    if not exp_date:
        return jsonify({"error": "date is required"}), 400
    try:
        amount = float(amount_val) if amount_val is not None else 0
    except (TypeError, ValueError):
        return jsonify({"error": "amount must be a number"}), 400
    if amount < 0:
        return jsonify({"error": "amount must be >= 0"}), 400

    amount_return = None
    if trip_type == "round_trip":
        try:
            amount_return = float(data.get("amountReturn")) if data.get("amountReturn") is not None else 0
        except (TypeError, ValueError):
            amount_return = 0
        if amount_return < 0:
            amount_return = 0

    # Only Expenses admin scope may set paid on create; user scope always starts as unpaid.
    initial_status = "unpaid"
    if _is_expenses_admin(current_user):
        s = (data.get("status") or "unpaid").strip()
        if s in ("unpaid", "paid"):
            initial_status = s

    expense = Expense(
        company_id=company_id,
        date=exp_date,
        amount=amount,
        amount_return=amount_return if trip_type == "round_trip" else None,
        from_location=from_location,
        to_location=to_location,
        purpose_id=purpose_id,
        purpose=purpose_notes,
        trip_type=trip_type,
        created_by_user_id=current_user.id,
        status=initial_status,
        deleted_at=None,
    )
    db.session.add(expense)
    db.session.commit()
    return jsonify(expense.to_dict()), 201


@expenses_bp.route("/<expense_id>", methods=["GET"])
def get_expense(expense_id):
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Authentication required"}), 401
    if _expenses_access(current_user) == ACCESS_NONE:
        return jsonify({"error": "No access to Expenses"}), 403
    expense = Expense.query.get(expense_id)
    if not expense or expense.deleted_at is not None:
        return jsonify({"error": "Expense not found"}), 404
    if not _is_expenses_admin(current_user) and expense.created_by_user_id != current_user.id:
        return jsonify({"error": "Not allowed to view this expense"}), 403
    return jsonify(expense.to_dict()), 200


@expenses_bp.route("/<expense_id>", methods=["PUT", "PATCH"])
def update_expense(expense_id):
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Authentication required"}), 401
    if _expenses_access(current_user) == ACCESS_NONE:
        return jsonify({"error": "No access to Expenses"}), 403
    expense = Expense.query.get(expense_id)
    if not expense or expense.deleted_at is not None:
        return jsonify({"error": "Expense not found"}), 404
    if not _is_expenses_admin(current_user) and expense.created_by_user_id != current_user.id:
        return jsonify({"error": "Not allowed to update this expense"}), 403

    data = request.get_json() or {}
    if "status" in data:
        if not _is_expenses_admin(current_user):
            return (
                jsonify({"error": "Only Expenses admin access can change expense status"}),
                403,
            )
        s = (data.get("status") or "").strip()
        if s in ("unpaid", "paid"):
            expense.status = s
    if "companyId" in data and data["companyId"]:
        expense.company_id = data["companyId"]
    if "date" in data:
        d = _parse_date(data["date"])
        if d:
            expense.date = d
    if "amount" in data:
        try:
            expense.amount = float(data["amount"]) if data["amount"] is not None else 0
        except (TypeError, ValueError):
            pass
    if "tripType" in data:
        t = (data.get("tripType") or "").strip()
        if t in ("single_trip", "round_trip"):
            expense.trip_type = t
            if t == "single_trip":
                expense.amount_return = None
    if "amountReturn" in data:
        if expense.trip_type == "round_trip":
            try:
                expense.amount_return = float(data["amountReturn"]) if data["amountReturn"] is not None else 0
                if expense.amount_return < 0:
                    expense.amount_return = 0
            except (TypeError, ValueError):
                pass
        else:
            expense.amount_return = None
    if "purposeId" in data:
        pid = (data.get("purposeId") or "").strip() or None
        expense.purpose_id = pid
    if "purpose" in data:
        expense.purpose = (data["purpose"] or "").strip()[:500]
    if "fromLocation" in data:
        expense.from_location = (data["fromLocation"] or "").strip()[:200]
    if "toLocation" in data:
        expense.to_location = (data["toLocation"] or "").strip()[:200]

    if not (expense.from_location or "").strip():
        return jsonify({"error": "fromLocation is required"}), 400
    if not (expense.to_location or "").strip():
        return jsonify({"error": "toLocation is required"}), 400

    db.session.commit()
    return jsonify(expense.to_dict()), 200


@expenses_bp.route("/<expense_id>", methods=["DELETE"])
def delete_expense(expense_id):
    """Soft-delete a single expense (moves to bin)."""
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Authentication required"}), 401
    if _expenses_access(current_user) == ACCESS_NONE:
        return jsonify({"error": "No access to Expenses"}), 403
    expense = Expense.query.get(expense_id)
    if not expense or expense.deleted_at is not None:
        return jsonify({"error": "Expense not found"}), 404
    if not _is_expenses_admin(current_user) and expense.created_by_user_id != current_user.id:
        return jsonify({"error": "Not allowed to delete this expense"}), 403
    expense.deleted_at = datetime.utcnow()
    db.session.commit()
    return jsonify({"ok": True}), 200
