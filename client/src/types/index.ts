export type JobStatus =
  | 'CREATED'
  | 'QUEUED'
  | 'SCHEDULED'
  | 'RUNNING'
  | 'RETRYING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type JobPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

export type JobType =
  | 'EMAIL_SIMULATION'
  | 'REPORT_GENERATION'
  | 'DATA_PROCESSING'
  | 'IMAGE_PROCESSING_SIMULATION'
  | 'CUSTOM_DELAY';

export type WorkerStatus = 'ONLINE' | 'BUSY' | 'OFFLINE';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN';
  createdAt: string;
  updatedAt?: string;
  _count?: { jobs: number };
}

export interface Job {
  id: string;
  userId: string;
  type: JobType;
  payload: Record<string, unknown>;
  priority: JobPriority;
  status: JobStatus;
  scheduledAt: string | null;
  attempts: number;
  maxAttempts: number;
  result: unknown;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  user?: { id: string; name: string; email: string };
  executions?: JobExecution[];
  _count?: { executions: number };
}

export interface JobExecution {
  id: string;
  jobId: string;
  workerId: string | null;
  attemptNumber: number;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  result: unknown;
  errorMessage: string | null;
  createdAt: string;
  worker?: { id: string; workerName: string } | null;
}

export interface Worker {
  id: string;
  workerName: string;
  status: WorkerStatus;
  hostname: string;
  concurrency: number;
  jobsProcessed: number;
  jobsFailed: number;
  lastHeartbeat: string;
  startedAt: string;
  updatedAt: string;
  isOnline: boolean;
  executions?: JobExecution[];
}

export interface DashboardStats {
  jobs: {
    total: number;
    completed: number;
    failed: number;
    running: number;
    queued: number;
    scheduled: number;
    cancelled: number;
    retrying?: number;
    successRate: number;
  };
  performance: { avgExecutionTimeMs: number };
  workers: { active: number };
  queue: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  };
}

export interface JobStats {
  byType: { type: string; count: number }[];
  byPriority: { priority: string; count: number }[];
  hourly: { hour: string; total: number; completed: number; failed: number }[];
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errorCode?: string;
  pagination?: PaginationMeta;
}
