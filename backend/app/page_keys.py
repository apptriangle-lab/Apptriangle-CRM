"""
Canonical CRM modules for RBAC. Keys align with frontend routes / sidebar areas.

Detail URLs (e.g. /tasks/:id) use the same page_key as their parent module.
"""
from typing import Tuple

# Application modules — single source of truth for RBAC matrix and APIs
PAGE_KEYS: Tuple[str, ...] = (
    "dashboard",
    "tasks",
    "sales",
    "rfq",
    "leaves",
    "attendance",
    "expenses",
    "accounts",
    "contacts",
    "companies",
    "hr",
    "credentials",
    "pms",
    "lunch",
    "settings",
)

PAGE_LABELS: dict[str, str] = {
    "dashboard": "Dashboard",
    "tasks": "Tasks",
    "sales": "Sales",
    "rfq": "RFQ",
    "leaves": "Leaves",
    "attendance": "Attendance",
    "expenses": "Expenses",
    "accounts": "Accounts",
    "contacts": "Contacts",
    "companies": "Companies",
    "hr": "HR",
    "credentials": "Credentials",
    "pms": "PMS",
    "lunch": "Lunch",
    "settings": "Settings",
}


def is_valid_page_key(page_key: str) -> bool:
    return bool(page_key) and page_key in PAGE_KEYS


def validate_page_key(page_key: str) -> None:
    if not is_valid_page_key(page_key):
        raise ValueError(f"Invalid pageKey: {page_key!r}")
