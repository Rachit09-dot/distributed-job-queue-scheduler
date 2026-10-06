import { useState, useEffect, useCallback } from 'react';
import { getWorkerStats } from '../services/dashboard.service';
import { Worker } from '../types';
import { useSocket } from '../context/SocketContext';

const POLL_INTERVAL_MS = 15000;

export function useWorkers() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { socket, connected } = useSocket();

  const fetch = useCallback(async () => {
    try {
      const data = await getWorkerStats();
      setWorkers(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workers');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void fetch(); }, [fetch]);

  useEffect(() => {
    if (!socket) return;
    socket.on('worker:updated', fetch);
    return () => { socket.off('worker:updated', fetch); };
  }, [socket, fetch]);

  useEffect(() => {
    if (connected) return;
    const interval = setInterval(() => { void fetch(); }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [connected, fetch]);

  return { workers, isLoading, error, refetch: fetch };
}
