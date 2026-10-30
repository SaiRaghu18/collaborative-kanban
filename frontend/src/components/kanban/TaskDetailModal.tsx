import React, { useState, useEffect } from 'react';
import { Task, TaskPriority, TaskStatus, Column } from '@/types';
import { X, Calendar, User, Clock, Trash2, Save, Tag, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface TaskDetailModalProps {
  task: Task | null;
  columns: Column[];
  onClose: () => void;
  onUpdate: (taskId: string, version: number, updates: Partial<Task>) => void;
  onDelete: (taskId: string) => void;
  isLoading: boolean;
}

export function TaskDetailModal({
  task,
  columns,
  onClose,
  onUpdate,
  onDelete,
  isLoading,
}: TaskDetailModalProps) {
  if (!task) return null;

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [dueDate, setDueDate] = useState(
    task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''
  );
  const [tagsInput, setTagsInput] = useState(task.tags?.join(', ') || '');
  const [isConfirmDelete, setIsConfirmDelete] = useState(false);

  // Sync state if task props change (e.g. from server cache updates)
  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description || '');
    setPriority(task.priority);
    setStatus(task.status);
    setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
    setTagsInput(task.tags?.join(', ') || '');
    setIsConfirmDelete(false);
  }, [task]);

  const currentColumn = columns.find((c) => c.id === task.columnId);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const parsedTags = tagsInput
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    onUpdate(task.id, task.version, {
      title: title.trim(),
      description: description.trim() || null,
      priority,
      status,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      tags: parsedTags,
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-card border-l border-border shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-card/80">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs uppercase font-mono">
              Column: {currentColumn?.title || 'Unknown'}
            </Badge>
            <span className="text-xs text-muted-foreground font-mono">v{task.version}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => setIsConfirmDelete(true)}
              title="Delete task"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="task-detail-title" className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              Title
            </Label>
            <Input
              id="task-detail-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-base font-semibold"
              required
            />
          </div>

          {/* Properties Grid */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-xl border border-border/60 bg-muted/20">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Priority</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent ⚡</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
              >
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="DONE">Done</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Due Date</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tags (comma-separated)</Label>
              <Input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="h-9 text-xs"
                placeholder="bug, backend"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="task-detail-desc" className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              Description
            </Label>
            <textarea
              id="task-detail-desc"
              rows={6}
              className="w-full rounded-md border border-input bg-background p-3 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring leading-relaxed"
              placeholder="Add more details about this task..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Metadata info */}
          <div className="pt-4 border-t border-border/60 text-xs text-muted-foreground space-y-1">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              <span>Created on {new Date(task.createdAt).toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              <span>Last updated on {new Date(task.updatedAt).toLocaleString()}</span>
            </div>
          </div>

          {/* Footer Save Button */}
          <div className="pt-4 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="gap-2">
              <Save className="h-4 w-4" />
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>

        {/* Delete Confirmation Overlay */}
        {isConfirmDelete && (
          <div className="absolute inset-0 bg-background/95 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
            <AlertCircle className="h-12 w-12 text-destructive mb-3" />
            <h3 className="text-lg font-bold mb-1">Delete Task?</h3>
            <p className="text-xs text-muted-foreground max-w-xs mb-6">
              Are you sure you want to delete &ldquo;{task.title}&rdquo;? This action is permanent and will be logged in the workspace audit trail.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" size="sm" onClick={() => setIsConfirmDelete(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={isLoading}
                onClick={() => onDelete(task.id)}
              >
                {isLoading ? 'Deleting...' : 'Delete Task'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
