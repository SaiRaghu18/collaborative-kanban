import { prisma } from '../config/database';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors';
import { createActivityLog, broadcastActivity } from './activityLog.service';
import { broadcastToBoard } from '../config/socket';
import type {
  createColumnSchema,
  updateColumnSchema,
  reorderColumnsSchema,
} from '../validators/kanban.validator';
import { z } from 'zod';

export type CreateColumnInput = z.infer<typeof createColumnSchema>;
export type UpdateColumnInput = z.infer<typeof updateColumnSchema>;
export type ReorderColumnsInput = z.infer<typeof reorderColumnsSchema>;

export async function createColumn(
  boardId: string,
  input: CreateColumnInput,
  actorId: string
) {
  const board = await prisma.board.findUnique({ where: { id: boardId } });
  if (!board) {
    throw new NotFoundError('Board');
  }

  const result = await prisma.$transaction(async (tx) => {
    // Find highest current sortOrder in this board
    const lastCol = await tx.column.findFirst({
      where: { boardId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const nextSortOrder = lastCol ? lastCol.sortOrder + 1000 : 1000;

    const column = await tx.column.create({
      data: {
        title: input.title,
        color: input.color,
        boardId,
        sortOrder: nextSortOrder,
        version: 0,
      },
      include: {
        _count: { select: { tasks: true } },
      },
    });

    const log = await createActivityLog(
      {
        tenantId: board.tenantId,
        actorId,
        action: 'column.created',
        entityType: 'Column',
        entityId: column.id,
        metadata: { title: column.title, boardId },
      },
      tx
    );

    return { column, log };
  });

  // Broadcast event strictly AFTER transaction commits
  broadcastToBoard(boardId, 'column:created', {
    boardId,
    column: { ...result.column, tasks: [] },
    actorId,
  });
  broadcastActivity(board.tenantId, result.log);

  return result.column;
}

export async function listColumnsForBoard(boardId: string) {
  const board = await prisma.board.findUnique({ where: { id: boardId } });
  if (!board) {
    throw new NotFoundError('Board');
  }

  return prisma.column.findMany({
    where: { boardId },
    orderBy: { sortOrder: 'asc' },
    include: {
      _count: { select: { tasks: true } },
    },
  });
}

export async function getColumnById(columnId: string) {
  const column = await prisma.column.findUnique({
    where: { id: columnId },
    include: {
      board: true,
      tasks: {
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  if (!column) {
    throw new NotFoundError('Column');
  }

  return column;
}

export async function updateColumn(
  columnId: string,
  input: UpdateColumnInput,
  actorId: string
) {
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.column.findUnique({
      where: { id: columnId },
      include: { board: true },
    });

    if (!current) {
      throw new NotFoundError('Column');
    }

    // Optimistic concurrency check
    if (current.version !== input.version) {
      throw new ConflictError(
        `Optimistic lock failure: Column was modified by another user (expected version ${input.version}, but current version is ${current.version}). Please refresh and try again.`
      );
    }

    const updated = await tx.column.update({
      where: { id: columnId },
      data: {
        title: input.title ?? current.title,
        color: input.color !== undefined ? input.color : current.color,
        version: { increment: 1 },
      },
      include: {
        _count: { select: { tasks: true } },
      },
    });

    const log = await createActivityLog(
      {
        tenantId: current.board.tenantId,
        actorId,
        action: 'column.updated',
        entityType: 'Column',
        entityId: columnId,
        metadata: {
          previousTitle: current.title,
          newTitle: updated.title,
          previousVersion: input.version,
          newVersion: updated.version,
        },
      },
      tx
    );

    return {
      updated,
      log,
      boardId: current.boardId,
      tenantId: current.board.tenantId,
    };
  });

  // Broadcast event strictly AFTER transaction commits
  broadcastToBoard(result.boardId, 'column:updated', {
    boardId: result.boardId,
    column: result.updated,
    actorId,
  });
  broadcastActivity(result.tenantId, result.log);

  return result.updated;
}

/**
 * Reorders all columns of a board in one atomic transaction.
 * Validates that all IDs belong to the board and assigns new spaced sortOrders.
 */
export async function reorderColumns(
  boardId: string,
  input: ReorderColumnsInput,
  actorId: string
) {
  const result = await prisma.$transaction(async (tx) => {
    const board = await tx.board.findUnique({ where: { id: boardId } });
    if (!board) {
      throw new NotFoundError('Board');
    }

    // 1. Fetch existing columns
    const existing = await tx.column.findMany({
      where: { boardId },
      select: { id: true },
    });

    const existingIds = new Set(existing.map((c) => c.id));

    // 2. Reject foreign or missing column IDs
    if (input.columnIds.length !== existing.length) {
      throw new ValidationError(
        `Column count mismatch: Expected ${existing.length} columns, but received ${input.columnIds.length}`
      );
    }

    for (const colId of input.columnIds) {
      if (!existingIds.has(colId)) {
        throw new ValidationError(`Column "${colId}" does not belong to this board`);
      }
    }

    // 3. Atomically update sortOrders with deterministic spacing (1000, 2000, 3000, ...)
    const updatePromises = input.columnIds.map((id, index) =>
      tx.column.update({
        where: { id },
        data: {
          sortOrder: (index + 1) * 1000,
          version: { increment: 1 },
        },
      })
    );

    await Promise.all(updatePromises);

    const log = await createActivityLog(
      {
        tenantId: board.tenantId,
        actorId,
        action: 'column.reordered',
        entityType: 'Board',
        entityId: boardId,
        metadata: { newOrder: input.columnIds },
      },
      tx
    );

    const columns = await tx.column.findMany({
      where: { boardId },
      orderBy: { sortOrder: 'asc' },
    });

    return {
      columns,
      log,
      boardId,
      tenantId: board.tenantId,
    };
  });

  // Broadcast event strictly AFTER transaction commits
  broadcastToBoard(boardId, 'column:reordered', {
    boardId,
    columnIds: input.columnIds,
    columns: result.columns,
    actorId,
  });
  broadcastActivity(result.tenantId, result.log);

  return result.columns;
}

/**
 * Safe column deletion policy:
 * Requires column to have zero tasks, or rejects deletion to prevent silent task loss.
 */
export async function deleteColumn(columnId: string, actorId: string) {
  const column = await prisma.column.findUnique({
    where: { id: columnId },
    include: {
      board: true,
      _count: { select: { tasks: true } },
    },
  });

  if (!column) {
    throw new NotFoundError('Column');
  }

  if (column._count.tasks > 0) {
    throw new ConflictError(
      `Cannot delete column "${column.title}" because it contains ${column._count.tasks} task(s). Move or delete the tasks first.`
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const log = await createActivityLog(
      {
        tenantId: column.board.tenantId,
        actorId,
        action: 'column.deleted',
        entityType: 'Column',
        entityId: columnId,
        metadata: { deletedColumnTitle: column.title },
      },
      tx
    );

    const deleted = await tx.column.delete({
      where: { id: columnId },
    });

    return {
      deleted,
      log,
      boardId: column.boardId,
      tenantId: column.board.tenantId,
    };
  });

  // Broadcast event strictly AFTER transaction commits
  broadcastToBoard(result.boardId, 'column:deleted', {
    boardId: result.boardId,
    columnId,
    actorId,
  });
  broadcastActivity(result.tenantId, result.log);

  return result.deleted;
}
