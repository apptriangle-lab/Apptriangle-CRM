"""Email delivery for automated reports."""

from __future__ import annotations

import html
from datetime import datetime

from app.attendance_constants import DEFAULT_TIMEZONE_OFFSET
from app.email_utils import send_transactional_email


def _format_generated_at(generated_at: datetime) -> str:
    """UTC stored timestamp → local (BDT) date + 12-hour time for email footer."""
    local = generated_at + DEFAULT_TIMEZONE_OFFSET
    return local.strftime("%d-%b-%Y %I:%M:%S %p")


def build_report_email_bodies(
    report_name: str,
    generated_at: datetime,
    report_text: str,
    report_html: str,
) -> tuple[str, str, str]:
    ts = _format_generated_at(generated_at)
    subject = f"Attendance Report - {report_name}"
    safe_report = (report_text or "").strip() or "No attendance records for this period."
    safe_html = (report_html or "").strip()

    text_body = f"""Hello,

Please find below the attendance report generated automatically by the system.

{safe_report}

---
Report Name: {report_name}
Generated At: {ts}

Regards,
CRM
"""
    report_block = safe_html or f"<pre>{html.escape(safe_report)}</pre>"
    html_body = f"""<!DOCTYPE html>
<html>
<body style="margin:0;padding:20px;background:#F1F5F9;font-family:Arial,Helvetica,sans-serif;color:#1E293B;">
  <div style="max-width:760px;margin:0 auto;background:#FFFFFF;border-radius:12px;padding:22px 24px;border:1px solid #E2E8F0;">
    <p style="margin:0 0 12px;font-size:14px;line-height:1.5;">Hello,</p>
    <p style="margin:0 0 18px;font-size:14px;line-height:1.5;color:#475569;">
      Please find below the attendance report generated automatically by the system.
    </p>
    {report_block}
    <p style="margin:18px 0 0;font-size:13px;color:#64748B;line-height:1.5;">
      <strong style="color:#334155;">Report Name:</strong> {html.escape(report_name)}<br/>
      <strong style="color:#334155;">Generated At:</strong> {ts}
    </p>
    <p style="margin:14px 0 0;font-size:14px;line-height:1.5;">Regards,<br/>CRM</p>
  </div>
</body>
</html>"""
    return subject, text_body, html_body


def send_report_to_recipients(
    *,
    report_name: str,
    recipients: list[tuple[str, str]],
    report_text: str,
    report_html: str,
    generated_at: datetime,
) -> tuple[int, str | None]:
    """Send report in email body to all recipients. Returns (success_count, error_message)."""
    if not recipients:
        return 0, "No recipients configured"

    subject, text_body, html_body = build_report_email_bodies(
        report_name,
        generated_at,
        report_text,
        report_html,
    )
    sent = 0
    errors: list[str] = []

    for email, name in recipients:
        if not email:
            errors.append(f"Missing email for {name or 'recipient'}")
            continue
        ok = send_transactional_email(
            to_email=email,
            recipient_name=name or email,
            subject=subject,
            text_body=text_body,
            html_body=html_body,
        )
        if ok:
            sent += 1
        else:
            errors.append(f"Failed to send to {email}")

    if sent == 0 and errors:
        return 0, "; ".join(errors[:3])
    if errors and sent < len(recipients):
        return sent, f"Partial send: {'; '.join(errors[:2])}"
    return sent, None
