"""External integration APIs (API key auth, separate from JWT user sessions)."""
from flask import Blueprint, current_app, request

from app import db
from app.services import integration_service
from app.utils.integration_api import (
    integration_error,
    integration_success,
    parse_month_param,
    parse_user_ids_param,
    require_integration_api_key,
)

integrations_bp = Blueprint("integrations", __name__)


@integrations_bp.route("/employees", methods=["GET"])
@require_integration_api_key
def get_integration_employees():
    try:
        items = integration_service.list_integration_employees()
        return integration_success(items, meta={"count": len(items)})
    except Exception:
        current_app.logger.exception("Integration employees failed")
        return integration_error("Failed to load employees", 500)


@integrations_bp.route("/attendance", methods=["GET"])
@require_integration_api_key
def get_integration_attendance():
    try:
        month, start, end = parse_month_param(request.args.get("month"))
    except ValueError as e:
        return integration_error(str(e), 400)

    try:
        items = integration_service.list_integration_attendance(month, start, end)
        return integration_success(items, meta={"month": month, "count": len(items)})
    except Exception:
        current_app.logger.exception("Integration attendance failed month=%s", month)
        return integration_error("Failed to load attendance", 500)


@integrations_bp.route("/leaves", methods=["GET"])
@require_integration_api_key
def get_integration_leaves():
    try:
        month, start, end = parse_month_param(request.args.get("month"))
    except ValueError as e:
        return integration_error(str(e), 400)

    try:
        items = integration_service.list_integration_leaves(month, start, end)
        return integration_success(items, meta={"month": month, "count": len(items)})
    except Exception:
        current_app.logger.exception("Integration leaves failed month=%s", month)
        return integration_error("Failed to load leaves", 500)


@integrations_bp.route("/expenses", methods=["GET"])
@require_integration_api_key
def get_integration_expenses():
    try:
        month, start, end = parse_month_param(request.args.get("month"))
    except ValueError as e:
        return integration_error(str(e), 400)

    try:
        payload = integration_service.list_integration_expenses(month, start, end)
        return integration_success(
            payload,
            meta={
                "month": month,
                "entryCount": len(payload.get("entries") or []),
            },
        )
    except Exception:
        current_app.logger.exception("Integration expenses failed month=%s", month)
        return integration_error("Failed to load expenses", 500)


@integrations_bp.route("/expenses/mark-paid", methods=["POST"])
@require_integration_api_key
def mark_integration_expenses_paid_route():
    try:
        month, start, end = parse_month_param(request.args.get("month"))
    except ValueError as e:
        return integration_error(str(e), 400)

    body = request.get_json(silent=True) or {}
    try:
        user_ids = parse_user_ids_param(
            query_raw=request.args.get("userIds"),
            body_value=body.get("userIds") if isinstance(body, dict) else None,
        )
    except ValueError as e:
        return integration_error(str(e), 400)

    try:
        payload = integration_service.mark_integration_expenses_paid(month, start, end, user_ids)
        return integration_success(
            payload,
            meta={
                "month": month,
                "userIds": user_ids,
                "updatedCount": payload.get("updatedCount", 0),
            },
        )
    except Exception:
        current_app.logger.exception(
            "Integration mark expenses paid failed month=%s userIds=%s", month, user_ids
        )
        db.session.rollback()
        return integration_error("Failed to mark expenses as paid", 500)


@integrations_bp.route("/food-allowances", methods=["GET"])
@require_integration_api_key
def get_integration_food_allowances():
    try:
        month, start, end = parse_month_param(request.args.get("month"))
    except ValueError as e:
        return integration_error(str(e), 400)

    try:
        items = integration_service.list_integration_food_allowances(month, start, end)
        totals = integration_service.food_allowances_month_meta_totals(items)
        return integration_success(
            items,
            meta={
                "month": month,
                "count": len(items),
                **totals,
            },
        )
    except Exception:
        current_app.logger.exception("Integration food allowances failed month=%s", month)
        return integration_error("Failed to load food allowances", 500)
