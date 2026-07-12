"""Generate colorful attendance PDF reports for selected shifts."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from html import escape as html_escape
from pathlib import Path

from fpdf import FPDF

from app.attendance_constants import DEFAULT_TIMEZONE_OFFSET
from app.models import Attendance, HRInfo, ReportAutomation, Shift, User
from app.services.location_geocode import resolve_location_label
from app.services.report_automation.schedule_utils import compute_report_period, local_now

HEADERS = [
    "Employee Name",
    "Email",
    "Designation",
    "Date",
    "Check In",
    "Check Out",
    "Status",
]

EMAIL_HEADERS = [
    "Employee Name",
    "Check In",
    "Check Out",
    "Status",
]

# Landscape A4 usable width ~277mm (shift shown in title, not table)
COL_WIDTHS = [38, 42, 38, 24, 48, 48, 22]
CELL_PAD = 1.5

# Theme colors (RGB)
C_PRIMARY = (79, 70, 229)
C_PRIMARY_DARK = (67, 56, 202)
C_HEADER_TEXT = (255, 255, 255)
C_ROW_ALT = (248, 250, 252)
C_BORDER = (226, 232, 240)
C_TEXT = (30, 41, 59)
C_MUTED = (100, 116, 139)
C_WHITE = (255, 255, 255)

STATUS_STYLE = {
    "present": {"bg": (220, 252, 231), "fg": (22, 101, 52), "label": "Present"},
    "late": {"bg": (254, 243, 199), "fg": (146, 64, 14), "label": "Late"},
    "absent": {"bg": (254, 226, 226), "fg": (185, 28, 28), "label": "Absent"},
}

# Table row order: present block, then late, then absent (name A–Z within each).
STATUS_SORT_ORDER = {
    "present": 0,
    "late": 1,
    "absent": 2,
}

# Email table typography (keep in sync when adjusting report mail UI).
EMAIL_FONT_TITLE = "20px"
EMAIL_FONT_META = "14px"
EMAIL_FONT_TH = "11px"
EMAIL_FONT_TD = "13px"
EMAIL_FONT_MUTED = "11px"
EMAIL_CELL_BORDER = "1px solid #E2E8F0"

FONT_LATIN = "DejaVu"
FONT_BENGALI = "NotoBengali"
FONT_FAMILY = FONT_LATIN  # backwards-compatible alias
FONT_DIR = Path(__file__).resolve().parents[2] / "assets" / "fonts"


@dataclass
class AttendanceReportRow:
    name: str
    email: str
    designation: str
    date: str
    check_in_time: str
    check_in_location: str
    check_out_time: str
    check_out_location: str
    status: str
    check_in_at: datetime | None = None
    late_minutes: int | None = None


def sort_report_rows_by_status(rows: list[AttendanceReportRow]) -> list[AttendanceReportRow]:
    """Present → late → absent; within each group, earliest check-in first."""

    def sort_key(row: AttendanceReportRow) -> tuple[int, datetime, str]:
        status_rank = STATUS_SORT_ORDER.get((row.status or "").lower(), 99)
        # Rows without check-in sort after those with a time (e.g. absent).
        check_in_order = row.check_in_at or datetime.max
        return status_rank, check_in_order, (row.name or "").lower()

    return sorted(rows, key=sort_key)


def format_bdt_time(dt: datetime | None) -> str:
    """Format UTC stored datetime as BDT 12-hour time."""
    if not dt:
        return ""
    local = dt + DEFAULT_TIMEZONE_OFFSET
    return local.strftime("%I:%M %p")


def shift_late_threshold_minutes(shift: Shift | None) -> int | None:
    """Minutes after midnight (local) when check-in counts as late — start + grace."""
    if not shift or not shift.start_time:
        return None
    try:
        start_h, start_m = map(int, shift.start_time.split(":"))
        grace = int(shift.grace_period or 0)
        return start_h * 60 + start_m + grace
    except (ValueError, TypeError, AttributeError):
        return None


def compute_late_minutes(check_in_at: datetime | None, shift: Shift | None) -> int | None:
    """How many minutes late vs shift start + grace (matches check-in API logic)."""
    threshold = shift_late_threshold_minutes(shift)
    if not check_in_at or threshold is None:
        return None
    local = check_in_at + DEFAULT_TIMEZONE_OFFSET
    check_in_total = local.hour * 60 + local.minute
    if check_in_total <= threshold:
        return 0
    return check_in_total - threshold


def format_late_duration(minutes: int) -> str:
    """Human-readable late duration: 10m, 1h, 1h 30m."""
    if minutes <= 0:
        return "0m"
    hours, mins = divmod(minutes, 60)
    if hours and mins:
        return f"{hours}h {mins}m"
    if hours:
        return f"{hours}h"
    return f"{mins}m"


def summarize_status_counts(rows: list[AttendanceReportRow]) -> dict[str, int]:
    present = late = absent = 0
    for row in rows:
        key = (row.status or "").lower()
        if key == "present":
            present += 1
        elif key == "late":
            late += 1
        elif key == "absent":
            absent += 1
    return {
        "total": len(rows),
        "present": present,
        "late": late,
        "absent": absent,
    }


def _truncate(text: str, max_len: int) -> str:
    if not text:
        return ""
    if len(text) <= max_len:
        return text
    return text[: max_len - 3] + "..."


def _fit_text_width(pdf: FPDF, text: str, max_width: float) -> str:
    """Truncate text so it fits within the given width in mm."""
    value = text or ""
    if not value:
        return ""
    if pdf.get_string_width(value) <= max_width:
        return value
    while len(value) > 1 and pdf.get_string_width(value + "...") > max_width:
        value = value[:-1]
    return (value + "...") if value else "..."


def _draw_cell_border(pdf: FPDF, x: float, y: float, w: float, h: float, fill: tuple[int, int, int]) -> None:
    pdf.set_fill_color(*fill)
    pdf.set_draw_color(*C_BORDER)
    pdf.set_line_width(0.2)
    pdf.rect(x, y, w, h, "DF")


def _draw_table_header(pdf: FPDF, x0: float, y0: float) -> None:
    pdf.set_fill_color(*C_PRIMARY_DARK)
    pdf.set_draw_color(129, 140, 248)
    pdf.set_text_color(*C_HEADER_TEXT)
    pdf.set_font(FONT_LATIN, "B", 8)
    for i, header in enumerate(HEADERS):
        pdf.set_xy(x0 + sum(COL_WIDTHS[:i]), y0)
        pdf.cell(COL_WIDTHS[i], 9, header, border=1, fill=True, align="C")


def _has_bengali_script(text: str) -> bool:
    return any("\u0980" <= ch <= "\u09FF" for ch in text)


def _set_text_font(pdf: FPDF, text: str, *, bold: bool = False, size: int = 8) -> None:
    family = FONT_BENGALI if _has_bengali_script(text) else FONT_LATIN
    pdf.set_font(family, "B" if bold else "", size)


def _setup_pdf_fonts(pdf: FPDF) -> None:
    fonts = {
        (FONT_LATIN, ""): FONT_DIR / "DejaVuSans.ttf",
        (FONT_LATIN, "B"): FONT_DIR / "DejaVuSans-Bold.ttf",
        (FONT_BENGALI, ""): FONT_DIR / "NotoSansBengali-Regular.ttf",
        (FONT_BENGALI, "B"): FONT_DIR / "NotoSansBengali-Bold.ttf",
    }
    missing = [str(path) for path in fonts.values() if not path.is_file()]
    if missing:
        raise FileNotFoundError(f"PDF fonts missing: {', '.join(missing)}")
    for (family, style), path in fonts.items():
        pdf.add_font(family, style, str(path))


class AttendanceReportPDF(FPDF):
    def footer(self):
        self.set_y(-10)
        self.set_font(FONT_LATIN, size=8)
        self.set_text_color(*C_MUTED)
        self.cell(0, 5, f"Page {self.page_no()}/{{nb}}", align="C")


class AttendanceReportGenerator:
    REPORT_TYPE = "attendance"

    def __init__(self, automation: ReportAutomation):
        self.automation = automation

    def _shift_ids(self) -> list[str]:
        return [link.shift_id for link in self.automation.shift_links if link.shift_id]

    def _shift_title_label(self) -> str:
        shift_ids = self._shift_ids()
        if not shift_ids:
            return "All shifts"
        shifts = Shift.query.filter(Shift.id.in_(shift_ids)).order_by(Shift.name.asc()).all()
        names = [s.name.strip() for s in shifts if s.name and s.name.strip()]
        return ", ".join(names) if names else "All shifts"

    def _users_for_shifts(self) -> list[tuple[User, HRInfo | None, Shift | None]]:
        shift_ids = self._shift_ids()
        if not shift_ids:
            return []

        hr_rows = HRInfo.query.filter(HRInfo.shift_id.in_(shift_ids)).all()
        user_ids = [h.user_id for h in hr_rows]
        users = User.query.filter(User.id.in_(user_ids), User.is_active == True).all()  # noqa: E712
        user_map = {u.id: u for u in users}
        hr_map = {h.user_id: h for h in hr_rows}
        shift_map = {s.id: s for s in Shift.query.filter(Shift.id.in_(shift_ids)).all()}

        out: list[tuple[User, HRInfo | None, Shift | None]] = []
        for uid in user_ids:
            user = user_map.get(uid)
            if not user:
                continue
            hr = hr_map.get(uid)
            shift = shift_map.get(hr.shift_id) if hr and hr.shift_id else None
            out.append((user, hr, shift))
        out.sort(key=lambda x: (x[0].name or "").lower())
        return out

    def _prefetch_locations(self, attendance_rows: list[Attendance]) -> None:
        coords: set[str] = set()
        for att in attendance_rows:
            if att.check_in_location:
                coords.add(att.check_in_location.strip())
            if att.check_out_location:
                coords.add(att.check_out_location.strip())
        for c in coords:
            resolve_location_label(c)

    def _build_rows(
        self,
        users: list[tuple[User, HRInfo | None, Shift | None]],
        att_by_user_date: dict[tuple[str, date], Attendance],
        start: date,
        end: date,
    ) -> list[AttendanceReportRow]:
        rows: list[AttendanceReportRow] = []
        for user, hr, shift in users:
            d = start
            while d <= end:
                att = att_by_user_date.get((user.id, d))
                status = "absent"
                check_in_time = ""
                check_in_location = ""
                check_out_time = ""
                check_out_location = ""
                check_in_at: datetime | None = None
                late_minutes: int | None = None
                if att:
                    status = att.status or "absent"
                    if att.check_in_time:
                        check_in_at = att.check_in_time
                        check_in_time = format_bdt_time(att.check_in_time)
                        check_in_location = resolve_location_label(att.check_in_location)
                    if att.check_out_time:
                        check_out_time = format_bdt_time(att.check_out_time)
                        check_out_location = resolve_location_label(att.check_out_location)
                    if status == "late" and check_in_at:
                        late_minutes = compute_late_minutes(check_in_at, shift)

                rows.append(
                    AttendanceReportRow(
                        name=user.name or "",
                        email=user.email or "",
                        designation=(hr.designation if hr else "") or "",
                        date=d.strftime("%d-%b-%y").lower(),
                        check_in_time=check_in_time,
                        check_in_location=check_in_location,
                        check_out_time=check_out_time,
                        check_out_location=check_out_location,
                        status=status,
                        check_in_at=check_in_at,
                        late_minutes=late_minutes,
                    )
                )
                d = date.fromordinal(d.toordinal() + 1)
        return rows

    def _row_height(self, row: AttendanceReportRow) -> float:
        h = 7.0
        if row.check_in_time and row.check_in_location:
            h = max(h, 11.0)
        elif row.check_in_time:
            h = max(h, 7.0)
        if row.check_out_time and row.check_out_location:
            h = max(h, 11.0)
        elif row.check_out_time:
            h = max(h, 7.0)
        return h

    def _draw_text_cell(
        self,
        pdf: FPDF,
        x: float,
        y: float,
        w: float,
        h: float,
        fill: tuple[int, int, int],
        text: str,
        *,
        align: str = "L",
    ) -> None:
        _draw_cell_border(pdf, x, y, w, h, fill)
        inner_w = w - (2 * CELL_PAD)
        _set_text_font(pdf, text, size=8)
        fitted = _fit_text_width(pdf, text, inner_w)
        pdf.set_text_color(*C_TEXT)
        pdf.set_xy(x + CELL_PAD, y + (h - 4) / 2)
        pdf.cell(inner_w, 4, fitted, align=align)

    def _draw_time_location(
        self,
        pdf: FPDF,
        x: float,
        y: float,
        w: float,
        h: float,
        fill: tuple[int, int, int],
        time_str: str,
        location: str,
    ) -> None:
        _draw_cell_border(pdf, x, y, w, h, fill)
        inner_w = w - (2 * CELL_PAD)
        pdf.set_xy(x + CELL_PAD, y + 1.2)
        if time_str:
            _set_text_font(pdf, time_str, bold=True, size=8)
            pdf.set_text_color(*C_TEXT)
            pdf.cell(inner_w, 4, _fit_text_width(pdf, time_str, inner_w))
        if location:
            pdf.set_xy(x + CELL_PAD, y + (5.5 if time_str else 1.2))
            _set_text_font(pdf, location, size=7)
            pdf.set_text_color(*C_MUTED)
            prefix_w = 2.5
            loc = _fit_text_width(pdf, location, inner_w - prefix_w)
            pdf.cell(prefix_w, 3.5, ">")
            pdf.cell(inner_w - prefix_w, 3.5, loc)
        elif not time_str:
            pdf.set_font(FONT_LATIN, size=8)
            pdf.set_text_color(*C_MUTED)
            pdf.cell(inner_w, 4, "-")

    def _draw_status_badge(
        self,
        pdf: FPDF,
        x: float,
        y: float,
        w: float,
        h: float,
        fill: tuple[int, int, int],
        status: str,
    ) -> None:
        _draw_cell_border(pdf, x, y, w, h, fill)
        style = STATUS_STYLE.get(status, STATUS_STYLE["absent"])
        badge_h = min(6.5, h - 2)
        badge_y = y + (h - badge_h) / 2
        badge_w = w - (2 * CELL_PAD)
        pdf.set_fill_color(*style["bg"])
        pdf.set_draw_color(*style["bg"])
        pdf.rect(x + CELL_PAD, badge_y, badge_w, badge_h, "F")
        pdf.set_xy(x + CELL_PAD, badge_y + 1)
        pdf.set_font(FONT_LATIN, "B", 7)
        pdf.set_text_color(*style["fg"])
        pdf.cell(badge_w, badge_h - 2, style["label"], align="C")

    def _render_pdf(self, rows: list[AttendanceReportRow], start: date, end: date) -> bytes:
        pdf = AttendanceReportPDF(orientation="L", unit="mm", format="A4")
        _setup_pdf_fonts(pdf)
        pdf.alias_nb_pages()
        pdf.set_auto_page_break(auto=True, margin=14)
        pdf.add_page()

        shift_label = self._shift_title_label()
        period_label = self._format_period_label(start, end)

        # Header banner
        pdf.set_fill_color(*C_PRIMARY)
        pdf.rect(0, 0, 297, 26, "F")
        pdf.set_xy(12, 7)
        title = f"Attendance Report - {self.automation.report_name or 'Attendance Report'}"
        _set_text_font(pdf, title, bold=True, size=15)
        pdf.set_text_color(*C_HEADER_TEXT)
        pdf.cell(0, 8, title)
        pdf.set_xy(12, 15)
        pdf.set_font(FONT_LATIN, size=9)
        pdf.cell(
            0,
            6,
            f"Shift: {shift_label}  |  Period: {period_label}  |  Timezone: BDT (UTC+6)  |  Generated automatically",
        )
        pdf.ln(18)

        # Table header
        x0 = pdf.get_x()
        y0 = pdf.get_y()
        _draw_table_header(pdf, x0, y0)
        pdf.ln(9)

        if not rows:
            pdf.set_font(FONT_LATIN, size=9)
            pdf.set_text_color(*C_MUTED)
            pdf.set_draw_color(*C_BORDER)
            pdf.cell(sum(COL_WIDTHS), 12, "No attendance records for this period.", border=1, align="C")
            return bytes(pdf.output())

        for idx, row in enumerate(rows):
            row_h = self._row_height(row)
            if pdf.get_y() + row_h > pdf.h - pdf.b_margin:
                pdf.add_page()
                y0 = pdf.get_y()
                _draw_table_header(pdf, x0, y0)
                pdf.ln(9)

            y = pdf.get_y()
            x = x0
            fill = C_ROW_ALT if idx % 2 == 0 else C_WHITE

            col_x = x
            for i, value in enumerate([row.name, row.email, row.designation, row.date]):
                self._draw_text_cell(pdf, col_x, y, COL_WIDTHS[i], row_h, fill, value)
                col_x += COL_WIDTHS[i]

            self._draw_time_location(
                pdf,
                col_x,
                y,
                COL_WIDTHS[4],
                row_h,
                fill,
                row.check_in_time,
                row.check_in_location,
            )
            col_x += COL_WIDTHS[4]
            self._draw_time_location(
                pdf,
                col_x,
                y,
                COL_WIDTHS[5],
                row_h,
                fill,
                row.check_out_time,
                row.check_out_location,
            )
            col_x += COL_WIDTHS[5]
            self._draw_status_badge(pdf, col_x, y, COL_WIDTHS[6], row_h, fill, row.status)
            pdf.set_y(y + row_h)

        return bytes(pdf.output())

    def _render_text(self, rows: list[AttendanceReportRow], start: date, end: date) -> str:
        shift_label = self._shift_title_label()
        lines = [
            f"Attendance Report: {self.automation.report_name}",
            "",
            f"Shift: {shift_label}  |  Period: {self._format_period_label(start, end)}",
            "",
        ]
        if not rows:
            lines.append("No attendance records for this period.")
            return "\n".join(lines)

        for row in rows:
            status_label = STATUS_STYLE.get(row.status, {}).get("label", (row.status or "Unknown").title())
            if row.status == "late" and row.late_minutes and row.late_minutes > 0:
                status_label = f"Late ({format_late_duration(row.late_minutes)})"
            check_in = row.check_in_time or "-"
            if row.check_in_time and row.check_in_location:
                check_in = f"{row.check_in_time} ({row.check_in_location})"
            check_out = row.check_out_time or "-"
            if row.check_out_time and row.check_out_location:
                check_out = f"{row.check_out_time} ({row.check_out_location})"

            lines.extend(
                [
                    f"- {row.name or '-'}",
                    f"  Check in: {check_in} | Check out: {check_out} | Status: {status_label}",
                    "",
                ]
            )
        return "\n".join(lines).strip()

    @staticmethod
    def _rgb_hex(rgb: tuple[int, int, int]) -> str:
        return f"#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}"

    def _format_period_label(self, start: date, end: date) -> str:
        if start == end:
            return start.strftime("%d-%b-%Y")
        return f"{start.strftime('%d-%b-%Y')} to {end.strftime('%d-%b-%Y')}"

    def _render_check_cell_html(self, time_str: str, location: str) -> str:
        if not time_str:
            return f'<span style="color:#94A3B8;font-size:{EMAIL_FONT_TD};">—</span>'
        parts = [
            f'<div style="font-size:{EMAIL_FONT_TD};font-weight:600;color:#1E293B;line-height:1.4;">'
            f"{html_escape(time_str)}</div>",
        ]
        if location:
            parts.append(
                f'<div style="font-size:{EMAIL_FONT_MUTED};color:#64748B;margin-top:3px;line-height:1.35;">'
                f"{html_escape(location)}</div>"
            )
        return "".join(parts)

    def _render_status_badge_html(self, status: str, late_minutes: int | None = None) -> str:
        style = STATUS_STYLE.get(status, STATUS_STYLE["absent"])
        bg = self._rgb_hex(style["bg"])
        fg = self._rgb_hex(style["fg"])
        if status == "late" and late_minutes is not None and late_minutes > 0:
            label = html_escape(f"Late · {format_late_duration(late_minutes)}")
        else:
            label = html_escape(style["label"])
        return (
            f'<span style="display:inline-block;padding:5px 12px;border-radius:999px;'
            f"font-size:{EMAIL_FONT_TH};font-weight:700;background:{bg};color:{fg};"
            f'line-height:1.2;white-space:nowrap;">{label}</span>'
        )

    def _render_summary_stat_card(self, label: str, count: int, status_key: str, *, pad_left: str = "") -> str:
        style = STATUS_STYLE.get(status_key, STATUS_STYLE["absent"])
        bg = self._rgb_hex(style["bg"])
        fg = self._rgb_hex(style["fg"])
        return (
            f'<td style="padding:0;{pad_left}">'
            f'<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">'
            f"<tr><td style=\"background:{bg};border-radius:10px;padding:10px 14px;text-align:center;"
            f"border:1px solid rgba(255,255,255,0.45);min-width:58px;\">"
            f'<div style="font-size:10px;font-weight:700;color:{fg};text-transform:uppercase;'
            f'letter-spacing:0.05em;line-height:1.2;">{html_escape(label)}</div>'
            f'<div style="font-size:22px;font-weight:700;color:{fg};line-height:1.15;margin-top:5px;">'
            f"{count}</div>"
            f"</td></tr></table></td>"
        )

    def _render_email_summary_html(self, rows: list[AttendanceReportRow]) -> str:
        counts = summarize_status_counts(rows)
        return (
            '<table role="presentation" cellpadding="0" cellspacing="0" border="0" '
            'style="margin-left:auto;">'
            "<tr>"
            f'{self._render_summary_stat_card("Present", counts["present"], "present")}'
            f'{self._render_summary_stat_card("Late", counts["late"], "late", pad_left="padding-left:8px;")}'
            f'{self._render_summary_stat_card("Absent", counts["absent"], "absent", pad_left="padding-left:8px;")}'
            "</tr></table>"
        )

    def _email_th_style(self, *, align: str = "left") -> str:
        return (
            f"padding:11px 14px;font-size:{EMAIL_FONT_TH};font-weight:700;text-align:{align};"
            "color:#475569;text-transform:uppercase;letter-spacing:0.05em;"
            f"border:{EMAIL_CELL_BORDER};background:#F8FAFC;white-space:nowrap;"
        )

    def _email_td_style(self, *, align: str = "left") -> str:
        return (
            f"padding:12px 14px;font-size:{EMAIL_FONT_TD};text-align:{align};"
            f"vertical-align:middle;color:#1E293B;line-height:1.45;border:{EMAIL_CELL_BORDER};"
        )

    def _render_html(self, rows: list[AttendanceReportRow], start: date, end: date) -> str:
        report_name = html_escape(self.automation.report_name or "Attendance Report")
        period = html_escape(self._format_period_label(start, end))
        shift_label = html_escape(self._shift_title_label())
        primary = self._rgb_hex(C_PRIMARY)
        border = self._rgb_hex(C_BORDER)
        summary_html = self._render_email_summary_html(rows)

        th_name = self._email_th_style(align="left")
        th_time = self._email_th_style(align="left")
        th_status = self._email_th_style(align="center")

        header_cells = (
            f'<th style="{th_name}">Employee Name</th>'
            f'<th style="{th_time}">Check In</th>'
            f'<th style="{th_time}">Check Out</th>'
            f'<th style="{th_status}">Status</th>'
        )

        if not rows:
            body_rows = (
                f'<tr><td colspan="{len(EMAIL_HEADERS)}" style="padding:28px 14px;text-align:center;'
                f'font-size:{EMAIL_FONT_TD};color:#64748B;border:{EMAIL_CELL_BORDER};">'
                f"No attendance records for this period.</td></tr>"
            )
        else:
            body_parts: list[str] = []
            for row in rows:
                td = lambda align="left": self._email_td_style(align=align)
                body_parts.append(
                    "<tr>"
                    f'<td style="{td("left")};font-weight:600;">{html_escape(row.name or "—")}</td>'
                    f'<td style="{td("left")}">{self._render_check_cell_html(row.check_in_time, row.check_in_location)}</td>'
                    f'<td style="{td("left")}">{self._render_check_cell_html(row.check_out_time, row.check_out_location)}</td>'
                    f'<td style="{td("center")}">{self._render_status_badge_html(row.status, row.late_minutes)}</td>'
                    "</tr>"
                )
            body_rows = "".join(body_parts)

        return f"""<div style="font-family:Arial,Helvetica,sans-serif;max-width:720px;margin:0 auto;color:#1E293B;">
  <div style="border:1px solid {border};border-radius:12px;overflow:hidden;background:#FFFFFF;">
    <div style="background:{primary};padding:20px 22px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="vertical-align:middle;padding:0;">
            <div style="font-size:{EMAIL_FONT_TITLE};font-weight:700;color:#FFFFFF;line-height:1.35;">
              Attendance Report — {report_name}
            </div>
            <div style="margin-top:8px;font-size:{EMAIL_FONT_META};font-weight:500;color:rgba(255,255,255,0.92);line-height:1.5;">
              Shift: {shift_label} &nbsp;·&nbsp; Period: {period}
            </div>
          </td>
          <td style="vertical-align:middle;padding:0 0 0 16px;width:1%;">
            {summary_html}
          </td>
        </tr>
      </table>
    </div>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;min-width:560px;background:#FFFFFF;">
        <thead>
          <tr>{header_cells}</tr>
        </thead>
        <tbody>{body_rows}</tbody>
      </table>
    </div>
  </div>
</div>"""

    def generate(self, *, manual: bool = False) -> tuple[bytes, str, date, date, str, str]:
        if manual:
            today = local_now(self.automation).date()
            start, end = today, today
        else:
            start, end = compute_report_period(self.automation, manual=False)

        users = self._users_for_shifts()
        user_ids = [u.id for u, _, _ in users]

        if user_ids and start == end:
            from app.api.attendance import ensure_attendance_records_for_period

            for uid in user_ids:
                ensure_attendance_records_for_period(start, end, user_id=uid)

        attendance_rows: list[Attendance] = []
        if user_ids:
            attendance_rows = (
                Attendance.query.filter(
                    Attendance.user_id.in_(user_ids),
                    Attendance.date >= start,
                    Attendance.date <= end,
                )
                .order_by(Attendance.date.asc(), Attendance.user_id.asc())
                .all()
            )

        self._prefetch_locations(attendance_rows)
        att_by_user_date = {(a.user_id, a.date): a for a in attendance_rows}
        table_rows = sort_report_rows_by_status(
            self._build_rows(users, att_by_user_date, start, end)
        )
        pdf_bytes = self._render_pdf(table_rows, start, end)
        text_report = self._render_text(table_rows, start, end)
        html_report = self._render_html(table_rows, start, end)

        safe_name = "".join(c if c.isalnum() or c in "-_" else "_" for c in self.automation.report_name)[:40]
        if start == end:
            filename = f"{safe_name}_{start.isoformat()}.pdf"
        else:
            filename = f"{safe_name}_{start.isoformat()}_{end.isoformat()}.pdf"
        return pdf_bytes, filename, start, end, text_report, html_report
