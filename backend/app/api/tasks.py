from datetime import datetime
from flask import Blueprint, request, jsonify
from sqlalchemy import func, or_
from app import db
from app.models import Task, TaskActivityLog, User
from app.notification_service import notification_service
from app.auth_utils import require_auth
from app.services.rbac_service import ACCESS_NONE, ACCESS_ADMIN, get_effective_page_access
from app.services.task_email_service import notify_task_assignee_email

tasks_bp = Blueprint("tasks", __name__)

PAGE_KEY_TASKS = "tasks"


def _tasks_access(user) -> str:
    return get_effective_page_access(user, PAGE_KEY_TASKS)


def _user_can_access_task(current_user, task: Task) -> bool:
    """Tasks admin scope: all tasks. User scope: created by or assigned to this user."""
    access = _tasks_access(current_user)
    if access == ACCESS_NONE:
        return False
    if access == ACCESS_ADMIN:
        return True
    return task.assign_by_user_id == current_user.id or task.assign_to_user_id == current_user.id


def _humanize_snake_case(value: str) -> str:
    """Display label: in_progress → In Progress, pending → Pending."""
    if not value or not isinstance(value, str):
        return value
    parts = []
    for part in value.replace("-", "_").split("_"):
        if not part:
            continue
        parts.append(part[:1].upper() + part[1:].lower())
    return " ".join(parts) if parts else value


def _parse_datetime(s):
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


@tasks_bp.route("", methods=["GET"])
@require_auth
def list_tasks(current_user):
    access = _tasks_access(current_user)
    if access == ACCESS_NONE:
        return jsonify({"error": "No access to Tasks"}), 403
    status = request.args.get("status")
    company_id = request.args.get("companyId")
    assign_to = request.args.get("assignToUserId")
    assign_by = request.args.get("assignByUserId")
    search = (request.args.get("search") or "").strip()
    q = Task.query
    if status:
        q = q.filter(Task.status == status)
    if company_id:
        q = q.filter(Task.company_id == company_id)
    if access == ACCESS_ADMIN:
        if assign_to:
            q = q.filter(Task.assign_to_user_id == assign_to)
        if assign_by:
            q = q.filter(Task.assign_by_user_id == assign_by)
    else:
        q = q.filter(
            or_(
                Task.assign_by_user_id == current_user.id,
                Task.assign_to_user_id == current_user.id,
            )
        )
    if search:
        q = q.filter(func.lower(Task.title).like(f"%{search.lower()}%"))
    tasks = q.order_by(Task.created_at.desc()).all()
    return jsonify([t.to_dict() for t in tasks]), 200


@tasks_bp.route("", methods=["POST"])
@require_auth
def create_task(current_user):
    access = _tasks_access(current_user)
    if access == ACCESS_NONE:
        return jsonify({"error": "No access to Tasks"}), 403
    data = request.get_json() or {}
    title = (data.get("title") or "").strip()
    company_id = data.get("companyId")
    due = _parse_datetime(data.get("dueDatetime"))
    if not title:
        return jsonify({"error": "Title is required"}), 400
    if not company_id:
        return jsonify({"error": "companyId is required"}), 400
    if not due:
        return jsonify({"error": "dueDatetime is required"}), 400
    if access == ACCESS_ADMIN:
        assign_by = data.get("assignByUserId")
    else:
        assign_by = current_user.id
    task = Task(
        title=title,
        note=data.get("note"),
        company_id=company_id,
        due_datetime=due,
        assign_by_user_id=assign_by,
        assign_to_user_id=data.get("assignToUserId"),
        status="pending",
    )
    db.session.add(task)
    db.session.flush()
    log = TaskActivityLog(
        task_id=task.id,
        action_type="created",
        old_value=None,
        new_value=task.to_dict(),
        note=None,
        actor_user_id=assign_by,
    )
    db.session.add(log)
    db.session.commit()

    # Notify assignee unless they assigned the task to themselves
    if task.assign_to_user_id:
        if (
            task.assign_by_user_id
            and task.assign_to_user_id != task.assign_by_user_id
        ):
            creator_name = "Someone"
            creator = User.query.get(task.assign_by_user_id)
            if creator:
                creator_name = creator.name
            notification_service.create_notification(
                user_id=task.assign_to_user_id,
                title="New Task Assigned",
                message=f"{creator_name} assigned you a new task: {task.title}",
                n_type="info",
                category="task",
            )
        notify_task_assignee_email(task, event="created")

    return jsonify(task.to_dict()), 201


@tasks_bp.route("/<task_id>", methods=["GET"])
@require_auth
def get_task(current_user, task_id):
    task = Task.query.get(task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    if not _user_can_access_task(current_user, task):
        return jsonify({"error": "Not allowed to view this task"}), 403
    return jsonify(task.to_dict()), 200


@tasks_bp.route("/<task_id>", methods=["PUT", "PATCH"])
@require_auth
def update_task(current_user, task_id):
    task = Task.query.get(task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    if not _user_can_access_task(current_user, task):
        return jsonify({"error": "Not allowed to update this task"}), 403
    tasks_access = _tasks_access(current_user)
    data = request.get_json() or {}
    old_assign_to_user_id = task.assign_to_user_id
    old_dict = task.to_dict()
    if "title" in data:
        task.title = (data["title"] or "").strip() or task.title
    if "note" in data:
        task.note = data["note"]
    if "companyId" in data:
        task.company_id = data["companyId"] or task.company_id
    if "dueDatetime" in data:
        due = _parse_datetime(data["dueDatetime"])
        if due:
            task.due_datetime = due
    if "assignByUserId" in data and tasks_access == ACCESS_ADMIN:
        task.assign_by_user_id = data["assignByUserId"]
    if "assignToUserId" in data and tasks_access == ACCESS_ADMIN:
        task.assign_to_user_id = data["assignToUserId"]
    actor = data.get("actorUserId")
    new_dict = task.to_dict()
    changes = {k: new_dict[k] for k in new_dict if old_dict.get(k) != new_dict[k]}
    if changes and actor:
        log = TaskActivityLog(
            task_id=task.id,
            action_type="updated",
            old_value={k: old_dict.get(k) for k in changes},
            new_value=changes,
            note=data.get("note"),
            actor_user_id=actor,
        )
        db.session.add(log)
    db.session.commit()

    new_assign_to = task.assign_to_user_id
    if new_assign_to and old_assign_to_user_id != new_assign_to:
        assigner_id = actor or current_user.id
        if new_assign_to != assigner_id:
            assigner_name = "Someone"
            assigner = User.query.get(assigner_id)
            if assigner:
                assigner_name = assigner.name
            notification_service.create_notification(
                user_id=new_assign_to,
                title="Task assigned",
                message=f"{assigner_name} assigned you a task: {task.title}",
                n_type="info",
                category="task",
            )
        if old_assign_to_user_id:
            notify_task_assignee_email(task, event="reassigned")
        else:
            notify_task_assignee_email(task, event="first_assign")

    return jsonify(task.to_dict()), 200


@tasks_bp.route("/<task_id>/status", methods=["PATCH"])
@require_auth
def change_task_status(current_user, task_id):
    task = Task.query.get(task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    if not _user_can_access_task(current_user, task):
        return jsonify({"error": "Not allowed to change this task"}), 403
    data = request.get_json() or {}
    new_status = (data.get("status") or "").strip()
    if not new_status:
        return jsonify({"error": "status is required"}), 400
    old_status = task.status
    task.status = new_status
    actor = data.get("actorUserId")
    if actor:
        log = TaskActivityLog(
            task_id=task.id,
            action_type="status_changed",
            old_value={"status": old_status},
            new_value={"status": new_status},
            note=data.get("note"),
            actor_user_id=actor,
        )
        db.session.add(log)
    db.session.commit()

    # Trigger notification for task creator if status changed
    if task.assign_by_user_id and actor != task.assign_by_user_id:
        actor_name = "Someone"
        if actor:
            actor_user = User.query.get(actor)
            if actor_user:
                actor_name = actor_user.name
        
        notification_service.create_notification(
            user_id=task.assign_by_user_id,
            title="Task Status Updated",
            message=(
                f"{actor_name} changed the status of your task '{task.title}' "
                f"to {_humanize_snake_case(new_status)}"
            ),
            n_type="success" if new_status.lower() in ["completed", "done"] else "info",
            category="task",
        )

    return jsonify(task.to_dict()), 200


@tasks_bp.route("/<task_id>/logs", methods=["GET"])
@require_auth
def get_task_logs(current_user, task_id):
    task = Task.query.get(task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    if not _user_can_access_task(current_user, task):
        return jsonify({"error": "Not allowed to view this task"}), 403
    logs = TaskActivityLog.query.filter_by(task_id=task_id).order_by(
        TaskActivityLog.created_at.desc()
    ).all()
    return jsonify([l.to_dict() for l in logs]), 200


@tasks_bp.route("/<task_id>", methods=["DELETE"])
@require_auth
def delete_task(current_user, task_id):
    task = Task.query.get(task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    if not _user_can_access_task(current_user, task):
        return jsonify({"error": "Not allowed to delete this task"}), 403
    TaskActivityLog.query.filter_by(task_id=task_id).delete()
    db.session.delete(task)
    db.session.commit()
    return jsonify({"ok": True}), 200
