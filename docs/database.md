# Database Design & Schema Specification

## 1. Overview
The database layer uses PostgreSQL managed via Prisma ORM. All primary keys are UUIDs (`gen_random_uuid()`), and all tables track `createdAt` and `updatedAt` timestamps.

## 2. Models & Schema Mapping

| Model | Purpose | Key Attributes |
|---|---|---|
| **User** | Registered individuals | Email (unique), Password Hash, Full Name, Avatar |
| **Organization** | Top-level enterprise account | Name, Slug (unique), Description |
| **Tenant** | Branch, workspace, or department | Name, Slug, OrganizationId (FK) |
| **Membership** | Role mapping between User and Org/Tenant | UserId, OrgId, TenantId, Role (`ORG_ADMIN`, `TENANT_ADMIN`, `MEMBER`) |
| **Board** | Kanban board workspace | Title, Description, TenantId (FK), Version (optimistic concurrency) |
| **Column** | Kanban stage (e.g. To Do, Done) | Title, SortOrder (Float/Int), BoardId (FK), TenantId (FK), Version |
| **Task** | Work item / ticket | Title, Description, Priority, DueDate, ColumnId (FK), TenantId (FK), SortOrder, Version |
| **ActivityLog** | Audit trail of actions | Action, EntityType, EntityId, Details (JSON), UserId (FK), TenantId (FK) |

## 3. Concurrency & Ordering Strategy
- **SortOrder**: Numeric floating/integer sort orders allow instantaneous card insertions between adjacent cards without re-indexing the entire column.
- **Version Field**: Boards, Columns, and Tasks include an incrementing `version` integer to support optimistic locking and conflict resolution when multiple team members edit simultaneously.
- **Multi-Tenant Indexes**: Compound indexes on `[tenantId, createdAt]` and `[boardId, sortOrder]` ensure high-performance query execution and complete isolation.
