#!/usr/bin/env python3
"""
One-time (idempotent) migration for credentials v2:
- Adds username_encrypted, url, note columns if missing
- Encrypts legacy plaintext username/password
- Backfills url and description -> note

Run from the backend directory:
  python scripts/migrate_credentials_v2.py

Same logic runs on app startup via ensure_credentials_tables -> migrate_credentials_schema.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from app import create_app
from app.credential_migration import migrate_credentials_schema


def main() -> None:
    app = create_app()
    migrate_credentials_schema(app)
    print("migrate_credentials_v2: finished (see messages above).")


if __name__ == "__main__":
    main()
