"""Expense purposes API: list (any auth), create, update, delete (admin only)."""
from flask import Blueprint, request, jsonify
from app import db
from app.models import ExpensePurpose
from app.auth_utils import get_current_user, require_admin

expense_purposes_bp = Blueprint("expense_purposes", __name__)


@expense_purposes_bp.route("", methods=["GET"])
def list_expense_purposes():
    """Return all expense purposes, ordered by sort_order then name."""
    purposes = ExpensePurpose.query.order_by(ExpensePurpose.sort_order.asc(), ExpensePurpose.name.asc()).all()
    return jsonify([p.to_dict() for p in purposes]), 200


@expense_purposes_bp.route("", methods=["POST"])
@require_admin
def create_expense_purpose(current_user):
    """Admin only. Body: name, sortOrder (optional)."""
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    sort_order = data.get("sortOrder")
    if isinstance(sort_order, (int, float)):
        sort_order = int(sort_order)
    else:
        sort_order = None

    if not name:
        return jsonify({"error": "name is required"}), 400

    if sort_order is None:
        max_order = db.session.query(db.func.max(ExpensePurpose.sort_order)).scalar() or 0
        sort_order = max_order + 1

    is_active = data.get("isActive")
    if is_active is None:
        is_active = True
    else:
        is_active = bool(is_active)

    purpose = ExpensePurpose(name=name, sort_order=sort_order, is_active=is_active)
    db.session.add(purpose)
    db.session.commit()
    return jsonify(purpose.to_dict()), 201


@expense_purposes_bp.route("/<purpose_id>", methods=["GET"])
def get_expense_purpose(purpose_id):
    purpose = ExpensePurpose.query.get(purpose_id)
    if not purpose:
        return jsonify({"error": "Expense purpose not found"}), 404
    return jsonify(purpose.to_dict()), 200


@expense_purposes_bp.route("/<purpose_id>", methods=["PUT", "PATCH"])
@require_admin
def update_expense_purpose(purpose_id, current_user):
    """Admin only. Body: name, sortOrder (optional)."""
    purpose = ExpensePurpose.query.get(purpose_id)
    if not purpose:
        return jsonify({"error": "Expense purpose not found"}), 404

    data = request.get_json() or {}
    if "name" in data:
        name = (data.get("name") or "").strip()
        if name:
            purpose.name = name
    if "sortOrder" in data:
        so = data.get("sortOrder")
        if isinstance(so, (int, float)):
            purpose.sort_order = int(so)
    if "isActive" in data:
        purpose.is_active = bool(data.get("isActive"))

    db.session.commit()
    return jsonify(purpose.to_dict()), 200


@expense_purposes_bp.route("/<purpose_id>", methods=["DELETE"])
@require_admin
def delete_expense_purpose(purpose_id, current_user):
    purpose = ExpensePurpose.query.get(purpose_id)
    if not purpose:
        return jsonify({"error": "Expense purpose not found"}), 404
    db.session.delete(purpose)
    db.session.commit()
    return jsonify({"ok": True}), 200
