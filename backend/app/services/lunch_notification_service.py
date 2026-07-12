"""In-app notifications for Lunch module events."""
from __future__ import annotations

from app.lunch_models import LunchPoll
from app.models import User
from app.notification_service import notification_service
from app.rbac_utils import PAGE_KEY_LUNCH, can_access_page


def list_lunch_module_user_ids() -> list[str]:
    """Active users with Lunch module access (RBAC user/admin or global admin)."""
    users = User.query.filter_by(is_active=True).order_by(User.name.asc()).all()
    return [u.id for u in users if can_access_page(u, PAGE_KEY_LUNCH)]


def notify_lunch_poll_created(*, poll: LunchPoll, creator: User) -> None:
    """Notify all Lunch users when an admin posts a new poll."""
    creator_id = creator.id
    creator_name = (creator.name or "An admin").strip() or "An admin"
    poll_title = (poll.title or "Today's Lunch").strip() or "Today's Lunch"
    poll_date = poll.poll_date.isoformat() if poll.poll_date else "today"

    recipient_ids = [uid for uid in list_lunch_module_user_ids() if uid != creator_id]
    if not recipient_ids:
        return

    notification_service.create_notifications_bulk(
        [
            {
                "user_id": user_id,
                "title": "Lunch · New poll",
                "message": f'{creator_name} posted "{poll_title}" for {poll_date}. Open Lunch to vote.',
                "n_type": "info",
                "category": "lunch",
            }
            for user_id in recipient_ids
        ]
    )


def notify_admin_vote_changed(
    *,
    admin: User,
    target: User,
    poll: LunchPoll,
    option_label: str,
) -> None:
    """Notify employee when an admin sets or changes their lunch vote."""
    if not target or not target.is_active:
        return
    admin_name = (admin.name or "An admin").strip() or "An admin"
    poll_title = (poll.title or "Today's Lunch").strip() or "Today's Lunch"
    poll_date = poll.poll_date.isoformat() if poll.poll_date else "today"
    label = (option_label or "a menu option").strip() or "a menu option"

    notification_service.create_notification(
        user_id=target.id,
        title="Lunch · Vote updated",
        message=f'{admin_name} set your vote to "{label}" on "{poll_title}" ({poll_date}).',
        n_type="info",
        category="lunch",
    )
