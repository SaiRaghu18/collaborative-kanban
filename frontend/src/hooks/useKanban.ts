import { useQuery } from '@tanstack/react-query';
import * as kanbanService from '@/services/kanban.service';
import { useTenant } from '@/contexts/TenantContext';

export const kanbanKeys = {
  all: ['kanban'] as const,
  boards: (tenantId: string) => [...kanbanKeys.all, 'boards', tenantId] as const,
  board: (boardId: string) => [...kanbanKeys.all, 'board', boardId] as const,
  columns: (boardId: string) => [...kanbanKeys.all, 'columns', boardId] as const,
  tasks: (columnId: string) => [...kanbanKeys.all, 'tasks', columnId] as const,
  task: (taskId: string) => [...kanbanKeys.all, 'task', taskId] as const,
  activityLogs: (tenantId: string) => [...kanbanKeys.all, 'activityLogs', tenantId] as const,
};

export function useBoards(options?: { archived?: boolean }) {
  const { selectedTenant } = useTenant();
  const tenantId = selectedTenant?.id || '';

  return useQuery({
    queryKey: kanbanKeys.boards(tenantId),
    queryFn: () => kanbanService.listBoards(tenantId, options),
    enabled: !!tenantId,
  });
}

export function useBoard(boardId: string) {
  return useQuery({
    queryKey: kanbanKeys.board(boardId),
    queryFn: () => kanbanService.getBoard(boardId),
    enabled: !!boardId,
  });
}

export function useActivityLogs(page = 1, limit = 20) {
  const { selectedTenant } = useTenant();
  const tenantId = selectedTenant?.id || '';

  return useQuery({
    queryKey: [...kanbanKeys.activityLogs(tenantId), page, limit],
    queryFn: () => kanbanService.listActivityLogs(tenantId, { page, limit }),
    enabled: !!tenantId,
  });
}
