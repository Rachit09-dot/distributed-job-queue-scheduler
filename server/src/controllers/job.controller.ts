import { Response, NextFunction } from 'express';
import {
  CreateJobSchema,
  UpdateJobSchema,
  ScheduleJobSchema,
} from '../validators/job.validator';
import {
  createJob,
  getJobs,
  getJobById,
  updateJob,
  cancelJob,
  retryJob,
  scheduleJob,
  deleteJob,
  getJobExecutions,
} from '../services/job.service';
import { sendSuccess } from '../utils/response';
import { parsePagination } from '../utils/response';
import { AuthRequest } from '../types';
import { JobStatus, JobPriority } from '@prisma/client';

export async function createJobHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const input = CreateJobSchema.parse(req.body);
    const job = await createJob(req.user!.id, input);
    sendSuccess(res, job, 'Job created successfully', 201);
  } catch (err) {
    next(err);
  }
}

export async function getJobsHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit } = parsePagination(req.query as Record<string, unknown>);
    const { status, priority, type, search, sortBy, sortOrder } = req.query as Record<string, string>;

    const result = await getJobs(req.user!.id, req.user!.role === 'ADMIN', {
      page,
      limit,
      status: status as JobStatus,
      priority: priority as JobPriority,
      type,
      search,
      sortBy,
      sortOrder: sortOrder as 'asc' | 'desc',
    });

    sendSuccess(res, result.jobs, undefined, 200, result.pagination);
  } catch (err) {
    next(err);
  }
}

export async function getJobByIdHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const job = await getJobById(req.params.id, req.user!.id, req.user!.role === 'ADMIN');
    sendSuccess(res, job);
  } catch (err) {
    next(err);
  }
}

export async function updateJobHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const input = UpdateJobSchema.parse(req.body);
    const job = await updateJob(req.params.id, req.user!.id, req.user!.role === 'ADMIN', input);
    sendSuccess(res, job, 'Job updated');
  } catch (err) {
    next(err);
  }
}

export async function deleteJobHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await deleteJob(req.params.id, req.user!.id, req.user!.role === 'ADMIN');
    sendSuccess(res, null, 'Job deleted');
  } catch (err) {
    next(err);
  }
}

export async function cancelJobHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const job = await cancelJob(req.params.id, req.user!.id, req.user!.role === 'ADMIN');
    sendSuccess(res, job, 'Job cancelled');
  } catch (err) {
    next(err);
  }
}

export async function retryJobHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const job = await retryJob(req.params.id, req.user!.id, req.user!.role === 'ADMIN');
    sendSuccess(res, job, 'Job queued for retry');
  } catch (err) {
    next(err);
  }
}

export async function scheduleJobHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { scheduledAt } = ScheduleJobSchema.parse(req.body);
    const job = await scheduleJob(
      req.params.id,
      req.user!.id,
      req.user!.role === 'ADMIN',
      scheduledAt,
    );
    sendSuccess(res, job, 'Job scheduled');
  } catch (err) {
    next(err);
  }
}

export async function getJobExecutionsHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const { page, limit } = parsePagination(req.query as Record<string, unknown>);
    const result = await getJobExecutions(
      req.params.id,
      req.user!.id,
      req.user!.role === 'ADMIN',
      page,
      limit,
    );
    sendSuccess(res, result.executions, undefined, 200, result.pagination);
  } catch (err) {
    next(err);
  }
}
