"""Currencies API: admin can list (any auth), create, update, delete."""
from flask import Blueprint, request, jsonify
from app import db
from app.models import Currency
from app.auth_utils import get_current_user, require_admin

currencies_bp = Blueprint("currencies", __name__)


@currencies_bp.route("", methods=["GET"])
def list_currencies():
    """Return all currencies, ordered by sort_order then code. No auth required for read."""
    currencies = Currency.query.order_by(Currency.sort_order.asc(), Currency.code.asc()).all()
    return jsonify([c.to_dict() for c in currencies]), 200


@currencies_bp.route("", methods=["POST"])
@require_admin
def create_currency(current_user):
    """Admin only. Body: code, name, symbol (optional), sortOrder (optional)."""
    data = request.get_json() or {}
    code = (data.get("code") or "").strip().upper()
    name = (data.get("name") or "").strip()
    symbol = (data.get("symbol") or "").strip()
    sort_order = data.get("sortOrder")
    if isinstance(sort_order, (int, float)):
        sort_order = int(sort_order)
    else:
        sort_order = None

    if not code:
        return jsonify({"error": "code is required"}), 400
    if not name:
        return jsonify({"error": "name is required"}), 400

    if Currency.query.filter_by(code=code).first():
        return jsonify({"error": "A currency with this code already exists"}), 409

    if sort_order is None:
        max_order = db.session.query(db.func.max(Currency.sort_order)).scalar() or 0
        sort_order = max_order + 1

    currency = Currency(code=code, name=name, symbol=symbol, sort_order=sort_order)
    db.session.add(currency)
    db.session.commit()
    return jsonify(currency.to_dict()), 201


@currencies_bp.route("/<currency_id>", methods=["GET"])
def get_currency(currency_id):
    currency = Currency.query.get(currency_id)
    if not currency:
        return jsonify({"error": "Currency not found"}), 404
    return jsonify(currency.to_dict()), 200


@currencies_bp.route("/<currency_id>", methods=["PUT", "PATCH"])
@require_admin
def update_currency(currency_id, current_user):
    """Admin only. Body: code, name, symbol, sortOrder (all optional)."""
    currency = Currency.query.get(currency_id)
    if not currency:
        return jsonify({"error": "Currency not found"}), 404

    data = request.get_json() or {}
    if "code" in data:
        code = (data.get("code") or "").strip().upper()
        if not code:
            return jsonify({"error": "code cannot be empty"}), 400
        other = Currency.query.filter(Currency.id != currency.id, Currency.code == code).first()
        if other:
            return jsonify({"error": "A currency with this code already exists"}), 409
        currency.code = code
    if "name" in data:
        name = (data.get("name") or "").strip()
        if name:
            currency.name = name
    if "symbol" in data:
        currency.symbol = (data.get("symbol") or "").strip()
    if "sortOrder" in data:
        val = data.get("sortOrder")
        if isinstance(val, (int, float)):
            currency.sort_order = int(val)

    db.session.commit()
    return jsonify(currency.to_dict()), 200


@currencies_bp.route("/<currency_id>", methods=["DELETE"])
@require_admin
def delete_currency(currency_id, current_user):
    currency = Currency.query.get(currency_id)
    if not currency:
        return jsonify({"error": "Currency not found"}), 404
    db.session.delete(currency)
    db.session.commit()
    return jsonify({"ok": True}), 200
