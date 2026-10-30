# Real-Time Collaboration Architecture (Socket.IO)

This document provides a comprehensive technical overview of the real-time collaboration engine implemented in **KanbanFlow** for multi-tenant, multi-board concurrent collaboration.

---

## 1. High-Level Architecture Overview

KanbanFlow uses **Socket.IO (v4)** over WebSockets (with polling fallback) to achieve zero-latency live updates across multiple connected collaborators.

```
       ┌────────────────┐                  ┌────────────────┐
       │ Browser Tab A  │                  │ Browser Tab B  │
       │ (Collaborator) │                  │ (Collaborator) │
       └───────┬────────┘                  └────────┬───────┘
               │ 1. Move Task (HTTP POST)           │
               ▼                                    │
       ┌────────────────┐                           │
       │  Express REST  │                           │
       │  API Engine    │                           │
       └───────┬────────┘                           │
               │ 2. Atomic Concurrency Check        │
               │    & DB Transaction                │
               ▼                                    │
       ┌────────────────┐                           │
       │  PostgreSQL    │                           │
       │  (Supabase)    │                           │
       └───────┬────────┘                           │
               │ 3. Transaction Commits             │
               ▼                                    │
       ┌────────────────┐                           │
       │   Socket.IO    │ 4. Broadcast to           │
       │   Room Engine  │───────────────────────────┘
       └────────────────┘    `board:{boardId}`
                             Live UI sync without reload!
```

### Key Architectural Principles
1. **Database & REST API as Single Source of Truth**: Sockets are never used to directly mutate database state. Mutations flow through validated REST endpoints with atomic optimistic concurrency control (`version`).
2. **Post-Commit Event Broadcasting**: Sockets only broadcast events *after* the PostgreSQL transaction commits successfully. Rollbacks never emit phantom events.
3. **Tenant & Board Room Isolation**: Sockets can only join rooms after server-side database verification of user authentication, workspace membership, and board permissions.

---

## 2. Secure Socket Authentication

Every Socket.IO connection is authenticated before any event processing:

1. **Token Transport**: The frontend client sends the JWT access token in `socket.handshake.auth.token`.
2. **Signature & Expiry Verification**: The server verifies the token signature using the shared secret and checks expiration via `verifyToken()`.
3. **Database Identity Lookup**: The server queries the `User` table to ensure the user exists and is active (`isActive: true`).
4. **Socket Attachment**: The authenticated user profile (`id`, `email`, `firstName`, `lastName`, `avatarUrl`) is attached directly to the `AuthenticatedSocket` session.
5. **Rejection**: If the token is missing, expired, or invalid, the socket connection is rejected immediately with an authentication error.

---

## 3. Server-Verified Room Isolation

Room names are never accepted blindly from client requests. Every room join is verified against the database.

### 1. Board Room: `board:{boardId}`
- **Purpose**: Scopes task, column, and board live events to users currently viewing that board.
- **Verification**:
  1. Verifies `boardId` exists.
  2. Resolves the board's `tenantId`.
  3. Verifies the authenticated user has a valid membership in `board.tenantId` (or is an `ORG_ADMIN`).
  4. If authorized, socket joins `board:{boardId}` and enters board presence tracking.

### 2. Tenant Room: `tenant:{tenantId}`
- **Purpose**: Scopes workspace-wide activity logs (`activity:created`) and board creation/deletion notifications.
- **Verification**:
  1. Checks `Membership` table for `userId` matching `tenantId` (or `ORG_ADMIN`).
  2. If authorized, socket joins `tenant:{tenantId}`.

---

## 4. Real-Time Events Reference

### Task Events (Room: `board:{boardId}`)
| Event Name | Description | Payload Key Properties |
|---|---|---|
| `task:created` | New task added to a column | `{ boardId, columnId, task, actorId }` |
| `task:updated` | Title, description, tags, priority updated | `{ boardId, columnId, task, actorId }` |
| `task:moved` | Task moved to another column or reordered | `{ boardId, taskId, sourceColumnId, targetColumnId, task, actorId }` |
| `task:reordered` | Tasks reordered in a column | `{ boardId, columnId, tasks, actorId }` |
| `task:deleted` | Task deleted from a column | `{ boardId, columnId, taskId, actorId }` |

### Column Events (Room: `board:{boardId}`)
| Event Name | Description | Payload Key Properties |
|---|---|---|
| `column:created` | New Kanban column added | `{ boardId, column, actorId }` |
| `column:updated` | Column title or color updated | `{ boardId, column, actorId }` |
| `column:reordered` | Column order changed via drag-and-drop | `{ boardId, columnIds, columns, actorId }` |
| `column:deleted` | Empty column deleted | `{ boardId, columnId, actorId }` |

### Board Events (Rooms: `board:{boardId}` and `tenant:{tenantId}`)
| Event Name | Description | Payload Key Properties |
|---|---|---|
| `board:updated` | Board renamed or description updated | `{ boardId, board, actorId }` |
| `board:deleted` | Board deleted from workspace | `{ boardId, tenantId, actorId }` |

### Activity Events (Room: `tenant:{tenantId}`)
| Event Name | Description | Payload Key Properties |
|---|---|---|
| `activity:created` | Audit log record created for workspace | `{ id, tenantId, actorId, action, entityType, entityId, metadata, createdAt, actor }` |

---

## 5. Live Presence Management

KanbanFlow tracks real-time collaborator presence per board:

### In-Memory Tracking (`PresenceManager`)
- Stores presence in a nested map: `boardId -> Map<userId, { user, socketIds: Set<string> }>`.
- **Multiple Browser Tabs**: If user Alice opens three tabs to the same board, she appears only once in the presence avatar stack.
- **Clean Disconnect**: When Alice closes one tab, the socket ID is removed. Alice remains visible until all her tabs are closed.
- **Full Disconnect**: When a socket disconnects, `handleDisconnect` automatically cleans up presence across all boards that socket was in, and broadcasts an updated `presence:update` to all affected board rooms.

### Presence Events
- `joined:board`: Emitted to the joining client with initial `{ boardId, activeUsers }`.
- `presence:update`: Broadcast to `board:{boardId}` whenever a collaborator joins or leaves with `{ boardId, users }`.

---

## 6. Frontend TanStack Query Synchronization

The React frontend integrates Socket.IO seamlessly with TanStack Query:

1. **Selective Invalidation**: When a `task:*` or `column:*` event arrives for `boardId`, the hook automatically calls:
   ```ts
   queryClient.invalidateQueries({ queryKey: ['kanban', 'board', boardId] });
   ```
2. **Zero Duplicate Jump**: The originating user’s UI is already optimistically updated by `@dnd-kit` and TanStack Query mutations. Invalidation reconciles version numbers silently.
3. **Collaborator Sync**: Connected teammates receive the broadcast, triggering an immediate background refetch that smoothly animates the new task positions into place.

---

## 7. Network Reconnection & Conflict Recovery

1. **Auto-Reconnect**: Socket client automatically reconnects using exponential backoff (1s to 5s).
2. **State Healing**: Upon socket reconnection (`socket.on('connect')`), `useBoardSocket` immediately:
   - Re-emits `join:board` to resume presence and event subscriptions.
   - Triggers `queryClient.invalidateQueries` to fetch the authoritative database state, catching up on any mutations that occurred while offline.
3. **Concurrency Conflict (HTTP 409)**: If an offline user attempts to commit a stale change, the backend rejects it with `409 Conflict`. The UI displays a friendly conflict notification and refreshes the board to the latest server state.

---

## 8. Scalability & Multi-Server Deployment Considerations

- **Current Implementation**: Uses in-memory Socket.IO rooms and presence tracking, ideal for single-instance Node.js processes.
- **Horizontal Scaling (Multiple Instances)**:
  - In a clustered or multi-container environment (e.g., Kubernetes, AWS ECS), backend nodes must share room broadcasts using the **`@socket.io/redis-adapter`**.
  - Transient presence state can be backed by **Redis Sets** or **Redis Hashes** with TTL expiration.
