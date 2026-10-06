import { api } from './api';
import { User } from '../types';

export interface LoginPayload { email: string; password: string; }
export interface RegisterPayload { name: string; email: string; password: string; }
export interface AuthResult { user: User; token: string; }

export async function login(payload: LoginPayload): Promise<AuthResult> {
  const res = await api.post<{ success: boolean; data: AuthResult }>('/auth/login', payload);
  return res.data.data!;
}

export async function register(payload: RegisterPayload): Promise<AuthResult> {
  const res = await api.post<{ success: boolean; data: AuthResult }>('/auth/register', payload);
  return res.data.data!;
}

export async function getMe(): Promise<User> {
  const res = await api.get<{ success: boolean; data: User }>('/auth/me');
  return res.data.data!;
}
