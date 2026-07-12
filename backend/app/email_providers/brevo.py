"""Brevo (Sendinblue) transactional API."""

from __future__ import annotations

import json
import urllib.error
import urllib.request

from flask import current_app


def send_via_brevo(
    to_email: str,
    name: str,
    subject: str,
    text_body: str,
    html_body: str | None = None,
) -> bool:
    """Send email via Brevo API. Returns True if sent."""
    api_key = (current_app.config.get("BREVO_API_KEY") or "").strip()
    sender_email = (current_app.config.get("BREVO_SENDER_EMAIL") or "").strip()
    sender_name = (current_app.config.get("BREVO_SENDER_NAME") or "CRM").strip()

    if not api_key or not sender_email:
        current_app.logger.warning(
            "BREVO_API_KEY or BREVO_SENDER_EMAIL not set; cannot send via Brevo"
        )
        return False

    payload = {
        "sender": {"name": sender_name, "email": sender_email},
        "to": [{"email": to_email, "name": name or to_email}],
        "subject": subject,
        "textContent": text_body,
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
        with urllib.request.urlopen(req, timeout=15) as res:
            if res.status not in (200, 201):
                current_app.logger.warning("Brevo API returned %s", res.status)
                return False
        current_app.logger.info("Brevo: email sent to %s", to_email)
        return True
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace") if e.fp else ""
        current_app.logger.warning("Brevo API error %s: %s", e.code, body[:200])
        return False
    except Exception as e:
        current_app.logger.warning("Brevo send failed: %s", e)
        return False
