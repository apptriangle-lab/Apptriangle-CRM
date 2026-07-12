"""
Helpers for RBAC checks in Flask blueprints. Business rules live in rbac_service.
"""
from app.models import User
from app.services import rbac_service

ACCESS_NONE = rbac_service.ACCESS_NONE
ACCESS_USER = rbac_service.ACCESS_USER
ACCESS_ADMIN = rbac_service.ACCESS_ADMIN

get_effective_page_access = rbac_service.get_effective_page_access
get_effective_permissions_map = rbac_service.get_effective_permissions_map
can_access_page = rbac_service.can_access_page
is_page_scope_admin = rbac_service.is_page_scope_admin
is_page_scope_own_data_only = rbac_service.is_page_scope_own_data_only

# --- Sales module (funnel / orders / renewals) ---
PAGE_KEY_SALES = "sales"


def has_sales_module_access(user: User | None) -> bool:
    """Any authenticated user with Sales module access (nav), or global admin."""
    if not user or not getattr(user, "is_active", True):
        return False
    if getattr(user, "role", "") == "admin":
        return True
    return get_effective_page_access(user, PAGE_KEY_SALES) != ACCESS_NONE


def has_full_sales_scope(user: User | None) -> bool:
    """Global admin or Sales RBAC admin column: all funnel, orders, renewals."""
    if not user or not getattr(user, "is_active", True):
        return False
    if getattr(user, "role", "") == "admin":
        return True
    return get_effective_page_access(user, PAGE_KEY_SALES) == ACCESS_ADMIN


PAGE_KEY_COMPANIES = "companies"


def has_companies_page_admin_scope(user: User | None) -> bool:
    """Global admin or Companies RBAC admin — full company directory; may create/view deals on any company."""
    if not user or not getattr(user, "is_active", True):
        return False
    if getattr(user, "role", "") == "admin":
        return True
    return get_effective_page_access(user, PAGE_KEY_COMPANIES) == ACCESS_ADMIN


PAGE_KEY_RFQ = "rfq"


def has_rfq_module_access(user: User | None) -> bool:
    if not user or not getattr(user, "is_active", True):
        return False
    if getattr(user, "role", "") == "admin":
        return True
    return get_effective_page_access(user, PAGE_KEY_RFQ) != ACCESS_NONE


def can_rfq_pricing_input(user: User | None) -> bool:
    """RBAC admin on RFQ page or global system admin — may enter buying/selling prices."""
    if not user or not getattr(user, "is_active", True):
        return False
    if getattr(user, "role", "") == "admin":
        return True
    return get_effective_page_access(user, PAGE_KEY_RFQ) == ACCESS_ADMIN


def is_global_system_admin(user: User | None) -> bool:
    """Global User.role admin — final RFQ approve/reject."""
    return bool(user and getattr(user, "is_active", True) and getattr(user, "role", "") == "admin")


PAGE_KEY_PMS = "pms"
PAGE_KEY_LUNCH = "lunch"


def has_lunch_module_access(user: User | None) -> bool:
    """Global admin or any Lunch RBAC access (user/admin)."""
    if not user or not getattr(user, "is_active", True):
        return False
    if is_global_system_admin(user):
        return True
    return get_effective_page_access(user, PAGE_KEY_LUNCH) != ACCESS_NONE


def has_lunch_admin_scope(user: User | None) -> bool:
    """Global admin or Lunch RBAC admin — manage any poll regardless of creator."""
    if not user or not getattr(user, "is_active", True):
        return False
    if is_global_system_admin(user):
        return True
    return get_effective_page_access(user, PAGE_KEY_LUNCH) == ACCESS_ADMIN


def has_pms_module_access(user: User | None) -> bool:
    from app.pms_permissions import has_pms_module_access as _has

    return _has(user)


def has_pms_admin_scope(user: User | None) -> bool:
    from app.pms_permissions import is_pms_admin

    return is_pms_admin(user)
