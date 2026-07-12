"""ZeptoMail REST API: https://api.zeptomail.com/v1.1/email"""

from __future__ import annotations

import json
import urllib.error
import urllib.request

from flask import current_app

ZEPTOMAIL_DEFAULT_URL = "https://api.zeptomail.com/v1.1/email"


def _authorization_value(raw_token: str) -> str:
    """
    ZeptoMail expects header: Authorization: Zoho-enczapikey <secret>
    Users may paste either only the secret or the full 'Zoho-enczapikey ...' string from the console.
    """
    raw = (raw_token or "").strip()
    if not raw:
        return ""
    if raw.lower().startswith("zoho-enczapikey"):
        return raw
    return f"Zoho-enczapikey {raw}"


def send_via_zeptomail(
    to_email: str,
    recipient_name: str,
    subject: str,
    text_body: str,
    html_body: str | None = None,
) -> bool:
    """
    Send transactional email via ZeptoMail.
    Requires ZEPTOMAIL_API_TOKEN and ZEPTOMAIL_FROM_EMAIL.
    Zepto allows either htmlbody or textbody per request; HTML is preferred when provided.
    """
    token = (current_app.config.get("ZEPTOMAIL_API_TOKEN") or "").strip()
    from_addr = (current_app.config.get("ZEPTOMAIL_FROM_EMAIL") or "").strip()
    from_name = (current_app.config.get("ZEPTOMAIL_FROM_NAME") or "CRM").strip()
    api_url = (current_app.config.get("ZEPTOMAIL_API_URL") or ZEPTOMAIL_DEFAULT_URL).strip()

    if not token or not from_addr:
        current_app.logger.warning(
            "ZeptoMail: ZEPTOMAIL_API_TOKEN or ZEPTOMAIL_FROM_EMAIL missing"
        )
        return False

    payload: dict = {
        "from": {"address": from_addr, "name": from_name},
        "to": [
            {
                "email_address": {
                    "address": to_email,
                    "name": recipient_name or to_email,
                }
            }
        ],
        "subject": subject,
    }
    if html_body:
        payload["htmlbody"] = html_body
    else:
        payload["textbody"] = text_body

    auth_value = _authorization_value(token)
    if not auth_value:
        return False

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
        with urllib.request.urlopen(req, timeout=20) as res:
            if res.status not in (200, 201):
                current_app.logger.warning("ZeptoMail API returned HTTP %s", res.status)
                return False
        current_app.logger.info("ZeptoMail: email sent to %s", to_email)
        return True
    except urllib.error.HTTPError as e:
        try:
            body = e.read().decode("utf-8", errors="replace")
        except Exception:
            body = ""
        current_app.logger.warning(
            "ZeptoMail API error HTTP %s for %s: %s",
            e.code,
            to_email,
            body.strip() or "(empty response body — check ZEPTOMAIL_API_TOKEN, "
            "ZEPTOMAIL_FROM_EMAIL matches verified sender in ZeptoMail Agent)",
        )
        return False
    except Exception as e:
        current_app.logger.warning("ZeptoMail send failed: %s", e)
        return False


def is_zeptomail_configured() -> bool:
    """True when token and from-address are set (used for routing)."""
    token = (current_app.config.get("ZEPTOMAIL_API_TOKEN") or "").strip()
    from_addr = (current_app.config.get("ZEPTOMAIL_FROM_EMAIL") or "").strip()
    return bool(token and from_addr)
