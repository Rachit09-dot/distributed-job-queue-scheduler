import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import pinoHttp from 'pino-http';

import authRoutes from './routes/auth.routes';
import jobRoutes from './routes/job.routes';
import dashboardRoutes from './routes/dashboard.routes';
import workerRoutes from './routes/worker.routes';
import { errorHandler } from './middleware/errorHandler';
import { generalLimiter } from './middleware/rateLimiter';
import { logger } from './utils/logger';
import { setupSocketIO } from './socket';
import { startJobUpdateSubscriber, stopJobUpdateSubscriber } from './utils/subscriber';

const PORT = parseInt(process.env.PORT || '4000', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

const app = express();
const httpServer = http.createServer(app);

// Trust the first proxy hop (nginx in Docker). Required so express-rate-limit
// reads X-Forwarded-For instead of the Docker bridge IP, which would bucket
// all users under a single IP and break per-client rate limiting.
app.set('trust proxy', 1);

// Socket.IO setup
export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

setupSocketIO(io);

// Subscribe to worker job-status events and broadcast via Socket.IO
startJobUpdateSubscriber(io);

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key'],
  }),
);

// Request parsing + compression
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(
  pinoHttp({
    logger,
    customLogLevel: (_req, res) => (res.statusCode >= 500 ? 'error' : 'info'),
    serializers: {
      req: (req) => ({ method: req.method, url: req.url }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  }),
);

// Rate limiting
app.use('/api/', generalLimiter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/workers', workerRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint not found', errorCode: 'NOT_FOUND' });
});

// Centralized error handler
app.use(errorHandler);

// Start server
httpServer.listen(PORT, () => {
  logger.info({ port: PORT, env: process.env.NODE_ENV }, 'Server started');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await stopJobUpdateSubscriber();
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

export { app, httpServer };
