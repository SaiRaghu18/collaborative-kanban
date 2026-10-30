import { useState, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as kanbanService from '@/services/kanban.service';
import { kanbanKeys } from '@/hooks/useKanban';
import { Board, Task } from '@/types';
import { useToast } from '@/hooks/useToast';

export type HistoryActionType = 'TASK_MOVE' | 'TASK_UPDATE';

export interface TaskMoveAction {
  type: 'TASK_MOVE';
  taskId: string;
  taskTitle: string;
  sourceColumnId: string;
  targetColumnId: string;
  timestamp: number;
}

export interface TaskUpdateAction {
  type: 'TASK_UPDATE';
  taskId: string;
  taskTitle: string;
  previousValues: {
    title?: string;
    description?: string | null;
    priority?: Task['priority'];
    status?: Task['status'];
    dueDate?: string | null;
    tags?: string[];
    assigneeId?: string | null;
  };
  newValues: {
    title?: string;
    description?: string | null;
    priority?: Task['priority'];
    status?: Task['status'];
    dueDate?: string | null;
    tags?: string[];
    assigneeId?: string | null;
  };
  timestamp: number;
}

export type HistoryAction = TaskMoveAction | TaskUpdateAction;

interface UseKanbanHistoryOptions {
  boardId: string;
  maxHistory?: number;
}

/**
 * Safe, production-grade Undo / Redo engine for KanbanFlow boards.
 *
 * Enforces:
 * 1. Backend validation: every undo/redo calls the official backend API.
 * 2. Optimistic Concurrency Control (OCC): sends the latest known task version.
 *    If another collaborator changed the task, backend returns 409 Conflict,
 *    preventing accidental overwrites of teammates' work.
 * 3. Tenant authorization: requests carry user session tokens verified by backend.
 * 4. Keyboard shortcuts (Ctrl+Z, Ctrl+Y / Ctrl+Shift+Z).
 */
export function useKanbanHistory({ boardId, maxHistory = 25 }: UseKanbanHistoryOptions) {
  const [undoStack, setUndoStack] = useState<HistoryAction[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryAction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Helper to find the latest version of a task from TanStack cache
  const getLatestTask = useCallback(
    (taskId: string): Task | null => {
      const board = queryClient.getQueryData<Board>(kanbanKeys.board(boardId));
      if (!board?.columns) return null;
      for (const col of board.columns) {
        const found = col.tasks?.find((t) => t.id === taskId);
        if (found) return found;
      }
      return null;
    },
    [boardId, queryClient]
  );

  /**
   * Records a user-initiated action into the history stack.
   * Clears the redo stack on new actions (standard undo/redo semantics).
   */
  const recordAction = useCallback(
    (action: HistoryAction) => {
      setUndoStack((prev) => [...prev.slice(-maxHistory + 1), action]);
      setRedoStack([]); // New action invalidates previous redo timeline
    },
    [maxHistory]
  );

  /**
   * Executes an UNDO operation:
   * Reverts the most recent user action by making an authorized backend request
   * with the current version of the task.
   */
  const undo = useCallback(async () => {
    if (undoStack.length === 0 || isProcessing) return;

    const action = undoStack[undoStack.length - 1];
    const task = getLatestTask(action.taskId);

    if (!task) {
      toast({
        variant: 'destructive',
        title: 'Cannot Undo',
        description: `Task "${action.taskTitle}" no longer exists or is not loaded.`,
      });
      // Pop stale action
      setUndoStack((prev) => prev.slice(0, -1));
      return;
    }

    setIsProcessing(true);

    try {
      if (action.type === 'TASK_MOVE') {
        // Move task back to original column
        await kanbanService.moveTask(action.taskId, {
          targetColumnId: action.sourceColumnId,
          version: task.version,
        });

        toast({
          title: 'Action Undone',
          description: `Moved "${action.taskTitle}" back to original column.`,
        });
      } else if (action.type === 'TASK_UPDATE') {
        // Restore previous field values
        await kanbanService.updateTask(action.taskId, {
          ...action.previousValues,
          version: task.version,
        });

        toast({
          title: 'Action Undone',
          description: `Restored previous values for "${action.taskTitle}".`,
        });
      }

      // Move action from undo stack to redo stack
      setUndoStack((prev) => prev.slice(0, -1));
      setRedoStack((prev) => [...prev, action]);

      // Refetch board to ensure local cache is perfectly synchronized
      queryClient.invalidateQueries({ queryKey: kanbanKeys.board(boardId) });
    } catch (err: any) {
      if (err.response?.status === 409) {
        toast({
          variant: 'destructive',
          title: 'Undo Blocked (409 Conflict)',
          description:
            'A teammate modified this task after you. To protect collaborative work, this action cannot be undone.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Undo Failed',
          description: err.response?.data?.error || 'Could not revert action on server.',
        });
      }
      // Invalidate cache to align with server truth
      queryClient.invalidateQueries({ queryKey: kanbanKeys.board(boardId) });
    } finally {
      setIsProcessing(false);
    }
  }, [undoStack, isProcessing, getLatestTask, boardId, queryClient, toast]);

  /**
   * Executes a REDO operation:
   * Re-applies the undone action by making an authorized backend request.
   */
  const redo = useCallback(async () => {
    if (redoStack.length === 0 || isProcessing) return;

    const action = redoStack[redoStack.length - 1];
    const task = getLatestTask(action.taskId);

    if (!task) {
      toast({
        variant: 'destructive',
        title: 'Cannot Redo',
        description: `Task "${action.taskTitle}" no longer exists or is not loaded.`,
      });
      // Pop stale action
      setRedoStack((prev) => prev.slice(0, -1));
      return;
    }

    setIsProcessing(true);

    try {
      if (action.type === 'TASK_MOVE') {
        // Re-move task to target column
        await kanbanService.moveTask(action.taskId, {
          targetColumnId: action.targetColumnId,
          version: task.version,
        });

        toast({
          title: 'Action Redone',
          description: `Re-moved "${action.taskTitle}".`,
        });
      } else if (action.type === 'TASK_UPDATE') {
        // Re-apply updated field values
        await kanbanService.updateTask(action.taskId, {
          ...action.newValues,
          version: task.version,
        });

        toast({
          title: 'Action Redone',
          description: `Re-applied updates for "${action.taskTitle}".`,
        });
      }

      // Move action from redo stack back to undo stack
      setRedoStack((prev) => prev.slice(0, -1));
      setUndoStack((prev) => [...prev, action]);

      queryClient.invalidateQueries({ queryKey: kanbanKeys.board(boardId) });
    } catch (err: any) {
      if (err.response?.status === 409) {
        toast({
          variant: 'destructive',
          title: 'Redo Blocked (409 Conflict)',
          description:
            'A teammate modified this task. Redo aborted to prevent overwriting recent collaborative changes.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Redo Failed',
          description: err.response?.data?.error || 'Could not re-apply action on server.',
        });
      }
      queryClient.invalidateQueries({ queryKey: kanbanKeys.board(boardId) });
    } finally {
      setIsProcessing(false);
    }
  }, [redoStack, isProcessing, getLatestTask, boardId, queryClient, toast]);

  // Keyboard shortcut listener: Ctrl+Z (Undo), Ctrl+Y or Ctrl+Shift+Z (Redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input, textarea, or contentEditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (!modKey) return;

      if (e.key === 'z' || e.key === 'Z') {
        if (e.shiftKey) {
          // Redo: Ctrl+Shift+Z
          e.preventDefault();
          redo();
        } else {
          // Undo: Ctrl+Z
          e.preventDefault();
          undo();
        }
      } else if (e.key === 'y' || e.key === 'Y') {
        // Redo: Ctrl+Y
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return {
    canUndo: undoStack.length > 0 && !isProcessing,
    canRedo: redoStack.length > 0 && !isProcessing,
    undoCount: undoStack.length,
    redoCount: redoStack.length,
    lastUndoAction: undoStack[undoStack.length - 1] || null,
    lastRedoAction: redoStack[redoStack.length - 1] || null,
    isProcessing,
    recordAction,
    undo,
    redo,
    clearHistory: () => {
      setUndoStack([]);
      setRedoStack([]);
    },
  };
}
