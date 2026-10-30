import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as kanbanService from '@/services/kanban.service';
import { kanbanKeys } from '@/hooks/useKanban';
import { Board, Column, Task, CreateTaskInput } from '@/types';
import { KanbanColumn } from '@/components/kanban/KanbanColumn';
import { TaskCard } from '@/components/kanban/TaskCard';
import { CreateTaskModal } from '@/components/kanban/CreateTaskModal';
import { TaskDetailModal } from '@/components/kanban/TaskDetailModal';
import { CardSkeleton } from '@/components/common/LoadingStates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/useToast';
import { useBoardSocket } from '@/hooks/useBoardSocket';
import { useKanbanHistory } from '@/hooks/useKanbanHistory';
import {
  ArrowLeft,
  Plus,
  Trello,
  Layers,
  AlertCircle,
  RefreshCw,
  Users,
  Undo2,
  Redo2,
} from 'lucide-react';

export default function BoardDetailPage() {
  const { boardId = '' } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Undo / Redo Action History (with OCC Concurrency & Backend Validation)
  const history = useKanbanHistory({ boardId });

  // Real-Time Socket.IO Collaboration & Live Presence
  const { isConnected, activeUsers, activeUserCount } = useBoardSocket(boardId);

  // Fetch Board details (including columns and nested tasks)
  const {
    data: board,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: kanbanKeys.board(boardId),
    queryFn: () => kanbanService.getBoard(boardId),
    enabled: !!boardId,
  });

  // Local state for active drag element
  const [activeColumn, setActiveColumn] = useState<Column | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // Modal dialog states
  const [activeColumnForNewTask, setActiveColumnForNewTask] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Column creation & edit modal states
  const [isAddColumnOpen, setIsAddColumnOpen] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [editingColumn, setEditingColumn] = useState<Column | null>(null);
  const [editColumnTitle, setEditColumnTitle] = useState('');

  // Column delete confirmation
  const [deleteColumnId, setDeleteColumnId] = useState<string | null>(null);
  const [deleteColumnTaskCount, setDeleteColumnTaskCount] = useState(0);

  // Configure drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement required to trigger drag, avoids accidental drag on click
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // ─── Mutations with Optimistic Updates & Concurrency Conflict Handling ─────

  // 1. Column Reordering Mutation
  const reorderColumnsMutation = useMutation({
    mutationFn: (columnIds: string[]) =>
      kanbanService.reorderColumns(boardId, { columnIds }),
    onMutate: async (columnIds) => {
      await queryClient.cancelQueries({ queryKey: kanbanKeys.board(boardId) });
      const previousBoard = queryClient.getQueryData<Board>(kanbanKeys.board(boardId));

      if (previousBoard && previousBoard.columns) {
        const columnMap = new Map(previousBoard.columns.map((c) => [c.id, c]));
        const reorderedColumns = columnIds
          .map((id) => columnMap.get(id))
          .filter(Boolean) as Column[];

        queryClient.setQueryData<Board>(kanbanKeys.board(boardId), {
          ...previousBoard,
          columns: reorderedColumns,
        });
      }

      return { previousBoard };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousBoard) {
        queryClient.setQueryData(kanbanKeys.board(boardId), context.previousBoard);
      }
      toast({
        variant: 'destructive',
        title: 'Reorder Failed',
        description: 'Could not save column order to server.',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: kanbanKeys.board(boardId) });
    },
  });

  // 2. Task Move Mutation (Between columns or within same column)
  const moveTaskMutation = useMutation({
    mutationFn: ({ taskId, targetColumnId, version }: { taskId: string; targetColumnId: string; version: number }) =>
      kanbanService.moveTask(taskId, { targetColumnId, version }),
    onError: (err: any) => {
      if (err.response?.status === 409) {
        toast({
          variant: 'destructive',
          title: 'Version Conflict (409)',
          description: 'This task was moved or modified by another teammate. Syncing board...',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Movement Failed',
          description: err.response?.data?.error || 'Failed to move task.',
        });
      }
      queryClient.invalidateQueries({ queryKey: kanbanKeys.board(boardId) });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: kanbanKeys.board(boardId) });
    },
  });

  // 3. Create Task Mutation
  const createTaskMutation = useMutation({
    mutationFn: ({ columnId, data }: { columnId: string; data: CreateTaskInput }) =>
      kanbanService.createTask(columnId, data),
    onSuccess: (newTask) => {
      queryClient.invalidateQueries({ queryKey: kanbanKeys.board(boardId) });
      setActiveColumnForNewTask(null);
      toast({
        title: 'Task Created',
        description: `"${newTask.title}" added to column.`,
      });
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Failed to create task',
        description: err.response?.data?.error || 'Something went wrong.',
      });
    },
  });

  // 4. Update Task Mutation
  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, version, updates }: { taskId: string; version: number; updates: Partial<Task> }) =>
      kanbanService.updateTask(taskId, { ...updates, version }),
    onSuccess: (updatedTask) => {
      queryClient.invalidateQueries({ queryKey: kanbanKeys.board(boardId) });
      setSelectedTask(null);
      toast({
        title: 'Task Updated',
        description: `"${updatedTask.title}" saved.`,
      });
    },
    onError: (err: any) => {
      if (err.response?.status === 409) {
        toast({
          variant: 'destructive',
          title: 'Version Conflict (409)',
          description: 'This task was updated by someone else. Please review the latest version.',
        });
        queryClient.invalidateQueries({ queryKey: kanbanKeys.board(boardId) });
      } else {
        toast({
          variant: 'destructive',
          title: 'Update failed',
          description: err.response?.data?.error || 'Could not update task.',
        });
      }
    },
  });

  // 5. Delete Task Mutation
  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) => kanbanService.deleteTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: kanbanKeys.board(boardId) });
      setSelectedTask(null);
      toast({
        title: 'Task Deleted',
        description: 'Task removed from board.',
      });
    },
  });

  // 6. Create Column Mutation
  const createColumnMutation = useMutation({
    mutationFn: (title: string) => kanbanService.createColumn(boardId, { title }),
    onSuccess: (newCol) => {
      queryClient.invalidateQueries({ queryKey: kanbanKeys.board(boardId) });
      setIsAddColumnOpen(false);
      setNewColumnTitle('');
      toast({
        title: 'Column Created',
        description: `"${newCol.title}" column added.`,
      });
    },
  });

  // 7. Update Column Mutation
  const updateColumnMutation = useMutation({
    mutationFn: ({ id, title, version }: { id: string; title: string; version: number }) =>
      kanbanService.updateColumn(id, { title, version }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: kanbanKeys.board(boardId) });
      setEditingColumn(null);
      toast({ title: 'Column Updated' });
    },
  });

  // 8. Delete Column Mutation (Enforces safe column deletion policy)
  const deleteColumnMutation = useMutation({
    mutationFn: (colId: string) => kanbanService.deleteColumn(colId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: kanbanKeys.board(boardId) });
      setDeleteColumnId(null);
      toast({ title: 'Column Deleted' });
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Cannot Delete Column',
        description: err.response?.data?.error || 'Column could not be deleted.',
      });
    },
  });

  // ─── Drag-and-Drop Handlers ──────────────────────────────────────────────────

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const type = active.data.current?.type;

    if (type === 'Column') {
      setActiveColumn(active.data.current?.column);
    } else if (type === 'Task') {
      setActiveTask(active.data.current?.task);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveTask = active.data.current?.type === 'Task';
    const isOverTask = over.data.current?.type === 'Task';

    if (!isActiveTask) return;

    // Moving a task over another task or over a column
    // The visual swap is handled optimistically in the board state
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveColumn(null);
    setActiveTask(null);

    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    const isColumn = active.data.current?.type === 'Column';

    // 1. Column Drag-and-Drop Reordering
    if (isColumn && board?.columns) {
      const oldIndex = board.columns.findIndex((c) => c.id === activeId);
      const newIndex = board.columns.findIndex((c) => c.id === overId);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(board.columns, oldIndex, newIndex);
        reorderColumnsMutation.mutate(reordered.map((c) => c.id));
      }
      return;
    }

    // 2. Task Drag-and-Drop Movement
    const task = active.data.current?.task as Task;
    if (!task) return;

    // Find destination column
    let targetColumnId: string | null = null;

    if (over.data.current?.type === 'Column') {
      targetColumnId = over.id as string;
    } else if (over.data.current?.type === 'Task') {
      const overTask = over.data.current.task as Task;
      targetColumnId = overTask.columnId;
    }

    if (targetColumnId && targetColumnId !== task.columnId) {
      // Record action for undo/redo before executing movement
      history.recordAction({
        type: 'TASK_MOVE',
        taskId: task.id,
        taskTitle: task.title,
        sourceColumnId: task.columnId,
        targetColumnId,
        timestamp: Date.now(),
      });

      // Optimistically trigger backend move
      moveTaskMutation.mutate({
        taskId: task.id,
        targetColumnId,
        version: task.version,
      });
    }
  };

  // ─── Render View ─────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <CardSkeleton />
        </div>
        <div className="flex gap-6 overflow-hidden">
          <div className="w-80 shrink-0 h-96 bg-card/40 rounded-2xl animate-pulse" />
          <div className="w-80 shrink-0 h-96 bg-card/40 rounded-2xl animate-pulse" />
          <div className="w-80 shrink-0 h-96 bg-card/40 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !board) {
    return (
      <div className="max-w-md mx-auto text-center py-20 space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
        <h2 className="text-xl font-bold">Failed to load board</h2>
        <p className="text-sm text-muted-foreground">
          The board could not be found or you may not have permission to access it.
        </p>
        <Button onClick={() => navigate('/dashboard')} variant="outline">
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const columns = board.columns || [];
  const columnIds = columns.map((c) => c.id);

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col space-y-4">
      {/* ── Top Bar: Breadcrumb, Board Title, Column Controls ────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => navigate(-1)}
            title="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <Trello className="h-5 w-5 text-indigo-400" />
                {board.name}
              </h1>
              <span className="text-[11px] text-muted-foreground font-mono px-2 py-0.5 rounded bg-muted/40">
                v{board.version}
              </span>
            </div>
            {board.description && (
              <p className="text-xs text-muted-foreground truncate max-w-xl">
                {board.description}
              </p>
            )}
          </div>
        </div>

        {/* Real-time Presence, Connection Badge, Undo/Redo & Actions */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Connection Status Badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
              isConnected
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span>{isConnected ? 'Live Sync' : 'Reconnecting...'}</span>
          </div>

          {/* Active Collaborators Presence Stack */}
          {activeUsers.length > 0 && (
            <div className="flex items-center gap-1.5 bg-muted/30 px-2 py-1 rounded-full border border-border/50">
              <div className="flex -space-x-1.5 overflow-hidden items-center">
                {activeUsers.slice(0, 4).map((u) => {
                  const initials = `${u.firstName?.[0] || ''}${u.lastName?.[0] || ''}`.toUpperCase() || 'U';
                  return (
                    <div
                      key={u.id}
                      className="relative inline-flex h-6 w-6 rounded-full ring-2 ring-card bg-gradient-to-tr from-indigo-600 to-violet-500 text-white text-[10px] font-bold items-center justify-center cursor-default shadow-sm"
                      title={`${u.firstName} ${u.lastName} (${u.email})`}
                    >
                      {u.avatarUrl ? (
                        <img
                          src={u.avatarUrl}
                          alt={u.firstName}
                          className="h-full w-full rounded-full object-cover"
                        />
                      ) : (
                        <span>{initials}</span>
                      )}
                      <span className="absolute bottom-0 right-0 block h-1.5 w-1.5 rounded-full bg-emerald-400 ring-1 ring-card" />
                    </div>
                  );
                })}
                {activeUsers.length > 4 && (
                  <div className="h-6 w-6 rounded-full ring-2 ring-card bg-muted text-[10px] font-semibold text-muted-foreground flex items-center justify-center">
                    +{activeUsers.length - 4}
                  </div>
                )}
              </div>
              <span className="text-[11px] font-medium text-muted-foreground hidden sm:inline pl-1 pr-1">
                {activeUserCount === 1 ? '1 active' : `${activeUserCount} active`}
              </span>
            </div>
          )}

          {/* Undo / Redo Toolbar Controls */}
          <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg border border-border/60">
            <Button
              variant="ghost"
              size="sm"
              disabled={!history.canUndo}
              onClick={() => history.undo()}
              className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
              title={
                history.canUndo
                  ? `Undo: ${history.lastUndoAction?.type === 'TASK_MOVE' ? 'Move' : 'Edit'} "${history.lastUndoAction?.taskTitle}" (Ctrl+Z)`
                  : 'Undo (Ctrl+Z)'
              }
            >
              <Undo2 className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Undo</span>
              {history.undoCount > 0 && (
                <span className="text-[10px] px-1 rounded bg-muted font-mono">{history.undoCount}</span>
              )}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              disabled={!history.canRedo}
              onClick={() => history.redo()}
              className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
              title={
                history.canRedo
                  ? `Redo: ${history.lastRedoAction?.type === 'TASK_MOVE' ? 'Move' : 'Edit'} "${history.lastRedoAction?.taskTitle}" (Ctrl+Y)`
                  : 'Redo (Ctrl+Y)'
              }
            >
              <Redo2 className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Redo</span>
              {history.redoCount > 0 && (
                <span className="text-[10px] px-1 rounded bg-muted font-mono">{history.redoCount}</span>
              )}
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="h-8 text-xs gap-1.5"
            title="Refresh Board"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Sync
          </Button>

          <Button
            size="sm"
            onClick={() => setIsAddColumnOpen(true)}
            className="h-8 text-xs gap-1.5 bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Column
          </Button>
        </div>
      </div>

      {/* ── Interactive Drag & Drop Board Area ─────────────────────────────── */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
          <div className="flex h-full items-start gap-5 min-w-max">
            <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
              {columns.map((column) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  tasks={column.tasks || []}
                  onAddTask={(colId) => setActiveColumnForNewTask(colId)}
                  onEditColumn={(col) => {
                    setEditingColumn(col);
                    setEditColumnTitle(col.title);
                  }}
                  onDeleteColumn={(colId, taskCount) => {
                    setDeleteColumnId(colId);
                    setDeleteColumnTaskCount(taskCount);
                  }}
                  onTaskClick={(task) => setSelectedTask(task)}
                />
              ))}
            </SortableContext>

            {/* Add Column Button at the end of the scroll list */}
            <div
              onClick={() => setIsAddColumnOpen(true)}
              className="w-80 shrink-0 h-32 border-2 border-dashed border-border/60 hover:border-primary/50 hover:bg-primary/5 rounded-2xl flex flex-col items-center justify-center text-xs font-semibold text-muted-foreground hover:text-primary transition-all cursor-pointer p-4 group select-none"
            >
              <Plus className="h-5 w-5 mb-1 group-hover:scale-110 transition-transform" />
              <span>Add Another Column</span>
            </div>
          </div>
        </div>

        {/* Drag Overlay Portal */}
        <DragOverlay>
          {activeColumn && (
            <KanbanColumn
              column={activeColumn}
              tasks={activeColumn.tasks || []}
              onAddTask={() => {}}
              onEditColumn={() => {}}
              onDeleteColumn={() => {}}
              onTaskClick={() => {}}
            />
          )}
          {activeTask && <TaskCard task={activeTask} onClick={() => {}} />}
        </DragOverlay>
      </DndContext>

      {/* ── Modals & Drawers ───────────────────────────────────────────────── */}

      {/* 1. Create Task Modal */}
      <CreateTaskModal
        isOpen={!!activeColumnForNewTask}
        onClose={() => setActiveColumnForNewTask(null)}
        onSubmit={(data) => {
          if (activeColumnForNewTask) {
            createTaskMutation.mutate({ columnId: activeColumnForNewTask, data });
          }
        }}
        isLoading={createTaskMutation.isPending}
        defaultColumnTitle={columns.find((c) => c.id === activeColumnForNewTask)?.title}
      />

      {/* 2. Task Detail Modal */}
      <TaskDetailModal
        task={selectedTask}
        columns={columns}
        onClose={() => setSelectedTask(null)}
        onUpdate={(taskId, version, updates) => {
          if (selectedTask) {
            history.recordAction({
              type: 'TASK_UPDATE',
              taskId,
              taskTitle: selectedTask.title,
              previousValues: {
                title: selectedTask.title,
                description: selectedTask.description,
                priority: selectedTask.priority,
                status: selectedTask.status,
                dueDate: selectedTask.dueDate,
                tags: selectedTask.tags,
                assigneeId: selectedTask.assigneeId,
              },
              newValues: updates,
              timestamp: Date.now(),
            });
          }
          updateTaskMutation.mutate({ taskId, version, updates });
        }}
        onDelete={(taskId) => {
          deleteTaskMutation.mutate(taskId);
        }}
        isLoading={updateTaskMutation.isPending || deleteTaskMutation.isPending}
      />

      {/* 3. Add Column Dialog */}
      <Dialog open={isAddColumnOpen} onOpenChange={setIsAddColumnOpen}>
        <DialogContent className="sm:max-w-md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newColumnTitle.trim()) {
                createColumnMutation.mutate(newColumnTitle.trim());
              }
            }}
          >
            <DialogHeader>
              <DialogTitle>Add New Column</DialogTitle>
              <DialogDescription>
                Create a new stage in this board workflow.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-2">
              <Label htmlFor="new-col-title">Column Title *</Label>
              <Input
                id="new-col-title"
                placeholder="e.g. Backlog, QA Testing, Deployed"
                value={newColumnTitle}
                onChange={(e) => setNewColumnTitle(e.target.value)}
                autoFocus
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddColumnOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createColumnMutation.isPending || !newColumnTitle.trim()}>
                {createColumnMutation.isPending ? 'Creating...' : 'Create Column'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 4. Edit Column Dialog */}
      <Dialog open={!!editingColumn} onOpenChange={(open) => !open && setEditingColumn(null)}>
        <DialogContent className="sm:max-w-md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (editingColumn && editColumnTitle.trim()) {
                updateColumnMutation.mutate({
                  id: editingColumn.id,
                  version: editingColumn.version,
                  title: editColumnTitle.trim(),
                });
              }
            }}
          >
            <DialogHeader>
              <DialogTitle>Rename Column</DialogTitle>
              <DialogDescription>
                Updates will be reflected for all collaborators.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-2">
              <Label htmlFor="edit-col-title">Column Title *</Label>
              <Input
                id="edit-col-title"
                value={editColumnTitle}
                onChange={(e) => setEditColumnTitle(e.target.value)}
                autoFocus
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingColumn(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateColumnMutation.isPending || !editColumnTitle.trim()}>
                {updateColumnMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 5. Delete Column Safe Policy Dialog */}
      <Dialog open={!!deleteColumnId} onOpenChange={(open) => !open && setDeleteColumnId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Delete Column?
            </DialogTitle>
            <DialogDescription>
              {deleteColumnTaskCount > 0 ? (
                <span className="text-destructive font-medium block">
                  Cannot delete this column because it currently contains {deleteColumnTaskCount} task(s). Move or delete the tasks first to prevent accidental data loss.
                </span>
              ) : (
                'Are you sure you want to delete this empty column? This action cannot be undone.'
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteColumnId(null)}>
              {deleteColumnTaskCount > 0 ? 'Close' : 'Cancel'}
            </Button>
            {deleteColumnTaskCount === 0 && (
              <Button
                variant="destructive"
                disabled={deleteColumnMutation.isPending}
                onClick={() => deleteColumnId && deleteColumnMutation.mutate(deleteColumnId)}
              >
                {deleteColumnMutation.isPending ? 'Deleting...' : 'Delete Column'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
