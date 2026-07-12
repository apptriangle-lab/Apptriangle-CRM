"""Lunch ordering & voting API."""
import json
import queue
from datetime import date

from flask import Blueprint, Response, jsonify, request, stream_with_context

from app import db
from app.auth_utils import get_current_user
from app.lunch_models import LunchPoll
from app.rbac_utils import (
    PAGE_KEY_LUNCH,
    can_access_page,
    is_global_system_admin,
    is_page_scope_admin,
)
from app.services import lunch_service
from app.services.lunch_notification_service import notify_admin_vote_changed, notify_lunch_poll_created
from app.services.lunch_realtime_service import subscribe, unsubscribe

lunch_bp = Blueprint("lunch", __name__)


def _is_admin(user) -> bool:
    """Global admins and Lunch RBAC admins may manage any poll (not limited to creator)."""
    return is_global_system_admin(user) or is_page_scope_admin(user, PAGE_KEY_LUNCH)


def _require_user():
    user = get_current_user()
    if not user:
        return None, (jsonify({"error": "Authentication required"}), 401)
    if not (is_global_system_admin(user) or can_access_page(user, PAGE_KEY_LUNCH)):
        return None, (jsonify({"error": "No access to Lunch"}), 403)
    return user, None


def _parse_date(value: str, field: str = "date") -> date:
    try:
        return date.fromisoformat((value or "").strip())
    except ValueError as exc:
        raise ValueError(f"Invalid {field}") from exc


@lunch_bp.route("/events/stream", methods=["GET"])
def lunch_events_stream():
    """Server-Sent Events stream for lunch poll real-time updates."""
    user = get_current_user()
    if not user:
        return jsonify({"error": "Authentication required"}), 401
    if not (is_global_system_admin(user) or can_access_page(user, PAGE_KEY_LUNCH)):
        return jsonify({"error": "No access to Lunch"}), 403

    user_id = user.id

    def generate():
        q = subscribe(user_id)
        try:
            yield ": connected\n\n"
            while True:
                try:
                    msg = q.get(timeout=25)
                    yield f"data: {json.dumps(msg)}\n\n"
                except queue.Empty:
                    yield f"data: {json.dumps({'event': 'ping'})}\n\n"
        finally:
            unsubscribe(user_id, q)

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


def _admin_vote_response(vote, poll, target, refreshed_poll):
    """Shared JSON body for admin vote update + realtime event source."""
    opt = vote.option
    today = lunch_service.dhaka_today()
    month_net = lunch_service.get_user_month_net_change(target.id, today.year, today.month)
    results = lunch_service.poll_summary(refreshed_poll) if refreshed_poll else None
    return {
        "pollId": poll.id,
        "vote": vote.to_dict(
            user_name=target.name if target else None,
            option_label=opt.label if opt else None,
            option_type=opt.option_type if opt else None,
            poll_date=poll.poll_date,
        ),
        "selectedOptionId": vote.option_id,
        "selectedOptionName": opt.label if opt else None,
        "balance": float(lunch_service.get_user_balance(target)) if target else 0,
        "balanceChange": float(vote.balance_change) if vote.balance_change is not None else None,
        "monthNetChange": float(month_net),
        "updatedAt": lunch_service._vote_updated_at_iso(vote),
        "results": results,
        "myVote": vote.to_dict(
            user_name=target.name if target else None,
            option_label=opt.label if opt else None,
            option_type=opt.option_type if opt else None,
            poll_date=poll.poll_date,
        ),
    }


@lunch_bp.route("/settings", methods=["GET"])
def get_settings():
    user, err = _require_user()
    if err:
        return err
    settings = lunch_service.get_or_create_settings()
    return jsonify(settings.to_dict()), 200


@lunch_bp.route("/settings", methods=["PUT"])
def update_settings():
    user, err = _require_user()
    if err:
        return err
    if not _is_admin(user):
        return jsonify({"error": "Admin access required"}), 403
    data = request.get_json() or {}
    settings = lunch_service.get_or_create_settings()
    if "defaultCostAmount" in data:
        settings.default_cost_amount = data["defaultCostAmount"]
    if "allowVoteChange" in data:
        settings.allow_vote_change = bool(data["allowVoteChange"])
    settings.updated_by = user.id
    db.session.commit()
    return jsonify(settings.to_dict()), 200


@lunch_bp.route("/dashboard", methods=["GET"])
def dashboard():
    user, err = _require_user()
    if err:
        return err
    if not _is_admin(user):
        return jsonify({"error": "Admin access required"}), 403
    return jsonify(lunch_service.admin_dashboard()), 200


@lunch_bp.route("/me/snapshot", methods=["GET"])
def me_snapshot():
    """Full lunch page state for the logged-in user (DB is source of truth for my_vote)."""
    user, err = _require_user()
    if err:
        return err
    from app.models import User

    u = User.query.get(user.id)
    if not u:
        return jsonify({"error": "User not found"}), 404

    date_param = (request.args.get("date") or "").strip()
    month_param = (request.args.get("month") or "").strip()
    try:
        poll_date = _parse_date(date_param, "date") if date_param else None
        if month_param:
            lunch_service.parse_month_param(month_param)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    snapshot = lunch_service.build_user_lunch_snapshot(
        u,
        poll_date=poll_date,
        month=month_param or None,
    )
    return jsonify(snapshot), 200


@lunch_bp.route("/polls/today", methods=["GET"])
def today_poll():
    user, err = _require_user()
    if err:
        return err
    from app.models import User

    u = User.query.get(user.id)
    today = lunch_service.dhaka_today()
    month_net = lunch_service.get_user_month_net_change(user.id, today.year, today.month)
    wallet_balance = float(lunch_service.get_user_balance(u)) if u else 0

    polls = lunch_service.get_today_polls()
    items = []
    for poll in polls:
        db.session.refresh(poll)
        db.session.expire(poll, ["votes"])
        # Fresh query — avoid stale option_id after admin override.
        from app.lunch_models import LunchVote, LunchPollOption

        my_vote = (
            LunchVote.query.filter_by(poll_id=poll.id, user_id=user.id)
            .execution_options(populate_existing=True)
            .first()
        )
        if my_vote:
            db.session.expire(my_vote, ["option"])
            db.session.refresh(my_vote)
        opt = my_vote.option if my_vote else None
        if my_vote and opt and opt.id != my_vote.option_id:
            opt = LunchPollOption.query.get(my_vote.option_id)
        items.append(
            {
                "poll": poll.to_dict(include_options=True),
                "selectedOptionId": my_vote.option_id if my_vote else None,
                "myVote": my_vote.to_dict(
                    option_label=opt.label if opt else None,
                    option_type=opt.option_type if opt else None,
                    poll_date=poll.poll_date,
                )
                if my_vote
                else None,
                "results": lunch_service.poll_summary(poll),
            }
        )
    first = items[0] if items else None
    return (
        jsonify(
            {
                "items": items,
                "poll": first["poll"] if first else None,
                "myVote": first["myVote"] if first else None,
                "results": first["results"] if first else None,
                "balance": wallet_balance,
                "monthNetChange": float(month_net),
            }
        ),
        200,
    )


@lunch_bp.route("/polls", methods=["GET"])
def list_polls():
    user, err = _require_user()
    if err:
        return err
    if not _is_admin(user):
        return jsonify({"error": "Admin access required"}), 403
    from_date = request.args.get("from")
    to_date = request.args.get("to")
    status = request.args.get("status") or ""
    try:
        fd = _parse_date(from_date, "from") if from_date else None
        td = _parse_date(to_date, "to") if to_date else None
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    polls = lunch_service.list_polls(from_date=fd, to_date=td, status=status)
    items = []
    for p in polls:
        if p.status == "active":
            p = lunch_service.refresh_poll_expiry(p)
        d = p.to_dict()
        d["totalVotes"] = len(p.votes)
        items.append(d)
    return jsonify(items), 200


@lunch_bp.route("/polls", methods=["POST"])
def create_poll():
    user, err = _require_user()
    if err:
        return err
    if not _is_admin(user):
        return jsonify({"error": "Admin access required"}), 403
    data = request.get_json() or {}
    try:
        poll_date = _parse_date(data.get("date") or lunch_service.dhaka_today().isoformat())
        settings = lunch_service.get_or_create_settings()
        poll = lunch_service.create_poll(
            user,
            poll_date=poll_date,
            title=data.get("title") or "Today's Lunch",
            cost_amount=data.get("costAmount", settings.default_cost_amount),
            allow_vote_change=data.get("allowVoteChange", settings.allow_vote_change),
            end_time=data.get("endTime"),
            options=data.get("options") or [],
        )
        notify_lunch_poll_created(poll=poll, creator=user)
        return jsonify(poll.to_dict(include_options=True)), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@lunch_bp.route("/polls/<poll_id>", methods=["GET"])
def get_poll(poll_id):
    user, err = _require_user()
    if err:
        return err
    poll = lunch_service.get_poll(poll_id)
    if not poll:
        return jsonify({"error": "Poll not found"}), 404
    if poll.status == "active":
        poll = lunch_service.refresh_poll_expiry(poll)
    payload = {"poll": poll.to_dict(include_options=True)}
    payload["results"] = lunch_service.poll_summary(
        poll, include_balance_changes=_is_admin(user)
    )
    if not _is_admin(user):
        my_vote = lunch_service.get_user_vote(poll.id, user.id)
        opt = my_vote.option if my_vote else None
        payload["myVote"] = (
            my_vote.to_dict(
                option_label=opt.label if opt else None,
                option_type=opt.option_type if opt else None,
                poll_date=poll.poll_date,
            )
            if my_vote
            else None
        )
    return jsonify(payload), 200


@lunch_bp.route("/polls/<poll_id>", methods=["PUT"])
def update_poll(poll_id):
    user, err = _require_user()
    if err:
        return err
    if not _is_admin(user):
        return jsonify({"error": "Admin access required"}), 403
    poll = lunch_service.get_poll(poll_id)
    if not poll:
        return jsonify({"error": "Poll not found"}), 404
    data = request.get_json() or {}
    try:
        poll = lunch_service.update_poll(
            poll,
            title=data.get("title"),
            cost_amount=data.get("costAmount"),
            allow_vote_change=data.get("allowVoteChange"),
            end_time=data.get("endTime"),
            extend_minutes=data.get("extendMinutes"),
            options=data.get("options"),
            option_updates=data.get("optionUpdates"),
            actor_id=user.id,
        )
        return jsonify(poll.to_dict(include_options=True)), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e) or "Failed to update poll"}), 500


@lunch_bp.route("/polls/<poll_id>/status", methods=["PATCH"])
def set_poll_status(poll_id):
    user, err = _require_user()
    if err:
        return err
    if not _is_admin(user):
        return jsonify({"error": "Admin access required"}), 403
    poll = lunch_service.get_poll(poll_id)
    if not poll:
        return jsonify({"error": "Poll not found"}), 404
    data = request.get_json() or {}
    try:
        poll = lunch_service.set_poll_status(poll, data.get("status") or "")
        return jsonify(poll.to_dict(include_options=True)), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@lunch_bp.route("/polls/<poll_id>", methods=["DELETE"])
def delete_poll(poll_id):
    user, err = _require_user()
    if err:
        return err
    if not _is_admin(user):
        return jsonify({"error": "Admin access required"}), 403
    poll = lunch_service.get_poll(poll_id)
    if not poll:
        return jsonify({"error": "Poll not found"}), 404
    try:
        lunch_service.delete_poll(poll)
        return jsonify({"ok": True}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e) or "Failed to delete poll"}), 400


@lunch_bp.route("/polls/<poll_id>/vote", methods=["POST"])
def cast_vote(poll_id):
    user, err = _require_user()
    if err:
        return err
    poll = lunch_service.get_poll(poll_id)
    if not poll:
        return jsonify({"error": "Poll not found"}), 404
    data = request.get_json() or {}
    option_id = (data.get("optionId") or "").strip()
    if not option_id:
        return jsonify({"error": "optionId is required"}), 400
    try:
        vote = lunch_service.cast_or_update_vote(user, poll, option_id)
        opt = vote.option
        from app.models import User

        u = User.query.get(user.id)
        today = lunch_service.dhaka_today()
        month_net = lunch_service.get_user_month_net_change(user.id, today.year, today.month)
        refreshed_poll = lunch_service.get_poll(poll_id)
        lunch_service.emit_lunch_vote_updated(vote, poll, user)
        return (
            jsonify(
                {
                    "vote": vote.to_dict(
                        user_name=user.name,
                        option_label=opt.label if opt else None,
                        option_type=opt.option_type if opt else None,
                        poll_date=poll.poll_date,
                    ),
                    "selectedOptionId": vote.option_id,
                    "balance": float(lunch_service.get_user_balance(u)) if u else 0,
                    "monthNetChange": float(month_net),
                    "updatedAt": lunch_service._vote_updated_at_iso(vote),
                    "results": lunch_service.poll_summary(refreshed_poll) if refreshed_poll else None,
                }
            ),
            200,
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@lunch_bp.route("/polls/<poll_id>/admin-vote", methods=["POST"])
def admin_cast_vote(poll_id):
    user, err = _require_user()
    if err:
        return err
    if not _is_admin(user):
        return jsonify({"error": "Admin access required"}), 403
    poll = lunch_service.get_poll(poll_id)
    if not poll:
        return jsonify({"error": "Poll not found"}), 404
    data = request.get_json() or {}
    target_user_id = (data.get("userId") or "").strip()
    option_id = (data.get("optionId") or "").strip()
    if not target_user_id:
        return jsonify({"error": "userId is required"}), 400
    if not option_id:
        return jsonify({"error": "optionId is required"}), 400
    try:
        vote = lunch_service.admin_set_user_vote(user, target_user_id, poll, option_id)
        opt = vote.option
        from app.models import User

        target = User.query.get(target_user_id)
        if target and opt:
            notify_admin_vote_changed(
                admin=user,
                target=target,
                poll=poll,
                option_label=opt.label,
            )
        refreshed_poll = lunch_service.get_poll(poll_id)
        if target:
            lunch_service.emit_lunch_vote_updated(vote, poll, target)
        body = _admin_vote_response(vote, poll, target, refreshed_poll)
        return jsonify(body), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@lunch_bp.route("/polls/<poll_id>/summary", methods=["GET"])
def poll_summary_route(poll_id):
    user, err = _require_user()
    if err:
        return err
    poll = lunch_service.get_poll(poll_id)
    if not poll:
        return jsonify({"error": "Poll not found"}), 404
    return (
        jsonify(
            lunch_service.poll_summary(poll, include_balance_changes=_is_admin(user))
        ),
        200,
    )


@lunch_bp.route("/votes/history", methods=["GET"])
def vote_history():
    user, err = _require_user()
    if err:
        return err
    target_user_id = request.args.get("userId") or ""
    if not _is_admin(user):
        target_user_id = user.id
    elif target_user_id == "all":
        target_user_id = ""
    elif not target_user_id:
        target_user_id = user.id
    from_date = request.args.get("from") or request.args.get("startDate") or request.args.get("start_date")
    to_date = request.args.get("to") or request.args.get("endDate") or request.args.get("end_date")
    option_type = request.args.get("optionType") or ""
    try:
        fd = _parse_date(from_date, "from") if from_date else None
        td = _parse_date(to_date, "to") if to_date else None
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    result = lunch_service.list_vote_history(
        user_id=target_user_id or None,
        from_date=fd,
        to_date=td,
        option_type=option_type,
    )
    return jsonify(
        {
            **result,
            "from": fd.isoformat() if fd else None,
            "to": td.isoformat() if td else None,
        }
    ), 200


@lunch_bp.route("/balance/me", methods=["GET"])
def my_balance():
    user, err = _require_user()
    if err:
        return err
    from app.models import User

    u = User.query.get(user.id)
    month_param = (request.args.get("month") or "").strip()
    try:
        if month_param:
            year, month = lunch_service.parse_month_param(month_param)
        else:
            today = lunch_service.dhaka_today()
            year, month = today.year, today.month
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    month_net = lunch_service.get_user_month_net_change(user.id, year, month)
    return (
        jsonify(
            {
                "balance": float(lunch_service.get_user_balance(u)) if u else 0,
                "month": f"{year:04d}-{month:02d}",
                "monthNetChange": float(month_net),
            }
        ),
        200,
    )


@lunch_bp.route("/balance/transactions", methods=["GET"])
def balance_transactions():
    user, err = _require_user()
    if err:
        return err
    target_user_id = request.args.get("userId") or ""
    if not _is_admin(user):
        target_user_id = user.id
    elif not target_user_id:
        target_user_id = user.id
    from_date = request.args.get("from")
    to_date = request.args.get("to")
    try:
        fd = _parse_date(from_date, "from") if from_date else None
        td = _parse_date(to_date, "to") if to_date else None
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    items = lunch_service.list_balance_transactions(
        user_id=target_user_id or None,
        from_date=fd,
        to_date=td,
    )
    return jsonify({"items": items}), 200


@lunch_bp.route("/balance/employees", methods=["GET"])
def employee_balances():
    user, err = _require_user()
    if err:
        return err
    if not _is_admin(user):
        return jsonify({"error": "Admin access required"}), 403
    from_date = request.args.get("from") or request.args.get("startDate") or request.args.get("start_date")
    to_date = request.args.get("to") or request.args.get("endDate") or request.args.get("end_date")
    try:
        fd = _parse_date(from_date, "from") if from_date else None
        td = _parse_date(to_date, "to") if to_date else None
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify(lunch_service.list_employee_balances(from_date=fd, to_date=td)), 200


@lunch_bp.route("/admin/users/<user_id>/month", methods=["GET"])
def admin_user_month_detail(user_id):
    user, err = _require_user()
    if err:
        return err
    if not _is_admin(user):
        return jsonify({"error": "Admin access required"}), 403
    month_param = (request.args.get("month") or "").strip()
    from_param = request.args.get("from") or request.args.get("startDate") or request.args.get("start_date")
    to_param = request.args.get("to") or request.args.get("endDate") or request.args.get("end_date")
    try:
        if from_param and to_param:
            fd = _parse_date(from_param, "from")
            td = _parse_date(to_param, "to")
            if fd > td:
                return jsonify({"error": "from must be on or before to"}), 400
            payload = lunch_service.get_admin_user_period_detail(user_id, from_date=fd, to_date=td)
            return jsonify(payload), 200
        if month_param:
            year, month = lunch_service.parse_month_param(month_param)
        else:
            today = lunch_service.dhaka_today()
            year, month = today.year, today.month
        payload = lunch_service.get_admin_user_month_detail(user_id, year, month)
        return jsonify(payload), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@lunch_bp.route("/balance/adjust", methods=["POST"])
def adjust_balance():
    user, err = _require_user()
    if err:
        return err
    if not _is_admin(user):
        return jsonify({"error": "Admin access required"}), 403
    data = request.get_json() or {}
    target_user_id = (data.get("userId") or "").strip()
    if not target_user_id:
        return jsonify({"error": "userId is required"}), 400
    try:
        result = lunch_service.manual_balance_adjustment(
            user,
            target_user_id,
            data.get("amount"),
            data.get("reason") or "",
        )
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
