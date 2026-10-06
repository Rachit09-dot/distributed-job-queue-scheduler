import { JobStatus, JobPriority, WorkerStatus } from '../../types';
import { STATUS_CONFIG, PRIORITY_CONFIG, WORKER_STATUS_CONFIG } from '../../utils/formatting';

export function StatusBadge({ status }: { status: JobStatus }) {
  const cfg = STATUS_CONFIG[status];
  const isAnimated = status === 'RUNNING' || status === 'RETRYING';
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${isAnimated ? 'animate-pulse' : ''}`}
      />
      {cfg.label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: JobPriority }) {
  const cfg = PRIORITY_CONFIG[priority];
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}
    >
      {cfg.label}
    </span>
  );
}

export function WorkerStatusBadge({ status }: { status: WorkerStatus }) {
  const cfg = WORKER_STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'ONLINE' ? 'bg-green-500 animate-pulse' : status === 'BUSY' ? 'bg-yellow-500 animate-pulse' : 'bg-gray-400'}`} />
      {cfg.label}
    </span>
  );
}
