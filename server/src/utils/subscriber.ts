import IORedis from 'ioredis';
import { Server as SocketIOServer } from 'socket.io';
import { logger } from './logger';
import { emitJobUpdate } from '../socket';

const CHANNEL = 'job-status-updates';

let subscriber: IORedis | null = null;

/**
 * Subscribes to Redis pub/sub events published by worker processes.
 * When a job status changes, the worker publishes to this channel and
 * the API rebroadcasts it via Socket.IO to connected browsers.
 */
export function startJobUpdateSubscriber(io: SocketIOServer): void {
  subscriber = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  subscriber.subscribe(CHANNEL, (err) => {
    if (err) {
      logger.error({ err }, 'Failed to subscribe to job update channel');
      return;
    }
    logger.info({ channel: CHANNEL }, 'Subscribed to job update channel');
  });

  subscriber.on('message', (_channel, message) => {
    try {
      const payload = JSON.parse(message) as {
        jobId: string;
        userId: string;
        status: string;
        type: string;
        workerId?: string;
      };

      logger.debug({ payload }, 'Received job update event');

      // Broadcast to the job's owner and any subscribers of this specific job
      emitJobUpdate(io, payload.userId, payload.jobId, {
        jobId: payload.jobId,
        status: payload.status,
        type: payload.type,
        workerId: payload.workerId,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      logger.warn({ err, message }, 'Failed to parse job update event');
    }
  });

  subscriber.on('error', (err) => {
    logger.warn({ err }, 'Job update subscriber error');
  });
}

export async function stopJobUpdateSubscriber(): Promise<void> {
  if (subscriber) {
    await subscriber.quit();
    subscriber = null;
  }
}
