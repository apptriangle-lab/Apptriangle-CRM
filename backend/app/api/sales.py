"""Sales (funnel) API. RBAC `sales` admin = all deals; `sales` user = KAM-scoped. Companies RBAC admin may create/view deals on any company (same listing scope as sales admin)."""
from datetime import datetime, date
from flask import Blueprint, request, jsonify
from sqlalchemy import func
from app import db
from app.models import Sale, SalesStatusLog, SalesActivity, Company
from app.auth_utils import get_current_user
from app.rbac_utils import (
    has_sales_module_access,
    has_full_sales_scope,
    has_companies_page_admin_scope,
)

sales_bp = Blueprint("sales", __name__)


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


def _user_can_access_sale(current_user, sale: Sale) -> bool:
    if not has_sales_module_access(current_user):
        return False
    if has_full_sales_scope(current_user):
        return True
    if has_companies_page_admin_scope(current_user):
        return True
    company = Company.query.get(sale.company_id)
    return bool(company and (company.kam_user_id or "") == current_user.id)


def _user_can_access_company_as_kam(current_user, company_id: str) -> bool:
    if not has_sales_module_access(current_user):
        return False
    if has_full_sales_scope(current_user):
        return True
    if has_companies_page_admin_scope(current_user):
        return bool(Company.query.get(company_id))
    company = Company.query.get(company_id)
    return bool(company and (company.kam_user_id or "") == current_user.id)


@sales_bp.route("", methods=["GET"])
def list_sales():
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Authentication required"}), 401
    if not has_sales_module_access(current_user):
        return jsonify({"error": "No access to Sales"}), 403
    status = request.args.get("status")
    company_id = request.args.get("companyId")
    category = request.args.get("category")
    created_by = request.args.get("createdByUserId")
    search = (request.args.get("search") or "").strip()
    q = Sale.query
    if not has_full_sales_scope(current_user) and not has_companies_page_admin_scope(current_user):
        q = q.join(Company, Sale.company_id == Company.id).filter(Company.kam_user_id == current_user.id)
    if status:
        q = q.filter(Sale.status == status)
    if company_id:
        q = q.filter(Sale.company_id == company_id)
    if category:
        q = q.filter(Sale.category == category)
    if created_by:
        q = q.filter(Sale.created_by_user_id == created_by)
    if search:
        q = q.filter(func.lower(Sale.prospect).like(f"%{search.lower()}%"))
    sales = q.order_by(Sale.created_at.desc()).all()
    return jsonify([s.to_dict() for s in sales]), 200


@sales_bp.route("", methods=["POST"])
def create_sale():
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Authentication required"}), 401
    if not has_sales_module_access(current_user):
        return jsonify({"error": "No access to Sales"}), 403
    data = request.get_json() or {}
    company_id = data.get("companyId")
    prospect = (data.get("prospect") or "").strip()
    closing = _parse_date(data.get("expectedClosingDate"))
    if not company_id:
        return jsonify({"error": "companyId is required"}), 400
    if not prospect:
        return jsonify({"error": "prospect is required"}), 400
    if not closing:
        return jsonify({"error": "expectedClosingDate is required"}), 400
    if not _user_can_access_company_as_kam(current_user, company_id):
        return jsonify({"error": "Not allowed to create a deal for this company"}), 403
    sale = Sale(
        company_id=company_id,
        category=data.get("category") or "cold",
        prospect=prospect,
        expected_closing_date=closing,
        expected_revenue=float(data.get("expectedRevenue") or 0),
        status=data.get("status") or "lead",
        next_action=(data.get("nextAction") or "").strip(),
        next_action_date=_parse_date(data.get("nextActionDate")),
        created_by_user_id=current_user.id,
    )
    db.session.add(sale)
    db.session.commit()
    return jsonify(sale.to_dict()), 201


@sales_bp.route("/<sale_id>", methods=["GET"])
def get_sale(sale_id):
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Authentication required"}), 401
    sale = Sale.query.get(sale_id)
    if not sale:
        return jsonify({"error": "Sale not found"}), 404
    if not _user_can_access_sale(current_user, sale):
        return jsonify({"error": "Not allowed to view this deal"}), 403
    return jsonify(sale.to_dict()), 200


@sales_bp.route("/<sale_id>", methods=["PUT", "PATCH"])
def update_sale(sale_id):
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Authentication required"}), 401
    sale = Sale.query.get(sale_id)
    if not sale:
        return jsonify({"error": "Sale not found"}), 404
    if not _user_can_access_sale(current_user, sale):
        return jsonify({"error": "Not allowed to update this deal"}), 403
    data = request.get_json() or {}
    if "companyId" in data:
        new_cid = data["companyId"] or sale.company_id
        if new_cid != sale.company_id and not _user_can_access_company_as_kam(current_user, new_cid):
            return jsonify({"error": "Not allowed to move this deal to that company"}), 403
    if "prospect" in data:
        sale.prospect = (data["prospect"] or "").strip() or sale.prospect
    if "companyId" in data:
        sale.company_id = data["companyId"] or sale.company_id
    if "category" in data:
        sale.category = data["category"] or sale.category
    if "expectedClosingDate" in data:
        d = _parse_date(data["expectedClosingDate"])
        if d:
            sale.expected_closing_date = d
    if "expectedRevenue" in data:
        sale.expected_revenue = float(data["expectedRevenue"] or 0)
    if "nextAction" in data:
        sale.next_action = (data.get("nextAction") or "").strip()
    if "nextActionDate" in data:
        sale.next_action_date = _parse_date(data.get("nextActionDate"))
    db.session.commit()
    return jsonify(sale.to_dict()), 200


@sales_bp.route("/<sale_id>/status", methods=["PATCH"])
def change_sale_status(sale_id):
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Authentication required"}), 401
    sale = Sale.query.get(sale_id)
    if not sale:
        return jsonify({"error": "Sale not found"}), 404
    if not _user_can_access_sale(current_user, sale):
        return jsonify({"error": "Not allowed to change this deal"}), 403
    data = request.get_json() or {}
    new_status = (data.get("status") or "").strip()
    note = (data.get("note") or "").strip()
    changed_by = data.get("changedByUserId") or current_user.id
    if not new_status:
        return jsonify({"error": "status is required"}), 400
    if _is_close_win_status(sale.status):
        return jsonify({"error": "This deal is closed won and status cannot be changed"}), 400
    if _is_close_win_status(new_status):
        return jsonify(
            {
                "error": "Closed Won can only be applied after creating an order from the deal page",
            }
        ), 400
    old_status = sale.status
    sale.status = new_status
    log = SalesStatusLog(
        sales_id=sale.id,
        from_status=old_status,
        to_status=new_status,
        note=note or "Status changed",
        changed_by_user_id=changed_by,
    )
    db.session.add(log)
    db.session.commit()
    return jsonify(sale.to_dict()), 200


@sales_bp.route("/<sale_id>/logs", methods=["GET"])
def get_sale_logs(sale_id):
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Authentication required"}), 401
    sale = Sale.query.get(sale_id)
    if not sale:
        return jsonify({"error": "Sale not found"}), 404
    if not _user_can_access_sale(current_user, sale):
        return jsonify({"error": "Not allowed"}), 403
    logs = SalesStatusLog.query.filter_by(sales_id=sale_id).order_by(
        SalesStatusLog.changed_at.desc()
    ).all()
    return jsonify([l.to_dict() for l in logs]), 200


@sales_bp.route("/<sale_id>/activities", methods=["GET"])
def list_activities(sale_id):
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Authentication required"}), 401
    sale = Sale.query.get(sale_id)
    if not sale:
        return jsonify({"error": "Sale not found"}), 404
    if not _user_can_access_sale(current_user, sale):
        return jsonify({"error": "Not allowed"}), 403
    activities = SalesActivity.query.filter_by(sales_id=sale_id).order_by(
        SalesActivity.date.desc()
    ).all()
    return jsonify([a.to_dict() for a in activities]), 200


@sales_bp.route("/<sale_id>/activities", methods=["POST"])
def create_activity(sale_id):
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Authentication required"}), 401
    sale = Sale.query.get(sale_id)
    if not sale:
        return jsonify({"error": "Sale not found"}), 404
    if not _user_can_access_sale(current_user, sale):
        return jsonify({"error": "Not allowed"}), 403
    data = request.get_json() or {}
    title = (data.get("title") or "").strip()
    note = (data.get("note") or "").strip()
    act_date = _parse_date(data.get("date"))
    if not title:
        return jsonify({"error": "title is required"}), 400
    if not act_date:
        return jsonify({"error": "date is required"}), 400
    activity = SalesActivity(
        sales_id=sale_id,
        title=title,
        note=note or "",
        date=act_date,
        created_by_user_id=current_user.id,
    )
    db.session.add(activity)
    db.session.commit()
    return jsonify(activity.to_dict()), 201


@sales_bp.route("/<sale_id>/activities/<activity_id>", methods=["PUT", "PATCH"])
def update_activity(sale_id, activity_id):
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Authentication required"}), 401
    sale = Sale.query.get(sale_id)
    if not sale or not _user_can_access_sale(current_user, sale):
        return jsonify({"error": "Not allowed"}), 403
    activity = SalesActivity.query.filter_by(id=activity_id, sales_id=sale_id).first()
    if not activity:
        return jsonify({"error": "Activity not found"}), 404
    data = request.get_json() or {}
    if "title" in data:
        activity.title = (data["title"] or "").strip() or activity.title
    if "note" in data:
        activity.note = data["note"] or ""
    if "date" in data:
        d = _parse_date(data["date"])
        if d:
            activity.date = d
    db.session.commit()
    return jsonify(activity.to_dict()), 200


@sales_bp.route("/<sale_id>/activities/<activity_id>", methods=["DELETE"])
def delete_activity(sale_id, activity_id):
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Authentication required"}), 401
    sale = Sale.query.get(sale_id)
    if not sale or not _user_can_access_sale(current_user, sale):
        return jsonify({"error": "Not allowed"}), 403
    activity = SalesActivity.query.filter_by(id=activity_id, sales_id=sale_id).first()
    if not activity:
        return jsonify({"error": "Activity not found"}), 404
    db.session.delete(activity)
    db.session.commit()
    return jsonify({"ok": True}), 200


@sales_bp.route("/<sale_id>", methods=["DELETE"])
def delete_sale(sale_id):
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Authentication required"}), 401
    if not has_full_sales_scope(current_user):
        return jsonify({"error": "Only Sales administrators can delete deals"}), 403
    sale = Sale.query.get(sale_id)
    if not sale:
        return jsonify({"error": "Sale not found"}), 404
    SalesStatusLog.query.filter_by(sales_id=sale_id).delete()
    SalesActivity.query.filter_by(sales_id=sale_id).delete()
    db.session.delete(sale)
    db.session.commit()
    return jsonify({"ok": True}), 200
