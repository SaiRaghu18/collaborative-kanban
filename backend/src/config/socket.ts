import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { verifyToken } from '../utils/jwt';
import { prisma } from '../config/database';
import { config } from '../config/env';
import { presenceManager, PresenceUser } from '../sockets/presence.manager';

// ─────────────────────────────────────────────────────────────────────────────
// Socket.IO Server & Real-Time Event Architecture
// Handles:
//   - Connection authentication via JWT
//   - Strict tenant-scoped and board-scoped room authorization
//   - Multi-user presence tracking per board
//   - Safe event emission helpers
// ─────────────────────────────────────────────────────────────────────────────

export interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: PresenceUser;
  tenantId?: string;
}

let ioInstance: SocketIOServer | null = null;

export function getIO(): SocketIOServer | null {
  return ioInstance;
}

export function initializeSocket(httpServer: HttpServer): SocketIOServer {
  const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim());

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (
          allowedOrigins.includes(origin) ||
          allowedOrigins.includes('*') ||
          origin.endsWith('.vercel.app') ||
          !config.isProduction
        ) {
          return callback(null, true);
        }
        return callback(new Error(`Socket CORS origin denied: ${origin}`), false);
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  ioInstance = io;

  // ─── JWT Authentication Middleware for Sockets ─────────────────────────────
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication required: No token provided'));
      }

      const payload = verifyToken(token);

      // Verify user exists and is active in database
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          isActive: true,
        },
      });

      if (!user || !user.isActive) {
        return next(new Error('User not found or deactivated'));
      }

      socket.userId = user.id;
      socket.user = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
      };

      next();
    } catch {
      next(new Error('Invalid or expired authentication token'));
    }
  });

  // ─── Connection & Event Routing ────────────────────────────────────────────
  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`[Socket.IO] Client connected: socketId=${socket.id}, userId=${socket.userId}`);

    // ─── 1. Board Room Authorization & Presence ─────────────────────────────
    socket.on('join:board', async (boardId: string) => {
      try {
        if (!boardId || !socket.userId || !socket.user) {
          socket.emit('error', { message: 'Invalid board ID or unauthenticated socket' });
          return;
        }

        // Verify board exists and lookup its tenant
        const board = await prisma.board.findUnique({
          where: { id: boardId },
          select: { id: true, tenantId: true, isArchived: true },
        });

        if (!board) {
          socket.emit('error', { message: 'Board not found' });
          return;
        }

        // Security check: verify user has authorized membership in the board's tenant
        const membership = await prisma.membership.findFirst({
          where: {
            userId: socket.userId,
            OR: [
              { tenantId: board.tenantId, scope: 'TENANT' },
              { scope: 'ORGANIZATION', role: 'ORG_ADMIN' },
            ],
          },
        });

        if (!membership) {
          socket.emit('error', { message: 'Access denied: You are not a member of this workspace' });
          return;
        }

        const roomName = `board:${boardId}`;
        socket.join(roomName);

        // Update in-memory presence tracking
        const activeUsers = presenceManager.addUser(boardId, socket.id, socket.user);

        // Broadcast presence update to everyone in the board room
        io.to(roomName).emit('presence:update', {
          boardId,
          users: activeUsers,
        });

        // Send confirmation back to joining client
        socket.emit('joined:board', {
          boardId,
          activeUsers,
        });

        console.log(`[Socket.IO] User ${socket.userId} joined board room: ${boardId} (active: ${activeUsers.length})`);
      } catch (err) {
        console.error('[Socket.IO] Error in join:board:', err);
        socket.emit('error', { message: 'Failed to join board room' });
      }
    });

    socket.on('leave:board', (boardId: string) => {
      try {
        if (!boardId || !socket.userId) return;

        const roomName = `board:${boardId}`;
        socket.leave(roomName);

        const remainingUsers = presenceManager.removeUser(boardId, socket.id, socket.userId);

        io.to(roomName).emit('presence:update', {
          boardId,
          users: remainingUsers,
        });

        console.log(`[Socket.IO] User ${socket.userId} left board room: ${boardId} (remaining: ${remainingUsers.length})`);
      } catch (err) {
        console.error('[Socket.IO] Error in leave:board:', err);
      }
    });

    // ─── 2. Tenant Room Authorization & Presence ─────────────────────────────
    socket.on('join:tenant', async (tenantId: string) => {
      try {
        if (!tenantId || !socket.userId || !socket.user) {
          socket.emit('error', { message: 'Invalid workspace ID or unauthenticated socket' });
          return;
        }

        const membership = await prisma.membership.findFirst({
          where: {
            userId: socket.userId,
            OR: [
              { tenantId, scope: 'TENANT' },
              { scope: 'ORGANIZATION', role: 'ORG_ADMIN' },
            ],
          },
        });

        if (!membership) {
          socket.emit('error', { message: 'Access denied to this workspace' });
          return;
        }

        socket.tenantId = tenantId;
        const roomName = `tenant:${tenantId}`;
        socket.join(roomName);

        // Update in-memory tenant presence
        const activeUsers = presenceManager.addTenantUser(tenantId, socket.id, socket.user);

        // Broadcast to tenant room
        io.to(roomName).emit('presence:tenant', {
          tenantId,
          users: activeUsers,
        });

        socket.emit('joined:tenant', {
          tenantId,
          activeUsers,
        });

        console.log(`[Socket.IO] User ${socket.userId} joined tenant room: ${tenantId} (active: ${activeUsers.length})`);
      } catch (err) {
        console.error('[Socket.IO] Error in join:tenant:', err);
        socket.emit('error', { message: 'Failed to join workspace room' });
      }
    });

    socket.on('leave:tenant', (tenantId: string) => {
      try {
        if (!tenantId || !socket.userId) return;

        const roomName = `tenant:${tenantId}`;
        socket.leave(roomName);

        const remainingUsers = presenceManager.removeTenantUser(tenantId, socket.id, socket.userId);

        io.to(roomName).emit('presence:tenant', {
          tenantId,
          users: remainingUsers,
        });

        console.log(`[Socket.IO] User ${socket.userId} left tenant room: ${tenantId} (remaining: ${remainingUsers.length})`);
      } catch (err) {
        console.error('[Socket.IO] Error in leave:tenant:', err);
      }
    });

    // ─── 3. Disconnection & Presence Cleanup ────────────────────────────────
    socket.on('disconnect', (reason) => {
      if (socket.userId) {
        const { affectedBoards, affectedTenants } = presenceManager.handleDisconnect(socket.id, socket.userId);

        for (const [boardId, remainingUsers] of affectedBoards.entries()) {
          io.to(`board:${boardId}`).emit('presence:update', {
            boardId,
            users: remainingUsers,
          });
        }

        for (const [tenantId, remainingUsers] of affectedTenants.entries()) {
          io.to(`tenant:${tenantId}`).emit('presence:tenant', {
            tenantId,
            users: remainingUsers,
          });
        }
      }
      console.log(`[Socket.IO] Client disconnected: socketId=${socket.id}, reason=${reason}`);
    });
  });

  return io;
}

// ─────────────────────────────────────────────────────────────────────────────
// Room Broadcasting Helpers
// Only emits to authorized rooms after database transactions succeed!
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Broadcasts an event to all authorized subscribers of a specific board room.
 */
export function broadcastToBoard(boardId: string, event: string, data: unknown): void {
  if (!ioInstance) return;
  ioInstance.to(`board:${boardId}`).emit(event, data);
}

/**
 * Broadcasts an event to all authorized subscribers of a tenant room (e.g., activity logs).
 */
export function broadcastToTenant(tenantId: string, event: string, data: unknown): void {
  if (!ioInstance) return;
  ioInstance.to(`tenant:${tenantId}`).emit(event, data);
}
