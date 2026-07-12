"""RFQ (Request for Quotation) — draft → RBAC pricing → system approval; reject → reapplied → pricing again."""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from flask import Blueprint, jsonify, request
from sqlalchemy import and_, func, or_

from app import db
from app.auth_utils import get_current_user
from app.models import (
    Company,
    HRInfo,
    RFQ,
    RFQItem,
    RfqInvoiceHistory,
    RfqPricingHistory,
    Sale,
    User,
    UserPagePermission,
)
from app.services import rbac_service
from app.rbac_utils import (
    can_rfq_pricing_input,
    has_rfq_module_access,
    has_sales_module_access,
    has_full_sales_scope,
    is_global_system_admin,
)

rfq_bp = Blueprint("rfq", __name__)


def _json_error(msg: str, code: int = 400):
    return jsonify({"error": msg}), code


def _user_can_access_sale(user: User | None, sale: Sale) -> bool:
    if not user or not has_sales_module_access(user):
        return False
    if has_full_sales_scope(user):
        return True
    company = Company.query.get(sale.company_id)
    return bool(company and (company.kam_user_id or "") == user.id)


def _conflicting_rfq_for_sale(sales_id: str, exclude_rfq_id: str | None) -> RFQ | None:
    """Return an RFQ that already uses this sale, unless it is ``exclude_rfq_id`` (same record)."""
    r = RFQ.query.filter_by(sales_id=sales_id).first()
    if not r:
        return None
    if exclude_rfq_id and r.id == exclude_rfq_id:
        return None
    return r


def _deal_option_dict(s: Sale, c: Company | None, exclude_rfq_id: str | None) -> dict[str, Any]:
    conflict = _conflicting_rfq_for_sale(s.id, exclude_rfq_id)
    return {
        "salesId": s.id,
        "prospect": s.prospect,
        "companyId": s.company_id,
        "companyName": c.name if c else "",
        "hasExistingRfq": conflict is not None,
        "existingRfqId": conflict.id if conflict else None,
    }


def _item_to_dict(it: RFQItem) -> dict[str, Any]:
    return {
        "id": it.id,
        "lineNo": it.line_no,
        "description": it.description or "",
        "quantity": float(it.quantity) if it.quantity is not None else 0,
        "unitBuyingPrice": float(it.unit_buying_price) if it.unit_buying_price is not None else None,
        "profitPerUnit": float(it.profit_per_unit) if it.profit_per_unit is not None else None,
        "unitSellingPrice": float(it.unit_selling_price) if it.unit_selling_price is not None else None,
        "totalProfit": float(it.total_profit) if it.total_profit is not None else None,
        "lineNote": it.line_note or "",
        "vatPercent": float(it.vat_percent) if it.vat_percent is not None else None,
    }


def _user_mini(u: User | None) -> dict[str, Any]:
    if not u:
        return {"id": "", "name": "", "email": ""}
    return {"id": u.id, "name": u.name or "", "email": u.email or ""}


def _hr_profile_picture_for_user_id(user_id: str) -> str | None:
    hr = HRInfo.query.filter_by(user_id=user_id).first()
    if not hr or not hr.profile_picture:
        return None
    s = str(hr.profile_picture).strip()
    return s or None


def _user_mini_with_profile(u: User | None) -> dict[str, Any]:
    if not u:
        return {"id": "", "name": "", "email": "", "profilePicture": ""}
    pic = _hr_profile_picture_for_user_id(u.id)
    return {"id": u.id, "name": u.name or "", "email": u.email or "", "profilePicture": pic or ""}


def _is_explicit_rfq_rbac_admin(u: User | None) -> bool:
    """User has explicit UserPagePermission: rfq + admin (matrix Admin column)."""
    if not u or not getattr(u, "is_active", True):
        return False
    row = UserPagePermission.query.filter_by(
        user_id=u.id,
        page_key="rfq",
        access_type=rbac_service.ACCESS_ADMIN,
    ).first()
    return row is not None


def _can_act_as_pricing_on_rfq(user: User, rfq: RFQ) -> bool:
    if not can_rfq_pricing_input(user):
        return False
    if is_global_system_admin(user):
        return True
    aid = rfq.pricing_assignee_user_id
    if aid:
        return user.id == aid
    return True


def _can_patch_rfq_pricing(user: User, rfq: RFQ) -> bool:
    """Who may PATCH pricing fields (line prices, VAT, notes) in this RFQ state — used by PATCH handler."""
    _pricing_draft_after_submit = (
        rfq.status == "draft"
        and rfq.submitted_at is not None
        and _can_act_as_pricing_on_rfq(user, rfq)
    )
    return (
        (rfq.status in ("pending_rbac", "reapplied") and _can_act_as_pricing_on_rfq(user, rfq))
        or (rfq.status == "pending_system" and is_global_system_admin(user))
        or _pricing_draft_after_submit
    )


def _is_creator_request_items_payload(raw_items: Any) -> bool:
    """Full line replacement like draft/new RFQ: rows must not include id (pricing PATCH uses ids)."""
    if not isinstance(raw_items, list) or len(raw_items) == 0:
        return False
    for row in raw_items:
        if not isinstance(row, dict):
            return False
        if (row.get("id") or "").strip():
            return False
    return True


def _rfq_to_dict(rfq: RFQ, *, include_items: bool = True) -> dict[str, Any]:
    sale = Sale.query.get(rfq.sales_id)
    company = Company.query.get(rfq.company_id)
    creator = User.query.get(rfq.created_by_user_id)
    assignee = User.query.get(rfq.pricing_assignee_user_id) if rfq.pricing_assignee_user_id else None
    out: dict[str, Any] = {
        "id": rfq.id,
        "salesId": rfq.sales_id,
        "companyId": rfq.company_id,
        "status": rfq.status,
        "notesOverall": rfq.notes_overall or "",
        "rejectionReason": rfq.rejection_reason or "",
        "createdByUserId": rfq.created_by_user_id,
        "createdBy": _user_mini(creator),
        "pricingAssigneeUserId": rfq.pricing_assignee_user_id or "",
        "pricingAssignee": _user_mini_with_profile(assignee),
        "submittedAt": rfq.submitted_at.isoformat() + "Z" if rfq.submitted_at else None,
        "pricingSubmittedAt": rfq.pricing_submitted_at.isoformat() + "Z" if rfq.pricing_submitted_at else None,
        "resolvedAt": rfq.resolved_at.isoformat() + "Z" if rfq.resolved_at else None,
        "approvedByUserId": rfq.approved_by_user_id or "",
        "rejectedByUserId": rfq.rejected_by_user_id or "",
        "createdAt": rfq.created_at.isoformat() + "Z" if rfq.created_at else None,
        "updatedAt": rfq.updated_at.isoformat() + "Z" if rfq.updated_at else None,
        "deal": {
            "id": sale.id if sale else "",
            "prospect": sale.prospect if sale else "",
            "status": sale.status if sale else "",
        }
        if sale
        else None,
        "customer": {"id": company.id, "name": company.name} if company else {"id": "", "name": ""},
        "vatPercent": float(rfq.vat_percent) if rfq.vat_percent is not None else None,
        "versionNumber": int(getattr(rfq, "version_number", None) or 1),
    }
    if include_items:
        items = sorted(rfq.items, key=lambda x: x.line_no) if rfq.items else []
        out["items"] = [_item_to_dict(i) for i in items]
    return out


def _invoice_totals_from_rfq(rfq: RFQ) -> tuple[float, float, float, float]:
    """Subtotal, VAT amount, grand total, effective VAT % (for display when rates vary per line)."""
    items = sorted(rfq.items, key=lambda x: x.line_no) if rfq.items else []
    sub = 0.0
    vat_amt = 0.0
    default_vat = float(rfq.vat_percent) if rfq.vat_percent is not None else 0.0
    for it in items:
        sell = float(it.unit_selling_price or 0)
        qty = float(it.quantity or 0)
        ext = sell * qty
        sub += ext
        line_v = getattr(it, "vat_percent", None)
        pct = float(line_v) if line_v is not None else default_vat
        vat_amt += ext * (pct / 100.0)
    total = sub + vat_amt
    eff_pct = (vat_amt / sub * 100.0) if sub > 0 else default_vat
    return sub, vat_amt, total, eff_pct


def _can_reopen_rfq(user: User, rfq: RFQ) -> bool:
    if rfq.status != "approved":
        return False
    if rfq.created_by_user_id == user.id:
        return True
    if is_global_system_admin(user):
        return True
    return _is_explicit_rfq_rbac_admin(user)


def _apply_pricing_math(it: RFQItem) -> None:
    qty = float(it.quantity) if it.quantity else 0
    buy = it.unit_buying_price
    prof = it.profit_per_unit
    sell = it.unit_selling_price
    if buy is not None and prof is not None:
        it.unit_selling_price = float(buy) + float(prof)
        it.total_profit = float(prof) * qty
    elif buy is not None and sell is not None:
        it.profit_per_unit = float(sell) - float(buy)
        it.total_profit = (float(sell) - float(buy)) * qty


@rfq_bp.route("/deals", methods=["GET"])
def search_deals():
    """Searchable deals (sales) for RFQ dropdown."""
    current_user = get_current_user()
    if not current_user:
        return _json_error("Authentication required", 401)
    if not has_rfq_module_access(current_user) or not has_sales_module_access(current_user):
        return _json_error("No access", 403)

    exclude_rfq_id = (request.args.get("excludeRfqId") or "").strip() or None

    sales_id = (request.args.get("salesId") or "").strip()
    if sales_id:
        s = Sale.query.get(sales_id)
        if not s or not _user_can_access_sale(current_user, s):
            return jsonify([]), 200
        c = Company.query.get(s.company_id)
        return jsonify([_deal_option_dict(s, c, exclude_rfq_id)]), 200

    q = (request.args.get("q") or "").strip()
    query = Sale.query
    if not has_full_sales_scope(current_user):
        query = query.join(Company, Sale.company_id == Company.id).filter(Company.kam_user_id == current_user.id)
    if q:
        query = query.filter(func.lower(Sale.prospect).like(f"%{q.lower()}%"))
    sales = query.order_by(Sale.created_at.desc()).limit(50).all()
    out = []
    for s in sales:
        c = Company.query.get(s.company_id)
        out.append(_deal_option_dict(s, c, exclude_rfq_id))
    return jsonify(out), 200


@rfq_bp.route("/rbac-admins", methods=["GET"])
def list_rfq_rbac_admins():
    """Users with explicit RFQ module Admin in RBAC (UserPagePermission rfq + admin)."""
    current_user = get_current_user()
    if not current_user:
        return _json_error("Authentication required", 401)
    if not has_rfq_module_access(current_user):
        return _json_error("No access to RFQ", 403)
    rows = UserPagePermission.query.filter_by(
        page_key="rfq",
        access_type=rbac_service.ACCESS_ADMIN,
    ).all()
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for r in rows:
        if r.user_id in seen:
            continue
        seen.add(r.user_id)
        u = User.query.get(r.user_id)
        if u and u.is_active:
            pic = _hr_profile_picture_for_user_id(u.id)
            out.append(
                {
                    "id": u.id,
                    "name": u.name or "",
                    "email": u.email or "",
                    "profilePicture": pic or "",
                }
            )
    out.sort(key=lambda x: (x["name"].lower(), x["email"].lower()))
    return jsonify(out), 200


@rfq_bp.route("", methods=["GET"])
def list_rfqs():
    current_user = get_current_user()
    if not current_user:
        return _json_error("Authentication required", 401)
    if not has_rfq_module_access(current_user):
        return _json_error("No access to RFQ", 403)

    if is_global_system_admin(current_user):
        rfqs = RFQ.query.order_by(RFQ.updated_at.desc()).all()
    else:
        conds = [RFQ.created_by_user_id == current_user.id]
        if can_rfq_pricing_input(current_user):
            # Assignee sees RFQs they priced at any status; unassigned pending_rbac queue for any pricing admin
            conds.append(
                or_(
                    RFQ.pricing_assignee_user_id == current_user.id,
                    and_(
                        RFQ.status.in_(["pending_rbac", "reapplied"]),
                        RFQ.pricing_assignee_user_id.is_(None),
                    ),
                    and_(
                        RFQ.status == "draft",
                        RFQ.submitted_at.isnot(None),
                        RFQ.pricing_assignee_user_id.is_(None),
                    ),
                )
            )
        rfqs = RFQ.query.filter(or_(*conds)).order_by(RFQ.updated_at.desc()).all()
    return jsonify([_rfq_to_dict(r, include_items=False) for r in rfqs]), 200


@rfq_bp.route("", methods=["POST"])
def create_rfq():
    current_user = get_current_user()
    if not current_user:
        return _json_error("Authentication required", 401)
    if not has_rfq_module_access(current_user):
        return _json_error("No access to RFQ", 403)

    data = request.get_json() or {}
    sales_id = (data.get("salesId") or "").strip()
    if not sales_id:
        return _json_error("salesId is required", 400)
    sale = Sale.query.get(sales_id)
    if not sale:
        return _json_error("Deal not found", 404)
    if not _user_can_access_sale(current_user, sale):
        return _json_error("No access to this deal", 403)

    aid = (data.get("pricingAssigneeUserId") or "").strip()
    if not aid:
        return _json_error("pricingAssigneeUserId is required", 400)
    assignee = User.query.get(aid)
    if not assignee or not assignee.is_active:
        return _json_error("Invalid pricing assignee", 400)
    if not _is_explicit_rfq_rbac_admin(assignee):
        return _json_error("Pricing assignee must be an RFQ module administrator", 400)

    if _conflicting_rfq_for_sale(sales_id, None):
        return _json_error("This deal already has an RFQ. Each deal can only have one RFQ.", 409)

    raw_items = data.get("items")
    if not isinstance(raw_items, list) or len(raw_items) == 0:
        return _json_error("At least one line item is required", 400)

    rfq = RFQ(
        sales_id=sales_id,
        company_id=sale.company_id,
        created_by_user_id=current_user.id,
        status="draft",
        notes_overall=(data.get("notesOverall") or "").strip() or None,
        pricing_assignee_user_id=aid,
    )
    db.session.add(rfq)
    db.session.flush()

    for i, row in enumerate(raw_items):
        desc = (row.get("description") or "").strip()
        if not desc:
            return _json_error(f"Item {i + 1}: description is required", 400)
        try:
            qty = float(row.get("quantity", 1))
        except (TypeError, ValueError):
            return _json_error(f"Item {i + 1}: invalid quantity", 400)
        if qty <= 0:
            return _json_error(f"Item {i + 1}: quantity must be positive", 400)
        db.session.add(
            RFQItem(
                rfq_id=rfq.id,
                line_no=i,
                description=desc,
                quantity=qty,
                line_note=(row.get("lineNote") or "").strip() or None,
            )
        )
    db.session.commit()
    rfq = RFQ.query.get(rfq.id)
    return jsonify(_rfq_to_dict(rfq)), 201


@rfq_bp.route("/<rid>", methods=["GET"])
def get_rfq(rid: str):
    current_user = get_current_user()
    if not current_user:
        return _json_error("Authentication required", 401)
    if not has_rfq_module_access(current_user):
        return _json_error("No access to RFQ", 403)
    rfq = RFQ.query.get(rid)
    if not rfq:
        return _json_error("Not found", 404)
    if not _can_view_rfq(current_user, rfq):
        return _json_error("Forbidden", 403)
    return jsonify(_rfq_to_dict(rfq)), 200


def _can_view_rfq(user: User, rfq: RFQ) -> bool:
    if is_global_system_admin(user):
        return True
    if rfq.created_by_user_id == user.id:
        return True
    if rfq.pricing_assignee_user_id and rfq.pricing_assignee_user_id == user.id:
        return True
    if rfq.status in ("pending_rbac", "reapplied") and _can_act_as_pricing_on_rfq(user, rfq):
        return True
    if rfq.status == "draft" and rfq.submitted_at is not None and _can_act_as_pricing_on_rfq(user, rfq):
        return True
    return False


@rfq_bp.route("/<rid>", methods=["PATCH"])
def patch_rfq(rid: str):
    current_user = get_current_user()
    if not current_user:
        return _json_error("Authentication required", 401)
    if not has_rfq_module_access(current_user):
        return _json_error("No access to RFQ", 403)
    rfq = RFQ.query.get(rid)
    if not rfq:
        return _json_error("Not found", 404)

    data = request.get_json() or {}

    # Initial RFQ draft only (before first submit to RBAC). Pricing "draft" uses submitted_at + pricing PATCH below.
    if (
        rfq.status == "draft"
        and rfq.created_by_user_id == current_user.id
        and rfq.submitted_at is None
    ):
        if "salesId" in data:
            new_sales = (data.get("salesId") or "").strip()
            if not new_sales:
                return _json_error("salesId is required", 400)
            sale = Sale.query.get(new_sales)
            if not sale:
                return _json_error("Deal not found", 404)
            if not _user_can_access_sale(current_user, sale):
                return _json_error("No access to this deal", 403)
            if _conflicting_rfq_for_sale(new_sales, rfq.id):
                return _json_error("This deal already has an RFQ. Each deal can only have one RFQ.", 409)
            rfq.sales_id = new_sales
            rfq.company_id = sale.company_id
        if "pricingAssigneeUserId" in data:
            aid = (data.get("pricingAssigneeUserId") or "").strip()
            if not aid:
                return _json_error("pricingAssigneeUserId is required", 400)
            assignee = User.query.get(aid)
            if not assignee or not assignee.is_active:
                return _json_error("Invalid pricing assignee", 400)
            if not _is_explicit_rfq_rbac_admin(assignee):
                return _json_error("Pricing assignee must be an RFQ module administrator", 400)
            rfq.pricing_assignee_user_id = aid
        if "notesOverall" in data:
            rfq.notes_overall = (data.get("notesOverall") or "").strip() or None
        if "items" in data:
            raw_items = data.get("items")
            if not isinstance(raw_items, list) or len(raw_items) == 0:
                return _json_error("At least one line item is required", 400)
            RFQItem.query.filter_by(rfq_id=rfq.id).delete()
            for i, row in enumerate(raw_items):
                desc = (row.get("description") or "").strip()
                if not desc:
                    return _json_error(f"Item {i + 1}: description is required", 400)
                try:
                    qty = float(row.get("quantity", 1))
                except (TypeError, ValueError):
                    return _json_error(f"Item {i + 1}: invalid quantity", 400)
                if qty <= 0:
                    return _json_error(f"Item {i + 1}: quantity must be positive", 400)
                db.session.add(
                    RFQItem(
                        rfq_id=rfq.id,
                        line_no=i,
                        description=desc,
                        quantity=qty,
                        line_note=(row.get("lineNote") or "").strip() or None,
                    )
                )
        rfq.updated_at = datetime.utcnow()
        db.session.commit()
        rfq = RFQ.query.get(rfq.id)
        return jsonify(_rfq_to_dict(rfq)), 200

    if rfq.created_by_user_id == current_user.id and (
        rfq.status in ("pending_rbac", "pending_system")
        or (rfq.status == "draft" and rfq.submitted_at is not None)
    ):
        # Creator cannot edit the *request* after pricing is submitted, unless they are also
        # allowed to PATCH pricing (e.g. pricing assignee or system admin on pending_system).
        if rfq.pricing_submitted_at and not _can_patch_rfq_pricing(current_user, rfq):
            return _json_error(
                "Pricing has been submitted; this request can no longer be edited",
                400,
            )
        if "items" in data and not _is_creator_request_items_payload(data.get("items")):
            pass
        elif (
            "notesOverall" in data
            or "items" in data
            or "pricingAssigneeUserId" in data
            or "salesId" in data
        ):
            if "salesId" in data:
                new_sales = (data.get("salesId") or "").strip()
                if not new_sales:
                    return _json_error("salesId is required", 400)
                sale = Sale.query.get(new_sales)
                if not sale:
                    return _json_error("Deal not found", 404)
                if not _user_can_access_sale(current_user, sale):
                    return _json_error("No access to this deal", 403)
                if _conflicting_rfq_for_sale(new_sales, rfq.id):
                    return _json_error("This deal already has an RFQ. Each deal can only have one RFQ.", 409)
                if rfq.sales_id != new_sales and rfq.status == "pending_system":
                    rfq.status = "pending_rbac"
                    rfq.pricing_submitted_at = None
                rfq.sales_id = new_sales
                rfq.company_id = sale.company_id
            if "pricingAssigneeUserId" in data:
                aid = (data.get("pricingAssigneeUserId") or "").strip()
                if not aid:
                    return _json_error("pricingAssigneeUserId is required", 400)
                assignee = User.query.get(aid)
                if not assignee or not assignee.is_active:
                    return _json_error("Invalid pricing assignee", 400)
                if not _is_explicit_rfq_rbac_admin(assignee):
                    return _json_error("Pricing assignee must be an RFQ module administrator", 400)
                rfq.pricing_assignee_user_id = aid
            if "notesOverall" in data:
                rfq.notes_overall = (data.get("notesOverall") or "").strip() or None
            if "items" in data:
                raw_items = data.get("items")
                if not isinstance(raw_items, list) or len(raw_items) == 0:
                    return _json_error("At least one line item is required", 400)
                RFQItem.query.filter_by(rfq_id=rfq.id).delete()
                for i, row in enumerate(raw_items):
                    desc = (row.get("description") or "").strip()
                    if not desc:
                        return _json_error(f"Item {i + 1}: description is required", 400)
                    try:
                        qty = float(row.get("quantity", 1))
                    except (TypeError, ValueError):
                        return _json_error(f"Item {i + 1}: invalid quantity", 400)
                    if qty <= 0:
                        return _json_error(f"Item {i + 1}: quantity must be positive", 400)
                    db.session.add(
                        RFQItem(
                            rfq_id=rfq.id,
                            line_no=i,
                            description=desc,
                            quantity=qty,
                            line_note=(row.get("lineNote") or "").strip() or None,
                        )
                    )
                if rfq.status == "pending_system":
                    rfq.status = "pending_rbac"
                    rfq.pricing_submitted_at = None
            rfq.updated_at = datetime.utcnow()
            db.session.commit()
            rfq = RFQ.query.get(rfq.id)
            return jsonify(_rfq_to_dict(rfq)), 200

    # RBAC pricing editors: pending_rbac / reapplied / draft (after submit). System admin: pending_system before approve.
    if _can_patch_rfq_pricing(current_user, rfq):
        if "notesOverall" in data:
            rfq.notes_overall = (data.get("notesOverall") or "").strip() or None
        if "vatPercent" in data:
            raw_vat = data.get("vatPercent")
            if raw_vat is None:
                rfq.vat_percent = None
            else:
                try:
                    v = float(raw_vat)
                    if v < 0 or v > 100:
                        return _json_error("vatPercent must be between 0 and 100", 400)
                    rfq.vat_percent = v
                except (TypeError, ValueError):
                    return _json_error("Invalid vatPercent", 400)
        raw_items = data.get("items")
        if raw_items is not None:
            if not isinstance(raw_items, list):
                return _json_error("items must be an array", 400)
            by_id = {i.id: i for i in rfq.items}
            for row in raw_items:
                iid = (row.get("id") or "").strip()
                if iid not in by_id:
                    continue
                it = by_id[iid]
                if "unitBuyingPrice" in row and row.get("unitBuyingPrice") is not None:
                    try:
                        it.unit_buying_price = float(row["unitBuyingPrice"])
                    except (TypeError, ValueError):
                        return _json_error("Invalid unitBuyingPrice", 400)
                if "profitPerUnit" in row and row.get("profitPerUnit") is not None:
                    try:
                        it.profit_per_unit = float(row["profitPerUnit"])
                    except (TypeError, ValueError):
                        return _json_error("Invalid profitPerUnit", 400)
                if "unitSellingPrice" in row and row.get("unitSellingPrice") is not None:
                    try:
                        it.unit_selling_price = float(row["unitSellingPrice"])
                    except (TypeError, ValueError):
                        return _json_error("Invalid unitSellingPrice", 400)
                if "lineNote" in row:
                    it.line_note = (row.get("lineNote") or "").strip() or None
                if "vatPercent" in row:
                    raw_vat = row.get("vatPercent")
                    if raw_vat is None:
                        it.vat_percent = None
                    else:
                        try:
                            vv = float(raw_vat)
                            if vv < 0 or vv > 100:
                                return _json_error("vatPercent per line must be between 0 and 100", 400)
                            it.vat_percent = vv
                        except (TypeError, ValueError):
                            return _json_error("Invalid vatPercent on line item", 400)
                _apply_pricing_math(it)
        if data.get("saveAsDraft") is True:
            rfq.status = "draft"
            if rfq.pricing_submitted_at is not None:
                rfq.pricing_submitted_at = None
        rfq.updated_at = datetime.utcnow()
        db.session.commit()
        rfq = RFQ.query.get(rfq.id)
        return jsonify(_rfq_to_dict(rfq)), 200

    return _json_error("Cannot update RFQ in this state", 400)


@rfq_bp.route("/<rid>/submit", methods=["POST"])
def submit_rfq(rid: str):
    current_user = get_current_user()
    if not current_user:
        return _json_error("Authentication required", 401)
    if not has_rfq_module_access(current_user):
        return _json_error("No access to RFQ", 403)
    rfq = RFQ.query.get(rid)
    if not rfq:
        return _json_error("Not found", 404)
    if rfq.created_by_user_id != current_user.id or rfq.status != "draft":
        return _json_error("Only draft RFQs you own can be submitted", 400)
    if not rfq.pricing_assignee_user_id:
        return _json_error("pricingAssigneeUserId must be set before submit", 400)
    if not rfq.items or len(rfq.items) == 0:
        return _json_error("Add at least one line item", 400)
    rfq.status = "pending_rbac"
    rfq.submitted_at = datetime.utcnow()
    rfq.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify(_rfq_to_dict(RFQ.query.get(rfq.id))), 200


@rfq_bp.route("/<rid>/pricing", methods=["POST"])
def submit_pricing(rid: str):
    current_user = get_current_user()
    if not current_user:
        return _json_error("Authentication required", 401)
    if not has_rfq_module_access(current_user):
        return _json_error("No access to RFQ", 403)
    rfq = RFQ.query.get(rid)
    if not rfq:
        return _json_error("Not found", 404)
    if not _can_act_as_pricing_on_rfq(current_user, rfq):
        return _json_error("Not authorized to submit pricing for this RFQ", 403)
    if rfq.status not in ("pending_rbac", "reapplied", "draft"):
        return _json_error("RFQ is not waiting for pricing", 400)
    if rfq.status == "draft" and rfq.submitted_at is None:
        return _json_error("RFQ is not waiting for pricing", 400)
    for it in rfq.items:
        if it.unit_buying_price is None:
            return _json_error(f"Unit buying price required for line {it.line_no + 1}", 400)
        if it.profit_per_unit is None:
            return _json_error(f"Profit per unit required for line {it.line_no + 1}", 400)
        if it.unit_selling_price is None:
            return _json_error(f"Unit selling price required for line {it.line_no + 1}", 400)
        _apply_pricing_math(it)
    rfq.status = "pending_system"
    rfq.pricing_submitted_at = datetime.utcnow()
    rfq.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify(_rfq_to_dict(RFQ.query.get(rfq.id))), 200


@rfq_bp.route("/<rid>/approve", methods=["POST"])
def approve_rfq(rid: str):
    current_user = get_current_user()
    if not current_user:
        return _json_error("Authentication required", 401)
    if not is_global_system_admin(current_user):
        return _json_error("Only system admin can approve", 403)
    rfq = RFQ.query.get(rid)
    if not rfq:
        return _json_error("Not found", 404)
    if rfq.status != "pending_system":
        return _json_error("RFQ is not pending approval", 400)
    rfq.status = "approved"
    rfq.resolved_at = datetime.utcnow()
    rfq.approved_by_user_id = current_user.id
    rfq.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify(_rfq_to_dict(RFQ.query.get(rfq.id))), 200


@rfq_bp.route("/<rid>/reject", methods=["POST"])
def reject_rfq(rid: str):
    current_user = get_current_user()
    if not current_user:
        return _json_error("Authentication required", 401)
    if not is_global_system_admin(current_user):
        return _json_error("Only system admin can reject", 403)
    rfq = RFQ.query.get(rid)
    if not rfq:
        return _json_error("Not found", 404)
    if rfq.status != "pending_system":
        return _json_error("RFQ is not pending approval", 400)
    data = request.get_json() or {}
    reason = (data.get("reason") or "").strip()
    if not reason:
        return _json_error("reason is required", 400)
    rfq.status = "reapplied"
    rfq.rejection_reason = reason
    rfq.resolved_at = datetime.utcnow()
    rfq.rejected_by_user_id = current_user.id
    rfq.pricing_submitted_at = None
    rfq.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify(_rfq_to_dict(RFQ.query.get(rfq.id))), 200


@rfq_bp.route("/<rid>/reopen", methods=["POST"])
def reopen_rfq(rid: str):
    """Archive current approved pricing + invoice to history, increment version, reset workflow to pending_rbac."""
    current_user = get_current_user()
    if not current_user:
        return _json_error("Authentication required", 401)
    if not has_rfq_module_access(current_user):
        return _json_error("No access to RFQ", 403)
    rfq = RFQ.query.get(rid)
    if not rfq:
        return _json_error("Not found", 404)
    if not _can_view_rfq(current_user, rfq):
        return _json_error("Forbidden", 403)
    if not _can_reopen_rfq(current_user, rfq):
        return _json_error("Not authorized to reopen this RFQ", 403)
    if rfq.status != "approved":
        return _json_error("Only approved RFQs can be reopened", 400)

    try:
        now = datetime.utcnow()
        ver = int(getattr(rfq, "version_number", None) or 1)
        items_sorted = sorted(rfq.items, key=lambda x: x.line_no) if rfq.items else []
        pricing_snapshot = [_item_to_dict(it) for it in items_sorted]
        sub, vat_amt, total_amt, vat_pct = _invoice_totals_from_rfq(rfq)

        ph = RfqPricingHistory(
            rfq_id=rfq.id,
            version_number=ver,
            items_json=json.dumps(pricing_snapshot),
            vat_percent=rfq.vat_percent,
            approved_by_user_id=rfq.approved_by_user_id,
            approved_at=rfq.resolved_at,
            archived_at=now,
            archived_by_user_id=current_user.id,
        )
        ih = RfqInvoiceHistory(
            rfq_id=rfq.id,
            version_number=ver,
            items_json=json.dumps(pricing_snapshot),
            subtotal=sub,
            vat_amount=vat_amt,
            total_amount=total_amt,
            vat_percent=rfq.vat_percent,
            approved_by_user_id=rfq.approved_by_user_id,
            approved_at=rfq.resolved_at,
            archived_at=now,
            archived_by_user_id=current_user.id,
        )
        db.session.add(ph)
        db.session.add(ih)

        rfq.version_number = ver + 1
        rfq.status = "pending_rbac"
        rfq.pricing_submitted_at = None
        rfq.resolved_at = None
        rfq.approved_by_user_id = None
        rfq.rejected_by_user_id = None
        rfq.rejection_reason = None
        rfq.submitted_at = now
        rfq.updated_at = now

        for it in rfq.items:
            it.unit_buying_price = None
            it.profit_per_unit = None
            it.unit_selling_price = None
            it.total_profit = None
            it.line_note = None
            it.vat_percent = None

        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return _json_error(str(e) or "Reopen failed", 500)

    rfq = RFQ.query.get(rid)
    return jsonify(_rfq_to_dict(rfq)), 200


@rfq_bp.route("/<rid>/history", methods=["GET"])
def rfq_history(rid: str):
    """Archived pricing + invoice snapshots per version (descending by version)."""
    current_user = get_current_user()
    if not current_user:
        return _json_error("Authentication required", 401)
    if not has_rfq_module_access(current_user):
        return _json_error("No access to RFQ", 403)
    rfq = RFQ.query.get(rid)
    if not rfq:
        return _json_error("Not found", 404)
    if not _can_view_rfq(current_user, rfq):
        return _json_error("Forbidden", 403)

    pricing_rows = (
        RfqPricingHistory.query.filter_by(rfq_id=rid).order_by(RfqPricingHistory.version_number.desc()).all()
    )
    invoice_rows = RfqInvoiceHistory.query.filter_by(rfq_id=rid).all()
    inv_by_ver = {r.version_number: r for r in invoice_rows}

    versions: list[dict[str, Any]] = []
    for pr in pricing_rows:
        inv = inv_by_ver.get(pr.version_number)
        approved_u = User.query.get(pr.approved_by_user_id) if pr.approved_by_user_id else None
        arch_u = User.query.get(pr.archived_by_user_id) if pr.archived_by_user_id else None
        entry: dict[str, Any] = {
            "versionNumber": pr.version_number,
            "pricing": json.loads(pr.items_json),
            "vatPercent": float(pr.vat_percent) if pr.vat_percent is not None else None,
            "approvedBy": _user_mini(approved_u),
            "approvedAt": pr.approved_at.isoformat() + "Z" if pr.approved_at else None,
            "archivedAt": pr.archived_at.isoformat() + "Z" if pr.archived_at else None,
            "archivedBy": _user_mini(arch_u),
        }
        if inv:
            entry["invoice"] = {
                "items": json.loads(inv.items_json),
                "subtotal": float(inv.subtotal),
                "vatAmount": float(inv.vat_amount),
                "totalAmount": float(inv.total_amount),
                "vatPercent": float(inv.vat_percent) if inv.vat_percent is not None else None,
            }
        else:
            entry["invoice"] = None
        versions.append(entry)

    return (
        jsonify(
            {
                "currentVersion": int(getattr(rfq, "version_number", None) or 1),
                "versions": versions,
            }
        ),
        200,
    )
