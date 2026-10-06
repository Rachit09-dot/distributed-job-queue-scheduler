import { useState, useEffect, useCallback } from 'react';
import { getDashboardStats, getJobStats } from '../services/dashboard.service';
import { DashboardStats, JobStats } from '../types';
import { useSocket } from '../context/SocketContext';

const POLL_INTERVAL_MS = 15000; // Fallback polling every 15s

export function useDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [jobStats, setJobStats] = useState<JobStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { socket, connected } = useSocket();

  const fetchAll = useCallback(async () => {
    try {
      const [s, js] = await Promise.all([getDashboardStats(), getJobStats()]);
      setStats(s);
      setJobStats(js);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // Real-time updates
  useEffect(() => {
    if (!socket) return;
    socket.on('dashboard:updated', fetchAll);
    socket.on('job:updated', fetchAll);
    return () => {
      socket.off('dashboard:updated', fetchAll);
      socket.off('job:updated', fetchAll);
    };
  }, [socket, fetchAll]);

  // Fallback polling when socket is disconnected
  useEffect(() => {
    if (connected) return;
    const interval = setInterval(() => { void fetchAll(); }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [connected, fetchAll]);

  return { stats, jobStats, isLoading, error, refetch: fetchAll };
}
