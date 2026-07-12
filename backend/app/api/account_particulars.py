"""Account particulars API: list (filter by type), create, update, delete (admin for write)."""
from flask import Blueprint, request, jsonify
from app import db
from app.models import AccountParticular
from app.auth_utils import get_current_user, require_admin_or_accounts_access

account_particulars_bp = Blueprint("account_particulars", __name__)


@account_particulars_bp.route("", methods=["GET"])
def list_account_particulars():
    """List all particulars, or filter by ?type=received|expense. Ordered by sort_order, name."""
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Authentication required"}), 401
    q = AccountParticular.query
    typ = (request.args.get("type") or "").strip().lower()
    if typ in ("received", "expense"):
        q = q.filter(AccountParticular.type == typ)
    particulars = q.order_by(AccountParticular.sort_order.asc(), AccountParticular.name.asc()).all()
    return jsonify([p.to_dict() for p in particulars]), 200


@account_particulars_bp.route("", methods=["POST"])
@require_admin_or_accounts_access
def create_account_particular(current_user):
    """Admin only. Body: name, type (received|expense), sortOrder (optional)."""
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()[:200]
    typ = (data.get("type") or "received").strip().lower()
    if typ not in ("received", "expense"):
        typ = "received"
    sort_order = data.get("sortOrder")
    if isinstance(sort_order, (int, float)):
        sort_order = int(sort_order)
    else:
        sort_order = None

    if not name:
        return jsonify({"error": "name is required"}), 400

    if sort_order is None:
        max_order = db.session.query(db.func.max(AccountParticular.sort_order)).filter(
            AccountParticular.type == typ
        ).scalar() or 0
        sort_order = max_order + 1

    particular = AccountParticular(name=name, type=typ, sort_order=sort_order)
    db.session.add(particular)
    db.session.commit()
    return jsonify(particular.to_dict()), 201


@account_particulars_bp.route("/<particular_id>", methods=["GET"])
def get_account_particular(particular_id):
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Authentication required"}), 401
    particular = AccountParticular.query.get(particular_id)
    if not particular:
        return jsonify({"error": "Particular not found"}), 404
    return jsonify(particular.to_dict()), 200


@account_particulars_bp.route("/<particular_id>", methods=["PUT", "PATCH"])
@require_admin_or_accounts_access
def update_account_particular(particular_id, current_user):
    """Admin only. Body: name, type, sortOrder (optional)."""
    particular = AccountParticular.query.get(particular_id)
    if not particular:
        return jsonify({"error": "Particular not found"}), 404

    data = request.get_json() or {}
    if "name" in data:
        name = (data.get("name") or "").strip()[:200]
        if name:
            particular.name = name
    if "type" in data:
        t = (data.get("type") or "received").strip().lower()
        if t in ("received", "expense"):
            particular.type = t
    if "sortOrder" in data:
        so = data.get("sortOrder")
        if isinstance(so, (int, float)):
            particular.sort_order = int(so)

    db.session.commit()
    return jsonify(particular.to_dict()), 200


@account_particulars_bp.route("/<particular_id>", methods=["DELETE"])
@require_admin_or_accounts_access
def delete_account_particular(particular_id, current_user):
    particular = AccountParticular.query.get(particular_id)
    if not particular:
        return jsonify({"error": "Particular not found"}), 404
    db.session.delete(particular)
    db.session.commit()
    return jsonify({"ok": True}), 200
