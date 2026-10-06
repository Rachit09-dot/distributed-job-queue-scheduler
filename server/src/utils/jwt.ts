import jwt from 'jsonwebtoken';
import { JwtUserPayload } from '../types';

const secret = process.env.JWT_SECRET;

if (!secret || secret.length < 32) {
  throw new Error(
    'JWT_SECRET environment variable is required and must be at least 32 characters. ' +
    'Set it in your .env file before starting the server.',
  );
}

// After the guard above, we know secret is a non-empty string.
// The explicit cast tells TypeScript the same thing.
const JWT_SECRET: string = secret;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export function signToken(payload: Omit<JwtUserPayload, keyof jwt.JwtPayload>): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'job-queue-api',
  } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtUserPayload {
  return jwt.verify(token, JWT_SECRET, {
    issuer: 'job-queue-api',
  }) as unknown as JwtUserPayload;
}
