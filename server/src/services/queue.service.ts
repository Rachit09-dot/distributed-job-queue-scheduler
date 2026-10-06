import { Queue, JobsOptions } from 'bullmq';
import { getRedisConnection } from '../utils/redis';
import { PRIORITY_MAP, JobPriority } from '../types';
import { logger } from '../utils/logger';

export const QUEUE_NAME = 'job-processing';

let jobQueue: Queue | null = null;

export function getJobQueue(): Queue {
  if (!jobQueue) {
    jobQueue = new Queue(QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
        attempts: parseInt(process.env.MAX_JOB_ATTEMPTS || '3', 10),
        backoff: {
          type: 'exponential',
          delay: parseInt(process.env.RETRY_BASE_DELAY_MS || '2000', 10),
        },
      },
    });

    jobQueue.on('error', (err) => {
      logger.error({ err }, 'Job queue error');
    });
  }
  return jobQueue;
}

export interface QueueJobData {
  jobId: string;
  type: string;
  payload: Record<string, unknown>;
  userId: string;
  attemptNumber: number;
}

export async function enqueueJob(
  jobId: string,
  type: string,
  payload: Record<string, unknown>,
  userId: string,
  priority: JobPriority,
  maxAttempts: number,
  delayMs?: number,
): Promise<string> {
  const queue = getJobQueue();

  const jobOptions: JobsOptions = {
    priority: PRIORITY_MAP[priority],
    attempts: maxAttempts,
    backoff: {
      type: 'exponential',
      delay: parseInt(process.env.RETRY_BASE_DELAY_MS || '2000', 10),
    },
    ...(delayMs && delayMs > 0 ? { delay: delayMs } : {}),
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  };

  const bullJob = await queue.add(
    type,
    { jobId, type, payload, userId, attemptNumber: 1 } as QueueJobData,
    jobOptions,
  );

  logger.info({ jobId, type, priority, bullJobId: bullJob.id }, 'Job enqueued');
  return bullJob.id!;
}

export async function removeJobFromQueue(bullJobId: string): Promise<boolean> {
  const queue = getJobQueue();
  try {
    const job = await queue.getJob(bullJobId);
    if (job) {
      await job.remove();
      return true;
    }
    return false;
  } catch (err) {
    logger.error({ err, bullJobId }, 'Failed to remove job from queue');
    return false;
  }
}

export async function getQueueStats() {
  const queue = getJobQueue();
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);
  return { waiting, active, completed, failed, delayed };
}
