"""Employee types API: list, create, update, delete. Global admin or HR module access."""
from flask import Blueprint, request, jsonify
from sqlalchemy import func
from app import db
from app.models import EmployeeType
from app.auth_utils import require_admin_or_hr_access

employee_types_bp = Blueprint("employee_types", __name__)


@employee_types_bp.route("", methods=["GET"])
def list_employee_types():
    """List all employee types, sorted by sort_order then name."""
    rows = EmployeeType.query.order_by(EmployeeType.sort_order, EmployeeType.name).all()
    return jsonify([r.to_dict() for r in rows]), 200


@employee_types_bp.route("", methods=["POST"])
@require_admin_or_hr_access
def create_employee_type(current_user):
    """Admin only. Create an employee type. Body: { name }."""
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()

    if not name:
        return jsonify({"error": "name is required"}), 400

    existing = EmployeeType.query.filter_by(name=name).first()
    if existing:
        return jsonify({"error": "Employee type with this name already exists"}), 409

    max_order = db.session.query(func.max(EmployeeType.sort_order)).scalar() or 0
    row = EmployeeType(name=name, sort_order=max_order + 1)
    db.session.add(row)
    db.session.commit()
    return jsonify(row.to_dict()), 201


@employee_types_bp.route("/<employee_type_id>", methods=["PUT", "PATCH"])
@require_admin_or_hr_access
def update_employee_type(employee_type_id, current_user):
    """Admin only. Update an employee type. Body: { name?, isActive? }."""
    row = EmployeeType.query.get(employee_type_id)
    if not row:
        return jsonify({"error": "Employee type not found"}), 404

    data = request.get_json() or {}
    if "name" in data:
        name = (data.get("name") or "").strip()
        if not name:
            return jsonify({"error": "name cannot be empty"}), 400
        existing = (
            EmployeeType.query.filter_by(name=name)
            .filter(EmployeeType.id != employee_type_id)
            .first()
        )
        if existing:
            return jsonify({"error": "Employee type with this name already exists"}), 409
        row.name = name
    if "isActive" in data:
        row.is_active = bool(data.get("isActive"))

    db.session.commit()
    return jsonify(row.to_dict()), 200


@employee_types_bp.route("/<employee_type_id>", methods=["DELETE"])
@require_admin_or_hr_access
def delete_employee_type(employee_type_id, current_user):
    """Admin only. Delete an employee type."""
    row = EmployeeType.query.get(employee_type_id)
    if not row:
        return jsonify({"error": "Employee type not found"}), 404

    db.session.delete(row)
    db.session.commit()
    return jsonify({"ok": True}), 200
