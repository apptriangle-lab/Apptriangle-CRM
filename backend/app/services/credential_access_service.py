"""
Access rules for the Credentials module (RBAC + ownership + time-bound shares).
Expiry is validated on every secret/metadata access path.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import or_
from sqlalchemy.orm import joinedload

from app.models import Credential, CredentialShare, HRInfo, User
from app.services.rbac_service import ACCESS_ADMIN, ACCESS_NONE, get_effective_page_access

PAGE_KEY_CREDENTIALS = "credentials"


def now_utc() -> datetime:
    return datetime.utcnow()


def user_has_credentials_module(user: User | None) -> bool:
    if not user or not getattr(user, "is_active", True):
        return False
    return get_effective_page_access(user, PAGE_KEY_CREDENTIALS) != ACCESS_NONE


def is_credentials_data_admin(user: User | None) -> bool:
    if not user or not getattr(user, "is_active", True):
        return False
    if getattr(user, "role", "") == "admin":
        return True
    return get_effective_page_access(user, PAGE_KEY_CREDENTIALS) == ACCESS_ADMIN


def get_active_share(credential_id: str, user_id: str) -> CredentialShare | None:
    """Active if no expiry (NULL) or expiry is in the future."""
    now = now_utc()
    return (
        CredentialShare.query.filter_by(
            credential_id=credential_id,
            shared_with_user_id=user_id,
        )
        .filter(
            or_(
                CredentialShare.expiry_datetime.is_(None),
                CredentialShare.expiry_datetime > now,
            )
        )
        .first()
    )


def can_access_credential(user: User, cred: Credential) -> bool:
    """True if the user may view this credential (metadata or secrets per endpoint rules)."""
    return resolve_access(user, cred) != "denied"


def resolve_access(user: User, cred: Credential) -> str:
    """
    Returns: denied | owner | admin | shared_active
    """
    if not user_has_credentials_module(user):
        return "denied"
    if cred.owner_id == user.id:
        return "owner"
    if is_credentials_data_admin(user):
        return "admin"
    if get_active_share(cred.id, user.id):
        return "shared_active"
    return "denied"


def can_view_password(user: User, cred: Credential) -> bool:
    return resolve_access(user, cred) in ("owner", "admin", "shared_active")


def can_write_credential(user: User, cred: Credential) -> bool:
    if not user_has_credentials_module(user):
        return False
    if cred.owner_id == user.id:
        return True
    if is_credentials_data_admin(user):
        return True
    return False


def can_manage_shares(user: User, cred: Credential) -> bool:
    if not user_has_credentials_module(user):
        return False
    if cred.owner_id == user.id:
        return True
    if is_credentials_data_admin(user):
        return True
    return False


def credential_has_expired_shares(cred: Credential) -> bool:
    """Any time-bound share row past expiry (owner warning banner). Never-expiry shares ignored."""
    return (
        CredentialShare.query.filter_by(credential_id=cred.id)
        .filter(CredentialShare.expiry_datetime.isnot(None))
        .filter(CredentialShare.expiry_datetime < now_utc())
        .count()
        > 0
    )


def purge_expired_shares_for_credential(cred: Credential) -> None:
    """Remove share rows past expiry (e.g. after owner rotates password). Clears owner warning."""
    now = now_utc()
    CredentialShare.query.filter_by(credential_id=cred.id).filter(
        CredentialShare.expiry_datetime.isnot(None),
        CredentialShare.expiry_datetime < now,
    ).delete(synchronize_session=False)


def count_shares(cred: Credential) -> int:
    return CredentialShare.query.filter_by(credential_id=cred.id).count()


def share_preview(cred: Credential, limit: int | None = 8) -> list[dict[str, Any]]:
    """Name + optional profile picture (HR) per share row, for stacked avatars in list UI.

    Includes **expired** shares so the owner still sees who had access when the row
    warning state is shown (expired shares would otherwise yield an empty preview).
    """
    shares = (
        CredentialShare.query.options(joinedload(CredentialShare.shared_with))
        .filter_by(credential_id=cred.id)
        .order_by(CredentialShare.created_at.asc())
        .all()
    )
    ordered: list[User] = []
    seen: set[str] = set()
    for sh in shares:
        u = sh.shared_with
        if not u:
            continue
        n = (u.name or u.email or "").strip()
        if not n or u.id in seen:
            continue
        seen.add(u.id)
        ordered.append(u)
    if not ordered:
        return []
    take = ordered if limit is None else ordered[:limit]
    uids = [u.id for u in take]
    hr_by_user = {h.user_id: h for h in HRInfo.query.filter(HRInfo.user_id.in_(uids)).all()}
    out: list[dict[str, Any]] = []
    for u in take:
        display = (u.name or u.email or "").strip()
        if not display:
            continue
        hr = hr_by_user.get(u.id)
        pic: str | None = None
        if hr and hr.profile_picture:
            s = str(hr.profile_picture).strip()
            if s:
                pic = s
        out.append({"name": display, "profilePicture": pic})
    return out
