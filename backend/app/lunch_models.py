"""Lunch ordering & voting module models."""
from datetime import datetime
from zoneinfo import ZoneInfo

from app import db
from app.models import generate_id

DHAKA = ZoneInfo("Asia/Dhaka")


class LunchSettings(db.Model):
    """Singleton-style lunch module settings."""

    __tablename__ = "lunch_settings"
    id = db.Column(db.String(40), primary_key=True, default=lambda: "default")
    default_cost_amount = db.Column(db.Numeric(10, 2), nullable=False, default=65)
    allow_vote_change = db.Column(db.Boolean, nullable=False, default=True)
    updated_by = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "defaultCostAmount": float(self.default_cost_amount or 65),
            "allowVoteChange": bool(self.allow_vote_change),
            "updatedAt": self.updated_at.isoformat() + "Z" if self.updated_at else None,
        }


class LunchPoll(db.Model):
    __tablename__ = "lunch_polls"
    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    poll_date = db.Column(db.Date, nullable=False, index=True)
    title = db.Column(db.String(255), nullable=False, default="Today's Lunch")
    status = db.Column(db.String(20), nullable=False, default="active")  # active | closed
    cost_amount = db.Column(db.Numeric(10, 2), nullable=False, default=65)
    allow_vote_change = db.Column(db.Boolean, nullable=False, default=True)
    end_time = db.Column(db.String(5), nullable=True)  # HH:MM in Asia/Dhaka (display / fallback)
    ends_at = db.Column(db.DateTime, nullable=True)  # UTC naive absolute close time (used when extending)
    created_by = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    options = db.relationship(
        "LunchPollOption",
        back_populates="poll",
        cascade="all, delete-orphan",
        order_by="LunchPollOption.order_index",
    )
    votes = db.relationship("LunchVote", back_populates="poll", cascade="all, delete-orphan")

    def resolve_end_utc(self):
        """Absolute poll close instant in UTC (prefers ends_at when set)."""
        from datetime import timezone

        if self.ends_at:
            return self.ends_at.replace(tzinfo=timezone.utc)
        if not self.end_time or not self.poll_date:
            return None
        try:
            h, m = map(int, (self.end_time or "").split(":"))
        except (ValueError, TypeError):
            return None
        local = datetime(self.poll_date.year, self.poll_date.month, self.poll_date.day, h, m, tzinfo=DHAKA)
        return local.astimezone(ZoneInfo("UTC"))

    def ends_at_utc(self):
        return self.resolve_end_utc()

    def to_dict(self, *, include_options=False, vote_counts=None):
        ends_at = self.resolve_end_utc()
        d = {
            "id": self.id,
            "date": self.poll_date.isoformat() if self.poll_date else None,
            "title": self.title or "",
            "status": self.status or "active",
            "costAmount": float(self.cost_amount or 0),
            "allowVoteChange": bool(self.allow_vote_change),
            "endTime": self.end_time,
            "endsAt": ends_at.strftime("%Y-%m-%dT%H:%M:%SZ") if ends_at else None,
            "createdBy": self.created_by,
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() + "Z" if self.updated_at else None,
        }
        if include_options:
            d["options"] = [o.to_dict() for o in self.options]
        if vote_counts is not None:
            d["voteCounts"] = vote_counts
        return d


class LunchPollOption(db.Model):
    __tablename__ = "lunch_poll_options"
    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    poll_id = db.Column(db.String(40), db.ForeignKey("lunch_polls.id", ondelete="CASCADE"), nullable=False, index=True)
    label = db.Column(db.String(200), nullable=False)
    option_type = db.Column(db.String(20), nullable=False, default="office")  # office | personal | off
    order_index = db.Column(db.Integer, nullable=False, default=0)

    poll = db.relationship("LunchPoll", back_populates="options")
    votes = db.relationship("LunchVote", back_populates="option")

    def to_dict(self):
        return {
            "id": self.id,
            "pollId": self.poll_id,
            "label": self.label or "",
            "optionType": self.option_type or "office",
            "orderIndex": self.order_index or 0,
        }


class LunchVote(db.Model):
    __tablename__ = "lunch_votes"
    __table_args__ = (db.UniqueConstraint("poll_id", "user_id", name="uq_lunch_votes_poll_user"),)

    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    poll_id = db.Column(db.String(40), db.ForeignKey("lunch_polls.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=False, index=True)
    option_id = db.Column(
        db.String(40), db.ForeignKey("lunch_poll_options.id", ondelete="CASCADE"), nullable=False, index=True
    )
    balance_change = db.Column(db.Numeric(10, 2), nullable=True)
    voted_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    poll = db.relationship("LunchPoll", back_populates="votes")
    option = db.relationship("LunchPollOption", back_populates="votes")

    def to_dict(self, *, user_name=None, option_label=None, option_type=None, poll_date=None, poll_title=None):
        return {
            "id": self.id,
            "pollId": self.poll_id,
            "userId": self.user_id,
            "userName": user_name,
            "optionId": self.option_id,
            "optionLabel": option_label,
            "optionType": option_type,
            "pollDate": poll_date.isoformat() if poll_date else None,
            "pollTitle": poll_title,
            "balanceChange": float(self.balance_change) if self.balance_change is not None else None,
            "votedAt": self.voted_at.isoformat() + "Z" if self.voted_at else None,
            "updatedAt": self.updated_at.isoformat() + "Z" if self.updated_at else None,
        }


class LunchBalanceTransaction(db.Model):
    __tablename__ = "lunch_balance_transactions"
    id = db.Column(db.String(40), primary_key=True, default=generate_id)
    user_id = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=False, index=True)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    reason = db.Column(db.String(500), nullable=False, default="")
    reference_vote_id = db.Column(db.String(40), db.ForeignKey("lunch_votes.id"), nullable=True, index=True)
    created_by = db.Column(db.String(40), db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    def to_dict(self, *, user_name=None, running_balance=None):
        return {
            "id": self.id,
            "userId": self.user_id,
            "userName": user_name,
            "amount": float(self.amount or 0),
            "reason": self.reason or "",
            "referenceVoteId": self.reference_vote_id,
            "createdBy": self.created_by,
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
            "runningBalance": float(running_balance) if running_balance is not None else None,
        }
