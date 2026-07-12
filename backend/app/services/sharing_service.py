"""Credential sharing: many-to-many users with per-user expiry."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app import db
from app.models import Credential, CredentialShare, User
from app.services import credential_access_service as access


def parse_expiry_datetime(raw: str | None) -> datetime | None:
    if not raw or not str(raw).strip():
        return None
    s = str(raw).strip().replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        return None
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


class SharingService:
    def list_shares(self, cred: Credential) -> list[dict[str, Any]]:
        rows = CredentialShare.query.filter_by(credential_id=cred.id).order_by(CredentialShare.created_at.desc()).all()
        now = access.now_utc()
        out = []
        for sh in rows:
            u = User.query.get(sh.shared_with_user_id)
            by = User.query.get(sh.shared_by_user_id)
            exp = sh.expiry_datetime
            is_expired = exp is not None and exp < now
            out.append(
                {
                    "id": sh.id,
                    "sharedWith": {
                        "id": u.id if u else "",
                        "name": u.name if u else "",
                        "email": u.email if u else "",
                    },
                    "sharedBy": {
                        "id": by.id if by else "",
                        "name": by.name if by else "",
                    },
                    "expiryDatetime": exp.isoformat() + "Z" if exp else None,
                    "shareNeverExpires": exp is None,
                    "isExpired": is_expired,
                    "createdAt": sh.created_at.isoformat() + "Z" if sh.created_at else None,
                }
            )
        return out

    def upsert_shares(
        self,
        cred: Credential,
        shared_by: User,
        user_ids: list[str],
        expiry: datetime | None,
        include_global_admins: bool,
        include_credential_admins: bool,
    ) -> list[CredentialShare]:
        if expiry is not None and expiry <= access.now_utc():
            raise ValueError("expiryDatetime must be in the future when set")

        targets: set[str] = {uid.strip() for uid in user_ids if uid and str(uid).strip()}
        targets.discard(cred.owner_id)

        if include_global_admins:
            admins = User.query.filter_by(role="admin", is_active=True).all()
            for a in admins:
                if a.id != cred.owner_id:
                    targets.add(a.id)

        if include_credential_admins:
            from app.models import UserPagePermission
            from app.services.rbac_service import ACCESS_ADMIN

            perm_rows = UserPagePermission.query.filter_by(
                page_key=access.PAGE_KEY_CREDENTIALS,
                access_type=ACCESS_ADMIN,
            ).all()
            for pr in perm_rows:
                u = User.query.get(pr.user_id)
                if u and getattr(u, "is_active", True) and u.id != cred.owner_id:
                    targets.add(u.id)

        created: list[CredentialShare] = []
        for uid in targets:
            if not User.query.get(uid):
                continue
            existing = CredentialShare.query.filter_by(
                credential_id=cred.id,
                shared_with_user_id=uid,
            ).first()
            if existing:
                existing.expiry_datetime = expiry
                existing.shared_by_user_id = shared_by.id
                created.append(existing)
            else:
                sh = CredentialShare(
                    credential_id=cred.id,
                    shared_with_user_id=uid,
                    shared_by_user_id=shared_by.id,
                    expiry_datetime=expiry,
                )
                db.session.add(sh)
                created.append(sh)
        db.session.commit()
        return created

    def revoke_share(self, cred: Credential, share_id: str) -> bool:
        sh = CredentialShare.query.filter_by(id=share_id, credential_id=cred.id).first()
        if not sh:
            return False
        db.session.delete(sh)
        db.session.commit()
        return True
