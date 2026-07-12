"""Credential CRUD and serialization — secrets masked unless explicit reveal with permission."""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from flask import Flask

from app import db
from app.credential_crypto import decrypt_data, encrypt_data
from app.models import Credential, CredentialAccessLog, HRInfo, User
from app.services import credential_access_service as access

MASK = "••••••••"


def _tags_parse(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        t = json.loads(raw)
        return [str(x).strip() for x in t if str(x).strip()] if isinstance(t, list) else []
    except Exception:
        return []


def _tags_dump(tags: list[str]) -> str:
    clean = [str(t).strip() for t in tags if str(t).strip()][:50]
    return json.dumps(clean)


def _username_masked_table_display(app: Flask, cred: Credential) -> str:
    """First two characters visible, remainder replaced by MASK (empty username → '')."""
    try:
        plain = decrypt_data(app, cred.username_encrypted or "")
    except Exception:
        plain = ""
    plain = plain or ""
    if not plain:
        return ""
    if len(plain) <= 2:
        return plain
    return plain[:2] + MASK


def _user_mini(u: User | None) -> dict[str, Any]:
    if not u:
        return {"id": "", "name": "", "email": ""}
    return {"id": u.id, "name": u.name or "", "email": u.email or ""}


def _hr_profile_picture_for_user(user_id: str) -> str | None:
    hr = HRInfo.query.filter_by(user_id=user_id).first()
    if not hr or not hr.profile_picture:
        return None
    s = str(hr.profile_picture).strip()
    return s or None


def normalize_credential_url_field(url: str | None) -> str:
    """Trim and cap length; any text allowed (notes, hostnames, or full http(s) URLs)."""
    s = (url or "").strip()
    if not s:
        return ""
    return s[:2000]


class CredentialService:
    def __init__(self, app: Flask):
        self.app = app

    def create(
        self,
        owner: User,
        title: str,
        username_plain: str,
        password_plain: str,
        url: str,
        note: str,
        tags: list[str],
    ) -> Credential:
        url_clean = normalize_credential_url_field(url)
        cred = Credential(
            title=(title or "").strip()[:500] or "Untitled",
            username_encrypted=encrypt_data(self.app, username_plain or ""),
            password_encrypted=encrypt_data(self.app, password_plain or ""),
            url=url_clean or None,
            note=(note or "").strip(),
            tags=_tags_dump(tags),
            owner_id=owner.id,
        )
        db.session.add(cred)
        db.session.commit()
        return cred

    def update(
        self,
        cred: Credential,
        *,
        title: str | None = None,
        username_plain: str | None = None,
        password_plain: str | None = None,
        url: str | None = None,
        note: str | None = None,
        tags: list[str] | None = None,
    ) -> Credential:
        if title is not None:
            cred.title = (title or "").strip()[:500] or "Untitled"
        if username_plain is not None:
            cred.username_encrypted = encrypt_data(self.app, username_plain)
        if password_plain is not None:
            cred.password_encrypted = encrypt_data(self.app, password_plain)
            access.purge_expired_shares_for_credential(cred)
        if url is not None:
            cred.url = normalize_credential_url_field(url) or None
        if note is not None:
            cred.note = (note or "").strip()
        if tags is not None:
            cred.tags = _tags_dump(tags)
        cred.updated_at = datetime.utcnow()
        db.session.commit()
        return cred

    def soft_delete(self, cred: Credential) -> None:
        cred.deleted_at = datetime.utcnow()
        cred.updated_at = datetime.utcnow()
        db.session.commit()

    def to_bin_row_dict(self, cred: Credential) -> dict[str, Any]:
        owner = User.query.get(cred.owner_id)
        return {
            "id": cred.id,
            "title": cred.title,
            "ownerId": cred.owner_id,
            "ownerName": owner.name if owner else "",
            "ownerEmail": owner.email if owner else "",
            "deletedAt": cred.deleted_at.isoformat() + "Z" if cred.deleted_at else None,
        }

    def log_access(self, cred_id: str, user_id: str, action: str) -> None:
        db.session.add(
            CredentialAccessLog(
                credential_id=cred_id,
                user_id=user_id,
                action=action,
            )
        )
        db.session.commit()

    def to_detail_dict(
        self,
        cred: Credential,
        viewer: User,
        *,
        reveal: bool,
    ) -> dict[str, Any]:
        level = access.resolve_access(viewer, cred)
        tags = _tags_parse(cred.tags)
        owner = User.query.get(cred.owner_id)
        can_reveal = reveal and access.can_view_password(viewer, cred)

        has_expired_shares = access.credential_has_expired_shares(cred)
        username_hidden_display = _username_masked_table_display(self.app, cred)
        out: dict[str, Any] = {
            "id": cred.id,
            "title": cred.title,
            "usernameMasked": MASK,
            "usernameMaskedDisplay": username_hidden_display,
            "passwordMasked": MASK,
            "username": None,
            "password": None,
            "url": cred.url or "",
            "note": cred.note or "",
            "tags": tags,
            "ownerId": cred.owner_id,
            "ownerName": owner.name if owner else "",
            "ownerEmail": owner.email if owner else "",
            "ownerProfilePicture": _hr_profile_picture_for_user(cred.owner_id) if owner else None,
            "createdAt": cred.created_at.isoformat() + "Z" if cred.created_at else None,
            "updatedAt": cred.updated_at.isoformat() + "Z" if cred.updated_at else None,
            "accessLevel": level,
            "hasExpiredShares": has_expired_shares,
            "ownerWarningMessage": (
                "Credential expired for some recipients — please update username/password and renew sharing."
                if has_expired_shares
                else None
            ),
            "sharesCount": access.count_shares(cred),
            "sharePreview": access.share_preview(cred, limit=None),
            "isExpired": False,
        }

        if can_reveal:
            out["username"] = decrypt_data(self.app, cred.username_encrypted)
            out["password"] = decrypt_data(self.app, cred.password_encrypted)
        return out

    def to_summary_dict(
        self,
        cred: Credential,
        viewer: User,
        *,
        for_owner_list: bool = False,
        shared_expiry: datetime | None = None,
        share_is_expired: bool | None = None,
    ) -> dict[str, Any]:
        level = access.resolve_access(viewer, cred)
        tags = _tags_parse(cred.tags)
        owner = User.query.get(cred.owner_id)
        owner_profile_picture = _hr_profile_picture_for_user(cred.owner_id) if owner else None
        is_expired_flag = False
        if share_is_expired is not None:
            is_expired_flag = share_is_expired
        elif shared_expiry is not None:
            is_expired_flag = shared_expiry <= access.now_utc()

        username_hidden_display = _username_masked_table_display(self.app, cred)
        out: dict[str, Any] = {
            "id": cred.id,
            "title": cred.title,
            "usernameMasked": MASK,
            "usernameMaskedDisplay": username_hidden_display,
            "passwordMasked": MASK,
            "url": cred.url or "",
            "note": (cred.note or "")[:500],
            "tags": tags,
            "ownerId": cred.owner_id,
            "ownerName": owner.name if owner else "",
            "ownerEmail": owner.email if owner else "",
            "ownerProfilePicture": owner_profile_picture,
            "createdAt": cred.created_at.isoformat() + "Z" if cred.created_at else None,
            "updatedAt": cred.updated_at.isoformat() + "Z" if cred.updated_at else None,
            "accessLevel": level,
            "sharesCount": access.count_shares(cred),
            "sharePreview": access.share_preview(cred),
            "isExpired": is_expired_flag,
        }
        if for_owner_list or level in ("admin", "owner"):
            out["hasExpiredShares"] = access.credential_has_expired_shares(cred)
            out["ownerWarningMessage"] = (
                "Credential expired for some recipients — please update username/password and renew sharing."
                if out["hasExpiredShares"]
                else None
            )
        if share_is_expired is not None or shared_expiry is not None:
            if shared_expiry is not None:
                out["myShareExpiresAt"] = shared_expiry.isoformat() + "Z"
                out["isShareActive"] = shared_expiry > access.now_utc()
                out["shareNeverExpires"] = False
            else:
                out["myShareExpiresAt"] = None
                out["isShareActive"] = not (share_is_expired or False)
                out["shareNeverExpires"] = True
        return out

    def list_audit(self, cred: Credential, limit: int = 100) -> list[dict[str, Any]]:
        rows = (
            CredentialAccessLog.query.filter_by(credential_id=cred.id)
            .order_by(CredentialAccessLog.created_at.desc())
            .limit(limit)
            .all()
        )
        out = []
        for r in rows:
            u = User.query.get(r.user_id)
            out.append(
                {
                    "id": r.id,
                    "user": _user_mini(u),
                    "action": r.action,
                    "createdAt": r.created_at.isoformat() + "Z" if r.created_at else None,
                }
            )
        return out


def filter_by_search(q: str | None, tag: str | None, creds: list[Credential]) -> list[Credential]:
    if not q and not tag:
        return creds
    q_low = (q or "").strip().lower()
    tag_low = (tag or "").strip().lower()
    result = []
    for c in creds:
        if tag_low:
            tags = [t.lower() for t in _tags_parse(c.tags)]
            if not any(tag_low == t or tag_low in t for t in tags):
                continue
        if q_low:
            blob = " ".join(
                [
                    c.title or "",
                    c.url or "",
                    c.note or "",
                    " ".join(_tags_parse(c.tags)),
                ]
            ).lower()
            if q_low not in blob:
                continue
        result.append(c)
    return result
