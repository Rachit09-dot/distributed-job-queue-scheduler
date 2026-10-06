import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useJobs } from '../hooks/useJobs';
import { cancelJob, retryJob, deleteJob } from '../services/job.service';
import { getErrorMessage } from '../services/api';
import { JobStatus, JobPriority, JobType } from '../types';
import { StatusBadge, PriorityBadge } from '../components/ui/StatusBadge';
import { Button } from '../components/ui/Button';
import { Pagination } from '../components/ui/Pagination';
import { Spinner } from '../components/ui/Spinner';
import { formatDate, formatDuration, formatJobType } from '../utils/formatting';

const STATUS_OPTIONS: JobStatus[] = ['CREATED','QUEUED','SCHEDULED','RUNNING','RETRYING','COMPLETED','FAILED','CANCELLED'];
const PRIORITY_OPTIONS: JobPriority[] = ['CRITICAL','HIGH','NORMAL','LOW'];
const TYPE_OPTIONS: JobType[] = ['EMAIL_SIMULATION','REPORT_GENERATION','DATA_PROCESSING','IMAGE_PROCESSING_SIMULATION','CUSTOM_DELAY'];

export function JobsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<JobStatus | ''>('');
  const [priority, setPriority] = useState<JobPriority | ''>('');
  const [type, setType] = useState<JobType | ''>('');
  const [actionError, setActionError] = useState('');

  const filters = {
    page,
    limit: 20,
    ...(status && { status }),
    ...(priority && { priority }),
    ...(type && { type }),
  };

  const { jobs, pagination, isLoading, error, refetch } = useJobs(filters);

  async function handleCancel(id: string) {
    setActionError('');
    try {
      await cancelJob(id);
      refetch();
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  }

  async function handleRetry(id: string) {
    setActionError('');
    try {
      await retryJob(id);
      refetch();
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this job? This cannot be undone.')) return;
    setActionError('');
    try {
      await deleteJob(id);
      refetch();
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  }

  function resetFilters() {
    setStatus('');
    setPriority('');
    setType('');
    setPage(1);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
          <p className="text-gray-500 text-sm">
            {pagination ? `${pagination.total} total jobs` : 'Loading...'}
          </p>
        </div>
        <Button onClick={() => navigate('/jobs/new')}>+ Create Job</Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-3">
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value as any); setPage(1); }}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={priority}
          onChange={(e) => { setPriority(e.target.value as any); setPage(1); }}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Priorities</option>
          {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select
          value={type}
          onChange={(e) => { setType(e.target.value as any); setPage(1); }}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Types</option>
          {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{formatJobType(t)}</option>)}
        </select>
        {(status || priority || type) && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>Clear filters</Button>
        )}
      </div>

      {actionError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {actionError}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <Spinner />
          </div>
        ) : error ? (
          <div className="p-6 text-red-600 text-sm">{error}</div>
        ) : jobs.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="text-lg mb-2">No jobs found</p>
            <p className="text-sm">Create your first job to get started</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Job ID','Type','Priority','Status','Attempts','Created','Duration','Actions'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {jobs.map((job) => {
                    const durationMs =
                      job.completedAt && job.startedAt
                        ? new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()
                        : null;
                    return (
                      <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-gray-600">
                          <button
                            onClick={() => navigate(`/jobs/${job.id}`)}
                            className="text-blue-600 hover:underline"
                          >
                            {job.id.slice(0, 8)}…
                          </button>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{formatJobType(job.type)}</td>
                        <td className="px-4 py-3"><PriorityBadge priority={job.priority} /></td>
                        <td className="px-4 py-3"><StatusBadge status={job.status} /></td>
                        <td className="px-4 py-3 text-center text-gray-600">
                          {job.attempts}/{job.maxAttempts}
                        </td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {formatDate(job.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{formatDuration(durationMs)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" onClick={() => navigate(`/jobs/${job.id}`)}>
                              View
                            </Button>
                            {(job.status === 'QUEUED' || job.status === 'SCHEDULED') && (
                              <Button size="sm" variant="ghost" onClick={() => handleCancel(job.id)}>
                                Cancel
                              </Button>
                            )}
                            {job.status === 'FAILED' && (
                              <Button size="sm" variant="success" onClick={() => handleRetry(job.id)}>
                                Retry
                              </Button>
                            )}
                            {!['RUNNING'].includes(job.status) && (
                              <Button size="sm" variant="danger" onClick={() => handleDelete(job.id)}>
                                ✕
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {pagination && (
              <div className="px-4 border-t border-gray-100">
                <Pagination pagination={pagination} onPageChange={setPage} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
