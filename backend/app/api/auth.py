import time
import uuid
from flask import Blueprint, request, jsonify, current_app
from werkzeug.security import check_password_hash, generate_password_hash
import jwt
from app import db
from app.models import User
from app.auth_utils import get_current_user, revoke_token

auth_bp = Blueprint("auth", __name__)


def _create_token(user_id: str) -> tuple[str, int | None]:
    """
    Return (jwt_string, expires_at_unix or None).
    When JWT_EXPIRY_HOURS <= 0, no exp claim — valid until logout (revoke blacklist).
    Each login gets a fresh jti so re-login after logout is not blocked by blacklist.
    """
    exp_hours = int(current_app.config.get("JWT_EXPIRY_HOURS", 0) or 0)
    now = int(time.time())
    payload = {"sub": user_id, "iat": now, "jti": str(uuid.uuid4())}
    expires_at: int | None = None
    if exp_hours > 0:
        expires_at = int(time.time()) + exp_hours * 3600
        payload["exp"] = expires_at
    raw = jwt.encode(
        payload,
        current_app.config["JWT_SECRET_KEY"],
        algorithm="HS256",
    )
    token = raw if isinstance(raw, str) else raw.decode("utf-8")
    return token, expires_at


def _get_bearer_token() -> str | None:
    auth = request.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer "):
        return None
    return auth[7:].strip() or None


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip()
    password = data.get("password") or ""

    if not email:
        return jsonify({"error": "Email is required"}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({"error": "Invalid credentials"}), 401
    if not user.is_active:
        return jsonify({"error": "Account is disabled"}), 403

    token, expires_at = _create_token(user.id)
    body = {
        "user": user.to_dict(),
        "token": token,
        "expiresAt": None,
    }
    if expires_at is not None:
        from datetime import datetime, timezone

        body["expiresAt"] = (
            datetime.fromtimestamp(expires_at, tz=timezone.utc)
            .isoformat()
            .replace("+00:00", "Z")
        )

    return jsonify(body), 200


@auth_bp.route("/logout", methods=["POST"])
def logout():
    """Revoke the token on the server. Client must send Authorization: Bearer <token>."""
    token = _get_bearer_token()
    if token:
        revoke_token(token)
    return jsonify({"ok": True}), 200


@auth_bp.route("/change-password", methods=["POST"])
def change_password():
    """Logged-in user changes their own password. Body: currentPassword, newPassword."""
    user = get_current_user()
    if not user:
        return jsonify({"error": "Authentication required"}), 401
    data = request.get_json() or {}
    current_password = data.get("currentPassword") or ""
    new_password = data.get("newPassword") or ""
    if not current_password:
        return jsonify({"error": "Current password is required"}), 400
    if not check_password_hash(user.password_hash, current_password):
        return jsonify({"error": "Current password is incorrect"}), 400
    if not new_password or len(new_password) < 6:
        return jsonify({"error": "New password must be at least 6 characters"}), 400
    user.password_hash = generate_password_hash(new_password)
    db.session.commit()
    return jsonify({"ok": True}), 200
