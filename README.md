# JobQueue — Distributed Job Queue & Task Scheduler

A production-style distributed background job processing system built as an SDE internship portfolio project. Demonstrates real-world distributed systems engineering: Redis-backed queues, concurrent worker processes, PostgreSQL persistence, real-time WebSocket updates, and a modern React dashboard.

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Tech Stack](#tech-stack)
5. [System Workflow](#system-workflow)
6. [Job Lifecycle](#job-lifecycle)
7. [Database Schema](#database-schema)
8. [API Documentation](#api-documentation)
9. [Docker Setup](#docker-setup)
10. [Environment Variables](#environment-variables)
11. [Run Locally (without Docker)](#run-locally-without-docker)
12. [Run with Docker](#run-with-docker)
13. [Testing](#testing)
14. [Design Decisions](#design-decisions)
15. [Failure Handling](#failure-handling)
16. [Scalability](#scalability)
17. [Security](#security)
18. [Future Improvements](#future-improvements)

---

## Problem Statement

Modern applications often need to run tasks asynchronously: sending emails, generating reports, processing data, resizing images. Running these inline in the request/response cycle degrades user experience and wastes server resources. A distributed job queue decouples task submission from task execution, enabling:

- **Resilience** — failed jobs retry automatically
- **Scalability** — add more workers without touching the API
- **Visibility** — track every job's status and history in real time
- **Priority** — critical work runs before low-priority background tasks

---

## Features

| Category | Features |
|---|---|
| **Auth** | JWT register/login, bcrypt hashing, role-based access (USER/ADMIN) |
| **Jobs** | Create, list, filter, cancel, retry, delete, schedule for future |
| **Queue** | Redis + BullMQ, priority queuing, exponential backoff retries |
| **Workers** | Multiple concurrent workers, per-job execution records, heartbeat |
| **Dashboard** | Live stats, charts by type/priority, Redis queue depth |
| **Real-time** | Socket.IO — job status updates pushed to browser instantly |
| **Scheduling** | Delay jobs to a future UTC timestamp via BullMQ delayed jobs |
| **Idempotency** | Optional idempotency key prevents duplicate job creation |
| **Security** | Helmet, CORS, rate limiting, input validation (Zod), no arbitrary code execution |
| **Docker** | Full docker compose stack — start everything with one command |
| **Testing** | Unit tests (processors, validators, state machine), integration tests (API) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser                                 │
│                   React + Vite + Tailwind                       │
│              (Dashboard, Jobs, Workers, Charts)                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP/REST + Socket.IO WebSocket
┌──────────────────────────▼──────────────────────────────────────┐
│                   Node.js + Express API                         │
│         (Auth · Jobs · Dashboard · Workers · Rate Limit)        │
└──────────┬────────────────────────────────────┬─────────────────┘
           │ Prisma ORM                         │ BullMQ
┌──────────▼──────────┐             ┌───────────▼─────────────────┐
│     PostgreSQL      │             │          Redis               │
│  users, jobs,       │             │   job-processing queue       │
│  job_executions,    │             │   (priority + delay)         │
│  workers            │             └───────────┬─────────────────┘
└─────────────────────┘                         │
          ▲                          ┌───────────┼───────────┐
          │ Prisma ORM               │           │           │
          │              ┌───────────▼┐  ┌───────▼──┐  ┌────▼──────┐
          └──────────────│  Worker 1  │  │ Worker 2 │  │ Worker N  │
                         │ (BullMQ)   │  │ (BullMQ) │  │ (BullMQ)  │
                         └────────────┘  └──────────┘  └───────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, Recharts, Socket.IO client |
| Backend | Node.js 20, Express.js, TypeScript, Pino logging |
| Queue | BullMQ 5, Redis 7 |
| Database | PostgreSQL 16, Prisma ORM 5 |
| Auth | JWT (jsonwebtoken), bcryptjs (cost 12) |
| Validation | Zod |
| Real-time | Socket.IO 4 |
| Docker | Docker Compose v3.9, multi-stage builds, nginx |
| Testing | Jest, ts-jest, Supertest, Vitest, React Testing Library |

---

## System Workflow

```
1. User submits job via React form
        ↓
2. API validates request (Zod schema)
        ↓
3. Job saved to PostgreSQL (status: CREATED)
        ↓
4. Job added to Redis via BullMQ (status: QUEUED)
        ↓
5. BullMQ delivers job to an available Worker
        ↓
6. Worker marks job RUNNING, creates JobExecution record
        ↓
7. Worker dispatches to correct processor (EMAIL / REPORT / DATA / etc.)
        ↓
8. On success: marks COMPLETED, stores result
   On failure: marks FAILED, triggers exponential backoff retry
        ↓
9. After max retries: permanently FAILED (UnrecoverableError)
        ↓
10. API emits Socket.IO event → React dashboard updates instantly
```

---

## Job Lifecycle

```
         ┌─────────┐
    ──►  │ CREATED │
         └────┬────┘
              │ enqueued
         ┌────▼────┐      delay/future
         │ QUEUED  │ ◄──────────────── SCHEDULED
         └────┬────┘
              │ worker picks up
         ┌────▼────┐
         │ RUNNING │
         └────┬────┘
        ┌─────┴──────┐
        ▼            ▼
   ┌─────────┐   ┌────────┐
   │COMPLETED│   │ FAILED │──► retry available?
   └─────────┘   └────────┘         │
                      ▲       YES ──┘ (exponential backoff)
                      │       NO  ──► permanent FAILED
                 ┌─────────┐
                 │CANCELLED│ (from QUEUED or SCHEDULED only)
                 └─────────┘
```

---

## Database Schema

```
users
├── id (uuid, PK)
├── name
├── email (unique)
├── passwordHash
├── role (USER | ADMIN)
├── createdAt
└── updatedAt

jobs
├── id (uuid, PK)
├── userId (FK → users)
├── type (JobType enum)
├── payload (jsonb)
├── priority (LOW|NORMAL|HIGH|CRITICAL)
├── status (JobStatus enum)
├── scheduledAt
├── attempts
├── maxAttempts
├── result (jsonb)
├── errorMessage
├── idempotencyKey (unique, nullable)
├── bullJobId
├── createdAt / startedAt / completedAt / updatedAt
└── INDEXES: userId, status, createdAt, priority, scheduledAt

job_executions
├── id (uuid, PK)
├── jobId (FK → jobs, CASCADE)
├── workerId (FK → workers, SET NULL)
├── attemptNumber
├── status (RUNNING|COMPLETED|FAILED)
├── startedAt / completedAt
├── durationMs
├── result (jsonb)
├── errorMessage
└── INDEX: jobId

workers
├── id (uuid, PK)
├── workerName (unique)
├── status (ONLINE|BUSY|OFFLINE)
├── hostname
├── concurrency
├── jobsProcessed
├── jobsFailed
├── lastHeartbeat
├── startedAt
└── INDEXES: status, lastHeartbeat
```

---

## API Documentation

See [docs/api.md](docs/api.md) for the full reference.

### Quick Reference

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Register new user |
| POST | `/api/auth/login` | — | Login, get JWT |
| GET | `/api/auth/me` | ✓ | Current user |
| POST | `/api/jobs` | ✓ | Create job |
| GET | `/api/jobs` | ✓ | List jobs (paginated, filtered) |
| GET | `/api/jobs/:id` | ✓ | Job detail |
| PATCH | `/api/jobs/:id` | ✓ | Update job |
| DELETE | `/api/jobs/:id` | ✓ | Delete job |
| POST | `/api/jobs/:id/cancel` | ✓ | Cancel job |
| POST | `/api/jobs/:id/retry` | ✓ | Retry failed job |
| POST | `/api/jobs/:id/schedule` | ✓ | Schedule job |
| GET | `/api/jobs/:id/executions` | ✓ | Execution history |
| GET | `/api/workers` | ✓ | List workers |
| GET | `/api/workers/:id` | ✓ | Worker detail |
| GET | `/api/dashboard/stats` | ✓ | Aggregated stats |
| GET | `/api/dashboard/job-stats` | ✓ | Jobs by type/priority/hour |
| GET | `/api/dashboard/worker-stats` | ✓ | Worker metrics |

All responses follow the envelope:
```json
{ "success": true, "data": {}, "message": "..." }
{ "success": false, "message": "...", "errorCode": "JOB_NOT_FOUND" }
```

---

## Docker Setup

### Prerequisites
- Docker Desktop (or Docker Engine + Compose plugin)
- Git

### Start everything

```bash
git clone <repo-url>
cd distributed-job-scheduler
cp .env.example .env          # Edit JWT_SECRET at minimum
docker compose up --build
```

Services:
| Service | URL |
|---|---|
| Frontend | http://localhost:80 |
| API | http://localhost:4000 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

### Scale workers

```bash
# Run 3 worker containers in parallel
docker compose up --scale worker=3 --build
```

Each worker registers itself in PostgreSQL with a unique name and processes jobs concurrently. BullMQ ensures each job is only processed once.

### Reset everything

```bash
docker compose down -v   # removes volumes (data)
docker compose up --build
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | — | Prisma PostgreSQL connection string |
| `REDIS_URL` | — | Redis URL (supports auth password) |
| `JWT_SECRET` | — | **Change this** — min 32 chars in production |
| `JWT_EXPIRES_IN` | `7d` | Token expiry |
| `PORT` | `4000` | API server port |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed frontend origin |
| `MAX_JOB_ATTEMPTS` | `3` | Max retries before permanent failure |
| `RETRY_BASE_DELAY_MS` | `2000` | Base delay for exponential backoff |
| `WORKER_CONCURRENCY` | `2` | Concurrent jobs per worker process |
| `HEARTBEAT_INTERVAL_MS` | `10000` | Worker heartbeat frequency |
| `VITE_API_URL` | `/api` | Frontend API base URL |
| `VITE_SOCKET_URL` | — | Socket.IO server URL (empty = same origin) |

See `.env.example` for the full list with descriptions.

---

## Run Locally (without Docker)

### Requirements
- Node.js 20+
- PostgreSQL 14+
- Redis 7+

```bash
# 1. Install all dependencies
npm run install:all

# 2. Configure environment
cp .env.example .env
# Edit DATABASE_URL, REDIS_URL, JWT_SECRET

# 3. Run Prisma migrations
cd server
npx prisma migrate dev --name init
npx prisma db seed
cd ..

# 4. Start all three processes (in separate terminals):
npm run dev:server    # API on :4000
npm run dev:worker    # Worker 1
npm run dev:client    # Frontend on :5173

# Optional: start a second worker
WORKER_INSTANCE=worker-2 npm run dev:worker
```

---

## Run with Docker

```bash
# Production stack (2 workers by default)
docker compose up --build

# Scale to 3 workers
docker compose up --scale worker=3

# Development mode with hot reload
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# View all logs
docker compose logs -f

# View only worker logs
docker compose logs -f worker
```

---

## Testing

### Unit tests (no DB/Redis required)

```bash
cd distributed-job-scheduler
npm install    # installs Jest in root
npx jest tests/unit --config jest.config.ts
```

Covers:
- All 5 job processors (30+ assertions)
- Retry/backoff math and state machine
- Zod validators (auth + job schemas)

### Integration tests (requires PostgreSQL + Redis)

```bash
TEST_DATABASE_URL=postgresql://... TEST_REDIS_URL=redis://... \
  npx jest tests/integration --config jest.config.ts
```

### Frontend component tests

```bash
cd client
npm run test
```

Covers:
- StatusBadge, PriorityBadge, WorkerStatusBadge rendering
- Formatting utilities (duration, job type, status config)

---

## Design Decisions

### Why BullMQ over a custom queue?
BullMQ provides battle-tested priority queuing, delayed jobs, exponential backoff, job deduplication, and stalled-job detection. Building these correctly from scratch would take significantly more time and introduce reliability risks. BullMQ's `UnrecoverableError` gives clean control over when to stop retrying.

### Why PostgreSQL for job state (not just Redis)?
Redis is ephemeral and optimized for queue operations, not relational queries. PostgreSQL lets us join users → jobs → executions, run aggregation queries for dashboard stats, and maintain durable history that survives Redis restarts. The two stores serve different purposes and work together.

### Why separate Worker service?
Decoupling the worker from the API server means:
- Workers can be scaled independently (more workers = more throughput)
- A worker crash doesn't affect the API
- Multiple worker containers register as distinct entities in the DB
- The API never blocks on job execution

### Why Socket.IO over polling?
Real-time updates make the dashboard feel live — users see `QUEUED → RUNNING → COMPLETED` without refreshing. Socket.IO falls back to polling automatically when WebSockets aren't available. The dashboard also implements a 15-second polling fallback when the socket disconnects, so users always see fresh data.

### Why Prisma ORM?
Prisma provides type-safe DB access, auto-generated migrations, and a clean query API. The schema is the single source of truth for both the DB structure and TypeScript types. This eliminates a whole class of runtime type errors.

### Idempotency key
Clients can submit a job with `idempotencyKey`. If the same key is submitted again, the original job is returned instead of creating a duplicate. This handles network retries safely. The key is stored as a unique index, so the database enforces the constraint even under concurrent requests.

---

## Failure Handling

| Scenario | Handling |
|---|---|
| Worker crashes mid-job | BullMQ detects stalled job (lockDuration + stalledInterval), re-queues it |
| Redis temporarily unavailable | BullMQ uses connection retry with backoff; API returns 503 |
| PostgreSQL unavailable | Prisma connection retry; requests fail with 500 until restored |
| Job fails repeatedly | Exponential backoff (2s → 4s → 8s), permanent FAILED after maxAttempts |
| Invalid job type | Rejected at API validation (Zod) and at processor registry with clear error |
| User accesses another user's job | 403 Forbidden — userId check in every job service method |
| Cancel completed job | 409 Conflict with clear error message |
| Scheduled job with past timestamp | Rejected at validation with "must be in the future" |
| Duplicate idempotency key | Returns existing job (no duplicate created) |
| Worker heartbeat stale (>30s) | Dashboard shows worker as OFFLINE |
| Queue full with many jobs | BullMQ handles this natively; workers process at their concurrency rate |

---

## Scalability

### Current (single-machine)
```
1 API server
2 Workers (default, configurable via --scale)
1 Redis instance
1 PostgreSQL instance
```

### Horizontal scale-out path

```
Load Balancer (nginx / ALB)
        │
  ┌─────┼─────┐
  │     │     │
API1  API2  API3      ← Stateless; scale freely
  │                     Socket.IO needs sticky sessions or Redis adapter
  ▼
Redis Cluster           ← BullMQ supports Redis Cluster natively
  │
  ├── Worker 1
  ├── Worker 2
  ├── Worker N          ← Add workers with docker compose --scale worker=N
  │
  ▼
PostgreSQL              ← Read replicas for dashboard queries
(Primary + Replicas)      PgBouncer for connection pooling
```

**Worker scaling** is the key lever. Each additional worker container registers itself and starts consuming jobs immediately. BullMQ's distributed locking ensures jobs are never double-processed.

**API scaling** requires a Redis adapter for Socket.IO (e.g. `@socket.io/redis-adapter`) so events published on API1 reach clients connected to API2/3. This is a documented future improvement.

---

## Security

- **Passwords** hashed with bcrypt (cost factor 12) — never stored in plain text
- **JWT** signed with a secret, expires in 7 days, verified on every protected request
- **Helmet** sets security headers (CSP, HSTS, X-Frame-Options, etc.)
- **CORS** configured to explicit origin only
- **Rate limiting** on auth (20 req/15min), job creation (30 req/min), general (100 req/15min)
- **Zod validation** on all inputs — invalid requests rejected before touching the DB
- **No arbitrary code execution** — job payloads never run as shell commands; only predefined safe processors are dispatched
- **Authorization checks** on every job service method — users can only access their own jobs
- **Admin role** required to view all jobs system-wide
- **Error messages** never expose stack traces, DB credentials, or internal paths in production

---

## Future Improvements

1. **Redis adapter for Socket.IO** — required for multi-API horizontal scaling
2. **Job progress reporting** — workers emit percentage complete via BullMQ progress API
3. **Webhook notifications** — POST to a user-configured URL on job completion/failure
4. **Cron/recurring jobs** — BullMQ's repeat feature for periodic tasks
5. **Job dependencies** — chain jobs so Job B only starts after Job A completes
6. **Dead letter queue** — permanently failed jobs move to a separate review queue
7. **Admin job management UI** — admins reassign, bulk-cancel, or drain the queue
8. **Prometheus metrics endpoint** — queue depth, worker throughput, latency histograms
9. **Grafana dashboard** — visualize metrics time-series
10. **E2E tests** — Playwright tests covering full create → process → complete flow
11. **CI/CD pipeline** — GitHub Actions: lint → test → build → push Docker image
12. **Kubernetes manifests** — Helm chart for k8s deployment with HPA for workers
