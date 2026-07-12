"""Factory for report generators — add new report types here."""

from __future__ import annotations

from app.models import ReportAutomation
from app.services.report_automation.attendance_report_generator import AttendanceReportGenerator


class ReportGeneratorFactory:
    _GENERATORS = {
        "attendance": AttendanceReportGenerator,
        "attendance_report": AttendanceReportGenerator,
    }

    @classmethod
    def get_generator(cls, automation: ReportAutomation):
        key = (automation.report_type or "").strip().lower()
        gen_cls = cls._GENERATORS.get(key)
        if not gen_cls:
            raise ValueError(f"Unsupported report type: {automation.report_type}")
        return gen_cls(automation)
