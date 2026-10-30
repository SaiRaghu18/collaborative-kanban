import React from 'react';
import { useActivityLogs } from '@/hooks/useKanban';
import { useTenant } from '@/contexts/TenantContext';
import { X, Clock, Activity, User, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardSkeleton } from '@/components/common/LoadingStates';

interface ActivityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ActivityDrawer({ isOpen, onClose }: ActivityDrawerProps) {
  const { selectedTenant } = useTenant();
  const { data, isLoading } = useActivityLogs(1, 30);

  if (!isOpen) return null;

  const logs = data?.logs || [];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-card border-l border-border shadow-2xl flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <div>
                <h2 className="text-base font-semibold">Workspace Activity</h2>
                <p className="text-xs text-muted-foreground">
                  {selectedTenant ? selectedTenant.name : 'All activity'}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Activity Log List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                <Clock className="h-10 w-10 mx-auto mb-3 opacity-40" />
                No activity records found in this workspace yet.
              </div>
            ) : (
              logs.map((log) => {
                const date = new Date(log.createdAt);
                const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const dateString = date.toLocaleDateString([], { month: 'short', day: 'numeric' });

                return (
                  <div
                    key={log.id}
                    className="p-3 rounded-lg border border-border/60 bg-muted/20 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-primary" />
                        {log.actor ? `${log.actor.firstName} ${log.actor.lastName}` : 'System'}
                      </span>
                      <span>
                        {dateString} at {timeString}
                      </span>
                    </div>

                    <div className="text-foreground/90 font-medium">
                      <span className="inline-block px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] mr-1.5 font-mono uppercase">
                        {log.action}
                      </span>
                      on {log.entityType}
                    </div>

                    {log.metadata && (
                      <div className="bg-background/80 rounded p-2 text-[11px] font-mono text-muted-foreground overflow-x-auto border border-border/40">
                        {JSON.stringify(log.metadata, null, 1).replace(/[{}"]/g, '')}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
