import { useState, useEffect, useCallback, useRef } from 'react';
import { getJobs, JobFilters } from '../services/job.service';
import { Job, PaginationMeta } from '../types';
import { useSocket } from '../context/SocketContext';

interface UseJobsResult {
  jobs: Job[];
  pagination: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

const DEFAULT_PAGINATION: PaginationMeta = {
  page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false,
};

export function useJobs(filters: JobFilters): UseJobsResult {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { socket } = useSocket();
  const fetchRef = useRef(0);

  const fetch = useCallback(async () => {
    const id = ++fetchRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const result = await getJobs(filters);
      if (id === fetchRef.current) {
        setJobs(result.jobs);
        setPagination(result.pagination ?? DEFAULT_PAGINATION);
      }
    } catch (err) {
      if (id === fetchRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load jobs');
      }
    } finally {
      if (id === fetchRef.current) setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)]);

  useEffect(() => { void fetch(); }, [fetch]);

  // Real-time updates via Socket.IO
  useEffect(() => {
    if (!socket) return;
    const handler = () => { void fetch(); };
    socket.on('job:updated', handler);
    return () => { socket.off('job:updated', handler); };
  }, [socket, fetch]);

  return { jobs, pagination, isLoading, error, refetch: fetch };
}
