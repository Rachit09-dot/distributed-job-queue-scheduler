import { formatDistanceToNow, format } from 'date-fns';
import { JobStatus, JobPriority, WorkerStatus } from '../types';

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return format(new Date(dateStr), 'MMM d, yyyy HH:mm');
}

export function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

export const STATUS_CONFIG: Record<JobStatus, { label: string; color: string; bg: string; dot: string }> = {
  CREATED:   { label: 'Created',   color: 'text-gray-600',    bg: 'bg-gray-100',    dot: 'bg-gray-400' },
  QUEUED:    { label: 'Queued',    color: 'text-blue-700',    bg: 'bg-blue-100',    dot: 'bg-blue-500' },
  SCHEDULED: { label: 'Scheduled', color: 'text-purple-700',  bg: 'bg-purple-100',  dot: 'bg-purple-500' },
  RUNNING:   { label: 'Running',   color: 'text-yellow-700',  bg: 'bg-yellow-100',  dot: 'bg-yellow-500' },
  RETRYING:  { label: 'Retrying',  color: 'text-orange-700',  bg: 'bg-orange-100',  dot: 'bg-orange-500' },
  COMPLETED: { label: 'Completed', color: 'text-green-700',   bg: 'bg-green-100',   dot: 'bg-green-500' },
  FAILED:    { label: 'Failed',    color: 'text-red-700',     bg: 'bg-red-100',     dot: 'bg-red-500' },
  CANCELLED: { label: 'Cancelled', color: 'text-gray-500',    bg: 'bg-gray-100',    dot: 'bg-gray-400' },
};

export const PRIORITY_CONFIG: Record<JobPriority, { label: string; color: string; bg: string }> = {
  CRITICAL: { label: 'Critical', color: 'text-red-700',    bg: 'bg-red-100' },
  HIGH:     { label: 'High',     color: 'text-orange-700', bg: 'bg-orange-100' },
  NORMAL:   { label: 'Normal',   color: 'text-blue-700',   bg: 'bg-blue-100' },
  LOW:      { label: 'Low',      color: 'text-gray-600',   bg: 'bg-gray-100' },
};

export const WORKER_STATUS_CONFIG: Record<WorkerStatus, { label: string; color: string; bg: string }> = {
  ONLINE:  { label: 'Online', color: 'text-green-700', bg: 'bg-green-100' },
  BUSY:    { label: 'Busy',   color: 'text-yellow-700', bg: 'bg-yellow-100' },
  OFFLINE: { label: 'Offline', color: 'text-gray-500', bg: 'bg-gray-100' },
};

export function formatJobType(type: string): string {
  return type
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}
