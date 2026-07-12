# CRM Backend (Flask)

Python Flask REST API for the knit-crm frontend. Uses SQLite by default; the database file is created automatically on first run.

## Default admin user

Every time you **start the backend**, it ensures a default admin user exists:

- **Email:** `admin@apptianlge.com`
- **Password:** `admin123`

If this user already exists, it is left unchanged (no duplicate is created).

Override with environment variables:

- `CRM_ADMIN_EMAIL` – admin email
- `CRM_ADMIN_PASSWORD` – admin password

## Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## Run

From the `backend` directory:

```bash
python run.py
```

Or:

```bash
export FLASK_APP=app:create_app
flask run --host=0.0.0.0 --port=5000
```

The API will be at `http://localhost:5000`. On first run, the SQLite database is created at `instance/crm.db` and the default admin user is created.

## Database file and import

- **Auto-created DB:** Running the app creates `instance/crm.db` (SQLite) and all tables via `db.create_all()`.
- **Schema only:** Use `schema.sql` to create tables in another database (e.g. MySQL/Postgres). Adjust types if needed. After importing, run the app once so the default admin is created (or insert the admin user manually).

To use a different database, set:

```bash
export DATABASE_URL="sqlite:///path/to/crm.db"
# or
export DATABASE_URL="postgresql://user:pass@localhost/crm"
```

Then start the app; tables and admin are created as above.

## Persistent uploads (PMS documents & local files)

PMS task/project documents are saved on disk (not in the database). By default:

- `instance/pms_attachments/` — PMS uploads
- `instance/report_automation/` — generated report files

These paths are **inside the app folder**. On many hosts (Railway, Docker without volumes, etc.), that folder is **wiped on every redeploy**, which removes uploaded files even though database rows remain.

**Redeploy does not delete files by itself** — there is no cleanup code on startup. Files are lost only when the host replaces the filesystem.

### Production setup

Mount persistent storage and point the backend at it:

```env
INSTANCE_DIR=/data/crm-instance
PMS_UPLOAD_DIR=/data/crm-instance/pms_attachments
```

Use an absolute path on a volume that survives redeploys. Create the directory once on the server/volume; the app creates subfolders automatically.

**Railway:** add a [Volume](https://docs.railway.com/guides/volumes), mount e.g. at `/data`, set `INSTANCE_DIR=/data/crm-instance` in service variables.

**Important:** If you already uploaded files to the old ephemeral path, copy them to the persistent volume before switching `INSTANCE_DIR`, or those files cannot be recovered after redeploy.

On startup, the server logs `Persistent storage: INSTANCE_DIR=... PMS_UPLOAD_DIR=...`. If uploads still live under the app directory, a warning is logged.

Other attachments (leaves, HR certs, account entries) are stored **in the database** as base64 and are not affected by disk redeploys.

## External integration API

Machine-to-machine read APIs for external projects (API key auth, not JWT). See [docs/INTEGRATION_API.md](docs/INTEGRATION_API.md).

Set `EXTERNAL_API_KEY` in `.env` (see `.env.example`).

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Login (body: `email`, `password`); returns `user`, `token`, `expiresAt` |
| POST | `/api/auth/logout` | Logout; send `Authorization: Bearer <token>` to revoke token |
| GET | `/api/users` | List users |
| GET | `/api/users/<id>` | Get user |
| POST | `/api/users` | **Admin only.** Create user (body: `name`, `email`, `password`, `phone?`, `role?`). Sends welcome email if mail is configured. |
| PUT | `/api/users/<id>` | **Admin only.** Update user (body: `name`, `email`, `phone`, `role`, `isActive`). |
| GET/POST | `/api/companies` | List / create companies |
| GET/PUT/PATCH/DELETE | `/api/companies/<id>` | Get / update / delete company |
| GET/POST | `/api/contacts` | List (optional `?companyId=`) / create contacts |
| GET/PUT/PATCH/DELETE | `/api/contacts/<id>` | Get / update / delete contact |
| GET/POST | `/api/tasks` | List / create tasks |
| GET/PUT/PATCH/DELETE | `/api/tasks/<id>` | Get / update / delete task |
| PATCH | `/api/tasks/<id>/status` | Change task status |
| GET | `/api/tasks/<id>/logs` | Task activity logs |
| GET/POST | `/api/sales` | List / create sales |
| GET/PUT/PATCH/DELETE | `/api/sales/<id>` | Get / update / delete sale |
| PATCH | `/api/sales/<id>/status` | Change sale status (body: `status`, `note`, `changedByUserId`) |
| GET | `/api/sales/<id>/logs` | Sales status change logs |
| GET/POST | `/api/sales/<id>/activities` | List / create activities |
| PUT/PATCH/DELETE | `/api/sales/<id>/activities/<aid>` | Update / delete activity |

### RBAC (module access: `none` \| `user` \| `admin`)

- **`none`**: no access to that module (sidebar/routes should hide it when enforced).
- **`user`**: can open the module; list APIs should scope to that user’s own data where applicable.
- **`admin`**: can open the module; list APIs may return all data.

Defaults per global `User.role` (`admin` / `user`) are stored in `role_page_defaults`; optional per-user overrides in `user_page_permissions`. If no row exists, fallback is: global admin → page access `admin`, global user → page access `user`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/rbac/pages` | Auth required. Canonical 11 modules (`pageKey` + `label`). |
| GET | `/api/rbac/me` | Auth required. `effective` plus `navPageKeys`: **all** canonical modules for global `admin` users; for `user` role, only modules with explicit `user_page_permissions` (`admin` or `user` access). |
| GET | `/api/rbac/role-defaults` | **Admin.** Pages + default matrix for roles `admin` and `user`. |
| PUT | `/api/rbac/role-defaults` | **Admin.** Save role defaults: `{ "matrix": { "admin": [...], "user": [...] } }` (each item `pageKey`, `accessType`). |
| GET | `/api/rbac/users/<id>` | **Admin.** Explicit overrides + effective map for one user. |
| PUT | `/api/rbac/users/<id>` | **Admin.** Upsert per-user overrides: `{ "permissions": [...] }`. |
| DELETE | `/api/rbac/users/<id>/pages/<pageKey>` | **Admin.** Remove per-user override for one module. |
| GET | `/api/rbac/assignment-matrix` | **Admin.** Grid data: each module has `admin` and `user` arrays of `{ id, name, email }` (explicit `user_page_permissions` only). |
| POST | `/api/rbac/assignments` | **Admin.** Body `{ userId, pageKey, accessType: "admin" \| "user" }` — upserts assignment; returns updated `assignment-matrix` payload. |

Response keys use camelCase (e.g. `companyId`, `createdAt`) to align with the frontend.

## Welcome email (optional)

When an admin creates a user via `POST /api/users`, the backend can send a welcome email with login email and password. If neither Brevo nor SMTP is configured, the user is still created but no email is sent.

### Option 1: Brevo (recommended)

Use [Brevo](https://www.brevo.com/) (formerly Sendinblue) transactional API. Get your API key from **Brevo → Settings → SMTP & API → API Keys**.

In `.env`:

```env
BREVO_API_KEY=your-api-key-here
BREVO_SENDER_EMAIL=noreply@yourdomain.com
BREVO_SENDER_NAME=CRM
FRONTEND_URL=https://your-crm.example.com
```

- `BREVO_SENDER_EMAIL` must be a verified sender in your Brevo account.
- `BREVO_SENDER_NAME` is optional (default: `CRM`).
- `FRONTEND_URL` is used for the “Log in” button/link in the welcome email (default: `http://localhost:8080`). No trailing slash.

### Option 2: Generic SMTP

If `BREVO_API_KEY` is not set, the app falls back to SMTP. Set in `.env`:

- `MAIL_SERVER` – SMTP host (e.g. `smtp.gmail.com`)
- `MAIL_PORT` – usually `587`
- `MAIL_USE_TLS` – `true`
- `MAIL_USERNAME` – SMTP username
- `MAIL_PASSWORD` – SMTP password or app password
- `MAIL_DEFAULT_SENDER` – From address
