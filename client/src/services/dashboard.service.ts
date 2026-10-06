import { api } from './api';
import { DashboardStats, JobStats, Worker } from '../types';

export async function getDashboardStats(): Promise<DashboardStats> {
  const res = await api.get<{ success: boolean; data: DashboardStats }>('/dashboard/stats');
  return res.data.data!;
}

export async function getJobStats(): Promise<JobStats> {
  const res = await api.get<{ success: boolean; data: JobStats }>('/dashboard/job-stats');
  return res.data.data!;
}

export async function getWorkerStats(): Promise<Worker[]> {
  const res = await api.get<{ success: boolean; data: Worker[] }>('/dashboard/worker-stats');
  return res.data.data!;
}

export async function getWorkers(
  page = 1,
  limit = 20,
): Promise<{ workers: Worker[]; pagination: any }> {
  const res = await api.get<{ success: boolean; data: Worker[]; pagination: any }>(
    '/workers',
    { params: { page, limit } },
  );
  return { workers: res.data.data!, pagination: res.data.pagination };
}

export async function getWorker(id: string): Promise<Worker> {
  const res = await api.get<{ success: boolean; data: Worker }>(`/workers/${id}`);
  return res.data.data!;
}
