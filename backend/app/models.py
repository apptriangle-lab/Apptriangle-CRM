import uuid
from datetime import datetime, timedelta
from sqlalchemy import Numeric, Text, UniqueConstraint
from sqlalchemy.dialects.mysql import MEDIUMTEXT
from app import db


class LongText(db.TypeDecorator):
    """TEXT that becomes MEDIUMTEXT on MySQL (for large base64 logos)."""
    impl = Text
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "mysql":
            return dialect.type_descriptor(MEDIUMTEXT())
        return dialect.type_descriptor(Text())


def generate_id():
    return uuid.uuid4().hex[:12]


class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    name = db.Column(db.String(255), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    phone = db.Column(db.String(50), default="")
    role = db.Column(db.String(20), default="user")  # admin | user
    is_active = db.Column(db.Boolean, default=True)
    lunch_balance = db.Column(db.Numeric(10, 2), nullable=False, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "phone": self.phone or "",
            "role": self.role,
            "isActive": self.is_active,
            "lunchBalance": float(self.lunch_balance or 0),
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
        }


class Company(db.Model):
    __tablename__ = "companies"
    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    name = db.Column(db.String(255), nullable=False)
    location = db.Column(db.String(255), default="")
    country = db.Column(db.String(100), default="")
    currency_id = db.Column(db.String(40), db.ForeignKey("currencies.id"), nullable=True)
    kam_user_id = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=True)
    created_by_user_id = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "location": self.location or "",
            "country": self.country or "",
            "currencyId": self.currency_id or "",
            "kamUserId": self.kam_user_id or "",
            "createdByUserId": self.created_by_user_id or "",
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() + "Z" if self.updated_at else None,
        }


class Contact(db.Model):
    __tablename__ = "contacts"
    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    name = db.Column(db.String(255), nullable=False)
    company_id = db.Column(db.String(40), db.ForeignKey("companies.id"), nullable=False)
    designation = db.Column(db.String(100), nullable=True)
    mobile = db.Column(db.String(50), nullable=False)
    email = db.Column(db.String(255), nullable=True)
    created_by_user_id = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "companyId": self.company_id,
            "designation": self.designation,
            "mobile": self.mobile,
            "email": self.email,
            "createdByUserId": self.created_by_user_id or "",
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
        }


class Task(db.Model):
    __tablename__ = "tasks"
    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    title = db.Column(db.String(255), nullable=False)
    note = db.Column(db.Text, nullable=True)
    company_id = db.Column(db.String(40), db.ForeignKey("companies.id"), nullable=False)
    due_datetime = db.Column(db.DateTime, nullable=False)
    assign_by_user_id = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=True)
    assign_to_user_id = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=True)
    status = db.Column(db.String(30), default="pending")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "note": self.note,
            "companyId": self.company_id,
            "dueDatetime": self.due_datetime.isoformat() if self.due_datetime else None,
            "assignByUserId": self.assign_by_user_id or "",
            "assignToUserId": self.assign_to_user_id or "",
            "status": self.status,
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
        }


class TaskActivityLog(db.Model):
    __tablename__ = "task_activity_logs"
    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    task_id = db.Column(db.String(40), db.ForeignKey("tasks.id"), nullable=False)
    action_type = db.Column(db.String(30), nullable=False)  # created | updated | status_changed
    old_value = db.Column(db.JSON, nullable=True)
    new_value = db.Column(db.JSON, nullable=True)
    note = db.Column(db.Text, nullable=True)
    actor_user_id = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "taskId": self.task_id,
            "actionType": self.action_type,
            "oldValue": self.old_value,
            "newValue": self.new_value,
            "note": self.note,
            "actorUserId": self.actor_user_id or "",
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
        }


class Sale(db.Model):
    __tablename__ = "sales"
    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    company_id = db.Column(db.String(40), db.ForeignKey("companies.id"), nullable=False)
    category = db.Column(db.String(20), default="cold")  # hot | warm | cold
    prospect = db.Column(db.String(255), nullable=False)
    expected_closing_date = db.Column(db.Date, nullable=False)
    expected_revenue = db.Column(db.Float, default=0)
    status = db.Column(db.String(30), default="lead")
    next_action = db.Column(db.String(255), default="")
    next_action_date = db.Column(db.Date, nullable=True)
    created_by_user_id = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "companyId": self.company_id,
            "category": self.category,
            "prospect": self.prospect,
            "expectedClosingDate": self.expected_closing_date.isoformat() if self.expected_closing_date else None,
            "expectedRevenue": float(self.expected_revenue) if self.expected_revenue is not None else 0,
            "status": self.status,
            "nextAction": self.next_action or "",
            "nextActionDate": self.next_action_date.isoformat() if self.next_action_date else None,
            "createdByUserId": self.created_by_user_id or "",
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
        }


class SalesStatusLog(db.Model):
    __tablename__ = "sales_status_logs"
    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    sales_id = db.Column(db.String(40), db.ForeignKey("sales.id"), nullable=False)
    from_status = db.Column(db.String(30), nullable=False)
    to_status = db.Column(db.String(30), nullable=False)
    note = db.Column(db.Text, nullable=False)
    changed_by_user_id = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=True)
    changed_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "salesId": self.sales_id,
            "fromStatus": self.from_status,
            "toStatus": self.to_status,
            "note": self.note,
            "changedByUserId": self.changed_by_user_id or "",
            "changedAt": self.changed_at.isoformat() + "Z" if self.changed_at else None,
        }


class SalesActivity(db.Model):
    __tablename__ = "sales_activities"
    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    sales_id = db.Column(db.String(40), db.ForeignKey("sales.id"), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    note = db.Column(db.Text, nullable=False)
    date = db.Column(db.Date, nullable=False)
    created_by_user_id = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "salesId": self.sales_id,
            "title": self.title,
            "note": self.note,
            "date": self.date.isoformat() if self.date else None,
            "createdByUserId": self.created_by_user_id or "",
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
        }


class Order(db.Model):
    __tablename__ = "orders"
    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    company_id = db.Column(db.String(40), db.ForeignKey("companies.id"), nullable=False, index=True)
    sales_id = db.Column(db.String(40), db.ForeignKey("sales.id"), nullable=False, index=True)
    order_details = db.Column(db.Text, nullable=False)
    revenue = db.Column(db.Float, nullable=False, default=0)
    order_confirmation_date = db.Column(db.Date, nullable=False)
    delivery_date = db.Column(db.Date, nullable=False)
    assign_to_user_id = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=False)
    forwarded_to_user_id = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=True)
    # JSON stringified list: [{ fileName, data }]
    attachments = db.Column(LongText, nullable=True)
    # Snapshots from related sales/deal at creation time
    status = db.Column(db.String(30), default="pending")
    next_action = db.Column(db.String(255), default="")
    next_action_date = db.Column(db.Date, nullable=True)
    created_by_user_id = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "companyId": self.company_id,
            "salesId": self.sales_id,
            "orderDetails": self.order_details,
            "revenue": float(self.revenue) if self.revenue is not None else 0,
            "orderConfirmationDate": self.order_confirmation_date.isoformat() if self.order_confirmation_date else None,
            "deliveryDate": self.delivery_date.isoformat() if self.delivery_date else None,
            "assignTo": self.assign_to_user_id,
            "forwardedTo": self.forwarded_to_user_id or "",
            "attachments": self.attachments or "[]",
            "status": self.status or "",
            "nextAction": self.next_action or "",
            "nextActionDate": self.next_action_date.isoformat() if self.next_action_date else None,
            "createdByUserId": self.created_by_user_id or "",
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() + "Z" if self.updated_at else None,
        }


class Renewal(db.Model):
    __tablename__ = "renewals"
    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    company_id = db.Column(db.String(40), db.ForeignKey("companies.id"), nullable=False, index=True)
    # Mirrors company KAM at save-time; always derived from company data
    kam_user_id = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=True, index=True)
    product_details = db.Column(db.String(500), nullable=False)
    renewal_type = db.Column(db.String(20), nullable=False, default="existing")
    source = db.Column(db.String(150), nullable=False)
    renewal_date = db.Column(db.Date, nullable=False, index=True)
    # Snapshot for reporting convenience if company location changes later
    company_location = db.Column(db.String(255), default="")
    created_by_user_id = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=True)
    deleted_at = db.Column(db.DateTime, nullable=True, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        renewal_type = self.renewal_type or "existing"
        if renewal_type in ("partial", "pertial"):
            renewal_type = "potential"
        return {
            "id": self.id,
            "companyId": self.company_id,
            "kamUserId": self.kam_user_id or "",
            "productDetails": self.product_details,
            "renewalType": renewal_type,
            "source": self.source,
            "renewalDate": self.renewal_date.isoformat() if self.renewal_date else None,
            "companyLocation": self.company_location or "",
            "createdByUserId": self.created_by_user_id or "",
            "deletedAt": self.deleted_at.isoformat() + "Z" if self.deleted_at else None,
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() + "Z" if self.updated_at else None,
        }


class StatusConfig(db.Model):
    """Stored status options for tasks, sales, and orders (task_status, sales_category, sales_status, order_status)."""
    __tablename__ = "status_config"
    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    group = db.Column(db.String(30), nullable=False, index=True)  # task_status | sales_category | sales_status | order_status
    value = db.Column(db.String(60), nullable=False)
    sort_order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True, nullable=False)  # order_status: admin can hide from order dropdown
    __table_args__ = (db.UniqueConstraint("group", "value", name="uq_status_config_group_value"),)


class Currency(db.Model):
    """Currencies for Settings > Currency. Admin can add, edit, remove."""
    __tablename__ = "currencies"
    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    code = db.Column(db.String(10), unique=True, nullable=False, index=True)  # e.g. USD, EUR
    name = db.Column(db.String(100), nullable=False)  # e.g. US Dollar
    symbol = db.Column(db.String(10), default="")  # e.g. $, €
    sort_order = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "code": self.code,
            "name": self.name,
            "symbol": self.symbol or "",
            "sortOrder": self.sort_order,
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
        }


class ExpensePurpose(db.Model):
    """Expense purposes (e.g. Travel, Meals). Admin manages in Settings. Shown in expense add form. Can be active/inactive."""
    __tablename__ = "expense_purposes"
    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    name = db.Column(db.String(100), nullable=False)
    sort_order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name or "",
            "sortOrder": self.sort_order,
            "isActive": self.is_active if self.is_active is not None else True,
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
        }


class Expense(db.Model):
    """Expenses: company, date, amount (go/single), amount_return (come, round_trip only), from/to location, purpose_id, purpose (notes), trip type, created by, status."""
    __tablename__ = "expenses"
    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    company_id = db.Column(db.String(40), db.ForeignKey("companies.id"), nullable=False)
    date = db.Column(db.Date, nullable=False)
    amount = db.Column(db.Float, nullable=False, default=0)
    amount_return = db.Column(db.Float, nullable=True)  # return leg amount for round_trip; null for single_trip
    from_location = db.Column(db.String(200), default="")
    to_location = db.Column(db.String(200), default="")
    purpose_id = db.Column(db.String(40), db.ForeignKey("expense_purposes.id"), nullable=True)  # dropdown purpose
    purpose = db.Column(db.String(500), default="")  # optional notes
    trip_type = db.Column(db.String(20), default="single_trip")  # single_trip | round_trip
    created_by_user_id = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=True)
    status = db.Column(db.String(20), default="unpaid")  # unpaid | paid
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    deleted_at = db.Column(db.DateTime, nullable=True, index=True)

    def to_dict(self):
        purpose_name = ""
        if self.purpose_id:
            p = ExpensePurpose.query.get(self.purpose_id)
            if p:
                purpose_name = p.name or ""
        return {
            "id": self.id,
            "companyId": self.company_id,
            "date": self.date.isoformat() if self.date else None,
            "amount": float(self.amount) if self.amount is not None else 0,
            "amountReturn": float(self.amount_return) if self.amount_return is not None else None,
            "fromLocation": self.from_location or "",
            "toLocation": self.to_location or "",
            "purposeId": self.purpose_id or "",
            "purposeName": purpose_name,
            "purpose": self.purpose or "",  # notes
            "tripType": self.trip_type or "single_trip",
            "createdByUserId": self.created_by_user_id or "",
            "status": self.status or "unpaid",
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
            "deletedAt": self.deleted_at.isoformat() + "Z" if self.deleted_at else None,
        }


class AccountParticular(db.Model):
    """Particulars for account entries: separate lists for received vs expense. Admin manages in Settings."""
    __tablename__ = "account_particulars"
    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    name = db.Column(db.String(200), nullable=False)
    type = db.Column(db.String(20), nullable=False)  # received | expense
    sort_order = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name or "",
            "type": self.type or "received",
            "sortOrder": self.sort_order,
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
        }


class AccountEntry(db.Model):
    """Office accounts: debit (deposits), credit (expenses), running balance. Voucher from system. Optional attachment.
    Table is auto-created by db.create_all() with all columns (including description); or by ensure_account_entries_table if table missing."""
    __tablename__ = "account_entries"
    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    date = db.Column(db.Date, nullable=False)
    particular = db.Column(db.String(500), default="")  # dropdown particular name
    description = db.Column(db.String(1000), default="")  # optional free-text description; table created with this column
    voucher_no = db.Column(db.String(50), default="")   # system-generated e.g. V-2025-03-1
    amount_debit = db.Column(Numeric(12, 2), default=0, nullable=False)  # money received
    amount_credit = db.Column(Numeric(12, 2), default=0, nullable=False)  # money spent
    paid_by = db.Column(db.String(100), default="")    # e.g. Petty Cash, AppTriangle
    paid_to = db.Column(db.String(100), default="")    # e.g. Petty Cash or user input for expense
    attachment_filename = db.Column(db.String(255), default="")
    attachment_data = db.Column(LongText, nullable=True)  # base64
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_by_user_id = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=True)

    def to_dict(self, include_attachment_data=False):
        out = {
            "id": self.id,
            "date": self.date.isoformat() if self.date else None,
            "particular": self.particular or "",
            "description": self.description or "",
            "voucherNo": self.voucher_no or "",
            "amountDebit": float(self.amount_debit or 0),
            "amountCredit": float(self.amount_credit or 0),
            "paidBy": self.paid_by or "",
            "paidTo": self.paid_to or "",
            "hasAttachment": bool(self.attachment_filename or self.attachment_data),
            "attachmentFileName": self.attachment_filename or None,
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
            "createdByUserId": self.created_by_user_id or "",
        }
        if include_attachment_data and self.attachment_data:
            out["attachmentData"] = self.attachment_data
        return out


class Notification(db.Model):
    __tablename__ = "notifications"
    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    user_id = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=False, index=True)
    title = db.Column(db.String(255), nullable=False)
    message = db.Column(db.Text, nullable=False)
    type = db.Column(db.String(30), default="info")  # info | success | warning | error
    category = db.Column(db.String(30), default="system")  # task | pms | hr | system
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User", backref=db.backref("notifications", lazy="dynamic"))

    def to_dict(self):
        return {
            "id": self.id,
            "userId": self.user_id,
            "title": self.title,
            "message": self.message,
            "type": self.type,
            "category": self.category or "system",
            "isRead": self.is_read,
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
        }


class CompanyProfile(db.Model):
    """Single row: organization/company profile for Settings > Company tab."""
    __tablename__ = "company_profile"
    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    name = db.Column(db.String(255), default="")
    email = db.Column(db.String(255), default="")
    phone = db.Column(db.String(50), default="")
    website = db.Column(db.String(255), default="")
    address = db.Column(db.String(255), default="")
    city = db.Column(db.String(100), default="")
    country = db.Column(db.String(100), default="")
    industry = db.Column(db.String(100), default="")
    tax_id = db.Column(db.String(50), default="")
    description = db.Column(db.Text, default="")
    logo = db.Column(LongText, nullable=True)  # base64 data URL; MEDIUMTEXT on MySQL (16MB)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name or "",
            "email": self.email or "",
            "phone": self.phone or "",
            "website": self.website or "",
            "address": self.address or "",
            "city": self.city or "",
            "country": self.country or "",
            "industry": self.industry or "",
            "taxId": self.tax_id or "",
            "description": self.description or "",
            "logo": self.logo,
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() + "Z" if self.updated_at else None,
        }


class Shift(db.Model):
    """Shifts configuration for employees."""
    __tablename__ = "shifts"
    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    name = db.Column(db.String(255), nullable=False)
    start_time = db.Column(db.String(10), nullable=False)  # HH:MM
    end_time = db.Column(db.String(10), nullable=False)    # HH:MM
    weekend_days = db.Column(db.JSON, nullable=False)      # [5, 6] for Sat, Sun
    grace_period = db.Column(db.Integer, default=0)       # in minutes
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "startTime": self.start_time,
            "endTime": self.end_time,
            "weekendDays": self.weekend_days,
            "gracePeriod": self.grace_period,
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() + "Z" if self.updated_at else None,
        }


class HRInfo(db.Model):
    """HR information for users. One-to-one with User."""
    __tablename__ = "hr_info"
    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    user_id = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=False, unique=True, index=True)
    birth_date = db.Column(db.Date, nullable=True)
    nid = db.Column(db.String(100), default="")
    department = db.Column(db.String(200), default="")
    designation = db.Column(db.String(200), default="")
    religion = db.Column(db.String(100), default="")
    blood_group = db.Column(db.String(10), default="")
    office_mail = db.Column(db.String(255), default="")
    personal_mail = db.Column(db.String(255), default="")
    marital_status = db.Column(db.String(50), default="")
    gender = db.Column(db.String(50), default="")
    employee_type = db.Column(db.String(50), default="")
    reporting_manager_id = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=True)
    shift_id = db.Column(db.String(40), db.ForeignKey("shifts.id"), nullable=True)
    present_address = db.Column(db.Text, default="")
    permanent_address = db.Column(db.Text, default="")
    name = db.Column(db.String(255), default="")
    mobile = db.Column(db.String(50), default="")
    employee_id = db.Column(db.String(100), default="")
    joining_date = db.Column(db.Date, nullable=True)  # Employee joining date
    profile_picture = db.Column(LongText, nullable=True)  # base64 data URL
    bank_routing_number = db.Column(db.String(100), default="")
    beneficiary_bank_account_number = db.Column(db.String(100), default="")
    receiver_name = db.Column(db.String(255), default="")
    # Emergency contact stored as JSON fields
    emergency_contact_name = db.Column(db.String(255), default="")
    emergency_contact_phone = db.Column(db.String(50), default="")
    emergency_contact_relation = db.Column(db.String(100), default="")
    emergency_contact_address = db.Column(db.Text, default="")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    shift = db.relationship("Shift")

    def to_dict(self):
        return {
            "id": self.id,
            "userId": self.user_id,
            "birthDate": self.birth_date.isoformat() if self.birth_date else None,
            "nid": self.nid or "",
            "department": self.department or "",
            "designation": self.designation or "",
            "religion": self.religion or "",
            "bloodGroup": self.blood_group or "",
            "officeMail": self.office_mail or "",
            "personalMail": self.personal_mail or "",
            "maritalStatus": self.marital_status or "",
            "gender": self.gender or "",
            "employeeType": self.employee_type or "",
            "reportingManagerId": self.reporting_manager_id or "",
            "shiftId": self.shift_id or "",
            "shift": self.shift.to_dict() if self.shift else None,
            "presentAddress": self.present_address or "",
            "permanentAddress": self.permanent_address or "",
            "name": self.name or "",
            "mobile": self.mobile or "",
            "employeeId": self.employee_id or "",
            "joiningDate": self.joining_date.isoformat() if self.joining_date else None,
            "profilePicture": self.profile_picture,
            "bankRoutingNumber": self.bank_routing_number or "",
            "beneficiaryBankAccountNumber": self.beneficiary_bank_account_number or "",
            "receiverName": self.receiver_name or "",
            "emergencyContact": {
                "name": self.emergency_contact_name or "",
                "phone": self.emergency_contact_phone or "",
                "relation": self.emergency_contact_relation or "",
                "address": self.emergency_contact_address or "",
            },
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() + "Z" if self.updated_at else None,
        }


class EmploymentHistory(db.Model):
    """Employment history entries for HR."""
    __tablename__ = "employment_history"
    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    hr_info_id = db.Column(db.String(40), db.ForeignKey("hr_info.id"), nullable=False, index=True)
    activity = db.Column(db.String(255), default="")  # e.g., "Apprisal", "Joined"
    appraisal_date = db.Column(db.Date, nullable=True)  # Date for the activity
    next_activity = db.Column(db.String(255), default="")  # e.g., "Increment", "Apprisal"
    next_activity_date = db.Column(db.Date, nullable=True)  # Date for next activity
    remarks = db.Column(db.Text, default="")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "hrInfoId": self.hr_info_id,
            "activity": self.activity or "",
            "appraisalDate": self.appraisal_date.isoformat() if self.appraisal_date else None,
            "nextActivity": self.next_activity or "",
            "nextActivityDate": self.next_activity_date.isoformat() if self.next_activity_date else None,
            "remarks": self.remarks or "",
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() + "Z" if self.updated_at else None,
        }


class AcademicCertification(db.Model):
    """Academic certifications for HR."""
    __tablename__ = "academic_certifications"
    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    hr_info_id = db.Column(db.String(40), db.ForeignKey("hr_info.id"), nullable=False, index=True)
    degree = db.Column(db.String(255), default="")
    institute = db.Column(db.String(255), default="")
    grade = db.Column(db.String(100), default="")
    year = db.Column(db.String(50), default="")
    attachment_filename = db.Column(db.String(255), default="")
    attachment_data = db.Column(LongText, default="")  # base64 string
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "hrInfoId": self.hr_info_id,
            "degree": self.degree or "",
            "institute": self.institute or "",
            "grade": self.grade or "",
            "year": self.year or "",
            "attachmentFileName": self.attachment_filename or "",
            "attachmentData": self.attachment_data or "",
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() + "Z" if self.updated_at else None,
        }


class Department(db.Model):
    """Departments (e.g. Engineering, Sales, HR). Admin manages in Settings > Variables."""
    __tablename__ = "departments"
    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    name = db.Column(db.String(200), unique=True, nullable=False, index=True)
    sort_order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name or "",
            "sortOrder": self.sort_order,
            "isActive": self.is_active if self.is_active is not None else True,
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
        }


class Designation(db.Model):
    """Designations (e.g. Software Engineer, Sales Manager, HR Manager). Admin manages in Settings > Variables."""
    __tablename__ = "designations"
    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    name = db.Column(db.String(200), unique=True, nullable=False, index=True)
    sort_order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name or "",
            "sortOrder": self.sort_order,
            "isActive": self.is_active if self.is_active is not None else True,
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
        }


class EmployeeType(db.Model):
    """Employment types (e.g. Full Time, Part Time). Admin manages in Settings > Variables."""
    __tablename__ = "employee_types"
    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    name = db.Column(db.String(200), unique=True, nullable=False, index=True)
    sort_order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name or "",
            "sortOrder": self.sort_order,
            "isActive": self.is_active if self.is_active is not None else True,
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
        }


class EmergencyContact(db.Model):
    """Emergency contacts for HR."""
    __tablename__ = "emergency_contacts"
    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    hr_info_id = db.Column(db.String(40), db.ForeignKey("hr_info.id"), nullable=False, index=True)
    name = db.Column(db.String(255), default="")
    phone = db.Column(db.String(50), default="")
    relation = db.Column(db.String(100), default="")
    address = db.Column(db.Text, default="")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "hrInfoId": self.hr_info_id,
            "name": self.name or "",
            "phone": self.phone or "",
            "relation": self.relation or "",
            "address": self.address or "",
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() + "Z" if self.updated_at else None,
        }


class Attendance(db.Model):
    __tablename__ = "attendance"
    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    user_id = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=False, index=True)
    date = db.Column(db.Date, nullable=False, index=True)
    check_in_time = db.Column(db.DateTime, nullable=True)
    check_out_time = db.Column(db.DateTime, nullable=True)
    check_in_location = db.Column(db.String(255), nullable=True)  # Location where user checked in
    check_out_location = db.Column(db.String(255), nullable=True)  # Location where user checked out
    status = db.Column(db.String(20), default="present")  # present, late, absent
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = db.relationship("User", backref="attendances")

    def to_dict(self):
        return {
            "id": self.id,
            "userId": self.user_id,
            "date": self.date.isoformat() if self.date else None,
            "checkInTime": self.check_in_time.isoformat() + "Z" if self.check_in_time else None,
            "checkOutTime": self.check_out_time.isoformat() + "Z" if self.check_out_time else None,
            "checkInLocation": self.check_in_location or None,
            "checkOutLocation": self.check_out_location or None,
            "status": self.status,
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() + "Z" if self.updated_at else None,
        }


class AttendanceReconciliation(db.Model):
    """Late attendance correction workflow: user requests, attendance admin reviews."""

    __tablename__ = "attendance_reconciliations"

    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    attendance_id = db.Column(db.String(40), db.ForeignKey("attendance.id"), nullable=False, index=True)
    user_id = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=False, index=True)
    attendance_date = db.Column(db.Date, nullable=False, index=True)
    requested_check_in_time = db.Column(db.String(8), nullable=False)
    reason = db.Column(db.Text, nullable=False)
    applicant_note = db.Column(db.Text, default="")
    status = db.Column(db.String(20), nullable=False, default="pending")
    reviewed_by_user_id = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=True)
    reviewed_at = db.Column(db.DateTime, nullable=True)
    review_note = db.Column(db.Text, default="")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    attendance = db.relationship("Attendance", backref=db.backref("reconciliation_requests", lazy="dynamic"))
    applicant = db.relationship("User", foreign_keys=[user_id])
    reviewed_by = db.relationship("User", foreign_keys=[reviewed_by_user_id])

    def to_dict(self):
        return {
            "id": self.id,
            "attendanceId": self.attendance_id,
            "userId": self.user_id,
            "attendanceDate": self.attendance_date.isoformat() if self.attendance_date else None,
            "requestedCheckInTime": self.requested_check_in_time,
            "reason": self.reason or "",
            "applicantNote": self.applicant_note or "",
            "status": self.status,
            "reviewedByUserId": self.reviewed_by_user_id,
            "reviewedAt": self.reviewed_at.isoformat() + "Z" if self.reviewed_at else None,
            "reviewNote": self.review_note or "",
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() + "Z" if self.updated_at else None,
        }


class LeaveType(db.Model):
    """Leave types (e.g. Sick Leave, Casual Leave). Admin manages in Settings."""
    __tablename__ = "leave_types"
    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    name = db.Column(db.String(100), unique=True, nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "isActive": self.is_active,
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
        }


class EmployeeLeaveBalance(db.Model):
    """Per-employee leave balance for each leave type."""
    __tablename__ = "employee_leave_balances"
    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    user_id = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=False, index=True)
    leave_type_id = db.Column(db.String(40), db.ForeignKey("leave_types.id"), nullable=False, index=True)
    balance = db.Column(db.Numeric(8, 2), nullable=False, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint("user_id", "leave_type_id", name="uq_employee_leave_balance_user_type"),
    )

    user = db.relationship("User")
    leave_type = db.relationship("LeaveType")

    def to_dict(self):
        return {
            "id": self.id,
            "userId": self.user_id,
            "leaveTypeId": self.leave_type_id,
            "leaveTypeName": self.leave_type.name if self.leave_type else "",
            "balance": float(self.balance) if self.balance is not None else 0.0,
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() + "Z" if self.updated_at else None,
        }


class Weekend(db.Model):
    """Configured weekend days (0=Monday, 6=Sunday)."""
    __tablename__ = "weekends"
    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    day_of_week = db.Column(db.Integer, nullable=False, unique=True)  # 0=Monday, 6=Sunday
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        return {
            "id": self.id,
            "dayOfWeek": self.day_of_week,
            "dayName": day_names[self.day_of_week] if 0 <= self.day_of_week <= 6 else "Unknown",
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
        }


class Holiday(db.Model):
    """Configured holidays (single or multi-day inclusive range)."""
    __tablename__ = "holidays"
    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    name = db.Column(db.String(255), nullable=False)
    start_date = db.Column(db.Date, nullable=False, index=True)
    end_date = db.Column(db.Date, nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def duration_days_inclusive(self) -> int:
        if not self.start_date or not self.end_date:
            return 0
        return (self.end_date - self.start_date).days + 1

    @classmethod
    def all_observed_dates(cls):
        """Every calendar date covered by any holiday range (for leave/attendance)."""
        out = set()
        for h in cls.query.all():
            d = h.start_date
            while d <= h.end_date:
                out.add(d)
                d += timedelta(days=1)
        return out

    def to_dict(self):
        dur = self.duration_days_inclusive()
        sd = self.start_date.isoformat() if self.start_date else None
        ed = self.end_date.isoformat() if self.end_date else None
        return {
            "id": self.id,
            "name": self.name,
            "startDate": sd,
            "endDate": ed,
            "durationDays": dur,
            "date": sd,
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
        }


class Leave(db.Model):
    """Leave requests by employees."""
    __tablename__ = "leaves"
    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    user_id = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=False, index=True)
    leave_type_id = db.Column(db.String(40), db.ForeignKey("leave_types.id"), nullable=False)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    # single_day | half_day | multiple_day — how the request spans time
    duration_type = db.Column(db.String(20), nullable=False, default="single_day")
    # Stored entitlement count: 1, 0.5, or working-days total for multiple_day
    total_leave_days = db.Column(db.Numeric(8, 2), nullable=False, default=1)
    # Portion beyond remaining quota (still allowed; flagged as additional leave)
    additional_leave_days = db.Column(db.Numeric(8, 2), nullable=False, default=0)
    # first_half | second_half — only when duration_type is half_day
    half_day_period = db.Column(db.String(20), nullable=True)
    reason = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(20), default="pending")  # pending, approved, rejected
    attachment_filename = db.Column(db.String(255), default="")
    attachment_data = db.Column(LongText, nullable=True)  # base64
    approved_by_user_id = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=True)
    rejection_reason = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = db.relationship("User", foreign_keys=[user_id], backref="leaves")
    approver = db.relationship("User", foreign_keys=[approved_by_user_id])
    leave_type = db.relationship("LeaveType")

    def to_dict(self, include_attachment_data=False):
        tld = (
            float(self.total_leave_days)
            if self.total_leave_days is not None
            else None
        )
        add_ld = (
            float(self.additional_leave_days)
            if self.additional_leave_days is not None
            else 0.0
        )
        out = {
            "id": self.id,
            "userId": self.user_id,
            "userName": self.user.name if self.user else "",
            "leaveTypeId": self.leave_type_id,
            "leaveTypeName": self.leave_type.name if self.leave_type else "",
            "startDate": self.start_date.isoformat() if self.start_date else None,
            "endDate": self.end_date.isoformat() if self.end_date else None,
            "durationType": self.duration_type or "single_day",
            "totalLeaveDays": tld,
            "additionalLeaveDays": add_ld,
            "halfDayPeriod": self.half_day_period,
            "reason": self.reason,
            "status": self.status,
            "attachmentFileName": self.attachment_filename or None,
            "approvedByUserId": self.approved_by_user_id or "",
            "approvedByName": self.approver.name if self.approver else "",
            "rejectionReason": self.rejection_reason or "",
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() + "Z" if self.updated_at else None,
        }
        if tld is not None:
            out["workingDays"] = tld
        if include_attachment_data and self.attachment_data:
            out["attachmentData"] = self.attachment_data
        return out


class UserPagePermission(db.Model):
    """Optional per-user override for a module. access_type: none | user | admin."""

    __tablename__ = "user_page_permissions"
    __table_args__ = (
        db.UniqueConstraint("user_id", "page_key", name="uq_user_page_permissions_user_page"),
    )

    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    user_id = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=False, index=True)
    page_key = db.Column(db.String(64), nullable=False, index=True)
    access_type = db.Column(db.String(20), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = db.relationship("User", backref=db.backref("page_permissions", lazy="dynamic"))

    def to_dict(self):
        return {
            "pageKey": self.page_key,
            "accessType": self.access_type,
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() + "Z" if self.updated_at else None,
        }


class RolePageDefault(db.Model):
    """Default module access for users with global role admin | user when no per-user row exists."""

    __tablename__ = "role_page_defaults"
    __table_args__ = (
        db.UniqueConstraint("role", "page_key", name="uq_role_page_defaults_role_page"),
    )

    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    role = db.Column(db.String(20), nullable=False, index=True)
    page_key = db.Column(db.String(64), nullable=False, index=True)
    access_type = db.Column(db.String(20), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "role": self.role,
            "pageKey": self.page_key,
            "accessType": self.access_type,
            "updatedAt": self.updated_at.isoformat() + "Z" if self.updated_at else None,
        }


class RFQ(db.Model):
    """Request for Quotation tied to a sales deal; multi-step approval workflow."""

    __tablename__ = "rfqs"

    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    sales_id = db.Column(db.String(40), db.ForeignKey("sales.id"), nullable=False, index=True)
    company_id = db.Column(db.String(40), db.ForeignKey("companies.id"), nullable=False, index=True)
    created_by_user_id = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=False, index=True)
    # draft | pending_rbac | pending_system | reapplied | approved | rejected
    status = db.Column(db.String(32), nullable=False, default="draft", index=True)
    notes_overall = db.Column(db.Text, nullable=True)
    rejection_reason = db.Column(db.Text, nullable=True)
    submitted_at = db.Column(db.DateTime, nullable=True)
    pricing_submitted_at = db.Column(db.DateTime, nullable=True)
    resolved_at = db.Column(db.DateTime, nullable=True)
    approved_by_user_id = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=True)
    rejected_by_user_id = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=True)
    # RFQ module admin (UserPagePermission rfq+admin) who should handle pending_rbac pricing; null = any RFQ admin.
    pricing_assignee_user_id = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=True, index=True)
    # VAT as percentage of subtotal (e.g. 5.0 = 5%); set by pricing admin; null = UI default 5%.
    vat_percent = db.Column(db.Float, nullable=True)
    # Increments on each reopen after approval (v1 = initial cycle).
    version_number = db.Column(db.Integer, nullable=False, default=1)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    items = db.relationship(
        "RFQItem",
        back_populates="rfq",
        cascade="all, delete-orphan",
        order_by="RFQItem.line_no",
    )


class RfqPricingHistory(db.Model):
    """Immutable snapshot of RFQ line pricing + VAT when a version is archived on reopen."""

    __tablename__ = "rfq_pricing_history"
    __table_args__ = (UniqueConstraint("rfq_id", "version_number", name="uq_rfq_pricing_history_rfq_version"),)

    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    rfq_id = db.Column(db.String(40), db.ForeignKey("rfqs.id"), nullable=False, index=True)
    version_number = db.Column(db.Integer, nullable=False)
    items_json = db.Column(db.Text, nullable=False)
    vat_percent = db.Column(db.Float, nullable=True)
    approved_by_user_id = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=True)
    approved_at = db.Column(db.DateTime, nullable=True)
    archived_at = db.Column(db.DateTime, nullable=False)
    archived_by_user_id = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class RfqInvoiceHistory(db.Model):
    """Immutable invoice totals + line snapshot for the same version as rfq_pricing_history."""

    __tablename__ = "rfq_invoice_history"
    __table_args__ = (UniqueConstraint("rfq_id", "version_number", name="uq_rfq_invoice_history_rfq_version"),)

    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    rfq_id = db.Column(db.String(40), db.ForeignKey("rfqs.id"), nullable=False, index=True)
    version_number = db.Column(db.Integer, nullable=False)
    items_json = db.Column(db.Text, nullable=False)
    subtotal = db.Column(db.Float, nullable=False)
    vat_amount = db.Column(db.Float, nullable=False)
    total_amount = db.Column(db.Float, nullable=False)
    vat_percent = db.Column(db.Float, nullable=True)
    approved_by_user_id = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=True)
    approved_at = db.Column(db.DateTime, nullable=True)
    archived_at = db.Column(db.DateTime, nullable=False)
    archived_by_user_id = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class RFQItem(db.Model):
    __tablename__ = "rfq_items"

    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    rfq_id = db.Column(db.String(40), db.ForeignKey("rfqs.id"), nullable=False, index=True)
    line_no = db.Column(db.Integer, nullable=False, default=0)
    description = db.Column(db.Text, nullable=False, default="")
    quantity = db.Column(db.Float, nullable=False, default=1)
    unit_buying_price = db.Column(db.Float, nullable=True)
    profit_per_unit = db.Column(db.Float, nullable=True)
    unit_selling_price = db.Column(db.Float, nullable=True)
    total_profit = db.Column(db.Float, nullable=True)
    line_note = db.Column(db.Text, nullable=True)
    # VAT % applied to this line's extended amount (qty × unit selling). Falls back to RFQ vat_percent when null.
    vat_percent = db.Column(db.Float, nullable=True)

    rfq = db.relationship("RFQ", back_populates="items")


class Credential(db.Model):
    """
    Encrypted secrets at rest: username and password are Fernet ciphertext in DB.
    url / note are plaintext; legacy description migrated to note.
    """

    __tablename__ = "credentials"

    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    title = db.Column(db.String(500), nullable=False)
    # Fernet token (ASCII); legacy plaintext rows are migrated on startup / script
    username_encrypted = db.Column(db.Text, nullable=False, default="")
    password_encrypted = db.Column(db.Text, nullable=False)
    url = db.Column(db.String(2000), nullable=True)
    note = db.Column(db.Text, nullable=True)
    description = db.Column(db.Text, default="")  # deprecated; migrated into note
    tags = db.Column(db.Text, default="[]")  # JSON array of strings
    owner_id = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = db.Column(db.DateTime, nullable=True, index=True)

    owner = db.relationship("User", foreign_keys=[owner_id], backref=db.backref("owned_credentials", lazy="dynamic"))
    shares = db.relationship(
        "CredentialShare",
        back_populates="credential",
        cascade="all, delete-orphan",
        lazy="dynamic",
    )


class CredentialShare(db.Model):
    """Time-bound share of a credential to another user."""

    __tablename__ = "credential_shares"
    __table_args__ = (
        db.UniqueConstraint("credential_id", "shared_with_user_id", name="uq_cred_share_cred_user"),
    )

    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    credential_id = db.Column(db.String(40), db.ForeignKey("credentials.id"), nullable=False, index=True)
    shared_with_user_id = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=False, index=True)
    shared_by_user_id = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=False)
    # NULL = access does not expire (forever)
    expiry_datetime = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    credential = db.relationship("Credential", back_populates="shares")
    shared_with = db.relationship("User", foreign_keys=[shared_with_user_id])
    shared_by = db.relationship("User", foreign_keys=[shared_by_user_id])


class CredentialAccessLog(db.Model):
    """Audit: who revealed or viewed sensitive credential payloads."""

    __tablename__ = "credential_access_logs"

    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    credential_id = db.Column(
        db.String(40), db.ForeignKey("credentials.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=False, index=True)
    action = db.Column(db.String(40), nullable=False)  # reveal_password
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    user = db.relationship("User", foreign_keys=[user_id])


# --- Report automation (extensible for future report types) ---

class ReportAutomation(db.Model):
    """Scheduled or manual report automation configuration."""

    __tablename__ = "report_automations"

    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    report_name = db.Column(db.String(255), nullable=False)
    report_type = db.Column(db.String(64), nullable=False, default="attendance")
    description = db.Column(db.Text, default="")
    schedule_type = db.Column(db.String(32), nullable=False, default="one_time")
    start_date = db.Column(db.Date, nullable=False)
    execution_time = db.Column(db.String(8), nullable=False)  # HH:MM
    timezone = db.Column(db.String(64), nullable=False, default="UTC")
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_by = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    creator = db.relationship("User", foreign_keys=[created_by])
    shift_links = db.relationship(
        "ReportAutomationShift",
        back_populates="automation",
        cascade="all, delete-orphan",
        lazy="joined",
    )
    recipient_links = db.relationship(
        "ReportAutomationRecipient",
        back_populates="automation",
        cascade="all, delete-orphan",
        lazy="joined",
    )
    execution_logs = db.relationship(
        "ReportExecutionLog",
        back_populates="automation",
        cascade="all, delete-orphan",
        lazy="dynamic",
    )

    def to_dict(self, *, include_relations: bool = False, next_run_at=None):
        out = {
            "id": self.id,
            "reportName": self.report_name,
            "reportType": self.report_type,
            "description": self.description or "",
            "scheduleType": self.schedule_type,
            "startDate": self.start_date.isoformat() if self.start_date else None,
            "executionTime": self.execution_time,
            "timezone": self.timezone,
            "isActive": bool(self.is_active),
            "createdBy": self.created_by,
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() + "Z" if self.updated_at else None,
        }
        if next_run_at is not None:
            out["nextRunAt"] = next_run_at.isoformat() + "Z" if next_run_at else None
        if include_relations:
            out["shiftIds"] = [s.shift_id for s in self.shift_links]
            out["recipientUserIds"] = [r.user_id for r in self.recipient_links]
            out["recipientsCount"] = len(self.recipient_links)
        return out


class ReportAutomationShift(db.Model):
    __tablename__ = "report_automation_shifts"
    __table_args__ = (
        db.UniqueConstraint("report_automation_id", "shift_id", name="uq_report_auto_shift"),
    )

    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    report_automation_id = db.Column(
        db.String(40), db.ForeignKey("report_automations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    shift_id = db.Column(db.String(40), db.ForeignKey("shifts.id", ondelete="CASCADE"), nullable=False, index=True)

    automation = db.relationship("ReportAutomation", back_populates="shift_links")
    shift = db.relationship("Shift")


class ReportAutomationRecipient(db.Model):
    __tablename__ = "report_automation_recipients"
    __table_args__ = (
        db.UniqueConstraint("report_automation_id", "user_id", name="uq_report_auto_recipient"),
    )

    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    report_automation_id = db.Column(
        db.String(40), db.ForeignKey("report_automations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id = db.Column(db.String(40), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    automation = db.relationship("ReportAutomation", back_populates="recipient_links")
    user = db.relationship("User")


class ReportExecutionLog(db.Model):
    __tablename__ = "report_execution_logs"

    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    report_automation_id = db.Column(
        db.String(40), db.ForeignKey("report_automations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    execution_time = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    status = db.Column(db.String(20), nullable=False, default="success")  # success | failed
    is_manual = db.Column(db.Boolean, default=False, nullable=False)
    recipient_count = db.Column(db.Integer, default=0)
    recipient_user_ids = db.Column(db.Text, default="[]")
    file_path = db.Column(db.String(512), default="")
    error_message = db.Column(db.Text, default="")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    automation = db.relationship("ReportAutomation", back_populates="execution_logs")

    def to_dict(self, *, recipients: list | None = None):
        data = {
            "id": self.id,
            "reportAutomationId": self.report_automation_id,
            "executionTime": self.execution_time.isoformat() + "Z" if self.execution_time else None,
            "status": self.status,
            "recipientCount": self.recipient_count or 0,
            "filePath": self.file_path or "",
            "errorMessage": self.error_message or "",
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
            "reportName": self.automation.report_name if self.automation else "",
        }
        if recipients is not None:
            data["recipients"] = recipients
        return data