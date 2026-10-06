-- Migration: add RETRYING to JobStatus enum and change idempotencyKey to per-user unique

-- Step 1: Add the new enum value to JobStatus
ALTER TYPE "JobStatus" ADD VALUE IF NOT EXISTS 'RETRYING';

-- Step 2: Drop the old global unique constraint on idempotencyKey
ALTER TABLE "jobs" DROP CONSTRAINT IF EXISTS "jobs_idempotencyKey_key";

-- Step 3: Add per-user composite unique constraint
-- Only apply when idempotencyKey is not null (partial index)
CREATE UNIQUE INDEX IF NOT EXISTS "jobs_userId_idempotencyKey_key"
  ON "jobs" ("userId", "idempotencyKey")
  WHERE "idempotencyKey" IS NOT NULL;
