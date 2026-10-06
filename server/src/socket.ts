import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyToken } from './utils/jwt';
import { prisma } from './utils/prisma';
import { logger } from './utils/logger';

export function setupSocketIO(io: SocketIOServer): void {
  // Authenticate socket connections with JWT
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;
    if (!token) {
      next(new Error('Authentication required'));
      return;
    }
    try {
      const payload = verifyToken(token);
      socket.data.userId = payload.userId;
      socket.data.role = payload.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId as string;
    logger.info({ socketId: socket.id, userId }, 'Socket connected');

    // Join user-specific room for targeted updates
    void socket.join(`user:${userId}`);

    // Admins join the admin room
    if (socket.data.role === 'ADMIN') {
      void socket.join('admin');
    }

    socket.on('subscribe:job', async (jobId: string) => {
      // Authorization check: a USER may only subscribe to their own jobs.
      // ADMINs may subscribe to any job.
      try {
        const job = await prisma.job.findUnique({
          where: { id: jobId },
          select: { userId: true },
        });

        if (!job) {
          socket.emit('error', { message: 'Job not found', jobId });
          return;
        }

        const role = socket.data.role as string;
        const userId = socket.data.userId as string;

        if (role !== 'ADMIN' && job.userId !== userId) {
          socket.emit('error', { message: 'Forbidden: not your job', jobId });
          logger.warn({ socketId: socket.id, userId, jobId }, 'Unauthorized subscribe:job attempt');
          return;
        }

        void socket.join(`job:${jobId}`);
      } catch (err) {
        logger.error({ err, jobId }, 'subscribe:job error');
        socket.emit('error', { message: 'Internal error subscribing to job' });
      }
    });

    socket.on('unsubscribe:job', (jobId: string) => {
      void socket.leave(`job:${jobId}`);
    });

    socket.on('disconnect', () => {
      logger.info({ socketId: socket.id, userId }, 'Socket disconnected');
    });
  });
}

// Emit job status change to relevant rooms
export function emitJobUpdate(
  io: SocketIOServer,
  userId: string,
  jobId: string,
  data: Record<string, unknown>,
): void {
  io.to(`user:${userId}`).emit('job:updated', data);
  io.to(`job:${jobId}`).emit('job:updated', data);
  io.to('admin').emit('job:updated', data);
}

export function emitWorkerUpdate(io: SocketIOServer, data: Record<string, unknown>): void {
  io.to('admin').emit('worker:updated', data);
}

export function emitDashboardUpdate(io: SocketIOServer, data: Record<string, unknown>): void {
  io.emit('dashboard:updated', data);
}
