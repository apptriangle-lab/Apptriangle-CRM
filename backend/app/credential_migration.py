"""
Idempotent schema and data migration for credentials: username_encrypted, url, note;
encrypts legacy plaintext usernames/passwords; copies description to note.
"""
from __future__ import annotations

from sqlalchemy import inspect, text

from app import db
from app.credential_crypto import encrypt_data, is_fernet_ciphertext


def migrate_credentials_schema(app) -> None:
    with app.app_context():
        try:
            inspector = inspect(db.engine)
            if not inspector.has_table("credentials"):
                migrate_credential_shares_null_expiry()
                return

            cols = {c["name"] for c in inspector.get_columns("credentials")}

            if "username_encrypted" not in cols:
                try:
                    db.session.execute(text("ALTER TABLE credentials ADD COLUMN username_encrypted TEXT"))
                    db.session.commit()
                    print("[ok] Added credentials.username_encrypted")
                except Exception as e:
                    db.session.rollback()
                    print(f"Note: credentials.username_encrypted: {e}")
                cols = {c["name"] for c in inspect(db.engine).get_columns("credentials")}

            if "url" not in cols:
                try:
                    db.session.execute(text("ALTER TABLE credentials ADD COLUMN url VARCHAR(2000)"))
                    db.session.commit()
                    print("[ok] Added credentials.url")
                except Exception as e:
                    db.session.rollback()
                    print(f"Note: credentials.url: {e}")

            if "note" not in cols:
                try:
                    # MySQL: TEXT/BLOB cannot have DEFAULT; use nullable column
                    db.session.execute(text("ALTER TABLE credentials ADD COLUMN note TEXT"))
                    db.session.commit()
                    print("[ok] Added credentials.note")
                except Exception as e:
                    db.session.rollback()
                    print(f"Note: credentials.note: {e}")

            cols = {c["name"] for c in inspect(db.engine).get_columns("credentials")}
            if "url" in cols:
                try:
                    db.session.execute(
                        text(
                            "UPDATE credentials SET url = 'https://example.com' "
                            "WHERE url IS NULL OR TRIM(COALESCE(url,'')) = ''"
                        )
                    )
                    db.session.commit()
                except Exception:
                    db.session.rollback()
                    try:
                        db.session.execute(
                            text(
                                "UPDATE credentials SET url = 'https://example.com' "
                                "WHERE url IS NULL OR url = ''"
                            )
                        )
                        db.session.commit()
                    except Exception as e_url:
                        db.session.rollback()
                        print(f"Note: url backfill: {e_url}")

            cols = {c["name"] for c in inspect(db.engine).get_columns("credentials")}
            has_legacy_username = "username" in cols

            if has_legacy_username:
                rows = db.session.execute(text("SELECT id, username FROM credentials")).fetchall()
                for row in rows:
                    rid = row[0]
                    uname = row[1] if len(row) > 1 else None
                    cur = db.session.execute(
                        text("SELECT username_encrypted FROM credentials WHERE id = :id"),
                        {"id": rid},
                    ).fetchone()
                    existing = cur[0] if cur else None
                    if existing and is_fernet_ciphertext(str(existing)):
                        continue
                    if uname is None or str(uname).strip() == "":
                        enc = encrypt_data(app, "")
                    elif is_fernet_ciphertext(str(uname)):
                        enc = str(uname)
                    else:
                        enc = encrypt_data(app, str(uname))
                    db.session.execute(
                        text("UPDATE credentials SET username_encrypted = :enc WHERE id = :id"),
                        {"enc": enc, "id": rid},
                    )
                db.session.commit()
            else:
                # Fresh schema: ensure no null username_encrypted
                rows = db.session.execute(
                    text("SELECT id FROM credentials WHERE username_encrypted IS NULL OR username_encrypted = ''")
                ).fetchall()
                for (rid,) in rows:
                    db.session.execute(
                        text("UPDATE credentials SET username_encrypted = :enc WHERE id = :id"),
                        {"enc": encrypt_data(app, ""), "id": rid},
                    )
                db.session.commit()

            if "password_encrypted" in cols:
                prow = db.session.execute(text("SELECT id, password_encrypted FROM credentials")).fetchall()
                for row in prow:
                    rid = row[0]
                    pwd = row[1] if len(row) > 1 else None
                    if pwd is not None and is_fernet_ciphertext(str(pwd)):
                        continue
                    if pwd is None or str(pwd).strip() == "":
                        enc = encrypt_data(app, "")
                    else:
                        enc = encrypt_data(app, str(pwd))
                    db.session.execute(
                        text("UPDATE credentials SET password_encrypted = :enc WHERE id = :id"),
                        {"enc": enc, "id": rid},
                    )
                db.session.commit()

            try:
                db.session.execute(
                    text(
                        "UPDATE credentials SET note = COALESCE(description, '') "
                        "WHERE (note IS NULL OR TRIM(COALESCE(note,'')) = '') "
                        "AND description IS NOT NULL AND TRIM(description) != ''"
                    )
                )
                db.session.commit()
            except Exception:
                db.session.rollback()
                try:
                    db.session.execute(
                        text(
                            "UPDATE credentials SET note = COALESCE(description, '') "
                            "WHERE (note IS NULL OR note = '') "
                            "AND description IS NOT NULL AND description != ''"
                        )
                    )
                    db.session.commit()
                except Exception as e2:
                    db.session.rollback()
                    print(f"Note: description to note: {e2}")

            cols = {c["name"] for c in inspect(db.engine).get_columns("credentials")}
            if "username" in cols and "username_encrypted" in cols:
                try:
                    db.session.execute(text("ALTER TABLE credentials DROP COLUMN username"))
                    db.session.commit()
                    print("[ok] Dropped legacy credentials.username")
                except Exception as e:
                    db.session.rollback()
                    print(f"Note: DROP username (SQLite 3.35+ / MySQL may be required): {e}")

            cols = {c["name"] for c in inspect(db.engine).get_columns("credentials")}
            if "deleted_at" not in cols:
                try:
                    db.session.execute(text("ALTER TABLE credentials ADD COLUMN deleted_at DATETIME"))
                    db.session.commit()
                    print("[ok] Added credentials.deleted_at (soft delete / bin)")
                except Exception as e:
                    db.session.rollback()
                    print(f"Note: credentials.deleted_at: {e}")

            migrate_credential_shares_null_expiry()

        except Exception as e:
            db.session.rollback()
            print(f"Note: migrate_credentials_schema: {e}")


def migrate_credential_shares_null_expiry() -> None:
    """Allow NULL expiry_datetime = access forever (existing DBs may have NOT NULL)."""
    try:
        inspector = inspect(db.engine)
        if not inspector.has_table("credential_shares"):
            return
        dialect = db.engine.dialect.name
        if dialect == "mysql":
            try:
                db.session.execute(
                    text("ALTER TABLE credential_shares MODIFY COLUMN expiry_datetime DATETIME NULL")
                )
                db.session.commit()
                print("[ok] credential_shares.expiry_datetime nullable (MySQL)")
            except Exception as e:
                db.session.rollback()
                print(f"Note: credential_shares nullable expiry (MySQL): {e}")
        elif dialect == "sqlite":
            try:
                db.session.execute(
                    text("ALTER TABLE credential_shares ALTER COLUMN expiry_datetime DROP NOT NULL")
                )
                db.session.commit()
                print("[ok] credential_shares.expiry_datetime nullable (SQLite)")
            except Exception as e:
                db.session.rollback()
                print(f"Note: credential_shares nullable expiry (SQLite): {e}")
    except Exception as e:
        print(f"Note: migrate_credential_shares_null_expiry: {e}")
