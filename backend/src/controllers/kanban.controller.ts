import { Request, Response } from 'express';
import * as boardService from '../services/board.service';
import * as columnService from '../services/column.service';
import * as taskService from '../services/task.service';
import { sendSuccess, sendCreated } from '../utils/apiResponse';

// ─── Boards ───────────────────────────────────────────────────────────────────

export async function createBoard(req: Request, res: Response): Promise<void> {
  const tenantId = req.params.tenantId as string;
  const board = await boardService.createBoard(tenantId, req.body, req.user!.id);
  sendCreated(res, { board }, 'Board created successfully');
}

export async function listBoards(req: Request, res: Response): Promise<void> {
  const tenantId = req.params.tenantId as string;
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
  const includeArchived = req.query.archived === 'true';

  const result = await boardService.listBoardsForTenant(tenantId, { page, limit, includeArchived });
  sendSuccess(res, result);
}

export async function getBoard(req: Request, res: Response): Promise<void> {
  const boardId = req.params.boardId as string;
  const board = await boardService.getBoardById(boardId);
  sendSuccess(res, { board });
}

export async function updateBoard(req: Request, res: Response): Promise<void> {
  const boardId = req.params.boardId as string;
  const board = await boardService.updateBoard(boardId, req.body, req.user!.id);
  sendSuccess(res, { board }, 'Board updated successfully');
}

export async function deleteBoard(req: Request, res: Response): Promise<void> {
  const boardId = req.params.boardId as string;
  await boardService.deleteBoard(boardId, req.user!.id);
  sendSuccess(res, null, 'Board deleted successfully');
}

// ─── Columns ──────────────────────────────────────────────────────────────────

export async function createColumn(req: Request, res: Response): Promise<void> {
  const boardId = req.params.boardId as string;
  const column = await columnService.createColumn(boardId, req.body, req.user!.id);
  sendCreated(res, { column }, 'Column created successfully');
}

export async function listColumns(req: Request, res: Response): Promise<void> {
  const boardId = req.params.boardId as string;
  const columns = await columnService.listColumnsForBoard(boardId);
  sendSuccess(res, { columns });
}

export async function getColumn(req: Request, res: Response): Promise<void> {
  const columnId = req.params.columnId as string;
  const column = await columnService.getColumnById(columnId);
  sendSuccess(res, { column });
}

export async function updateColumn(req: Request, res: Response): Promise<void> {
  const columnId = req.params.columnId as string;
  const column = await columnService.updateColumn(columnId, req.body, req.user!.id);
  sendSuccess(res, { column }, 'Column updated successfully');
}

export async function reorderColumns(req: Request, res: Response): Promise<void> {
  const boardId = req.params.boardId as string;
  const columns = await columnService.reorderColumns(boardId, req.body, req.user!.id);
  sendSuccess(res, { columns }, 'Columns reordered successfully');
}

export async function deleteColumn(req: Request, res: Response): Promise<void> {
  const columnId = req.params.columnId as string;
  await columnService.deleteColumn(columnId, req.user!.id);
  sendSuccess(res, null, 'Column deleted successfully');
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export async function createTask(req: Request, res: Response): Promise<void> {
  const columnId = req.params.columnId as string;
  const task = await taskService.createTask(columnId, req.body, req.user!.id);
  sendCreated(res, { task }, 'Task created successfully');
}

export async function listTasks(req: Request, res: Response): Promise<void> {
  const columnId = req.params.columnId as string;
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

  const result = await taskService.listTasksForColumn(columnId, { page, limit });
  sendSuccess(res, result);
}

export async function getTask(req: Request, res: Response): Promise<void> {
  const taskId = req.params.taskId as string;
  const task = await taskService.getTaskById(taskId);
  sendSuccess(res, { task });
}

export async function updateTask(req: Request, res: Response): Promise<void> {
  const taskId = req.params.taskId as string;
  const task = await taskService.updateTask(taskId, req.body, req.user!.id);
  sendSuccess(res, { task }, 'Task updated successfully');
}

export async function moveTask(req: Request, res: Response): Promise<void> {
  const taskId = req.params.taskId as string;
  const task = await taskService.moveTask(taskId, req.body, req.user!.id);
  sendSuccess(res, { task }, 'Task moved successfully');
}

export async function reorderTasks(req: Request, res: Response): Promise<void> {
  const tasks = await taskService.reorderTasks(req.body, req.user!.id);
  sendSuccess(res, { tasks }, 'Tasks reordered successfully');
}

export async function deleteTask(req: Request, res: Response): Promise<void> {
  const taskId = req.params.taskId as string;
  await taskService.deleteTask(taskId, req.user!.id);
  sendSuccess(res, null, 'Task deleted successfully');
}
