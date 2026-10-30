import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    id?: string;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 p-8 text-center animate-fade-in">
      {icon && (
        <div className="p-5 rounded-2xl bg-muted/50 border border-border">
          {icon}
        </div>
      )}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
          {description}
        </p>
      </div>
      {action && (
        <Button
          onClick={action.onClick}
          id={action.id || 'empty-state-action'}
          className="mt-2"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
