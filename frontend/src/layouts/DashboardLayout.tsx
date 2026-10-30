import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  Layers,
  LayoutDashboard,
  Building2,
  Users,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Activity,
  Trello,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { OrgTenantSwitcher } from '@/components/navigation/OrgTenantSwitcher';
import { ActivityDrawer } from '@/components/activity/ActivityDrawer';
import { useTenantSocket } from '@/hooks/useTenantSocket';
import { cn } from '@/lib/utils';
import * as authService from '@/services/auth.service';

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const { selectedTenant } = useTenant();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [isActivityOpen, setIsActivityOpen] = useState(false);

  // Live workspace synchronization for activity, boards, and tenant-level presence
  const { onlineUsers } = useTenantSocket(selectedTenant?.id);

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, id: 'nav-dashboard' },
    {
      name: 'Boards',
      href: selectedTenant ? `/dashboard/workspaces/${selectedTenant.id}/boards` : '/dashboard',
      icon: Trello,
      id: 'nav-boards',
      disabled: !selectedTenant,
    },
    { name: 'Organizations', href: '/dashboard/organizations', icon: Building2, id: 'nav-organizations' },
    { name: 'Team', href: '/dashboard/team', icon: Users, id: 'nav-team' },
  ];

  const handleLogout = async () => {
    try {
      await authService.logout();
    } finally {
      logout();
      navigate('/login');
    }
  };

  const userInitials = user
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : '??';

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside
        className={cn(
          'relative flex flex-col border-r border-border bg-card/60 backdrop-blur-md transition-all duration-300 z-20',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Brand Header */}
        <div className={cn('flex items-center h-16 px-4 border-b border-border', collapsed && 'justify-center')}>
          <div className="p-1.5 rounded-lg bg-primary/20 border border-primary/30 flex-shrink-0">
            <Layers className="h-5 w-5 text-primary" />
          </div>
          {!collapsed && (
            <span className="ml-3 text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
              KanbanFlow
            </span>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto" aria-label="Main navigation">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              end={item.href === '/dashboard'}
              id={item.id}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group',
                  collapsed && 'justify-center px-2',
                  isActive
                    ? 'bg-primary/20 text-primary border border-primary/20 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                  item.disabled && 'pointer-events-none opacity-40'
                )
              }
              title={collapsed ? item.name : undefined}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>{item.name}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User Account Section */}
        <div className={cn('p-3 border-t border-border/80', collapsed && 'flex justify-center')}>
          {!collapsed ? (
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-card/50 border border-border/50">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {userInitials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate leading-tight">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                title="Log out"
                id="logout-button"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="h-9 w-9 text-muted-foreground hover:text-destructive"
              title="Log out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Collapse Sidebar Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 h-6 w-6 rounded-full border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground shadow-md transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </aside>

      {/* ── Main Content Area ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Navbar */}
        <header className="h-16 border-b border-border px-6 flex items-center justify-between bg-card/40 backdrop-blur-md z-10 shrink-0">
          <OrgTenantSwitcher />

          <div className="flex items-center gap-3">
            {/* Tenant-level live presence indicator */}
            {selectedTenant && onlineUsers.length > 0 && (
              <div
                className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400"
                title={`Online team members in ${selectedTenant.name}`}
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="hidden md:inline font-medium">
                  {onlineUsers.length} online
                </span>
                <div className="flex -space-x-1.5 ml-0.5">
                  {onlineUsers.slice(0, 4).map((u) => (
                    <div
                      key={u.id}
                      title={`${u.firstName} ${u.lastName} (${u.email})`}
                      className="h-5 w-5 rounded-full border border-card bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-[9px] font-bold text-white shadow-sm"
                    >
                      {u.firstName?.[0]?.toUpperCase() || 'U'}
                    </div>
                  ))}
                  {onlineUsers.length > 4 && (
                    <div className="h-5 w-5 rounded-full border border-card bg-muted flex items-center justify-center text-[9px] font-semibold text-muted-foreground">
                      +{onlineUsers.length - 4}
                    </div>
                  )}
                </div>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsActivityOpen(true)}
              className="gap-2 h-9 px-3 border-border/80 text-muted-foreground hover:text-foreground"
              title="View Workspace Activity"
            >
              <Activity className="h-4 w-4 text-primary" />
              <span className="hidden sm:inline text-xs font-medium">Activity Log</span>
            </Button>
          </div>
        </header>

        {/* Main Routed Page Container */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-background/50">
          <Outlet />
        </main>
      </div>

      {/* Activity Log Drawer */}
      <ActivityDrawer isOpen={isActivityOpen} onClose={() => setIsActivityOpen(false)} />
    </div>
  );
}
