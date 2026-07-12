"""Tests for PMS comment mention parsing and notifications."""
from app.services.pms_task_notification_service import parse_comment_mention_user_ids


def test_parse_comment_mention_user_ids_dedupes_and_preserves_order():
    comment = (
        "Hey @[Alice](user-a) and @[Bob](user-b) — @[Alice](user-a) again"
    )
    assert parse_comment_mention_user_ids(comment) == ["user-a", "user-b"]


def test_parse_comment_mention_user_ids_empty_when_no_mentions():
    assert parse_comment_mention_user_ids("Hello team") == []
    assert parse_comment_mention_user_ids("") == []
