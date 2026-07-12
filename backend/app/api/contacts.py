"""Contacts API: list (page admin=all, page user=own created), CRUD.

User scope sees only contacts where created_by_user_id is the current user.
Legacy rows with NULL creator are visible only to Contacts admin scope.
"""
from flask import Blueprint, request, jsonify
from sqlalchemy import or_, func
from app import db
from app.models import Contact
from app.auth_utils import get_current_user
from app.services.rbac_service import ACCESS_NONE, ACCESS_ADMIN, get_effective_page_access

contacts_bp = Blueprint("contacts", __name__)

PAGE_KEY_CONTACTS = "contacts"


def _contacts_access(user) -> str:
    return get_effective_page_access(user, PAGE_KEY_CONTACTS)


def _is_contacts_admin(user) -> bool:
    return _contacts_access(user) == ACCESS_ADMIN


def _user_can_access_contact(current_user, contact: Contact) -> bool:
    access = _contacts_access(current_user)
    if access == ACCESS_NONE:
        return False
    if _is_contacts_admin(current_user):
        return True
    return contact.created_by_user_id == current_user.id


@contacts_bp.route("", methods=["GET"])
def list_contacts():
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Authentication required"}), 401
    if _contacts_access(current_user) == ACCESS_NONE:
        return jsonify({"error": "No access to Contacts"}), 403
    company_id = request.args.get("companyId")
    search = (request.args.get("search") or "").strip()
    q = Contact.query
    if not _is_contacts_admin(current_user):
        q = q.filter(Contact.created_by_user_id == current_user.id)
    if company_id:
        q = q.filter(Contact.company_id == company_id)
    if search:
        term = f"%{search.lower()}%"
        q = q.filter(
            or_(
                func.lower(Contact.name).like(term),
                func.lower(func.coalesce(Contact.email, "")).like(term),
                func.lower(Contact.mobile).like(term),
            )
        )
    contacts = q.order_by(Contact.created_at.desc()).all()
    return jsonify([c.to_dict() for c in contacts]), 200


@contacts_bp.route("", methods=["POST"])
def create_contact():
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Authentication required"}), 401
    if _contacts_access(current_user) == ACCESS_NONE:
        return jsonify({"error": "No access to Contacts"}), 403
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    company_id = data.get("companyId")
    mobile = (data.get("mobile") or "").strip()
    if not name:
        return jsonify({"error": "Name is required"}), 400
    if not company_id:
        return jsonify({"error": "companyId is required"}), 400
    if not mobile:
        return jsonify({"error": "Mobile is required"}), 400
    contact = Contact(
        name=name,
        company_id=company_id,
        designation=data.get("designation"),
        mobile=mobile,
        email=data.get("email"),
        created_by_user_id=current_user.id,
    )
    db.session.add(contact)
    db.session.commit()
    return jsonify(contact.to_dict()), 201


@contacts_bp.route("/<contact_id>", methods=["GET"])
def get_contact(contact_id):
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Authentication required"}), 401
    if _contacts_access(current_user) == ACCESS_NONE:
        return jsonify({"error": "No access to Contacts"}), 403
    contact = Contact.query.get(contact_id)
    if not contact:
        return jsonify({"error": "Contact not found"}), 404
    if not _user_can_access_contact(current_user, contact):
        return jsonify({"error": "Not allowed to view this contact"}), 403
    return jsonify(contact.to_dict()), 200


@contacts_bp.route("/<contact_id>", methods=["PUT", "PATCH"])
def update_contact(contact_id):
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Authentication required"}), 401
    if _contacts_access(current_user) == ACCESS_NONE:
        return jsonify({"error": "No access to Contacts"}), 403
    contact = Contact.query.get(contact_id)
    if not contact:
        return jsonify({"error": "Contact not found"}), 404
    if not _user_can_access_contact(current_user, contact):
        return jsonify({"error": "Not allowed to update this contact"}), 403
    data = request.get_json() or {}
    if "name" in data:
        contact.name = (data["name"] or "").strip() or contact.name
    if "companyId" in data:
        contact.company_id = data["companyId"] or contact.company_id
    if "designation" in data:
        contact.designation = data["designation"]
    if "mobile" in data:
        contact.mobile = (data["mobile"] or "").strip() or contact.mobile
    if "email" in data:
        contact.email = data["email"]
    db.session.commit()
    return jsonify(contact.to_dict()), 200


@contacts_bp.route("/<contact_id>", methods=["DELETE"])
def delete_contact(contact_id):
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Authentication required"}), 401
    if _contacts_access(current_user) == ACCESS_NONE:
        return jsonify({"error": "No access to Contacts"}), 403
    contact = Contact.query.get(contact_id)
    if not contact:
        return jsonify({"error": "Contact not found"}), 404
    if not _user_can_access_contact(current_user, contact):
        return jsonify({"error": "Not allowed to delete this contact"}), 403
    db.session.delete(contact)
    db.session.commit()
    return jsonify({"ok": True}), 200
