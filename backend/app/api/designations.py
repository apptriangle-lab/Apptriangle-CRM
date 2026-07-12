"""Designations API: list, create, update, delete. Global admin or HR module access."""
from flask import Blueprint, request, jsonify
from sqlalchemy import func
from app import db
from app.models import Designation
from app.auth_utils import require_admin_or_hr_access

designations_bp = Blueprint("designations", __name__)


@designations_bp.route("", methods=["GET"])
def list_designations():
    """List all designations, sorted by sort_order then name. No auth required for read."""
    designations = Designation.query.order_by(Designation.sort_order, Designation.name).all()
    return jsonify([d.to_dict() for d in designations]), 200


@designations_bp.route("", methods=["POST"])
@require_admin_or_hr_access
def create_designation(current_user):
    """Admin only. Create a designation. Body: { name }."""
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()

    if not name:
        return jsonify({"error": "name is required"}), 400

    existing = Designation.query.filter_by(name=name).first()
    if existing:
        return jsonify({"error": "Designation with this name already exists"}), 409

    max_order = db.session.query(func.max(Designation.sort_order)).scalar() or 0
    designation = Designation(name=name, sort_order=max_order + 1)
    db.session.add(designation)
    db.session.commit()
    return jsonify(designation.to_dict()), 201


@designations_bp.route("/<designation_id>", methods=["PUT", "PATCH"])
@require_admin_or_hr_access
def update_designation(designation_id, current_user):
    """Admin only. Update a designation. Body: { name?, isActive? }."""
    designation = Designation.query.get(designation_id)
    if not designation:
        return jsonify({"error": "Designation not found"}), 404

    data = request.get_json() or {}
    if "name" in data:
        name = (data.get("name") or "").strip()
        if not name:
            return jsonify({"error": "name cannot be empty"}), 400
        existing = Designation.query.filter_by(name=name).filter(Designation.id != designation_id).first()
        if existing:
            return jsonify({"error": "Designation with this name already exists"}), 409
        designation.name = name
    if "isActive" in data:
        designation.is_active = bool(data.get("isActive"))

    db.session.commit()
    return jsonify(designation.to_dict()), 200


@designations_bp.route("/<designation_id>", methods=["DELETE"])
@require_admin_or_hr_access
def delete_designation(designation_id, current_user):
    """Admin only. Delete a designation."""
    designation = Designation.query.get(designation_id)
    if not designation:
        return jsonify({"error": "Designation not found"}), 404

    db.session.delete(designation)
    db.session.commit()
    return jsonify({"ok": True}), 200
