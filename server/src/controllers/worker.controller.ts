import { Response, NextFunction } from 'express';
import { getWorkers, getWorkerById } from '../services/worker.service';
import { sendSuccess } from '../utils/response';
import { parsePagination } from '../utils/response';
import { AuthRequest } from '../types';

export async function getWorkersHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit } = parsePagination(req.query as Record<string, unknown>);
    const result = await getWorkers(page, limit);
    sendSuccess(res, result.workers, undefined, 200, result.pagination);
  } catch (err) {
    next(err);
  }
}

export async function getWorkerByIdHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const worker = await getWorkerById(req.params.id);
    sendSuccess(res, worker);
  } catch (err) {
    next(err);
  }
}
