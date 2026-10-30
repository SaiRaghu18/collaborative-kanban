import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '@/contexts/SocketContext';
import { useAuth } from '@/contexts/AuthContext';
import { kanbanKeys } from '@/hooks/useKanban';
import { PresenceUser, PresenceUpdatePayload } from '@/types';

/**
 * Custom React hook for live Kanban board synchronization and presence indicators.
 * Joins the authorized board room, maintains online collaborator presence,
 * and invalidates TanStack Query cache automatically on incoming task/column events.
 */
export function useBoardSocket(boardId: string | undefined) {
  const { socket, isConnected } = useSocket();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeUsers, setActiveUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!socket || !isConnected || !boardId) {
      return;
    }

    // ─── 1. Join Board Room ──────────────────────────────────────────────────
    socket.emit('join:board', boardId);

    // ─── 2. Presence Event Listeners ─────────────────────────────────────────
    const handleJoinedBoard = (data: { boardId: string; activeUsers: PresenceUser[] }) => {
      if (data.boardId === boardId) {
        setActiveUsers(data.activeUsers);
      }
    };

    const handlePresenceUpdate = (data: PresenceUpdatePayload) => {
      if (data.boardId === boardId) {
        setActiveUsers(data.users);
      }
    };

    socket.on('joined:board', handleJoinedBoard);
    socket.on('presence:update', handlePresenceUpdate);

    // ─── 3. Real-Time Mutation Listeners ─────────────────────────────────────
    const handleBoardEvent = (data: { boardId?: string; actorId?: string }) => {
      if (data && data.boardId === boardId) {
        // Automatically sync board cache across all open collaborator tabs
        queryClient.invalidateQueries({ queryKey: kanbanKeys.board(boardId) });
      }
    };

    // Task Events
    socket.on('task:created', handleBoardEvent);
    socket.on('task:updated', handleBoardEvent);
    socket.on('task:moved', handleBoardEvent);
    socket.on('task:reordered', handleBoardEvent);
    socket.on('task:deleted', handleBoardEvent);

    // Column Events
    socket.on('column:created', handleBoardEvent);
    socket.on('column:updated', handleBoardEvent);
    socket.on('column:reordered', handleBoardEvent);
    socket.on('column:deleted', handleBoardEvent);

    // Board Events
    socket.on('board:updated', handleBoardEvent);

    // ─── 4. Reconnection Recovery Handler ───────────────────────────────────
    const handleReconnect = () => {
      // Upon reconnecting, re-join board room and refetch latest state to heal any missed events
      socket.emit('join:board', boardId);
      queryClient.invalidateQueries({ queryKey: kanbanKeys.board(boardId) });
    };

    socket.on('connect', handleReconnect);

    // ─── 5. Cleanup on Unmount or Board Switch ──────────────────────────────
    return () => {
      socket.emit('leave:board', boardId);

      socket.off('joined:board', handleJoinedBoard);
      socket.off('presence:update', handlePresenceUpdate);

      socket.off('task:created', handleBoardEvent);
      socket.off('task:updated', handleBoardEvent);
      socket.off('task:moved', handleBoardEvent);
      socket.off('task:reordered', handleBoardEvent);
      socket.off('task:deleted', handleBoardEvent);

      socket.off('column:created', handleBoardEvent);
      socket.off('column:updated', handleBoardEvent);
      socket.off('column:reordered', handleBoardEvent);
      socket.off('column:deleted', handleBoardEvent);

      socket.off('board:updated', handleBoardEvent);
      socket.off('connect', handleReconnect);
    };
  }, [socket, isConnected, boardId, queryClient, user?.id]);

  return {
    isConnected,
    activeUsers,
    activeUserCount: activeUsers.length,
  };
}
