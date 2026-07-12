"""PMS task and project file attachments — stored under PMS_UPLOAD_DIR (see config)."""
from __future__ import annotations

import os
import uuid
from pathlib import Path

from sqlalchemy import or_

from app import db
from app.config import INSTANCE_DIR, PMS_UPLOAD_DIR
from app.models import User
from app.pms_models import PmsProjectAttachment, PmsTask, PmsTaskAttachment
from app.pms_permissions import user_has_permission
from app.services import pms_access_service

PMS_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def _save_file_to_disk(file_storage, rel_dir: Path) -> tuple[str, int | None, str]:
    safe_name = os.path.basename(file_storage.filename).replace("..", "")[:255]
    stored_name = f"{uuid.uuid4().hex}_{safe_name}"
    abs_dir = INSTANCE_DIR / rel_dir
    abs_dir.mkdir(parents=True, exist_ok=True)
    abs_path = abs_dir / stored_name
    file_storage.save(abs_path)
    rel_path = str(rel_dir / stored_name)
    size = abs_path.stat().st_size if abs_path.exists() else None
    return rel_path, size, safe_name


def save_attachment(user: User, task_id: str, file_storage) -> dict:
    if not user_has_permission(user, "pms.attachment.upload"):
        raise PermissionError("Not allowed to upload attachments")
    task = pms_access_service.get_task_for_user(user, task_id)
    if not task:
        raise LookupError("Task not found")
    if not file_storage or not file_storage.filename:
        raise ValueError("file is required")

    PMS_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    rel_path, size, safe_name = _save_file_to_disk(file_storage, Path("pms_attachments") / task_id)

    row = PmsTaskAttachment(
        task_id=task_id,
        uploaded_by=user.id,
        file_name=safe_name,
        file_path=rel_path,
        file_type=file_storage.mimetype,
        file_size=size,
    )
    abs_path = INSTANCE_DIR / rel_path
    try:
        db.session.add(row)
        db.session.commit()
    except Exception:
        db.session.rollback()
        if abs_path.exists():
            abs_path.unlink(missing_ok=True)
        raise

    return row.to_dict(download_url=f"/api/pms/tasks/{task_id}/attachments/{row.id}/download")


def save_project_attachment(user: User, project_id: str, file_storage) -> dict:
    if not user_has_permission(user, "pms.attachment.upload"):
        raise PermissionError("Not allowed to upload attachments")
    project = pms_access_service.get_project_for_user(user, project_id)
    if not project:
        raise LookupError("Project not found")
    if not file_storage or not file_storage.filename:
        raise ValueError("file is required")

    PMS_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    rel_path, size, safe_name = _save_file_to_disk(
        file_storage,
        Path("pms_attachments") / "projects" / project_id,
    )

    row = PmsProjectAttachment(
        project_id=project_id,
        uploaded_by=user.id,
        file_name=safe_name,
        file_path=rel_path,
        file_type=file_storage.mimetype,
        file_size=size,
    )
    abs_path = INSTANCE_DIR / rel_path
    try:
        db.session.add(row)
        db.session.commit()
    except Exception:
        db.session.rollback()
        if abs_path.exists():
            abs_path.unlink(missing_ok=True)
        raise

    uploader = User.query.get(user.id)
    payload = row.to_dict(
        download_url=f"/api/pms/projects/{project_id}/attachments/{row.id}/download",
    )
    payload["uploadedByName"] = uploader.name if uploader else None
    return payload


def get_attachment_for_user(user: User, task_id: str, attachment_id: str) -> tuple[PmsTaskAttachment, Path]:
    task = pms_access_service.get_task_for_user(user, task_id)
    if not task:
        raise LookupError("Task not found")
    row = PmsTaskAttachment.query.filter_by(id=attachment_id, task_id=task_id).first()
    if not row:
        raise LookupError("Attachment not found")
    path = INSTANCE_DIR / row.file_path
    if not path.is_file():
        raise LookupError("File missing on server")
    return row, path


def get_project_attachment_for_user(
    user: User, project_id: str, attachment_id: str
) -> tuple[PmsProjectAttachment, Path]:
    project = pms_access_service.get_project_for_user(user, project_id)
    if not project:
        raise LookupError("Project not found")
    row = PmsProjectAttachment.query.filter_by(id=attachment_id, project_id=project_id).first()
    if not row:
        raise LookupError("Attachment not found")
    path = INSTANCE_DIR / row.file_path
    if not path.is_file():
        raise LookupError("File missing on server")
    return row, path


def _task_attachment_items(user: User, project_id: str, search: str) -> list[dict]:
    accessible_task_ids = (
        pms_access_service.base_tasks_query(user)
        .filter(PmsTask.project_id == project_id)
        .with_entities(PmsTask.id)
    )

    q = (
        db.session.query(PmsTaskAttachment, PmsTask, User)
        .join(PmsTask, PmsTaskAttachment.task_id == PmsTask.id)
        .join(User, PmsTaskAttachment.uploaded_by == User.id)
        .filter(
            PmsTask.project_id == project_id,
            PmsTask.deleted_at.is_(None),
            PmsTask.id.in_(accessible_task_ids),
        )
    )
    if search:
        term = f"%{search.strip()}%"
        q = q.filter(
            or_(
                PmsTaskAttachment.file_name.ilike(term),
                PmsTask.title.ilike(term),
            )
        )

    items: list[dict] = []
    for attachment, task, uploader in q.all():
        payload = attachment.to_dict(
            download_url=f"/api/pms/tasks/{task.id}/attachments/{attachment.id}/download",
        )
        payload["projectId"] = project_id
        payload["source"] = "task"
        payload["taskTitle"] = task.title
        payload["uploadedByName"] = uploader.name if uploader else None
        items.append(payload)
    return items


def _project_attachment_items(project_id: str, search: str) -> list[dict]:
    q = (
        db.session.query(PmsProjectAttachment, User)
        .join(User, PmsProjectAttachment.uploaded_by == User.id)
        .filter(PmsProjectAttachment.project_id == project_id)
    )
    if search:
        term = f"%{search.strip()}%"
        q = q.filter(PmsProjectAttachment.file_name.ilike(term))

    items: list[dict] = []
    for attachment, uploader in q.all():
        payload = attachment.to_dict(
            download_url=f"/api/pms/projects/{project_id}/attachments/{attachment.id}/download",
        )
        payload["uploadedByName"] = uploader.name if uploader else None
        items.append(payload)
    return items


def list_project_attachments(user: User, project_id: str, *, search: str = "") -> dict:
    """Task attachments and project-level documents for a project the user can access."""
    project = pms_access_service.get_project_for_user(user, project_id)
    if not project:
        raise LookupError("Project not found")

    items = _task_attachment_items(user, project_id, search) + _project_attachment_items(project_id, search)
    items.sort(key=lambda row: row.get("createdAt") or "", reverse=True)
    return {"items": items, "total": len(items)}
