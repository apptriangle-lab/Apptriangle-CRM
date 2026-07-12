"""Renewals API. RBAC `sales` admin = all; user scope = renewals where snapshot KAM is the current user."""
from datetime import date, datetime

from flask import Blueprint, jsonify, request
from sqlalchemy import func, or_

from app import db
from app.models import Company, Renewal
from app.auth_utils import get_current_user
from app.rbac_utils import has_sales_module_access, has_full_sales_scope

renewals_bp = Blueprint("renewals", __name__)


def _parse_date(value):
    if not value:
        return None
    try:
        if "T" in value:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
        return date.fromisoformat(value)
    except Exception:
        return None


def _validate_payload(data):
    company_id = data.get("companyId")
    product_details = (data.get("productDetails") or "").strip()
    renewal_type_raw = (data.get("renewalType") or "existing").strip().lower()
    # Backward compatibility: map old/typo values to "potential".
    if renewal_type_raw in ("partial", "pertial"):
        renewal_type = "potential"
    else:
        renewal_type = renewal_type_raw
    source = (data.get("source") or "").strip()
    renewal_date = _parse_date(data.get("renewalDate"))

    if not company_id:
        return None, "Company is required"
    if not product_details:
        return None, "Product details are required"
    if renewal_type not in ("existing", "potential"):
        return None, "Renewal type must be existing or potential"
    if not renewal_date:
        return None, "Renewal date is required"

    company = Company.query.get(company_id)
    if not company:
        return None, "Invalid company"

    return (
        {
            "company": company,
            "company_id": company_id,
            "product_details": product_details,
            "renewal_type": renewal_type,
            "source": source,
            "renewal_date": renewal_date,
        },
        None,
    )


def _user_can_access_renewal(current_user, row: Renewal) -> bool:
    if not has_sales_module_access(current_user):
        return False
    if has_full_sales_scope(current_user):
        return True
    return (row.kam_user_id or "") == current_user.id


def _user_can_access_renewal_company_kam(current_user, company: Company) -> bool:
    if not has_sales_module_access(current_user):
        return False
    if has_full_sales_scope(current_user):
        return True
    return (company.kam_user_id or "") == current_user.id


@renewals_bp.route("", methods=["GET"])
def list_renewals():
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Authentication required"}), 401
    if not has_sales_module_access(current_user):
        return jsonify({"error": "No access to Sales"}), 403
    company_id = request.args.get("companyId")
    kam_user_id = request.args.get("kamUserId")
    source = request.args.get("source")
    search = (request.args.get("search") or "").strip().lower()

    q = Renewal.query.filter(Renewal.deleted_at.is_(None))
    if not has_full_sales_scope(current_user):
        q = q.filter(Renewal.kam_user_id == current_user.id)
    if company_id:
        q = q.filter(Renewal.company_id == company_id)
    if kam_user_id:
        q = q.filter(Renewal.kam_user_id == kam_user_id)
    if source:
        q = q.filter(func.lower(Renewal.source) == source.lower())
    if search:
        q = q.filter(
            or_(
                func.lower(Renewal.product_details).like(f"%{search}%"),
                func.lower(Renewal.source).like(f"%{search}%"),
            )
        )
    rows = q.order_by(Renewal.renewal_date.asc(), Renewal.created_at.desc()).all()
    return jsonify([r.to_dict() for r in rows]), 200


@renewals_bp.route("", methods=["POST"])
def create_renewal():
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Authentication required"}), 401
    if not has_sales_module_access(current_user):
        return jsonify({"error": "No access to Sales"}), 403
    data = request.get_json() or {}
    parsed, err = _validate_payload(data)
    if err:
        return jsonify({"error": err}), 400

    company = parsed["company"]
    if not _user_can_access_renewal_company_kam(current_user, company):
        return jsonify({"error": "Not allowed to create a renewal for this company"}), 403

    row = Renewal(
        company_id=parsed["company_id"],
        kam_user_id=company.kam_user_id or None,
        product_details=parsed["product_details"],
        renewal_type=parsed["renewal_type"],
        source=parsed["source"],
        renewal_date=parsed["renewal_date"],
        company_location=(company.location or "").strip(),
        created_by_user_id=current_user.id,
    )
    db.session.add(row)
    db.session.commit()
    return jsonify(row.to_dict()), 201


@renewals_bp.route("/<renewal_id>", methods=["GET"])
def get_renewal(renewal_id):
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Authentication required"}), 401
    row = Renewal.query.get(renewal_id)
    if not row or row.deleted_at is not None:
        return jsonify({"error": "Renewal not found"}), 404
    if not _user_can_access_renewal(current_user, row):
        return jsonify({"error": "Not allowed"}), 403
    return jsonify(row.to_dict()), 200


@renewals_bp.route("/<renewal_id>", methods=["PUT", "PATCH"])
def update_renewal(renewal_id):
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Authentication required"}), 401
    row = Renewal.query.get(renewal_id)
    if not row or row.deleted_at is not None:
        return jsonify({"error": "Renewal not found"}), 404
    if not _user_can_access_renewal(current_user, row):
        return jsonify({"error": "Not allowed to update this renewal"}), 403

    data = request.get_json() or {}
    parsed, err = _validate_payload(data)
    if err:
        return jsonify({"error": err}), 400

    company = parsed["company"]
    if not _user_can_access_renewal_company_kam(current_user, company):
        return jsonify({"error": "Not allowed to assign this company"}), 403

    row.company_id = parsed["company_id"]
    row.kam_user_id = company.kam_user_id or None
    row.product_details = parsed["product_details"]
    row.renewal_type = parsed["renewal_type"]
    row.source = parsed["source"]
    row.renewal_date = parsed["renewal_date"]
    row.company_location = (company.location or "").strip()
    db.session.commit()
    return jsonify(row.to_dict()), 200


@renewals_bp.route("/<renewal_id>", methods=["DELETE"])
def delete_renewal(renewal_id):
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Authentication required"}), 401
    row = Renewal.query.get(renewal_id)
    if not row or row.deleted_at is not None:
        return jsonify({"error": "Renewal not found"}), 404
    if not _user_can_access_renewal(current_user, row):
        return jsonify({"error": "Not allowed to delete this renewal"}), 403
    row.deleted_at = datetime.utcnow()
    db.session.commit()
    return jsonify({"ok": True}), 200


@renewals_bp.route("/bin", methods=["GET"])
def list_deleted_renewals():
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Authentication required"}), 401
    if not has_sales_module_access(current_user):
        return jsonify({"error": "No access to Sales"}), 403
    q = Renewal.query.filter(Renewal.deleted_at.isnot(None))
    if not has_full_sales_scope(current_user):
        q = q.filter(Renewal.kam_user_id == current_user.id)
    rows = q.order_by(Renewal.deleted_at.desc(), Renewal.renewal_date.asc()).all()
    return jsonify([r.to_dict() for r in rows]), 200


@renewals_bp.route("/restore", methods=["POST"])
def restore_renewals():
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Authentication required"}), 401
    if not has_sales_module_access(current_user):
        return jsonify({"error": "No access to Sales"}), 403
    data = request.get_json() or {}
    raw_ids = data.get("ids")
    if not isinstance(raw_ids, list) or not raw_ids:
        return jsonify({"error": "ids must be a non-empty array of renewal ids"}), 400
    ids = [str(x).strip() for x in raw_ids if str(x).strip()]
    if not ids:
        return jsonify({"error": "ids must be a non-empty array of renewal ids"}), 400

    rows = Renewal.query.filter(Renewal.id.in_(ids), Renewal.deleted_at.isnot(None)).all()
    restored_ids = []
    for row in rows:
        if not _user_can_access_renewal(current_user, row):
            continue
        row.deleted_at = None
        restored_ids.append(row.id)
    db.session.commit()
    return jsonify({"restoredIds": restored_ids, "count": len(restored_ids)}), 200
