// ─────────────────────────────────────────────────────────────────────────────
// Shared TypeScript types for the frontend — mirrors backend API response shapes
// ─────────────────────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthResponse {
  user: User;
  token: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
}

// ─── Organizations ────────────────────────────────────────────────────────────

export type MembershipRole = 'ORG_ADMIN' | 'TENANT_ADMIN' | 'MEMBER';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
  role?: MembershipRole;
  joinedAt?: string;
  _count?: {
    tenants: number;
    memberships: number;
  };
}

export interface CreateOrganizationInput {
  name: string;
  slug: string;
  description?: string;
}

// ─── Tenants ──────────────────────────────────────────────────────────────────

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    boards: number;
    memberships: number;
  };
}

export interface CreateTenantInput {
  name: string;
  slug: string;
  description?: string;
}

// ─── Membership ───────────────────────────────────────────────────────────────

export interface Membership {
  id: string;
  userId: string;
  organizationId: string;
  tenantId: string | null;
  role: MembershipRole;
  scope: 'ORGANIZATION' | 'TENANT';
  createdAt: string;
  user: Pick<User, 'id' | 'email' | 'firstName' | 'lastName' | 'avatarUrl'>;
}

// ─── Boards ───────────────────────────────────────────────────────────────────

export interface Board {
  id: string;
  name: string;
  description: string | null;
  tenantId: string;
  isArchived: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
  columns?: Column[];
  _count?: {
    columns: number;
  };
}

export interface CreateBoardInput {
  name: string;
  description?: string;
}

export interface UpdateBoardInput {
  name?: string;
  description?: string | null;
  isArchived?: boolean;
  version: number;
}

// ─── Columns & Tasks ─────────────────────────────────────────────────────────

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

export interface Column {
  id: string;
  title: string;
  boardId: string;
  sortOrder: number;
  version: number;
  color: string | null;
  createdAt: string;
  updatedAt: string;
  tasks?: Task[];
  _count?: {
    tasks: number;
  };
}

export interface CreateColumnInput {
  title: string;
  color?: string;
}

export interface UpdateColumnInput {
  title?: string;
  color?: string | null;
  version: number;
}

export interface ReorderColumnsInput {
  columnIds: string[];
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  columnId: string;
  tenantId: string;
  assigneeId: string | null;
  createdById: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null;
  sortOrder: number;
  version: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  assignee?: Pick<User, 'id' | 'email' | 'firstName' | 'lastName' | 'avatarUrl'>;
  creator?: Pick<User, 'id' | 'email' | 'firstName' | 'lastName'>;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueDate?: string | null;
  assigneeId?: string | null;
  tags?: string[];
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueDate?: string | null;
  assigneeId?: string | null;
  tags?: string[];
  version: number;
}

export interface MoveTaskInput {
  targetColumnId: string;
  targetSortOrder?: number;
  version: number;
}

export interface ReorderTasksInput {
  columnId: string;
  taskIds: string[];
}

// ─── Activity Logs ────────────────────────────────────────────────────────────

export interface ActivityLog {
  id: string;
  tenantId: string;
  actorId: string;
  action: string;
  entityType: 'Organization' | 'Tenant' | 'Membership' | 'Board' | 'Column' | 'Task';
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: Pick<User, 'id' | 'email' | 'firstName' | 'lastName' | 'avatarUrl'>;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

// ─── Real-Time Collaboration & Presence Types ───────────────────────────────

export interface PresenceUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

export interface PresenceUpdatePayload {
  boardId: string;
  users: PresenceUser[];
}

export interface TaskEventPayload {
  boardId: string;
  columnId: string;
  task: Task;
  actorId: string;
}

export interface TaskMovedPayload {
  boardId: string;
  taskId: string;
  sourceColumnId: string;
  targetColumnId: string;
  task: Task;
  actorId: string;
}

export interface TaskReorderedPayload {
  boardId: string;
  columnId: string;
  tasks: Task[];
  actorId: string;
}

export interface TaskDeletedPayload {
  boardId: string;
  columnId: string;
  taskId: string;
  actorId: string;
}

export interface ColumnEventPayload {
  boardId: string;
  column: Column;
  actorId: string;
}

export interface ColumnReorderedPayload {
  boardId: string;
  columnIds: string[];
  columns: Column[];
  actorId: string;
}

export interface ColumnDeletedPayload {
  boardId: string;
  columnId: string;
  actorId: string;
}

export interface BoardEventPayload {
  boardId: string;
  board?: Board;
  tenantId?: string;
  actorId: string;
}

