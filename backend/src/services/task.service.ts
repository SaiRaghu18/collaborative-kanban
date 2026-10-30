import { prisma } from '../config/database';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors';
import { createActivityLog, broadcastActivity } from './activityLog.service';
import { broadcastToBoard } from '../config/socket';
import type {
  createTaskSchema,
  updateTaskSchema,
  moveTaskSchema,
  reorderTasksSchema,
} from '../validators/kanban.validator';
import { z } from 'zod';

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;
export type ReorderTasksInput = z.infer<typeof reorderTasksSchema>;

export async function createTask(
  columnId: string,
  input: CreateTaskInput,
  creatorId: string
) {
  // 1. Resolve column and its board to derive authorized tenantId
  const column = await prisma.column.findUnique({
    where: { id: columnId },
    include: { board: true },
  });

  if (!column) {
    throw new NotFoundError('Column');
  }

  const tenantId = column.board.tenantId;
  const boardId = column.boardId;

  // 2. If assignee is specified, verify assignee exists
  if (input.assigneeId) {
    const assignee = await prisma.user.findUnique({ where: { id: input.assigneeId } });
    if (!assignee) {
      throw new NotFoundError('Assignee user');
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    // Determine next sortOrder in column
    const lastTask = await tx.task.findFirst({
      where: { columnId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const nextSortOrder = lastTask ? lastTask.sortOrder + 1000 : 1000;

    const task = await tx.task.create({
      data: {
        title: input.title,
        description: input.description,
        priority: input.priority,
        status: input.status,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        columnId,
        tenantId, // Derived safely from column's board's tenant!
        assigneeId: input.assigneeId,
        createdById: creatorId,
        tags: input.tags || [],
        sortOrder: nextSortOrder,
        version: 0,
      },
      include: {
        assignee: {
          select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true },
        },
      },
    });

    const log = await createActivityLog(
      {
        tenantId,
        actorId: creatorId,
        action: 'task.created',
        entityType: 'Task',
        entityId: task.id,
        metadata: { title: task.title, columnId, priority: task.priority },
      },
      tx
    );

    return { task, log };
  });

  // Broadcast event strictly AFTER transaction commits
  broadcastToBoard(boardId, 'task:created', {
    boardId,
    columnId,
    task: result.task,
    actorId: creatorId,
  });
  broadcastActivity(tenantId, result.log);

  return result.task;
}

export async function listTasksForColumn(
  columnId: string,
  options: { page?: number; limit?: number } = {}
) {
  const column = await prisma.column.findUnique({ where: { id: columnId } });
  if (!column) {
    throw new NotFoundError('Column');
  }

  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || 50));
  const skip = (page - 1) * limit;

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where: { columnId },
      include: {
        assignee: {
          select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true },
        },
      },
      orderBy: { sortOrder: 'asc' },
      skip,
      take: limit,
    }),
    prisma.task.count({ where: { columnId } }),
  ]);

  return {
    tasks,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + tasks.length < total,
    },
  };
}

export async function getTaskById(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignee: {
        select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true },
      },
      column: {
        include: {
          board: true,
        },
      },
    },
  });

  if (!task) {
    throw new NotFoundError('Task');
  }

  return task;
}

export async function updateTask(
  taskId: string,
  input: UpdateTaskInput,
  actorId: string
) {
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.task.findUnique({
      where: { id: taskId },
      include: { column: { select: { boardId: true } } },
    });
    if (!current) {
      throw new NotFoundError('Task');
    }

    // ATOMIC OPTIMISTIC CONCURRENCY CHECK
    if (current.version !== input.version) {
      throw new ConflictError(
        `Optimistic lock failure: Task was modified by another collaborator (expected version ${input.version}, but current version is ${current.version}). Please refresh and try again.`
      );
    }

    if (input.assigneeId) {
      const assignee = await tx.user.findUnique({ where: { id: input.assigneeId } });
      if (!assignee) {
        throw new NotFoundError('Assignee user');
      }
    }

    const updated = await tx.task.update({
      where: { id: taskId },
      data: {
        title: input.title ?? current.title,
        description: input.description !== undefined ? input.description : current.description,
        priority: input.priority ?? current.priority,
        status: input.status ?? current.status,
        dueDate: input.dueDate !== undefined ? (input.dueDate ? new Date(input.dueDate) : null) : current.dueDate,
        assigneeId: input.assigneeId !== undefined ? input.assigneeId : current.assigneeId,
        tags: input.tags ?? current.tags,
        version: { increment: 1 },
      },
      include: {
        assignee: {
          select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true },
        },
      },
    });

    const log = await createActivityLog(
      {
        tenantId: current.tenantId,
        actorId,
        action: 'task.updated',
        entityType: 'Task',
        entityId: taskId,
        metadata: {
          previousVersion: input.version,
          newVersion: updated.version,
          updatedFields: input,
        },
      },
      tx
    );

    return {
      updated,
      log,
      boardId: current.column.boardId,
      tenantId: current.tenantId,
    };
  });

  // Broadcast event strictly AFTER transaction commits
  broadcastToBoard(result.boardId, 'task:updated', {
    boardId: result.boardId,
    columnId: result.updated.columnId,
    task: result.updated,
    actorId,
  });
  broadcastActivity(result.tenantId, result.log);

  return result.updated;
}

/**
 * Moves a task to a different column (or updates position in current column).
 * Strict multi-tenant security guarantees the destination column belongs to the SAME tenant!
 */
export async function moveTask(
  taskId: string,
  input: MoveTaskInput,
  actorId: string
) {
  const result = await prisma.$transaction(async (tx) => {
    const task = await tx.task.findUnique({
      where: { id: taskId },
      include: { column: { include: { board: true } } },
    });

    if (!task) {
      throw new NotFoundError('Task');
    }

    // 1. Concurrency check
    if (task.version !== input.version) {
      throw new ConflictError(
        `Optimistic lock failure: Task was moved or updated by another user (expected version ${input.version}, but current version is ${task.version}).`
      );
    }

    // 2. Validate target column belongs to the exact same tenant
    const targetColumn = await tx.column.findUnique({
      where: { id: input.targetColumnId },
      include: { board: true },
    });

    if (!targetColumn) {
      throw new NotFoundError('Target column');
    }

    if (targetColumn.board.tenantId !== task.tenantId) {
      throw new ValidationError('Cross-tenant task movements are strictly forbidden');
    }

    // 3. Calculate target sortOrder
    let newSortOrder: number;
    if (input.targetSortOrder !== undefined) {
      newSortOrder = input.targetSortOrder;
    } else {
      const lastInTarget = await tx.task.findFirst({
        where: { columnId: input.targetColumnId },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      });
      newSortOrder = lastInTarget ? lastInTarget.sortOrder + 1000 : 1000;
    }

    const moved = await tx.task.update({
      where: { id: taskId },
      data: {
        columnId: input.targetColumnId,
        sortOrder: newSortOrder,
        version: { increment: 1 },
      },
      include: {
        assignee: {
          select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true },
        },
      },
    });

    const log = await createActivityLog(
      {
        tenantId: task.tenantId,
        actorId,
        action: 'task.moved',
        entityType: 'Task',
        entityId: taskId,
        metadata: {
          fromColumnId: task.columnId,
          toColumnId: input.targetColumnId,
          previousSortOrder: task.sortOrder,
          newSortOrder,
        },
      },
      tx
    );

    return {
      moved,
      log,
      sourceBoardId: task.column.boardId,
      targetBoardId: targetColumn.boardId,
      sourceColumnId: task.columnId,
      targetColumnId: input.targetColumnId,
      tenantId: task.tenantId,
    };
  });

  // Broadcast event strictly AFTER transaction commits
  if (result.sourceBoardId === result.targetBoardId) {
    broadcastToBoard(result.targetBoardId, 'task:moved', {
      boardId: result.targetBoardId,
      taskId,
      sourceColumnId: result.sourceColumnId,
      targetColumnId: result.targetColumnId,
      task: result.moved,
      actorId,
    });
  } else {
    broadcastToBoard(result.sourceBoardId, 'task:moved', {
      boardId: result.sourceBoardId,
      taskId,
      sourceColumnId: result.sourceColumnId,
      targetColumnId: result.targetColumnId,
      task: result.moved,
      actorId,
    });
    broadcastToBoard(result.targetBoardId, 'task:moved', {
      boardId: result.targetBoardId,
      taskId,
      sourceColumnId: result.sourceColumnId,
      targetColumnId: result.targetColumnId,
      task: result.moved,
      actorId,
    });
  }

  broadcastActivity(result.tenantId, result.log);

  return result.moved;
}

/**
 * Reorders tasks inside a column atomically.
 * Assigns new deterministic spaced sortOrders (1000, 2000, 3000, ...).
 */
export async function reorderTasks(
  input: ReorderTasksInput,
  actorId: string
) {
  const result = await prisma.$transaction(async (tx) => {
    const column = await tx.column.findUnique({
      where: { id: input.columnId },
      include: { board: true },
    });

    if (!column) {
      throw new NotFoundError('Column');
    }

    const existing = await tx.task.findMany({
      where: { columnId: input.columnId },
      select: { id: true },
    });

    const existingIds = new Set(existing.map((t) => t.id));

    if (input.taskIds.length !== existing.length) {
      throw new ValidationError(
        `Task count mismatch: Expected ${existing.length} tasks in column, but received ${input.taskIds.length}`
      );
    }

    for (const taskId of input.taskIds) {
      if (!existingIds.has(taskId)) {
        throw new ValidationError(`Task "${taskId}" does not belong to column "${column.title}"`);
      }
    }

    const updates = input.taskIds.map((id, index) =>
      tx.task.update({
        where: { id },
        data: {
          sortOrder: (index + 1) * 1000,
          version: { increment: 1 },
        },
      })
    );

    await Promise.all(updates);

    const log = await createActivityLog(
      {
        tenantId: column.board.tenantId,
        actorId,
        action: 'task.reordered',
        entityType: 'Column',
        entityId: input.columnId,
        metadata: { newOrder: input.taskIds },
      },
      tx
    );

    const updatedTasks = await tx.task.findMany({
      where: { columnId: input.columnId },
      include: {
        assignee: {
          select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return {
      tasks: updatedTasks,
      log,
      boardId: column.boardId,
      tenantId: column.board.tenantId,
    };
  });

  // Broadcast event strictly AFTER transaction commits
  broadcastToBoard(result.boardId, 'task:reordered', {
    boardId: result.boardId,
    columnId: input.columnId,
    tasks: result.tasks,
    actorId,
  });
  broadcastActivity(result.tenantId, result.log);

  return result.tasks;
}

export async function deleteTask(taskId: string, actorId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { column: { select: { boardId: true } } },
  });
  if (!task) {
    throw new NotFoundError('Task');
  }

  const result = await prisma.$transaction(async (tx) => {
    const log = await createActivityLog(
      {
        tenantId: task.tenantId,
        actorId,
        action: 'task.deleted',
        entityType: 'Task',
        entityId: taskId,
        metadata: { deletedTaskTitle: task.title },
      },
      tx
    );

    const deleted = await tx.task.delete({
      where: { id: taskId },
    });

    return {
      deleted,
      log,
      boardId: task.column.boardId,
      columnId: task.columnId,
      tenantId: task.tenantId,
    };
  });

  // Broadcast event strictly AFTER transaction commits
  broadcastToBoard(result.boardId, 'task:deleted', {
    boardId: result.boardId,
    columnId: result.columnId,
    taskId,
    actorId,
  });
  broadcastActivity(result.tenantId, result.log);

  return result.deleted;
}
