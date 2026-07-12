"""
PMS capability checks on top of existing RBAC (page_key ``pms``, access admin|user|none).

- System Admin: global ``User.role == admin``
- PMS Admin: module RBAC admin on ``pms``
- PMS User: module RBAC user on ``pms`` (invited projects only for data scope)
"""
from __future__ import annotations

from app.models import User
from app.services import rbac_service

PAGE_KEY_PMS = "pms"

# Granular permission keys (for docs / future UI); enforced via helpers below.
PMS_PERMISSIONS = (
    "pms.dashboard.view",
    "pms.project.view_all",
    "pms.project.view_invited",
    "pms.project.create",
    "pms.project.update",
    "pms.project.delete",
    "pms.project.invite_user",
    "pms.project.remove_user",
    "pms.task.view",
    "pms.task.create",
    "pms.task.update",
    "pms.task.delete",
    "pms.task.update_status",
    "pms.comment.create",
    "pms.comment.update",
    "pms.comment.delete",
    "pms.attachment.upload",
    "pms.attachment.delete",
    "pms.report.view",
    "pms.report.export",
    "pms.settings.manage",
    "pms.resource.view",
)


def is_system_admin(user: User | None) -> bool:
    return bool(user and getattr(user, "is_active", True) and getattr(user, "role", "") == "admin")


def has_pms_module_access(user: User | None) -> bool:
    if not user or not getattr(user, "is_active", True):
        return False
    if is_system_admin(user):
        return True
    return rbac_service.get_effective_page_access(user, PAGE_KEY_PMS) != rbac_service.ACCESS_NONE


def is_pms_admin(user: User | None) -> bool:
    """System admin or PMS module admin scope — all projects."""
    if not user or not getattr(user, "is_active", True):
        return False
    if is_system_admin(user):
        return True
    return rbac_service.get_effective_page_access(user, PAGE_KEY_PMS) == rbac_service.ACCESS_ADMIN


def is_pms_user_only(user: User | None) -> bool:
    return has_pms_module_access(user) and not is_pms_admin(user)


def user_has_permission(user: User | None, perm: str) -> bool:
    """Map granular permission strings to role capabilities (Phase 1)."""
    if not has_pms_module_access(user):
        return False
    admin = is_pms_admin(user)

    if perm in (
        "pms.settings.manage",
        "pms.report.view",
        "pms.report.export",
        "pms.dashboard.view",
        "pms.resource.view",
    ):
        return admin
    if perm in (
        "pms.project.create",
        "pms.project.update",
        "pms.project.delete",
        "pms.project.invite_user",
        "pms.project.remove_user",
        "pms.project.view_all",
        "pms.comment.delete",
        "pms.attachment.delete",
    ):
        return admin
    if perm == "pms.task.delete":
        return True
    if perm == "pms.project.view_invited":
        return True
    if perm in (
        "pms.task.view",
        "pms.task.create",
        "pms.task.update_status",
        "pms.comment.create",
        "pms.attachment.upload",
    ):
        return True
    if perm in ("pms.task.update", "pms.comment.update"):
        return True
    return admin
