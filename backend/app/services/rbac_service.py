"""
RBAC: per-page access type none | user | admin.

- none: no route/module access
- user: may access page; data scope is own records (enforced per API in later steps)
- admin: may access page; data scope is all records where applicable

Resolution order for a user and page:
0) Global system admin (User.role == admin) -> admin on every module (RBAC overrides ignored)
1) Per-user override (user_page_permissions)
2) Role default (role_page_defaults) for global User.role (admin | user)
3) Built-in fallback: global admin -> admin page access; global user -> user page access
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from app import db
from app.models import RolePageDefault, User, UserPagePermission
from app.page_keys import PAGE_KEYS, PAGE_LABELS, validate_page_key

ACCESS_NONE = "none"
ACCESS_USER = "user"
ACCESS_ADMIN = "admin"

ALL_ACCESS_TYPES: tuple[str, ...] = (ACCESS_NONE, ACCESS_USER, ACCESS_ADMIN)
SYSTEM_ROLES: tuple[str, ...] = ("admin", "user")


def validate_access_type(access_type: str) -> None:
    if access_type not in ALL_ACCESS_TYPES:
        raise ValueError(f"Invalid accessType: {access_type!r}; expected one of {ALL_ACCESS_TYPES}")


def validate_system_role(role: str) -> None:
    r = (role or "").strip()
    if r not in SYSTEM_ROLES:
        raise ValueError(f"Invalid role: {role!r}; expected one of {SYSTEM_ROLES}")


def _builtin_access_for_global_role(role: str) -> str:
    if role == "admin":
        return ACCESS_ADMIN
    return ACCESS_USER


def get_role_template_access(role: str, page_key: str) -> str:
    """Default access for a global role + page when no per-user row exists."""
    validate_page_key(page_key)
    validate_system_role(role)
    row = RolePageDefault.query.filter_by(role=role, page_key=page_key).first()
    if row:
        return row.access_type
    return _builtin_access_for_global_role(role)


def get_effective_page_access(user: User | None, page_key: str) -> str:
    """
    Effective access for the signed-in user and module.
    """
    if not user or not getattr(user, "is_active", True):
        return ACCESS_NONE
    validate_page_key(page_key)
    if getattr(user, "role", "") == "admin":
        return ACCESS_ADMIN
    row_u = UserPagePermission.query.filter_by(user_id=user.id, page_key=page_key).first()
    if row_u:
        access = row_u.access_type
    else:
        ur = getattr(user, "role", "") or "user"
        if ur not in SYSTEM_ROLES:
            ur = "user"
        access = get_role_template_access(ur, page_key)
    # HR module: RBAC "admin" vs "user" column are equivalent (same data scope and actions).
    if page_key == "hr" and access == ACCESS_USER:
        return ACCESS_ADMIN
    # Accounts module: RBAC "user" has the same access as "admin" (full journal entries + particulars).
    if page_key == "accounts" and access == ACCESS_USER:
        return ACCESS_ADMIN
    # Leaves module: RBAC admin vs user are equivalent (own requests + team as reporting manager; APIs enforce).
    if page_key == "leaves" and access != ACCESS_NONE:
        return ACCESS_USER
    return access


def get_effective_permissions_map(user: User | None) -> dict[str, str]:
    if not user or not getattr(user, "is_active", True):
        return {pk: ACCESS_NONE for pk in PAGE_KEYS}
    return {pk: get_effective_page_access(user, pk) for pk in PAGE_KEYS}


def get_explicit_nav_page_keys(user: User | None) -> list[str]:
    """
    Modules with an explicit user_page_permissions row (access admin or user).
    Used for non-admin nav; global admins bypass this list for sidebar/routes.
    """
    if not user or not getattr(user, "is_active", True):
        return []
    rows = (
        UserPagePermission.query.filter_by(user_id=user.id)
        .filter(UserPagePermission.access_type.in_((ACCESS_ADMIN, ACCESS_USER)))
        .all()
    )
    keys = {r.page_key for r in rows if r.page_key in PAGE_KEYS}
    return sorted(keys)


def get_nav_page_keys_for_user(user: User | None) -> list[str]:
    """
    Keys allowed for sidebar + client route checks: all modules for global role admin;
    otherwise only explicit RBAC assignments (admin/user columns).
    """
    if not user or not getattr(user, "is_active", True):
        return []
    if getattr(user, "role", "") == "admin":
        return list(PAGE_KEYS)
    return get_explicit_nav_page_keys(user)


def can_access_page(user: User | None, page_key: str) -> bool:
    return get_effective_page_access(user, page_key) != ACCESS_NONE


def is_page_scope_admin(user: User | None, page_key: str) -> bool:
    """True if user may see all data on this module (global admin or RBAC admin scope)."""
    return get_effective_page_access(user, page_key) == ACCESS_ADMIN


def is_page_scope_own_data_only(user: User | None, page_key: str) -> bool:
    return get_effective_page_access(user, page_key) == ACCESS_USER


def get_role_defaults_matrix() -> dict[str, dict[str, str]]:
    """Full matrix for Settings RBAC UI: role -> pageKey -> accessType."""
    return {
        role: {pk: get_role_template_access(role, pk) for pk in PAGE_KEYS}
        for role in SYSTEM_ROLES
    }


def upsert_role_defaults(role: str, items: list[dict[str, Any]]) -> None:
    validate_system_role(role)
    for item in items:
        page_key = (item.get("pageKey") or "").strip()
        access_type = (item.get("accessType") or "").strip()
        validate_page_key(page_key)
        validate_access_type(access_type)
        row = RolePageDefault.query.filter_by(role=role, page_key=page_key).first()
        if row:
            row.access_type = access_type
            row.updated_at = datetime.utcnow()
        else:
            db.session.add(
                RolePageDefault(
                    role=role,
                    page_key=page_key,
                    access_type=access_type,
                )
            )
    db.session.commit()


def list_explicit_user_permissions(user_id: str) -> list[dict[str, Any]]:
    rows = (
        UserPagePermission.query.filter_by(user_id=user_id)
        .order_by(UserPagePermission.page_key)
        .all()
    )
    return [r.to_dict() for r in rows]


def get_rbac_summary_for_user(user: User) -> dict[str, Any]:
    return {
        "userId": user.id,
        "explicit": list_explicit_user_permissions(user.id),
        "effective": get_effective_permissions_map(user),
    }


def upsert_user_permissions(user_id: str, items: list[dict[str, Any]]) -> None:
    user = User.query.get(user_id)
    if not user:
        raise ValueError("User not found")
    for item in items:
        page_key = (item.get("pageKey") or "").strip()
        access_type = (item.get("accessType") or "").strip()
        validate_page_key(page_key)
        validate_access_type(access_type)
        row = UserPagePermission.query.filter_by(user_id=user_id, page_key=page_key).first()
        if row:
            row.access_type = access_type
            row.updated_at = datetime.utcnow()
        else:
            db.session.add(
                UserPagePermission(
                    user_id=user_id,
                    page_key=page_key,
                    access_type=access_type,
                )
            )
    db.session.commit()


def batch_assign_users_same_page(user_ids: list[Any], page_key: str, access_type: str) -> None:
    """Assign many users to the same module + admin/user scope in one transaction."""
    page_key = (page_key or "").strip()
    access_type = (access_type or "").strip()
    if not page_key:
        raise ValueError("pageKey is required")
    validate_page_key(page_key)
    if access_type not in (ACCESS_ADMIN, ACCESS_USER):
        raise ValueError("accessType must be admin or user")
    if not isinstance(user_ids, list):
        raise ValueError("userIds must be an array")

    seen: set[str] = set()
    unique: list[str] = []
    for raw in user_ids:
        uid = (str(raw) if raw is not None else "").strip()
        if not uid or uid in seen:
            continue
        seen.add(uid)
        unique.append(uid)

    if not unique:
        return

    for uid in unique:
        user = User.query.get(uid)
        if not user:
            raise ValueError(f"User not found: {uid}")
        row = UserPagePermission.query.filter_by(user_id=uid, page_key=page_key).first()
        if row:
            row.access_type = access_type
            row.updated_at = datetime.utcnow()
        else:
            db.session.add(
                UserPagePermission(
                    user_id=uid,
                    page_key=page_key,
                    access_type=access_type,
                )
            )
    db.session.commit()


def delete_explicit_user_permission(user_id: str, page_key: str) -> bool:
    validate_page_key(page_key)
    row = UserPagePermission.query.filter_by(user_id=user_id, page_key=page_key).first()
    if not row:
        return False
    db.session.delete(row)
    db.session.commit()
    return True


def _user_summary(u: User) -> dict[str, Any]:
    return {
        "id": u.id,
        "name": u.name or "",
        "email": u.email or "",
    }


def get_assignment_matrix() -> dict[str, Any]:
    """
    For Settings RBAC grid: per module, list users with explicit admin vs user access.
    Users without a row still follow role defaults (not listed here).
    """
    rows = (
        UserPagePermission.query.filter(
            UserPagePermission.access_type.in_((ACCESS_ADMIN, ACCESS_USER)),
        ).all()
    )
    buckets: dict[str, dict[str, list[dict[str, Any]]]] = {
        pk: {"admin": [], "user": []} for pk in PAGE_KEYS
    }
    for row in rows:
        if row.page_key not in buckets:
            continue
        u = User.query.get(row.user_id)
        if not u:
            continue
        mini = _user_summary(u)
        if row.access_type == ACCESS_ADMIN:
            buckets[row.page_key]["admin"].append(mini)
        else:
            buckets[row.page_key]["user"].append(mini)
    for pk in buckets:
        for col in ("admin", "user"):
            buckets[pk][col].sort(key=lambda x: (x.get("name") or "").lower())
    return {
        "pages": [{"pageKey": k, "label": PAGE_LABELS.get(k, k)} for k in PAGE_KEYS],
        "assignments": buckets,
    }
