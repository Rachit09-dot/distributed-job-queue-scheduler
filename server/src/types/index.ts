import { Request } from 'express';
import { JwtPayload } from 'jsonwebtoken';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export interface JwtUserPayload extends JwtPayload {
  userId: string;
  email: string;
  role: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errorCode?: string;
  pagination?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginationQuery {
  page: number;
  limit: number;
}

export type JobPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
export type JobStatus = 'CREATED' | 'QUEUED' | 'SCHEDULED' | 'RUNNING' | 'RETRYING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type JobType = 'EMAIL_SIMULATION' | 'REPORT_GENERATION' | 'DATA_PROCESSING' | 'IMAGE_PROCESSING_SIMULATION' | 'CUSTOM_DELAY';

// Priority to BullMQ numeric priority (lower = higher priority in BullMQ)
export const PRIORITY_MAP: Record<JobPriority, number> = {
  CRITICAL: 1,
  HIGH: 2,
  NORMAL: 3,
  LOW: 4,
};
