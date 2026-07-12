"""Office accounts API: list, create, get, update, delete. Debit = money in, Credit = money out. Voucher from system."""
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
import calendar
from sqlalchemy import func, text, inspect
from flask import Blueprint, request, jsonify
from app import db
from app.models import AccountEntry
from app.auth_utils import get_current_user, require_admin_or_accounts_access
from app.services.account_ledger_service import list_entries_with_running_balance

accounts_bp = Blueprint("accounts", __name__)


def _parse_date(s):
    if not s:
        return None
    try:
        if "T" in s:
            return datetime.fromisoformat(s.replace("Z", "+00:00")).date()
        return date.fromisoformat(s)
    except Exception:
        return None


def _parse_money(value) -> Decimal:
    """Parse request amount to 2-decimal Decimal."""
    if value is None:
        return Decimal("0.00")
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _generate_voucher_no(entry_date, entry_type):
    """Generate next voucher for the month: ATL/YYYY/MON/CL## for credit, ATL/YYYY/MON/DR## for debit."""
    first_day = date(entry_date.year, entry_date.month, 1)
    if entry_date.month == 12:
        last_day = date(entry_date.year, 12, 31)
    else:
        last_day = date(entry_date.year, entry_date.month + 1, 1) - timedelta(days=1)

    month_abbr = calendar.month_abbr[entry_date.month].upper()

    if entry_type == "expense":
        count = db.session.query(func.count(AccountEntry.id)).filter(
            AccountEntry.date >= first_day,
            AccountEntry.date <= last_day,
            AccountEntry.amount_credit > 0,
        ).scalar() or 0
        prefix = "CL"
    else:
        count = db.session.query(func.count(AccountEntry.id)).filter(
            AccountEntry.date >= first_day,
            AccountEntry.date <= last_day,
            AccountEntry.amount_debit > 0,
        ).scalar() or 0
        prefix = "DR"

    return f"ATL/{entry_date.year}/{month_abbr}/{prefix}{count + 1:02d}"


def _ensure_description_column():
    """Ensure account_entries has a description column (for DBs created before it was added)."""
    try:
        inspector = inspect(db.engine)
        if not inspector.has_table("account_entries"):
            return
        cols = [c.get("name", "").lower() for c in inspector.get_columns("account_entries")]
        if "description" in cols:
            return
        db.session.execute(text("ALTER TABLE account_entries ADD COLUMN description VARCHAR(1000) DEFAULT ''"))
        db.session.commit()
    except Exception:
        db.session.rollback()


@accounts_bp.route("", methods=["GET"])
def list_accounts():
    """
    List account entries with running balance (computed server-side).

    Rows are returned latest-first (date DESC, created_at DESC, id DESC).
    Balance is cumulative: opening (sum before ?from=) + ordered debit − credit.

    Optional ?from= & ?to= date filters (inclusive on from/to for the window).
    """
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Authentication required"}), 401
    from_date = _parse_date(request.args.get("from"))
    to_date = _parse_date(request.args.get("to"))
    rows = list_entries_with_running_balance(from_date, to_date)
    return jsonify(rows), 200


@accounts_bp.route("", methods=["POST"])
@require_admin_or_accounts_access
def create_account(current_user):
    """Admin only. Body: date, particular, type (received|expense), amount, paidTo (for expense), attachmentFileName, attachmentData.
    Voucher is auto-generated. Received: paidBy=AppTriangle, paidTo=Petty Cash. Expense: paidBy=Petty Cash, paidTo=user input."""
    _ensure_description_column()
    data = request.get_json() or {}
    entry_date = _parse_date(data.get("date"))
    particular = (data.get("particular") or "").strip()[:500]
    description = (data.get("description") or "").strip()[:1000]
    entry_type = (data.get("type") or "received").strip().lower()
    if entry_type not in ("received", "expense"):
        entry_type = "received"
    amount_val = data.get("amount")
    paid_to = (data.get("paidTo") or "").strip()[:100]
    attachment_filename = (data.get("attachmentFileName") or "").strip()[:255]
    attachment_data = data.get("attachmentData")

    if not entry_date:
        return jsonify({"error": "date is required"}), 400
    try:
        amount = _parse_money(amount_val)
    except Exception:
        return jsonify({"error": "amount must be a number"}), 400
    if amount <= 0:
        return jsonify({"error": "amount must be > 0"}), 400

    if entry_type == "received":
        amount_debit = amount
        amount_credit = Decimal("0.00")
        paid_by = "Apptriangle"
        paid_to = paid_to or "Petty Cash"
    else:
        amount_debit = Decimal("0.00")
        amount_credit = amount
        paid_by = "Petty Cash"
        paid_to = (paid_to or "").strip()
        if not paid_to:
            return jsonify({"error": "paidTo is required for expense"}), 400

    voucher_no = _generate_voucher_no(entry_date, entry_type)

    entry = AccountEntry(
        date=entry_date,
        particular=particular,
        description=description,
        voucher_no=voucher_no,
        amount_debit=amount_debit,
        amount_credit=amount_credit,
        paid_by=paid_by,
        paid_to=paid_to,
        attachment_filename=attachment_filename or None,
        attachment_data=attachment_data if attachment_data else None,
        created_by_user_id=current_user.id,
    )
    db.session.add(entry)
    db.session.commit()
    return jsonify(entry.to_dict()), 201


@accounts_bp.route("/<entry_id>", methods=["GET"])
def get_account(entry_id):
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Authentication required"}), 401
    entry = AccountEntry.query.get(entry_id)
    if not entry:
        return jsonify({"error": "Account entry not found"}), 404
    return jsonify(entry.to_dict(include_attachment_data=True)), 200


@accounts_bp.route("/<entry_id>", methods=["PUT", "PATCH"])
@require_admin_or_accounts_access
def update_account(entry_id, current_user):
    """Admin only. Accepts type, amount, paidTo, attachmentFileName, attachmentData; voucher is not changed."""
    entry = AccountEntry.query.get(entry_id)
    if not entry:
        return jsonify({"error": "Account entry not found"}), 404

    data = request.get_json() or {}
    if "date" in data:
        d = _parse_date(data["date"])
        if d:
            entry.date = d
    if "particular" in data:
        entry.particular = (data.get("particular") or "").strip()[:500]
    if "description" in data:
        entry.description = (data.get("description") or "").strip()[:1000]
    if "type" in data and "amount" in data:
        t = (data.get("type") or "received").strip().lower()
        if t not in ("received", "expense"):
            t = "received"
        try:
            amount = _parse_money(data["amount"])
        except Exception:
            amount = Decimal("0.00")
        amount = max(Decimal("0.00"), amount)
        if t == "received":
            entry.amount_debit = amount
            entry.amount_credit = Decimal("0.00")
            entry.paid_by = "AppTriangle"
            entry.paid_to = (data.get("paidTo") or "").strip()[:100] or "Petty Cash"
        else:
            entry.amount_debit = Decimal("0.00")
            entry.amount_credit = amount
            entry.paid_by = "Petty Cash"
            paid_to_val = (data.get("paidTo") or "").strip()[:100]
            if not paid_to_val:
                return jsonify({"error": "paidTo is required for expense"}), 400
            entry.paid_to = paid_to_val
    else:
        if "amountDebit" in data:
            try:
                entry.amount_debit = max(
                    Decimal("0.00"),
                    _parse_money(data["amountDebit"]),
                )
            except Exception:
                pass
        if "amountCredit" in data:
            try:
                entry.amount_credit = max(
                    Decimal("0.00"),
                    _parse_money(data["amountCredit"]),
                )
            except Exception:
                pass
        if "paidBy" in data:
            entry.paid_by = (data.get("paidBy") or "").strip()[:100]
        if "paidTo" in data:
            entry.paid_to = (data.get("paidTo") or "").strip()[:100]
    if "attachmentFileName" in data:
        entry.attachment_filename = (data.get("attachmentFileName") or "").strip()[:255] or None
    if "attachmentData" in data:
        entry.attachment_data = data.get("attachmentData") or None

    if entry.amount_debit > 0 and entry.amount_credit > 0:
        entry.amount_credit = Decimal("0.00")
    db.session.commit()
    return jsonify(entry.to_dict()), 200


@accounts_bp.route("/<entry_id>", methods=["DELETE"])
@require_admin_or_accounts_access
def delete_account(entry_id, current_user):
    entry = AccountEntry.query.get(entry_id)
    if not entry:
        return jsonify({"error": "Account entry not found"}), 404
    db.session.delete(entry)
    db.session.commit()
    return jsonify({"ok": True}), 200
