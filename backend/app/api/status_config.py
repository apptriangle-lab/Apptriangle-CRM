"""Status config API: task, sales, order options. GET is public; POST/PATCH/DELETE require admin."""
from flask import Blueprint, request, jsonify
from app import db
from app.models import StatusConfig
from app.auth_utils import require_admin

status_config_bp = Blueprint("status_config", __name__)

GROUP_MAP = {
    "taskStatuses": "task_status",
    "pmsTaskStatuses": "pms_task_status",
    "salesCategories": "sales_category",
    "salesStatuses": "sales_status",
    "orderStatuses": "order_status",
    "orderNextTodos": "order_next_todo",
}
REVERSE_MAP = {v: k for k, v in GROUP_MAP.items()}
ORDER_GROUP_DB = "order_status"
ORDER_NEXT_TODO_GROUP_DB = "order_next_todo"
# Groups where deleting the last row is allowed (unlike task/sales lists).
ORDER_OPTION_GROUPS_DB = frozenset({ORDER_GROUP_DB, ORDER_NEXT_TODO_GROUP_DB})

PATCHABLE_ORDER_GROUPS = {
    "orderStatuses": ORDER_GROUP_DB,
    "orderNextTodos": ORDER_NEXT_TODO_GROUP_DB,
}


def _build_response():
    """String lists for task/sales; orderStatuses and orderNextTodos as {value, isActive}[]."""
    rows = StatusConfig.query.order_by(StatusConfig.group, StatusConfig.sort_order, StatusConfig.value).all()
    out = {
        "taskStatuses": [],
        "pmsTaskStatuses": [],
        "salesCategories": [],
        "salesStatuses": [],
        "orderStatuses": [],
        "orderNextTodos": [],
    }
    for r in rows:
        if not r.value:
            continue
        if r.group == ORDER_GROUP_DB:
            out["orderStatuses"].append({"value": r.value, "isActive": bool(getattr(r, "is_active", True))})
            continue
        if r.group == ORDER_NEXT_TODO_GROUP_DB:
            out["orderNextTodos"].append({"value": r.value, "isActive": bool(getattr(r, "is_active", True))})
            continue
        key = REVERSE_MAP.get(r.group)
        if key:
            out[key].append(r.value)
    return out


@status_config_bp.route("", methods=["GET"])
def get_config():
    return jsonify(_build_response()), 200


@status_config_bp.route("", methods=["POST"])
@require_admin
def add_status(current_user):
    data = request.get_json() or {}
    group_key = (data.get("group") or "").strip()
    value = (data.get("value") or "").strip().lower().replace(" ", "_")

    if group_key not in GROUP_MAP:
        return jsonify({"error": "Invalid group"}), 400
    if not value:
        return jsonify({"error": "value is required"}), 400

    group_db = GROUP_MAP[group_key]
    existing = StatusConfig.query.filter_by(group=group_db, value=value).first()
    if existing:
        return jsonify({"error": "This status already exists"}), 409

    max_order = db.session.query(db.func.max(StatusConfig.sort_order)).filter_by(group=group_db).scalar() or 0
    row = StatusConfig(group=group_db, value=value, sort_order=max_order + 1, is_active=True)
    db.session.add(row)
    db.session.commit()
    return jsonify(_build_response()), 200


@status_config_bp.route("", methods=["PATCH"])
@require_admin
def patch_status(current_user):
    """Toggle isActive for orderStatuses or orderNextTodos. Body: { group, value, isActive }."""
    data = request.get_json() or {}
    group_key = (data.get("group") or "").strip()
    value = (data.get("value") or "").strip()
    if group_key not in PATCHABLE_ORDER_GROUPS:
        return jsonify({"error": "PATCH supports orderStatuses and orderNextTodos only"}), 400
    if not value:
        return jsonify({"error": "value is required"}), 400
    if "isActive" not in data:
        return jsonify({"error": "isActive is required"}), 400

    group_db = PATCHABLE_ORDER_GROUPS[group_key]
    row = StatusConfig.query.filter_by(group=group_db, value=value).first()
    if not row:
        return jsonify({"error": "Item not found"}), 404
    row.is_active = bool(data.get("isActive"))
    db.session.commit()
    return jsonify(_build_response()), 200


@status_config_bp.route("", methods=["DELETE"])
@require_admin
def remove_status(current_user):
    data = request.get_json() or {}
    group_key = (data.get("group") or "").strip()
    value = (data.get("value") or "").strip()

    if group_key not in GROUP_MAP:
        return jsonify({"error": "Invalid group"}), 400
    if not value:
        return jsonify({"error": "value is required"}), 400

    group_db = GROUP_MAP[group_key]
    row = StatusConfig.query.filter_by(group=group_db, value=value).first()
    if not row:
        return jsonify({"error": "Status not found"}), 404

    count = StatusConfig.query.filter_by(group=group_db).count()
    if group_db not in ORDER_OPTION_GROUPS_DB and count <= 1:
        return jsonify({"error": "Must have at least one status in this group"}), 400

    db.session.delete(row)
    db.session.commit()
    return jsonify(_build_response()), 200
