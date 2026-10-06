import { Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { AuthRequest } from '../types';

export function authenticate(req: AuthRequest, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }

    const token = authHeader.slice(7);
    const payload = verifyToken(token);

    req.user = {
      id: payload.userId,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      next(err);
    } else {
      next(new UnauthorizedError('Invalid or expired token'));
    }
  }
}

export function requireAdmin(req: AuthRequest, _res: Response, next: NextFunction): void {
  if (req.user?.role !== 'ADMIN') {
    next(new ForbiddenError('Admin access required'));
    return;
  }
  next();
}

export function requireOwnerOrAdmin(
  getUserId: (req: AuthRequest) => string | undefined,
) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    const resourceUserId = getUserId(req);
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }
    if (req.user.role === 'ADMIN' || req.user.id === resourceUserId) {
      next();
      return;
    }
    next(new ForbiddenError('Access denied'));
  };
}
