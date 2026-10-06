import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { logger } from './logger';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined');
}

const adapter = new PrismaPg({
  connectionString,
});

export const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development'
    ? ['warn', 'error']
    : ['error'],
});

prisma.$connect().then(() => {
  logger.info('Worker: PostgreSQL connected');
}).catch((err) => {
  logger.error({ err }, 'Worker: Failed to connect to PostgreSQL');
  process.exit(1);
});