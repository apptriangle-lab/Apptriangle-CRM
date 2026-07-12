from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash
from app import db
from app.models import User, HRInfo
from app.auth_utils import get_current_user, require_admin
from app.email_utils import send_welcome_email

users_bp = Blueprint("users", __name__)


@users_bp.route("", methods=["GET"])
def list_users():
    users = User.query.order_by(User.created_at.desc()).all()
    if not users:
        return jsonify([]), 200
    user_ids = [u.id for u in users]
    hr_rows = HRInfo.query.filter(HRInfo.user_id.in_(user_ids)).all()
    pic_by_user = {}
    for h in hr_rows:
        if h.profile_picture:
            s = str(h.profile_picture).strip()
            if s:
                pic_by_user[h.user_id] = s
    out = []
    for u in users:
        d = u.to_dict()
        d["profilePicture"] = pic_by_user.get(u.id)
        out.append(d)
    return jsonify(out), 200


@users_bp.route("/<user_id>", methods=["GET"])
def get_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify(user.to_dict()), 200


@users_bp.route("/me", methods=["PATCH", "PUT"])
def update_me():
    """Logged-in user can update only their own name and phone (email is read-only)."""
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Authentication required"}), 401
    data = request.get_json() or {}
    if "name" in data:
        name = (data.get("name") or "").strip()
        if name:
            current_user.name = name
    if "phone" in data:
        current_user.phone = (data.get("phone") or "").strip()
    db.session.commit()
    return jsonify(current_user.to_dict()), 200


@users_bp.route("", methods=["POST"])
@require_admin
def create_user(current_user):
    """Admin only. Create user and send welcome email with login credentials."""
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    phone = (data.get("phone") or "").strip()
    role = (data.get("role") or "user").strip() or "user"
    if role not in ("admin", "user"):
        role = "user"

    if not name:
        return jsonify({"error": "Name is required"}), 400
    if not email:
        return jsonify({"error": "Email is required"}), 400
    if not password or len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "A user with this email already exists"}), 409

    user = User(
        name=name,
        email=email,
        password_hash=generate_password_hash(password),
        phone=phone,
        role=role,
        is_active=True,
    )
    db.session.add(user)
    db.session.commit()

    send_welcome_email(to_email=email, name=name, login_email=email, password=password)

    return jsonify(user.to_dict()), 201


@users_bp.route("/<user_id>/password", methods=["PUT", "PATCH"])
@require_admin
def set_user_password(user_id, current_user):
    """Admin only. Set a new password for any user. Body: newPassword."""
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    data = request.get_json() or {}
    new_password = data.get("newPassword") or ""
    if not new_password or len(new_password) < 6:
        return jsonify({"error": "New password must be at least 6 characters"}), 400
    user.password_hash = generate_password_hash(new_password)
    db.session.commit()
    return jsonify({"ok": True}), 200


@users_bp.route("/<user_id>", methods=["PUT", "PATCH"])
@require_admin
def update_user(user_id, current_user):
    """Admin only. Update user (name, email, role, isActive)."""
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json() or {}
    if "name" in data:
        name = (data.get("name") or "").strip()
        if name:
            user.name = name
    if "email" in data:
        email = (data.get("email") or "").strip().lower()
        if not email:
            return jsonify({"error": "Email cannot be empty"}), 400
        other = User.query.filter(User.id != user.id, User.email == email).first()
        if other:
            return jsonify({"error": "A user with this email already exists"}), 409
        user.email = email
    if "phone" in data:
        user.phone = (data.get("phone") or "").strip()
    if "role" in data:
        r = (data.get("role") or "").strip()
        if r in ("admin", "user"):
            user.role = r
    if "isActive" in data:
        user.is_active = bool(data.get("isActive"))

    db.session.commit()
    return jsonify(user.to_dict()), 200
