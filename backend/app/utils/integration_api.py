"""Helpers for external integration API routes (API key auth + response shape)."""
from __future__ import annotations

import re
from calendar import monthrange
from datetime import date
from functools import wraps

from flask import current_app, jsonify, request

_MONTH_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


def integration_success(data, *, meta: dict | None = None, status: int = 200):
    payload: dict = {"success": True, "data": data}
    if meta is not None:
        payload["meta"] = meta
    return jsonify(payload), status


def integration_error(message: str, status: int = 400):
    return jsonify({"success": False, "message": message}), status


def parse_month_param(raw: str) -> tuple[str, date, date]:
    """Validate YYYY-MM and return (month_str, start_date, end_date)."""
    month = (raw or "").strip()
    if not month:
        raise ValueError("month query parameter is required")
    if not _MONTH_RE.match(month):
        raise ValueError("month must be in YYYY-MM format")
    year = int(month[:4])
    mon = int(month[5:7])
    last_day = monthrange(year, mon)[1]
    return month, date(year, mon, 1), date(year, mon, last_day)


def parse_user_ids_param(*, query_raw: str | None = None, body_value=None) -> list[str]:
    """Parse userIds from comma-separated query string or JSON array (POST body)."""
    ids: list[str] = []

    if body_value is not None:
        if isinstance(body_value, list):
            ids = [str(item).strip() for item in body_value if str(item).strip()]
        elif isinstance(body_value, str):
            ids = [part.strip() for part in body_value.split(",") if part.strip()]
    elif query_raw is not None and str(query_raw).strip():
        ids = [part.strip() for part in str(query_raw).split(",") if part.strip()]

    if not ids:
        raise ValueError(
            "userIds is required (comma-separated query param or JSON array in request body)"
        )
    return ids


def require_integration_api_key(f):
    """Decorator: validate x-api-key header against EXTERNAL_API_KEY config."""

    @wraps(f)
    def wrapped(*args, **kwargs):
        configured_key = (current_app.config.get("EXTERNAL_API_KEY") or "").strip()
        if not configured_key:
            current_app.logger.warning("Integration API request rejected: EXTERNAL_API_KEY not configured")
            return integration_error("Integration API is not configured", 503)

        provided = (request.headers.get("x-api-key") or "").strip()
        if not provided:
            current_app.logger.info("Integration API unauthorized: missing x-api-key from %s", request.remote_addr)
            return integration_error("API key is required", 401)
        if provided != configured_key:
            current_app.logger.warning(
                "Integration API forbidden: invalid x-api-key from %s path=%s",
                request.remote_addr,
                request.path,
            )
            return integration_error("Invalid API key", 403)

        current_app.logger.info(
            "Integration API %s %s from %s",
            request.method,
            request.path,
            request.remote_addr,
        )
        return f(*args, **kwargs)

    return wrapped
