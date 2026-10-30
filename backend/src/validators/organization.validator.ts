import { z } from 'zod';

// Slug validation: lowercase letters, numbers and hyphens only
const slugSchema = z
  .string()
  .min(2, 'Slug must be at least 2 characters')
  .max(50)
  .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens');

export const createOrganizationSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  slug: slugSchema,
  description: z.string().max(500).optional(),
  logoUrl: z.string().url('Invalid URL').optional(),
});

export const createTenantSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  slug: slugSchema,
  description: z.string().max(500).optional(),
});

export const addMemberSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  // Role is validated server-side: users cannot assign themselves ORG_ADMIN or TENANT_ADMIN
  role: z.enum(['TENANT_ADMIN', 'MEMBER']),
});

export const addOrgMemberSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  // For org-level, only ORG_ADMIN can add org admins, and only via explicit elevated call
  role: z.enum(['ORG_ADMIN', 'MEMBER']),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type AddOrgMemberInput = z.infer<typeof addOrgMemberSchema>;
