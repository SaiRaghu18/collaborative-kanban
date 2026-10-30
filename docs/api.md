# KanbanFlow REST API Specification (Prompt 2 — Complete Kanban Engine)

All API endpoints follow a standardized, secure JSON response contract.

### Success Response Envelope:
```json
{
  "success": true,
  "message": "Operation description",
  "data": { ... }
}
```

### Error Response Envelope:
```json
{
  "success": false,
  "error": "Error description message",
  "errors": {
    "fieldName": ["Validation explanation"]
  }
}
```

---

## 🔐 1. Authentication Endpoints (`/api/auth`)
*Unauthenticated endpoints for session creation and verification.*

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register new user account | No |
| `POST` | `/api/auth/login` | Authenticate with email/password and obtain JWT | No |
| `POST` | `/api/auth/logout` | Invalidate/clear session | Bearer JWT |
| `GET` | `/api/auth/me` | Fetch currently logged in user profile & memberships | Bearer JWT |

---

## 🏢 2. Organization Management Endpoints (`/api/organizations`)
*Multi-tenant top level accounts.*

| Method | Endpoint | Description | Permissions |
|---|---|---|---|
| `POST` | `/api/organizations` | Create a new organization (creator receives `ORG_ADMIN`) | Authenticated User |
| `GET` | `/api/organizations` | List all organizations the user belongs to | Member |
| `GET` | `/api/organizations/:organizationId` | Get organization details and workspace counts | Member |
| `PATCH` | `/api/organizations/:organizationId` | Update organization name, slug, logo | `ORG_ADMIN` |
| `DELETE` | `/api/organizations/:organizationId` | Delete organization and all child workspaces | `ORG_ADMIN` |

---

## 👥 3. Organization Membership & RBAC (`/api/organizations/:orgId/members`)

| Method | Endpoint | Description | Permissions |
|---|---|---|---|
| `GET` | `/api/organizations/:organizationId/members` | List all members in the organization | Org Member |
| `POST` | `/api/organizations/:organizationId/members` | Invite/add registered user to organization | `ORG_ADMIN` |
| `PATCH` | `/api/organizations/:organizationId/members/:membershipId` | Update user role (`ORG_ADMIN`, `TENANT_ADMIN`, `MEMBER`) | `ORG_ADMIN` (Last admin protected) |
| `DELETE` | `/api/organizations/:organizationId/members/:membershipId` | Remove member from organization and all child workspaces | `ORG_ADMIN` (Last admin protected) |

---

## 🏬 4. Tenant / Workspace Endpoints (`/api/tenants` & `/api/organizations/:orgId/tenants`)

| Method | Endpoint | Description | Permissions |
|---|---|---|---|
| `POST` | `/api/organizations/:organizationId/tenants` | Create workspace/branch inside organization | `ORG_ADMIN` |
| `GET` | `/api/organizations/:organizationId/tenants` | List accessible workspaces inside organization | Org Member / Tenant Member |
| `GET` | `/api/tenants/:tenantId` | Get workspace details | Tenant Member or `ORG_ADMIN` |
| `PATCH` | `/api/tenants/:tenantId` | Update workspace name, description, slug | `TENANT_ADMIN` or `ORG_ADMIN` |
| `DELETE` | `/api/tenants/:tenantId` | Delete workspace and all its boards | `ORG_ADMIN` |

---

## 🏷️ 5. Tenant Membership Management (`/api/tenants/:tenantId/members`)

| Method | Endpoint | Description | Permissions |
|---|---|---|---|
| `GET` | `/api/tenants/:tenantId/members` | List members of this workspace | Tenant Member |
| `POST` | `/api/tenants/:tenantId/members` | Add organization member to this workspace | `TENANT_ADMIN` or `ORG_ADMIN` |
| `PATCH` | `/api/tenants/:tenantId/members/:membershipId` | Update member role (`TENANT_ADMIN`, `MEMBER`) | `TENANT_ADMIN` (Last admin protected) |
| `DELETE` | `/api/tenants/:tenantId/members/:membershipId` | Remove member from this workspace | `TENANT_ADMIN` (Last admin protected) |

---

## 📋 6. Board Management Endpoints (`/api/tenants/:tenantId/boards` & `/api/boards/:boardId`)

| Method | Endpoint | Description | Concurrency Guard | Permissions |
|---|---|---|---|---|
| `POST` | `/api/tenants/:tenantId/boards` | Create board (auto-provisions 4 default columns: To Do, In Progress, Review, Done) | Initial version = 0 | Tenant Member |
| `GET` | `/api/tenants/:tenantId/boards` | List boards in workspace with pagination (`?page=1&limit=20`) | — | Tenant Member |
| `GET` | `/api/boards/:boardId` | Get board details with columns and tasks | — | Tenant Member |
| `PATCH` | `/api/boards/:boardId` | Update board name, description, archived status | **Requires `version` (int)** | Tenant Member |
| `DELETE` | `/api/boards/:boardId` | Delete board and associated columns/tasks | — | Tenant Member |

### Sample Board Update Request (Optimistic Concurrency):
```json
PATCH /api/boards/3fa85f64-5717-4562-b3fc-2c963f66afa6
{
  "name": "Sprint 35 Board",
  "description": "Updated sprint goals",
  "version": 0
}
```
*If another user updated this board first, returns `409 Conflict`.*

---

## 📊 7. Column Management Endpoints (`/api/boards/:boardId/columns` & `/api/columns/:columnId`)

| Method | Endpoint | Description | Guard |
|---|---|---|---|
| `POST` | `/api/boards/:boardId/columns` | Create new column with auto-spaced `sortOrder` (+1000) | Initial version = 0 |
| `GET` | `/api/boards/:boardId/columns` | List all columns in board sorted by `sortOrder` | — |
| `GET` | `/api/columns/:columnId` | Get column details and tasks | — |
| `PATCH` | `/api/columns/:columnId` | Rename column or update color badge | **Requires `version` (int)** |
| `PATCH` | `/api/boards/:boardId/columns/reorder` | Atomically reorder all columns | Spaced reorder (1000, 2000, ...) |
| `DELETE` | `/api/columns/:columnId` | Safe column deletion | **Protected: Cannot delete column if it contains tasks** |

### Sample Column Reorder Request:
```json
PATCH /api/boards/3fa85f64-5717-4562-b3fc-2c963f66afa6/columns/reorder
{
  "columnIds": [
    "c1-uuid",
    "c2-uuid",
    "c3-uuid"
  ]
}
```

---

## 📝 8. Task Management Endpoints (`/api/columns/:columnId/tasks` & `/api/tasks`)

| Method | Endpoint | Description | Key Features |
|---|---|---|---|
| `POST` | `/api/columns/:columnId/tasks` | Create task inside column | Auto `tenantId` derivation from board |
| `GET` | `/api/columns/:columnId/tasks` | List tasks in column with pagination | Filter by column |
| `GET` | `/api/tasks/:taskId` | Get task details, creator & assignee profile | Deep tenant verification |
| `PATCH` | `/api/tasks/:taskId` | Update title, description, priority, due date, tags | **Optimistic Concurrency (requires `version`)** |
| `PATCH` | `/api/tasks/:taskId/move` | Move task to another column | **Strict Cross-Tenant Movement Rejection** |
| `PATCH` | `/api/tasks/reorder` | Atomically reorder tasks within a column | Spaced `sortOrder` recalculation |
| `DELETE` | `/api/tasks/:taskId` | Delete task | Creates audit log entry |

### Sample Move Task Request:
```json
PATCH /api/tasks/4a94628a-86a0-4c28-9477-d64fc565e317/move
{
  "targetColumnId": "b18b6e3f-67bb-43dc-8032-15f1da4f3b89",
  "targetSortOrder": 1500,
  "version": 0
}
```

---

## 📜 9. Audit & Activity Logs (`/api/tenants/:tenantId/activity-logs`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/tenants/:tenantId/activity-logs?page=1&limit=20` | Paginated audit trail of all workspace actions sorted newest first |

### Sample Activity Log Item:
```json
{
  "id": "log-uuid",
  "action": "task.moved",
  "entityType": "Task",
  "entityId": "task-uuid",
  "metadata": {
    "fromColumnId": "col1-uuid",
    "toColumnId": "col2-uuid",
    "previousSortOrder": 1000,
    "newSortOrder": 1500
  },
  "actor": {
    "id": "user-uuid",
    "email": "sarah@example.com",
    "firstName": "Sarah",
    "lastName": "Connor"
  },
  "createdAt": "2026-10-30T10:30:00.000Z"
}
```

---

## ⚡ 10. Real-Time WebSockets & Socket.IO Events

### Connection & Authentication
- **URL**: `ws://localhost:4000/socket.io/?EIO=4&transport=websocket`
- **Handshake Auth**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```

### Client-to-Server Events
| Event | Payload | Description |
|---|---|---|
| `join:board` | `boardId: string` | Authorizes membership and enters `board:{boardId}` room + presence |
| `leave:board` | `boardId: string` | Leaves `board:{boardId}` room and removes presence |
| `join:tenant` | `tenantId: string` | Authorizes membership and enters `tenant:{tenantId}` room |
| `leave:tenant` | `tenantId: string` | Leaves `tenant:{tenantId}` room |

### Server-to-Client Events
| Event | Room | Payload Sample |
|---|---|---|
| `presence:update` | `board:{boardId}` | `{ "boardId": "...", "users": [{ "id": "...", "email": "...", "firstName": "..." }] }` |
| `task:created` | `board:{boardId}` | `{ "boardId": "...", "columnId": "...", "task": { ... }, "actorId": "..." }` |
| `task:updated` | `board:{boardId}` | `{ "boardId": "...", "columnId": "...", "task": { ... }, "actorId": "..." }` |
| `task:moved` | `board:{boardId}` | `{ "boardId": "...", "taskId": "...", "sourceColumnId": "...", "targetColumnId": "...", "task": { ... } }` |
| `task:reordered` | `board:{boardId}` | `{ "boardId": "...", "columnId": "...", "tasks": [ ... ] }` |
| `task:deleted` | `board:{boardId}` | `{ "boardId": "...", "columnId": "...", "taskId": "..." }` |
| `column:created` | `board:{boardId}` | `{ "boardId": "...", "column": { ... } }` |
| `column:updated` | `board:{boardId}` | `{ "boardId": "...", "column": { ... } }` |
| `column:reordered` | `board:{boardId}` | `{ "boardId": "...", "columnIds": [ ... ], "columns": [ ... ] }` |
| `column:deleted` | `board:{boardId}` | `{ "boardId": "...", "columnId": "..." }` |
| `board:updated` | `board:{boardId}` | `{ "boardId": "...", "board": { ... } }` |
| `board:deleted` | `board:{boardId}` | `{ "boardId": "...", "tenantId": "..." }` |
| `activity:created` | `tenant:{tenantId}` | `{ "id": "...", "action": "task.moved", "metadata": { ... }, "actor": { ... } }` |

