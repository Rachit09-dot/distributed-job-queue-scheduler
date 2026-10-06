import { JobPayload, JobResult } from './types';

const MAX_DELAY_SECONDS = 60; // Safety cap

/**
 * Waits for a specified number of seconds.
 * Used for testing retry logic, timeouts, and concurrency.
 * The "shouldFail" flag allows testing the failure/retry path.
 */
export async function processCustomDelay(payload: JobPayload): Promise<JobResult> {
  const delaySeconds = Number(payload.delaySeconds ?? 2);
  const shouldFail = Boolean(payload.shouldFail ?? false);
  const failMessage = (payload.failMessage as string) || 'Intentional failure for testing';

  if (isNaN(delaySeconds) || delaySeconds < 0) {
    throw new Error('delaySeconds must be a non-negative number');
  }

  if (delaySeconds > MAX_DELAY_SECONDS) {
    throw new Error(`delaySeconds cannot exceed ${MAX_DELAY_SECONDS} seconds`);
  }

  const startTime = Date.now();
  await sleep(delaySeconds * 1000);
  const actualDurationMs = Date.now() - startTime;

  if (shouldFail) {
    throw new Error(failMessage);
  }

  return {
    success: true,
    message: `Completed after ${delaySeconds}s delay`,
    data: {
      requestedDelaySeconds: delaySeconds,
      actualDurationMs,
      completedAt: new Date().toISOString(),
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
