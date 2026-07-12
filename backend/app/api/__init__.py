from app.api.auth import auth_bp
from app.api.users import users_bp
from app.api.companies import companies_bp
from app.api.contacts import contacts_bp
from app.api.tasks import tasks_bp
from app.api.sales import sales_bp
from app.api.status_config import status_config_bp
from app.api.company_profile import company_profile_bp
from app.api.currencies import currencies_bp
from app.api.expense_purposes import expense_purposes_bp
from app.api.expenses import expenses_bp
from app.api.accounts import accounts_bp
from app.api.account_particulars import account_particulars_bp
from app.api.hr import hr_bp
from app.api.departments import departments_bp
from app.api.designations import designations_bp
from app.api.employee_types import employee_types_bp
from app.api.attendance import attendance_bp
from app.api.leaves import leaves_bp
from app.api.shifts import shifts_bp
from app.api.notifications import notifications_bp
from app.api.renewals import renewals_bp
from app.api.orders import orders_bp
from app.api.rbac import rbac_bp
from app.api.credentials import credentials_bp
from app.api.rfq import rfq_bp
from app.api.pms import pms_bp
from app.api.pms_project_types import pms_project_types_bp
from app.api.report_automations import report_automations_bp
from app.api.lunch import lunch_bp
from app.api.integrations import integrations_bp

__all__ = [
    "auth_bp",
    "users_bp",
    "companies_bp",
    "contacts_bp",
    "tasks_bp",
    "sales_bp",
    "status_config_bp",
    "company_profile_bp",
    "currencies_bp",
    "expense_purposes_bp",
    "expenses_bp",
    "accounts_bp",
    "account_particulars_bp",
    "hr_bp",
    "departments_bp",
    "designations_bp",
    "employee_types_bp",
    "attendance_bp",
    "leaves_bp",
    "shifts_bp",
    "notifications_bp",
    "renewals_bp",
    "orders_bp",
    "rbac_bp",
    "credentials_bp",
    "rfq_bp",
    "pms_bp",
    "pms_project_types_bp",
    "report_automations_bp",
    "lunch_bp",
    "integrations_bp",
]
