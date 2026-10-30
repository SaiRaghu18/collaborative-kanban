import React, { useState } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { useBoards } from '@/hooks/useKanban';
import { useNavigate } from 'react-router-dom';
import { Plus, Trello, Calendar, ArrowRight, Trash2, Edit2, Layers, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CardSkeleton } from '@/components/common/LoadingStates';
import { EmptyState } from '@/components/common/EmptyState';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/useToast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as kanbanService from '@/services/kanban.service';
import { kanbanKeys } from '@/hooks/useKanban';
import type { Board } from '@/types';

export default function BoardsPage() {
  const { selectedTenant, selectedOrg } = useTenant();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [boardName, setBoardName] = useState('');
  const [boardDescription, setBoardDescription] = useState('');

  const [editBoard, setEditBoard] = useState<Board | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const [deleteBoardId, setDeleteBoardId] = useState<string | null>(null);

  const tenantId = selectedTenant?.id || '';
  const { data, isLoading, error } = useBoards();
  const boards = data?.boards || [];

  // Create Board Mutation
  const createMutation = useMutation({
    mutationFn: (input: { name: string; description?: string }) =>
      kanbanService.createBoard(tenantId, input),
    onSuccess: (newBoard) => {
      queryClient.invalidateQueries({ queryKey: kanbanKeys.boards(tenantId) });
      setIsCreateOpen(false);
      setBoardName('');
      setBoardDescription('');
      toast({
        title: 'Board Created',
        description: `"${newBoard.name}" has been created with default columns.`,
      });
      navigate(`/dashboard/boards/${newBoard.id}`);
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Failed to create board',
        description: err.response?.data?.error || 'Something went wrong.',
      });
    },
  });

  // Edit Board Mutation (with optimistic concurrency version check)
  const updateMutation = useMutation({
    mutationFn: ({ id, version, name, description }: { id: string; version: number; name: string; description: string }) =>
      kanbanService.updateBoard(id, { name, description, version }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: kanbanKeys.boards(tenantId) });
      setEditBoard(null);
      toast({
        title: 'Board Updated',
        description: `Board "${updated.name}" updated successfully.`,
      });
    },
    onError: (err: any) => {
      if (err.response?.status === 409) {
        toast({
          variant: 'destructive',
          title: 'Version Conflict (409)',
          description: 'This board was modified by someone else. Refreshing latest data...',
        });
        queryClient.invalidateQueries({ queryKey: kanbanKeys.boards(tenantId) });
      } else {
        toast({
          variant: 'destructive',
          title: 'Update failed',
          description: err.response?.data?.error || 'Could not update board.',
        });
      }
    },
  });

  // Delete Board Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => kanbanService.deleteBoard(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: kanbanKeys.boards(tenantId) });
      setDeleteBoardId(null);
      toast({
        title: 'Board Deleted',
        description: 'The board and its contents have been removed.',
      });
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: err.response?.data?.error || 'Could not delete board.',
      });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!boardName.trim()) return;
    createMutation.mutate({ name: boardName.trim(), description: boardDescription.trim() });
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editBoard || !editName.trim()) return;
    updateMutation.mutate({
      id: editBoard.id,
      version: editBoard.version,
      name: editName.trim(),
      description: editDescription.trim(),
    });
  };

  if (!selectedOrg || !selectedTenant) {
    return (
      <EmptyState
        icon={<Layers className="h-10 w-10 text-primary" />}
        title="No Workspace Selected"
        description="Select an organization and workspace from the top menu to view or create boards."
        action={{
          label: 'Go to Organizations',
          onClick: () => navigate('/dashboard/organizations'),
        }}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider mb-1">
            <span>{selectedOrg.name}</span>
            <span>/</span>
            <span>{selectedTenant.name}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Trello className="h-6 w-6 text-indigo-400" />
            Kanban Boards
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your project pipelines, sprints, and task workflows
          </p>
        </div>

        <Button
          onClick={() => setIsCreateOpen(true)}
          className="gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-md text-white font-medium self-start sm:self-auto"
          id="create-board-btn"
        >
          <Plus className="h-4 w-4" />
          Create Board
        </Button>
      </div>

      {/* Boards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : boards.length === 0 ? (
        <EmptyState
          icon={<Trello className="h-10 w-10 text-primary" />}
          title="No Kanban Boards Yet"
          description={`Create your first board in the "${selectedTenant.name}" workspace to begin collaborating.`}
          action={{
            label: 'Create Your First Board',
            onClick: () => setIsCreateOpen(true),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {boards.map((board) => (
            <Card
              key={board.id}
              className="group border border-border/70 hover:border-primary/50 bg-card/60 hover:bg-card/90 transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer flex flex-col justify-between"
              onClick={() => navigate(`/dashboard/boards/${board.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0">
                    <Trello className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      title="Edit Board"
                      onClick={() => {
                        setEditBoard(board);
                        setEditName(board.name);
                        setEditDescription(board.description || '');
                      }}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      title="Delete Board"
                      onClick={() => setDeleteBoardId(board.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <CardTitle className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors mt-2">
                  {board.name}
                </CardTitle>
                <CardDescription className="line-clamp-2 text-xs">
                  {board.description || 'No description provided.'}
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-0 border-t border-border/50 text-xs text-muted-foreground flex items-center justify-between mt-auto">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 opacity-70" />
                  {new Date(board.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span className="font-medium text-primary flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  Open Board <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Create Board Dialog ────────────────────────────────────────────── */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>Create New Kanban Board</DialogTitle>
              <DialogDescription>
                A new board will be created inside <strong>{selectedTenant.name}</strong> with default columns (To Do, In Progress, Review, Done).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="board-name">Board Name *</Label>
                <Input
                  id="board-name"
                  placeholder="e.g. Q4 Sprint, Feature Pipeline"
                  value={boardName}
                  onChange={(e) => setBoardName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="board-desc">Description (Optional)</Label>
                <Input
                  id="board-desc"
                  placeholder="Goals and scope for this board"
                  value={boardDescription}
                  onChange={(e) => setBoardDescription(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Board'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit Board Dialog ──────────────────────────────────────────────── */}
      <Dialog open={!!editBoard} onOpenChange={(open) => !open && setEditBoard(null)}>
        <DialogContent>
          <form onSubmit={handleUpdate}>
            <DialogHeader>
              <DialogTitle>Edit Board Details</DialogTitle>
              <DialogDescription>
                Updates are protected by optimistic concurrency version control.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-board-name">Board Name *</Label>
                <Input
                  id="edit-board-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-board-desc">Description</Label>
                <Input
                  id="edit-board-desc"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditBoard(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ─────────────────────────────────────── */}
      <Dialog open={!!deleteBoardId} onOpenChange={(open) => !open && setDeleteBoardId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Delete Board?
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete this board? All columns and tasks inside this board will also be deleted. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteBoardId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteBoardId && deleteMutation.mutate(deleteBoardId)}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Board'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
