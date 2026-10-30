import 'express-async-errors'; // Must be first — patches Express to forward async errors
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import http from 'http';

import { config } from './config/env';
import { prisma } from './config/database';
import { globalErrorHandler, notFoundHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth.routes';
import organizationRoutes from './routes/organization.routes';
import tenantRoutes from './routes/tenant.routes';
import boardRoutes from './routes/board.routes';
import columnRoutes from './routes/column.routes';
import taskRoutes from './routes/task.routes';
import { initializeSocket, getIO } from './config/socket';

const app = express();
const httpServer = http.createServer(app);

// ─────────────────────────────────────────────────────────────────────────────
// 1. Security HTTP Headers (Helmet)
// Disables contentSecurityPolicy on the API server to allow WebSocket and API consumers
// ─────────────────────────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// 2. CORS (Cross-Origin Resource Sharing)
// Allows local Vite dev server and hosted production domains
// ─────────────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        allowedOrigins.includes('*') ||
        origin.endsWith('.vercel.app') ||
        !config.isProduction
      ) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. Rate Limiting (DDoS & Brute-Force Protection)
// ─────────────────────────────────────────────────────────────────────────────
const isTest = process.env.NODE_ENV === 'test';

// General API Rate Limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTest ? 10000 : 500, // 500 requests per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again after 15 minutes',
  },
});

// Stricter Auth Rate Limiter (Protection against password brute-forcing)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTest ? 10000 : 30, // 30 login/register attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again after 15 minutes',
  },
});

app.use('/api', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ─────────────────────────────────────────────────────────────────────────────
// 4. Body parsing
// ─────────────────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ─────────────────────────────────────────────────────────────────────────────
// 5. Request logging
// ─────────────────────────────────────────────────────────────────────────────
app.use(morgan(config.isDevelopment ? 'dev' : 'combined'));

// ─────────────────────────────────────────────────────────────────────────────
// 6. Comprehensive Health Check — checks database connectivity safely
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/health', async (_req, res) => {
  let dbStatus = 'healthy';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    dbStatus = 'unreachable';
    console.error('[HealthCheck] Database ping failed:', err);
  }

  const isHealthy = dbStatus === 'healthy';

  res.status(isHealthy ? 200 : 503).json({
    success: isHealthy,
    data: {
      status: isHealthy ? 'healthy' : 'degraded',
      database: dbStatus,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
      version: '1.0.0',
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. API Routes
// ─────────────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/columns', columnRoutes);
app.use('/api/tasks', taskRoutes);

// ─────────────────────────────────────────────────────────────────────────────
// 8. 404 & Error Handlers
// ─────────────────────────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(globalErrorHandler);

// ─────────────────────────────────────────────────────────────────────────────
// 9. Socket.IO initialization
// Single HTTP server handles both Express and WebSockets
// ─────────────────────────────────────────────────────────────────────────────
initializeSocket(httpServer);

// ─────────────────────────────────────────────────────────────────────────────
// 10. Start Server & Graceful Shutdown
// ─────────────────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  httpServer.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`
❌ [Server Error] Port ${config.port} is already in use (EADDRINUSE).
   Another instance of KanbanFlow or a background process is currently occupying port ${config.port}.
   To resolve:
   • On Windows: run 'netstat -ano | findstr :${config.port}' then 'taskkill /PID <PID> /F'
   • Or specify an alternative port by setting PORT in backend/.env
      `);
      process.exit(1);
    } else {
      console.error('[Server Error] Fatal startup error on HTTP server:', err);
      process.exit(1);
    }
  });

  httpServer.listen(config.port, () => {
    console.log(`
╔══════════════════════════════════════════════════════╗
║       Collaborative Kanban — Backend API             ║
╠══════════════════════════════════════════════════════╣
║  Port:        ${config.port}                                  ║
║  Environment: ${config.nodeEnv}                         ║
║  Health:      http://localhost:${config.port}/api/health      ║
╚══════════════════════════════════════════════════════╝
    `);
  });

  // Graceful shutdown handling
  const gracefulShutdown = (signal: string) => {
    console.log(`[Server] Received ${signal}. Starting graceful shutdown...`);

    httpServer.close(async () => {
      console.log('[Server] HTTP listener closed.');
      try {
        getIO()?.close();
        console.log('[Server] Socket.IO server closed.');
        await prisma.$disconnect();
        console.log('[Server] Database pool disconnected.');
        process.exit(0);
      } catch (err) {
        console.error('[Server] Error during teardown:', err);
        process.exit(1);
      }
    });

    // Force exit after 10 seconds if graceful shutdown hangs
    setTimeout(() => {
      console.error('[Server] Forced exit after timeout.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    console.error('[Process] Unhandled Promise Rejection:', reason);
  });

  process.on('uncaughtException', (err) => {
    console.error('[Process] Uncaught Exception:', err);
    gracefulShutdown('uncaughtException');
  });
}

export default app;
