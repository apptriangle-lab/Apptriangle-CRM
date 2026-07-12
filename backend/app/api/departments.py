"""Departments API: list, create, update, delete. Global admin or HR module access."""
from flask import Blueprint, request, jsonify
from sqlalchemy import func
from app import db
from app.models import Department
from app.auth_utils import require_admin_or_hr_access

departments_bp = Blueprint("departments", __name__)


@departments_bp.route("", methods=["GET"])
def list_departments():
    """List all departments, sorted by sort_order then name. No auth required for read."""
    departments = Department.query.order_by(Department.sort_order, Department.name).all()
    return jsonify([d.to_dict() for d in departments]), 200


@departments_bp.route("", methods=["POST"])
@require_admin_or_hr_access
def create_department(current_user):
    """Admin only. Create a department. Body: { name }."""
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()

    if not name:
        return jsonify({"error": "name is required"}), 400

    existing = Department.query.filter_by(name=name).first()
    if existing:
        return jsonify({"error": "Department with this name already exists"}), 409

    max_order = db.session.query(func.max(Department.sort_order)).scalar() or 0
    department = Department(name=name, sort_order=max_order + 1)
    db.session.add(department)
    db.session.commit()
    return jsonify(department.to_dict()), 201


@departments_bp.route("/<department_id>", methods=["PUT", "PATCH"])
@require_admin_or_hr_access
def update_department(department_id, current_user):
    """Admin only. Update a department. Body: { name?, isActive? }."""
    department = Department.query.get(department_id)
    if not department:
        return jsonify({"error": "Department not found"}), 404

    data = request.get_json() or {}
    if "name" in data:
        name = (data.get("name") or "").strip()
        if not name:
            return jsonify({"error": "name cannot be empty"}), 400
        existing = Department.query.filter_by(name=name).filter(Department.id != department_id).first()
        if existing:
            return jsonify({"error": "Department with this name already exists"}), 409
        department.name = name
    if "isActive" in data:
        department.is_active = bool(data.get("isActive"))

    db.session.commit()
    return jsonify(department.to_dict()), 200


@departments_bp.route("/<department_id>", methods=["DELETE"])
@require_admin_or_hr_access
def delete_department(department_id, current_user):
    """Admin only. Delete a department."""
    department = Department.query.get(department_id)
    if not department:
        return jsonify({"error": "Department not found"}), 404

    db.session.delete(department)
    db.session.commit()
    return jsonify({"ok": True}), 200
