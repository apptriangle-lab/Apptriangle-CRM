"""Send transactional email with a file attachment."""

from __future__ import annotations

import base64
import json
import smtplib
import urllib.error
import urllib.request
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from flask import current_app

from app.email_providers.zeptomail import _authorization_value, is_zeptomail_configured


def send_email_with_attachment(
    to_email: str,
    recipient_name: str,
    subject: str,
    text_body: str,
    attachment_bytes: bytes,
    attachment_filename: str,
    attachment_mime: str = "application/octet-stream",
    html_body: str | None = None,
) -> bool:
    if is_zeptomail_configured():
        return _send_attachment_zeptomail(
            to_email,
            recipient_name,
            subject,
            text_body,
            html_body,
            attachment_bytes,
            attachment_filename,
            attachment_mime,
        )

    if current_app.config.get("BREVO_API_KEY"):
        return _send_attachment_brevo(
            to_email,
            recipient_name,
            subject,
            text_body,
            html_body,
            attachment_bytes,
            attachment_filename,
        )

    server = (current_app.config.get("MAIL_SERVER") or "").strip()
    if server:
        return _send_attachment_smtp(
            to_email,
            subject,
            text_body,
            html_body,
            attachment_bytes,
            attachment_filename,
            attachment_mime,
        )

    current_app.logger.info(
        "No email provider configured; skipping attachment email to %s",
        to_email,
    )
    return False


def _send_attachment_smtp(
    to_email: str,
    subject: str,
    text_body: str,
    html_body: str | None,
    attachment_bytes: bytes,
    attachment_filename: str,
    attachment_mime: str,
) -> bool:
    from_addr = (
        current_app.config.get("MAIL_DEFAULT_SENDER")
        or current_app.config.get("MAIL_USERNAME")
        or "noreply@crm"
    )
    server = (current_app.config.get("MAIL_SERVER") or "").strip()
    if not server:
        return False
    msg = MIMEMultipart("mixed")
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to_email

    alt = MIMEMultipart("alternative")
    alt.attach(MIMEText(text_body, "plain"))
    if html_body:
        alt.attach(MIMEText(html_body, "html"))
    msg.attach(alt)

    part = MIMEApplication(attachment_bytes, _subtype=attachment_mime.split("/")[-1])
    part.add_header("Content-Disposition", "attachment", filename=attachment_filename)
    msg.attach(part)

    try:
        use_tls = current_app.config.get("MAIL_USE_TLS", True)
        port = current_app.config.get("MAIL_PORT", 587)
        with smtplib.SMTP(server, port) as smtp:
            if use_tls:
                smtp.starttls()
            username = current_app.config.get("MAIL_USERNAME")
            password = current_app.config.get("MAIL_PASSWORD")
            if username and password:
                smtp.login(username, password)
            smtp.sendmail(from_addr, to_email, msg.as_string())
        return True
    except Exception as e:
        current_app.logger.warning("SMTP attachment send failed: %s", e)
        return False


def _send_attachment_brevo(
    to_email: str,
    name: str,
    subject: str,
    text_body: str,
    html_body: str | None,
    attachment_bytes: bytes,
    attachment_filename: str,
) -> bool:
    api_key = (current_app.config.get("BREVO_API_KEY") or "").strip()
    sender_email = (current_app.config.get("BREVO_SENDER_EMAIL") or "").strip()
    sender_name = (current_app.config.get("BREVO_SENDER_NAME") or "CRM").strip()
    if not api_key or not sender_email:
        return False

    payload = {
        "sender": {"name": sender_name, "email": sender_email},
        "to": [{"email": to_email, "name": name or to_email}],
        "subject": subject,
        "textContent": text_body,
        "attachment": [
            {
                "content": base64.b64encode(attachment_bytes).decode("ascii"),
                "name": attachment_filename,
            }
        ],
    }
    if html_body:
        payload["htmlContent"] = html_body

    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            "https://api.brevo.com/v3/smtp/email",
            data=data,
            headers={
                "Accept": "application/json",
                "Content-Type": "application/json",
                "api-key": api_key,
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=30) as res:
            return res.status in (200, 201)
    except Exception as e:
        current_app.logger.warning("Brevo attachment send failed: %s", e)
        return False


def _send_attachment_zeptomail(
    to_email: str,
    recipient_name: str,
    subject: str,
    text_body: str,
    html_body: str | None,
    attachment_bytes: bytes,
    attachment_filename: str,
    attachment_mime: str,
) -> bool:
    token = (current_app.config.get("ZEPTOMAIL_API_TOKEN") or "").strip()
    from_addr = (current_app.config.get("ZEPTOMAIL_FROM_EMAIL") or "").strip()
    from_name = (current_app.config.get("ZEPTOMAIL_FROM_NAME") or "CRM").strip()
    api_url = (current_app.config.get("ZEPTOMAIL_API_URL") or "https://api.zeptomail.com/v1.1/email").strip()
    if not token or not from_addr:
        return False

    payload: dict = {
        "from": {"address": from_addr, "name": from_name},
        "to": [{"email_address": {"address": to_email, "name": recipient_name or to_email}}],
        "subject": subject,
        "attachments": [
            {
                "content": base64.b64encode(attachment_bytes).decode("ascii"),
                "mime_type": attachment_mime,
                "name": attachment_filename,
            }
        ],
    }
    if html_body:
        payload["htmlbody"] = html_body
    else:
        payload["textbody"] = text_body

    auth_value = _authorization_value(token)
    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            api_url,
            data=data,
            headers={
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Authorization": auth_value,
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=30) as res:
            return res.status in (200, 201)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace") if e.fp else ""
        current_app.logger.warning("ZeptoMail attachment error: %s %s", e.code, body[:200])
        return False
    except Exception as e:
        current_app.logger.warning("ZeptoMail attachment send failed: %s", e)
        return False
