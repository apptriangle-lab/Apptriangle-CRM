"""Schedule helpers for report automations."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from app.models import Holiday, ReportAutomation, ReportExecutionLog, Shift

ONE_TIME_OVERDUE_SECONDS = 24 * 3600
_MAX_CALENDAR_SCAN_DAYS = 366


def _parse_execution_time(value: str) -> time:
    parts = (value or "09:00").strip().split(":")
    hour = int(parts[0]) if parts else 9
    minute = int(parts[1]) if len(parts) > 1 else 0
    return time(hour=max(0, min(23, hour)), minute=max(0, min(59, minute)))


def _tz(tz_name: str) -> ZoneInfo:
    try:
        return ZoneInfo(tz_name or "UTC")
    except Exception:
        return ZoneInfo("UTC")


def local_now(automation: ReportAutomation) -> datetime:
    return datetime.now(_tz(automation.timezone))


def _automation_shifts(automation: ReportAutomation) -> list[Shift]:
    shift_ids = [link.shift_id for link in automation.shift_links if link.shift_id]
    if not shift_ids:
        return []
    return Shift.query.filter(Shift.id.in_(shift_ids)).all()


def _is_global_holiday(d: date) -> bool:
    return d in Holiday.all_observed_dates()


def _is_weekend_for_all_linked_shifts(automation: ReportAutomation, d: date) -> bool:
    shifts = _automation_shifts(automation)
    if not shifts:
        return False
    weekday = d.weekday()
    for shift in shifts:
        weekend_days = shift.weekend_days if isinstance(shift.weekend_days, list) else []
        if weekday not in weekend_days:
            return False
    return True


def is_non_working_day_for_automation(automation: ReportAutomation, d: date) -> bool:
    """True when automation should not run (global holiday or weekend for every linked shift)."""
    if _is_global_holiday(d):
        return True
    return _is_weekend_for_all_linked_shifts(automation, d)


def _next_working_day_on_or_after(automation: ReportAutomation, from_date: date) -> date:
    d = from_date
    for _ in range(_MAX_CALENDAR_SCAN_DAYS):
        if not is_non_working_day_for_automation(automation, d):
            return d
        d += timedelta(days=1)
    return from_date


def combine_local_date_time(d: date, execution_time: str, tz_name: str) -> datetime:
    t = _parse_execution_time(execution_time)
    return datetime.combine(d, t, tzinfo=_tz(tz_name))


def compute_report_period(automation: ReportAutomation, *, manual: bool = False) -> tuple[date, date]:
    """Return inclusive start/end dates for attendance data."""
    today = local_now(automation).date()
    if manual:
        # Send Now: today's attendance for all employees on selected shifts
        return today, today

    schedule = (automation.schedule_type or "one_time").lower()
    if schedule == "one_time":
        return automation.start_date, automation.start_date
    if schedule == "daily":
        # Daily run at execution time reports the current day
        return today, today
    if schedule == "weekly":
        end = today - timedelta(days=1)
        start = end - timedelta(days=6)
        return start, end
    if schedule == "monthly":
        first_this_month = today.replace(day=1)
        end = first_this_month - timedelta(days=1)
        start = end.replace(day=1)
        return start, end
    return today - timedelta(days=30), today


def _one_time_run_at(automation: ReportAutomation) -> datetime:
    tz = _tz(automation.timezone)
    exec_t = _parse_execution_time(automation.execution_time)
    return datetime.combine(automation.start_date, exec_t, tzinfo=tz)


def _monthly_run_date(year: int, month: int, day: int) -> date:
    try:
        return date(year, month, day)
    except ValueError:
        if month == 12:
            return date(year + 1, 1, 1) - timedelta(days=1)
        return date(year, month + 1, 1) - timedelta(days=1)


def _earliest_run_date(automation: ReportAutomation, today: date) -> date:
    """First calendar day this automation may run on or after today."""
    return max(today, automation.start_date)


def _daily_run_on_or_after(automation: ReportAutomation, from_date: date, exec_t: time, tz) -> datetime:
    run_date = _next_working_day_on_or_after(automation, _earliest_run_date(automation, from_date))
    run_dt = datetime.combine(run_date, exec_t, tzinfo=tz)
    if run_dt <= datetime.now(tz):
        run_dt = datetime.combine(
            _next_working_day_on_or_after(automation, run_date + timedelta(days=1)),
            exec_t,
            tzinfo=tz,
        )
    return run_dt


def _weekly_run_on_or_after(automation: ReportAutomation, from_date: date, exec_t: time, tz) -> datetime:
    target_weekday = automation.start_date.weekday()
    run_date = _earliest_run_date(automation, from_date)
    for _ in range(_MAX_CALENDAR_SCAN_DAYS):
        if run_date.weekday() == target_weekday and not is_non_working_day_for_automation(automation, run_date):
            run_dt = datetime.combine(run_date, exec_t, tzinfo=tz)
            if run_dt > datetime.now(tz):
                return run_dt
        run_date += timedelta(days=1)
    return datetime.combine(run_date, exec_t, tzinfo=tz)


def _monthly_run_on_or_after(automation: ReportAutomation, now_local: datetime, exec_t: time, tz) -> datetime:
    day = automation.start_date.day
    min_date = _earliest_run_date(automation, now_local.date())
    year, month = min_date.year, min_date.month
    while True:
        run_date = _monthly_run_date(year, month, day)
        if run_date >= min_date and not is_non_working_day_for_automation(automation, run_date):
            run_dt = datetime.combine(run_date, exec_t, tzinfo=tz)
            if run_dt > now_local:
                return run_dt
        month += 1
        if month > 12:
            month = 1
            year += 1


def _already_completed_run(automation: ReportAutomation, scheduled_at: datetime) -> bool:
    """True when this scheduled slot already has a successful automatic run."""
    schedule = (automation.schedule_type or "one_time").lower()
    tz = _tz(automation.timezone)

    if schedule == "one_time":
        return (
            ReportExecutionLog.query.filter_by(
                report_automation_id=automation.id,
                status="success",
            ).first()
            is not None
        )

    logs = ReportExecutionLog.query.filter_by(
        report_automation_id=automation.id,
        status="success",
        is_manual=False,  # noqa: E712
    ).all()

    for log in logs:
        if not log.execution_time:
            continue
        log_local = log.execution_time.replace(tzinfo=ZoneInfo("UTC")).astimezone(tz)
        # Count only runs on the same local day that happened at/after this scheduled time.
        # Earlier runs (e.g. Send-now tests or a previous execution time) must not block
        # a later slot on the same day.
        if log_local.date() == scheduled_at.date() and log_local >= scheduled_at:
            return True
    return False


def get_due_scheduled_run(automation: ReportAutomation) -> datetime | None:
    """
    Return the scheduled run datetime that should execute now, if any.

    Unlike compute_next_run (which always looks forward for display), this checks
    whether today's/current slot is due and has not run yet.
    """
    if not automation.is_active:
        return None

    schedule = (automation.schedule_type or "one_time").lower()
    tz = _tz(automation.timezone)
    now_local = datetime.now(tz)
    exec_t = _parse_execution_time(automation.execution_time)

    if schedule == "one_time":
        scheduled_at = _one_time_run_at(automation)
        if is_non_working_day_for_automation(automation, automation.start_date):
            return None
        if now_local < scheduled_at:
            return None
        overdue_seconds = (now_local - scheduled_at).total_seconds()
        if overdue_seconds > ONE_TIME_OVERDUE_SECONDS:
            return None
        if _already_completed_run(automation, scheduled_at):
            return None
        return scheduled_at

    if schedule == "daily":
        scheduled_at = datetime.combine(now_local.date(), exec_t, tzinfo=tz)
        if now_local.date() < automation.start_date:
            return None
        if is_non_working_day_for_automation(automation, now_local.date()):
            return None
        if now_local < scheduled_at:
            return None
        if _already_completed_run(automation, scheduled_at):
            return None
        return scheduled_at

    if schedule == "weekly":
        if now_local.date() < automation.start_date:
            return None
        if now_local.date().weekday() != automation.start_date.weekday():
            return None
        if is_non_working_day_for_automation(automation, now_local.date()):
            return None
        scheduled_at = datetime.combine(now_local.date(), exec_t, tzinfo=tz)
        if now_local < scheduled_at:
            return None
        if _already_completed_run(automation, scheduled_at):
            return None
        return scheduled_at

    if schedule == "monthly":
        if now_local.date() < automation.start_date:
            return None
        run_date = _monthly_run_date(now_local.year, now_local.month, automation.start_date.day)
        if now_local.date() != run_date:
            return None
        if is_non_working_day_for_automation(automation, run_date):
            return None
        scheduled_at = datetime.combine(run_date, exec_t, tzinfo=tz)
        if now_local < scheduled_at:
            return None
        if _already_completed_run(automation, scheduled_at):
            return None
        return scheduled_at

    return None


def compute_next_run(automation: ReportAutomation, after: datetime | None = None) -> datetime | None:
    """Next future run time for UI display."""
    if not automation.is_active:
        return None

    schedule = (automation.schedule_type or "one_time").lower()
    tz = _tz(automation.timezone)
    now_local = datetime.now(tz)
    exec_t = _parse_execution_time(automation.execution_time)

    if schedule == "one_time":
        scheduled_at = _one_time_run_at(automation)
        if is_non_working_day_for_automation(automation, automation.start_date):
            return None
        if _already_completed_run(automation, scheduled_at):
            return None
        if scheduled_at > now_local:
            return scheduled_at
        overdue_seconds = (now_local - scheduled_at).total_seconds()
        if 0 <= overdue_seconds <= ONE_TIME_OVERDUE_SECONDS:
            return scheduled_at
        return None

    # If today's slot is still pending, show today (even if time already passed).
    due_now = get_due_scheduled_run(automation)
    if due_now is not None:
        return due_now

    if schedule == "daily":
        return _daily_run_on_or_after(automation, now_local.date(), exec_t, tz)

    if schedule == "weekly":
        return _weekly_run_on_or_after(automation, now_local.date(), exec_t, tz)

    if schedule == "monthly":
        return _monthly_run_on_or_after(automation, now_local, exec_t, tz)

    run_date = _next_working_day_on_or_after(automation, _earliest_run_date(automation, now_local.date()))
    candidate = datetime.combine(run_date, exec_t, tzinfo=tz)
    if candidate <= now_local:
        candidate = datetime.combine(
            _next_working_day_on_or_after(automation, run_date + timedelta(days=1)),
            exec_t,
            tzinfo=tz,
        )
    return candidate


def should_run_now(automation: ReportAutomation) -> bool:
    return get_due_scheduled_run(automation) is not None


def format_schedule_label(automation: ReportAutomation) -> str:
    t = _parse_execution_time(automation.execution_time)
    period = "AM" if t.hour < 12 else "PM"
    hour12 = t.hour % 12 or 12
    return f"{hour12:02d}:{t.minute:02d} {period}"
