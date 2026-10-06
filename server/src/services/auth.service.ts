import bcrypt from 'bcryptjs';
import { prisma } from '../utils/prisma';
import { signToken } from '../utils/jwt';
import { ConflictError, UnauthorizedError } from '../utils/errors';
import { RegisterInput, LoginInput } from '../validators/auth.validator';
import { logger } from '../utils/logger';

const BCRYPT_ROUNDS = 12;

export async function registerUser(input: RegisterInput) {
  // Normalize email: trim whitespace and lowercase for consistent lookup
  const normalizedEmail = input.email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    throw new ConflictError('Email already registered');
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      name: input.name.trim(),
      email: normalizedEmail,
      passwordHash,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  logger.info({ userId: user.id, email: user.email }, 'User registered');

  const token = signToken({ userId: user.id, email: user.email, role: user.role });
  return { user, token };
}

export async function loginUser(input: LoginInput) {
  // Normalize email consistently with registration
  const normalizedEmail = input.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const passwordValid = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordValid) {
    logger.warn({ email: normalizedEmail }, 'Failed login attempt');
    throw new UnauthorizedError('Invalid email or password');
  }

  logger.info({ userId: user.id, email: user.email }, 'User logged in');

  const token = signToken({ userId: user.id, email: user.email, role: user.role });
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    },
    token,
  };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: { jobs: true },
      },
    },
  });
  return user;
}
