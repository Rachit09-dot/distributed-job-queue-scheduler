import 'dotenv/config';
import os from 'os';
import { prisma } from './utils/prisma';
import { closeRedis } from './utils/redis';
import { closePublisher } from './utils/pubsub';
import { createBullWorker } from './queue/processor';
import { logger } from './utils/logger';

export interface WorkerContext {
  workerId: string;
  workerName: string;
  log: typeof logger;
}

const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '2', 10);
const HEARTBEAT_INTERVAL_MS = parseInt(process.env.HEARTBEAT_INTERVAL_MS || '10000', 10);

// Worker identity:
// - In Docker Compose with `--scale worker=N`, each replica gets a unique hostname
//   (e.g. distributed-job-scheduler-worker-1), so we use hostname as the stable ID.
// - WORKER_INSTANCE can override this for local development (e.g. WORKER_INSTANCE=local-1).
// - We deliberately do NOT fall back to a random UUID — that would create a new DB row
//   on every restart instead of updating the existing worker record.
const hostname = os.hostname();
const WORKER_INSTANCE = process.env.WORKER_INSTANCE || hostname;
const workerName = `worker-${WORKER_INSTANCE}`;

async function registerWorker(): Promise<string> {
  const worker = await prisma.worker.upsert({
    where: { workerName },
    update: {
      status: 'ONLINE',
      hostname,
      concurrency: CONCURRENCY,
      lastHeartbeat: new Date(),
      updatedAt: new Date(),
    },
    create: {
      workerName,
      status: 'ONLINE',
      hostname,
      concurrency: CONCURRENCY,
      lastHeartbeat: new Date(),
    },
  });

  logger.info({ workerId: worker.id, workerName, hostname, concurrency: CONCURRENCY }, 'Worker registered');
  return worker.id;
}

async function sendHeartbeat(workerId: string): Promise<void> {
  try {
    await prisma.worker.update({
      where: { id: workerId },
      data: { lastHeartbeat: new Date() },
    });
  } catch (err) {
    logger.warn({ err }, 'Heartbeat update failed');
  }
}

async function markWorkerOffline(workerId: string): Promise<void> {
  try {
    await prisma.worker.update({
      where: { id: workerId },
      data: { status: 'OFFLINE', updatedAt: new Date() },
    });
    logger.info({ workerId }, 'Worker marked offline');
  } catch (err) {
    logger.warn({ err }, 'Could not mark worker offline');
  }
}

async function main(): Promise<void> {
  logger.info({ workerName, concurrency: CONCURRENCY }, 'Starting worker...');

  // Register this worker in the database
  const workerId = await registerWorker();

  const ctx: WorkerContext = { workerId, workerName, log: logger };

  // Start the BullMQ worker
  const bullWorker = createBullWorker(ctx);

  // Periodic heartbeat — keeps the worker marked as online in the dashboard
  const heartbeatInterval = setInterval(
    () => sendHeartbeat(workerId),
    HEARTBEAT_INTERVAL_MS,
  );

  logger.info(
    { workerId, workerName, concurrency: CONCURRENCY, queueName: 'job-processing' },
    'Worker is running and consuming jobs',
  );

  // Graceful shutdown
  async function shutdown(signal: string): Promise<void> {
    logger.info({ signal }, 'Shutdown signal received');
    clearInterval(heartbeatInterval);

    // Stop accepting new jobs; wait for in-flight jobs to complete
    await bullWorker.close();
    logger.info('BullMQ worker closed');

    await markWorkerOffline(workerId);
    await closePublisher();
    await closeRedis();
    await prisma.$disconnect();

    logger.info('Worker shutdown complete');
    process.exit(0);
  }

  process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
  process.on('SIGINT', () => { void shutdown('SIGINT'); });

  // On an uncaught exception: log, attempt cleanup, then exit non-zero so
  // Docker's restart policy can bring the worker back up cleanly.
  // We do NOT keep the process running — a corrupted worker is worse than a dead one.
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception — worker will exit');
    clearInterval(heartbeatInterval);
    void markWorkerOffline(workerId)
      .catch(() => undefined)
      .finally(() => {
        void closePublisher().catch(() => undefined);
        void closeRedis().catch(() => undefined);
        process.exit(1);
      });
  });

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection — worker will exit');
    clearInterval(heartbeatInterval);
    void markWorkerOffline(workerId)
      .catch(() => undefined)
      .finally(() => {
        void closePublisher().catch(() => undefined);
        void closeRedis().catch(() => undefined);
        process.exit(1);
      });
  });
}

main().catch((err) => {
  logger.fatal({ err }, 'Worker failed to start');
  process.exit(1);
});
