import { api } from './api';
import { Job, JobExecution, JobStatus, JobPriority, JobType, PaginationMeta } from '../types';

export interface CreateJobPayload {
  type: JobType;
  payload: Record<string, unknown>;
  priority: JobPriority;
  maxAttempts: number;
  scheduledAt?: string;
  idempotencyKey?: string;
}

export interface JobFilters {
  status?: JobStatus;
  priority?: JobPriority;
  type?: JobType;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface JobsResult {
  jobs: Job[];
  pagination: PaginationMeta;
}

export async function createJob(payload: CreateJobPayload): Promise<Job> {
  const res = await api.post<{ success: boolean; data: Job }>('/jobs', payload);
  return res.data.data!;
}

export async function getJobs(filters: JobFilters = {}): Promise<JobsResult> {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== ''),
  );
  const res = await api.get<{ success: boolean; data: Job[]; pagination: PaginationMeta }>(
    '/jobs',
    { params },
  );
  return { jobs: res.data.data!, pagination: res.data.pagination! };
}

export async function getJob(id: string): Promise<Job> {
  const res = await api.get<{ success: boolean; data: Job }>(`/jobs/${id}`);
  return res.data.data!;
}

export async function cancelJob(id: string): Promise<Job> {
  const res = await api.post<{ success: boolean; data: Job }>(`/jobs/${id}/cancel`);
  return res.data.data!;
}

export async function retryJob(id: string): Promise<Job> {
  const res = await api.post<{ success: boolean; data: Job }>(`/jobs/${id}/retry`);
  return res.data.data!;
}

export async function scheduleJob(id: string, scheduledAt: string): Promise<Job> {
  const res = await api.post<{ success: boolean; data: Job }>(`/jobs/${id}/schedule`, {
    scheduledAt,
  });
  return res.data.data!;
}

export async function deleteJob(id: string): Promise<void> {
  await api.delete(`/jobs/${id}`);
}

export async function getJobExecutions(
  id: string,
  page = 1,
  limit = 20,
): Promise<{ executions: JobExecution[]; pagination: PaginationMeta }> {
  const res = await api.get<{
    success: boolean;
    data: JobExecution[];
    pagination: PaginationMeta;
  }>(`/jobs/${id}/executions`, { params: { page, limit } });
  return { executions: res.data.data!, pagination: res.data.pagination! };
}
