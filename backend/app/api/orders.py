import json
from datetime import datetime, date
from flask import Blueprint, request, jsonify
from sqlalchemy import func
from app import db
from app.models import Order, Sale, Company, User, SalesStatusLog, StatusConfig
from app.auth_utils import require_auth
from app.rbac_utils import has_sales_module_access, has_full_sales_scope

orders_bp = Blueprint("orders", __name__)


def _normalize_status_key(value):
    if not value:
        return ""
    return "".join(c for c in value.lower() if c not in "_ -")


def _is_close_win_status(value):
    n = _normalize_status_key(value)
    return n in ("closedwon", "closewin")


def _parse_date(s):
    if not s:
        return None
    try:
        if "T" in s:
            return datetime.fromisoformat(s.replace("Z", "+00:00")).date()
        return date.fromisoformat(s)
    except Exception:
        return None


def _validate_attachments(raw):
    if raw in (None, ""):
        return []
    if not isinstance(raw, list):
        raise ValueError("attachments must be an array")
    validated = []
    for idx, item in enumerate(raw):
        if not isinstance(item, dict):
            raise ValueError(f"attachments[{idx}] must be an object")
        file_name = (item.get("fileName") or "").strip()
        data = item.get("data")
        if not file_name:
            raise ValueError(f"attachments[{idx}].fileName is required")
        if not isinstance(data, str) or not data.strip():
            raise ValueError(f"attachments[{idx}].data is required")
        if not data.startswith("data:"):
            raise ValueError(f"attachments[{idx}].data must be a data URL")
        validated.append({"fileName": file_name, "data": data})
    return validated


def _can_access_order(order: Order, current_user) -> bool:
    """Full Sales scope or global admin: all orders. Sales user scope: assignee or forwarded only."""
    if not current_user:
        return False
    uid = (getattr(current_user, "id", "") or "").strip()
    if not uid:
        return False
    if has_full_sales_scope(current_user):
        return True
    if not has_sales_module_access(current_user):
        return False
    # Sales RBAC user scope: only assigned or transferred
    return uid in {
        (order.assign_to_user_id or "").strip(),
        (order.forwarded_to_user_id or "").strip(),
    }


@orders_bp.route("", methods=["GET"])
@require_auth
def list_orders(current_user):
    if not has_sales_module_access(current_user):
        return jsonify({"error": "No access to Sales"}), 403
    is_full = has_full_sales_scope(current_user)
    company_id = request.args.get("companyId")
    sales_id = request.args.get("salesId")
    q = Order.query
    if company_id:
        q = q.filter(Order.company_id == company_id)
    if sales_id:
        q = q.filter(Order.sales_id == sales_id)

    if is_full:
        assign_to = (request.args.get("assignToUserId") or request.args.get("assignTo") or "").strip()
        if assign_to:
            q = q.filter(Order.assign_to_user_id == assign_to)
        status = (request.args.get("status") or "").strip()
        if status:
            q = q.filter(func.lower(Order.status) == func.lower(status))
        next_action = (request.args.get("nextAction") or "").strip()
        if next_action:
            if next_action == "__none__":
                q = q.filter((Order.next_action.is_(None)) | (Order.next_action == ""))
            else:
                q = q.filter(Order.next_action == next_action)
        dd_from = _parse_date(request.args.get("deliveryDateFrom"))
        dd_to = _parse_date(request.args.get("deliveryDateTo"))
        if dd_from:
            q = q.filter(Order.delivery_date >= dd_from)
        if dd_to:
            q = q.filter(Order.delivery_date <= dd_to)
        nd_from = _parse_date(request.args.get("nextActionDateFrom"))
        nd_to = _parse_date(request.args.get("nextActionDateTo"))
        if nd_from:
            q = q.filter(Order.next_action_date >= nd_from)
        if nd_to:
            q = q.filter(Order.next_action_date <= nd_to)
    else:
        status = (request.args.get("status") or "").strip()
        if status:
            q = q.filter(func.lower(Order.status) == func.lower(status))
        next_action = (request.args.get("nextAction") or "").strip()
        if next_action:
            if next_action == "__none__":
                q = q.filter((Order.next_action.is_(None)) | (Order.next_action == ""))
            else:
                q = q.filter(Order.next_action == next_action)
        nd_from = _parse_date(request.args.get("nextActionDateFrom"))
        nd_to = _parse_date(request.args.get("nextActionDateTo"))
        if nd_from:
            q = q.filter(Order.next_action_date >= nd_from)
        if nd_to:
            q = q.filter(Order.next_action_date <= nd_to)
        dd_from = _parse_date(request.args.get("deliveryDateFrom"))
        dd_to = _parse_date(request.args.get("deliveryDateTo"))
        if dd_from:
            q = q.filter(Order.delivery_date >= dd_from)
        if dd_to:
            q = q.filter(Order.delivery_date <= dd_to)

    rows = q.order_by(Order.created_at.desc()).all()
    if not is_full:
        rows = [row for row in rows if _can_access_order(row, current_user)]
    out = []
    for row in rows:
        payload = row.to_dict()
        try:
            payload["attachments"] = json.loads(payload.get("attachments") or "[]")
        except Exception:
            payload["attachments"] = []
        out.append(payload)
    return jsonify(out), 200


@orders_bp.route("", methods=["POST"])
@require_auth
def create_order(current_user):
    if not has_sales_module_access(current_user):
        return jsonify({"error": "No access to Sales"}), 403
    data = request.get_json() or {}
    company_id = (data.get("companyId") or "").strip()
    sales_id = (data.get("salesId") or "").strip()
    order_details = (data.get("orderDetails") or "").strip()
    assign_to = (data.get("assignTo") or "").strip()
    confirmation_date = _parse_date(data.get("orderConfirmationDate"))
    delivery_date = _parse_date(data.get("deliveryDate"))
    finalize_close_won = bool(data.get("finalizeCloseWon"))
    closed_won_status = (data.get("closedWonStatus") or "").strip()
    status_change_note = (data.get("statusChangeNote") or "").strip()
    changed_by_user_id = data.get("changedByUserId")

    if not company_id:
        return jsonify({"error": "companyId is required"}), 400
    if not sales_id:
        return jsonify({"error": "salesId is required"}), 400
    if not order_details:
        return jsonify({"error": "orderDetails is required"}), 400
    if data.get("revenue") in (None, ""):
        return jsonify({"error": "revenue is required"}), 400
    try:
        revenue = float(data.get("revenue"))
    except Exception:
        return jsonify({"error": "revenue must be numeric"}), 400
    if not confirmation_date:
        return jsonify({"error": "orderConfirmationDate is required"}), 400
    if not delivery_date:
        return jsonify({"error": "deliveryDate is required"}), 400
    if not assign_to:
        return jsonify({"error": "assignTo is required"}), 400

    sale = Sale.query.get(sales_id)
    if not sale:
        return jsonify({"error": "Sale not found"}), 404
    if sale.company_id != company_id:
        return jsonify({"error": "companyId does not match sale.companyId"}), 400
    company = Company.query.get(company_id)
    if not company:
        return jsonify({"error": "Company not found"}), 404
    if not has_full_sales_scope(current_user):
        if (company.kam_user_id or "") != current_user.id:
            return jsonify({"error": "Not allowed to create an order for this company"}), 403
    if not User.query.get(assign_to):
        return jsonify({"error": "Assigned user not found"}), 404

    if finalize_close_won:
        if _is_close_win_status(sale.status):
            return jsonify({"error": "This deal is already closed won"}), 400
        if not _is_close_win_status(closed_won_status):
            return jsonify({"error": "closedWonStatus must be a Closed Won / Close Win value"}), 400
    try:
        attachments = _validate_attachments(data.get("attachments"))
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    order = Order(
        company_id=company_id,
        sales_id=sales_id,
        order_details=order_details,
        revenue=revenue,
        order_confirmation_date=confirmation_date,
        delivery_date=delivery_date,
        assign_to_user_id=assign_to,
        attachments=json.dumps(attachments),
        status="pending",
        next_action="",
        next_action_date=None,
        created_by_user_id=current_user.id,
    )
    db.session.add(order)

    if finalize_close_won:
        old_status = sale.status
        sale.status = closed_won_status
        log_note = status_change_note or "Closed won (order created)"
        log = SalesStatusLog(
            sales_id=sale.id,
            from_status=old_status or "",
            to_status=closed_won_status,
            note=log_note,
            changed_by_user_id=changed_by_user_id,
        )
        db.session.add(log)

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e) or "Could not save order"}), 500

    order_payload = order.to_dict()
    order_payload["attachments"] = attachments

    if finalize_close_won:
        return jsonify({"order": order_payload, "sale": sale.to_dict()}), 201
    return jsonify(order_payload), 201


def _order_status_group_db():
    return "order_status"


def _is_allowed_order_status(value: str) -> bool:
    """Empty clears status; otherwise must match an active order_status row."""
    v = (value or "").strip()
    if not v:
        return True
    row = StatusConfig.query.filter_by(
        group=_order_status_group_db(),
        value=v.lower(),
        is_active=True,
    ).first()
    return row is not None


def _order_next_todo_group_db():
    return "order_next_todo"


def _is_allowed_order_next_todo(value: str) -> bool:
    """Empty clears next action; otherwise must match an active order_next_todo row."""
    v = (value or "").strip()
    if not v:
        return True
    row = StatusConfig.query.filter_by(
        group=_order_next_todo_group_db(),
        value=v.lower().replace(" ", "_"),
        is_active=True,
    ).first()
    return row is not None


def _normalize_order_next_todo_key(value) -> str:
    raw = value if isinstance(value, str) else str(value or "")
    return raw.strip().lower().replace(" ", "_")


@orders_bp.route("/<order_id>", methods=["PATCH"])
@require_auth
def patch_order(current_user, order_id):
    """Update order status / next to do / next action date (validated against Settings)."""
    if not has_sales_module_access(current_user):
        return jsonify({"error": "No access to Sales"}), 403
    data = request.get_json() or {}
    order = Order.query.get(order_id)
    if not order:
        return jsonify({"error": "Order not found"}), 404
    if not _can_access_order(order, current_user):
        return jsonify({"error": "You do not have access to this order"}), 403

    prev_next_norm = _normalize_order_next_todo_key(order.next_action)
    prev_action_date = order.next_action_date
    next_changed_nonempty = False

    if "status" in data:
        raw = data.get("status")
        if raw is None:
            return jsonify({"error": "status cannot be null"}), 400
        status_val = (raw if isinstance(raw, str) else str(raw)).strip().lower().replace(" ", "_")
        if not _is_allowed_order_status(status_val):
            return jsonify({"error": "Invalid or inactive order status"}), 400
        order.status = status_val

    if "nextAction" in data:
        raw = data.get("nextAction")
        if raw is None:
            return jsonify({"error": "nextAction cannot be null"}), 400
        na = _normalize_order_next_todo_key(raw)
        if not _is_allowed_order_next_todo(na):
            return jsonify({"error": "Invalid or inactive next to do option"}), 400
        if na != prev_next_norm and bool(na):
            next_changed_nonempty = True
        order.next_action = na

    if "nextActionDate" in data:
        raw = data.get("nextActionDate")
        if raw in (None, ""):
            order.next_action_date = None
        else:
            if not isinstance(raw, str):
                return jsonify({"error": "nextActionDate must be a string or null"}), 400
            d = _parse_date(raw)
            if not d:
                return jsonify({"error": "Invalid nextActionDate"}), 400
            order.next_action_date = d

    if "forwardedTo" in data:
        raw = data.get("forwardedTo")
        if raw in (None, ""):
            order.forwarded_to_user_id = None
        else:
            target_user_id = (raw if isinstance(raw, str) else str(raw)).strip()
            target_user = User.query.get(target_user_id)
            if not target_user:
                return jsonify({"error": "Forward target user not found"}), 400
            actor_id = (getattr(current_user, "id", "") or "").strip()
            can_forward = (
                has_full_sales_scope(current_user)
                or actor_id == (order.assign_to_user_id or "").strip()
                or actor_id == (order.forwarded_to_user_id or "").strip()
            )
            if not can_forward:
                return jsonify({"error": "Only assigned/forwarded user can forward this order"}), 403
            order.forwarded_to_user_id = target_user_id

    if next_changed_nonempty:
        if "nextActionDate" not in data:
            return jsonify({"error": "nextActionDate is required when changing next to do"}), 400
        if order.next_action_date is None:
            return jsonify({"error": "A due date is required when changing next to do"}), 400
        if order.next_action_date == prev_action_date:
            return jsonify({"error": "Choose a new due date when changing next to do"}), 400

    if (order.next_action or "").strip() and not order.next_action_date:
        return jsonify({"error": "Due date is required when next to do is set"}), 400

    order.updated_at = datetime.utcnow()
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e) or "Could not update order"}), 500

    payload = order.to_dict()
    try:
        payload["attachments"] = json.loads(payload.get("attachments") or "[]")
    except Exception:
        payload["attachments"] = []
    return jsonify(payload), 200
