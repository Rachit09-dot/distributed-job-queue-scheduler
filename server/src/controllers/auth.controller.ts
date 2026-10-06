import { Request, Response, NextFunction } from 'express';
import { RegisterSchema, LoginSchema } from '../validators/auth.validator';
import { registerUser, loginUser, getMe } from '../services/auth.service';
import { sendSuccess } from '../utils/response';
import { AuthRequest } from '../types';

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const input = RegisterSchema.parse(req.body);
    const result = await registerUser(input);
    sendSuccess(res, result, 'Registration successful', 201);
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const input = LoginSchema.parse(req.body);
    const result = await loginUser(input);
    sendSuccess(res, result, 'Login successful');
  } catch (err) {
    next(err);
  }
}

export async function me(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = await getMe(req.user!.id);
    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
}
