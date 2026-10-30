# System Architecture & Multi-Tenant Design

## 1. High-Level Architecture
KanbanFlow follows a modular, multi-tenant Monorepo architecture designed for real-time collaborative work management.

```
┌─────────────────────────────────────────────────────────┐
│                      Client Layer                       │
│    React + Vite + TypeScript + TailwindCSS + shadcn     │
│    TanStack Query (Data Fetching & Cache) + Axios      │
│    dnd-kit (Future Drag & Drop) + Socket.IO Client      │
└────────────────────────────┬────────────────────────────┘
                             │ REST API (JSON) + WebSockets
┌────────────────────────────▼────────────────────────────┐
│                    API Gateway Layer                    │
│    Node.js + Express + TypeScript                       │
│    CORS, Helmet, Rate Limiter, Morgan Logger            │
└────────────────────────────┬────────────────────────────┘
                             │
     ┌───────────────────────┴───────────────────────┐
     ▼                                               ▼
┌───────────────────────────────┐     ┌───────────────────────────────┐
│    Security & Auth Engine     │     │       Real-Time Engine        │
│ • JWT Authentication Filter   │     │ • Socket.IO Server            │
│ • Tenant Isolation Middleware │     │ • Tenant Room Isolation       │
│ • Role-Based Access (RBAC)    │     │ • Board Room Isolation        │
└───────────────┬───────────────┘     └───────────────┬───────────────┘
                │                                     │
┌───────────────▼─────────────────────────────────────▼───────────────┐
│                       Service & Data Layer                          │
│ • Prisma ORM (Type-Safe Database Access)                            │
│ • PostgreSQL Database                                               │
│ • UUID Primary Keys, Version Locks, Soft-Order Indexes              │
└─────────────────────────────────────────────────────────────────────┘
```

## 2. Multi-Tenant Hierarchy

The system models real-world enterprise structures:

```
Organization (e.g., "Acme Corporation")
   │
   ├── Tenant / Branch A (e.g., "Engineering Department")
   │     ├── Board 1 (e.g., "Sprint 34 Board")
   │     │     ├── Column 1 ("To Do")
   │     │     │     └── Task 1 ("Design Schema")
   │     │     ├── Column 2 ("In Progress")
   │     │     └── Column 3 ("Done")
   │     └── Activity Logs (Actor, Action, Details)
   │
   └── Tenant / Branch B (e.g., "Marketing Department")
         └── Board 2 (e.g., "Q4 Campaign Launch")
```

### Roles and Permissions
- `ORG_ADMIN`: Full ownership across all tenants within an organization. Can create tenants, manage organizational billing, and invite team members.
- `TENANT_ADMIN`: Administrative rights inside their assigned tenant/branch. Can create and configure boards, manage columns, and moderate tasks.
- `MEMBER`: Standard contributor role. Can create tasks, move cards, add comments, and collaborate in real time.

## 3. Strict Tenant Isolation Guarantee
Every business data model (Board, Column, Task, ActivityLog) contains a `tenantId`.
Backend middleware enforces:
1. Verification of user identity via signed JWT.
2. Verification of user's active membership inside the target tenant.
3. No reliance on client-asserted `tenantId` without verifying database membership.
4. Cross-organization and cross-tenant queries are blocked at the middleware layer.

---

## 4. Real-Time Collaboration & Concurrency Architecture

### Concurrency Model
- **Optimistic Concurrency Control (OCC)**: Every `Board`, `Column`, and `Task` entity contains an integer `version` property.
- When mutating a task (e.g. moving between columns or reordering), the client sends the `version` it currently holds.
- The PostgreSQL transaction atomically verifies that `current.version === input.version`, updates the entity, and increments `version: { increment: 1 }`.
- If another collaborator already committed an update, the transaction triggers a `409 Conflict`, preventing silent overwrite and alerting the user to re-sync.

### WebSocket Room Architecture
- Sockets are authenticated via JWT during handshake.
- Server manages two isolated room tiers:
  - `tenant:{tenantId}`: Workspace-level notifications and audit logs.
  - `board:{boardId}`: Live Kanban card movements, column edits, and collaborator presence.
- Transient collaborator presence is managed in memory (`PresenceManager`) without polluting PostgreSQL with ephemeral connect/disconnect states.
- For complete real-time specifications, refer to [realtime-architecture.md](file:///c:/Users/pudis/OneDrive/Desktop/collaborative-kanban/docs/realtime-architecture.md).

