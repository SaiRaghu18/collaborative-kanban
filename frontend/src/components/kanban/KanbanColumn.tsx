import React, { useState } from 'react';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Column, Task } from '@/types';
import { TaskCard } from './TaskCard';
import { Plus, MoreHorizontal, Edit2, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface KanbanColumnProps {
  column: Column;
  tasks: Task[];
  onAddTask: (columnId: string) => void;
  onEditColumn: (column: Column) => void;
  onDeleteColumn: (columnId: string, taskCount: number) => void;
  onTaskClick: (task: Task) => void;
}

export function KanbanColumn({
  column,
  tasks,
  onAddTask,
  onEditColumn,
  onDeleteColumn,
  onTaskClick,
}: KanbanColumnProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.id,
    data: {
      type: 'Column',
      column,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const taskIds = tasks.map((t) => t.id);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'w-80 shrink-0 flex flex-col max-h-full bg-card/50 border border-border/80 rounded-2xl shadow-sm backdrop-blur-sm transition-all overflow-hidden',
        isDragging && 'opacity-40 border-dashed border-primary ring-2 ring-primary/40'
      )}
    >
      {/* ── Column Header ──────────────────────────────────────────────────── */}
      <div className="p-3.5 pb-2 border-b border-border/60 flex items-center justify-between gap-2 bg-card/70">
        <div className="flex items-center gap-2 min-w-0">
          {/* Drag Handle for Column Reordering */}
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground/60 hover:text-foreground p-0.5 rounded transition-colors"
            title="Drag to reorder column"
          >
            <GripVertical className="h-4 w-4" />
          </button>

          {/* Color Indicator */}
          {column.color && (
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0 shadow-xs"
              style={{ backgroundColor: column.color }}
            />
          )}

          <h3 className="font-semibold text-xs tracking-tight truncate text-foreground">
            {column.title}
          </h3>

          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground ml-1">
            {tasks.length}
          </span>
        </div>

        {/* Column Actions Dropdown */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => onAddTask(column.id)}
            title="Add Task to this column"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem onClick={() => onEditColumn(column)} className="text-xs cursor-pointer gap-2">
                <Edit2 className="h-3.5 w-3.5" />
                Rename Column
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDeleteColumn(column.id, tasks.length)}
                className="text-xs text-destructive focus:text-destructive cursor-pointer gap-2"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Column
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Task Cards Scrollable Area ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-[150px]">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div
            onClick={() => onAddTask(column.id)}
            className="h-24 border border-dashed border-border/70 rounded-xl flex flex-col items-center justify-center text-xs text-muted-foreground/60 hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer p-4 text-center group"
          >
            <Plus className="h-4 w-4 mb-1 group-hover:scale-110 transition-transform text-muted-foreground group-hover:text-primary" />
            <span>Add a card</span>
          </div>
        )}
      </div>

      {/* ── Column Bottom Quick Add ────────────────────────────────────────── */}
      <div className="p-2.5 border-t border-border/40 bg-card/30">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-xs text-muted-foreground hover:text-foreground gap-1.5 h-8"
          onClick={() => onAddTask(column.id)}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Task
        </Button>
      </div>
    </div>
  );
}
