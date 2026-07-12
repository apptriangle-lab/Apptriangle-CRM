"""PMS project types — Settings-managed lookup for project creation."""
from flask import Blueprint, jsonify, request
from sqlalchemy import func

from app import db
from app.auth_utils import require_admin, require_auth
from app.pms_models import PmsProject, PmsProjectType
from app.pms_permissions import has_pms_module_access

pms_project_types_bp = Blueprint("pms_project_types", __name__)


@pms_project_types_bp.route("", methods=["GET"])
@require_auth
def list_project_types(current_user):
    """Active project types for PMS users (create modal dropdown)."""
    if not has_pms_module_access(current_user):
        return jsonify({"error": "Forbidden"}), 403
    rows = (
        PmsProjectType.query.filter_by(is_active=True)
        .order_by(PmsProjectType.sort_order, PmsProjectType.name)
        .all()
    )
    return jsonify([r.to_dict() for r in rows]), 200


@pms_project_types_bp.route("/all", methods=["GET"])
@require_admin
def list_all_project_types(current_user):
    """All project types for Settings (admin)."""
    rows = PmsProjectType.query.order_by(
        PmsProjectType.sort_order, PmsProjectType.name
    ).all()
    return jsonify([r.to_dict() for r in rows]), 200


@pms_project_types_bp.route("", methods=["POST"])
@require_admin
def create_project_type(current_user):
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400
    if PmsProjectType.query.filter_by(name=name).first():
        return jsonify({"error": "Project type with this name already exists"}), 409

    max_order = db.session.query(func.max(PmsProjectType.sort_order)).scalar() or 0
    row = PmsProjectType(name=name, sort_order=max_order + 1)
    db.session.add(row)
    db.session.commit()
    return jsonify(row.to_dict()), 201


@pms_project_types_bp.route("/<project_type_id>", methods=["PUT", "PATCH"])
@require_admin
def update_project_type(project_type_id, current_user):
    row = PmsProjectType.query.get(project_type_id)
    if not row:
        return jsonify({"error": "Project type not found"}), 404

    data = request.get_json() or {}
    if "name" in data:
        name = (data.get("name") or "").strip()
        if not name:
            return jsonify({"error": "name cannot be empty"}), 400
        existing = (
            PmsProjectType.query.filter_by(name=name)
            .filter(PmsProjectType.id != project_type_id)
            .first()
        )
        if existing:
            return jsonify({"error": "Project type with this name already exists"}), 409
        row.name = name
    if "isActive" in data:
        row.is_active = bool(data.get("isActive"))

    db.session.commit()
    return jsonify(row.to_dict()), 200


@pms_project_types_bp.route("/<project_type_id>", methods=["DELETE"])
@require_admin
def delete_project_type(project_type_id, current_user):
    row = PmsProjectType.query.get(project_type_id)
    if not row:
        return jsonify({"error": "Project type not found"}), 404

    in_use = PmsProject.query.filter_by(project_type_id=project_type_id, deleted_at=None).count()
    if in_use:
        return jsonify({"error": "Cannot delete: project type is used by existing projects"}), 409

    db.session.delete(row)
    db.session.commit()
    return jsonify({"ok": True}), 200
