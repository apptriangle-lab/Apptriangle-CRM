"""Report automation API."""

from pathlib import Path

from flask import Blueprint, jsonify, request, send_file

from app.auth_utils import require_admin_or_hr_access
from app.services.report_automation.report_automation_service import (
    ReportAutomationError,
    create_automation,
    delete_automation,
    execute_automation,
    get_automation,
    get_automation_stats,
    list_automations,
    list_execution_logs,
    toggle_automation,
    update_automation,
)
from app.services.report_automation.report_execution_logger import INSTANCE_DIR

report_automations_bp = Blueprint("report_automations", __name__)


def _err(e: Exception, code: int = 400):
    return jsonify({"error": str(e)}), code


@report_automations_bp.route("/stats", methods=["GET"])
@require_admin_or_hr_access
def stats_route(current_user):
    return jsonify(get_automation_stats()), 200


@report_automations_bp.route("", methods=["GET"])
@require_admin_or_hr_access
def list_route(current_user):
    return jsonify(list_automations()), 200


@report_automations_bp.route("", methods=["POST"])
@require_admin_or_hr_access
def create_route(current_user):
    try:
        body = request.get_json(silent=True) or {}
        return jsonify(create_automation(body, current_user.id)), 201
    except ReportAutomationError as e:
        return _err(e, 400)


@report_automations_bp.route("/<automation_id>", methods=["GET"])
@require_admin_or_hr_access
def get_route(current_user, automation_id):
    try:
        return jsonify(get_automation(automation_id)), 200
    except ReportAutomationError as e:
        return _err(e, 404)


@report_automations_bp.route("/<automation_id>", methods=["PUT"])
@require_admin_or_hr_access
def update_route(current_user, automation_id):
    try:
        body = request.get_json(silent=True) or {}
        return jsonify(update_automation(automation_id, body)), 200
    except ReportAutomationError as e:
        return _err(e, 400)


@report_automations_bp.route("/<automation_id>", methods=["DELETE"])
@require_admin_or_hr_access
def delete_route(current_user, automation_id):
    try:
        delete_automation(automation_id)
        return jsonify({"ok": True}), 200
    except ReportAutomationError as e:
        return _err(e, 404)


@report_automations_bp.route("/<automation_id>/toggle", methods=["PATCH"])
@require_admin_or_hr_access
def toggle_route(current_user, automation_id):
    try:
        body = request.get_json(silent=True) or {}
        is_active = bool(body.get("isActive", True))
        return jsonify(toggle_automation(automation_id, is_active)), 200
    except ReportAutomationError as e:
        return _err(e, 404)


@report_automations_bp.route("/<automation_id>/send-now", methods=["POST"])
@require_admin_or_hr_access
def send_now_route(current_user, automation_id):
    try:
        result = execute_automation(automation_id, manual=True)
        return jsonify(result), 200
    except ReportAutomationError as e:
        return _err(e, 400)


@report_automations_bp.route("/<automation_id>/execution-logs", methods=["GET"])
@require_admin_or_hr_access
def logs_route(current_user, automation_id):
    limit = request.args.get("limit", 100, type=int)
    offset = request.args.get("offset", 0, type=int)
    return jsonify(list_execution_logs(automation_id, limit=limit, offset=offset)), 200


@report_automations_bp.route("/execution-logs", methods=["GET"])
@require_admin_or_hr_access
def all_logs_route(current_user):
    limit = request.args.get("limit", 100, type=int)
    offset = request.args.get("offset", 0, type=int)
    return jsonify(list_execution_logs(limit=limit, offset=offset)), 200


@report_automations_bp.route("/execution-logs/<log_id>/download", methods=["GET"])
@require_admin_or_hr_access
def download_log_route(current_user, log_id):
    from app.models import ReportExecutionLog

    log = ReportExecutionLog.query.get(log_id)
    if not log or not log.file_path:
        return jsonify({"error": "File not found"}), 404

    path = INSTANCE_DIR / log.file_path
    if not path.is_file():
        return jsonify({"error": "File not found on disk"}), 404

    return send_file(path, as_attachment=True, download_name=path.name.split("_", 1)[-1])
