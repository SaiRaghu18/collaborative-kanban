import { z } from 'zod';
import { MembershipRole, TaskPriority, TaskStatus } from '@prisma/client';

// Common UUID validator
export const uuidSchema = z.string().uuid({ message: 'Must be a valid UUID' });

// Pagination query validator
export const paginationQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 20)),
});

// ─── Organizations ────────────────────────────────────────────────────────────

export const createOrganizationSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric and hyphens only'),
  description: z.string().max(500).optional(),
  logoUrl: z.string().url('Invalid logo URL').optional().or(z.literal('')),
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric and hyphens only')
    .optional(),
  description: z.string().max(500).optional().nullable(),
  logoUrl: z.string().url().optional().nullable().or(z.literal('')),
});

// ─── Tenants ──────────────────────────────────────────────────────────────────

export const createTenantSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric and hyphens only'),
  description: z.string().max(500).optional(),
});

export const updateTenantSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric and hyphens only')
    .optional(),
  description: z.string().max(500).optional().nullable(),
});

// ─── Memberships ──────────────────────────────────────────────────────────────

export const addOrgMemberSchema = z.object({
  userId: uuidSchema,
  role: z.enum([MembershipRole.ORG_ADMIN, MembershipRole.TENANT_ADMIN, MembershipRole.MEMBER]),
});

export const updateOrgMemberRoleSchema = z.object({
  role: z.enum([MembershipRole.ORG_ADMIN, MembershipRole.TENANT_ADMIN, MembershipRole.MEMBER]),
});

export const addTenantMemberSchema = z.object({
  userId: uuidSchema,
  role: z.enum([MembershipRole.TENANT_ADMIN, MembershipRole.MEMBER]),
});

export const updateTenantMemberRoleSchema = z.object({
  role: z.enum([MembershipRole.TENANT_ADMIN, MembershipRole.MEMBER]),
});

// ─── Boards ───────────────────────────────────────────────────────────────────

export const createBoardSchema = z.object({
  name: z.string().min(1, 'Board name is required').max(100),
  description: z.string().max(500).optional(),
});

export const updateBoardSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  isArchived: z.boolean().optional(),
  version: z.number().int().min(0, 'Version is required for optimistic concurrency control'),
});

// ─── Columns ──────────────────────────────────────────────────────────────────

export const createColumnSchema = z.object({
  title: z.string().min(1, 'Column title is required').max(100),
  color: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Must be valid hex color').optional(),
});

export const updateColumnSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional().nullable(),
  version: z.number().int().min(0, 'Version is required for optimistic concurrency control'),
});

export const reorderColumnsSchema = z.object({
  columnIds: z
    .array(uuidSchema)
    .min(1, 'At least one column ID is required')
    .refine((items) => new Set(items).size === items.length, {
      message: 'Duplicate column IDs are not permitted in reorder request',
    }),
});

// ─── Tasks ────────────────────────────────────────────────────────────────────

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Task title is required').max(200),
  description: z.string().max(2000).optional(),
  priority: z.enum([TaskPriority.LOW, TaskPriority.MEDIUM, TaskPriority.HIGH, TaskPriority.URGENT]).optional(),
  status: z.enum([TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.DONE]).optional(),
  dueDate: z.string().datetime().optional().nullable(),
  assigneeId: uuidSchema.optional().nullable(),
  tags: z.array(z.string().max(30)).max(10).optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  priority: z.enum([TaskPriority.LOW, TaskPriority.MEDIUM, TaskPriority.HIGH, TaskPriority.URGENT]).optional(),
  status: z.enum([TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.DONE]).optional(),
  dueDate: z.string().datetime().optional().nullable(),
  assigneeId: uuidSchema.optional().nullable(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  version: z.number().int().min(0, 'Version is required for optimistic concurrency control'),
});

export const moveTaskSchema = z.object({
  targetColumnId: uuidSchema,
  targetSortOrder: z.number().optional(), // If not specified, places at the end of the column
  version: z.number().int().min(0, 'Version is required for optimistic concurrency control'),
});

export const reorderTasksSchema = z.object({
  columnId: uuidSchema,
  taskIds: z
    .array(uuidSchema)
    .min(1, 'At least one task ID is required')
    .refine((items) => new Set(items).size === items.length, {
      message: 'Duplicate task IDs are not permitted in reorder request',
    }),
});
