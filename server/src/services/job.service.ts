import { JobStatus, JobPriority, Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { enqueueJob, removeJobFromQueue } from './queue.service';
import { NotFoundError, ForbiddenError, ConflictError, ValidationError } from '../utils/errors';
import { CreateJobInput, UpdateJobInput, validateJobPayload, JobTypeEnum } from '../validators/job.validator';
import { buildPagination } from '../utils/response';
import { logger } from '../utils/logger';

export async function createJob(
  userId: string,
  input: CreateJobInput,
) {
  // Idempotency check — per user (same key, different user = different job)
  if (input.idempotencyKey) {
    const existing = await prisma.job.findFirst({
      where: { userId, idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      logger.info({ idempotencyKey: input.idempotencyKey, userId }, 'Duplicate job creation prevented');
      return existing;
    }
  }

  // Validate the payload against the per-type schema before persisting anything.
  // A ZodError here becomes a 400 response — the job never enters the queue.
  const validatedPayload = validateJobPayload(
    input.type as Parameters<typeof validateJobPayload>[0],
    input.payload as Record<string, unknown>,
  );

  const isScheduled = !!input.scheduledAt;
  const initialStatus: JobStatus = isScheduled ? 'SCHEDULED' : 'CREATED';

  const job = await prisma.job.create({
    data: {
      userId,
      type: input.type as any,
      payload: validatedPayload as Prisma.InputJsonValue,
      priority: input.priority as JobPriority,
      maxAttempts: input.maxAttempts,
      status: initialStatus,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      idempotencyKey: input.idempotencyKey || null,
    },
  });

  // Enqueue immediately or with delay for scheduled jobs
  let delayMs: number | undefined;
  if (isScheduled && input.scheduledAt) {
    delayMs = new Date(input.scheduledAt).getTime() - Date.now();
    if (delayMs <= 0) {
      throw new ValidationError('Scheduled time must be in the future');
    }
  }

  const bullJobId = await enqueueJob(
    job.id,
    job.type,
    validatedPayload,
    userId,
    job.priority as JobPriority,
    job.maxAttempts,
    delayMs,
  );

  const updatedJob = await prisma.job.update({
    where: { id: job.id },
    data: {
      status: isScheduled ? 'SCHEDULED' : 'QUEUED',
      bullJobId,
    },
  });

  logger.info({ jobId: job.id, type: job.type, userId }, 'Job created and queued');
  return updatedJob;
}

export async function getJobs(
  userId: string,
  isAdmin: boolean,
  filters: {
    status?: JobStatus;
    priority?: JobPriority;
    type?: string;
    search?: string;
    page: number;
    limit: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  },
) {
  const where: Prisma.JobWhereInput = {};

  if (!isAdmin) {
    where.userId = userId;
  }

  if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;
  if (filters.type) where.type = filters.type as any;
  if (filters.search) {
    where.id = { contains: filters.search, mode: 'insensitive' };
  }

  const sortField = filters.sortBy || 'createdAt';
  const sortOrder = filters.sortOrder || 'desc';
  const orderBy: Prisma.JobOrderByWithRelationInput = { [sortField]: sortOrder };

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where,
      orderBy,
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
      include: {
        user: { select: { id: true, name: true, email: true } },
        _count: { select: { executions: true } },
      },
    }),
    prisma.job.count({ where }),
  ]);

  return { jobs, pagination: buildPagination(filters.page, filters.limit, total) };
}

export async function getJobById(jobId: string, userId: string, isAdmin: boolean) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      executions: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          worker: { select: { id: true, workerName: true } },
        },
      },
    },
  });

  if (!job) throw new NotFoundError('Job');
  if (!isAdmin && job.userId !== userId) throw new ForbiddenError('Access denied');

  return job;
}

export async function updateJob(
  jobId: string,
  userId: string,
  isAdmin: boolean,
  input: UpdateJobInput,
) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new NotFoundError('Job');
  if (!isAdmin && job.userId !== userId) throw new ForbiddenError('Access denied');

  if (['RUNNING', 'RETRYING', 'COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status)) {
    throw new ConflictError(`Cannot update job with status ${job.status}`);
  }

  return prisma.job.update({
    where: { id: jobId },
    data: {
      ...(input.priority && { priority: input.priority as JobPriority }),
      ...(input.maxAttempts && { maxAttempts: input.maxAttempts }),
    },
  });
}

export async function cancelJob(jobId: string, userId: string, isAdmin: boolean) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new NotFoundError('Job');
  if (!isAdmin && job.userId !== userId) throw new ForbiddenError('Access denied');

  const cancellableStatuses: JobStatus[] = ['QUEUED', 'SCHEDULED', 'CREATED'];
  if (!cancellableStatuses.includes(job.status)) {
    throw new ConflictError(
      `Cannot cancel job with status ${job.status}. Only QUEUED, SCHEDULED, or CREATED jobs can be cancelled.`,
    );
  }

  // Remove from BullMQ queue
  if (job.bullJobId) {
    await removeJobFromQueue(job.bullJobId);
  }

  const updated = await prisma.job.update({
    where: { id: jobId },
    data: { status: 'CANCELLED' },
  });

  logger.info({ jobId, userId }, 'Job cancelled');
  return updated;
}

export async function retryJob(jobId: string, userId: string, isAdmin: boolean) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new NotFoundError('Job');
  if (!isAdmin && job.userId !== userId) throw new ForbiddenError('Access denied');

  // Only permanently-FAILED jobs can be manually retried.
  // RETRYING means BullMQ still has an automatic retry scheduled — don't duplicate it.
  if (job.status !== 'FAILED') {
    throw new ConflictError(
      job.status === 'RETRYING'
        ? 'Job has a retry already scheduled by BullMQ. Wait for it to complete.'
        : 'Only FAILED jobs can be manually retried',
    );
  }

  const bullJobId = await enqueueJob(
    job.id,
    job.type,
    job.payload as Record<string, unknown>,
    job.userId,
    job.priority as JobPriority,
    job.maxAttempts,
  );

  const updated = await prisma.job.update({
    where: { id: jobId },
    data: {
      status: 'QUEUED',
      bullJobId,
      attempts: 0,
      errorMessage: null,
    },
  });

  logger.info({ jobId, userId }, 'Job manually retried');
  return updated;
}

export async function scheduleJob(
  jobId: string,
  userId: string,
  isAdmin: boolean,
  scheduledAt: string,
) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new NotFoundError('Job');
  if (!isAdmin && job.userId !== userId) throw new ForbiddenError('Access denied');

  if (!['CREATED', 'FAILED'].includes(job.status)) {
    throw new ConflictError(`Cannot schedule job with status ${job.status}`);
  }

  const scheduleDate = new Date(scheduledAt);
  const delayMs = scheduleDate.getTime() - Date.now();
  if (delayMs <= 0) {
    throw new ValidationError('Scheduled time must be in the future');
  }

  const bullJobId = await enqueueJob(
    job.id,
    job.type,
    job.payload as Record<string, unknown>,
    job.userId,
    job.priority as JobPriority,
    job.maxAttempts,
    delayMs,
  );

  const updated = await prisma.job.update({
    where: { id: jobId },
    data: {
      status: 'SCHEDULED',
      scheduledAt: scheduleDate,
      bullJobId,
    },
  });

  logger.info({ jobId, scheduledAt, userId }, 'Job scheduled');
  return updated;
}

export async function deleteJob(jobId: string, userId: string, isAdmin: boolean) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new NotFoundError('Job');
  if (!isAdmin && job.userId !== userId) throw new ForbiddenError('Access denied');

  if (job.status === 'RUNNING') {
    throw new ConflictError('Cannot delete a running job');
  }

  if (job.bullJobId) {
    await removeJobFromQueue(job.bullJobId);
  }

  await prisma.job.delete({ where: { id: jobId } });
  logger.info({ jobId, userId }, 'Job deleted');
}

export async function getJobExecutions(
  jobId: string,
  userId: string,
  isAdmin: boolean,
  page: number,
  limit: number,
) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new NotFoundError('Job');
  if (!isAdmin && job.userId !== userId) throw new ForbiddenError('Access denied');

  const [executions, total] = await Promise.all([
    prisma.jobExecution.findMany({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        worker: { select: { id: true, workerName: true } },
      },
    }),
    prisma.jobExecution.count({ where: { jobId } }),
  ]);

  return { executions, pagination: buildPagination(page, limit, total) };
}
