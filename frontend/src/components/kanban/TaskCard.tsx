import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Calendar, User, Clock, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TaskCardProps {
  task: Task;
  onClick: () => void;
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: 'Task',
      task,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priorityVariants: Record<string, 'low' | 'medium' | 'high' | 'urgent'> = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    URGENT: 'urgent',
  };

  const isCompleted = task.status === 'DONE';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        'group relative bg-card border border-border/80 hover:border-primary/50 rounded-xl p-3.5 shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing transition-all select-none space-y-2.5',
        isDragging && 'opacity-30 border-dashed border-primary ring-2 ring-primary/40',
        isCompleted && 'bg-card/40'
      )}
    >
      {/* Priority and Tags Row */}
      <div className="flex items-center justify-between gap-1.5">
        <Badge variant={priorityVariants[task.priority] || 'secondary'} className="text-[10px] uppercase font-bold tracking-wider">
          {task.priority}
        </Badge>

        {task.tags && task.tags.length > 0 && (
          <span className="text-[10px] text-muted-foreground/80 font-mono px-1.5 py-0.5 rounded bg-muted/40">
            #{task.tags[0]}
          </span>
        )}
      </div>

      {/* Task Title */}
      <h4 className={cn('text-xs font-semibold text-foreground leading-snug line-clamp-2', isCompleted && 'line-through text-muted-foreground')}>
        {task.title}
      </h4>

      {/* Description Snippet if present */}
      {task.description && (
        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
          {task.description}
        </p>
      )}

      {/* Footer Details: Due Date & Assignee */}
      <div className="flex items-center justify-between pt-1.5 border-t border-border/40 text-[11px] text-muted-foreground">
        {task.dueDate ? (
          <div className="flex items-center gap-1 font-mono text-[10px]">
            <Calendar className="h-3 w-3 text-primary/70" />
            <span>{new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
          </div>
        ) : (
          <div />
        )}

        {task.assignee ? (
          <div className="flex items-center gap-1">
            <div className="h-5 w-5 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-[9px] font-bold text-white shadow-xs">
              {task.assignee.firstName[0]}
            </div>
            <span className="text-[10px] truncate max-w-[60px]">{task.assignee.firstName}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-[10px] opacity-40">
            <User className="h-3 w-3" />
            <span>Unassigned</span>
          </div>
        )}
      </div>
    </div>
  );
}
