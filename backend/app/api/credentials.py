"""REST API for encrypted credentials — masked by default; ?reveal=true for decrypted secrets (authorized only)."""
from __future__ import annotations

from datetime import datetime

from flask import Blueprint, current_app, jsonify, request

from app import db
from app.auth_utils import get_current_user
from app.models import Credential, CredentialShare
from app.services.credential_access_service import (
    can_access_credential,
    can_manage_shares,
    can_view_password,
    can_write_credential,
    is_credentials_data_admin,
    now_utc,
    user_has_credentials_module,
)
from app.services.credential_service import CredentialService, filter_by_search
from app.services.sharing_service import SharingService, parse_expiry_datetime

credentials_bp = Blueprint("credentials", __name__)


def _svc() -> CredentialService:
    return CredentialService(current_app)


def _sharing() -> SharingService:
    return SharingService()


def _json_error(message: str, code: int):
    return jsonify({"error": message}), code


def _wants_reveal() -> bool:
    return request.args.get("reveal") in ("1", "true", "yes") or request.args.get("includeSecret") in ("1", "true", "yes")


@credentials_bp.route("/mine", methods=["GET"])
def list_mine():
    user = get_current_user()
    if not user:
        return _json_error("Authentication required", 401)
    if not user_has_credentials_module(user):
        return _json_error("No access to Credentials module", 403)

    q = (request.args.get("q") or "").strip() or None
    tag = (request.args.get("tag") or "").strip() or None
    creds = (
        Credential.query.filter_by(owner_id=user.id)
        .filter(Credential.deleted_at.is_(None))
        .order_by(Credential.updated_at.desc())
        .all()
    )
    creds = filter_by_search(q, tag, creds)
    svc = _svc()
    return jsonify([svc.to_summary_dict(c, user, for_owner_list=True) for c in creds]), 200


@credentials_bp.route("/shared-with-me", methods=["GET"])
def list_shared():
    user = get_current_user()
    if not user:
        return _json_error("Authentication required", 401)
    if not user_has_credentials_module(user):
        return _json_error("No access to Credentials module", 403)

    now = now_utc()
    shares = (
        CredentialShare.query.filter_by(shared_with_user_id=user.id)
        .order_by(CredentialShare.created_at.desc())
        .all()
    )
    q = (request.args.get("q") or "").strip() or None
    tag = (request.args.get("tag") or "").strip() or None
    svc = _svc()
    out = []
    for sh in shares:
        c = Credential.query.get(sh.credential_id)
        if not c or c.deleted_at is not None:
            continue
        filtered = filter_by_search(q, tag, [c])
        if not filtered:
            continue
        is_exp = sh.expiry_datetime is not None and sh.expiry_datetime <= now
        if is_exp:
            continue
        out.append(
            svc.to_summary_dict(
                c,
                user,
                shared_expiry=sh.expiry_datetime,
                share_is_expired=False,
            )
        )
    out.sort(key=lambda x: x.get("updatedAt") or "", reverse=True)
    return jsonify(out), 200


@credentials_bp.route("/all", methods=["GET"])
def list_all():
    user = get_current_user()
    if not user:
        return _json_error("Authentication required", 401)
    if not user_has_credentials_module(user):
        return _json_error("No access to Credentials module", 403)
    if not is_credentials_data_admin(user):
        return _json_error("Admin scope required to list all credentials", 403)

    q = (request.args.get("q") or "").strip() or None
    tag = (request.args.get("tag") or "").strip() or None
    creds = (
        Credential.query.filter(Credential.deleted_at.is_(None))
        .order_by(Credential.updated_at.desc())
        .all()
    )
    creds = filter_by_search(q, tag, creds)
    svc = _svc()
    return jsonify([svc.to_summary_dict(c, user, for_owner_list=True) for c in creds]), 200


@credentials_bp.route("/bin", methods=["GET"])
def list_credential_bin():
    """Soft-deleted credentials (Settings → Bin). Credentials module admin only."""
    user = get_current_user()
    if not user:
        return _json_error("Authentication required", 401)
    if not user_has_credentials_module(user):
        return _json_error("No access to Credentials module", 403)
    if not is_credentials_data_admin(user):
        return _json_error("Credentials admin scope required to view the bin", 403)

    creds = (
        Credential.query.filter(Credential.deleted_at.isnot(None))
        .order_by(Credential.deleted_at.desc())
        .all()
    )
    svc = _svc()
    return jsonify([svc.to_bin_row_dict(c) for c in creds]), 200


@credentials_bp.route("/restore", methods=["POST"])
def restore_credentials():
    """Restore soft-deleted credentials from the bin. Credentials module admin only."""
    user = get_current_user()
    if not user:
        return _json_error("Authentication required", 401)
    if not user_has_credentials_module(user):
        return _json_error("No access to Credentials module", 403)
    if not is_credentials_data_admin(user):
        return _json_error("Credentials admin scope required to restore", 403)

    data = request.get_json() or {}
    ids = data.get("ids") or []
    if not isinstance(ids, list) or not ids:
        return _json_error("ids must be a non-empty array", 400)

    restored_ids: list[str] = []
    for raw_id in ids:
        cid = str(raw_id).strip()
        if not cid:
            continue
        cred = Credential.query.get(cid)
        if cred and cred.deleted_at is not None:
            cred.deleted_at = None
            cred.updated_at = datetime.utcnow()
            restored_ids.append(cid)
    db.session.commit()
    return jsonify({"restoredIds": restored_ids, "count": len(restored_ids)}), 200


@credentials_bp.route("", methods=["POST"])
def create_credential():
    user = get_current_user()
    if not user:
        return _json_error("Authentication required", 401)
    if not user_has_credentials_module(user):
        return _json_error("No access to Credentials module", 403)

    data = request.get_json() or {}
    title = data.get("title")
    username = data.get("username") or ""
    password = data.get("password")
    if password is None:
        return _json_error("password is required", 400)
    url = data.get("url")
    note = data.get("note") or ""
    tags = data.get("tags")
    if not isinstance(tags, list):
        tags = []

    try:
        cred = _svc().create(user, str(title or ""), str(username), str(password), str(url if url is not None else ""), str(note), tags)
    except ValueError as e:
        return _json_error(str(e), 400)

    return jsonify(_svc().to_detail_dict(cred, user, reveal=False)), 201


@credentials_bp.route("/<cid>", methods=["GET"])
def get_credential(cid: str):
    user = get_current_user()
    if not user:
        return _json_error("Authentication required", 401)
    if not user_has_credentials_module(user):
        return _json_error("No access to Credentials module", 403)

    cred = Credential.query.get(cid)
    if not cred or cred.deleted_at is not None:
        return _json_error("Not found", 404)

    if not can_access_credential(user, cred):
        return _json_error("Access denied", 403)

    reveal = _wants_reveal()
    if reveal and not can_view_password(user, cred):
        return _json_error("Cannot reveal secrets (expired share or denied)", 403)

    svc = _svc()
    body = svc.to_detail_dict(cred, user, reveal=reveal)
    if reveal:
        svc.log_access(cid, user.id, "reveal_credentials")
    return jsonify(body), 200


@credentials_bp.route("/<cid>", methods=["PATCH"])
def patch_credential(cid: str):
    user = get_current_user()
    if not user:
        return _json_error("Authentication required", 401)
    if not user_has_credentials_module(user):
        return _json_error("No access to Credentials module", 403)

    cred = Credential.query.get(cid)
    if not cred or cred.deleted_at is not None:
        return _json_error("Not found", 404)
    if not can_write_credential(user, cred):
        return _json_error("Only the owner or credentials admin can update", 403)

    data = request.get_json() or {}
    svc = _svc()
    kwargs = {}
    if "title" in data:
        kwargs["title"] = data.get("title")
    if "username" in data:
        kwargs["username_plain"] = data.get("username")
    if "password" in data:
        kwargs["password_plain"] = data.get("password")
    if "url" in data:
        kwargs["url"] = data.get("url")
    if "note" in data:
        kwargs["note"] = data.get("note")
    if "tags" in data:
        t = data.get("tags")
        kwargs["tags"] = t if isinstance(t, list) else []

    if kwargs:
        try:
            svc.update(cred, **kwargs)
        except ValueError as e:
            return _json_error(str(e), 400)

    return jsonify(svc.to_detail_dict(cred, user, reveal=False)), 200


@credentials_bp.route("/<cid>", methods=["DELETE"])
def delete_credential(cid: str):
    user = get_current_user()
    if not user:
        return _json_error("Authentication required", 401)
    if not user_has_credentials_module(user):
        return _json_error("No access to Credentials module", 403)

    cred = Credential.query.get(cid)
    if not cred or cred.deleted_at is not None:
        return _json_error("Not found", 404)
    if not can_write_credential(user, cred):
        return _json_error("Only the owner or credentials admin can delete", 403)

    _svc().soft_delete(cred)
    return jsonify({"ok": True}), 200


@credentials_bp.route("/<cid>/shares", methods=["GET"])
@credentials_bp.route("/<cid>/shared-users", methods=["GET"])
def get_shares(cid: str):
    user = get_current_user()
    if not user:
        return _json_error("Authentication required", 401)
    if not user_has_credentials_module(user):
        return _json_error("No access to Credentials module", 403)

    cred = Credential.query.get(cid)
    if not cred or cred.deleted_at is not None:
        return _json_error("Not found", 404)
    if not can_manage_shares(user, cred):
        return _json_error("Only the owner or credentials admin can view shares", 403)

    return jsonify({"shares": _sharing().list_shares(cred)}), 200


@credentials_bp.route("/<cid>/shares", methods=["POST"])
@credentials_bp.route("/<cid>/share", methods=["POST"])
def post_shares(cid: str):
    user = get_current_user()
    if not user:
        return _json_error("Authentication required", 401)
    if not user_has_credentials_module(user):
        return _json_error("No access to Credentials module", 403)

    cred = Credential.query.get(cid)
    if not cred or cred.deleted_at is not None:
        return _json_error("Not found", 404)
    if not can_manage_shares(user, cred):
        return _json_error("Only the owner or credentials admin can share", 403)

    data = request.get_json() or {}
    user_ids = data.get("userIds") or []
    if not isinstance(user_ids, list):
        return _json_error("userIds must be an array", 400)
    expiry_raw = data.get("expiryDatetime")
    expiry: datetime | None = None
    if expiry_raw is not None and str(expiry_raw).strip():
        expiry = parse_expiry_datetime(str(expiry_raw).strip())
        if expiry is None:
            return _json_error("Invalid expiryDatetime (use ISO 8601 or omit for no expiry)", 400)
    include_global = bool(data.get("includeGlobalAdmins"))
    include_cred_admins = bool(data.get("includeCredentialAdmins"))

    try:
        _sharing().upsert_shares(
            cred,
            user,
            [str(x) for x in user_ids],
            expiry,
            include_global,
            include_cred_admins,
        )
    except ValueError as e:
        return _json_error(str(e), 400)

    return jsonify({"shares": _sharing().list_shares(cred)}), 200


@credentials_bp.route("/<cid>/shares/<share_id>", methods=["DELETE"])
def delete_share(cid: str, share_id: str):
    user = get_current_user()
    if not user:
        return _json_error("Authentication required", 401)
    if not user_has_credentials_module(user):
        return _json_error("No access to Credentials module", 403)

    cred = Credential.query.get(cid)
    if not cred or cred.deleted_at is not None:
        return _json_error("Not found", 404)
    if not can_manage_shares(user, cred):
        return _json_error("Only the owner or credentials admin can revoke shares", 403)

    ok = _sharing().revoke_share(cred, share_id)
    if not ok:
        return _json_error("Share not found", 404)
    return jsonify({"ok": True}), 200


@credentials_bp.route("/<cid>/audit", methods=["GET"])
def get_audit(cid: str):
    user = get_current_user()
    if not user:
        return _json_error("Authentication required", 401)
    if not user_has_credentials_module(user):
        return _json_error("No access to Credentials module", 403)

    cred = Credential.query.get(cid)
    if not cred or cred.deleted_at is not None:
        return _json_error("Not found", 404)
    if cred.owner_id != user.id and not is_credentials_data_admin(user):
        return _json_error("Only owner or admin can view audit log", 403)

    limit = min(int(request.args.get("limit") or 100), 500)
    return jsonify({"entries": _svc().list_audit(cred, limit=limit)}), 200
