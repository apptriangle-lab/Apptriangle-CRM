"""Lunch poll, voting, and balance business logic."""
from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal
from calendar import monthrange
from zoneinfo import ZoneInfo

from sqlalchemy import func

from app import db
from app.lunch_models import (
    LunchBalanceTransaction,
    LunchPoll,
    LunchPollOption,
    LunchSettings,
    LunchVote,
)
from app.models import User

DHAKA = ZoneInfo("Asia/Dhaka")

PAGE_KEY_LUNCH = "lunch"


def dhaka_today() -> date:
    return datetime.now(DHAKA).date()


def _decimal(value) -> Decimal:
    return Decimal(str(value or 0))


def get_or_create_settings() -> LunchSettings:
    row = LunchSettings.query.get("default")
    if row:
        return row
    row = LunchSettings(id="default", default_cost_amount=Decimal("65"), allow_vote_change=True)
    db.session.add(row)
    db.session.commit()
    return row


def balance_change_for_option(option_type: str, cost_amount) -> Decimal:
    cost = _decimal(cost_amount)
    t = (option_type or "office").strip().lower()
    if t == "personal":
        return cost
    if t == "off":
        return Decimal("0")
    return -cost


def get_user_balance(user: User) -> Decimal:
    return _decimal(getattr(user, "lunch_balance", 0) or 0)


def month_date_bounds(year: int, month: int) -> tuple[date, date]:
    if month < 1 or month > 12:
        raise ValueError("Invalid month")
    start = date(year, month, 1)
    end = date(year, month, monthrange(year, month)[1])
    return start, end


def _month_created_at_bounds_utc(year: int, month: int) -> tuple[datetime, datetime]:
    """UTC-naive bounds for DB timestamps; calendar month in Asia/Dhaka."""
    from datetime import timezone

    start, end = month_date_bounds(year, month)
    start_utc = datetime.combine(start, datetime.min.time(), tzinfo=DHAKA).astimezone(timezone.utc).replace(
        tzinfo=None
    )
    end_utc = datetime.combine(end, datetime.max.time(), tzinfo=DHAKA).astimezone(timezone.utc).replace(tzinfo=None)
    return start_utc, end_utc


def get_user_month_net_change(user_id: str, year: int, month: int) -> Decimal:
    """Net lunch balance change for a calendar month (poll-date votes + manual adjustments)."""
    start, end = month_date_bounds(year, month)
    vote_total = sum_vote_balance_changes_by_user(from_date=start, to_date=end).get(user_id, Decimal("0"))
    start_utc, end_utc = _month_created_at_bounds_utc(year, month)
    manual_total = (
        db.session.query(func.coalesce(func.sum(LunchBalanceTransaction.amount), 0))
        .filter(
            LunchBalanceTransaction.user_id == user_id,
            LunchBalanceTransaction.reference_vote_id.is_(None),
            LunchBalanceTransaction.created_at >= start_utc,
            LunchBalanceTransaction.created_at <= end_utc,
        )
        .scalar()
    )
    return vote_total + _decimal(manual_total)


def parse_month_param(value: str) -> tuple[int, int]:
    """Parse YYYY-MM into (year, month)."""
    parts = (value or "").strip().split("-")
    if len(parts) != 2:
        raise ValueError("Invalid month")
    year = int(parts[0])
    month = int(parts[1])
    if month < 1 or month > 12:
        raise ValueError("Invalid month")
    return year, month


def _apply_balance_change(
    user: User,
    amount: Decimal,
    reason: str,
    *,
    created_by: str | None,
    reference_vote_id: str | None = None,
) -> LunchBalanceTransaction:
    if amount == 0:
        raise ValueError("No balance change")
    user.lunch_balance = get_user_balance(user) + amount
    tx = LunchBalanceTransaction(
        user_id=user.id,
        amount=amount,
        reason=reason,
        reference_vote_id=reference_vote_id,
        created_by=created_by,
    )
    db.session.add(tx)
    return tx


def _poll_affects_wallet(poll: LunchPoll) -> bool:
    """Only votes on polls in the current Dhaka calendar month update wallet balance."""
    if not poll.poll_date:
        return True
    today = dhaka_today()
    return poll.poll_date.year == today.year and poll.poll_date.month == today.month


def _set_vote_balance_change(vote: LunchVote, option: LunchPollOption, poll: LunchPoll) -> None:
    vote.balance_change = balance_change_for_option(option.option_type, poll.cost_amount)


def _reverse_vote_balance(vote: LunchVote, *, actor_id: str | None) -> None:
    if vote.balance_change is None or _decimal(vote.balance_change) == 0:
        return
    user = User.query.get(vote.user_id)
    if not user:
        return
    reversal = -_decimal(vote.balance_change)
    _apply_balance_change(
        user,
        reversal,
        f"Reversed vote on {vote.poll.poll_date.isoformat() if vote.poll and vote.poll.poll_date else 'poll'}",
        created_by=actor_id,
        reference_vote_id=vote.id,
    )
    vote.balance_change = None


def _apply_vote_balance(vote: LunchVote, option: LunchPollOption, *, actor_id: str | None) -> None:
    poll = vote.poll or LunchPoll.query.get(vote.poll_id)
    if not poll:
        return
    change = balance_change_for_option(option.option_type, poll.cost_amount)
    vote.balance_change = change
    if change == 0:
        return
    user = User.query.get(vote.user_id)
    if not user:
        return
    _apply_balance_change(
        user,
        change,
        f"Lunch vote: {option.label} ({poll.poll_date.isoformat()})",
        created_by=actor_id,
        reference_vote_id=vote.id,
    )


def list_polls(*, from_date=None, to_date=None, status: str = "") -> list[LunchPoll]:
    q = LunchPoll.query
    if from_date:
        q = q.filter(LunchPoll.poll_date >= from_date)
    if to_date:
        q = q.filter(LunchPoll.poll_date <= to_date)
    if status:
        q = q.filter(LunchPoll.status == status.strip().lower())
    return q.order_by(LunchPoll.poll_date.desc(), LunchPoll.created_at.desc(), LunchPoll.id.desc()).all()


def get_poll(poll_id: str) -> LunchPoll | None:
    return LunchPoll.query.get(poll_id)


def count_polls_by_date(poll_date: date) -> int:
    return LunchPoll.query.filter_by(poll_date=poll_date).count()


def list_polls_by_date(poll_date: date) -> list[LunchPoll]:
    return (
        LunchPoll.query.filter_by(poll_date=poll_date)
        .order_by(LunchPoll.created_at.desc(), LunchPoll.id.desc())
        .all()
    )


def get_poll_by_date(poll_date: date) -> LunchPoll | None:
    """Most recent poll for a date (legacy). Prefer list_polls_by_date when multiple polls exist."""
    return LunchPoll.query.filter_by(poll_date=poll_date).order_by(LunchPoll.created_at.desc()).first()


def get_today_polls() -> list[LunchPoll]:
    polls = list_polls_by_date(dhaka_today())
    return [refresh_poll_expiry(p) for p in polls]


def get_today_poll() -> LunchPoll | None:
    polls = get_today_polls()
    return polls[0] if polls else None


def _parse_end_time(value) -> str | None:
    if value is None or str(value).strip() == "":
        return None
    raw = str(value).strip()
    parts = raw.split(":")
    if len(parts) != 2:
        raise ValueError("Invalid end time; use HH:MM")
    try:
        h, m = int(parts[0]), int(parts[1])
    except ValueError as exc:
        raise ValueError("Invalid end time; use HH:MM") from exc
    if h < 0 or h > 23 or m < 0 or m > 59:
        raise ValueError("Invalid end time; use HH:MM")
    return f"{h:02d}:{m:02d}"


def is_poll_expired(poll: LunchPoll) -> bool:
    from datetime import timezone

    end_utc = poll.resolve_end_utc()
    if not end_utc:
        return False
    return datetime.now(timezone.utc) >= end_utc


def refresh_poll_expiry(poll: LunchPoll) -> LunchPoll:
    if poll.status == "active" and is_poll_expired(poll):
        return set_poll_status(poll, "closed")
    return poll


def _validate_options_payload(options: list) -> list[dict]:
    if not options or not isinstance(options, list):
        raise ValueError("At least one menu option is required")
    parsed = []
    for i, raw in enumerate(options):
        if not isinstance(raw, dict):
            raise ValueError("Invalid option payload")
        label = (raw.get("label") or "").strip()
        if not label:
            raise ValueError("Each option must have a label")
        option_type = (raw.get("optionType") or raw.get("option_type") or "office").strip().lower()
        if option_type not in ("office", "personal", "off"):
            raise ValueError(f"Invalid option type: {option_type}")
        parsed.append(
            {
                "label": label[:200],
                "option_type": option_type,
                "order_index": int(raw.get("orderIndex") if raw.get("orderIndex") is not None else i),
            }
        )
    return parsed


def _validate_option_update_payload(raw: dict) -> dict:
    opt_id = (raw.get("id") or "").strip()
    if not opt_id:
        raise ValueError("Option id is required")
    label = (raw.get("label") or "").strip()
    if not label:
        raise ValueError("Each option must have a label")
    option_type = (raw.get("optionType") or raw.get("option_type") or "office").strip().lower()
    if option_type not in ("office", "personal", "off"):
        raise ValueError(f"Invalid option type: {option_type}")
    return {"id": opt_id, "label": label[:200], "option_type": option_type}


def _update_poll_option_fields(poll: LunchPoll, option_updates: list, *, actor_id: str | None = None) -> None:
    if not option_updates:
        return
    if not isinstance(option_updates, list):
        raise ValueError("Invalid optionUpdates payload")

    existing_by_id = {o.id: o for o in poll.options}
    seen_ids: set[str] = set()

    for raw in option_updates:
        if not isinstance(raw, dict):
            raise ValueError("Invalid option update payload")
        parsed = _validate_option_update_payload(raw)
        opt_id = parsed["id"]
        if opt_id in seen_ids:
            raise ValueError("Duplicate option id in update")
        seen_ids.add(opt_id)

        opt = existing_by_id.get(opt_id)
        if not opt:
            raise ValueError("Invalid menu option id")

        type_changed = opt.option_type != parsed["option_type"]
        label_changed = opt.label != parsed["label"]
        if not type_changed and not label_changed:
            continue

        if type_changed:
            votes = list(opt.votes)
            for vote in votes:
                _reverse_vote_balance(vote, actor_id=actor_id)
            opt.option_type = parsed["option_type"]
            opt.label = parsed["label"]
            for vote in votes:
                _apply_vote_balance(vote, opt, actor_id=actor_id)
        else:
            opt.label = parsed["label"]


def create_poll(
    user: User,
    *,
    poll_date: date,
    title: str,
    cost_amount,
    allow_vote_change: bool,
    end_time: str | None = None,
    options: list,
) -> LunchPoll:
    settings = get_or_create_settings()
    parsed_options = _validate_options_payload(options)
    parsed_end_time = _parse_end_time(end_time)
    poll = LunchPoll(
        poll_date=poll_date,
        title=(title or "Today's Lunch").strip()[:255],
        status="active",
        cost_amount=_decimal(cost_amount if cost_amount is not None else settings.default_cost_amount),
        allow_vote_change=bool(allow_vote_change),
        end_time=parsed_end_time,
        created_by=user.id,
    )
    db.session.add(poll)
    db.session.flush()
    for opt in parsed_options:
        db.session.add(
            LunchPollOption(
                poll_id=poll.id,
                label=opt["label"],
                option_type=opt["option_type"],
                order_index=opt["order_index"],
            )
        )
    db.session.commit()
    return poll


def update_poll(
    poll: LunchPoll,
    *,
    title: str | None = None,
    cost_amount=None,
    allow_vote_change: bool | None = None,
    end_time: str | None = None,
    extend_minutes: int | None = None,
    options: list | None = None,
    option_updates: list | None = None,
    actor_id: str | None = None,
) -> LunchPoll:
    from datetime import timezone

    end_time_changed = False
    if title is not None:
        poll.title = title.strip()[:255]
    if cost_amount is not None:
        poll.cost_amount = _decimal(cost_amount)
    if allow_vote_change is not None:
        poll.allow_vote_change = bool(allow_vote_change)
    if extend_minutes is not None:
        try:
            minutes = int(extend_minutes)
        except (TypeError, ValueError) as exc:
            raise ValueError("Invalid extendMinutes") from exc
        if minutes <= 0:
            raise ValueError("extendMinutes must be positive")
        end_local = datetime.now(DHAKA) + timedelta(minutes=minutes)
        poll.ends_at = end_local.astimezone(timezone.utc).replace(tzinfo=None)
        poll.end_time = f"{end_local.hour:02d}:{end_local.minute:02d}"
        end_time_changed = True
    elif end_time is not None:
        new_end_time = _parse_end_time(end_time)
        end_time_changed = new_end_time != poll.end_time
        if end_time_changed:
            poll.end_time = new_end_time
            poll.ends_at = None
            if poll.poll_date == dhaka_today():
                try:
                    h, m = map(int, new_end_time.split(":"))
                except (ValueError, TypeError) as exc:
                    raise ValueError("Invalid end time; use HH:MM") from exc
                end_local = datetime(
                    poll.poll_date.year, poll.poll_date.month, poll.poll_date.day, h, m, tzinfo=DHAKA
                )
                if datetime.now(DHAKA) >= end_local:
                    raise ValueError("End time must be in the future")
    if option_updates is not None and options is not None:
        raise ValueError("Cannot send both options and optionUpdates")
    if option_updates is not None:
        _update_poll_option_fields(poll, option_updates, actor_id=actor_id)
    elif options is not None:
        if poll.votes.count() > 0:
            raise ValueError("Cannot replace options after votes have been cast")
        parsed = _validate_options_payload(options)
        LunchPollOption.query.filter_by(poll_id=poll.id).delete()
        for opt in parsed:
            db.session.add(
                LunchPollOption(
                    poll_id=poll.id,
                    label=opt["label"],
                    option_type=opt["option_type"],
                    order_index=opt["order_index"],
                )
            )
    poll.updated_at = datetime.utcnow()
    db.session.commit()
    db.session.refresh(poll)
    if end_time_changed and not is_poll_expired(poll) and poll.status != "active":
        return set_poll_status(poll, "active")
    return poll


def set_poll_status(poll: LunchPoll, status: str) -> LunchPoll:
    s = (status or "").strip().lower()
    if s not in ("active", "closed"):
        raise ValueError("Status must be active or closed")
    poll.status = s
    poll.updated_at = datetime.utcnow()
    db.session.commit()
    return poll


def delete_poll(poll: LunchPoll) -> None:
    vote_ids = [vote.id for vote in poll.votes]
    for vote in poll.votes:
        _reverse_vote_balance(vote, actor_id=None)
    if vote_ids:
        LunchBalanceTransaction.query.filter(
            LunchBalanceTransaction.reference_vote_id.in_(vote_ids)
        ).update({LunchBalanceTransaction.reference_vote_id: None}, synchronize_session=False)
    db.session.delete(poll)
    db.session.commit()


def get_user_vote(poll_id: str, user_id: str) -> LunchVote | None:
    """Load the user's vote for a poll from DB (populate_existing avoids stale identity map)."""
    vote = (
        LunchVote.query.filter_by(poll_id=poll_id, user_id=user_id)
        .execution_options(populate_existing=True)
        .order_by(LunchVote.updated_at.desc(), LunchVote.voted_at.desc())
        .first()
    )
    if vote:
        db.session.refresh(vote)
        db.session.expire(vote, ["option"])
    return vote


def _vote_last_action_at(vote: LunchVote) -> datetime:
    """When the user last cast or changed this vote."""
    return vote.updated_at or vote.voted_at or datetime.min


def cast_or_update_vote(user: User, poll: LunchPoll, option_id: str) -> LunchVote:
    poll = refresh_poll_expiry(poll)
    if poll.status != "active":
        raise ValueError("This poll is closed")
    option = LunchPollOption.query.filter_by(id=option_id, poll_id=poll.id).first()
    if not option:
        raise ValueError("Invalid menu option")

    existing = get_user_vote(poll.id, user.id)
    if existing and not poll.allow_vote_change:
        raise ValueError("Vote changes are not allowed for this poll")
    if existing and existing.option_id == option_id:
        return existing

    return _persist_vote_change(
        poll=poll,
        target_user=user,
        option=option,
        existing=existing,
        actor_id=user.id,
    )


def admin_set_user_vote(admin: User, target_user_id: str, poll: LunchPoll, option_id: str) -> LunchVote:
    """Admin override: set or change a user's vote regardless of poll status."""
    target = User.query.get(target_user_id)
    if not target:
        raise ValueError("User not found")
    option = LunchPollOption.query.filter_by(id=option_id, poll_id=poll.id).first()
    if not option:
        raise ValueError("Invalid menu option")

    existing = get_user_vote(poll.id, target.id)
    if existing and existing.option_id == option_id:
        return existing

    return _persist_vote_change(
        poll=poll,
        target_user=target,
        option=option,
        existing=existing,
        actor_id=admin.id,
        affect_wallet=_poll_affects_wallet(poll),
    )


def _persist_vote_change(
    *,
    poll: LunchPoll,
    target_user: User,
    option: LunchPollOption,
    existing: LunchVote | None,
    actor_id: str | None,
    affect_wallet: bool = True,
) -> LunchVote:
    try:
        if existing:
            if affect_wallet:
                _reverse_vote_balance(existing, actor_id=actor_id)
            else:
                existing.balance_change = None
            existing.option_id = option.id
            now = datetime.utcnow()
            existing.updated_at = now
            existing.voted_at = now
            if affect_wallet:
                _apply_vote_balance(existing, option, actor_id=actor_id)
            else:
                _set_vote_balance_change(existing, option, poll)
            db.session.commit()
            db.session.refresh(existing)
            return existing

        vote = LunchVote(poll_id=poll.id, user_id=target_user.id, option_id=option.id)
        db.session.add(vote)
        db.session.flush()
        if affect_wallet:
            _apply_vote_balance(vote, option, actor_id=actor_id)
        else:
            _set_vote_balance_change(vote, option, poll)
        db.session.commit()
        db.session.refresh(vote)
        return vote
    except Exception:
        db.session.rollback()
        raise


def get_user_period_net_change(user_id: str, from_date: date, to_date: date) -> Decimal:
    """Net lunch balance change for a poll-date range (votes + manual adjustments)."""
    vote_total = sum_vote_balance_changes_by_user(from_date=from_date, to_date=to_date).get(user_id, Decimal("0"))
    from datetime import timezone

    start_utc = datetime.combine(from_date, datetime.min.time(), tzinfo=DHAKA).astimezone(timezone.utc).replace(
        tzinfo=None
    )
    end_utc = datetime.combine(to_date, datetime.max.time(), tzinfo=DHAKA).astimezone(timezone.utc).replace(
        tzinfo=None
    )
    manual_total = (
        db.session.query(func.coalesce(func.sum(LunchBalanceTransaction.amount), 0))
        .filter(
            LunchBalanceTransaction.user_id == user_id,
            LunchBalanceTransaction.reference_vote_id.is_(None),
            LunchBalanceTransaction.created_at >= start_utc,
            LunchBalanceTransaction.created_at <= end_utc,
        )
        .scalar()
    )
    return vote_total + _decimal(manual_total)


def get_admin_user_period_detail(
    user_id: str,
    *,
    from_date: date,
    to_date: date,
    period_label: str | None = None,
) -> dict:
    """Polls in a date range with options and the user's current vote per poll."""
    target = User.query.get(user_id)
    if not target:
        raise ValueError("User not found")

    polls = sorted(list_polls(from_date=from_date, to_date=to_date), key=lambda p: p.poll_date, reverse=True)
    poll_ids = [p.id for p in polls]
    votes = (
        LunchVote.query.filter(LunchVote.user_id == user_id, LunchVote.poll_id.in_(poll_ids)).all()
        if poll_ids
        else []
    )
    vote_by_poll = {v.poll_id: v for v in votes}

    items = []
    for poll in polls:
        vote = vote_by_poll.get(poll.id)
        opt = vote.option if vote else None
        items.append(
            {
                "pollId": poll.id,
                "pollDate": poll.poll_date.isoformat() if poll.poll_date else None,
                "pollTitle": poll.title or "",
                "costAmount": float(poll.cost_amount or 0),
                "status": poll.status or "active",
                "options": [o.to_dict() for o in poll.options],
                "voteId": vote.id if vote else None,
                "optionId": vote.option_id if vote else None,
                "optionLabel": opt.label if opt else None,
                "optionType": opt.option_type if opt else None,
                "balanceChange": float(vote.balance_change) if vote and vote.balance_change is not None else None,
            }
        )

    return {
        "userId": target.id,
        "userName": target.name,
        "email": target.email,
        "from": from_date.isoformat(),
        "to": to_date.isoformat(),
        "periodLabel": period_label,
        "balance": float(get_user_balance(target)),
        "periodNetChange": float(get_user_period_net_change(user_id, from_date, to_date)),
        "items": items,
    }


def get_admin_user_month_detail(user_id: str, year: int, month: int) -> dict:
    """Polls in a calendar month with options and the user's current vote per poll."""
    start, end = month_date_bounds(year, month)
    result = get_admin_user_period_detail(
        user_id,
        from_date=start,
        to_date=end,
        period_label=f"{year:04d}-{month:02d}",
    )
    result["month"] = f"{year:04d}-{month:02d}"
    result["monthNetChange"] = result["periodNetChange"]
    return result


def poll_summary(poll: LunchPoll, *, include_balance_changes: bool = False) -> dict:
    counts: dict[str, int] = {}
    by_option: list[dict] = []
    voters: list[dict] = []
    office_order_count = 0

    # Always read votes from DB — poll.votes relationship can be stale after admin edits.
    votes = LunchVote.query.filter_by(poll_id=poll.id).all()
    option_labels = {opt.id: opt for opt in poll.options}

    user_names = {
        u.id: u.name
        for u in User.query.filter(User.id.in_([v.user_id for v in votes] or [""])).all()
    }

    for opt in poll.options:
        opt_votes = [v for v in votes if v.option_id == opt.id]
        vote_count = len(opt_votes)
        counts[opt.label] = vote_count
        by_option.append(
            {
                "optionId": opt.id,
                "label": opt.label,
                "optionType": opt.option_type,
                "count": vote_count,
                "voters": [
                    {"userId": v.user_id, "userName": user_names.get(v.user_id, "Unknown")}
                    for v in sorted(opt_votes, key=lambda x: user_names.get(x.user_id) or "")
                ],
            }
        )
        if opt.option_type == "office":
            office_order_count += vote_count

    for vote in sorted(votes, key=lambda v: (user_names.get(v.user_id) or "", _vote_last_action_at(v))):
        opt = option_labels.get(vote.option_id) or vote.option
        last_action = _vote_last_action_at(vote)
        row = {
            "userId": vote.user_id,
            "userName": user_names.get(vote.user_id, "Unknown"),
            "optionId": vote.option_id,
            "optionLabel": opt.label if opt else "",
            "optionType": opt.option_type if opt else "",
            "votedAt": last_action.isoformat() + "Z" if last_action != datetime.min else None,
        }
        if include_balance_changes:
            row["balanceChange"] = float(vote.balance_change) if vote.balance_change is not None else None
        voters.append(row)

    total = len(votes)
    return {
        "poll": poll.to_dict(include_options=True),
        "countsByLabel": counts,
        "options": by_option,
        "voters": voters,
        "totalVotes": total,
        "officeOrderCount": office_order_count,
    }


def list_vote_history(
    *,
    user_id: str | None = None,
    from_date=None,
    to_date=None,
    option_type: str = "",
    limit: int = 500,
) -> dict:
    q = (
        db.session.query(
            LunchVote,
            User.name,
            LunchPollOption.label,
            LunchPollOption.option_type,
            LunchPoll.poll_date,
            LunchPoll.title,
        )
        .join(User, LunchVote.user_id == User.id)
        .join(LunchPollOption, LunchVote.option_id == LunchPollOption.id)
        .join(LunchPoll, LunchVote.poll_id == LunchPoll.id)
    )
    if user_id:
        q = q.filter(LunchVote.user_id == user_id)
    if from_date:
        q = q.filter(LunchPoll.poll_date >= from_date)
    if to_date:
        q = q.filter(LunchPoll.poll_date <= to_date)
    if option_type:
        q = q.filter(LunchPollOption.option_type == option_type.strip().lower())
    rows = q.order_by(LunchPoll.poll_date.desc(), LunchVote.updated_at.desc()).limit(limit * 2).all()

    # One entry per poll (per user when listing all employees)
    by_poll: dict[tuple, tuple] = {}
    for row in rows:
        vote, user_name, opt_label, opt_type, poll_date, poll_title = row
        key = (vote.user_id, vote.poll_id) if not user_id else (vote.poll_id,)
        prev = by_poll.get(key)
        if prev is None:
            by_poll[key] = row
            continue
        prev_vote = prev[0]
        prev_ts = prev_vote.updated_at or prev_vote.voted_at or datetime.min
        cur_ts = vote.updated_at or vote.voted_at or datetime.min
        if cur_ts >= prev_ts:
            by_poll[key] = row

    def _history_row_sort_key(row: tuple) -> tuple:
        vote, *_rest, poll_date, _poll_title = row
        action_at = vote.updated_at or vote.voted_at or datetime.min
        return (poll_date or date.min, action_at)

    rows = sorted(by_poll.values(), key=_history_row_sort_key, reverse=True)[:limit]

    results = []
    total_balance_change = Decimal("0")
    running_by_user: dict[str, Decimal] = {}
    if user_id:
        user = User.query.get(user_id)
        if user:
            running_by_user[user_id] = get_user_balance(user)

    for vote, user_name, opt_label, opt_type, poll_date, poll_title in rows:
        rb = None
        if user_id and vote.user_id == user_id:
            rb = float(running_by_user.get(user_id, Decimal("0")))
            if vote.balance_change is not None:
                running_by_user[user_id] = running_by_user[user_id] - _decimal(vote.balance_change)
        if vote.balance_change is not None:
            total_balance_change += _decimal(vote.balance_change)
        results.append(
            vote.to_dict(
                user_name=user_name,
                option_label=opt_label,
                option_type=opt_type,
                poll_date=poll_date,
                poll_title=poll_title,
            )
            | {"runningBalance": rb}
        )
    return {
        "items": results,
        "totalBalanceChange": float(total_balance_change),
    }


def list_balance_transactions(
    *,
    user_id: str | None = None,
    from_date=None,
    to_date=None,
    limit: int = 500,
) -> list[dict]:
    q = LunchBalanceTransaction.query
    if user_id:
        q = q.filter_by(user_id=user_id)
    if from_date:
        q = q.filter(LunchBalanceTransaction.created_at >= datetime.combine(from_date, datetime.min.time()))
    if to_date:
        q = q.filter(LunchBalanceTransaction.created_at <= datetime.combine(to_date, datetime.max.time()))
    rows = q.order_by(LunchBalanceTransaction.created_at.desc()).limit(limit).all()

    user_names = {u.id: u.name for u in User.query.filter(User.id.in_([r.user_id for r in rows] or [""])).all()}

    if user_id:
        user = User.query.get(user_id)
        balance = get_user_balance(user) if user else Decimal("0")
        results = []
        for tx in rows:
            results.append(tx.to_dict(user_name=user_names.get(tx.user_id), running_balance=float(balance)))
            balance -= _decimal(tx.amount)
        return results

    return [tx.to_dict(user_name=user_names.get(tx.user_id)) for tx in rows]


def manual_balance_adjustment(
    admin: User,
    target_user_id: str,
    amount,
    reason: str,
) -> dict:
    target = User.query.get(target_user_id)
    if not target:
        raise ValueError("User not found")
    amt = _decimal(amount)
    if amt == 0:
        raise ValueError("Amount cannot be zero")
    note = (reason or "Manual adjustment").strip()[:500]
    tx = _apply_balance_change(target, amt, note, created_by=admin.id)
    db.session.commit()
    return {
        "transaction": tx.to_dict(user_name=target.name),
        "balance": float(get_user_balance(target)),
    }


def sum_vote_balance_changes_by_user(*, from_date=None, to_date=None) -> dict[str, Decimal]:
    """Latest vote per user per poll day, summed by user."""
    q = db.session.query(LunchVote, LunchPoll.poll_date).join(LunchPoll, LunchVote.poll_id == LunchPoll.id)
    if from_date:
        q = q.filter(LunchPoll.poll_date >= from_date)
    if to_date:
        q = q.filter(LunchPoll.poll_date <= to_date)
    rows = q.order_by(LunchPoll.poll_date.desc(), LunchVote.updated_at.desc()).all()

    by_day: dict[tuple, LunchVote] = {}
    for vote, poll_date in rows:
        key = (vote.user_id, vote.poll_id)
        prev = by_day.get(key)
        if prev is None:
            by_day[key] = vote
            continue
        prev_ts = prev.updated_at or prev.voted_at or datetime.min
        cur_ts = vote.updated_at or vote.voted_at or datetime.min
        if cur_ts >= prev_ts:
            by_day[key] = vote

    totals: dict[str, Decimal] = {}
    for (user_id, _), vote in by_day.items():
        if vote.balance_change is None:
            continue
        totals[user_id] = totals.get(user_id, Decimal("0")) + _decimal(vote.balance_change)
    return totals


def list_employee_balances(*, from_date=None, to_date=None) -> dict:
    rows = User.query.filter_by(is_active=True).order_by(User.name.asc()).all()
    period_totals: dict[str, Decimal] = {}
    include_period = bool(from_date and to_date)
    if include_period:
        period_totals = sum_vote_balance_changes_by_user(from_date=from_date, to_date=to_date)

    items = []
    total_period = Decimal("0")
    for u in rows:
        item = {
            "userId": u.id,
            "userName": u.name,
            "email": u.email,
            "balance": float(get_user_balance(u)),
        }
        if include_period:
            change = period_totals.get(u.id, Decimal("0"))
            item["periodBalanceChange"] = float(change)
            total_period += change
        items.append(item)

    result: dict = {"items": items}
    if include_period:
        result["totalPeriodBalanceChange"] = float(total_period)
        result["from"] = from_date.isoformat()
        result["to"] = to_date.isoformat()
    return result


def admin_dashboard() -> dict:
    today = dhaka_today()
    today_polls = get_today_polls()
    total_users = User.query.filter_by(is_active=True).count()
    data = {
        "today": today.isoformat(),
        "hasActivePoll": any(p.status == "active" for p in today_polls),
        "todayPoll": None,
        "totalVotesToday": 0,
        "officeOrderCount": 0,
        "activePolls": LunchPoll.query.filter_by(status="active").count(),
    }
    if today_polls:
        first_summary = poll_summary(today_polls[0], include_balance_changes=True)
        data["todayPoll"] = first_summary["poll"]
        for poll in today_polls:
            summary = poll_summary(poll, include_balance_changes=True)
            data["totalVotesToday"] += summary["totalVotes"]
            data["officeOrderCount"] += summary["officeOrderCount"]
        data["options"] = first_summary["options"]
    return data


def _vote_updated_at_iso(vote: LunchVote) -> str | None:
    last = _vote_last_action_at(vote)
    if not last:
        return None
    return last.isoformat() + "Z"


def _snapshot_my_vote(vote: LunchVote | None, poll: LunchPoll) -> dict | None:
    """my_vote from DB for the logged-in user — never derived on the client."""
    if not vote:
        return None
    opt = vote.option or LunchPollOption.query.get(vote.option_id)
    if opt and opt.id != vote.option_id:
        opt = LunchPollOption.query.get(vote.option_id)
    updated = _vote_updated_at_iso(vote)
    return {
        "optionId": vote.option_id,
        "option_id": vote.option_id,
        "optionName": opt.label if opt else None,
        "option_name": opt.label if opt else None,
        "optionType": opt.option_type if opt else None,
        "updatedAt": updated,
        "updated_at": updated,
        "id": vote.id,
        "pollId": vote.poll_id,
        "userId": vote.user_id,
        "balanceChange": float(vote.balance_change) if vote.balance_change is not None else None,
    }


def build_user_lunch_snapshot(
    user: User,
    *,
    poll_date: date | None = None,
    month: str | None = None,
) -> dict:
    """
    Single source of truth for the user lunch page.
    my_vote is always read from the database for the logged-in user.
    """
    target_date = poll_date or dhaka_today()
    if month:
        year, mon = parse_month_param(month)
    else:
        year, mon = target_date.year, target_date.month
    month_key = f"{year:04d}-{mon:02d}"

    polls = [refresh_poll_expiry(p) for p in list_polls_by_date(target_date)]
    items = []
    for poll in polls:
        summary = poll_summary(poll)
        total = summary.get("totalVotes") or 0
        count_by_id = {row["optionId"]: row for row in (summary.get("options") or [])}
        options = []
        for opt in sorted(poll.options, key=lambda o: (o.order_index or 0, o.label or "")):
            row = count_by_id.get(opt.id) or {}
            count = int(row.get("count") or 0)
            pct = round((count / total) * 100, 1) if total else 0.0
            options.append(
                {
                    "id": opt.id,
                    "name": opt.label or "",
                    "label": opt.label or "",
                    "optionType": opt.option_type or "office",
                    "orderIndex": opt.order_index or 0,
                    "count": count,
                    "percentage": pct,
                    "voters": row.get("voters") or [],
                }
            )
        my_vote_row = get_user_vote(poll.id, user.id)
        my_vote = _snapshot_my_vote(my_vote_row, poll)
        poll_dict = poll.to_dict(include_options=True)
        poll_dict["options"] = options
        poll_dict["totalVotes"] = total
        items.append(
            {
                "poll": poll_dict,
                "myVote": my_vote,
                "my_vote": my_vote,
                "selectedOptionId": my_vote["optionId"] if my_vote else None,
                "results": summary,
            }
        )

    first = items[0] if items else None
    month_net = float(get_user_month_net_change(user.id, year, mon))
    wallet_balance = float(get_user_balance(user))
    month_status = "credit" if month_net > 0 else "debit" if month_net < 0 else "neutral"

    # Month-scoped vote history for the page (DB source of truth).
    start = date(year, mon, 1)
    end = date(year, mon, monthrange(year, mon)[1])
    history = list_vote_history(user_id=user.id, from_date=start, to_date=end, limit=100)

    month_total = {
        "month": month_key,
        "amount": month_net,
        "wallet": wallet_balance,
        "status": month_status,
    }

    return {
        "date": target_date.isoformat(),
        "month": month_key,
        "items": items,
        "poll": first["poll"] if first else None,
        "myVote": first["myVote"] if first else None,
        "my_vote": first["my_vote"] if first else None,
        "results": first["results"] if first else None,
        "monthTotal": month_total,
        "month_total": month_total,
        "balance": wallet_balance,
        "monthNetChange": month_net,
        "voteHistory": history.get("items") or [],
        "vote_history": history.get("items") or [],
    }


def build_lunch_vote_updated_event(vote: LunchVote, poll: LunchPoll, target_user: User) -> dict:
    """SSE signal only — clients must refetch GET /api/lunch/me/snapshot for UI state."""
    today = dhaka_today()
    month_key = f"{today.year:04d}-{today.month:02d}"
    return {
        "event": "lunch_vote_updated",
        "data": {
            "date": poll.poll_date.isoformat() if poll.poll_date else today.isoformat(),
            "month": month_key,
            "affectedUserId": target_user.id,
            "affected_user_id": target_user.id,
            "pollId": poll.id,
            "updatedAt": _vote_updated_at_iso(vote),
            "updated_at": _vote_updated_at_iso(vote),
        },
    }


def emit_lunch_vote_updated(vote: LunchVote, poll: LunchPoll, target_user: User) -> None:
    """Broadcast vote change to all connected lunch clients."""
    from app import db
    from app.services.lunch_realtime_service import broadcast_lunch_event

    db.session.refresh(vote)
    db.session.expire(vote, ["option"])
    refreshed_poll = get_poll(poll.id)
    if refreshed_poll:
        db.session.expire(refreshed_poll, ["votes", "options"])

    broadcast_lunch_event(build_lunch_vote_updated_event(vote, refreshed_poll or poll, target_user))
