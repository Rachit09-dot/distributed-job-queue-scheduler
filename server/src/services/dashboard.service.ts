import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { getQueueStats } from './queue.service';

export async function getDashboardStats(userId: string, isAdmin: boolean) {
  const userFilter = isAdmin ? {} : { userId };

  const [
    totalJobs,
    completedJobs,
    failedJobs,
    runningJobs,
    queuedJobs,
    scheduledJobs,
    cancelledJobs,
    retryingJobs,
    avgDurationResult,
    activeWorkers,
    queueStats,
  ] = await Promise.all([
    prisma.job.count({ where: userFilter }),
    prisma.job.count({ where: { ...userFilter, status: 'COMPLETED' } }),
    prisma.job.count({ where: { ...userFilter, status: 'FAILED' } }),
    prisma.job.count({ where: { ...userFilter, status: 'RUNNING' } }),
    prisma.job.count({ where: { ...userFilter, status: 'QUEUED' } }),
    prisma.job.count({ where: { ...userFilter, status: 'SCHEDULED' } }),
    prisma.job.count({ where: { ...userFilter, status: 'CANCELLED' } }),
    prisma.job.count({ where: { ...userFilter, status: 'RETRYING' } }),
    prisma.jobExecution.aggregate({
      where: {
        status: 'COMPLETED',
        durationMs: { not: null },
        ...(isAdmin ? {} : { job: { userId } }),
      },
      _avg: { durationMs: true },
    }),
    prisma.worker.count({
      where: {
        status: { in: ['ONLINE', 'BUSY'] },
        lastHeartbeat: { gte: new Date(Date.now() - 30000) },
      },
    }),
    getQueueStats(),
  ]);

  const successRate =
    completedJobs + failedJobs > 0
      ? Math.round((completedJobs / (completedJobs + failedJobs)) * 100)
      : 0;

  return {
    jobs: {
      total: totalJobs,
      completed: completedJobs,
      failed: failedJobs,
      running: runningJobs,
      queued: queuedJobs,
      scheduled: scheduledJobs,
      cancelled: cancelledJobs,
      retrying: retryingJobs,
      successRate,
    },
    performance: {
      avgExecutionTimeMs: Math.round(avgDurationResult._avg.durationMs || 0),
    },
    workers: {
      active: activeWorkers,
    },
    queue: queueStats,
  };
}

export async function getJobStats(userId: string, isAdmin: boolean) {
  const userFilter = isAdmin ? {} : { userId };

  // Jobs by type
  const byType = await prisma.job.groupBy({
    by: ['type'],
    where: userFilter,
    _count: { type: true },
  });

  // Jobs by priority
  const byPriority = await prisma.job.groupBy({
    by: ['priority'],
    where: userFilter,
    _count: { priority: true },
  });

  // Hourly stats for the last 24 hours — aggregated in PostgreSQL, not in Node.js.
  // We use $queryRaw so we can use date_trunc without loading every row into memory.
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  type HourlyRow = { hour: Date; total: bigint; completed: bigint; failed: bigint };

  const userCondition = isAdmin
    ? Prisma.sql``
    : Prisma.sql`AND "userId" = ${userId}`;

  const rawHourly = await prisma.$queryRaw<HourlyRow[]>`
    SELECT
      date_trunc('hour', "createdAt") AS hour,
      COUNT(*)                          AS total,
      COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed,
      COUNT(*) FILTER (WHERE status = 'FAILED')    AS failed
    FROM jobs
    WHERE "createdAt" >= ${oneDayAgo}
      ${userCondition}
    GROUP BY date_trunc('hour', "createdAt")
    ORDER BY hour ASC
  `;

  // BigInt → number (counts are never astronomically large)
  const hourlyStats = rawHourly.map((row) => ({
    hour: row.hour.toISOString(),
    total: Number(row.total),
    completed: Number(row.completed),
    failed: Number(row.failed),
  }));

  return {
    byType: byType.map((r) => ({ type: r.type, count: r._count.type })),
    byPriority: byPriority.map((r) => ({ priority: r.priority, count: r._count.priority })),
    hourly: hourlyStats,
  };
}

export async function getWorkerStats() {
  const workers = await prisma.worker.findMany({
    orderBy: { jobsProcessed: 'desc' },
    include: {
      _count: { select: { executions: true } },
    },
  });

  const staleThreshold = new Date(Date.now() - 30000); // 30 seconds

  return workers.map((w) => ({
    ...w,
    isOnline: w.lastHeartbeat >= staleThreshold,
  }));
}
