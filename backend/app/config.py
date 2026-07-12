import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def _resolve_data_dir(env_key: str, default: Path) -> Path:
    raw = (os.environ.get(env_key) or "").strip()
    path = Path(raw).expanduser() if raw else default
    resolved = path.resolve()
    resolved.mkdir(parents=True, exist_ok=True)
    return resolved


INSTANCE_DIR = _resolve_data_dir("INSTANCE_DIR", BASE_DIR / "instance")
DEFAULT_DB_PATH = INSTANCE_DIR / "crm.db"
PMS_UPLOAD_DIR = _resolve_data_dir("PMS_UPLOAD_DIR", INSTANCE_DIR / "pms_attachments")


def instance_dir_is_inside_app() -> bool:
    """True when local uploads/DB files live under the app tree (often wiped on redeploy)."""
    try:
        INSTANCE_DIR.relative_to(BASE_DIR.resolve())
        return True
    except ValueError:
        return False


def _database_uri():
    url = os.environ.get("DATABASE_URL", f"sqlite:///{DEFAULT_DB_PATH}")

    if url.startswith("mysql://"):
        url = "mysql+pymysql://" + url[len("mysql://") :]  

    return url


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-in-production")
    JWT_SECRET_KEY = os.environ.get(
        "JWT_SECRET_KEY",
        os.environ.get("SECRET_KEY", "dev-secret-change-in-production"),
    )
    # 0 = token valid until logout (no JWT exp claim). Set e.g. 24 to auto-expire after N hours.
    JWT_EXPIRY_HOURS = int(os.environ.get("JWT_EXPIRY_HOURS", "0"))
    SQLALCHEMY_DATABASE_URI = _database_uri()
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Frontend URL (for login link in welcome email)
    FRONTEND_URL = (os.environ.get("FRONTEND_URL") or "http://localhost:8080").rstrip(
        "/"
    )

    # ZeptoMail: transactional email (https://api.zeptomail.com/v1.1/email)
    # When ZEPTOMAIL_API_TOKEN and ZEPTOMAIL_FROM_EMAIL are set, they take priority over Brevo/SMTP.
    ZEPTOMAIL_API_TOKEN = os.environ.get("ZEPTOMAIL_API_TOKEN", "").strip()
    ZEPTOMAIL_FROM_EMAIL = os.environ.get("ZEPTOMAIL_FROM_EMAIL", "").strip()
    ZEPTOMAIL_FROM_NAME = os.environ.get("ZEPTOMAIL_FROM_NAME", "CRM").strip()
    ZEPTOMAIL_API_URL = (
        os.environ.get("ZEPTOMAIL_API_URL") or "https://api.zeptomail.com/v1.1/email"
    ).strip()

    # Brevo: transactional email via Brevo API (used if ZeptoMail is not configured)
    BREVO_API_KEY = os.environ.get("BREVO_API_KEY", "")
    BREVO_SENDER_EMAIL = os.environ.get("BREVO_SENDER_EMAIL", "")
    BREVO_SENDER_NAME = os.environ.get("BREVO_SENDER_NAME", "CRM")

    # Mail fallback: generic SMTP (if Brevo not used)
    MAIL_SERVER = os.environ.get("MAIL_SERVER", "")
    MAIL_PORT = int(os.environ.get("MAIL_PORT", "587"))
    MAIL_USE_TLS = os.environ.get("MAIL_USE_TLS", "true").lower() in (
        "1",
        "true",
        "yes",
    )
    MAIL_USERNAME = os.environ.get("MAIL_USERNAME", "")
    MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD", "")
    MAIL_DEFAULT_SENDER = os.environ.get("MAIL_DEFAULT_SENDER", "")

    # Fernet key (urlsafe base64, 32 bytes) for encrypting stored credential passwords.
    # If unset, a key is derived from JWT_SECRET_KEY (rotate JWT invalidates decrypt of old rows).
    CREDENTIALS_FERNET_KEY = os.environ.get("CREDENTIALS_FERNET_KEY", "").strip() or None

    # External integration APIs (x-api-key header). Leave unset to disable integration routes.
    EXTERNAL_API_KEY = os.environ.get("EXTERNAL_API_KEY", "").strip()
