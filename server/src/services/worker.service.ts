import { prisma } from '../utils/prisma';
import { buildPagination } from '../utils/response';
import { NotFoundError } from '../utils/errors';

export async function getWorkers(page: number, limit: number) {
  const staleThreshold = new Date(Date.now() - 30000);

  const [workers, total] = await Promise.all([
    prisma.worker.findMany({
      orderBy: { lastHeartbeat: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.worker.count(),
  ]);

  const enriched = workers.map((w) => ({
    ...w,
    isOnline: w.lastHeartbeat >= staleThreshold,
  }));

  return { workers: enriched, pagination: buildPagination(page, limit, total) };
}

export async function getWorkerById(workerId: string) {
  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    include: {
      executions: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          job: { select: { id: true, type: true, status: true } },
        },
      },
    },
  });

  if (!worker) throw new NotFoundError('Worker');

  const staleThreshold = new Date(Date.now() - 30000);
  return { ...worker, isOnline: worker.lastHeartbeat >= staleThreshold };
}
