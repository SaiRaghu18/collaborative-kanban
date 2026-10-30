import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'http';
import { AddressInfo } from 'net';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import express from 'express';
import { initializeSocket, broadcastToBoard, broadcastToTenant } from '../config/socket';
import { presenceManager } from '../sockets/presence.manager';
import { signToken } from '../utils/jwt';
import { prisma } from '../config/database';

describe('Real-Time Collaboration: Presence Manager Unit Tests', () => {
  beforeEach(() => {
    presenceManager.clear();
  });

  it('should track multiple unique users viewing the same board', () => {
    const userA = {
      id: 'user-1',
      email: 'a@example.com',
      firstName: 'Alice',
      lastName: 'Smith',
      avatarUrl: null,
    };
    const userB = {
      id: 'user-2',
      email: 'b@example.com',
      firstName: 'Bob',
      lastName: 'Jones',
      avatarUrl: null,
    };

    presenceManager.addUser('board-100', 'socket-a1', userA);
    const users = presenceManager.addUser('board-100', 'socket-b1', userB);

    expect(users).toHaveLength(2);
    expect(users.map((u) => u.id)).toContain('user-1');
    expect(users.map((u) => u.id)).toContain('user-2');
  });

  it('should handle multiple browser tabs (duplicate presence) for the same user correctly', () => {
    const userA = {
      id: 'user-1',
      email: 'a@example.com',
      firstName: 'Alice',
      lastName: 'Smith',
      avatarUrl: null,
    };

    // Alice opens tab 1
    presenceManager.addUser('board-100', 'socket-tab-1', userA);
    // Alice opens tab 2
    const users = presenceManager.addUser('board-100', 'socket-tab-2', userA);

    // Only 1 unique user in list
    expect(users).toHaveLength(1);
    expect(users[0].id).toBe('user-1');

    // Alice closes tab 1: user should still be present because tab 2 is open
    const remaining = presenceManager.removeUser('board-100', 'socket-tab-1', 'user-1');
    expect(remaining).toHaveLength(1);

    // Alice closes tab 2: user is now removed
    const finalUsers = presenceManager.removeUser('board-100', 'socket-tab-2', 'user-1');
    expect(finalUsers).toHaveLength(0);
  });

  it('should clean up user presence across multiple boards upon socket disconnect', () => {
    const user = {
      id: 'user-multi',
      email: 'multi@example.com',
      firstName: 'Multi',
      lastName: 'Viewer',
      avatarUrl: null,
    };

    presenceManager.addUser('board-1', 'socket-x', user);
    presenceManager.addUser('board-2', 'socket-x', user);
    presenceManager.addTenantUser('tenant-1', 'socket-x', user);

    expect(presenceManager.getUsers('board-1')).toHaveLength(1);
    expect(presenceManager.getUsers('board-2')).toHaveLength(1);
    expect(presenceManager.getTenantUsers('tenant-1')).toHaveLength(1);

    const { affectedBoards, affectedTenants } = presenceManager.handleDisconnect('socket-x', 'user-multi');
    expect(affectedBoards.has('board-1')).toBe(true);
    expect(affectedBoards.has('board-2')).toBe(true);
    expect(affectedTenants.has('tenant-1')).toBe(true);
    expect(presenceManager.getUsers('board-1')).toHaveLength(0);
    expect(presenceManager.getUsers('board-2')).toHaveLength(0);
    expect(presenceManager.getTenantUsers('tenant-1')).toHaveLength(0);
  });
});

describe('Real-Time Collaboration: Socket.IO Server & Auth Integration Tests', () => {
  let server: http.Server;
  let port: number;
  let validToken: string;
  let testUserId: string;

  beforeAll(async () => {
    const app = express();
    server = http.createServer(app);
    initializeSocket(server);

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as AddressInfo).port;
        resolve();
      });
    });

    // Create a real active test user for JWT verification in DB
    const testUser = await prisma.user.upsert({
      where: { email: 'socket-test-user@kanbanflow.internal' },
      update: { isActive: true },
      create: {
        email: 'socket-test-user@kanbanflow.internal',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
        firstName: 'Socket',
        lastName: 'Tester',
        isActive: true,
      },
    });

    testUserId = testUser.id;
    validToken = signToken({ sub: testUserId, email: testUser.email });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('should reject connection when no authentication token is provided', async () => {
    await new Promise<void>((resolve) => {
      const client = Client(`http://localhost:${port}`, {
        transports: ['websocket'],
        autoConnect: true,
      });

      client.on('connect_error', (err) => {
        expect(err.message).toContain('Authentication required');
        client.disconnect();
        resolve();
      });
    });
  });

  it('should reject connection when an invalid JWT token is provided', async () => {
    await new Promise<void>((resolve) => {
      const client = Client(`http://localhost:${port}`, {
        auth: { token: 'invalid.forged.jwt-signature' },
        transports: ['websocket'],
        autoConnect: true,
      });

      client.on('connect_error', (err) => {
        expect(err.message).toContain('Invalid or expired authentication token');
        client.disconnect();
        resolve();
      });
    });
  });

  it('should successfully authenticate and connect with a valid JWT token', async () => {
    await new Promise<void>((resolve) => {
      const client = Client(`http://localhost:${port}`, {
        auth: { token: validToken },
        transports: ['websocket'],
        autoConnect: true,
      });

      client.on('connect', () => {
        expect(client.connected).toBe(true);
        client.disconnect();
        resolve();
      });
    });
  });

  it('should reject join:board if the board does not exist', async () => {
    await new Promise<void>((resolve) => {
      const client = Client(`http://localhost:${port}`, {
        auth: { token: validToken },
        transports: ['websocket'],
        autoConnect: true,
      });

      client.on('connect', () => {
        client.emit('join:board', '00000000-0000-0000-0000-000000000000');
      });

      client.on('error', (err: { message: string }) => {
        expect(err.message).toBe('Board not found');
        client.disconnect();
        resolve();
      });
    });
  });

  it('should reject join:tenant if user does not have membership in the tenant', async () => {
    await new Promise<void>((resolve) => {
      const client = Client(`http://localhost:${port}`, {
        auth: { token: validToken },
        transports: ['websocket'],
        autoConnect: true,
      });

      client.on('connect', () => {
        client.emit('join:tenant', '00000000-0000-0000-0000-000000000099');
      });

      client.on('error', (err: { message: string }) => {
        expect(err.message).toContain('Access denied');
        client.disconnect();
        resolve();
      });
    });
  });

  it('should broadcast board events only to subscribers in that board room', async () => {
    const clientA = Client(`http://localhost:${port}`, {
      auth: { token: validToken },
      transports: ['websocket'],
      autoConnect: true,
    });

    const clientB = Client(`http://localhost:${port}`, {
      auth: { token: validToken },
      transports: ['websocket'],
      autoConnect: true,
    });

    await Promise.all([
      new Promise<void>((resolve) => clientA.on('connect', resolve)),
      new Promise<void>((resolve) => clientB.on('connect', resolve)),
    ]);

    // Test room broadcasting isolation
    let clientAReceived = false;
    let clientBReceived = false;

    clientA.on('task:created', () => {
      clientAReceived = true;
    });

    clientB.on('task:created', () => {
      clientBReceived = true;
    });

    // Simulate board room join via internal socket
    broadcastToBoard('isolated-board-999', 'task:created', {
      boardId: 'isolated-board-999',
      taskId: 'task-123',
    });

    await new Promise((r) => setTimeout(r, 200));

    // Neither client has joined isolated-board-999, so neither received the event
    expect(clientAReceived).toBe(false);
    expect(clientBReceived).toBe(false);

    clientA.disconnect();
    clientB.disconnect();
  });
});
