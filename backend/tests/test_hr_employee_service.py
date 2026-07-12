"""Unit tests for HR employee list service."""

import unittest
from datetime import date

from app import create_app, db
from app.models import EmploymentHistory, HRInfo, User
from app.services.hr_employee_service import (
    list_employees_lookup,
    list_employees_paginated,
)


class HREmployeeServiceTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app({"SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:", "TESTING": True})
        self.ctx = self.app.app_context()
        self.ctx.push()
        db.create_all()
        self._seed()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def _seed(self):
        mgr = User(
            id="mgr1",
            name="Manager One",
            email="mgr@test.com",
            password_hash="x",
            role="admin",
            is_active=True,
        )
        alice = User(
            id="u1",
            name="Alice Smith",
            email="alice@test.com",
            password_hash="x",
            role="user",
            is_active=True,
        )
        bob = User(
            id="u2",
            name="Bob Jones",
            email="bob@test.com",
            password_hash="x",
            role="user",
            is_active=True,
        )
        db.session.add_all([mgr, alice, bob])

        hr_alice = HRInfo(
            id="hr1",
            user_id="u1",
            department="Engineering",
            designation="Developer",
            employee_type="full-time",
            joining_date=date(2024, 1, 15),
            reporting_manager_id="mgr1",
        )
        hr_bob = HRInfo(
            id="hr2",
            user_id="u2",
            department="Sales",
            designation="Rep",
            employee_type="contract",
        )
        db.session.add_all([hr_alice, hr_bob])
        db.session.add(
            EmploymentHistory(
                id="eh1",
                hr_info_id="hr1",
                next_activity="Review",
                next_activity_date=date(2026, 6, 1),
            )
        )
        db.session.commit()

    def test_paginated_filters_by_department(self):
        result = list_employees_paginated(page=1, per_page=10, department="Engineering")
        self.assertEqual(result["total"], 1)
        self.assertEqual(result["items"][0]["id"], "u1")
        self.assertEqual(result["items"][0]["hr"]["department"], "Engineering")
        self.assertIsNotNone(result["items"][0]["latestEmployment"])

    def test_paginated_search_matches_name(self):
        result = list_employees_paginated(page=1, per_page=10, search="bob")
        self.assertEqual(result["total"], 1)
        self.assertEqual(result["items"][0]["name"], "Bob Jones")

    def test_lookup_includes_manager_name_without_profile_picture(self):
        rows = list_employees_lookup()
        by_id = {r["id"]: r for r in rows}
        self.assertIn("u1", by_id)
        self.assertIsNone(by_id["u1"]["profilePicture"])
        self.assertEqual(by_id["u1"]["hr"]["reportingManagerName"], "Manager One")
        self.assertEqual(by_id["u1"]["hr"]["shiftId"], "")


if __name__ == "__main__":
    unittest.main()
