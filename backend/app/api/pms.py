"""PMS API — Project Management System (Phase 1)."""
from __future__ import annotations

from datetime import date

from flask import Blueprint, jsonify, request, send_file

from app.auth_utils import get_current_user
from app.pms_permissions import has_pms_module_access, is_pms_admin
from app.schemas.pms_validators import PmsValidationError
from app.services import (
    pms_attachment_service,
    pms_project_service,
    pms_resource_service,
    pms_sprint_service,
    pms_task_lifecycle_service,
    pms_task_service,
)

pms_bp = Blueprint("pms", __name__)


def _err(msg: str, code: int = 400):
    return jsonify({"error": msg}), code


def _require_pms_user():
    user = get_current_user()
    if not user:
        return None, _err("Authentication required", 401)
    if not has_pms_module_access(user):
        return None, _err("Access denied", 403)
    return user, None


def _parse_date_arg(name: str):
    raw = request.args.get(name)
    if not raw:
        return None
    try:
        return date.fromisoformat(raw[:10])
    except ValueError:
        return None


@pms_bp.route("/dashboard", methods=["GET"])
def pms_dashboard():
    user, err = _require_pms_user()
    if err:
        return err
    try:
        return jsonify(pms_task_service.dashboard_stats(user)), 200
    except Exception as e:
        return _err(str(e), 500)


@pms_bp.route("/projects", methods=["GET"])
def list_projects_route():
    user, err = _require_pms_user()
    if err:
        return err
    try:
        data = pms_project_service.list_projects(
            user,
            page=request.args.get("page", 1, type=int),
            per_page=request.args.get("perPage", 20, type=int),
            search=request.args.get("search") or "",
            status=request.args.get("status") or "",
            priority=request.args.get("priority") or "",
            project_type_id=request.args.get("projectTypeId") or "",
            company_id=request.args.get("companyId") or "",
            member_user_id=request.args.get("userId") or "",
            start_from=_parse_date_arg("startFrom"),
            start_to=_parse_date_arg("startTo"),
            for_filter=request.args.get("forFilter", "").lower() in ("1", "true", "yes"),
        )
        return jsonify(data), 200
    except Exception as e:
        return _err(str(e), 500)


@pms_bp.route("/projects", methods=["POST"])
def create_project_route():
    user, err = _require_pms_user()
    if err:
        return err
    try:
        body = pms_project_service.create_project(user, request.get_json() or {})
        return jsonify(body), 201
    except PermissionError as e:
        return _err(str(e), 403)
    except PmsValidationError as e:
        return _err(str(e), 400)
    except Exception as e:
        return _err(str(e), 500)


@pms_bp.route("/projects/<project_id>", methods=["GET"])
def get_project_route(project_id):
    user, err = _require_pms_user()
    if err:
        return err
    try:
        return jsonify(pms_project_service.get_project_detail(user, project_id)), 200
    except LookupError:
        return _err("Project not found", 404)
    except Exception as e:
        return _err(str(e), 500)


@pms_bp.route("/projects/<project_id>/dashboard", methods=["GET"])
def project_dashboard_route(project_id):
    user, err = _require_pms_user()
    if err:
        return err
    try:
        return jsonify(pms_project_service.project_dashboard(user, project_id)), 200
    except LookupError:
        return _err("Project not found", 404)
    except Exception as e:
        return _err(str(e), 500)


@pms_bp.route("/projects/<project_id>", methods=["PUT"])
def update_project_route(project_id):
    user, err = _require_pms_user()
    if err:
        return err
    try:
        return jsonify(pms_project_service.update_project(user, project_id, request.get_json() or {})), 200
    except PermissionError as e:
        return _err(str(e), 403)
    except LookupError:
        return _err("Project not found", 404)
    except PmsValidationError as e:
        return _err(str(e), 400)
    except Exception as e:
        return _err(str(e), 500)


@pms_bp.route("/projects/<project_id>", methods=["DELETE"])
def delete_project_route(project_id):
    user, err = _require_pms_user()
    if err:
        return err
    try:
        pms_project_service.delete_project(user, project_id)
        return jsonify({"ok": True}), 200
    except PermissionError as e:
        return _err(str(e), 403)
    except LookupError:
        return _err("Project not found", 404)
    except Exception as e:
        return _err(str(e), 500)


@pms_bp.route("/projects/<project_id>/members", methods=["POST"])
def invite_member_route(project_id):
    user, err = _require_pms_user()
    if err:
        return err
    data = request.get_json() or {}
    uid = (data.get("userId") or "").strip()
    if not uid:
        return _err("userId is required", 400)
    try:
        body = pms_project_service.invite_member(
            user, project_id, uid, role_label=data.get("roleLabel") or ""
        )
        return jsonify(body), 201
    except PermissionError as e:
        return _err(str(e), 403)
    except LookupError:
        return _err("Project not found", 404)
    except PmsValidationError as e:
        return _err(str(e), 400)
    except Exception as e:
        return _err(str(e), 500)


@pms_bp.route("/projects/<project_id>/members/<member_user_id>", methods=["DELETE"])
def remove_member_route(project_id, member_user_id):
    user, err = _require_pms_user()
    if err:
        return err
    try:
        pms_project_service.remove_member(user, project_id, member_user_id)
        return jsonify({"ok": True}), 200
    except PermissionError as e:
        return _err(str(e), 403)
    except LookupError as e:
        return _err(str(e), 404)
    except PmsValidationError as e:
        return _err(str(e), 400)
    except Exception as e:
        return _err(str(e), 500)


@pms_bp.route("/projects/<project_id>/star", methods=["PUT"])
def set_project_star_route(project_id):
    user, err = _require_pms_user()
    if err:
        return err
    data = request.get_json() or {}
    starred = data.get("starred")
    if not isinstance(starred, bool):
        return _err("starred must be a boolean", 400)
    try:
        return jsonify(pms_project_service.set_project_starred(user, project_id, starred)), 200
    except LookupError:
        return _err("Project not found", 404)
    except Exception as e:
        return _err(str(e), 500)


@pms_bp.route("/tasks", methods=["GET"])
def list_tasks_route():
    user, err = _require_pms_user()
    if err:
        return err
    try:
        data = pms_task_service.list_tasks(
            user,
            page=request.args.get("page", 1, type=int),
            per_page=request.args.get("perPage", 20, type=int),
            search=request.args.get("search") or "",
            project_id=request.args.get("projectId") or "",
            company_id=request.args.get("companyId") or "",
            assigned_to=request.args.get("assignedTo") or "",
            mine=request.args.get("mine", "").lower() in ("1", "true", "yes"),
            status=request.args.get("status") or "",
            priority=request.args.get("priority") or "",
            due_from=_parse_date_arg("dueFrom"),
            due_to=_parse_date_arg("dueTo"),
            sprint_id=request.args.get("sprintId") or "",
        )
        return jsonify(data), 200
    except Exception as e:
        return _err(str(e), 500)


@pms_bp.route("/tasks", methods=["POST"])
def create_task_route():
    user, err = _require_pms_user()
    if err:
        return err
    try:
        body = pms_task_service.create_task(user, request.get_json() or {})
        return jsonify(body), 201
    except PermissionError as e:
        return _err(str(e), 403)
    except LookupError:
        return _err("Project not found", 404)
    except PmsValidationError as e:
        return _err(str(e), 400)
    except Exception as e:
        return _err(str(e), 500)


@pms_bp.route("/tasks/bulk-update", methods=["PATCH"])
def bulk_update_tasks_route():
    user, err = _require_pms_user()
    if err:
        return err
    try:
        return jsonify(pms_task_service.bulk_update_tasks(user, request.get_json() or {})), 200
    except PermissionError as e:
        return _err(str(e), 403)
    except PmsValidationError as e:
        return _err(str(e), 400)
    except Exception as e:
        return _err(str(e), 500)


@pms_bp.route("/tasks/deleted", methods=["GET"])
def list_deleted_tasks_route():
    user, err = _require_pms_user()
    if err:
        return err
    project_id = request.args.get("projectId") or ""
    if not project_id:
        return _err("projectId is required", 400)
    try:
        return jsonify(pms_task_lifecycle_service.list_deleted_tasks(user, project_id)), 200
    except PermissionError as e:
        return _err(str(e), 403)
    except LookupError:
        return _err("Project not found", 404)
    except Exception as e:
        return _err(str(e), 500)


@pms_bp.route("/tasks/<task_id>/restore", methods=["POST"])
def restore_task_route(task_id):
    user, err = _require_pms_user()
    if err:
        return err
    try:
        return jsonify(pms_task_lifecycle_service.restore_task(user, task_id)), 200
    except PermissionError as e:
        return _err(str(e), 403)
    except LookupError:
        return _err("Deleted task not found", 404)
    except Exception as e:
        return _err(str(e), 500)


@pms_bp.route("/tasks/<task_id>/permanent", methods=["DELETE"])
def permanent_delete_task_route(task_id):
    user, err = _require_pms_user()
    if err:
        return err
    try:
        return jsonify(pms_task_lifecycle_service.permanent_delete_task(user, task_id)), 200
    except PermissionError as e:
        return _err(str(e), 403)
    except LookupError:
        return _err("Deleted task not found", 404)
    except Exception as e:
        return _err(str(e), 500)


@pms_bp.route("/tasks/<task_id>", methods=["GET"])
def get_task_route(task_id):
    user, err = _require_pms_user()
    if err:
        return err
    try:
        return jsonify(pms_task_service.get_task_detail(user, task_id)), 200
    except LookupError:
        return _err("Task not found", 404)
    except Exception as e:
        return _err(str(e), 500)


@pms_bp.route("/tasks/<task_id>", methods=["PUT"])
def update_task_route(task_id):
    user, err = _require_pms_user()
    if err:
        return err
    try:
        return jsonify(pms_task_service.update_task(user, task_id, request.get_json() or {})), 200
    except PermissionError as e:
        return _err(str(e), 403)
    except LookupError:
        return _err("Task not found", 404)
    except PmsValidationError as e:
        return _err(str(e), 400)
    except Exception as e:
        return _err(str(e), 500)


@pms_bp.route("/tasks/<task_id>", methods=["DELETE"])
def delete_task_route(task_id):
    user, err = _require_pms_user()
    if err:
        return err
    try:
        result = pms_task_service.delete_task(user, task_id)
        return jsonify(result), 200
    except PermissionError as e:
        return _err(str(e), 403)
    except LookupError:
        return _err("Task not found", 404)
    except Exception as e:
        return _err(str(e), 500)


@pms_bp.route("/tasks/<task_id>/status", methods=["PATCH"])
def patch_task_status_route(task_id):
    user, err = _require_pms_user()
    if err:
        return err
    try:
        return jsonify(pms_task_service.patch_task_status(user, task_id, request.get_json() or {})), 200
    except PermissionError as e:
        return _err(str(e), 403)
    except LookupError:
        return _err("Task not found", 404)
    except PmsValidationError as e:
        return _err(str(e), 400)
    except Exception as e:
        return _err(str(e), 500)


@pms_bp.route("/tasks/<task_id>/comments", methods=["POST"])
def add_comment_route(task_id):
    user, err = _require_pms_user()
    if err:
        return err
    try:
        body = pms_task_service.add_comment(user, task_id, request.get_json() or {})
        return jsonify(body), 201
    except PermissionError as e:
        return _err(str(e), 403)
    except LookupError:
        return _err("Task not found", 404)
    except PmsValidationError as e:
        return _err(str(e), 400)
    except Exception as e:
        return _err(str(e), 500)


@pms_bp.route("/projects/<project_id>/attachments", methods=["GET"])
def list_project_attachments_route(project_id):
    user, err = _require_pms_user()
    if err:
        return err
    try:
        data = pms_attachment_service.list_project_attachments(
            user,
            project_id,
            search=request.args.get("search") or "",
        )
        return jsonify(data), 200
    except LookupError:
        return _err("Project not found", 404)
    except Exception as e:
        return _err(str(e), 500)


@pms_bp.route("/projects/<project_id>/attachments", methods=["POST"])
def upload_project_attachment_route(project_id):
    user, err = _require_pms_user()
    if err:
        return err
    file = request.files.get("file")
    try:
        body = pms_attachment_service.save_project_attachment(user, project_id, file)
        return jsonify(body), 201
    except PermissionError as e:
        return _err(str(e), 403)
    except LookupError:
        return _err("Project not found", 404)
    except ValueError as e:
        return _err(str(e), 400)
    except Exception as e:
        return _err(str(e), 500)


@pms_bp.route("/projects/<project_id>/attachments/<attachment_id>/download", methods=["GET"])
def download_project_attachment_route(project_id, attachment_id):
    user, err = _require_pms_user()
    if err:
        return err
    try:
        row, path = pms_attachment_service.get_project_attachment_for_user(user, project_id, attachment_id)
        return send_file(path, as_attachment=True, download_name=row.file_name)
    except LookupError:
        return _err("Not found", 404)
    except Exception as e:
        return _err(str(e), 500)


@pms_bp.route("/tasks/<task_id>/attachments", methods=["POST"])
def upload_attachment_route(task_id):
    user, err = _require_pms_user()
    if err:
        return err
    file = request.files.get("file")
    try:
        body = pms_attachment_service.save_attachment(user, task_id, file)
        return jsonify(body), 201
    except PermissionError as e:
        return _err(str(e), 403)
    except LookupError:
        return _err("Task not found", 404)
    except ValueError as e:
        return _err(str(e), 400)
    except Exception as e:
        return _err(str(e), 500)


@pms_bp.route("/tasks/<task_id>/attachments/<attachment_id>/download", methods=["GET"])
def download_attachment_route(task_id, attachment_id):
    user, err = _require_pms_user()
    if err:
        return err
    try:
        row, path = pms_attachment_service.get_attachment_for_user(user, task_id, attachment_id)
        return send_file(path, as_attachment=True, download_name=row.file_name)
    except LookupError:
        return _err("Not found", 404)
    except Exception as e:
        return _err(str(e), 500)


@pms_bp.route("/projects/<project_id>/sprints", methods=["GET"])
def list_sprints_route(project_id):
    user, err = _require_pms_user()
    if err:
        return err
    try:
        return jsonify(
            pms_sprint_service.list_sprints(
                user,
                project_id,
                status=request.args.get("status") or "",
            )
        ), 200
    except LookupError:
        return _err("Project not found", 404)
    except Exception as e:
        return _err(str(e), 500)


@pms_bp.route("/projects/<project_id>/sprints", methods=["POST"])
def create_sprint_route(project_id):
    user, err = _require_pms_user()
    if err:
        return err
    try:
        body = pms_sprint_service.create_sprint(user, project_id, request.get_json() or {})
        return jsonify(body), 201
    except PermissionError as e:
        return _err(str(e), 403)
    except LookupError:
        return _err("Project not found", 404)
    except PmsValidationError as e:
        return _err(str(e), 400)
    except Exception as e:
        return _err(str(e), 500)


@pms_bp.route("/projects/<project_id>/sprints/<sprint_id>", methods=["GET"])
def get_sprint_route(project_id, sprint_id):
    user, err = _require_pms_user()
    if err:
        return err
    try:
        return jsonify(pms_sprint_service.get_sprint_detail(user, project_id, sprint_id)), 200
    except LookupError:
        return _err("Sprint not found", 404)
    except Exception as e:
        return _err(str(e), 500)


@pms_bp.route("/projects/<project_id>/sprints/<sprint_id>", methods=["PUT"])
def update_sprint_route(project_id, sprint_id):
    user, err = _require_pms_user()
    if err:
        return err
    try:
        return jsonify(
            pms_sprint_service.update_sprint(user, project_id, sprint_id, request.get_json() or {})
        ), 200
    except PermissionError as e:
        return _err(str(e), 403)
    except LookupError:
        return _err("Sprint not found", 404)
    except PmsValidationError as e:
        return _err(str(e), 400)
    except Exception as e:
        return _err(str(e), 500)


@pms_bp.route("/projects/<project_id>/sprints/<sprint_id>", methods=["DELETE"])
def delete_sprint_route(project_id, sprint_id):
    user, err = _require_pms_user()
    if err:
        return err
    try:
        pms_sprint_service.delete_sprint(user, project_id, sprint_id)
        return jsonify({"ok": True}), 200
    except PermissionError as e:
        return _err(str(e), 403)
    except LookupError:
        return _err("Sprint not found", 404)
    except Exception as e:
        return _err(str(e), 500)


@pms_bp.route("/projects/<project_id>/sprints/<sprint_id>/tasks", methods=["PATCH"])
def assign_sprint_tasks_route(project_id, sprint_id):
    user, err = _require_pms_user()
    if err:
        return err
    data = request.get_json() or {}
    task_ids = data.get("taskIds") or []
    if not isinstance(task_ids, list):
        return _err("taskIds must be an array", 400)
    try:
        return jsonify(
            pms_sprint_service.assign_tasks_to_sprint(user, project_id, sprint_id, task_ids)
        ), 200
    except PermissionError as e:
        return _err(str(e), 403)
    except LookupError:
        return _err("Sprint not found", 404)
    except Exception as e:
        return _err(str(e), 500)


@pms_bp.route("/kanban", methods=["GET"])
def kanban_route():
    user, err = _require_pms_user()
    if err:
        return err
    try:
        data = pms_task_service.kanban_board(
            user,
            project_id=request.args.get("projectId") or "",
            assigned_to=request.args.get("assignedTo") or "",
            mine=request.args.get("mine", "").lower() in ("1", "true", "yes"),
            priority=request.args.get("priority") or "",
            sprint_id=request.args.get("sprintId") or "",
        )
        return jsonify(data), 200
    except Exception as e:
        return _err(str(e), 500)


@pms_bp.route("/my-tasks", methods=["GET"])
def my_tasks_route():
    user, err = _require_pms_user()
    if err:
        return err
    try:
        return jsonify(pms_task_service.my_tasks_summary(user)), 200
    except Exception as e:
        return _err(str(e), 500)


@pms_bp.route("/resources", methods=["GET"])
def resource_activity_route():
    user, err = _require_pms_user()
    if err:
        return err
    from app.pms_permissions import user_has_permission

    if not user_has_permission(user, "pms.resource.view"):
        return _err("Forbidden", 403)
    date_from = _parse_date_arg("from")
    date_to = _parse_date_arg("to")
    if not date_from or not date_to:
        return _err("from and to query params are required (YYYY-MM-DD)", 400)
    target_user_id = (request.args.get("userId") or "").strip()
    try:
        if target_user_id:
            data = pms_resource_service.get_resource_activity(
                user,
                target_user_id=target_user_id,
                date_from=date_from,
                date_to=date_to,
            )
        else:
            data = pms_resource_service.get_resource_overview(
                user,
                date_from=date_from,
                date_to=date_to,
            )
        return jsonify(data), 200
    except PmsValidationError as e:
        return _err(str(e), 400)
    except Exception as e:
        return _err(str(e), 500)


@pms_bp.route("/permissions", methods=["GET"])
def pms_permissions_route():
    """Client hints for UI (create buttons, settings link)."""
    user, err = _require_pms_user()
    if err:
        return err
    from app.pms_permissions import user_has_permission

    return jsonify(
        {
            "isSystemAdmin": is_pms_admin(user) and getattr(user, "role", "") == "admin",
            "isPmsAdmin": is_pms_admin(user),
            "canCreateProject": user_has_permission(user, "pms.project.create"),
            "canManageSettings": user_has_permission(user, "pms.settings.manage"),
            "canViewReports": user_has_permission(user, "pms.report.view"),
            "canViewResource": user_has_permission(user, "pms.resource.view"),
            "canViewHubDashboard": user_has_permission(user, "pms.dashboard.view"),
            "canCreateTask": user_has_permission(user, "pms.task.create"),
            "canUpdateTask": user_has_permission(user, "pms.task.update"),
            "canUpdateTaskStatus": user_has_permission(user, "pms.task.update_status"),
            "canDeleteTask": user_has_permission(user, "pms.task.delete"),
            "canManageDeletedTasks": is_pms_admin(user),
            "canInviteMember": user_has_permission(user, "pms.project.invite_user"),
        }
    ), 200
