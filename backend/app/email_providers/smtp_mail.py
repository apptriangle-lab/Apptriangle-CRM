"""Generic SMTP delivery."""

from __future__ import annotations

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from flask import current_app


def send_via_smtp(
    to_email: str,
    subject: str,
    text_body: str,
    from_addr: str,
    html_body: str | None = None,
) -> bool:
    """Send email via SMTP. If html_body is set, sends multipart (plain + HTML)."""
    server = (current_app.config.get("MAIL_SERVER") or "").strip()
    if not server:
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to_email
    msg.attach(MIMEText(text_body, "plain"))
    if html_body:
        msg.attach(MIMEText(html_body, "html"))

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
        current_app.logger.info("SMTP: email sent to %s", to_email)
        return True
    except Exception as e:
        current_app.logger.warning("SMTP send failed to %s: %s", to_email, e)
        return False
