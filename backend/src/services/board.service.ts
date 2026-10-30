import { prisma } from '../config/database';
import { ConflictError, NotFoundError } from '../utils/errors';
import { createActivityLog, broadcastActivity } from './activityLog.service';
import { broadcastToBoard, broadcastToTenant } from '../config/socket';
import type { createBoardSchema, updateBoardSchema } from '../validators/kanban.validator';
import { z } from 'zod';

export type CreateBoardInput = z.infer<typeof createBoardSchema>;
export type UpdateBoardInput = z.infer<typeof updateBoardSchema>;

export async function createBoard(
  tenantId: string,
  input: CreateBoardInput,
  creatorId: string
) {
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create the Board with initial version = 0
    const board = await tx.board.create({
      data: {
        name: input.name,
        description: input.description,
        tenantId,
        createdById: creatorId,
        version: 0,
      },
    });

    // 2. Automatically create default Kanban columns for immediate productivity
    const defaultColumns = [
      { title: 'To Do', sortOrder: 1000, color: '#94a3b8' },
      { title: 'In Progress', sortOrder: 2000, color: '#3b82f6' },
      { title: 'Review', sortOrder: 3000, color: '#f59e0b' },
      { title: 'Done', sortOrder: 4000, color: '#10b981' },
    ];

    for (const col of defaultColumns) {
      await tx.column.create({
        data: {
          title: col.title,
          boardId: board.id,
          sortOrder: col.sortOrder,
          color: col.color,
          version: 0,
        },
      });
    }

    // 3. Log board creation
    const log = await createActivityLog(
      {
        tenantId,
        actorId: creatorId,
        action: 'board.created',
        entityType: 'Board',
        entityId: board.id,
        metadata: { name: board.name },
      },
      tx
    );

    const fullBoard = await tx.board.findUnique({
      where: { id: board.id },
      include: {
        columns: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    return { board: fullBoard!, log };
  });

  // Broadcast event strictly AFTER transaction commits
  broadcastToTenant(tenantId, 'board:created', {
    tenantId,
    board: result.board,
    actorId: creatorId,
  });
  broadcastActivity(tenantId, result.log);

  return result.board;
}

export async function listBoardsForTenant(
  tenantId: string,
  options: { page?: number; limit?: number; includeArchived?: boolean } = {}
) {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || 20));
  const skip = (page - 1) * limit;

  const where = {
    tenantId,
    ...(options.includeArchived ? {} : { isArchived: false }),
  };

  const [boards, total] = await Promise.all([
    prisma.board.findMany({
      where,
      include: {
        _count: { select: { columns: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.board.count({ where }),
  ]);

  return {
    boards,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + boards.length < total,
    },
  };
}

export async function getBoardById(boardId: string) {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: {
      columns: {
        orderBy: { sortOrder: 'asc' },
        include: {
          tasks: {
            orderBy: { sortOrder: 'asc' },
            include: {
              assignee: {
                select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true },
              },
            },
          },
        },
      },
    },
  });

  if (!board) {
    throw new NotFoundError('Board');
  }

  return board;
}

export async function updateBoard(
  boardId: string,
  input: UpdateBoardInput,
  actorId: string
) {
  const result = await prisma.$transaction(async (tx) => {
    // 1. Fetch current board to verify existence & tenant context
    const current = await tx.board.findUnique({ where: { id: boardId } });
    if (!current) {
      throw new NotFoundError('Board');
    }

    if (current.version !== input.version) {
      throw new ConflictError(
        `Optimistic lock failure: Board was modified by another user (expected version ${input.version}, but current version is ${current.version}). Please refresh and try again.`
      );
    }

    // 2. Increment version atomically
    const nextBoard = await tx.board.update({
      where: { id: boardId },
      data: {
        name: input.name ?? current.name,
        description: input.description !== undefined ? input.description : current.description,
        isArchived: input.isArchived !== undefined ? input.isArchived : current.isArchived,
        version: { increment: 1 },
      },
    });

    const log = await createActivityLog(
      {
        tenantId: current.tenantId,
        actorId,
        action: 'board.updated',
        entityType: 'Board',
        entityId: boardId,
        metadata: {
          previousVersion: input.version,
          newVersion: nextBoard.version,
          updatedFields: input,
        },
      },
      tx
    );

    return { board: nextBoard, log, tenantId: current.tenantId };
  });

  // Broadcast event strictly AFTER transaction commits
  broadcastToBoard(boardId, 'board:updated', {
    boardId,
    board: result.board,
    actorId,
  });
  broadcastToTenant(result.tenantId, 'board:updated', {
    boardId,
    board: result.board,
    actorId,
  });
  broadcastActivity(result.tenantId, result.log);

  return result.board;
}

export async function deleteBoard(boardId: string, actorId: string) {
  const board = await prisma.board.findUnique({ where: { id: boardId } });
  if (!board) {
    throw new NotFoundError('Board');
  }

  const result = await prisma.$transaction(async (tx) => {
    const log = await createActivityLog(
      {
        tenantId: board.tenantId,
        actorId,
        action: 'board.deleted',
        entityType: 'Board',
        entityId: boardId,
        metadata: { deletedBoardName: board.name },
      },
      tx
    );

    const deleted = await tx.board.delete({
      where: { id: boardId },
    });

    return { deleted, log, tenantId: board.tenantId };
  });

  // Broadcast event strictly AFTER transaction commits
  broadcastToBoard(boardId, 'board:deleted', {
    boardId,
    tenantId: result.tenantId,
    actorId,
  });
  broadcastToTenant(result.tenantId, 'board:deleted', {
    boardId,
    tenantId: result.tenantId,
    actorId,
  });
  broadcastActivity(result.tenantId, result.log);

  return result.deleted;
}
