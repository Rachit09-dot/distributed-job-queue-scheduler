# API Reference

Base URL: `http://localhost:4000/api`

All protected endpoints require:
```
Authorization: Bearer <jwt_token>
```

All responses use this envelope:
```json
{ "success": true, "data": {}, "message": "..." }
{ "success": false, "message": "...", "errorCode": "SNAKE_CASE_CODE" }
```

---

## Authentication

### POST /auth/register

Register a new user.

**Body**
```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "password": "securepassword"
}
```

**Response 201**
```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "name": "Jane Smith", "email": "jane@example.com", "role": "USER" },
    "token": "eyJ..."
  }
}
```

**Errors**: 400 validation, 409 email already registered

---

### POST /auth/login

**Body**
```json
{ "email": "jane@example.com", "password": "securepassword" }
```

**Response 200** — same shape as register.

**Errors**: 400 validation, 401 invalid credentials

---

### GET /auth/me

Returns the authenticated user's profile.

**Response 200**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Jane Smith",
    "email": "jane@example.com",
    "role": "USER",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "_count": { "jobs": 14 }
  }
}
```

---

## Jobs

### POST /jobs

Create and enqueue a job.

**Body**
```json
{
  "type": "DATA_PROCESSING",
  "payload": { "numbers": [1, 2, 3, 4, 5] },
  "priority": "NORMAL",
  "maxAttempts": 3,
  "scheduledAt": "2026-10-04T10:00:00.000Z",
  "idempotencyKey": "optional-unique-client-key"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `type` | enum | ✓ | See Job Types below |
| `payload` | object | — | Defaults to `{}` |
| `priority` | enum | — | `LOW\|NORMAL\|HIGH\|CRITICAL`, default `NORMAL` |
| `maxAttempts` | int 1–10 | — | Default `3` |
| `scheduledAt` | ISO 8601 | — | Must be in the future. Omit for immediate execution |
| `idempotencyKey` | string ≤128 | — | Prevents duplicate creation |

**Response 201**
```json
{
  "success": true,
  "data": { "id": "uuid", "status": "QUEUED", "type": "DATA_PROCESSING", ... },
  "message": "Job created successfully"
}
```

**Errors**: 400 validation, 401 unauthenticated, 409 rate limit or duplicate

---

### GET /jobs

List jobs with filtering and pagination.

**Query params**

| Param | Type | Example |
|---|---|---|
| `status` | enum | `QUEUED`, `RUNNING`, `COMPLETED`, `FAILED` |
| `priority` | enum | `HIGH` |
| `type` | enum | `DATA_PROCESSING` |
| `page` | int | `1` |
| `limit` | int (max 100) | `20` |
| `sortBy` | string | `createdAt` |
| `sortOrder` | `asc\|desc` | `desc` |

**Response 200**
```json
{
  "success": true,
  "data": [ { "id": "...", "type": "...", "status": "QUEUED", ... } ],
  "pagination": {
    "page": 1, "limit": 20, "total": 47,
    "totalPages": 3, "hasNext": true, "hasPrev": false
  }
}
```

Normal users see only their own jobs. Admins see all jobs.

---

### GET /jobs/:id

Returns full job detail including the last 10 executions.

**Response 200** — single job object with `executions[]` array.

**Errors**: 404 not found, 403 forbidden (other user's job)

---

### PATCH /jobs/:id

Update a job that has not yet started.

**Body** (all optional)
```json
{ "priority": "HIGH", "maxAttempts": 5 }
```

**Errors**: 409 if job is RUNNING/COMPLETED/FAILED/CANCELLED

---

### DELETE /jobs/:id

Deletes the job and its execution history. Removes from Redis queue if pending.

**Errors**: 409 if job is RUNNING

---

### POST /jobs/:id/cancel

Cancels a QUEUED or SCHEDULED job.

**Response 200** — updated job with `status: "CANCELLED"`

**Errors**: 409 if job is not cancellable (e.g. already COMPLETED)

---

### POST /jobs/:id/retry

Manually re-queues a permanently FAILED job.

**Response 200** — job with `status: "QUEUED"`, `attempts` reset to 0

**Errors**: 409 if job is not in FAILED status

---

### POST /jobs/:id/schedule

Schedules an unstarted job for future execution.

**Body**
```json
{ "scheduledAt": "2026-10-05T08:00:00.000Z" }
```

**Errors**: 400 if time is in the past, 409 if job is not in CREATED/FAILED

---

### GET /jobs/:id/executions

Paginated execution history for a job.

**Query**: `page`, `limit`

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "attemptNumber": 1,
      "status": "FAILED",
      "durationMs": 1234,
      "errorMessage": "Connection refused",
      "worker": { "id": "uuid", "workerName": "worker-abc@hostname" }
    }
  ],
  "pagination": { ... }
}
```

---

## Workers

### GET /workers

List all registered workers.

**Response 200** — array of worker objects with `isOnline` computed field (heartbeat within 30s).

---

### GET /workers/:id

Single worker detail including last 20 executions.

---

## Dashboard

### GET /dashboard/stats

Aggregated system statistics.

**Response 200**
```json
{
  "success": true,
  "data": {
    "jobs": {
      "total": 150, "completed": 120, "failed": 8,
      "running": 2, "queued": 15, "scheduled": 5, "cancelled": 0,
      "successRate": 94
    },
    "performance": { "avgExecutionTimeMs": 876 },
    "workers": { "active": 2 },
    "queue": { "waiting": 15, "active": 2, "delayed": 5, "completed": 120, "failed": 8 }
  }
}
```

---

### GET /dashboard/job-stats

**Response 200**
```json
{
  "data": {
    "byType": [{ "type": "DATA_PROCESSING", "count": 45 }, ...],
    "byPriority": [{ "priority": "HIGH", "count": 20 }, ...],
    "hourly": [{ "hour": "2026-10-03T14:00:00.000Z", "total": 12, "completed": 10, "failed": 2 }, ...]
  }
}
```

---

### GET /dashboard/worker-stats

Returns all workers with `isOnline` computed field.

---

## Job Types & Payloads

### EMAIL_SIMULATION
```json
{ "to": "recipient@example.com", "subject": "Hello", "body": "Optional body text" }
```

### REPORT_GENERATION
```json
{ "reportType": "monthly", "month": 10, "year": 2026 }
```

### DATA_PROCESSING
```json
{ "numbers": [1, 2, 3, 4, 5, 10, 20, 50] }
```
Returns: `sum`, `average`, `min`, `max`, `median`, `stdDev`, `count`

### IMAGE_PROCESSING_SIMULATION
```json
{
  "width": 1920, "height": 1080,
  "operations": ["resize", "compress"],
  "quality": 85
}
```
Valid operations: `resize`, `grayscale`, `blur`, `sharpen`, `rotate`, `compress`

### CUSTOM_DELAY
```json
{ "delaySeconds": 5, "shouldFail": false, "failMessage": "optional error text" }
```
Set `shouldFail: true` to test retry behavior. Max 60 seconds.

---

## Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Zod schema rejection |
| `UNAUTHORIZED` | 401 | Missing or invalid JWT |
| `FORBIDDEN` | 403 | Authenticated but not allowed |
| `JOB_NOT_FOUND` | 404 | Job ID does not exist |
| `WORKER_NOT_FOUND` | 404 | Worker ID does not exist |
| `CONFLICT` | 409 | State transition not allowed |
| `DUPLICATE_ENTRY` | 409 | Unique constraint violation |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected server error |
