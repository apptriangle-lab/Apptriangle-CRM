"""Companies API: list (page admin=all, page user=own created), CRUD.

User scope sees only companies where created_by_user_id is the current user.
Legacy rows with NULL creator are visible only to Companies admin scope.
"""
from flask import Blueprint, request, jsonify
from sqlalchemy import func, or_
from app import db
from app.models import Company, Currency, User
from app.auth_utils import get_current_user
from app.services.rbac_service import ACCESS_NONE, ACCESS_ADMIN, get_effective_page_access
from app.services.company_excel_import import parse_company_excel

BULK_MAX_ITEMS = 2000

companies_bp = Blueprint("companies", __name__)

PAGE_KEY_COMPANIES = "companies"


def _companies_access(user) -> str:
    return get_effective_page_access(user, PAGE_KEY_COMPANIES)


def _is_companies_admin(user) -> bool:
    return _companies_access(user) == ACCESS_ADMIN


def _user_can_access_company(current_user, company: Company) -> bool:
    access = _companies_access(current_user)
    if access == ACCESS_NONE:
        return False
    if _is_companies_admin(current_user):
        return True
    return company.created_by_user_id == current_user.id


def _norm_company_key(name: str, country: str) -> tuple[str, str]:
    n = " ".join((name or "").strip().split()).lower()
    c = " ".join((country or "").strip().split()).lower()
    return (n, c)


def _load_existing_company_keys() -> set[tuple[str, str]]:
    keys: set[tuple[str, str]] = set()
    for row in Company.query.with_entities(Company.name, Company.country).all():
        keys.add(_norm_company_key(row[0] or "", row[1] or ""))
    return keys


def _resolve_currency_id(data: dict) -> tuple[str | None, str | None]:
    """Returns (currency_id, error_message)."""
    cid = data.get("currencyId")
    if cid is not None and str(cid).strip() != "":
        cur = Currency.query.get(str(cid).strip())
        if cur is None:
            return None, "Invalid currencyId"
        return cur.id, None
    code = (data.get("currencyCode") or "").strip()
    if code:
        cur = Currency.query.filter(func.upper(Currency.code) == code.upper()).first()
        if cur is None:
            return None, f"Unknown currency code: {code}"
        return cur.id, None
    return None, "Currency is required (currencyId or currencyCode)"


def _resolve_kam_user_id(data: dict) -> tuple[str | None, str | None]:
    """Returns (kam_user_id, error_message)."""
    kid = data.get("kamUserId")
    if kid is not None and str(kid).strip() != "":
        uid = str(kid).strip()
        if User.query.get(uid) is None:
            return None, "Invalid kamUserId"
        return uid, None
    email = (data.get("kamEmail") or "").strip()
    if email:
        u = User.query.filter(func.lower(User.email) == email.lower()).first()
        if u is None:
            return None, f"No user with email: {email}"
        return u.id, None
    name = (data.get("kamUserName") or "").strip()
    if name:
        target = " ".join(name.split()).lower()
        matches = User.query.filter(func.lower(User.name) == target).all()
        if len(matches) == 0:
            return None, f"No user with name: {name}"
        if len(matches) > 1:
            return None, f"Multiple users named '{name}' — use kamEmail or kamUserId"
        return matches[0].id, None
    return None, "Key Account Manager is required (kamUserId, kamEmail, or kamUserName)"


def _run_bulk_import(current_user, items: list, skip_duplicates: bool, stop_on_error: bool):
    """Shared bulk insert. `items` is a list of dicts with fields for _resolve_currency_id / _resolve_kam_user_id."""
    existing_keys = _load_existing_company_keys()
    pending_keys = set(existing_keys)

    validated_rows: list[dict] = []
    for index, raw in enumerate(items):
        if not isinstance(raw, dict):
            validated_rows.append(
                {"index": index, "status": "error", "error": "Each item must be an object"}
            )
            continue
        name = (raw.get("name") or "").strip()
        location = (raw.get("location") or "").strip()
        country = (raw.get("country") or "").strip()
        if not name:
            validated_rows.append({"index": index, "status": "error", "error": "Name is required"})
            continue
        if not location:
            validated_rows.append({"index": index, "status": "error", "error": "Location is required"})
            continue
        if not country:
            validated_rows.append({"index": index, "status": "error", "error": "Country is required"})
            continue

        currency_id, cur_err = _resolve_currency_id(raw)
        if cur_err:
            validated_rows.append({"index": index, "status": "error", "error": cur_err})
            continue

        kam_user_id, kam_err = _resolve_kam_user_id(raw)
        if kam_err:
            validated_rows.append({"index": index, "status": "error", "error": kam_err})
            continue

        key = _norm_company_key(name, country)
        if key in pending_keys:
            if skip_duplicates:
                validated_rows.append(
                    {
                        "index": index,
                        "status": "skipped",
                        "reason": "duplicate",
                        "name": name,
                        "country": country,
                    }
                )
            else:
                validated_rows.append(
                    {
                        "index": index,
                        "status": "error",
                        "error": "Duplicate name and country (already exists or repeated in batch)",
                    }
                )
            continue

        pending_keys.add(key)
        validated_rows.append(
            {
                "index": index,
                "status": "pending",
                "company": Company(
                    name=name,
                    location=location,
                    country=country,
                    currency_id=currency_id,
                    kam_user_id=kam_user_id,
                    created_by_user_id=current_user.id,
                ),
            }
        )

    if stop_on_error:
        bad = [r for r in validated_rows if r["status"] == "error"]
        if bad:
            return (
                {
                    "error": "Validation failed (stopOnError)",
                    "results": [
                        {"index": b["index"], "status": "error", "error": b["error"]} for b in bad
                    ],
                },
                400,
            )

    created_out: list[dict] = []
    results_out: list[dict] = []

    for row in validated_rows:
        if row["status"] == "error":
            results_out.append(
                {"index": row["index"], "status": "error", "error": row["error"]}
            )
        elif row["status"] == "skipped":
            results_out.append(
                {
                    "index": row["index"],
                    "status": "skipped",
                    "reason": row["reason"],
                    "name": row.get("name"),
                    "country": row.get("country"),
                }
            )
        else:
            c: Company = row["company"]
            db.session.add(c)
            created_out.append({"index": row["index"], "company": c})

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return ({"error": "Database error", "detail": str(e)}, 500)

    id_by_index = {entry["index"]: entry["company"].to_dict() for entry in created_out}

    for row in validated_rows:
        if row["status"] != "pending":
            continue
        idx = row["index"]
        results_out.append({"index": idx, "status": "created", "company": id_by_index[idx]})

    results_out.sort(key=lambda x: x["index"])

    summary = {
        "created": sum(1 for r in results_out if r["status"] == "created"),
        "skipped": sum(1 for r in results_out if r["status"] == "skipped"),
        "errors": sum(1 for r in results_out if r["status"] == "error"),
    }
    return ({"summary": summary, "results": results_out}, 200)


@companies_bp.route("/bulk", methods=["POST"])
def bulk_create_companies():
    """Create many companies in one request. Skips rows that duplicate name+country (optional).

    Each item supports the same fields as POST /companies, plus:
    - currencyCode: alternative to currencyId (e.g. BDT)
    - kamEmail: alternative to kamUserId
    - kamUserName: case-insensitive match on User.name (must be unique)

    Body JSON:
      items: array of objects (required)
      skipDuplicates: bool (default true) — skip if name+country already exists (DB or same batch)
      stopOnError: bool (default false) — if true, no inserts when any row fails validation
    """
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Authentication required"}), 401
    if _companies_access(current_user) == ACCESS_NONE:
        return jsonify({"error": "No access to Companies"}), 403

    payload = request.get_json() or {}
    items = payload.get("items")
    if not isinstance(items, list):
        return jsonify({"error": "items must be a non-empty array"}), 400
    if len(items) == 0:
        return jsonify({"error": "items must not be empty"}), 400
    if len(items) > BULK_MAX_ITEMS:
        return jsonify({"error": f"At most {BULK_MAX_ITEMS} items allowed"}), 400

    skip_duplicates = payload.get("skipDuplicates", True)
    if not isinstance(skip_duplicates, bool):
        skip_duplicates = True
    stop_on_error = payload.get("stopOnError", False)
    if not isinstance(stop_on_error, bool):
        stop_on_error = False

    body, status = _run_bulk_import(current_user, items, skip_duplicates, stop_on_error)
    return jsonify(body), status


@companies_bp.route("/bulk-upload", methods=["POST"])
def bulk_upload_companies():
    """Upload .xlsx with columns Name, KeyAccountManager, Location, Country/County.

    Resolves **BDT** from the database (currency code) and maps **Key Account Manager** by **user name**
    (same rules as `kamUserName` in POST /api/companies/bulk).

    Form fields:
      file: Excel file (.xlsx / .xlsm) — required
      skipDuplicates: optional, default true (same as /bulk)
      stopOnError: optional, default false
      currencyCode: optional, default BDT — must exist in `currencies` table
    """
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Authentication required"}), 401
    if _companies_access(current_user) == ACCESS_NONE:
        return jsonify({"error": "No access to Companies"}), 403

    if "file" not in request.files:
        return jsonify({"error": "Missing form field 'file' (Excel .xlsx)"}), 400
    upload = request.files["file"]
    if not upload or not upload.filename:
        return jsonify({"error": "No file selected"}), 400

    skip_duplicates = request.form.get("skipDuplicates", "true").lower() in ("1", "true", "yes", "on")
    stop_on_error = request.form.get("stopOnError", "").lower() in ("1", "true", "yes", "on")
    currency_code = (request.form.get("currencyCode") or "BDT").strip().upper() or "BDT"

    cur = Currency.query.filter(func.upper(Currency.code) == currency_code).first()
    if cur is None:
        return (
            jsonify(
                {
                    "error": f"Currency code '{currency_code}' not found in database. Add it under Settings → Currencies."
                }
            ),
            400,
        )

    try:
        rows = parse_company_excel(upload.stream, upload.filename)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    if not rows:
        return jsonify({"error": "No data rows found (after header). Check that the Name column has values."}), 400

    items = []
    for r in rows:
        items.append(
            {
                "name": r["name"],
                "location": r["location"],
                "country": r["country"],
                "currencyId": cur.id,
                "kamUserName": r["kamUserName"],
            }
        )

    body, status = _run_bulk_import(current_user, items, skip_duplicates, stop_on_error)
    if status != 200:
        return jsonify(body), status
    body["excel"] = {
        "fileName": upload.filename,
        "rowsRead": len(rows),
        "currencyCode": currency_code,
        "currencyId": cur.id,
    }
    return jsonify(body), 200


@companies_bp.route("", methods=["GET"])
def list_companies():
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Authentication required"}), 401
    if _companies_access(current_user) == ACCESS_NONE:
        return jsonify({"error": "No access to Companies"}), 403
    country = request.args.get("country")
    kam_user_id = request.args.get("kamUserId")
    search = (request.args.get("search") or "").strip()
    q = Company.query
    if not _is_companies_admin(current_user):
        q = q.filter(Company.created_by_user_id == current_user.id)
    if country and country != "all":
        q = q.filter(Company.country == country)
    if kam_user_id and kam_user_id != "all":
        q = q.filter(Company.kam_user_id == kam_user_id)
    if search:
        term = f"%{search.lower()}%"
        q = q.outerjoin(User, Company.kam_user_id == User.id).filter(
            or_(
                func.lower(Company.name).like(term),
                func.lower(func.coalesce(Company.location, "")).like(term),
                func.lower(func.coalesce(Company.country, "")).like(term),
                func.lower(func.coalesce(User.name, "")).like(term),
            )
        )
    companies = q.order_by(Company.updated_at.desc()).all()
    return jsonify([c.to_dict() for c in companies]), 200


@companies_bp.route("", methods=["POST"])
def create_company():
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Authentication required"}), 401
    if _companies_access(current_user) == ACCESS_NONE:
        return jsonify({"error": "No access to Companies"}), 403
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    location = (data.get("location") or "").strip()
    country = (data.get("country") or "").strip()
    currency_id = data.get("currencyId") or None
    if currency_id == "":
        currency_id = None
    kam_user_id = data.get("kamUserId") or None
    if kam_user_id == "":
        kam_user_id = None
    if not name:
        return jsonify({"error": "Name is required"}), 400
    if not location:
        return jsonify({"error": "Location is required"}), 400
    if not country:
        return jsonify({"error": "Country is required"}), 400
    if not currency_id:
        return jsonify({"error": "Currency is required"}), 400
    if Currency.query.get(currency_id) is None:
        return jsonify({"error": "Invalid currency"}), 400
    if not kam_user_id:
        return jsonify({"error": "Key Account Manager (KAM) is required"}), 400
    company = Company(
        name=name,
        location=location,
        country=country,
        currency_id=currency_id,
        kam_user_id=kam_user_id,
        created_by_user_id=current_user.id,
    )
    db.session.add(company)
    db.session.commit()
    return jsonify(company.to_dict()), 201


@companies_bp.route("/<company_id>", methods=["GET"])
def get_company(company_id):
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Authentication required"}), 401
    if _companies_access(current_user) == ACCESS_NONE:
        return jsonify({"error": "No access to Companies"}), 403
    company = Company.query.get(company_id)
    if not company:
        return jsonify({"error": "Company not found"}), 404
    if not _user_can_access_company(current_user, company):
        return jsonify({"error": "Not allowed to view this company"}), 403
    return jsonify(company.to_dict()), 200


@companies_bp.route("/<company_id>", methods=["PUT", "PATCH"])
def update_company(company_id):
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Authentication required"}), 401
    if _companies_access(current_user) == ACCESS_NONE:
        return jsonify({"error": "No access to Companies"}), 403
    company = Company.query.get(company_id)
    if not company:
        return jsonify({"error": "Company not found"}), 404
    if not _user_can_access_company(current_user, company):
        return jsonify({"error": "Not allowed to update this company"}), 403
    data = request.get_json() or {}
    if "name" in data:
        company.name = (data["name"] or "").strip() or company.name
    if "location" in data:
        company.location = data["location"] or ""
    if "country" in data:
        company.country = data["country"] or ""
    if "currencyId" in data:
        cid = data["currencyId"] or None
        if cid and Currency.query.get(cid) is None:
            return jsonify({"error": "Invalid currency"}), 400
        company.currency_id = cid
    if "kamUserId" in data:
        company.kam_user_id = data["kamUserId"] or None
    db.session.commit()
    return jsonify(company.to_dict()), 200


@companies_bp.route("/<company_id>", methods=["DELETE"])
def delete_company(company_id):
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Authentication required"}), 401
    if _companies_access(current_user) == ACCESS_NONE:
        return jsonify({"error": "No access to Companies"}), 403
    company = Company.query.get(company_id)
    if not company:
        return jsonify({"error": "Company not found"}), 404
    if not _user_can_access_company(current_user, company):
        return jsonify({"error": "Not allowed to delete this company"}), 403
    db.session.delete(company)
    db.session.commit()
    return jsonify({"ok": True}), 200
