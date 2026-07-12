# External Integration API

Read-only HTTP APIs for external systems to consume CRM data without user JWT login.

## Base URL

Development:

```text
http://localhost:5000
```

Production: use your deployed CRM API host.

All endpoints are prefixed with:

```text
/api/integrations
```

## Authentication

Send a static API key on every request:

```http
x-api-key: <EXTERNAL_API_KEY>
```

Configure the key in the CRM backend environment:

```bash
EXTERNAL_API_KEY=your_secure_api_key_here
```

| Condition | HTTP status | Response |
|-----------|-------------|----------|
| `EXTERNAL_API_KEY` not set on server | 503 | Integration API disabled |
| Header missing | 401 | API key is required |
| Header present but wrong | 403 | Invalid API key |
| Valid key | 200 | Success payload |

JWT / session tokens are **not** used for these routes. Existing internal APIs are unchanged.

## Response format

Success:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "count": 0
  }
}
```

Month-based endpoints include `"month": "YYYY-MM"` in `meta`. Expenses use `"entryCount"` instead of `"count"`.

Error:

```json
{
  "success": false,
  "message": "Error message here"
}
```

## Endpoints

### `GET /api/integrations/employees`

Returns active employee directory data.

**Query params:** none

**Example:**

```bash
curl -s -H "x-api-key: YOUR_API_KEY" \
  "http://localhost:5000/api/integrations/employees"
```

---

### `GET /api/integrations/attendance?month=YYYY-MM`

**Query params:**

| Param | Required | Format | Example |
|-------|----------|--------|---------|
| `month` | yes | `YYYY-MM` | `2026-06` |

**Example:**

```bash
curl -s -H "x-api-key: YOUR_API_KEY" \
  "http://localhost:5000/api/integrations/attendance?month=2026-06"
```

---

### `GET /api/integrations/leaves?month=YYYY-MM`

Returns leave requests overlapping the given calendar month.

---

### `GET /api/integrations/expenses?month=YYYY-MM`

Returns **unpaid** expense entries for the given month and a computed summary. Paid expenses are excluded.

**Success `data` shape:**

```json
{
  "entries": [],
  "summary": {
    "totalAmount": 0,
    "paidAmount": 0,
    "unpaidAmount": 0,
    "entryCount": 0
  }
}
```

---

### `POST /api/integrations/expenses/mark-paid?month=YYYY-MM`

Marks **unpaid** expenses in the given month as **paid** for specific users only. Same API key auth as other integration routes.

**Query params:**

| Param | Required | Format | Example |
|-------|----------|--------|---------|
| `month` | yes | `YYYY-MM` | `2026-06` |
| `userIds` | yes* | Comma-separated CRM `userId` values | `8ae8b792a5c1,abc123def456` |

\*Alternatively send `userIds` as a JSON array in the POST body (see below). At least one user ID is required.

**Option A — query string:**

```bash
curl -s -X POST -H "x-api-key: YOUR_API_KEY" \
  "http://localhost:5000/api/integrations/expenses/mark-paid?month=2026-06&userIds=8ae8b792a5c1,abc123def456"
```

**Option B — JSON body:**

```bash
curl -s -X POST -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"userIds":["8ae8b792a5c1","abc123def456","def789ghi012"]}' \
  "http://localhost:5000/api/integrations/expenses/mark-paid?month=2026-06"
```

Use the `userId` field from `GET /api/integrations/employees` (not `employeeId`). Only expenses **created by** those users (`created_by_user_id`) are updated.

**Success `data` shape:**

```json
{
  "month": "2026-06",
  "userIds": ["8ae8b792a5c1", "abc123def456"],
  "updatedCount": 5,
  "totalAmountMarkedPaid": 12500.0
}
```

If no matching unpaid expenses exist for those users in the month, `updatedCount` is `0` and `totalAmountMarkedPaid` is `0`.

---

### `GET /api/integrations/food-allowances?month=YYYY-MM`

Returns **one row per active employee** with the net food balance change for that month (aggregated from lunch votes). Does not return individual meal rows.

`foodBalanceTotal` is signed: **negative** for office meals (deductions), **positive** for personal meal credits, **0** when there was no lunch activity.

**Example row:**

```json
{
  "employeeId": "EMP-001",
  "employeeName": "Jane Doe",
  "month": "2026-06",
  "foodBalanceTotal": -650.0
}
```

`meta.totalFoodBalance` is the signed net sum across all employees for the month.

`meta.totalPositiveFoodBalance` is the sum of employee rows with a positive `foodBalanceTotal`.

`meta.totalNegativeFoodBalance` is the sum of employee rows with a negative `foodBalanceTotal` (negative value).

## Example success response (employees)

```json
{
  "success": true,
  "data": [
    {
      "employeeId": "EMP-001",
      "userId": "abc123",
      "name": "Jane Doe",
      "email": "jane@company.com",
      "department": "Engineering",
      "designation": "Developer",
      "mobile": "+8801...",
      "bankName": null,
      "bankRoutingNumber": "123456",
      "beneficiaryBankAccountNumber": "9876543210",
      "receiverName": "Jane Doe",
      "joiningDate": "2024-03-15",
      "isActive": true
    }
  ],
  "meta": {
    "count": 1
  }
}
```

## Example error responses

Missing API key (401):

```json
{
  "success": false,
  "message": "API key is required"
}
```

Invalid API key (403):

```json
{
  "success": false,
  "message": "Invalid API key"
}
```

Missing month (400):

```json
{
  "success": false,
  "message": "month query parameter is required"
}
```

Invalid month format (400):

```json
{
  "success": false,
  "message": "month must be in YYYY-MM format"
}
```

## Test checklist (curl)

Replace `YOUR_API_KEY` and port as needed.

```bash
# Valid employees
curl -i -H "x-api-key: YOUR_API_KEY" \
  "http://localhost:5000/api/integrations/employees"

# Missing API key (expect 401)
curl -i "http://localhost:5000/api/integrations/employees"

# Invalid API key (expect 403)
curl -i -H "x-api-key: wrong" \
  "http://localhost:5000/api/integrations/employees"

# Missing month (expect 400)
curl -i -H "x-api-key: YOUR_API_KEY" \
  "http://localhost:5000/api/integrations/attendance"

# Invalid month (expect 400)
curl -i -H "x-api-key: YOUR_API_KEY" \
  "http://localhost:5000/api/integrations/attendance?month=2026-13"

# Valid month, possibly empty data
curl -i -H "x-api-key: YOUR_API_KEY" \
  "http://localhost:5000/api/integrations/attendance?month=2026-06"

curl -i -H "x-api-key: YOUR_API_KEY" \
  "http://localhost:5000/api/integrations/leaves?month=2026-06"

curl -i -H "x-api-key: YOUR_API_KEY" \
  "http://localhost:5000/api/integrations/expenses?month=2026-06"

curl -i -X POST -H "x-api-key: YOUR_API_KEY" \
  "http://localhost:5000/api/integrations/expenses/mark-paid?month=2026-06&userIds=USER_ID_1,USER_ID_2"

curl -i -H "x-api-key: YOUR_API_KEY" \
  "http://localhost:5000/api/integrations/food-allowances?month=2026-06"
```

## Data source mapping

The requested `crm_*` cache table names are **logical** names. This CRM reads from existing operational tables:

| Integration endpoint | Physical tables |
|---------------------|-------------------|
| employees | `users`, `hr_info` |
| attendance | `attendance` |
| leaves | `leaves`, `leave_types` |
| expenses | `expenses`, `expense_purposes` |
| food-allowances | `lunch_votes`, `lunch_polls`, `users` |

## Field availability notes

| Field | Availability |
|-------|----------------|
| `bankName` | Not stored in DB — returned as `null` |
| `joiningDate` | From `hr_info.joining_date` — `YYYY-MM-DD`, or `null` if not set |
| `overtime` | Not stored — returned as `null` |
| `lateMinutes` | Computed when status is `late` and employee shift is configured |
| `totalWorkingHours` | Computed from check-in/check-out when both exist |
| Expense `employeeId` | Uses expense creator (`created_by_user_id`) |

Sensitive fields (passwords, JWT, attachment binary data) are never exposed.
