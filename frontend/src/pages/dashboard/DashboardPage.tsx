import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '@/contexts/TenantContext';
import { useBoards, useActivityLogs } from '@/hooks/useKanban';
import {
  Trello,
  Building2,
  Layers,
  Users,
  Activity,
  ArrowRight,
  Plus,
  Clock,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CardSkeleton } from '@/components/common/LoadingStates';

export default function DashboardPage() {
  const { selectedOrg, selectedTenant, organizations } = useTenant();
  const navigate = useNavigate();

  const { data: boardsData, isLoading: isLoadingBoards } = useBoards();
  const { data: activityData, isLoading: isLoadingActivity } = useActivityLogs(1, 5);

  const boards = boardsData?.boards || [];
  const logs = activityData?.logs || [];

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* ── Welcome Banner ─────────────────────────────────────────────────── */}
      <div className="rounded-3xl p-6 md:p-8 bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-background border border-primary/20 backdrop-blur-md relative overflow-hidden shadow-lg">
        <div className="relative z-10 max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-semibold mb-1 border border-primary/30">
            <Layers className="h-3.5 w-3.5" />
            <span>Workspace: {selectedTenant?.name || 'No Workspace Selected'}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
            Welcome to KanbanFlow
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Collaborative, real-time work management with multi-tenant data isolation and optimistic concurrency control.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-3">
            {selectedTenant && (
              <Button
                onClick={() => navigate(`/dashboard/workspaces/${selectedTenant.id}/boards`)}
                className="gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium shadow-md"
              >
                <Trello className="h-4 w-4" />
                View Boards
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => navigate('/dashboard/organizations')}
              className="gap-2 border-border/80 text-muted-foreground hover:text-foreground"
            >
              <Building2 className="h-4 w-4" />
              Manage Organizations
            </Button>
          </div>
        </div>
      </div>

      {/* ── Metric Cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Active Workspace
            </CardTitle>
            <Layers className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold truncate">{selectedTenant?.name || 'None'}</div>
            <p className="text-xs text-muted-foreground mt-1 truncate">
              In {selectedOrg?.name || 'No organization'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Boards
            </CardTitle>
            <Trello className="h-4 w-4 text-indigo-400" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{boards.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Active workflows in this workspace
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Organizations
            </CardTitle>
            <Building2 className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{organizations.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Accounts you have access to
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Audit Logs
            </CardTitle>
            <Activity className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{activityData?.pagination.total || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Logged events in workspace
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Boards Overview & Recent Activity Split ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Workspace Boards (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Trello className="h-5 w-5 text-primary" />
              Recent Boards
            </h2>
            {selectedTenant && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/dashboard/workspaces/${selectedTenant.id}/boards`)}
                className="text-xs text-primary hover:text-primary gap-1"
              >
                View all ({boards.length}) <ArrowRight className="h-3 w-3" />
              </Button>
            )}
          </div>

          {isLoadingBoards ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : boards.length === 0 ? (
            <Card className="border-dashed border-border/80 bg-card/40">
              <CardContent className="py-12 text-center space-y-3">
                <Trello className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                <h3 className="font-semibold text-sm">No boards created yet</h3>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  Create your first Kanban board to start organizing tasks, columns, and team workflows.
                </p>
                {selectedTenant && (
                  <Button
                    size="sm"
                    onClick={() => navigate(`/dashboard/workspaces/${selectedTenant.id}/boards`)}
                    className="gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create Board
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {boards.slice(0, 4).map((board) => (
                <Card
                  key={board.id}
                  onClick={() => navigate(`/dashboard/boards/${board.id}`)}
                  className="group border-border/70 hover:border-primary/50 bg-card/60 hover:bg-card/90 transition-all cursor-pointer p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-sm group-hover:text-primary transition-colors truncate">
                      {board.name}
                    </h3>
                    <span className="text-[10px] font-mono text-muted-foreground px-1.5 py-0.5 rounded bg-muted/60">
                      v{board.version}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {board.description || 'No description provided.'}
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-border/40">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(board.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="font-medium text-primary group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                      Open <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Recent Audit Activity (1 Col) */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-400" />
            Recent Activity
          </h2>

          <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
            <CardContent className="p-4 space-y-3">
              {isLoadingActivity ? (
                <div className="space-y-2">
                  <div className="h-10 bg-muted/30 rounded animate-pulse" />
                  <div className="h-10 bg-muted/30 rounded animate-pulse" />
                  <div className="h-10 bg-muted/30 rounded animate-pulse" />
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  No activity recorded in this workspace yet.
                </div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-lg border border-border/40 bg-muted/10 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-muted-foreground text-[10px]">
                      <span className="font-semibold text-foreground">
                        {log.actor ? `${log.actor.firstName}` : 'User'}
                      </span>
                      <span>
                        {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-foreground/90 font-medium text-[11px]">
                      <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[9px] font-mono uppercase mr-1">
                        {log.action}
                      </span>
                      {log.entityType}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
