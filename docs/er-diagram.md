# KanbanFlow — Entity Relationship (ER) Diagram

This document contains the visual database Entity-Relationship (ER) diagram for **KanbanFlow**, a multi-organization, multi-tenant real-time collaborative Kanban board platform built with **PostgreSQL** and **Prisma ORM**.

---

## Visual ER Diagram (Mermaid)

```mermaid
erDiagram
    ORGANIZATION ||--o{ TENANT : "owns / partitions into"
    ORGANIZATION ||--o{ MEMBERSHIP : "grants org-level roles"
    
    TENANT ||--o{ MEMBERSHIP : "grants workspace-level roles"
    TENANT ||--o{ BOARD : "contains"
    TENANT ||--o{ TASK : "enforces data isolation"
    TENANT ||--o{ ACTIVITY_LOG : "records audit trail"

    USER ||--o{ MEMBERSHIP : "participates through"
    USER ||--o{ TASK : "assigned to (assignee)"
    USER ||--o{ TASK : "created by (creator)"
    USER ||--o{ ACTIVITY_LOG : "triggers as actor"

    BOARD ||--o{ COLUMN : "contains workflow stages"
    COLUMN ||--o{ TASK : "contains cards"

    ORGANIZATION {
        string id PK "UUID"
        string name "Display name"
        string slug UK "Unique identifier"
        string description "Optional bio"
        string logoUrl "Brand avatar"
        datetime createdAt "Timestamp"
        datetime updatedAt "Timestamp"
    }

    TENANT {
        string id PK "UUID"
        string name "Branch / workspace name"
        string slug "Unique per organization"
        string description "Optional bio"
        string organizationId FK "References ORGANIZATION(id)"
        datetime createdAt "Timestamp"
        datetime updatedAt "Timestamp"
    }

    USER {
        string id PK "UUID"
        string email UK "Unique login email"
        string firstName "Given name"
        string lastName "Family name"
        string passwordHash "Bcrypt hashed password (hidden)"
        string avatarUrl "Profile image"
        boolean isActive "Account status"
        datetime createdAt "Timestamp"
        datetime updatedAt "Timestamp"
    }

    MEMBERSHIP {
        string id PK "UUID"
        string userId FK "References USER(id)"
        string organizationId FK "References ORGANIZATION(id)"
        string tenantId FK "References TENANT(id), nullable"
        enum role "ORG_ADMIN | TENANT_ADMIN | MEMBER"
        enum scope "ORGANIZATION | TENANT"
        datetime createdAt "Timestamp"
        datetime updatedAt "Timestamp"
    }

    BOARD {
        string id PK "UUID"
        string name "Board name"
        string description "Optional details"
        string tenantId FK "References TENANT(id)"
        string createdById "Author ID"
        boolean isArchived "Soft-delete flag"
        int version "Optimistic Concurrency Control (OCC)"
        datetime createdAt "Timestamp"
        datetime updatedAt "Timestamp"
    }

    COLUMN {
        string id PK "UUID"
        string title "Stage name (e.g. In Progress)"
        string boardId FK "References BOARD(id)"
        float sortOrder "Fractional index for reordering"
        int version "Optimistic Concurrency Control (OCC)"
        string color "Hex or CSS color token"
        datetime createdAt "Timestamp"
        datetime updatedAt "Timestamp"
    }

    TASK {
        string id PK "UUID"
        string title "Task title"
        string description "Rich-text / Markdown description"
        string columnId FK "References COLUMN(id)"
        string tenantId FK "References TENANT(id) for row isolation"
        string assigneeId FK "References USER(id), nullable"
        string createdById FK "References USER(id), nullable"
        enum priority "LOW | MEDIUM | HIGH | URGENT"
        enum status "TODO | IN_PROGRESS | DONE"
        datetime dueDate "Due date timestamp"
        float sortOrder "Fractional index within column"
        int version "Optimistic Concurrency Control (OCC)"
        string_array tags "Task labels"
        datetime createdAt "Timestamp"
        datetime updatedAt "Timestamp"
    }

    ACTIVITY_LOG {
        string id PK "UUID"
        string tenantId FK "References TENANT(id)"
        string actorId FK "References USER(id)"
        string action "Event verb (e.g. task.moved)"
        string entityType "Task | Board | Column | Membership"
        string entityId "Target entity UUID"
        json metadata "Before/after values, diff snapshot"
        datetime createdAt "Event timestamp"
    }
```

---

## Detailed Model & Relationship Specifications

### 1. `Organization`
- **Purpose**: Top-level SaaS account representing an enterprise or enterprise division.
- **Cardinality**:
  - `Organization` 1 : N `Tenant` (One organization has multiple workspaces/branches).
  - `Organization` 1 : N `Membership` (An organization can have multiple direct member assignments).

### 2. `Tenant`
- **Purpose**: Discrete workspace/branch within an Organization (e.g., "Engineering", "Marketing"). All boards, tasks, and audit logs belong to a Tenant.
- **Constraints**:
  - Composite Unique Index: `@@unique([organizationId, slug])` ensures slug uniqueness within each organization.
- **Cardinality**:
  - `Tenant` N : 1 `Organization` (Cascade delete on organization removal).
  - `Tenant` 1 : N `Board` (A workspace contains many Kanban boards).
  - `Tenant` 1 : N `Task` (Tasks are denormalized with `tenantId` for instant row-level tenant security).
  - `Tenant` 1 : N `ActivityLog` (Workspace audit log stream).

### 3. `User`
- **Purpose**: Global user identity across organizations and workspaces.
- **Security**: `passwordHash` is never included in REST API responses or WebSocket payloads.
- **Cardinality**:
  - `User` 1 : N `Membership` (A user can belong to multiple organizations and workspaces with different roles).
  - `User` 1 : N `Task` (As assignee: `onDelete: SetNull`).
  - `User` 1 : N `Task` (As creator: `onDelete: SetNull`).
  - `User` 1 : N `ActivityLog` (As actor who performed the action).

### 4. `Membership` (Unified RBAC Join Table)
- **Purpose**: Polymorphic role-based access control table that grants permissions at either the Organization level or Workspace (Tenant) level.
- **Scopes & Roles**:
  - `scope = ORGANIZATION`: Grants org-wide access. An `ORG_ADMIN` inherits admin rights to all child tenants automatically.
  - `scope = TENANT`: Grants scoped access strictly within the designated `tenantId`.
  - Roles: `ORG_ADMIN`, `TENANT_ADMIN`, `MEMBER`.
- **Constraints**:
  - Composite Unique Index: `@@unique([userId, organizationId, tenantId])` prevents duplicate memberships.

### 5. `Board`
- **Purpose**: Visual Kanban workflow container.
- **Optimistic Concurrency**: Includes `version: Int @default(0)` incremented on structural changes to detect and prevent collaborative overwrite conflicts.
- **Cardinality**:
  - `Board` N : 1 `Tenant` (Cascade delete).
  - `Board` 1 : N `Column` (Workflow columns).

### 6. `Column`
- **Purpose**: Distinct workflow lane (e.g., "To Do", "In Progress", "In Review", "Done").
- **Ordering**: Uses `sortOrder: Float` allowing fractional updates without modifying siblings.
- **Optimistic Concurrency**: Includes `version: Int @default(0)`.
- **Safe Deletion Policy**: Backend prevents deleting columns that still contain tasks to eliminate accidental data loss.

### 7. `Task`
- **Purpose**: Kanban card containing work item details.
- **Row-Level Multi-Tenancy**: Carries both `columnId` AND `tenantId` to guarantee that queries, moves, updates, and undo/redo operations never cross workspace boundaries.
- **Optimistic Concurrency Control (OCC)**: `version: Int @default(0)`. All move, update, and undo/redo requests verify `incomingVersion === currentVersion`, responding with `409 Conflict` on concurrent mutations.

### 8. `ActivityLog`
- **Purpose**: Immutable append-only audit trail capturing user events within a tenant workspace.
- **Payload**: `metadata: Json?` stores before/after diffs, target column changes, and collaborator details for compliance and live activity stream rendering.
