# Deployment Guide

## Docker Compose (Recommended)

The entire stack — PostgreSQL, Redis, API, 2 Workers, Frontend — starts with one command.

### Prerequisites
- Docker Desktop ≥ 4.x (or Docker Engine + Compose plugin)
- 4 GB free RAM (2 GB minimum)
- Ports 80, 4000, 5432, 6379 available

### Steps

```bash
# 1. Clone the repo
git clone <repo-url>
cd distributed-job-scheduler

# 2. Create your .env from the example
cp .env.example .env

# 3. Set a strong JWT_SECRET (required)
# Edit .env and change JWT_SECRET to a random 32+ char string

# 4. Build and start
docker compose up --build

# 5. (First run only) Seed demo data
docker compose exec backend npx prisma db seed
```

The `migrate` service runs automatically and applies Prisma migrations before the backend starts.

### Verify everything is healthy

```bash
docker compose ps

# Expected output — all services "healthy" or "running":
# jq-postgres   running (healthy)
# jq-redis      running (healthy)
# jq-backend    running (healthy)
# jq-frontend   running
# worker        running  (2 replicas)
```

### Access

| Service | URL |
|---|---|
| Dashboard | http://localhost |
| API | http://localhost:4000 |
| API health | http://localhost:4000/health |

### Scale workers

```bash
# Scale to 3 workers (each registers independently)
docker compose up --scale worker=3 --no-recreate
```

---

## Local Development (without Docker)

### Requirements
- Node.js 20+
- PostgreSQL 16 running locally (or via `docker run postgres:16-alpine`)
- Redis 7 running locally (or via `docker run redis:7-alpine`)

```bash
# Start only the infrastructure via Docker, run app processes locally
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=secret -e POSTGRES_DB=jobqueue postgres:16-alpine
docker run -d -p 6379:6379 redis:7-alpine

# Install deps
npm run install:all

# Configure
cp .env.example .env
# Set DATABASE_URL=postgresql://postgres:secret@localhost:5432/jobqueue
# Set REDIS_URL=redis://localhost:6379
# Set JWT_SECRET=your-dev-secret

# Migrate + seed
cd server && npx prisma migrate dev --name init && npx ts-node ../prisma/seed.ts && cd ..

# Start each service in a separate terminal
npm run dev:server     # Terminal 1 — API on :4000
npm run dev:worker     # Terminal 2 — Worker 1
npm run dev:client     # Terminal 3 — Frontend on :5173

# Optional: second worker
WORKER_INSTANCE=w2 npm run dev:worker   # Terminal 4
```

---

## Sequence Diagram — Job Creation to Completion

```mermaid
sequenceDiagram
    actor User
    participant Frontend
    participant API
    participant PostgreSQL
    participant Redis
    participant Worker

    User->>Frontend: Fill job form & submit
    Frontend->>API: POST /api/jobs (JWT)
    API->>API: Zod validation
    API->>PostgreSQL: INSERT job (status=CREATED)
    API->>Redis: bullmq.queue.add(jobData, priority)
    Redis-->>API: bullJobId
    API->>PostgreSQL: UPDATE job (status=QUEUED, bullJobId)
    API-->>Frontend: 201 { job }
    Frontend->>Frontend: Navigate to Job Detail

    Redis->>Worker: Deliver job (BullMQ consumer)
    Worker->>PostgreSQL: UPDATE job (status=RUNNING, startedAt)
    Worker->>PostgreSQL: INSERT job_execution (attempt=1, RUNNING)
    Worker->>Worker: Execute processor (e.g. DATA_PROCESSING)
    Worker->>PostgreSQL: UPDATE job_execution (COMPLETED, durationMs, result)
    Worker->>PostgreSQL: UPDATE job (status=COMPLETED, result)
    Worker->>PostgreSQL: UPDATE worker (jobsProcessed++)

    Note over Frontend: Socket.IO event received
    Frontend->>API: GET /api/jobs/:id (auto-refresh)
    API-->>Frontend: Updated job (status=COMPLETED)
    Frontend->>User: Dashboard updates live
```

---

## Production Checklist

Before deploying to a real environment:

- [ ] Set `JWT_SECRET` to a strong random value (32+ chars) — never use the default
- [ ] Set `POSTGRES_PASSWORD` and `REDIS_PASSWORD` to strong values
- [ ] Set `NODE_ENV=production` in all services
- [ ] Set `CORS_ORIGIN` to your actual frontend domain
- [ ] Set up PostgreSQL backups (pg_dump or managed service)
- [ ] Configure Redis persistence (`appendonly yes` for AOF)
- [ ] Place the stack behind an HTTPS reverse proxy (Caddy, nginx, Traefik)
- [ ] Set up log aggregation (Loki, CloudWatch, Datadog)
- [ ] Monitor worker heartbeats — alert if all workers go OFFLINE
- [ ] Add a Socket.IO Redis adapter if running multiple API replicas

---

## Useful Docker Commands

```bash
# View logs for a specific service
docker compose logs -f backend
docker compose logs -f worker

# Open a shell in the backend container
docker compose exec backend sh

# Run Prisma Studio (DB GUI) in the backend container
docker compose exec backend npx prisma studio

# Force rebuild a single service
docker compose up --build backend

# Tear down everything including volumes (deletes all data)
docker compose down -v
```
