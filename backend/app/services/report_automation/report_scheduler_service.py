"""Background scheduler for report automations."""

from __future__ import annotations

import os
import threading

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.models import ReportAutomation
from app.services.report_automation.report_automation_service import execute_automation
from app.services.report_automation.scheduled_run_lock import (
    release_scheduled_run_lock,
    try_acquire_scheduled_run_lock,
)
from app.services.report_automation.schedule_utils import get_due_scheduled_run

_scheduler: BackgroundScheduler | None = None
_running_lock = threading.Lock()
_running_ids: set[str] = set()


def _tick(app):
    from datetime import datetime

    from app import db

    with app.app_context():
        with db.session.no_autoflush:
            automations = ReportAutomation.query.filter_by(is_active=True).all()
            due_count = 0
            for automation in automations:
                due_at = get_due_scheduled_run(automation)
                if not due_at:
                    continue

                with _running_lock:
                    if automation.id in _running_ids:
                        continue
                    _running_ids.add(automation.id)

                acquired = False
                try:
                    if not try_acquire_scheduled_run_lock(automation.id, due_at):
                        continue
                    acquired = True

                    due_count += 1
                    app.logger.info(
                        "Report scheduler: running automation %s (%s) due at %s pid=%s",
                        automation.id,
                        automation.report_name,
                        due_at.isoformat(),
                        os.getpid(),
                    )
                    print(
                        f"Report scheduler: running {automation.report_name} "
                        f"(due {due_at.strftime('%Y-%m-%d %H:%M %Z')}, pid={os.getpid()})",
                        flush=True,
                    )
                    execute_automation(automation.id, manual=False)
                except Exception as e:
                    db.session.rollback()
                    app.logger.exception(
                        "Report scheduler: failed %s (%s): %s",
                        automation.id,
                        automation.report_name,
                        e,
                    )
                    print(
                        f"Report scheduler: FAILED {automation.report_name}: {e}",
                        flush=True,
                    )
                finally:
                    if acquired:
                        release_scheduled_run_lock(automation.id, due_at)
                    with _running_lock:
                        _running_ids.discard(automation.id)

            if datetime.now().second < 2:
                print(
                    f"Report scheduler tick pid={os.getpid()} "
                    f"active={len(automations)} due={due_count}",
                    flush=True,
                )


def start_report_scheduler(app):
    global _scheduler
    if _scheduler is not None:
        return _scheduler

    if app.config.get("REPORT_SCHEDULER_DISABLED"):
        app.logger.info("Report automation scheduler disabled via REPORT_SCHEDULER_DISABLED")
        return None

    def _job():
        _tick(app)

    _scheduler = BackgroundScheduler(daemon=True)
    _scheduler.add_job(
        func=_job,
        trigger=CronTrigger(second=0),
        id="report_automation_tick",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    _scheduler.start()
    app.logger.info("Report automation scheduler started (pid=%s)", os.getpid())
    print(
        f"Report automation scheduler started (checks every minute, pid={os.getpid()})",
        flush=True,
    )
    return _scheduler
