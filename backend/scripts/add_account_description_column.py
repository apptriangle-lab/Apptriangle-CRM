#!/usr/bin/env python3
"""
One-time script to add description column to account_entries if missing.
Run from the backend directory:  python scripts/add_account_description_column.py

Restart the Flask app after running so the new column is used.
"""
import os
import sys

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
        if not inspector.has_table("account_entries"):
            print("Table 'account_entries' does not exist. Nothing to do.")
            return
        cols = [c.get("name", "").lower() for c in inspector.get_columns("account_entries")]
        if "description" in cols:
            print("Column 'account_entries.description' already exists. Nothing to do.")
            return
        try:
            db.session.execute(text("ALTER TABLE account_entries ADD COLUMN description VARCHAR(1000) DEFAULT ''"))
            db.session.commit()
            print("Done. Added column 'account_entries.description'. Restart the backend to use it.")
        except Exception as e:
            db.session.rollback()
            print("Error:", e)
            sys.exit(1)


if __name__ == "__main__":
    main()
