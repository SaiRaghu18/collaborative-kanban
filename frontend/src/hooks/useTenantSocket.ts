import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '@/contexts/SocketContext';
import { kanbanKeys } from '@/hooks/useKanban';
import { PresenceUser } from '@/types';

/**
 * Custom React hook for tenant-scoped workspace updates (activity logs, board list, and tenant presence).
 * Listens for new activity logs and online members across the workspace.
 */
export function useTenantSocket(tenantId: string | undefined) {
  const { socket, isConnected } = useSocket();
  const queryClient = useQueryClient();
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!socket || !isConnected || !tenantId) {
      setOnlineUsers([]);
      return;
    }

    socket.emit('join:tenant', tenantId);

    const handleTenantPresence = (data: { tenantId: string; users: PresenceUser[] }) => {
      if (data.tenantId === tenantId) {
        setOnlineUsers(data.users || []);
      }
    };

    const handleJoinedTenant = (data: { tenantId: string; activeUsers?: PresenceUser[] }) => {
      if (data.tenantId === tenantId && data.activeUsers) {
        setOnlineUsers(data.activeUsers);
      }
    };

    const handleActivity = () => {
      queryClient.invalidateQueries({ queryKey: kanbanKeys.activityLogs(tenantId) });
    };

    const handleBoardChange = () => {
      queryClient.invalidateQueries({ queryKey: kanbanKeys.boards(tenantId) });
    };

    socket.on('presence:tenant', handleTenantPresence);
    socket.on('joined:tenant', handleJoinedTenant);
    socket.on('activity:created', handleActivity);
    socket.on('board:created', handleBoardChange);
    socket.on('board:updated', handleBoardChange);
    socket.on('board:deleted', handleBoardChange);

    const handleReconnect = () => {
      socket.emit('join:tenant', tenantId);
      queryClient.invalidateQueries({ queryKey: kanbanKeys.activityLogs(tenantId) });
      queryClient.invalidateQueries({ queryKey: kanbanKeys.boards(tenantId) });
    };

    socket.on('connect', handleReconnect);

    return () => {
      socket.emit('leave:tenant', tenantId);
      socket.off('presence:tenant', handleTenantPresence);
      socket.off('joined:tenant', handleJoinedTenant);
      socket.off('activity:created', handleActivity);
      socket.off('board:created', handleBoardChange);
      socket.off('board:updated', handleBoardChange);
      socket.off('board:deleted', handleBoardChange);
      socket.off('connect', handleReconnect);
      setOnlineUsers([]);
    };
  }, [socket, isConnected, tenantId, queryClient]);

  return { onlineUsers };
}

