"""Attendance period date ranges (work week: Sunday through Thursday)."""
from datetime import date, timedelta

# Python weekday(): Monday=0 … Sunday=6
WORK_WEEK_LENGTH_DAYS = 5  # Sunday → Thursday


def days_since_work_week_start(d: date) -> int:
    """Days elapsed since the Sunday that starts the current work week."""
    return (d.weekday() + 1) % 7


def current_work_week_range(today: date) -> tuple[date, date]:
    """Inclusive range for the current work week (Sunday through today or Thursday)."""
    start = today - timedelta(days=days_since_work_week_start(today))
    end = min(today, start + timedelta(days=WORK_WEEK_LENGTH_DAYS - 1))
    return start, end


def previous_work_week_range(today: date) -> tuple[date, date]:
    """Inclusive range for the previous work week (Sunday through Thursday)."""
    days = days_since_work_week_start(today)
    current_sunday = today - timedelta(days=days)
    start = current_sunday - timedelta(days=7)
    end = start + timedelta(days=WORK_WEEK_LENGTH_DAYS - 1)
    return start, end
