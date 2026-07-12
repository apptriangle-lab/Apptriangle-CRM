"""Company profile API: single organization profile for Settings > Company tab. GET any auth; PUT admin only."""
from flask import Blueprint, request, jsonify
from app import db
from app.models import CompanyProfile
from app.auth_utils import require_admin

company_profile_bp = Blueprint("company_profile", __name__)


def _get_or_create():
    """Return the single company profile row; create empty one if none exists."""
    row = CompanyProfile.query.first()
    if not row:
        row = CompanyProfile()
        db.session.add(row)
        db.session.commit()
    return row


@company_profile_bp.route("", methods=["GET"])
def get_profile():
    """Return the company profile. No auth required so Settings can load it."""
    profile = _get_or_create()
    return jsonify(profile.to_dict()), 200


@company_profile_bp.route("", methods=["PUT", "PATCH"])
@require_admin
def update_profile(current_user):
    """Admin only. Update company profile. Body: any of name, email, phone, website, address, city, country, industry, taxId, description, logo."""
    profile = _get_or_create()
    data = request.get_json() or {}

    if "name" in data:
        profile.name = (data.get("name") or "").strip()
    if "email" in data:
        profile.email = (data.get("email") or "").strip()
    if "phone" in data:
        profile.phone = (data.get("phone") or "").strip()
    if "website" in data:
        profile.website = (data.get("website") or "").strip()
    if "address" in data:
        profile.address = (data.get("address") or "").strip()
    if "city" in data:
        profile.city = (data.get("city") or "").strip()
    if "country" in data:
        profile.country = (data.get("country") or "").strip()
    if "industry" in data:
        profile.industry = (data.get("industry") or "").strip()
    if "taxId" in data:
        profile.tax_id = (data.get("taxId") or "").strip()
    if "description" in data:
        profile.description = (data.get("description") or "").strip()
    if "logo" in data:
        profile.logo = data.get("logo")  # base64 data URL or null

    db.session.commit()
    return jsonify(profile.to_dict()), 200
