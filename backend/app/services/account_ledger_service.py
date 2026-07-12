"""Deterministic running balance for account / cash ledger (no reliance on DB row order)."""

from __future__ import annotations

from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import func

from app import db
from app.models import AccountEntry

MONEY_QUANT = Decimal("0.01")


def to_decimal_money(value) -> Decimal:
    """Normalize DB or API values to 2-decimal Decimal."""
    if value is None:
        return Decimal("0.00")
    if isinstance(value, Decimal):
        return value.quantize(MONEY_QUANT, rounding=ROUND_HALF_UP)
    return Decimal(str(value)).quantize(MONEY_QUANT, rounding=ROUND_HALF_UP)


def opening_balance_before(from_date: date | None) -> Decimal:
    """
    Sum(amount_debit - amount_credit) for all entries strictly before from_date.
    Used when ?from= is set so the filtered window shows real cumulative balance.
    """
    if from_date is None:
        return Decimal("0.00")
    sums = (
        db.session.query(
            func.coalesce(func.sum(AccountEntry.amount_debit), 0),
            func.coalesce(func.sum(AccountEntry.amount_credit), 0),
        )
        .filter(AccountEntry.date < from_date)
        .one()
    )
    debit = to_decimal_money(sums[0])
    credit = to_decimal_money(sums[1])
    return (debit - credit).quantize(MONEY_QUANT, rounding=ROUND_HALF_UP)


def list_entries_with_running_balance(
    from_date: date | None,
    to_date: date | None,
) -> list[dict]:
    """
    Fetch filtered entries, sort ASC (date, created_at, id), apply running balance,
    then reverse for display (latest first: date DESC, created_at DESC, id DESC).

    running = opening_balance_before(from_date) + sum(debit - credit) in order.

    Each dict is entry.to_dict() plus float balance (2 dp).
    """
    opening = opening_balance_before(from_date)
    q = AccountEntry.query
    if from_date is not None:
        q = q.filter(AccountEntry.date >= from_date)
    if to_date is not None:
        q = q.filter(AccountEntry.date <= to_date)

    entries_asc = q.order_by(
        AccountEntry.date.asc(),
        AccountEntry.created_at.asc(),
        AccountEntry.id.asc(),
    ).all()

    running = opening
    rows_asc: list[dict] = []
    for entry in entries_asc:
        debit = to_decimal_money(entry.amount_debit)
        credit = to_decimal_money(entry.amount_credit)
        running = (running + debit - credit).quantize(MONEY_QUANT, rounding=ROUND_HALF_UP)
        row = entry.to_dict()
        row["balance"] = float(running)
        rows_asc.append(row)

    rows_asc.reverse()
    return rows_asc
