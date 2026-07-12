"""Helpers for JWT and admin-only access."""
from functools import wraps
import jwt
from flask import request, jsonify, current_app
from app.models import User

# In-memory blacklist of revoked tokens (use Redis/DB in production for multi-instance)
_token_blacklist = set()


def is_token_blacklisted(token: str) -> bool:
    """Return True if the token was revoked (e.g. after logout)."""
    return token in _token_blacklist


def revoke_token(token: str) -> None:
    """Revoke a token so it can no longer be used (e.g. on logout)."""
    _token_blacklist.add(token)


def _get_bearer_token():
    auth = request.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer "):
        return None
    return auth[7:].strip() or None


def get_user_from_token(token: str | None) -> User | None:
    """Decode JWT string and return User (for SSE query-param auth)."""
    if not token or is_token_blacklisted(token):
        return None
    try:
        exp_hours = int(current_app.config.get("JWT_EXPIRY_HOURS", 0) or 0)
        decode_options = {"verify_exp": False} if exp_hours <= 0 else {}
        payload = jwt.decode(
            token,
            current_app.config["JWT_SECRET_KEY"],
            algorithms=["HS256"],
            options=decode_options,
        )
        user_id = payload.get("sub")
        if not user_id:
            return None
        return User.query.get(user_id)
    except jwt.InvalidTokenError:
        return None


def get_current_user() -> User | None:
    """Decode JWT, check blacklist, return User or None."""
    token = _get_bearer_token()
    if not token:
        token = (request.args.get("token") or "").strip() or None
    return get_user_from_token(token)


def require_auth(f):
    """Decorator: require valid JWT (any authenticated user). Injects current_user as kwarg."""
    @wraps(f)
    def wrapped(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, current_user=user, **kwargs)
    return wrapped


def require_admin(f):
    """Decorator: require valid JWT and admin role. Injects current_user as kwarg."""
    @wraps(f)
    def wrapped(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({"error": "Authentication required"}), 401
        if user.role != "admin":
            return jsonify({"error": "Admin access required"}), 403
        return f(*args, current_user=user, **kwargs)
    return wrapped


def require_admin_or_hr_access(f):
    """Global admin, or any user with RBAC access to the HR module (admin/user columns are equivalent)."""
    @wraps(f)
    def wrapped(*args, **kwargs):
        from app.services.rbac_service import can_access_page

        user = get_current_user()
        if not user:
            return jsonify({"error": "Authentication required"}), 401
        if user.role == "admin" or can_access_page(user, "hr"):
            return f(*args, current_user=user, **kwargs)
        return jsonify({"error": "Access denied"}), 403
    return wrapped


def require_admin_or_accounts_access(f):
    """Global admin, or any user with RBAC access to Accounts (user column is treated as admin in rbac_service)."""
    @wraps(f)
    def wrapped(*args, **kwargs):
        from app.services.rbac_service import can_access_page

        user = get_current_user()
        if not user:
            return jsonify({"error": "Authentication required"}), 401
        if user.role == "admin" or can_access_page(user, "accounts"):
            return f(*args, current_user=user, **kwargs)
        return jsonify({"error": "Admin access required"}), 403
    return wrapped


def require_attendance_module_access(f):
    """Authenticated user with RBAC access to the Attendance module (user or admin scope)."""
    @wraps(f)
    def wrapped(*args, **kwargs):
        from app.services.rbac_service import can_access_page

        user = get_current_user()
        if not user:
            return jsonify({"error": "Authentication required"}), 401
        if not can_access_page(user, "attendance"):
            return jsonify({"error": "Access denied"}), 403
        return f(*args, current_user=user, **kwargs)
    return wrapped


def require_attendance_all_records_view(f):
    """View all employees' attendance: global admin, HR module access, or Attendance page admin scope."""
    @wraps(f)
    def wrapped(*args, **kwargs):
        from app.services.rbac_service import can_access_page, is_page_scope_admin

        user = get_current_user()
        if not user:
            return jsonify({"error": "Authentication required"}), 401
        if (
            user.role == "admin"
            or can_access_page(user, "hr")
            or is_page_scope_admin(user, "attendance")
        ):
            return f(*args, current_user=user, **kwargs)
        return jsonify({"error": "Access denied"}), 403
    return wrapped


def require_attendance_reconciliation_review(f):
    """Approve/reject reconciliation: global admin or Attendance page admin scope (not HR-only)."""
    @wraps(f)
    def wrapped(*args, **kwargs):
        from app.services.rbac_service import is_page_scope_admin

        user = get_current_user()
        if not user:
            return jsonify({"error": "Authentication required"}), 401
        if user.role == "admin" or is_page_scope_admin(user, "attendance"):
            return f(*args, current_user=user, **kwargs)
        return jsonify({"error": "Access denied"}), 403
    return wrapped
