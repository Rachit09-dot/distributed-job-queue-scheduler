import IORedis from 'ioredis';
import { logger } from './logger';

let connection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null, // Required for BullMQ workers
      enableReadyCheck: false,
    });

    connection.on('connect', () => logger.info('Worker: Redis connected'));
    connection.on('error', (err) => logger.error({ err }, 'Worker: Redis error'));
  }
  return connection;
}

export async function closeRedis(): Promise<void> {
  if (connection) {
    await connection.quit();
    connection = null;
  }
}
