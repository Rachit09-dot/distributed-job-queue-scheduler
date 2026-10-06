import IORedis from 'ioredis';
import { logger } from './logger';

/**
 * Publishes job status change events to a Redis pub/sub channel.
 * The API server subscribes to this channel and broadcasts via Socket.IO.
 * This keeps the worker and API decoupled — no direct HTTP call needed.
 */

let publisher: IORedis | null = null;

const CHANNEL = 'job-status-updates';

export function getPublisher(): IORedis {
  if (!publisher) {
    publisher = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      lazyConnect: false,
    });
    publisher.on('error', (err) => logger.warn({ err }, 'PubSub publisher error'));
  }
  return publisher;
}

export async function publishJobUpdate(payload: {
  jobId: string;
  userId: string;
  status: string;
  type: string;
  workerId?: string;
}): Promise<void> {
  try {
    const pub = getPublisher();
    await pub.publish(CHANNEL, JSON.stringify(payload));
  } catch (err) {
    // Non-critical — the dashboard will pick up changes via polling fallback
    logger.warn({ err }, 'Failed to publish job update event');
  }
}

export async function closePublisher(): Promise<void> {
  if (publisher) {
    await publisher.quit();
    publisher = null;
  }
}

export { CHANNEL };
