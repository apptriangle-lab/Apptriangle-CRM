import os
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS

db = SQLAlchemy()
migrate = Migrate()

# Default admin credentials (created on every startup if missing)
ADMIN_EMAIL = os.environ.get("CRM_ADMIN_EMAIL", "admin@apptriangle.com")
ADMIN_PASSWORD = os.environ.get("CRM_ADMIN_PASSWORD", "admin123")


def create_app(config_overrides=None):
    app = Flask(__name__)
    app.config.from_object("app.config.Config")
    if config_overrides:
        app.config.update(config_overrides)

    db.init_app(app)
    migrate.init_app(app, db)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    from app.api import auth_bp, users_bp, companies_bp, contacts_bp, tasks_bp, sales_bp, status_config_bp, company_profile_bp, currencies_bp, expense_purposes_bp, expenses_bp, accounts_bp, account_particulars_bp, hr_bp, departments_bp, designations_bp, employee_types_bp, attendance_bp, leaves_bp, shifts_bp, notifications_bp, renewals_bp, orders_bp, rbac_bp, credentials_bp, rfq_bp, pms_bp, pms_project_types_bp, report_automations_bp, lunch_bp, integrations_bp
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(users_bp, url_prefix="/api/users")
    app.register_blueprint(companies_bp, url_prefix="/api/companies")
    app.register_blueprint(contacts_bp, url_prefix="/api/contacts")
    app.register_blueprint(tasks_bp, url_prefix="/api/tasks")
    app.register_blueprint(sales_bp, url_prefix="/api/sales")
    app.register_blueprint(status_config_bp, url_prefix="/api/status-config")
    app.register_blueprint(company_profile_bp, url_prefix="/api/company-profile")
    app.register_blueprint(currencies_bp, url_prefix="/api/currencies")
    app.register_blueprint(expense_purposes_bp, url_prefix="/api/expense-purposes")
    app.register_blueprint(expenses_bp, url_prefix="/api/expenses")
    app.register_blueprint(accounts_bp, url_prefix="/api/accounts")
    app.register_blueprint(account_particulars_bp, url_prefix="/api/account-particulars")
    app.register_blueprint(hr_bp, url_prefix="/api/hr")
    app.register_blueprint(departments_bp, url_prefix="/api/departments")
    app.register_blueprint(designations_bp, url_prefix="/api/designations")
    app.register_blueprint(employee_types_bp, url_prefix="/api/employee-types")
    app.register_blueprint(attendance_bp, url_prefix="/api/attendance")
    app.register_blueprint(leaves_bp, url_prefix="/api/leaves")
    app.register_blueprint(shifts_bp, url_prefix="/api/shifts")
    app.register_blueprint(notifications_bp, url_prefix="/api/notifications")
    app.register_blueprint(renewals_bp, url_prefix="/api/renewals")
    app.register_blueprint(orders_bp, url_prefix="/api/orders")
    app.register_blueprint(rbac_bp, url_prefix="/api/rbac")
    app.register_blueprint(credentials_bp, url_prefix="/api/credentials")
    app.register_blueprint(rfq_bp, url_prefix="/api/rfqs")
    app.register_blueprint(pms_bp, url_prefix="/api/pms")
    app.register_blueprint(pms_project_types_bp, url_prefix="/api/pms/project-types")
    app.register_blueprint(report_automations_bp, url_prefix="/api/report-automations")
    app.register_blueprint(lunch_bp, url_prefix="/api/lunch")
    app.register_blueprint(integrations_bp, url_prefix="/api/integrations")

    with app.app_context():
        _run_startup_migrations(app)
        _log_persistent_storage_paths(app)

    return app


def _log_persistent_storage_paths(app):
    """Warn when uploads live on ephemeral app disk (common cause of lost files on redeploy)."""
    from app.config import BASE_DIR, INSTANCE_DIR, PMS_UPLOAD_DIR, instance_dir_is_inside_app

    app.logger.info("Persistent storage: INSTANCE_DIR=%s PMS_UPLOAD_DIR=%s", INSTANCE_DIR, PMS_UPLOAD_DIR)
    if instance_dir_is_inside_app():
        app.logger.warning(
            "Uploads and local files are stored under the app directory (%s). "
            "Many hosts wipe this folder on redeploy. Mount persistent storage and set "
            "INSTANCE_DIR (and optionally PMS_UPLOAD_DIR) to that mount path.",
            BASE_DIR,
        )


def _run_startup_migrations(app):
    """Run DB bootstrap steps with progress logging (avoids silent hangs on MySQL locks)."""
    steps = [
        ("ensure tables", lambda: ensure_missing_tables()),
        ("lunch balance column", lambda: add_users_lunch_balance_column_if_missing()),
        ("lunch tables", lambda: ensure_lunch_tables()),
        ("lunch poll end time column", lambda: add_lunch_poll_end_time_column_if_missing()),
        ("lunch poll ends_at column", lambda: add_lunch_poll_ends_at_column_if_missing()),
        ("lunch poll date unique drop", lambda: drop_lunch_poll_date_unique_if_present()),
        ("admin user", lambda: ensure_admin_user(app)),
        ("status config column", lambda: add_status_config_is_active_column_if_missing(app)),
        ("seed status config", lambda: seed_status_config(app)),
        ("pending order status", lambda: ensure_pending_order_status_exists(app)),
        ("seed currencies", lambda: seed_currencies(app)),
        ("company currency column", lambda: add_company_currency_column_if_missing(app)),
        ("expense amount return column", lambda: add_expense_amount_return_column_if_missing(app)),
        ("expense location columns", lambda: add_expense_location_columns_if_missing(app)),
        ("expense purposes table", lambda: ensure_expense_purposes_table(app)),
        ("expense purpose is_active column", lambda: add_expense_purpose_is_active_column_if_missing(app)),
        ("expense purpose id column", lambda: add_expense_purpose_id_column_if_missing(app)),
        ("expense deleted_at column", lambda: add_expense_deleted_at_column_if_missing(app)),
        ("contacts created_by column", lambda: add_contacts_created_by_user_id_column_if_missing(app)),
        ("account entries table", lambda: ensure_account_entries_table(app)),
        ("account entries attachment columns", lambda: add_account_entries_attachment_columns_if_missing(app)),
        ("account entries description column", lambda: add_account_entries_description_column_if_missing(app)),
        ("account entries amounts migration", lambda: migrate_account_entries_amounts_to_numeric(app)),
        ("account particulars table", lambda: ensure_account_particulars_table(app)),
        ("seed account particulars", lambda: seed_account_particulars_demo(app)),
        ("employment history activity columns", lambda: add_employment_history_activity_columns_if_missing(app)),
        ("academic certification attachment columns", lambda: add_academic_certification_attachment_columns_if_missing(app)),
        ("emergency contacts table", lambda: ensure_emergency_contacts_table(app)),
        ("departments table", lambda: ensure_departments_table(app)),
        ("designations table", lambda: ensure_designations_table(app)),
        ("employee types table", lambda: ensure_employee_types_table(app)),
        ("attendance table", lambda: ensure_attendance_table(app)),
        ("attendance reconciliations table", lambda: ensure_attendance_reconciliations_table(app)),
        ("hr info joining date column", lambda: add_hr_info_joining_date_column_if_missing(app)),
        ("leaves table", lambda: ensure_leaves_table(app)),
        ("leave types table", lambda: ensure_leave_types_table(app)),
        ("employee leave balances table", lambda: ensure_employee_leave_balances_table(app)),
        ("seed leave types", lambda: seed_leave_types(app)),
        ("leave duration columns", lambda: ensure_leave_duration_columns(app)),
        ("leave half day period column", lambda: ensure_leave_half_day_period_column(app)),
        ("additional leave days column", lambda: ensure_additional_leave_days_column(app)),
        ("weekends table", lambda: ensure_weekends_table(app)),
        ("holidays table", lambda: ensure_holidays_table(app)),
        ("holidays date range migration", lambda: migrate_holidays_to_date_range(app)),
        ("shifts table", lambda: ensure_shifts_table(app)),
        ("hr info shift id column", lambda: add_hr_info_shift_id_column_if_missing(app)),
        ("hr info bank columns", lambda: add_hr_info_bank_columns_if_missing(app)),
        ("renewals table", lambda: ensure_renewals_table(app)),
        ("renewals deleted_at column", lambda: add_renewals_deleted_at_column_if_missing(app)),
        ("renewals type column", lambda: add_renewals_type_column_if_missing(app)),
        ("orders table", lambda: ensure_orders_table(app)),
        ("orders forwarded_to column", lambda: add_orders_forwarded_to_column_if_missing(app)),
        ("sales next action columns", lambda: add_sales_next_action_columns_if_missing(app)),
        ("credentials tables", lambda: ensure_credentials_tables(app)),
        ("rfqs pricing assignee column", lambda: add_rfqs_pricing_assignee_column_if_missing(app)),
        ("rfqs vat percent column", lambda: add_rfqs_vat_percent_column_if_missing(app)),
        ("rfqs version number column", lambda: add_rfqs_version_number_column_if_missing(app)),
        ("rfq items vat percent column", lambda: add_rfq_items_vat_percent_column_if_missing(app)),
        ("report execution log recipient ids", lambda: ensure_report_execution_log_recipient_ids_column(app)),
        ("report execution log is_manual column", lambda: ensure_report_execution_log_is_manual_column(app)),
    ]
    import time

    t0 = time.time()
    for label, fn in steps:
        step_start = time.time()
        try:
            fn()
        except Exception as e:
            print(f"Startup migration [{label}] failed: {e}")
        elapsed = time.time() - step_start
        if elapsed > 2:
            print(f"Startup migration [{label}] took {elapsed:.1f}s")
    print(f"Startup migrations finished in {time.time() - t0:.1f}s")


def add_users_lunch_balance_column_if_missing():
    """Add lunch_balance column to users table."""
    from sqlalchemy import inspect, text

    try:
        inspector = inspect(db.engine)
        if not inspector.has_table("users"):
            return
        cols = {c["name"] for c in inspector.get_columns("users")}
        if "lunch_balance" in cols:
            return
        dialect = db.engine.dialect.name
        if dialect == "mysql":
            # Fail fast instead of hanging forever if another session holds a metadata lock.
            db.session.execute(text("SET SESSION lock_wait_timeout = 10"))
            db.session.execute(
                text("ALTER TABLE users ADD COLUMN lunch_balance DECIMAL(10, 2) NOT NULL DEFAULT 0")
            )
        else:
            db.session.execute(text("ALTER TABLE users ADD COLUMN lunch_balance NUMERIC(10, 2) DEFAULT 0"))
        db.session.commit()
        print("✓ Added users.lunch_balance column.")
    except Exception as e:
        db.session.rollback()
        print("add_users_lunch_balance_column_if_missing:", e)


def ensure_lunch_tables():
    """Create lunch module tables if missing (settings row seeded on first create)."""
    from sqlalchemy import inspect

    try:
        from app import lunch_models  # noqa: F401

        inspector = inspect(db.engine)
        needed = ("lunch_settings", "lunch_polls", "lunch_poll_options", "lunch_votes", "lunch_balance_transactions")
        if all(inspector.has_table(t) for t in needed):
            return
        db.create_all()
        from app.services import lunch_service

        lunch_service.get_or_create_settings()
        print("✓ Created lunch module tables.")
    except Exception as e:
        db.session.rollback()
        print("ensure_lunch_tables failed:", e)


def add_lunch_poll_end_time_column_if_missing():
    """Add end_time (HH:MM Dhaka) to lunch_polls for poll closing countdown."""
    from sqlalchemy import inspect, text

    try:
        inspector = inspect(db.engine)
        if not inspector.has_table("lunch_polls"):
            return
        cols = {c["name"] for c in inspector.get_columns("lunch_polls")}
        if "end_time" in cols:
            return
        dialect = db.engine.dialect.name
        if dialect == "mysql":
            db.session.execute(text("ALTER TABLE lunch_polls ADD COLUMN end_time VARCHAR(5) NULL"))
        elif dialect == "sqlite":
            db.session.execute(text("ALTER TABLE lunch_polls ADD COLUMN end_time VARCHAR(5)"))
        else:
            db.session.execute(text("ALTER TABLE lunch_polls ADD COLUMN end_time VARCHAR(5) NULL"))
        db.session.commit()
        print("✓ Added lunch_polls.end_time column.")
    except Exception as e:
        db.session.rollback()
        print("add_lunch_poll_end_time_column_if_missing:", e)


def add_lunch_poll_ends_at_column_if_missing():
    """Add ends_at (UTC) for absolute poll close when extending finished polls."""
    from sqlalchemy import inspect, text

    try:
        inspector = inspect(db.engine)
        if not inspector.has_table("lunch_polls"):
            return
        cols = {c["name"] for c in inspector.get_columns("lunch_polls")}
        if "ends_at" in cols:
            return
        dialect = db.engine.dialect.name
        if dialect == "mysql":
            db.session.execute(text("ALTER TABLE lunch_polls ADD COLUMN ends_at DATETIME NULL"))
        elif dialect == "sqlite":
            db.session.execute(text("ALTER TABLE lunch_polls ADD COLUMN ends_at DATETIME"))
        else:
            db.session.execute(text("ALTER TABLE lunch_polls ADD COLUMN ends_at DATETIME NULL"))
        db.session.commit()
        print("✓ Added lunch_polls.ends_at column.")
    except Exception as e:
        db.session.rollback()
        print("add_lunch_poll_ends_at_column_if_missing:", e)


def drop_lunch_poll_date_unique_if_present():
    """Allow multiple lunch polls on the same calendar day (max enforced in service)."""
    from sqlalchemy import inspect, text

    try:
        inspector = inspect(db.engine)
        if not inspector.has_table("lunch_polls"):
            return
        dialect = db.engine.dialect.name
        if dialect != "mysql":
            return
        for uc in inspector.get_unique_constraints("lunch_polls"):
            cols = uc.get("column_names") or []
            if "poll_date" not in cols:
                continue
            name = uc.get("name")
            if not name:
                continue
            db.session.execute(text(f"ALTER TABLE lunch_polls DROP INDEX `{name}`"))
            db.session.commit()
            print(f"✓ Dropped unique index {name} on lunch_polls.poll_date.")
        indexes = inspector.get_indexes("lunch_polls")
        has_poll_date_index = any("poll_date" in (idx.get("column_names") or []) for idx in indexes)
        if not has_poll_date_index:
            try:
                db.session.execute(text("CREATE INDEX ix_lunch_polls_poll_date ON lunch_polls (poll_date)"))
                db.session.commit()
                print("✓ Added non-unique index on lunch_polls.poll_date.")
            except Exception:
                db.session.rollback()
    except Exception as e:
        db.session.rollback()
        print("drop_lunch_poll_date_unique_if_present:", e)


def ensure_missing_tables():
    """
    Create ORM tables that are missing. Safe on every startup; does not alter existing tables.
    New models in app/models.py are picked up automatically after import.
    """
    from app import models  # noqa: F401
    from app import pms_models  # noqa: F401
    from app import lunch_models  # noqa: F401

    try:
        db.create_all()
        _ensure_pms_sprint_schema()
        _ensure_pms_task_end_date_schema()
        _ensure_pms_project_type_schema()
        _ensure_notification_category_schema()
        _seed_default_pms_project_types()
        _backfill_pms_task_assignees()
    except Exception as e:
        print("ensure_missing_tables (create_all) failed:", e)


def _ensure_pms_sprint_schema():
    """Add pms_sprints table (create_all) and sprint_id column on pms_tasks if missing."""
    from sqlalchemy import inspect, text

    try:
        inspector = inspect(db.engine)
        if inspector.has_table("pms_tasks"):
            cols = {c["name"] for c in inspector.get_columns("pms_tasks")}
            if "sprint_id" not in cols:
                dialect = db.engine.dialect.name
                if dialect == "mysql":
                    db.session.execute(
                        text(
                            "ALTER TABLE pms_tasks ADD COLUMN sprint_id VARCHAR(40) NULL, "
                            "ADD INDEX ix_pms_tasks_sprint_id (sprint_id)"
                        )
                    )
                elif dialect == "sqlite":
                    db.session.execute(text("ALTER TABLE pms_tasks ADD COLUMN sprint_id VARCHAR(40)"))
                else:
                    db.session.execute(text("ALTER TABLE pms_tasks ADD COLUMN sprint_id VARCHAR(40) NULL"))
                db.session.commit()
                print("[ok] pms_tasks.sprint_id column added")
    except Exception as e:
        db.session.rollback()
        print("Note: pms sprint schema migration:", e)


def _ensure_pms_task_end_date_schema():
    """Migrate pms_tasks.due_date to end_date for multi-day task support."""
    from sqlalchemy import inspect, text

    try:
        inspector = inspect(db.engine)
        if not inspector.has_table("pms_tasks"):
            return
        cols = {c["name"] for c in inspector.get_columns("pms_tasks")}
        dialect = db.engine.dialect.name
        if "end_date" not in cols and "due_date" in cols:
            if dialect == "sqlite":
                db.session.execute(text("ALTER TABLE pms_tasks ADD COLUMN end_date DATE"))
            else:
                db.session.execute(text("ALTER TABLE pms_tasks ADD COLUMN end_date DATE NULL"))
            db.session.execute(
                text("UPDATE pms_tasks SET end_date = due_date WHERE end_date IS NULL AND due_date IS NOT NULL")
            )
            db.session.commit()
            print("[ok] pms_tasks.end_date column added (copied from due_date)")
        elif "end_date" in cols and "due_date" in cols:
            db.session.execute(
                text("UPDATE pms_tasks SET end_date = due_date WHERE end_date IS NULL AND due_date IS NOT NULL")
            )
            db.session.commit()
    except Exception as e:
        db.session.rollback()
        print("Note: pms task end_date schema migration:", e)


def _ensure_pms_project_type_schema():
    """Add pms_project_types table (create_all) and project_type_id on pms_projects if missing."""
    from sqlalchemy import inspect, text

    try:
        inspector = inspect(db.engine)
        if inspector.has_table("pms_projects"):
            cols = {c["name"] for c in inspector.get_columns("pms_projects")}
            if "project_type_id" not in cols:
                dialect = db.engine.dialect.name
                if dialect == "mysql":
                    db.session.execute(
                        text(
                            "ALTER TABLE pms_projects ADD COLUMN project_type_id VARCHAR(40) NULL, "
                            "ADD INDEX ix_pms_projects_project_type_id (project_type_id)"
                        )
                    )
                elif dialect == "sqlite":
                    db.session.execute(text("ALTER TABLE pms_projects ADD COLUMN project_type_id VARCHAR(40)"))
                else:
                    db.session.execute(
                        text("ALTER TABLE pms_projects ADD COLUMN project_type_id VARCHAR(40) NULL")
                    )
                db.session.commit()
                print("[ok] pms_projects.project_type_id column added")
    except Exception as e:
        db.session.rollback()
        print("Note: pms project type schema migration:", e)


def _ensure_notification_category_schema():
    """Add notifications.category column for module-aware UI (task, pms, hr, system)."""
    from sqlalchemy import inspect, text

    try:
        inspector = inspect(db.engine)
        if not inspector.has_table("notifications"):
            return
        cols = {c["name"] for c in inspector.get_columns("notifications")}
        if "category" not in cols:
            dialect = db.engine.dialect.name
            if dialect == "mysql":
                db.session.execute(
                    text(
                        "ALTER TABLE notifications ADD COLUMN category VARCHAR(30) NOT NULL DEFAULT 'system'"
                    )
                )
            elif dialect == "sqlite":
                db.session.execute(
                    text("ALTER TABLE notifications ADD COLUMN category VARCHAR(30) DEFAULT 'system'")
                )
            else:
                db.session.execute(
                    text("ALTER TABLE notifications ADD COLUMN category VARCHAR(30) DEFAULT 'system'")
                )
            db.session.commit()
            print("[ok] notifications.category column added")
    except Exception as e:
        db.session.rollback()
        print("Note: notification category schema migration:", e)


DEFAULT_PMS_PROJECT_TYPES = ("Project", "Prototype", "Product")


def _seed_default_pms_project_types():
    """Insert default project types when the table is empty (fresh install / dev)."""
    from sqlalchemy import inspect

    from app.pms_models import PmsProjectType

    try:
        inspector = inspect(db.engine)
        if not inspector.has_table("pms_project_types"):
            return
        if PmsProjectType.query.count() > 0:
            return
        for i, name in enumerate(DEFAULT_PMS_PROJECT_TYPES, start=1):
            db.session.add(PmsProjectType(name=name, sort_order=i, is_active=True))
        db.session.commit()
        print(f"[ok] Seeded {len(DEFAULT_PMS_PROJECT_TYPES)} default PMS project types")
    except Exception as e:
        db.session.rollback()
        print("Note: default PMS project types seed:", e)


def _backfill_pms_task_assignees():
    """Copy legacy pms_tasks.assigned_to into pms_task_assignees when missing."""
    from app.pms_models import PmsTask, PmsTaskAssignee

    try:
        tasks = PmsTask.query.filter(PmsTask.assigned_to.isnot(None)).all()
        added = False
        for task in tasks:
            if not task.assigned_to:
                continue
            exists = PmsTaskAssignee.query.filter_by(
                task_id=task.id, user_id=task.assigned_to
            ).first()
            if not exists:
                db.session.add(
                    PmsTaskAssignee(
                        task_id=task.id,
                        user_id=task.assigned_to,
                        assigned_by=task.assigned_by,
                    )
                )
                added = True
        if added:
            db.session.commit()
    except Exception as e:
        db.session.rollback()
        print("backfill pms_task_assignees failed:", e)


def ensure_shifts_table(app):
    """Create shifts table if it doesn't exist."""
    with app.app_context():
        from sqlalchemy import inspect
        try:
            inspector = inspect(db.engine)
            if inspector.has_table("shifts"):
                return
            from app import models  # noqa: F401
            db.create_all()
            print("✓ Created shifts table.")
        except Exception as e:
            print(f"Note: shifts table creation: {e}")


def ensure_renewals_table(app):
    """Create renewals table if it doesn't exist."""
    with app.app_context():
        from sqlalchemy import inspect
        try:
            inspector = inspect(db.engine)
            if inspector.has_table("renewals"):
                return
            from app import models  # noqa: F401
            db.create_all()
            print("✓ Created renewals table.")
        except Exception as e:
            print(f"Note: renewals table creation: {e}")


def ensure_orders_table(app):
    """Create orders table if it doesn't exist."""
    with app.app_context():
        from sqlalchemy import inspect
        try:
            inspector = inspect(db.engine)
            if inspector.has_table("orders"):
                return
            from app import models  # noqa: F401
            db.create_all()
            print("✓ Created orders table.")
        except Exception as e:
            print(f"Note: orders table creation: {e}")


def add_sales_next_action_columns_if_missing(app):
    """Add next_action and next_action_date to sales table if missing."""
    with app.app_context():
        from sqlalchemy import inspect, text
        try:
            inspector = inspect(db.engine)
            if not inspector.has_table("sales"):
                return
            cols = [c.get("name", "").lower() for c in inspector.get_columns("sales")]
            if "next_action" not in cols:
                db.session.execute(text("ALTER TABLE sales ADD COLUMN next_action VARCHAR(255) DEFAULT ''"))
                db.session.commit()
                print("✓ Added sales.next_action.")
            if "next_action_date" not in cols:
                db.session.execute(text("ALTER TABLE sales ADD COLUMN next_action_date DATE NULL"))
                db.session.commit()
                print("✓ Added sales.next_action_date.")
        except Exception as e:
            db.session.rollback()
            err = str(e).lower()
            if "duplicate column" not in err and "already exists" not in err:
                print(f"Note: sales next action columns: {e}")


def add_orders_forwarded_to_column_if_missing(app):
    """Add forwarded_to_user_id to orders table if missing."""
    with app.app_context():
        from sqlalchemy import inspect, text
        try:
            inspector = inspect(db.engine)
            if not inspector.has_table("orders"):
                return
            cols = [c.get("name", "").lower() for c in inspector.get_columns("orders")]
            if "forwarded_to_user_id" in cols:
                return
            db.session.execute(text("ALTER TABLE orders ADD COLUMN forwarded_to_user_id VARCHAR(40) NULL"))
            db.session.commit()
            print("✓ Added orders.forwarded_to_user_id.")
        except Exception as e:
            db.session.rollback()
            err = str(e).lower()
            if "duplicate column" not in err and "already exists" not in err:
                print(f"Note: orders forwarded_to_user_id: {e}")


def add_rfqs_pricing_assignee_column_if_missing(app):
    """Add pricing_assignee_user_id to rfqs for RFQ module admin assignment."""
    with app.app_context():
        from sqlalchemy import inspect, text
        try:
            inspector = inspect(db.engine)
            if not inspector.has_table("rfqs"):
                return
            cols = {c.get("name", "").lower() for c in inspector.get_columns("rfqs")}
            if "pricing_assignee_user_id" in cols:
                return
            db.session.execute(text("ALTER TABLE rfqs ADD COLUMN pricing_assignee_user_id VARCHAR(40) NULL"))
            db.session.commit()
            print("✓ Added rfqs.pricing_assignee_user_id.")
        except Exception as e:
            db.session.rollback()
            err = str(e).lower()
            if "duplicate column" not in err and "already exists" not in err:
                print(f"Note: rfqs pricing_assignee_user_id: {e}")


def add_rfqs_vat_percent_column_if_missing(app):
    """Add vat_percent to rfqs (percentage of subtotal, e.g. 5 = 5%)."""
    with app.app_context():
        from sqlalchemy import inspect, text
        try:
            inspector = inspect(db.engine)
            if not inspector.has_table("rfqs"):
                return
            cols = {c.get("name", "").lower() for c in inspector.get_columns("rfqs")}
            if "vat_percent" in cols:
                return
            db.session.execute(text("ALTER TABLE rfqs ADD COLUMN vat_percent FLOAT NULL"))
            db.session.commit()
            print("✓ Added rfqs.vat_percent.")
        except Exception as e:
            db.session.rollback()
            err = str(e).lower()
            if "duplicate column" not in err and "already exists" not in err:
                print(f"Note: rfqs vat_percent: {e}")


def add_rfqs_version_number_column_if_missing(app):
    """Add version_number to rfqs for RFQ reopen / iteration tracking."""
    with app.app_context():
        from sqlalchemy import inspect, text
        try:
            inspector = inspect(db.engine)
            if not inspector.has_table("rfqs"):
                return
            cols = {c.get("name", "").lower() for c in inspector.get_columns("rfqs")}
            if "version_number" in cols:
                return
            db.session.execute(text("ALTER TABLE rfqs ADD COLUMN version_number INTEGER NOT NULL DEFAULT 1"))
            db.session.commit()
            print("✓ Added rfqs.version_number.")
        except Exception as e:
            db.session.rollback()
            err = str(e).lower()
            if "duplicate column" not in err and "already exists" not in err:
                print(f"Note: rfqs version_number: {e}")


def add_rfq_items_vat_percent_column_if_missing(app):
    """Add vat_percent to rfq_items (per-line VAT %; NULL falls back to RFQ-level vat_percent in API)."""
    with app.app_context():
        from sqlalchemy import inspect, text
        try:
            inspector = inspect(db.engine)
            if not inspector.has_table("rfq_items"):
                return
            cols = {c.get("name", "").lower() for c in inspector.get_columns("rfq_items")}
            if "vat_percent" in cols:
                return
            db.session.execute(text("ALTER TABLE rfq_items ADD COLUMN vat_percent FLOAT NULL"))
            db.session.commit()
            print("✓ Added rfq_items.vat_percent.")
        except Exception as e:
            db.session.rollback()
            err = str(e).lower()
            if "duplicate column" not in err and "already exists" not in err:
                print(f"Note: rfq_items vat_percent: {e}")


def add_renewals_deleted_at_column_if_missing(app):
    """Add deleted_at to renewals table if missing (soft delete support)."""
    with app.app_context():
        from sqlalchemy import inspect, text
        try:
            inspector = inspect(db.engine)
            if not inspector.has_table("renewals"):
                return
            cols = [c.get("name", "").lower() for c in inspector.get_columns("renewals")]
            if "deleted_at" in cols:
                return
            db.session.execute(text("ALTER TABLE renewals ADD COLUMN deleted_at DATETIME"))
            db.session.commit()
            print("✓ Added column renewals.deleted_at.")
        except Exception as e:
            db.session.rollback()
            if "duplicate column" not in str(e).lower() and "already exists" not in str(e).lower():
                print(f"Note: renewals.deleted_at: {e}")


def add_renewals_type_column_if_missing(app):
    """Add renewal_type to renewals table if missing."""
    with app.app_context():
        from sqlalchemy import inspect, text
        try:
            inspector = inspect(db.engine)
            if not inspector.has_table("renewals"):
                return
            cols = [c.get("name", "").lower() for c in inspector.get_columns("renewals")]
            if "renewal_type" in cols:
                return
            db.session.execute(
                text("ALTER TABLE renewals ADD COLUMN renewal_type VARCHAR(20) NOT NULL DEFAULT 'existing'")
            )
            db.session.commit()
            print("✓ Added column renewals.renewal_type.")
        except Exception as e:
            db.session.rollback()
            if "duplicate column" not in str(e).lower() and "already exists" not in str(e).lower():
                print(f"Note: renewals.renewal_type: {e}")


def add_hr_info_shift_id_column_if_missing(app):
    """Add shift_id column to hr_info table if it doesn't exist."""
    with app.app_context():
        from sqlalchemy import inspect, text
        try:
            inspector = inspect(db.engine)
            if not inspector.has_table("hr_info"):
                return
            columns = [col.get("name", "").lower() for col in inspector.get_columns("hr_info")]
            if "shift_id" not in columns:
                try:
                    db.session.execute(text("ALTER TABLE hr_info ADD COLUMN shift_id VARCHAR(40) NULL"))
                    db.session.commit()
                    print("✓ Added shift_id column to hr_info table.")
                except Exception as e:
                    db.session.rollback()
                    if "duplicate column" not in str(e).lower() and "already exists" not in str(e).lower():
                        print(f"Note: shift_id column: {e}")
        except Exception as e:
            print(f"Note: Could not check/add shift_id column: {e}")


def add_hr_info_bank_columns_if_missing(app):
    """Add bank routing / beneficiary account columns to hr_info if missing."""
    with app.app_context():
        from sqlalchemy import inspect, text

        columns_sql = (
            ("bank_routing_number", "VARCHAR(100) DEFAULT ''"),
            ("beneficiary_bank_account_number", "VARCHAR(100) DEFAULT ''"),
            ("receiver_name", "VARCHAR(255) DEFAULT ''"),
        )
        try:
            inspector = inspect(db.engine)
            if not inspector.has_table("hr_info"):
                return
            existing = {col.get("name", "").lower() for col in inspector.get_columns("hr_info")}
            for col_name, col_def in columns_sql:
                if col_name in existing:
                    continue
                try:
                    db.session.execute(
                        text(f"ALTER TABLE hr_info ADD COLUMN {col_name} {col_def}")
                    )
                    db.session.commit()
                    print(f"✓ Added {col_name} column to hr_info table.")
                except Exception as e:
                    db.session.rollback()
                    if "duplicate column" not in str(e).lower() and "already exists" not in str(e).lower():
                        print(f"Note: {col_name} column: {e}")
        except Exception as e:
            print(f"Note: Could not check/add hr_info bank columns: {e}")


def ensure_leaves_table(app):
    """Create leaves table if it doesn't exist."""
    with app.app_context():
        from sqlalchemy import inspect
        try:
            inspector = inspect(db.engine)
            if inspector.has_table("leaves"):
                return
            from app import models  # noqa: F401
            db.create_all()
            print("✓ Created leaves table.")
        except Exception as e:
            print(f"Note: leaves table creation: {e}")


def ensure_leave_types_table(app):
    """Create leave_types table if it doesn't exist."""
    with app.app_context():
        from sqlalchemy import inspect
        try:
            inspector = inspect(db.engine)
            if inspector.has_table("leave_types"):
                return
            from app import models  # noqa: F401
            db.create_all()
            print("✓ Created leave_types table.")
        except Exception as e:
            print(f"Note: leave_types table creation: {e}")


def ensure_employee_leave_balances_table(app):
    """Create employee_leave_balances table if it doesn't exist."""
    with app.app_context():
        from sqlalchemy import inspect
        try:
            inspector = inspect(db.engine)
            if inspector.has_table("employee_leave_balances"):
                return
            from app import models  # noqa: F401
            db.create_all()
            print("✓ Created employee_leave_balances table.")
        except Exception as e:
            print(f"Note: employee_leave_balances table creation: {e}")


def ensure_leave_duration_columns(app):
    """Add duration_type and total_leave_days to leaves if missing; backfill when needed."""
    with app.app_context():
        from sqlalchemy import inspect, text

        try:
            inspector = inspect(db.engine)
            if not inspector.has_table("leaves"):
                return
            cols = {c.get("name", "").lower() for c in inspector.get_columns("leaves")}
            if "duration_type" not in cols:
                try:
                    db.session.execute(
                        text(
                            "ALTER TABLE leaves ADD COLUMN duration_type VARCHAR(20) "
                            "NOT NULL DEFAULT 'single_day'"
                        )
                    )
                    db.session.commit()
                    print("✓ Added duration_type column to leaves table.")
                except Exception as e:
                    db.session.rollback()
                    if "duplicate column" not in str(e).lower() and "already exists" not in str(
                        e
                    ).lower():
                        print(f"Note: duration_type column: {e}")
            if "total_leave_days" not in cols:
                try:
                    db.session.execute(
                        text(
                            "ALTER TABLE leaves ADD COLUMN total_leave_days NUMERIC(8, 2) "
                            "NOT NULL DEFAULT 1"
                        )
                    )
                    db.session.commit()
                    print("✓ Added total_leave_days column to leaves table.")
                except Exception as e:
                    db.session.rollback()
                    if "duplicate column" not in str(e).lower() and "already exists" not in str(
                        e
                    ).lower():
                        print(f"Note: total_leave_days column: {e}")

            from app.models import Leave
            from app.api.leaves import calculate_working_days

            changed = 0
            for leave in Leave.query.all():
                wd = float(
                    calculate_working_days(
                        leave.start_date, leave.end_date, leave.user_id
                    )
                )
                if not leave.duration_type:
                    leave.duration_type = "multiple_day"
                    changed += 1
                if leave.total_leave_days is None:
                    leave.total_leave_days = max(wd, 1.0) if wd else 1.0
                    changed += 1
                elif (
                    leave.duration_type == "multiple_day"
                    and float(leave.total_leave_days) == 1.0
                    and leave.start_date != leave.end_date
                    and wd > 1
                ):
                    leave.total_leave_days = wd
                    changed += 1
            if changed:
                db.session.commit()
                print(f"✓ Normalized leave duration fields ({changed} update(s)).")
        except Exception as e:
            db.session.rollback()
            print(f"Note: leave duration columns: {e}")


def ensure_leave_half_day_period_column(app):
    """Add half_day_period to leaves if missing (first_half / second_half for half-day leave)."""
    with app.app_context():
        from sqlalchemy import inspect, text

        try:
            inspector = inspect(db.engine)
            if not inspector.has_table("leaves"):
                return
            cols = {c.get("name", "").lower() for c in inspector.get_columns("leaves")}
            if "half_day_period" not in cols:
                try:
                    db.session.execute(
                        text(
                            "ALTER TABLE leaves ADD COLUMN half_day_period VARCHAR(20) NULL"
                        )
                    )
                    db.session.commit()
                    print("✓ Added half_day_period column to leaves table.")
                except Exception as e:
                    db.session.rollback()
                    if "duplicate column" not in str(e).lower() and "already exists" not in str(
                        e
                    ).lower():
                        print(f"Note: half_day_period column: {e}")
        except Exception as e:
            db.session.rollback()
            print(f"Note: leave half_day_period column: {e}")


def ensure_additional_leave_days_column(app):
    """Add additional_leave_days to leaves (portion beyond quota)."""
    with app.app_context():
        from sqlalchemy import inspect, text

        try:
            inspector = inspect(db.engine)
            if not inspector.has_table("leaves"):
                return
            cols = {c.get("name", "").lower() for c in inspector.get_columns("leaves")}
            if "additional_leave_days" not in cols:
                try:
                    db.session.execute(
                        text(
                            "ALTER TABLE leaves ADD COLUMN additional_leave_days NUMERIC(8, 2) "
                            "NOT NULL DEFAULT 0"
                        )
                    )
                    db.session.commit()
                    print("✓ Added additional_leave_days column to leaves table.")
                except Exception as e:
                    db.session.rollback()
                    if "duplicate column" not in str(e).lower() and "already exists" not in str(
                        e
                    ).lower():
                        print(f"Note: additional_leave_days column: {e}")
        except Exception as e:
            db.session.rollback()
            print(f"Note: additional_leave_days column: {e}")


def seed_leave_types(app):
    """Seed default leave types if none exist."""
    with app.app_context():
        from app.models import LeaveType
        try:
            if LeaveType.query.first():
                return
            defaults = ["Sick Leave", "Casual Leave", "Annual Leave", "Maternity Leave", "Paternity Leave"]
            for name in defaults:
                db.session.add(LeaveType(name=name))
            db.session.commit()
            print(f"✓ Seeded {len(defaults)} default leave types.")
        except Exception as e:
            db.session.rollback()
            print(f"Note: Could not seed leave types: {e}")


def ensure_account_entries_table(app):
    """Create account_entries table if it does not exist."""
    with app.app_context():
        from sqlalchemy import inspect, text
        try:
            inspector = inspect(db.engine)
            if inspector.has_table("account_entries"):
                return
            db.session.execute(text(
                "CREATE TABLE account_entries (id VARCHAR(40) PRIMARY KEY, date DATE NOT NULL, particular VARCHAR(500) DEFAULT '', "
                "description VARCHAR(1000) DEFAULT '', voucher_no VARCHAR(50) DEFAULT '', amount_debit NUMERIC(12,2) DEFAULT 0 NOT NULL, amount_credit NUMERIC(12,2) DEFAULT 0 NOT NULL, "
                "paid_by VARCHAR(100) DEFAULT '', paid_to VARCHAR(100) DEFAULT '', created_at DATETIME, created_by_user_id VARCHAR(40))"
            ))
            db.session.commit()
            print("Created table account_entries.")
        except Exception as e:
            db.session.rollback()
            if "already exists" not in str(e).lower():
                print("Note: account_entries table:", e)


def ensure_account_particulars_table(app):
    """Create account_particulars table if it does not exist."""
    with app.app_context():
        from sqlalchemy import inspect, text
        try:
            inspector = inspect(db.engine)
            if inspector.has_table("account_particulars"):
                return
            db.session.execute(text(
                "CREATE TABLE account_particulars (id VARCHAR(40) PRIMARY KEY, name VARCHAR(200) NOT NULL, "
                "type VARCHAR(20) NOT NULL, sort_order INTEGER DEFAULT 0, created_at DATETIME)"
            ))
            db.session.commit()
            print("Created table account_particulars.")
        except Exception as e:
            db.session.rollback()
            if "already exists" not in str(e).lower():
                print("Note: account_particulars table:", e)


def seed_account_particulars_demo(app):
    """When account_particulars table is empty, add 5 demo particulars for received and 5 for expense."""
    with app.app_context():
        from app.models import AccountParticular
        try:
            if AccountParticular.query.count() > 0:
                return
            received = [
                "Office Deposit",
                "Client Payment",
                "Grant",
                "Refund",
                "Other Income",
            ]
            expense = [
                "Office Supplies",
                "Travel",
                "Utilities",
                "Vendor Payment",
                "Other Expense",
            ]
            for i, name in enumerate(received, start=1):
                p = AccountParticular(name=name, type="received", sort_order=i)
                db.session.add(p)
            for i, name in enumerate(expense, start=1):
                p = AccountParticular(name=name, type="expense", sort_order=i)
                db.session.add(p)
            db.session.commit()
            print("Seeded 10 demo account particulars (5 received, 5 expense).")
        except Exception as e:
            db.session.rollback()
            print("Note: seed account particulars:", e)


def add_account_entries_description_column_if_missing(app):
    """Add description to account_entries if missing."""
    with app.app_context():
        from sqlalchemy import text, inspect
        try:
            inspector = inspect(db.engine)
            if not inspector.has_table("account_entries"):
                return
            cols = [c.get("name", "").lower() for c in inspector.get_columns("account_entries")]
            if "description" in cols:
                return
            # SQLite and MySQL both accept TEXT; use VARCHAR(1000) for consistency with model
            db.session.execute(text("ALTER TABLE account_entries ADD COLUMN description VARCHAR(1000) DEFAULT ''"))
            db.session.commit()
            print("Added column account_entries.description.")
        except Exception as e:
            db.session.rollback()
            err_lower = str(e).lower()
            if "duplicate column" not in err_lower and "already exists" not in err_lower:
                print("Note: account_entries.description:", e)


def migrate_account_entries_amounts_to_numeric(app):
    """
    Upgrade amount_debit / amount_credit from float/real to NUMERIC(12,2) on PostgreSQL and MySQL.
    SQLite keeps column affinity; SQLAlchemy Numeric is enough. Idempotent.
    """
    with app.app_context():
        from sqlalchemy import text, inspect

        try:
            inspector = inspect(db.engine)
            if not inspector.has_table("account_entries"):
                return
            dialect = db.engine.dialect.name
            if dialect == "sqlite":
                return
            cols = {c["name"].lower(): c for c in inspector.get_columns("account_entries")}
            if "amount_debit" not in cols:
                return
            debit_col = cols["amount_debit"]
            type_repr = str(debit_col.get("type", "") or "").lower()
            if "numeric" in type_repr or "decimal" in type_repr:
                return
            if dialect == "postgresql":
                db.session.execute(
                    text(
                        "ALTER TABLE account_entries ALTER COLUMN amount_debit TYPE NUMERIC(12,2) "
                        "USING round(COALESCE(amount_debit, 0)::numeric, 2)"
                    )
                )
                db.session.execute(
                    text(
                        "ALTER TABLE account_entries ALTER COLUMN amount_credit TYPE NUMERIC(12,2) "
                        "USING round(COALESCE(amount_credit, 0)::numeric, 2)"
                    )
                )
                db.session.commit()
                print("Migrated account_entries amounts to NUMERIC(12,2) (PostgreSQL).")
            elif dialect in ("mysql", "mysqldb"):
                db.session.execute(
                    text(
                        "ALTER TABLE account_entries MODIFY amount_debit DECIMAL(12,2) NOT NULL DEFAULT 0, "
                        "MODIFY amount_credit DECIMAL(12,2) NOT NULL DEFAULT 0"
                    )
                )
                db.session.commit()
                print("Migrated account_entries amounts to DECIMAL(12,2) (MySQL).")
        except Exception as e:
            db.session.rollback()
            err = str(e).lower()
            if "already" in err or "duplicate" in err:
                return
            print("Note: account_entries numeric migration:", e)


def add_account_entries_attachment_columns_if_missing(app):
    """Add attachment_filename and attachment_data to account_entries if missing."""
    with app.app_context():
        from sqlalchemy import text, inspect
        try:
            inspector = inspect(db.engine)
            if not inspector.has_table("account_entries"):
                return
            cols = [c["name"] for c in inspector.get_columns("account_entries")]
            if "attachment_filename" not in cols:
                db.session.execute(text("ALTER TABLE account_entries ADD COLUMN attachment_filename VARCHAR(255) DEFAULT ''"))
                db.session.commit()
                print("Added column account_entries.attachment_filename.")
            if "attachment_data" not in cols:
                db.session.execute(text("ALTER TABLE account_entries ADD COLUMN attachment_data TEXT"))
                db.session.commit()
                print("Added column account_entries.attachment_data.")
        except Exception as e:
            db.session.rollback()
            if "duplicate column" not in str(e).lower() and "already exists" not in str(e).lower():
                print("Note: account_entries attachment columns:", e)


def ensure_expense_purposes_table(app):
    """Create expense_purposes table if it does not exist (db.create_all may have run before model existed)."""
    with app.app_context():
        from sqlalchemy import inspect, text
        try:
            inspector = inspect(db.engine)
            if inspector.has_table("expense_purposes"):
                return
            db.session.execute(text(
                "CREATE TABLE expense_purposes (id VARCHAR(40) PRIMARY KEY, name VARCHAR(100) NOT NULL, sort_order INTEGER DEFAULT 0, is_active BOOLEAN DEFAULT 1, created_at DATETIME)"
            ))
            db.session.commit()
            print("Created table expense_purposes.")
        except Exception as e:
            db.session.rollback()
            if "already exists" not in str(e).lower():
                print("Note: expense_purposes table:", e)


def add_expense_purpose_is_active_column_if_missing(app):
    """Add is_active to expense_purposes table if missing."""
    with app.app_context():
        from sqlalchemy import text, inspect
        try:
            inspector = inspect(db.engine)
            if not inspector.has_table("expense_purposes"):
                return
            cols = [c["name"] for c in inspector.get_columns("expense_purposes")]
            if "is_active" in cols:
                return
            db.session.execute(text("ALTER TABLE expense_purposes ADD COLUMN is_active BOOLEAN DEFAULT 1"))
            db.session.commit()
            print("Added column expense_purposes.is_active.")
        except Exception as e:
            db.session.rollback()
            if "duplicate column" not in str(e).lower() and "already exists" not in str(e).lower():
                print("Note: expense_purposes.is_active:", e)


def add_expense_purpose_id_column_if_missing(app):
    """Add purpose_id to expenses table if missing."""
    with app.app_context():
        from sqlalchemy import text, inspect
        try:
            inspector = inspect(db.engine)
            if not inspector.has_table("expenses"):
                return
            cols = [c["name"] for c in inspector.get_columns("expenses")]
            if "purpose_id" in cols:
                return
            db.session.execute(text("ALTER TABLE expenses ADD COLUMN purpose_id VARCHAR(40)"))
            db.session.commit()
            print("Added column expenses.purpose_id.")
        except Exception as e:
            db.session.rollback()
            if "duplicate column" not in str(e).lower() and "already exists" not in str(e).lower():
                print("Note: expenses.purpose_id:", e)


def add_expense_location_columns_if_missing(app):
    """Add from_location and to_location to expenses table if missing."""
    with app.app_context():
        from sqlalchemy import text, inspect
        try:
            inspector = inspect(db.engine)
            if not inspector.has_table("expenses"):
                return
            cols = [c["name"] for c in inspector.get_columns("expenses")]
            if "from_location" not in cols:
                db.session.execute(text("ALTER TABLE expenses ADD COLUMN from_location VARCHAR(200) DEFAULT ''"))
                db.session.commit()
                print("Added column expenses.from_location.")
            if "to_location" not in cols:
                db.session.execute(text("ALTER TABLE expenses ADD COLUMN to_location VARCHAR(200) DEFAULT ''"))
                db.session.commit()
                print("Added column expenses.to_location.")
        except Exception as e:
            db.session.rollback()
            if "duplicate column" not in str(e).lower() and "already exists" not in str(e).lower():
                print("Note: expenses location columns:", e)


def add_expense_amount_return_column_if_missing(app):
    """Add amount_return to expenses table if missing."""
    with app.app_context():
        from sqlalchemy import text, inspect
        try:
            inspector = inspect(db.engine)
            if not inspector.has_table("expenses"):
                return
            cols = [c["name"] for c in inspector.get_columns("expenses")]
            if "amount_return" in cols:
                return
            db.session.execute(text("ALTER TABLE expenses ADD COLUMN amount_return FLOAT"))
            db.session.commit()
            print("Added column expenses.amount_return.")
        except Exception as e:
            db.session.rollback()
            if "duplicate column" not in str(e).lower() and "already exists" not in str(e).lower():
                print("Note: expenses.amount_return:", e)


def add_expense_deleted_at_column_if_missing(app):
    """Add deleted_at for soft-delete (bin); NULL = active expense."""
    with app.app_context():
        from sqlalchemy import text, inspect
        try:
            inspector = inspect(db.engine)
            if not inspector.has_table("expenses"):
                return
            cols = [c["name"] for c in inspector.get_columns("expenses")]
            if "deleted_at" in cols:
                return
            db.session.execute(text("ALTER TABLE expenses ADD COLUMN deleted_at DATETIME"))
            db.session.commit()
            print("Added column expenses.deleted_at.")
        except Exception as e:
            db.session.rollback()
            if "duplicate column" not in str(e).lower() and "already exists" not in str(e).lower():
                print("Note: expenses.deleted_at:", e)


def add_contacts_created_by_user_id_column_if_missing(app):
    """RBAC: who created the CRM contact; NULL = legacy row (admin scope only)."""
    with app.app_context():
        from sqlalchemy import text, inspect
        try:
            inspector = inspect(db.engine)
            if not inspector.has_table("contacts"):
                return
            cols = [c["name"] for c in inspector.get_columns("contacts")]
            if "created_by_user_id" in cols:
                return
            db.session.execute(text("ALTER TABLE contacts ADD COLUMN created_by_user_id VARCHAR(40) NULL"))
            db.session.commit()
            print("Added column contacts.created_by_user_id.")
        except Exception as e:
            db.session.rollback()
            if "duplicate column" not in str(e).lower() and "already exists" not in str(e).lower():
                print("Note: contacts.created_by_user_id:", e)


def add_company_currency_column_if_missing(app):
    """Add currency_id to companies table if missing. Keeps all existing company data; new column is NULL for existing rows."""
    with app.app_context():
        from sqlalchemy import text, inspect
        try:
            inspector = inspect(db.engine)
            if not inspector.has_table("companies"):
                return
            cols = [c["name"] for c in inspector.get_columns("companies")]
            if "currency_id" in cols:
                return
            db.session.execute(text("ALTER TABLE companies ADD COLUMN currency_id VARCHAR(40)"))
            db.session.commit()
            print("Added column companies.currency_id (existing rows have NULL).")
        except Exception as e:
            db.session.rollback()
            print("Could not add companies.currency_id:", e)


def ensure_admin_user(app):
    """Create default admin user on every startup if it does not exist."""
    from app.models import User
    from werkzeug.security import generate_password_hash

    existing = User.query.filter_by(email=ADMIN_EMAIL).first()
    if existing:
        return
    admin = User(
        name="Admin",
        email=ADMIN_EMAIL,
        password_hash=generate_password_hash(ADMIN_PASSWORD),
        phone="",
        role="admin",
        is_active=True,
    )
    db.session.add(admin)
    db.session.commit()


def seed_currencies(app):
    """Seed default currencies if none exist."""
    from app.models import Currency

    if Currency.query.first():
        return
    defaults = [
        ("USD", "US Dollar", "$"),
        ("EUR", "Euro", "€"),
        ("GBP", "British Pound", "£"),
        ("BDT", "Bangladeshi Taka", "৳"),
        ("INR", "Indian Rupee", "₹"),
    ]
    for i, (code, name, symbol) in enumerate(defaults):
        db.session.add(Currency(code=code, name=name, symbol=symbol, sort_order=i))
    db.session.commit()


def add_status_config_is_active_column_if_missing(app):
    """Add is_active to status_config for order status visibility (default active)."""
    from sqlalchemy import text, inspect
    with app.app_context():
        try:
            inspector = inspect(db.engine)
            if not inspector.has_table("status_config"):
                return
            cols = [c["name"].lower() for c in inspector.get_columns("status_config")]
            if "is_active" in cols:
                return
            db.session.execute(text("ALTER TABLE status_config ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1"))
            db.session.commit()
            # After DDL, MySQL can return 1412 ("Table definition has changed") on the same pooled
            # connection. Drop pooled connections so ORM queries see the new column.
            db.session.remove()
            db.engine.dispose()
            print("✓ Added column status_config.is_active (existing data preserved).")
        except Exception as e:
            db.session.rollback()
            err_lower = str(e).lower()
            if "duplicate column" not in err_lower and "already exists" not in err_lower:
                print("Note: status_config.is_active:", e)


def seed_status_config(app):
    """Seed default task statuses, sales categories, sales statuses, order statuses if none exist per group."""
    from app.models import StatusConfig

    defaults = [
        ("task_status", ["pending", "in_progress", "completed", "cancelled"]),
        ("pms_task_status", ["to_do", "in_progress", "completed", "on_hold", "cancelled"]),
        ("sales_category", ["hot", "warm", "cold"]),
        ("sales_status", ["lead", "prospect", "negotiation", "closed", "disqualified"]),
        ("order_status", ["pending", "open", "in_progress", "completed"]),
        ("order_next_todo", ["follow_up", "prepare_documents", "confirm_delivery"]),
    ]
    for group, values in defaults:
        if StatusConfig.query.filter_by(group=group).first():
            continue
        for i, value in enumerate(values):
            row = StatusConfig(group=group, value=value, sort_order=i, is_active=True)
            db.session.add(row)
    db.session.commit()


def ensure_pending_order_status_exists(app):
    """Guarantee 'pending' exists and is active for order_status."""
    from app.models import StatusConfig
    with app.app_context():
        try:
            row = StatusConfig.query.filter_by(group="order_status", value="pending").first()
            if row:
                if not row.is_active:
                    row.is_active = True
                    db.session.commit()
                return
            max_sort = db.session.query(db.func.max(StatusConfig.sort_order)).filter(
                StatusConfig.group == "order_status"
            ).scalar()
            next_sort = (max_sort + 1) if isinstance(max_sort, int) else 0
            db.session.add(
                StatusConfig(group="order_status", value="pending", sort_order=next_sort, is_active=True)
            )
            db.session.commit()
            print("✓ Ensured order_status.pending exists.")
        except Exception as e:
            db.session.rollback()
            print(f"Note: ensure pending order status: {e}")


def add_employment_history_activity_columns_if_missing(app):
    """Add activity and next_activity columns to employment_history table if missing. Preserves all existing data and relationships."""
    from sqlalchemy import text, inspect
    try:
        inspector = inspect(db.engine)
        if not inspector.has_table("employment_history"):
            return
        cols = [c["name"].lower() for c in inspector.get_columns("employment_history")]
        
        # Add activity column if missing (preserves all existing data)
        if "activity" not in cols:
            try:
                db.session.execute(text("ALTER TABLE employment_history ADD COLUMN activity VARCHAR(255) DEFAULT ''"))
                db.session.commit()
                print("✓ Added column employment_history.activity (existing data preserved).")
            except Exception as e:
                db.session.rollback()
                err_lower = str(e).lower()
                if "duplicate column" not in err_lower and "already exists" not in err_lower:
                    print("Note: employment_history.activity:", e)
        
        # Add next_activity column if missing (preserves all existing data)
        if "next_activity" not in cols:
            try:
                db.session.execute(text("ALTER TABLE employment_history ADD COLUMN next_activity VARCHAR(255) DEFAULT ''"))
                db.session.commit()
                print("✓ Added column employment_history.next_activity (existing data preserved).")
            except Exception as e:
                db.session.rollback()
                err_lower = str(e).lower()
                if "duplicate column" not in err_lower and "already exists" not in err_lower:
                    print("Note: employment_history.next_activity:", e)
    except Exception as e:
        db.session.rollback()
        print("Note: employment_history activity columns migration:", e)


def add_academic_certification_attachment_columns_if_missing(app):
    """Add attachment_filename and attachment_data columns to academic_certifications table if missing. Preserves all existing data and relationships."""
    with app.app_context():
        from sqlalchemy import text, inspect
        try:
            inspector = inspect(db.engine)
            if not inspector.has_table("academic_certifications"):
                print("Note: academic_certifications table does not exist yet.")
                return
            
            cols = [c.get("name", "").lower() for c in inspector.get_columns("academic_certifications")]
            
            # Add attachment_filename column if missing (preserves all existing data)
            if "attachment_filename" not in cols:
                try:
                    db.session.execute(text("ALTER TABLE academic_certifications ADD COLUMN attachment_filename VARCHAR(255) DEFAULT ''"))
                    db.session.commit()
                    print("✓ Added column academic_certifications.attachment_filename (existing data preserved).")
                except Exception as e:
                    db.session.rollback()
                    err_lower = str(e).lower()
                    if "duplicate column" not in err_lower and "already exists" not in err_lower:
                        print(f"Error adding attachment_filename: {e}")
            
            # Add attachment_data column if missing (preserves all existing data)
            if "attachment_data" not in cols:
                try:
                    # Use LONGTEXT for MySQL to support large base64 data (up to 4GB)
                    # For SQLite, LONGTEXT is treated as TEXT which is fine
                    db.session.execute(text("ALTER TABLE academic_certifications ADD COLUMN attachment_data LONGTEXT"))
                    db.session.commit()
                    print("✓ Added column academic_certifications.attachment_data using LONGTEXT (existing data preserved).")
                except Exception as e:
                    db.session.rollback()
                    err_lower = str(e).lower()
                    if "duplicate column" not in err_lower and "already exists" not in err_lower:
                        print(f"Error adding attachment_data with LONGTEXT: {e}")
                        # Fallback to MEDIUMTEXT for MySQL (up to 16MB)
                        try:
                            db.session.execute(text("ALTER TABLE academic_certifications ADD COLUMN attachment_data MEDIUMTEXT"))
                            db.session.commit()
                            print("✓ Added column academic_certifications.attachment_data using MEDIUMTEXT (existing data preserved).")
                        except Exception as e2:
                            db.session.rollback()
                            print(f"Error adding attachment_data with MEDIUMTEXT: {e2}")
            else:
                # Check if existing column needs to be upgraded from TEXT to LONGTEXT
                try:
                    col_info = next((c for c in inspector.get_columns("academic_certifications") if c.get("name", "").lower() == "attachment_data"), None)
                    if col_info:
                        col_type = str(col_info.get("type", "")).upper()
                        # If it's TEXT, upgrade to LONGTEXT
                        if "TEXT" in col_type and "LONGTEXT" not in col_type and "MEDIUMTEXT" not in col_type:
                            print("Upgrading attachment_data column from TEXT to LONGTEXT...")
                            db.session.execute(text("ALTER TABLE academic_certifications MODIFY COLUMN attachment_data LONGTEXT"))
                            db.session.commit()
                            print("✓ Upgraded academic_certifications.attachment_data to LONGTEXT.")
                except Exception as e:
                    db.session.rollback()
                    err_lower = str(e).lower()
                    if "modify" not in err_lower:  # Some databases don't support MODIFY
                        print(f"Note: Could not upgrade attachment_data column: {e}")
        except Exception as e:
            db.session.rollback()
            print(f"Error in academic_certifications attachment columns migration: {e}")
            import traceback
            traceback.print_exc()


def ensure_emergency_contacts_table(app):
    """Create emergency_contacts table if it doesn't exist."""
    with app.app_context():
        from sqlalchemy import inspect
        try:
            inspector = inspect(db.engine)
            if inspector.has_table("emergency_contacts"):
                return
            # Table will be created by db.create_all() if model is imported
            from app import models  # noqa: F401
            db.create_all()
            print("✓ Created emergency_contacts table.")
        except Exception as e:
            print(f"Note: emergency_contacts table creation: {e}")


def ensure_departments_table(app):
    """Create departments table if it doesn't exist and seed demo data."""
    with app.app_context():
        from sqlalchemy import inspect
        try:
            inspector = inspect(db.engine)
            if not inspector.has_table("departments"):
                # Table will be created by db.create_all() if model is imported
                from app import models  # noqa: F401
                db.create_all()
                print("✓ Created departments table.")
            # Always try to seed (will skip if data already exists)
            seed_departments(app)
        except Exception as e:
            print(f"Note: departments table creation: {e}")


def ensure_designations_table(app):
    """Create designations table if it doesn't exist and seed demo data."""
    with app.app_context():
        from sqlalchemy import inspect
        try:
            inspector = inspect(db.engine)
            if not inspector.has_table("designations"):
                # Table will be created by db.create_all() if model is imported
                from app import models  # noqa: F401
                db.create_all()
                print("✓ Created designations table.")
            # Always try to seed (will skip if data already exists)
            seed_designations(app)
        except Exception as e:
            print(f"Note: designations table creation: {e}")


def seed_departments(app):
    """Seed default departments if none exist."""
    with app.app_context():
        from app.models import Department
        
        if Department.query.first():
            return
        
        defaults = [
            "Engineering",
            "Sales",
            "Marketing",
            "Human Resources",
            "Finance",
            "Operations",
            "Customer Support",
            "Product Management",
            "Quality Assurance",
            "Information Technology",
        ]
        
        for idx, name in enumerate(defaults, start=1):
            dept = Department(name=name, sort_order=idx, is_active=True)
            db.session.add(dept)
        
        try:
            db.session.commit()
            print(f"✓ Seeded {len(defaults)} default departments.")
        except Exception as e:
            db.session.rollback()
            print(f"Note: Could not seed departments: {e}")


def seed_designations(app):
    """Seed default designations if none exist."""
    with app.app_context():
        from app.models import Designation
        
        if Designation.query.first():
            return
        
        defaults = [
            "Software Engineer",
            "Senior Software Engineer",
            "Lead Software Engineer",
            "Sales Manager",
            "Sales Executive",
            "Sales Representative",
            "Marketing Manager",
            "Marketing Specialist",
            "HR Manager",
            "HR Executive",
            "Finance Manager",
            "Accountant",
            "Operations Manager",
            "Operations Coordinator",
            "Customer Support Manager",
            "Customer Support Representative",
            "Product Manager",
            "Product Owner",
            "QA Engineer",
            "QA Lead",
            "IT Manager",
            "System Administrator",
            "CEO",
            "CTO",
            "CFO",
            "COO",
            "Project Manager",
            "Business Analyst",
            "Data Analyst",
            "Designer",
        ]
        
        for idx, name in enumerate(defaults, start=1):
            desig = Designation(name=name, sort_order=idx, is_active=True)
            db.session.add(desig)
        
        try:
            db.session.commit()
            print(f"✓ Seeded {len(defaults)} default designations.")
        except Exception as e:
            db.session.rollback()
            print(f"Note: Could not seed designations: {e}")


def ensure_employee_types_table(app):
    """Create employee_types table if it doesn't exist and seed default data."""
    with app.app_context():
        from sqlalchemy import inspect
        try:
            inspector = inspect(db.engine)
            if not inspector.has_table("employee_types"):
                from app import models  # noqa: F401
                db.create_all()
                print("✓ Created employee_types table.")
            seed_employee_types(app)
        except Exception as e:
            print(f"Note: employee_types table creation: {e}")


def seed_employee_types(app):
    """Seed default employee types if none exist."""
    with app.app_context():
        from app.models import EmployeeType

        if EmployeeType.query.first():
            return

        defaults = [
            "Full Time",
            "Part Time",
            "Contract",
            "Internship",
            "Temporary",
        ]

        for idx, name in enumerate(defaults, start=1):
            db.session.add(EmployeeType(name=name, sort_order=idx, is_active=True))

        try:
            db.session.commit()
            print(f"✓ Seeded {len(defaults)} default employee types.")
        except Exception as e:
            db.session.rollback()
            print(f"Note: Could not seed employee types: {e}")


def add_hr_info_joining_date_column_if_missing(app):
    """Add joining_date column to hr_info table if it doesn't exist."""
    with app.app_context():
        from sqlalchemy import inspect, text
        try:
            inspector = inspect(db.engine)
            if not inspector.has_table("hr_info"):
                return
            columns = [col.get("name", "").lower() for col in inspector.get_columns("hr_info")]
            if "joining_date" not in columns:
                try:
                    db.session.execute(text("ALTER TABLE hr_info ADD COLUMN joining_date DATE NULL"))
                    db.session.commit()
                    print("✓ Added joining_date column to hr_info table.")
                except Exception as e:
                    db.session.rollback()
                    if "duplicate column" not in str(e).lower() and "already exists" not in str(e).lower():
                        print(f"Note: joining_date column: {e}")
        except Exception as e:
            print(f"Note: Could not check/add joining_date column: {e}")


def ensure_weekends_table(app):
    """Create weekends table if it doesn't exist."""
    with app.app_context():
        from sqlalchemy import inspect
        try:
            inspector = inspect(db.engine)
            if inspector.has_table("weekends"):
                return
            from app import models  # noqa: F401
            db.create_all()
            print("✓ Created weekends table.")
        except Exception as e:
            print(f"Note: weekends table creation: {e}")


def ensure_holidays_table(app):
    """Create holidays table if it doesn't exist."""
    with app.app_context():
        from sqlalchemy import inspect
        try:
            inspector = inspect(db.engine)
            if inspector.has_table("holidays"):
                return
            from app import models  # noqa: F401
            db.create_all()
            print("✓ Created holidays table.")
        except Exception as e:
            print(f"Note: holidays table creation: {e}")


def migrate_holidays_to_date_range(app):
    """Migrate legacy single-day holidays.holiday_date to start_date + end_date."""
    with app.app_context():
        from sqlalchemy import inspect, text
        try:
            inspector = inspect(db.engine)
            if not inspector.has_table("holidays"):
                return
            cols = {c.get("name", "").lower() for c in inspector.get_columns("holidays")}
            if "start_date" in cols and "end_date" in cols:
                if "holiday_date" in cols:
                    try:
                        db.session.execute(text("ALTER TABLE holidays DROP COLUMN holiday_date"))
                        db.session.commit()
                        print("✓ Dropped legacy holidays.holiday_date column.")
                    except Exception:
                        db.session.rollback()
                return
            if "holiday_date" not in cols:
                return
            if "start_date" not in cols:
                db.session.execute(text("ALTER TABLE holidays ADD COLUMN start_date DATE"))
                db.session.commit()
            if "end_date" not in cols:
                db.session.execute(text("ALTER TABLE holidays ADD COLUMN end_date DATE"))
                db.session.commit()
            db.session.execute(
                text(
                    "UPDATE holidays SET start_date = holiday_date, end_date = holiday_date "
                    "WHERE start_date IS NULL OR end_date IS NULL"
                )
            )
            db.session.commit()
            try:
                db.session.execute(text("ALTER TABLE holidays DROP COLUMN holiday_date"))
                db.session.commit()
                print("✓ Migrated holidays to start_date/end_date range columns.")
            except Exception as e:
                db.session.rollback()
                print(f"Note: holidays.holiday_date drop (may retry later): {e}")
        except Exception as e:
            db.session.rollback()
            print(f"Note: holidays date range migration: {e}")


def ensure_attendance_table(app):
    """Create attendance table if it doesn't exist and add location columns if missing."""
    with app.app_context():
        from sqlalchemy import inspect, text
        try:
            inspector = inspect(db.engine)
            if not inspector.has_table("attendance"):
                # Table will be created by db.create_all() if model is imported
                from app import models  # noqa: F401
                db.create_all()
                print("✓ Created attendance table.")
            else:
                # Add location columns if they don't exist
                columns = [col.get("name", "").lower() for col in inspector.get_columns("attendance")]
                if "check_in_location" not in columns:
                    try:
                        db.session.execute(text("ALTER TABLE attendance ADD COLUMN check_in_location VARCHAR(255) NULL"))
                        db.session.commit()
                        print("✓ Added check_in_location column to attendance table.")
                    except Exception as e:
                        db.session.rollback()
                        if "duplicate column" not in str(e).lower() and "already exists" not in str(e).lower():
                            print(f"Note: check_in_location column: {e}")
                if "check_out_location" not in columns:
                    try:
                        db.session.execute(text("ALTER TABLE attendance ADD COLUMN check_out_location VARCHAR(255) NULL"))
                        db.session.commit()
                        print("✓ Added check_out_location column to attendance table.")
                    except Exception as e:
                        db.session.rollback()
                        if "duplicate column" not in str(e).lower() and "already exists" not in str(e).lower():
                            print(f"Note: check_out_location column: {e}")
        except Exception as e:
            print(f"Note: attendance table creation: {e}")


def ensure_attendance_reconciliations_table(app):
    """Create attendance_reconciliations table if missing."""
    with app.app_context():
        from sqlalchemy import inspect
        try:
            inspector = inspect(db.engine)
            if inspector.has_table("attendance_reconciliations"):
                return
            from app import models  # noqa: F401
            db.create_all()
            print("✓ Created attendance_reconciliations table.")
        except Exception as e:
            print(f"Note: attendance_reconciliations table: {e}")


def ensure_report_execution_log_is_manual_column(app):
    """Add is_manual flag to report_execution_logs if missing."""
    with app.app_context():
        from sqlalchemy import inspect, text

        try:
            insp = inspect(db.engine)
            if not insp.has_table("report_execution_logs"):
                return
            cols = {c["name"] for c in insp.get_columns("report_execution_logs")}
            if "is_manual" not in cols:
                dialect = db.engine.dialect.name
                if dialect == "mysql":
                    db.session.execute(
                        text(
                            "ALTER TABLE report_execution_logs "
                            "ADD COLUMN is_manual TINYINT(1) NOT NULL DEFAULT 0"
                        )
                    )
                else:
                    db.session.execute(
                        text(
                            "ALTER TABLE report_execution_logs "
                            "ADD COLUMN is_manual BOOLEAN NOT NULL DEFAULT 0"
                        )
                    )
                db.session.commit()
                print("[ok] report_execution_logs.is_manual added")
        except Exception as e:
            db.session.rollback()
            print("ensure_report_execution_log_is_manual_column failed:", e)


def ensure_report_execution_log_recipient_ids_column(app):
    """Add recipient_user_ids JSON column to report_execution_logs if missing."""
    with app.app_context():
        from sqlalchemy import inspect, text

        try:
            insp = inspect(db.engine)
            if not insp.has_table("report_execution_logs"):
                return
            cols = {c["name"] for c in insp.get_columns("report_execution_logs")}
            if "recipient_user_ids" not in cols:
                dialect = db.engine.dialect.name
                if dialect == "mysql":
                    db.session.execute(
                        text("ALTER TABLE report_execution_logs ADD COLUMN recipient_user_ids LONGTEXT NULL")
                    )
                else:
                    db.session.execute(
                        text("ALTER TABLE report_execution_logs ADD COLUMN recipient_user_ids TEXT DEFAULT '[]'")
                    )
                db.session.commit()
                print("[ok] report_execution_logs.recipient_user_ids added")
        except Exception as e:
            db.session.rollback()
            print("ensure_report_execution_log_recipient_ids_column failed:", e)


def ensure_credentials_tables(app):
    """Create credentials tables if missing; run idempotent v2 migration (encrypt username, url, note)."""
    with app.app_context():
        from sqlalchemy import inspect
        try:
            inspector = inspect(db.engine)
            if not inspector.has_table("credentials"):
                from app import models  # noqa: F401
                db.create_all()
                print("✓ Created credentials module tables.")
            from app.credential_migration import migrate_credentials_schema

            migrate_credentials_schema(app)
        except Exception as e:
            print(f"Note: credentials tables: {e}")
