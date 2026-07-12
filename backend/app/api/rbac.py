"""RBAC API — thin controllers; logic in rbac_service."""
from flask import Blueprint, jsonify, request

from app.auth_utils import get_current_user, require_admin
from app.models import User
from app.page_keys import PAGE_KEYS, PAGE_LABELS
from app.services import rbac_service

rbac_bp = Blueprint("rbac", __name__)


@rbac_bp.route("/pages", methods=["GET"])
def list_page_definitions():
    """Canonical module list for clients (no hardcoding in UI)."""
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Authentication required"}), 401
    pages = [{"pageKey": k, "label": PAGE_LABELS.get(k, k)} for k in PAGE_KEYS]
    return jsonify({"pages": pages}), 200


@rbac_bp.route("/me", methods=["GET"])
def get_my_effective_rbac():
    """effective map + navPageKeys (all modules for global admin; explicit RBAC rows for standard users)."""
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Authentication required"}), 401
    return jsonify(
        {
            "effective": rbac_service.get_effective_permissions_map(current_user),
            "navPageKeys": rbac_service.get_nav_page_keys_for_user(current_user),
        }
    ), 200


@rbac_bp.route("/assignment-matrix", methods=["GET"])
@require_admin
def get_assignment_matrix_route(current_user):
    """Module × (Admin | User) grid: explicit per-user assignments only."""
    return jsonify(rbac_service.get_assignment_matrix()), 200


@rbac_bp.route("/assignments", methods=["POST"])
@require_admin
def post_user_assignment(current_user):
    """
    Assign a user to a module with admin or user scope (upserts user_page_permissions).
    Body: { \"userId\", \"pageKey\", \"accessType\": \"admin\" | \"user\" }
    """
    data = request.get_json() or {}
    user_id = (data.get("userId") or "").strip()
    page_key = (data.get("pageKey") or "").strip()
    access_type = (data.get("accessType") or "").strip()
    if not user_id:
        return jsonify({"error": "userId is required"}), 400
    if not User.query.get(user_id):
        return jsonify({"error": "User not found"}), 404
    if access_type not in (rbac_service.ACCESS_ADMIN, rbac_service.ACCESS_USER):
        return jsonify({"error": "accessType must be admin or user"}), 400
    try:
        rbac_service.upsert_user_permissions(
            user_id,
            [{"pageKey": page_key, "accessType": access_type}],
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify(rbac_service.get_assignment_matrix()), 200


@rbac_bp.route("/assignments/batch", methods=["POST"])
@require_admin
def post_user_assignments_batch(current_user):
    """
    Assign multiple users to one module with the same scope.
    Body: { \"userIds\": [\"...\"], \"pageKey\", \"accessType\": \"admin\" | \"user\" }
    """
    data = request.get_json() or {}
    user_ids = data.get("userIds")
    page_key = (data.get("pageKey") or "").strip()
    access_type = (data.get("accessType") or "").strip()
    if not isinstance(user_ids, list):
        return jsonify({"error": "userIds must be an array"}), 400
    try:
        rbac_service.batch_assign_users_same_page(user_ids, page_key, access_type)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify(rbac_service.get_assignment_matrix()), 200


@rbac_bp.route("/role-defaults", methods=["GET"])
@require_admin
def get_role_defaults_bundle(current_user):
    """pages + default matrix for global roles admin / user (Settings RBAC tab)."""
    pages = [{"pageKey": k, "label": PAGE_LABELS.get(k, k)} for k in PAGE_KEYS]
    matrix = rbac_service.get_role_defaults_matrix()
    return jsonify({"pages": pages, "matrix": matrix}), 200


@rbac_bp.route("/role-defaults", methods=["PUT"])
@require_admin
def put_role_defaults_bundle(current_user):
    """Body: { \"matrix\": { \"admin\": [{pageKey, accessType}, ...], \"user\": [...] } }"""
    data = request.get_json() or {}
    matrix = data.get("matrix")
    if not isinstance(matrix, dict):
        return jsonify({"error": "matrix must be an object"}), 400
    try:
        for role in rbac_service.SYSTEM_ROLES:
            items = matrix.get(role)
            if items is None:
                continue
            if not isinstance(items, list):
                return jsonify({"error": f"matrix.{role} must be an array"}), 400
            rbac_service.upsert_role_defaults(role, items)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    out_pages = [{"pageKey": k, "label": PAGE_LABELS.get(k, k)} for k in PAGE_KEYS]
    return jsonify({"pages": out_pages, "matrix": rbac_service.get_role_defaults_matrix()}), 200


@rbac_bp.route("/users/<user_id>", methods=["GET"])
@require_admin
def get_user_rbac(user_id, current_user):
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify(rbac_service.get_rbac_summary_for_user(user)), 200


@rbac_bp.route("/users/<user_id>", methods=["PUT"])
@require_admin
def put_user_rbac(user_id, current_user):
    """Upsert per-user overrides: { \"permissions\": [{ pageKey, accessType }, ...] }"""
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    data = request.get_json() or {}
    items = data.get("permissions")
    if not isinstance(items, list):
        return jsonify({"error": "permissions must be an array"}), 400
    try:
        rbac_service.upsert_user_permissions(user_id, items)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify(rbac_service.get_rbac_summary_for_user(user)), 200


@rbac_bp.route("/users/<user_id>/pages/<page_key>", methods=["DELETE"])
@require_admin
def delete_user_page_rbac(user_id, page_key, current_user):
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    try:
        deleted = rbac_service.delete_explicit_user_permission(user_id, page_key)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify({"ok": True, "deleted": deleted}), 200
