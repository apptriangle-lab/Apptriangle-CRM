"""Symmetric encryption for credential fields (Fernet). Use CREDENTIALS_FERNET_KEY from env in production."""
from __future__ import annotations

import base64
import hashlib
import os

from cryptography.fernet import Fernet, InvalidToken
from flask import Flask


def build_fernet(app: Flask) -> Fernet:
    raw = app.config.get("CREDENTIALS_FERNET_KEY")
    if raw:
        key = raw.encode("utf-8") if isinstance(raw, str) else raw
        return Fernet(key)
    secret = str(app.config.get("JWT_SECRET_KEY", "") or "")
    digest = hashlib.sha256((secret + ":crm-credential-v1").encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_secret(app: Flask, plaintext: str) -> str:
    return encrypt_data(app, plaintext)


def decrypt_secret(app: Flask, token: str) -> str:
    return decrypt_data(app, token)


def encrypt_data(app: Flask, text: str) -> str:
    """Encrypt arbitrary text; returns ASCII-safe Fernet token."""
    f = build_fernet(app)
    return f.encrypt((text or "").encode("utf-8")).decode("ascii")


def decrypt_data(app: Flask, encrypted_text: str) -> str:
    """Decrypt Fernet token; returns empty string on failure."""
    if not encrypted_text:
        return ""
    f = build_fernet(app)
    try:
        return f.decrypt(encrypted_text.encode("ascii")).decode("utf-8")
    except InvalidToken:
        return ""


def is_fernet_ciphertext(value: str | None) -> bool:
    """Heuristic: Fernet tokens are URL-safe base64 and typically start with gAAAAA."""
    if not value or len(value) < 20:
        return False
    return value.strip().startswith("gAAAAA")


def require_fernet_key_from_env() -> None:
    """Optional: call at startup in production to enforce env key (set CREDENTIALS_ENFORCE_ENV_KEY=1)."""
    if os.environ.get("CREDENTIALS_ENFORCE_ENV_KEY", "").lower() not in ("1", "true", "yes"):
        return
    if not (os.environ.get("CREDENTIALS_FERNET_KEY") or "").strip():
        raise RuntimeError("CREDENTIALS_FERNET_KEY is required when CREDENTIALS_ENFORCE_ENV_KEY=1")
