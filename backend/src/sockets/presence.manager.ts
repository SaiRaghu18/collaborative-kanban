export interface PresenceUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

interface UserSession {
  user: PresenceUser;
  socketIds: Set<string>;
}

export interface DisconnectPresenceSummary {
  affectedBoards: Map<string, PresenceUser[]>;
  affectedTenants: Map<string, PresenceUser[]>;
}

class PresenceManager {
  // boardId -> Map<userId, UserSession>
  private boards = new Map<string, Map<string, UserSession>>();
  // socketId -> Set<boardId>
  private socketBoards = new Map<string, Set<string>>();

  // tenantId -> Map<userId, UserSession>
  private tenants = new Map<string, Map<string, UserSession>>();
  // socketId -> Set<tenantId>
  private socketTenants = new Map<string, Set<string>>();

  // ─── 1. Board-Level Presence ───────────────────────────────────────────────

  /**
   * Adds a socket connection for a user on a given board.
   * If the user already has open tabs on this board, increments the socket count.
   */
  addUser(boardId: string, socketId: string, user: PresenceUser): PresenceUser[] {
    if (!this.boards.has(boardId)) {
      this.boards.set(boardId, new Map());
    }

    const boardMap = this.boards.get(boardId)!;
    const existing = boardMap.get(user.id);

    if (existing) {
      existing.socketIds.add(socketId);
    } else {
      boardMap.set(user.id, {
        user,
        socketIds: new Set([socketId]),
      });
    }

    if (!this.socketBoards.has(socketId)) {
      this.socketBoards.set(socketId, new Set());
    }
    this.socketBoards.get(socketId)!.add(boardId);

    return this.getUsers(boardId);
  }

  /**
   * Removes a specific socket connection for a user from a board.
   */
  removeUser(boardId: string, socketId: string, userId: string): PresenceUser[] {
    const boardMap = this.boards.get(boardId);
    if (!boardMap) return [];

    const existing = boardMap.get(userId);
    if (existing) {
      existing.socketIds.delete(socketId);
      if (existing.socketIds.size === 0) {
        boardMap.delete(userId);
      }
    }

    if (boardMap.size === 0) {
      this.boards.delete(boardId);
    }

    const socketSet = this.socketBoards.get(socketId);
    if (socketSet) {
      socketSet.delete(boardId);
      if (socketSet.size === 0) {
        this.socketBoards.delete(socketId);
      }
    }

    return this.getUsers(boardId);
  }

  getUsers(boardId: string): PresenceUser[] {
    const boardMap = this.boards.get(boardId);
    if (!boardMap) return [];
    return Array.from(boardMap.values()).map((session) => session.user);
  }

  // ─── 2. Tenant-Level Presence ──────────────────────────────────────────────

  /**
   * Adds a socket connection for an authorized user inside a tenant workspace.
   */
  addTenantUser(tenantId: string, socketId: string, user: PresenceUser): PresenceUser[] {
    if (!this.tenants.has(tenantId)) {
      this.tenants.set(tenantId, new Map());
    }

    const tenantMap = this.tenants.get(tenantId)!;
    const existing = tenantMap.get(user.id);

    if (existing) {
      existing.socketIds.add(socketId);
    } else {
      tenantMap.set(user.id, {
        user,
        socketIds: new Set([socketId]),
      });
    }

    if (!this.socketTenants.has(socketId)) {
      this.socketTenants.set(socketId, new Set());
    }
    this.socketTenants.get(socketId)!.add(tenantId);

    return this.getTenantUsers(tenantId);
  }

  /**
   * Removes a specific socket connection for a user from a tenant workspace.
   */
  removeTenantUser(tenantId: string, socketId: string, userId: string): PresenceUser[] {
    const tenantMap = this.tenants.get(tenantId);
    if (!tenantMap) return [];

    const existing = tenantMap.get(userId);
    if (existing) {
      existing.socketIds.delete(socketId);
      if (existing.socketIds.size === 0) {
        tenantMap.delete(userId);
      }
    }

    if (tenantMap.size === 0) {
      this.tenants.delete(tenantId);
    }

    const socketSet = this.socketTenants.get(socketId);
    if (socketSet) {
      socketSet.delete(tenantId);
      if (socketSet.size === 0) {
        this.socketTenants.delete(socketId);
      }
    }

    return this.getTenantUsers(tenantId);
  }

  getTenantUsers(tenantId: string): PresenceUser[] {
    const tenantMap = this.tenants.get(tenantId);
    if (!tenantMap) return [];
    return Array.from(tenantMap.values()).map((session) => session.user);
  }

  // ─── 3. Disconnect Cleanup Across Both Scopes ──────────────────────────────

  /**
   * Cleans up all board and tenant presence when a socket disconnects.
   * Returns remaining users across all affected boards and tenants.
   */
  handleDisconnect(socketId: string, userId: string): DisconnectPresenceSummary {
    const affectedBoards = new Map<string, PresenceUser[]>();
    const affectedTenants = new Map<string, PresenceUser[]>();

    // Clean up boards
    const boardIds = this.socketBoards.get(socketId);
    if (boardIds) {
      for (const boardId of Array.from(boardIds)) {
        const remainingUsers = this.removeUser(boardId, socketId, userId);
        affectedBoards.set(boardId, remainingUsers);
      }
      this.socketBoards.delete(socketId);
    }

    // Clean up tenants
    const tenantIds = this.socketTenants.get(socketId);
    if (tenantIds) {
      for (const tenantId of Array.from(tenantIds)) {
        const remainingUsers = this.removeTenantUser(tenantId, socketId, userId);
        affectedTenants.set(tenantId, remainingUsers);
      }
      this.socketTenants.delete(socketId);
    }

    return { affectedBoards, affectedTenants };
  }

  /**
   * For testing or debugging purposes: clears all presence state.
   */
  clear(): void {
    this.boards.clear();
    this.socketBoards.clear();
    this.tenants.clear();
    this.socketTenants.clear();
  }
}

export const presenceManager = new PresenceManager();
