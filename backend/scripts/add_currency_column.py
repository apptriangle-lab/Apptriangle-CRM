#!/usr/bin/env python3
"""
One-time script to add currency_id to the companies table without losing data.
Run from the backend directory:  python scripts/add_currency_column.py
Or:  python -m scripts.add_currency_column

Existing company rows are unchanged; they get NULL for currency_id until you edit them in the app.
"""
import os
import sys

# Add backend root so "app" can be imported
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from app import create_app, db
from sqlalchemy import text, inspect


def main():
    app = create_app()
    with app.app_context():
        inspector = inspect(db.engine)
        if not inspector.has_table("companies"):
            print("Table 'companies' does not exist. Nothing to do.")
            return
        cols = [c["name"] for c in inspector.get_columns("companies")]
        if "currency_id" in cols:
            print("Column 'companies.currency_id' already exists. Nothing to do.")
            return
        try:
            db.session.execute(text("ALTER TABLE companies ADD COLUMN currency_id VARCHAR(40)"))
            db.session.commit()
            print("Done. Added column 'companies.currency_id'. Existing company rows are unchanged (currency_id is NULL).")
        except Exception as e:
            db.session.rollback()
            print("Error:", e)
            sys.exit(1)


if __name__ == "__main__":
    main()
