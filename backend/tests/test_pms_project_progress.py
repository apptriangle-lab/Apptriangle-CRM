"""Project progress percentage from task status aggregates."""
from app.services.pms_project_service import _compute_project_progress_percentage
from app.services.pms_status_service import (
    is_pms_task_cancelled_status,
    is_pms_task_completed_status,
)


def test_progress_80_percent_with_one_cancelled():
    total, completed, cancelled = 11, 8, 1
    non_cancelled = total - cancelled
    assert _compute_project_progress_percentage(completed, non_cancelled) == 80


def test_progress_100_percent():
    assert _compute_project_progress_percentage(5, 5) == 100


def test_progress_0_percent_no_completed():
    assert _compute_project_progress_percentage(0, 5) == 0


def test_progress_0_percent_all_cancelled():
    assert _compute_project_progress_percentage(0, 0) == 0


def test_progress_0_percent_zero_tasks():
    assert _compute_project_progress_percentage(0, 0) == 0


def test_cancelled_status_variants():
    assert is_pms_task_cancelled_status("cancelled")
    assert is_pms_task_cancelled_status("canceled")
    assert is_pms_task_cancelled_status("Cancelled")
    assert not is_pms_task_cancelled_status("completed")


def test_completed_status():
    assert is_pms_task_completed_status("completed")
    assert is_pms_task_completed_status("Completed")
    assert not is_pms_task_completed_status("cancelled")
