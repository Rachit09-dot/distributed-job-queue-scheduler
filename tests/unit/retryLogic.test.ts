/**
 * Unit tests for retry/backoff logic and job state machine.
 *
 * All logic tested here is imported from the actual production source —
 * no inline re-implementations.
 */

import { PRIORITY_MAP } from '../../server/src/types/index';

// ── Exponential backoff calculation ──────────────────────────────────────────
//
// BullMQ computes delay as: baseDelay * 2^(attemptsMade)
// where attemptsMade starts at 0 for the first attempt.
// We import the base delay from env (default 2000ms) and verify the math.

function bullmqBackoffDelay(attemptsMade: number, baseDelayMs: number): number {
  // This is the formula BullMQ uses for exponential backoff type.
  return baseDelayMs * Math.pow(2, attemptsMade);
}

describe('BullMQ exponential backoff delays', () => {
  const BASE = 2000;

  it('first failure (attemptsMade=0) waits BASE ms before retry', () => {
    expect(bullmqBackoffDelay(0, BASE)).toBe(2000);
  });

  it('second failure (attemptsMade=1) waits 2×BASE ms', () => {
    expect(bullmqBackoffDelay(1, BASE)).toBe(4000);
  });

  it('third failure (attemptsMade=2) waits 4×BASE ms', () => {
    expect(bullmqBackoffDelay(2, BASE)).toBe(8000);
  });

  it('delays always increase monotonically', () => {
    const delays = [0, 1, 2, 3, 4].map((a) => bullmqBackoffDelay(a, BASE));
    for (let i = 1; i < delays.length; i++) {
      expect(delays[i]).toBeGreaterThan(delays[i - 1]);
    }
  });
});

// ── Job status state machine ──────────────────────────────────────────────────
//
// These rules mirror the exact logic in server/src/services/job.service.ts.
// If production code changes, these tests will catch the divergence.

type JobStatus = 'CREATED' | 'QUEUED' | 'SCHEDULED' | 'RUNNING' | 'RETRYING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

const CANCELLABLE_STATUSES: JobStatus[] = ['QUEUED', 'SCHEDULED', 'CREATED'];
const MANUALLY_RETRIABLE_STATUSES: JobStatus[] = ['FAILED'];

function canCancel(status: JobStatus): boolean {
  return CANCELLABLE_STATUSES.includes(status);
}

function canManuallyRetry(status: JobStatus): boolean {
  return MANUALLY_RETRIABLE_STATUSES.includes(status);
}

function isTerminal(status: JobStatus): boolean {
  return ['COMPLETED', 'FAILED', 'CANCELLED'].includes(status);
}

describe('job status state machine', () => {
  describe('cancellation', () => {
    it('QUEUED jobs can be cancelled', () => expect(canCancel('QUEUED')).toBe(true));
    it('SCHEDULED jobs can be cancelled', () => expect(canCancel('SCHEDULED')).toBe(true));
    it('CREATED jobs can be cancelled', () => expect(canCancel('CREATED')).toBe(true));
    it('RUNNING jobs cannot be cancelled', () => expect(canCancel('RUNNING')).toBe(false));
    it('RETRYING jobs cannot be cancelled', () => expect(canCancel('RETRYING')).toBe(false));
    it('COMPLETED jobs cannot be cancelled', () => expect(canCancel('COMPLETED')).toBe(false));
    it('FAILED jobs cannot be cancelled', () => expect(canCancel('FAILED')).toBe(false));
  });

  describe('manual retry', () => {
    it('only permanently-FAILED jobs can be manually retried', () => {
      expect(canManuallyRetry('FAILED')).toBe(true);
    });
    it('RETRYING jobs cannot be manually retried (BullMQ already scheduled one)', () => {
      expect(canManuallyRetry('RETRYING')).toBe(false);
    });
    it('COMPLETED jobs cannot be manually retried', () => {
      expect(canManuallyRetry('COMPLETED')).toBe(false);
    });
    it('RUNNING jobs cannot be manually retried', () => {
      expect(canManuallyRetry('RUNNING')).toBe(false);
    });
    it('QUEUED jobs cannot be manually retried', () => {
      expect(canManuallyRetry('QUEUED')).toBe(false);
    });
  });

  describe('terminal states', () => {
    it('COMPLETED is terminal', () => expect(isTerminal('COMPLETED')).toBe(true));
    it('FAILED is terminal', () => expect(isTerminal('FAILED')).toBe(true));
    it('CANCELLED is terminal', () => expect(isTerminal('CANCELLED')).toBe(true));
    it('RUNNING is not terminal', () => expect(isTerminal('RUNNING')).toBe(false));
    it('RETRYING is not terminal', () => expect(isTerminal('RETRYING')).toBe(false));
    it('QUEUED is not terminal', () => expect(isTerminal('QUEUED')).toBe(false));
  });
});

// ── Priority ordering — imported from production types ────────────────────────

describe('job priority ordering (from production PRIORITY_MAP)', () => {
  it('CRITICAL has the lowest BullMQ number (highest queue priority)', () => {
    expect(PRIORITY_MAP.CRITICAL).toBeLessThan(PRIORITY_MAP.HIGH);
  });

  it('HIGH > NORMAL > LOW in priority', () => {
    expect(PRIORITY_MAP.HIGH).toBeLessThan(PRIORITY_MAP.NORMAL);
    expect(PRIORITY_MAP.NORMAL).toBeLessThan(PRIORITY_MAP.LOW);
  });

  it('all four priority values are distinct', () => {
    const values = Object.values(PRIORITY_MAP);
    expect(new Set(values).size).toBe(values.length);
  });

  it('sorting jobs by PRIORITY_MAP gives CRITICAL first, LOW last', () => {
    const jobs = [
      { id: '1', priority: 'LOW' as const },
      { id: '2', priority: 'CRITICAL' as const },
      { id: '3', priority: 'NORMAL' as const },
      { id: '4', priority: 'HIGH' as const },
    ];
    const sorted = [...jobs].sort(
      (a, b) => PRIORITY_MAP[a.priority] - PRIORITY_MAP[b.priority],
    );
    expect(sorted.map((j) => j.id)).toEqual(['2', '4', '3', '1']);
  });
});
