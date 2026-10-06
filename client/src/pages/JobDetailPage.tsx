import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getJob, cancelJob, retryJob, getJobExecutions } from '../services/job.service';
import { getErrorMessage } from '../services/api';
import { Job, JobExecution, PaginationMeta } from '../types';
import { StatusBadge, PriorityBadge } from '../components/ui/StatusBadge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import { Pagination } from '../components/ui/Pagination';
import { formatDate, formatRelativeTime, formatDuration, formatJobType } from '../utils/formatting';
import { useSocket } from '../context/SocketContext';

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-gray-500 text-xs uppercase tracking-wide">{label}</dt>
      <dd className="text-gray-800 font-medium">{children}</dd>
    </div>
  );
}

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { socket } = useSocket();

  const [job, setJob] = useState<Job | null>(null);
  const [executions, setExecutions] = useState<JobExecution[]>([]);
  const [execPagination, setExecPagination] = useState<PaginationMeta | null>(null);
  const [execPage, setExecPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  async function loadJob() {
    if (!id) return;
    try {
      const j = await getJob(id);
      setJob(j);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  async function loadExecutions(page: number) {
    if (!id) return;
    try {
      const result = await getJobExecutions(id, page, 10);
      setExecutions(result.executions);
      setExecPagination(result.pagination);
    } catch {
      // Non-critical
    }
  }

  useEffect(() => {
    void loadJob();
    void loadExecutions(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    void loadExecutions(execPage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [execPage]);

  // Subscribe to real-time updates for this specific job
  useEffect(() => {
    if (!socket || !id) return;
    socket.emit('subscribe:job', id);
    const handler = () => {
      void loadJob();
      void loadExecutions(execPage);
    };
    socket.on('job:updated', handler);
    return () => {
      socket.emit('unsubscribe:job', id);
      socket.off('job:updated', handler);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, id]);

  async function handleCancel() {
    if (!id) return;
    setActionLoading(true);
    setActionError('');
    try {
      const updated = await cancelJob(id);
      setJob(updated);
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRetry() {
    if (!id) return;
    setActionLoading(true);
    setActionError('');
    try {
      const updated = await retryJob(id);
      setJob(updated);
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  }

  if (isLoading) return <div className="flex justify-center p-12"><Spinner size="lg" /></div>;
  if (error) return <div className="p-6 bg-red-50 rounded-xl text-red-700">{error}</div>;
  if (!job) return null;

  const durationMs =
    job.completedAt && job.startedAt
      ? new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()
      : null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button variant="ghost" size="sm" onClick={() => navigate('/jobs')}>← Back</Button>
          </div>
          <h1 className="text-xl font-bold text-gray-900">{formatJobType(job.type)}</h1>
          <p className="text-gray-400 font-mono text-xs mt-1">{job.id}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusBadge status={job.status} />
          <PriorityBadge priority={job.priority} />
        </div>
      </div>

      {actionError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {actionError}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {(job.status === 'QUEUED' || job.status === 'SCHEDULED') && (
          <Button variant="danger" size="sm" loading={actionLoading} onClick={handleCancel}>
            Cancel Job
          </Button>
        )}
        {job.status === 'FAILED' && (
          <Button variant="success" size="sm" loading={actionLoading} onClick={handleRetry}>
            Retry Now
          </Button>
        )}
      </div>

      {/* Job details */}
      <Card>
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Job Details</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <DetailItem label="Status"><StatusBadge status={job.status} /></DetailItem>
          <DetailItem label="Priority"><PriorityBadge priority={job.priority} /></DetailItem>
          <DetailItem label="Type">{formatJobType(job.type)}</DetailItem>
          <DetailItem label="Attempts">{job.attempts} / {job.maxAttempts}</DetailItem>
          <DetailItem label="Created">{formatDate(job.createdAt)}</DetailItem>
          <DetailItem label="Started">{formatDate(job.startedAt)}</DetailItem>
          <DetailItem label="Completed">{formatDate(job.completedAt)}</DetailItem>
          <DetailItem label="Duration">{formatDuration(durationMs)}</DetailItem>
          {job.scheduledAt && (
            <DetailItem label="Scheduled for">{formatDate(job.scheduledAt)}</DetailItem>
          )}
        </dl>
      </Card>

      {/* Payload */}
      <Card>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Payload</h2>
        <pre className="bg-gray-50 rounded-lg p-4 text-xs font-mono overflow-auto max-h-48 text-gray-700">
          {JSON.stringify(job.payload, null, 2)}
        </pre>
      </Card>

      {/* Result */}
      {job.result && (
        <Card>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Result</h2>
          <pre className="bg-green-50 rounded-lg p-4 text-xs font-mono overflow-auto max-h-48 text-green-900">
            {JSON.stringify(job.result, null, 2)}
          </pre>
        </Card>
      )}

      {/* Error */}
      {job.errorMessage && (
        <Card>
          <h2 className="text-sm font-semibold text-red-600 mb-2">Error</h2>
          <p className="text-sm text-red-700 bg-red-50 rounded-lg p-3">{job.errorMessage}</p>
        </Card>
      )}

      {/* Execution history */}
      <Card>
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Execution History</h2>
        {executions.length === 0 ? (
          <p className="text-gray-400 text-sm">No executions yet</p>
        ) : (
          <>
            <div className="space-y-3">
              {executions.map((exec) => (
                <div
                  key={exec.id}
                  className="flex items-start justify-between p-3 rounded-lg bg-gray-50 border border-gray-100"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          exec.status === 'COMPLETED'
                            ? 'bg-green-100 text-green-700'
                            : exec.status === 'FAILED'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        Attempt {exec.attemptNumber} — {exec.status}
                      </span>
                      {exec.worker && (
                        <span className="text-xs text-gray-400">{exec.worker.workerName}</span>
                      )}
                    </div>
                    {exec.errorMessage && (
                      <p className="text-xs text-red-600">{exec.errorMessage}</p>
                    )}
                    <p className="text-xs text-gray-400">{formatRelativeTime(exec.startedAt)}</p>
                  </div>
                  <span className="text-xs text-gray-500 flex-shrink-0">
                    {formatDuration(exec.durationMs)}
                  </span>
                </div>
              ))}
            </div>
            {execPagination && (
              <Pagination pagination={execPagination} onPageChange={setExecPage} />
            )}
          </>
        )}
      </Card>
    </div>
  );
}
