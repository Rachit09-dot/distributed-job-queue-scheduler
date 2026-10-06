import IORedis from 'ioredis';
import { logger } from './logger';

let redisConnection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!redisConnection) {
    redisConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: false,
      lazyConnect: false,
    });

    redisConnection.on('connect', () => {
      logger.info('Redis connected');
    });

    redisConnection.on('error', (err) => {
      logger.error({ err }, 'Redis connection error');
    });

    redisConnection.on('close', () => {
      logger.warn('Redis connection closed');
    });
  }
  return redisConnection;
}

export async function closeRedis(): Promise<void> {
  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = null;
  }
}
