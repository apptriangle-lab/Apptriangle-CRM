"""Transactional email entry points: routes sends through ZeptoMail, Brevo, or SMTP."""

from flask import current_app

from app.email_providers.brevo import send_via_brevo
from app.email_providers.smtp_mail import send_via_smtp
from app.email_providers.zeptomail import is_zeptomail_configured, send_via_zeptomail


def send_transactional_email(
    to_email: str,
    recipient_name: str,
    subject: str,
    text_body: str,
    html_body: str | None = None,
) -> bool:
    """
    Send a transactional email.

    Provider order:
      1. ZeptoMail — when ZEPTOMAIL_API_TOKEN and ZEPTOMAIL_FROM_EMAIL are set
      2. Brevo — when BREVO_API_KEY is set
      3. SMTP — when MAIL_SERVER is set

    Returns True if a provider accepted the message.
    """
    if is_zeptomail_configured():
        return send_via_zeptomail(
            to_email, recipient_name, subject, text_body, html_body
        )

    if current_app.config.get("BREVO_API_KEY"):
        return send_via_brevo(
            to_email, recipient_name, subject, text_body, html_body
        )

    server = (current_app.config.get("MAIL_SERVER") or "").strip()
    if not server:
        current_app.logger.info(
            "No ZeptoMail, Brevo, or SMTP configured; skipping email to %s (subject: %s)",
            to_email,
            subject,
        )
        return False

    from_addr = (
        current_app.config.get("MAIL_DEFAULT_SENDER")
        or current_app.config.get("MAIL_USERNAME")
        or "noreply@crm"
    )
    return send_via_smtp(to_email, subject, text_body, from_addr, html_body)


def send_welcome_email(to_email: str, name: str, login_email: str, password: str) -> bool:
    """Send welcome email with login credentials. Returns True if sent."""
    frontend_url = (current_app.config.get("FRONTEND_URL") or "http://localhost:8080").rstrip(
        "/"
    )
    login_url = f"{frontend_url}/login"

    subject = "Welcome to CRM – Your login details"

    text_body = f"""Hello {name},

Your CRM account has been created. You can sign in with:

Email: {login_email}
Password: {password}

Log in here: {login_url}

Best regards,
CRM Team
"""

    html_body = f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @media only screen and (max-width: 600px) {{
      .container {{ width: 100% !important; padding: 10px !important; }}
      .card {{ padding: 25px !important; }}
    }}
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f7fa; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f4f7fa; padding: 40px 0;">
    <tr>
      <td align="center">
        <table class="container" width="550" border="0" cellspacing="0" cellpadding="0" style="width: 550px;">
          <tr>
            <td align="center" style="padding-bottom: 30px;">
              <span style="font-size: 22px; font-weight: 800; color: #1e293b; letter-spacing: -0.5px;">CRM PLATFORM</span>
            </td>
          </tr>
          <tr>
            <td class="card" style="background-color: #ffffff; padding: 40px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
              <h1 style="margin: 0 0 16px 0; color: #0f172a; font-size: 22px; font-weight: 700;">Welcome, {name}!</h1>
              <p style="margin: 0 0 24px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                Your professional CRM account is ready. Use the secure credentials below to access your dashboard.
              </p>
              
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.05em;">Email Address</p>
                    <p style="margin: 0 0 16px 0; font-size: 16px; color: #1e293b; font-weight: 500;">{login_email}</p>
                    <p style="margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.05em;">Temporary Password</p>
                    <p style="margin: 0; font-size: 16px; color: #1e293b; font-family: monospace; background: #e2e8f0; padding: 4px 8px; border-radius: 4px; display: inline-block;">{password}</p>
                  </td>
                </tr>
              </table>

              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="{login_url}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">Sign In to Dashboard</a>
                  </td>
                </tr>
              </table>

              <p style="margin: 30px 0 0 0; font-size: 14px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 20px;">
                For security, please change your password immediately after your first login.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 30px 0; font-size: 13px; color: #94a3b8;">
                &copy; 2026 CRM Team. All rights reserved.<br>
                This is an automated security notification.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""

    return send_transactional_email(to_email, name, subject, text_body, html_body)
