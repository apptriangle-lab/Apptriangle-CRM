"""Ledger running balance: deterministic order and opening balance before ?from=."""

import unittest
from datetime import date, datetime, timedelta
from decimal import Decimal

from app import create_app, db
from app.models import AccountEntry


def _entry(
    eid: str,
    d: date,
    debit: float,
    credit: float,
    created: datetime | None = None,
):
    return AccountEntry(
        id=eid,
        date=d,
        particular="p",
        description="",
        voucher_no=f"V-{eid}",
        amount_debit=debit,
        amount_credit=credit,
        paid_by="A",
        paid_to="B",
        created_at=created or datetime.utcnow(),
    )


class AccountLedgerBalanceTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app(
            {
                "TESTING": True,
                "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            }
        )
        self.ctx = self.app.app_context()
        self.ctx.push()
        db.create_all()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def test_running_balance_full_ledger_newest_first(self):
        """05-May credit 520 then 06-May debit 20700 after prior balance path via earlier rows."""
        base = date(2026, 5, 1)
        t0 = datetime(2026, 5, 1, 10, 0, 0)
        db.session.add(_entry("a1", base, 6000, 0, t0))
        db.session.add(_entry("a2", date(2026, 5, 5), 0, 520, t0 + timedelta(hours=1)))
        db.session.add(_entry("a3", date(2026, 5, 6), 20700, 0, t0 + timedelta(hours=2)))
        db.session.commit()

        from app.services.account_ledger_service import list_entries_with_running_balance

        rows = list_entries_with_running_balance(None, None)
        self.assertEqual(len(rows), 3)
        # Display: latest first → a3, a2, a1
        self.assertEqual(rows[0]["id"], "a3")
        by_id = {r["id"]: r["balance"] for r in rows}
        self.assertAlmostEqual(by_id["a1"], 6000.0)
        self.assertAlmostEqual(by_id["a2"], 6000.0 - 520.0)
        self.assertAlmostEqual(by_id["a3"], 6000.0 - 520.0 + 20700.0)

    def test_same_day_order_created_at_then_id(self):
        """Same date: created_at ASC then id ASC must determine balance."""
        d = date(2026, 5, 7)
        t1 = datetime(2026, 5, 7, 9, 0, 0)
        t2 = datetime(2026, 5, 7, 10, 0, 0)
        db.session.add(_entry("z99", d, 49235, 0, t2))
        db.session.add(_entry("z98", d, 13000, 0, t1))
        db.session.commit()

        from app.services.account_ledger_service import list_entries_with_running_balance

        rows = list_entries_with_running_balance(None, None)
        by_id = {r["id"]: r["balance"] for r in rows}
        # Chronological: z98 (+13000) then z99 (+49235)
        self.assertAlmostEqual(by_id["z98"], 13000.0)
        self.assertAlmostEqual(by_id["z99"], 13000 + 49235)

    def test_opening_balance_with_from_filter(self):
        """?from= includes only window rows; opening = sum before from_date."""
        db.session.add(_entry("b1", date(2026, 4, 1), 4535, 0))
        db.session.add(_entry("b2", date(2026, 5, 5), 0, 520))
        db.session.add(_entry("b3", date(2026, 5, 6), 20700, 0))
        db.session.commit()

        from app.services.account_ledger_service import list_entries_with_running_balance

        rows = list_entries_with_running_balance(date(2026, 5, 5), None)
        self.assertEqual(len(rows), 2)
        by_id = {r["id"]: r["balance"] for r in rows}
        opening = Decimal("4535")
        self.assertAlmostEqual(by_id["b2"], float(opening - Decimal("520")))
        self.assertAlmostEqual(by_id["b3"], float(opening - Decimal("520") + Decimal("20700")))


if __name__ == "__main__":
    unittest.main()
