import { Worker as BullWorker, Job as BullJob, UnrecoverableError } from 'bullmq';
import { getRedisConnection } from '../utils/redis';
import { prisma } from '../utils/prisma';
import { getProcessor } from '../processors/registry';
import { createChildLogger } from '../utils/logger';
import { publishJobUpdate } from '../utils/pubsub';
import { WorkerContext } from '../worker';

const QUEUE_NAME = 'job-processing';

export function createBullWorker(ctx: WorkerContext): BullWorker {
  const concurrency = parseInt(process.env.WORKER_CONCURRENCY || '2', 10);

  const worker = new BullWorker(
    QUEUE_NAME,
    async (bullJob: BullJob) => {
      await processJob(bullJob, ctx);
    },
    {
      connection: getRedisConnection(),
      concurrency,
      // Lock duration: how long a job is "held" before BullMQ considers the worker dead
      lockDuration: 30000,
      // Stalled job check interval
      stalledInterval: 15000,
    },
  );

  worker.on('completed', (bullJob) => {
    ctx.log.info(
      { bullJobId: bullJob.id, name: bullJob.name },
      'BullMQ: job completed',
    );
  });

  worker.on('failed', (bullJob, err) => {
    ctx.log.error(
      { bullJobId: bullJob?.id, name: bullJob?.name, err: err.message },
      'BullMQ: job failed',
    );
  });

  worker.on('error', (err) => {
    ctx.log.error({ err }, 'BullMQ worker error');
  });

  worker.on('stalled', (jobId) => {
    ctx.log.warn({ jobId }, 'BullMQ: stalled job detected — re-queueing');
  });

  return worker;
}

async function processJob(bullJob: BullJob, ctx: WorkerContext): Promise<void> {
  const { jobId, type, payload, userId } = bullJob.data as {
    jobId: string;
    type: string;
    payload: Record<string, unknown>;
    userId: string;
  };

  const attemptNumber = (bullJob.attemptsMade ?? 0) + 1;
  const jobLog = createChildLogger({
    workerId: ctx.workerId,
    workerName: ctx.workerName,
    jobId,
    type,
    attempt: attemptNumber,
  });

  jobLog.info('Starting job execution');

  // Check if job was cancelled before we picked it up — safe cooperative cancellation
  const currentJob = await prisma.job.findUnique({ where: { id: jobId }, select: { status: true } });
  if (currentJob?.status === 'CANCELLED') {
    jobLog.warn('Job was cancelled before worker could start it — skipping');
    // Tell BullMQ not to retry — this is intentional
    throw new UnrecoverableError('Job was cancelled');
  }

  // Mark worker as BUSY (best-effort — don't fail the job if this errors)
  await prisma.worker
    .update({
      where: { id: ctx.workerId },
      data: { status: 'BUSY' },
    })
    .catch((e) => jobLog.warn({ err: e }, 'Could not update worker to BUSY'));

  // Mark job as RUNNING in PostgreSQL
  const jobRecord = await prisma.job.update({
    where: { id: jobId },
    data: {
      status: 'RUNNING',
      startedAt: new Date(),
      attempts: { increment: 1 },
    },
  });

  // Notify dashboard: job is now RUNNING
  await publishJobUpdate({ jobId, userId, status: 'RUNNING', type, workerId: ctx.workerId });

  // Create execution record for this attempt
  const execution = await prisma.jobExecution.create({
    data: {
      jobId,
      workerId: ctx.workerId,
      attemptNumber,
      status: 'RUNNING',
      startedAt: new Date(),
    },
  });

  const startTime = Date.now();

  try {
    // Dispatch to the correct processor — only safe, predefined handlers
    const processor = getProcessor(type);
    const result = await processor(payload);
    const durationMs = Date.now() - startTime;

    // Mark execution COMPLETED
    await prisma.jobExecution.update({
      where: { id: execution.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        durationMs,
        result: result.data as any,
      },
    });

    // Mark job COMPLETED
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        result: result.data as any,
        errorMessage: null,
      },
    });

    // Notify API via Redis pub/sub → Socket.IO broadcast
    await publishJobUpdate({ jobId, userId, status: 'COMPLETED', type, workerId: ctx.workerId });

    // Update worker stats
    await prisma.worker.update({
      where: { id: ctx.workerId },
      data: {
        status: 'ONLINE',
        jobsProcessed: { increment: 1 },
        lastHeartbeat: new Date(),
      },
    });

    jobLog.info({ durationMs, result: result.message }, 'Job completed successfully');

  } catch (err) {
    const durationMs = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : String(err);
    const isLastAttempt = attemptNumber >= (jobRecord.maxAttempts ?? 3);

    jobLog.error(
      { durationMs, errorMessage, isLastAttempt, attempt: attemptNumber, maxAttempts: jobRecord.maxAttempts },
      'Job execution failed',
    );

    // Mark this execution as FAILED
    await prisma.jobExecution.update({
      where: { id: execution.id },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        durationMs,
        errorMessage,
      },
    });

    // Update worker stats
    await prisma.worker.update({
      where: { id: ctx.workerId },
      data: {
        status: 'ONLINE',
        jobsFailed: { increment: 1 },
        lastHeartbeat: new Date(),
      },
    });

    if (isLastAttempt) {
      // All attempts exhausted — mark permanently FAILED
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorMessage,
        },
      });
      jobLog.warn({ errorMessage }, 'Job permanently failed — max attempts exhausted');
      // Notify API
      await publishJobUpdate({ jobId, userId, status: 'FAILED', type, workerId: ctx.workerId });
      // Tell BullMQ not to retry this job
      throw new UnrecoverableError(errorMessage);
    } else {
      // Not the last attempt — set RETRYING so the UI shows correct state.
      // BullMQ will re-deliver the job after exponential backoff.
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'RETRYING',
          errorMessage,
        },
      });
      // Notify dashboard about retrying state
      await publishJobUpdate({ jobId, userId, status: 'RETRYING', type, workerId: ctx.workerId });

      // Re-throw so BullMQ applies exponential backoff and retries
      throw err instanceof Error ? err : new Error(errorMessage);
    }
  }
}
