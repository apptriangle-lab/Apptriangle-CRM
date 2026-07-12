"""Subject + plain/HTML bodies for task assignment notifications."""

from __future__ import annotations

from html import escape


def _truncate(text: str | None, max_len: int) -> str:
    if not text:
        return ""
    t = text.strip()
    if len(t) <= max_len:
        return t
    return t[: max_len - 1].rstrip() + "…"


def build_task_assigned_email(
    *,
    assignee_display_name: str,
    assigner_display_name: str,
    task_title: str,
    task_note_plain: str | None,
    company_name: str,
    due_label: str,
    tasks_deep_link: str,
    is_reassignment: bool,
    is_self_assigned: bool,
) -> tuple[str, str, str]:
    """
    Returns (subject, text_body, html_body).
    Caller must pass already-sanitized display strings; values are HTML-escaped again for the HTML part.
    """
    title_safe = _truncate(task_title, 200)
    note = _truncate(task_note_plain, 500)
    company = _truncate(company_name, 200) or "—"

    if is_reassignment:
        subject = f"Task reassigned: {title_safe}"
        summary = "A task was reassigned to you."
        badge_label = "Reassigned"
        badge_bg = "#FEF3C7"
        badge_color = "#92400E"
    elif is_self_assigned:
        subject = f"Task created: {title_safe}"
        summary = "You created a task assigned to yourself."
        badge_label = "Self-assigned"
        badge_bg = "#ECFDF5"
        badge_color = "#166534"
    else:
        subject = f"Task assigned: {title_safe}"
        summary = f"{assigner_display_name} assigned you a task."
        badge_label = "New task"
        badge_bg = "#EFF6FF"
        badge_color = "#1D4ED8"

    text_body = f"""Hi {assignee_display_name},

{summary}

Task: {title_safe}
Company: {company}
Due: {due_label}
"""
    if not is_self_assigned:
        text_body += f"Assigned by: {assigner_display_name}\n"
    if note:
        text_body += f"\nNote: {note}\n"
    text_body += f"\nView task: {tasks_deep_link}\n\n— CRM\n"

    etitle = escape(title_safe)
    ecompany = escape(company)
    edue = escape(due_label)
    enote = escape(note) if note else ""
    eassignee = escape(assignee_display_name)
    eassigner = escape(assigner_display_name)
    esummary = escape(summary)
    link = escape(tasks_deep_link)

    assigner_row = ""
    if not is_self_assigned:
        assigner_row = f"""
          <tr>
            <td style="padding:8px 0;border-top:1px solid #E2E8F0;color:#64748B;font-size:12px;width:96px;vertical-align:top;">Assigned by</td>
            <td style="padding:8px 0 8px 12px;border-top:1px solid #E2E8F0;color:#0F172A;font-size:13px;font-weight:600;">{eassigner}</td>
          </tr>"""

    note_block = ""
    if enote:
        note_block = f"""
        <tr>
          <td style="padding:14px 0 0 0;">
            <table width="100%" border="0" cellspacing="0" cellpadding="0" role="presentation" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;">
              <tr>
                <td style="padding:10px 12px;">
                  <p style="margin:0 0 4px 0;font-size:11px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:0.06em;">Note</p>
                  <p style="margin:0;font-size:13px;line-height:1.5;color:#334155;white-space:pre-wrap;word-break:break-word;">{enote}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>"""

    html_body = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{escape(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" role="presentation" style="background:#F1F5F9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table width="520" border="0" cellspacing="0" cellpadding="0" role="presentation" style="max-width:520px;width:100%;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:14px 20px;background:#2563EB;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" role="presentation">
                <tr>
                  <td style="font-size:13px;font-weight:700;color:#FFFFFF;letter-spacing:0.04em;">CRM · Tasks</td>
                  <td align="right">
                    <span style="display:inline-block;padding:3px 10px;border-radius:999px;background:{badge_bg};color:{badge_color};font-size:11px;font-weight:700;">{badge_label}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px;">
              <p style="margin:0 0 4px 0;font-size:13px;color:#64748B;">Hi {eassignee},</p>
              <p style="margin:0 0 16px 0;font-size:14px;line-height:1.5;color:#334155;">{esummary}</p>
              <p style="margin:0 0 12px 0;font-size:15px;font-weight:700;line-height:1.4;color:#0F172A;word-break:break-word;">{etitle}</p>
              <table width="100%" border="0" cellspacing="0" cellpadding="0" role="presentation" style="border-top:1px solid #E2E8F0;">
                <tr>
                  <td style="padding:8px 0;color:#64748B;font-size:12px;width:96px;vertical-align:top;">Company</td>
                  <td style="padding:8px 0 8px 12px;color:#0F172A;font-size:13px;font-weight:600;">{ecompany}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-top:1px solid #E2E8F0;color:#64748B;font-size:12px;width:96px;vertical-align:top;">Due</td>
                  <td style="padding:8px 0 8px 12px;border-top:1px solid #E2E8F0;color:#0F172A;font-size:13px;font-weight:600;">{edue}</td>
                </tr>
                {assigner_row}
              </table>
              <table width="100%" border="0" cellspacing="0" cellpadding="0" role="presentation">
                {note_block}
                <tr>
                  <td style="padding:18px 0 4px 0;" align="center">
                    <a href="{link}" style="display:inline-block;background:#2563EB;color:#FFFFFF !important;text-decoration:none;padding:10px 22px;border-radius:8px;font-size:13px;font-weight:600;">View task</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 20px;border-top:1px solid #E2E8F0;background:#F8FAFC;">
              <p style="margin:0;font-size:11px;line-height:1.5;color:#94A3B8;text-align:center;">
                Automated notification · Please do not reply
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    return subject, text_body, html_body
