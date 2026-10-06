import { Response, NextFunction } from 'express';
import { getDashboardStats, getJobStats, getWorkerStats } from '../services/dashboard.service';
import { sendSuccess } from '../utils/response';
import { AuthRequest } from '../types';

export async function statsHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const stats = await getDashboardStats(req.user!.id, req.user!.role === 'ADMIN');
    sendSuccess(res, stats);
  } catch (err) {
    next(err);
  }
}

export async function jobStatsHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const stats = await getJobStats(req.user!.id, req.user!.role === 'ADMIN');
    sendSuccess(res, stats);
  } catch (err) {
    next(err);
  }
}

export async function workerStatsHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const stats = await getWorkerStats();
    sendSuccess(res, stats);
  } catch (err) {
    next(err);
  }
}
