import apiClient, { extractData } from '@/lib/apiClient';
import type {
  Board,
  CreateBoardInput,
  UpdateBoardInput,
  Column,
  CreateColumnInput,
  UpdateColumnInput,
  ReorderColumnsInput,
  Task,
  CreateTaskInput,
  UpdateTaskInput,
  MoveTaskInput,
  ReorderTasksInput,
  ActivityLog,
  Pagination,
} from '@/types';

// ─── Boards ───────────────────────────────────────────────────────────────────

export async function listBoards(
  tenantId: string,
  params?: { page?: number; limit?: number; archived?: boolean }
): Promise<{ boards: Board[]; pagination: Pagination }> {
  const res = await apiClient.get(`/tenants/${tenantId}/boards`, { params });
  return extractData<{ boards: Board[]; pagination: Pagination }>(res);
}

export async function getBoard(boardId: string): Promise<Board> {
  const res = await apiClient.get(`/boards/${boardId}`);
  const data = extractData<{ board: Board }>(res);
  return data.board;
}

export async function createBoard(
  tenantId: string,
  input: CreateBoardInput
): Promise<Board> {
  const res = await apiClient.post(`/tenants/${tenantId}/boards`, input);
  const data = extractData<{ board: Board }>(res);
  return data.board;
}

export async function updateBoard(
  boardId: string,
  input: UpdateBoardInput
): Promise<Board> {
  const res = await apiClient.patch(`/boards/${boardId}`, input);
  const data = extractData<{ board: Board }>(res);
  return data.board;
}

export async function deleteBoard(boardId: string): Promise<void> {
  await apiClient.delete(`/boards/${boardId}`);
}

// ─── Columns ──────────────────────────────────────────────────────────────────

export async function listColumns(boardId: string): Promise<Column[]> {
  const res = await apiClient.get(`/boards/${boardId}/columns`);
  const data = extractData<{ columns: Column[] }>(res);
  return data.columns;
}

export async function createColumn(
  boardId: string,
  input: CreateColumnInput
): Promise<Column> {
  const res = await apiClient.post(`/boards/${boardId}/columns`, input);
  const data = extractData<{ column: Column }>(res);
  return data.column;
}

export async function updateColumn(
  columnId: string,
  input: UpdateColumnInput
): Promise<Column> {
  const res = await apiClient.patch(`/columns/${columnId}`, input);
  const data = extractData<{ column: Column }>(res);
  return data.column;
}

export async function reorderColumns(
  boardId: string,
  input: ReorderColumnsInput
): Promise<Column[]> {
  const res = await apiClient.patch(`/boards/${boardId}/columns/reorder`, input);
  const data = extractData<{ columns: Column[] }>(res);
  return data.columns;
}

export async function deleteColumn(columnId: string): Promise<void> {
  await apiClient.delete(`/columns/${columnId}`);
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export async function listTasks(
  columnId: string,
  params?: { page?: number; limit?: number }
): Promise<{ tasks: Task[]; pagination: Pagination }> {
  const res = await apiClient.get(`/columns/${columnId}/tasks`, { params });
  return extractData<{ tasks: Task[]; pagination: Pagination }>(res);
}

export async function getTask(taskId: string): Promise<Task> {
  const res = await apiClient.get(`/tasks/${taskId}`);
  const data = extractData<{ task: Task }>(res);
  return data.task;
}

export async function createTask(
  columnId: string,
  input: CreateTaskInput
): Promise<Task> {
  const res = await apiClient.post(`/columns/${columnId}/tasks`, input);
  const data = extractData<{ task: Task }>(res);
  return data.task;
}

export async function updateTask(
  taskId: string,
  input: UpdateTaskInput
): Promise<Task> {
  const res = await apiClient.patch(`/tasks/${taskId}`, input);
  const data = extractData<{ task: Task }>(res);
  return data.task;
}

export async function moveTask(
  taskId: string,
  input: MoveTaskInput
): Promise<Task> {
  const res = await apiClient.patch(`/tasks/${taskId}/move`, input);
  const data = extractData<{ task: Task }>(res);
  return data.task;
}

export async function reorderTasks(
  input: ReorderTasksInput
): Promise<Task[]> {
  const res = await apiClient.patch(`/tasks/reorder`, input);
  const data = extractData<{ tasks: Task[] }>(res);
  return data.tasks;
}

export async function deleteTask(taskId: string): Promise<void> {
  await apiClient.delete(`/tasks/${taskId}`);
}

// ─── Activity Logs ────────────────────────────────────────────────────────────

export async function listActivityLogs(
  tenantId: string,
  params?: { page?: number; limit?: number }
): Promise<{ logs: ActivityLog[]; pagination: Pagination }> {
  const res = await apiClient.get(`/tenants/${tenantId}/activity-logs`, { params });
  return extractData<{ logs: ActivityLog[]; pagination: Pagination }>(res);
}
