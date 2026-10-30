import { prisma } from '../config/database';
import { MembershipRole, MembershipScope } from '@prisma/client';
import { ConflictError, ForbiddenError, NotFoundError } from '../utils/errors';
import { createActivityLog } from './activityLog.service';
import type {
  createOrganizationSchema,
  updateOrganizationSchema,
  createTenantSchema,
  updateTenantSchema,
  addOrgMemberSchema,
  addTenantMemberSchema,
} from '../validators/kanban.validator';
import { z } from 'zod';

export type CreateOrgInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrgInput = z.infer<typeof updateOrganizationSchema>;
export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
export type AddOrgMemberInput = z.infer<typeof addOrgMemberSchema>;
export type AddTenantMemberInput = z.infer<typeof addTenantMemberSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// ORGANIZATIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function createOrganization(input: CreateOrgInput, creatorId: string) {
  const existing = await prisma.organization.findUnique({
    where: { slug: input.slug },
  });

  if (existing) {
    throw new ConflictError(`An organization with slug "${input.slug}" already exists`);
  }

  return prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: input.name,
        slug: input.slug,
        description: input.description,
        logoUrl: input.logoUrl,
      },
    });

    // Creator receives ORG_ADMIN role
    await tx.membership.create({
      data: {
        userId: creatorId,
        organizationId: org.id,
        role: MembershipRole.ORG_ADMIN,
        scope: MembershipScope.ORGANIZATION,
      },
    });

    return org;
  });
}

export async function listOrganizationsForUser(userId: string) {
  const memberships = await prisma.membership.findMany({
    where: {
      userId,
      scope: MembershipScope.ORGANIZATION,
    },
    include: {
      organization: {
        include: {
          _count: {
            select: { tenants: true, memberships: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return memberships.map((m) => ({
    ...m.organization,
    role: m.role,
    joinedAt: m.createdAt,
  }));
}

export async function getOrganizationById(orgId: string, userId: string) {
  const membership = await prisma.membership.findFirst({
    where: {
      userId,
      organizationId: orgId,
      scope: MembershipScope.ORGANIZATION,
    },
  });

  if (!membership) {
    throw new NotFoundError('Organization');
  }

  return prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
    include: {
      _count: {
        select: { tenants: true, memberships: true },
      },
    },
  });
}

export async function updateOrganization(
  orgId: string,
  input: UpdateOrgInput,
  actorId: string
) {
  // Verify actor is ORG_ADMIN
  const membership = await prisma.membership.findFirst({
    where: {
      userId: actorId,
      organizationId: orgId,
      role: MembershipRole.ORG_ADMIN,
      scope: MembershipScope.ORGANIZATION,
    },
  });

  if (!membership) {
    throw new ForbiddenError('Only organization admins can update organization details');
  }

  if (input.slug) {
    const existing = await prisma.organization.findFirst({
      where: { slug: input.slug, NOT: { id: orgId } },
    });
    if (existing) {
      throw new ConflictError(`Slug "${input.slug}" is already taken`);
    }
  }

  return prisma.organization.update({
    where: { id: orgId },
    data: {
      name: input.name,
      slug: input.slug,
      description: input.description,
      logoUrl: input.logoUrl,
    },
  });
}

export async function deleteOrganization(orgId: string, actorId: string) {
  // Verify actor is ORG_ADMIN
  const membership = await prisma.membership.findFirst({
    where: {
      userId: actorId,
      organizationId: orgId,
      role: MembershipRole.ORG_ADMIN,
      scope: MembershipScope.ORGANIZATION,
    },
  });

  if (!membership) {
    throw new ForbiddenError('Only organization admins can delete an organization');
  }

  // Deletion cascades through tenants, boards, columns, and tasks cleanly
  return prisma.organization.delete({
    where: { id: orgId },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TENANTS / WORKSPACES
// ─────────────────────────────────────────────────────────────────────────────

export async function createTenant(
  organizationId: string,
  input: CreateTenantInput,
  creatorId: string
) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
  });

  if (!org) {
    throw new NotFoundError('Organization');
  }

  const existing = await prisma.tenant.findFirst({
    where: { organizationId, slug: input.slug },
  });

  if (existing) {
    throw new ConflictError(`A workspace with slug "${input.slug}" already exists in this organization`);
  }

  return prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: input.name,
        slug: input.slug,
        description: input.description,
        organizationId,
      },
    });

    // Creator receives TENANT_ADMIN role
    await tx.membership.create({
      data: {
        userId: creatorId,
        organizationId,
        tenantId: tenant.id,
        role: MembershipRole.TENANT_ADMIN,
        scope: MembershipScope.TENANT,
      },
    });

    // Log tenant creation activity
    await createActivityLog(
      {
        tenantId: tenant.id,
        actorId: creatorId,
        action: 'tenant.created',
        entityType: 'Tenant',
        entityId: tenant.id,
        metadata: { name: tenant.name, slug: tenant.slug },
      },
      tx
    );

    return tenant;
  });
}

export async function listTenantsForUser(userId: string, organizationId: string) {
  // Check if user is ORG_ADMIN (has access to all tenants in org)
  const orgAdmin = await prisma.membership.findFirst({
    where: {
      userId,
      organizationId,
      role: MembershipRole.ORG_ADMIN,
      scope: MembershipScope.ORGANIZATION,
    },
  });

  if (orgAdmin) {
    return prisma.tenant.findMany({
      where: { organizationId },
      include: {
        _count: { select: { boards: true, memberships: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // Otherwise, return tenants the user explicitly has membership in
  const tenantMemberships = await prisma.membership.findMany({
    where: {
      userId,
      organizationId,
      scope: MembershipScope.TENANT,
    },
    include: {
      tenant: {
        include: {
          _count: { select: { boards: true, memberships: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return tenantMemberships
    .filter((m) => m.tenant !== null)
    .map((m) => m.tenant!);
}

export async function getTenantById(tenantId: string, userId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      organization: {
        select: { id: true, name: true, slug: true },
      },
      _count: { select: { boards: true, memberships: true } },
    },
  });

  if (!tenant) {
    throw new NotFoundError('Workspace');
  }

  // Check access: ORG_ADMIN or tenant member
  const hasAccess = await prisma.membership.findFirst({
    where: {
      userId,
      organizationId: tenant.organizationId,
      OR: [
        { scope: MembershipScope.ORGANIZATION, role: MembershipRole.ORG_ADMIN },
        { scope: MembershipScope.TENANT, tenantId: tenant.id },
      ],
    },
  });

  if (!hasAccess) {
    throw new NotFoundError('Workspace');
  }

  return tenant;
}

export async function updateTenant(
  tenantId: string,
  input: UpdateTenantInput,
  actorId: string
) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    throw new NotFoundError('Workspace');
  }

  // Verify actor has admin role in org or tenant
  const adminMembership = await prisma.membership.findFirst({
    where: {
      userId: actorId,
      organizationId: tenant.organizationId,
      OR: [
        { scope: MembershipScope.ORGANIZATION, role: MembershipRole.ORG_ADMIN },
        { scope: MembershipScope.TENANT, tenantId, role: MembershipRole.TENANT_ADMIN },
      ],
    },
  });

  if (!adminMembership) {
    throw new ForbiddenError('Only workspace or organization admins can update workspace details');
  }

  if (input.slug) {
    const existing = await prisma.tenant.findFirst({
      where: {
        organizationId: tenant.organizationId,
        slug: input.slug,
        NOT: { id: tenantId },
      },
    });
    if (existing) {
      throw new ConflictError(`Slug "${input.slug}" is already taken in this organization`);
    }
  }

  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      name: input.name,
      slug: input.slug,
      description: input.description,
    },
  });

  await createActivityLog({
    tenantId,
    actorId,
    action: 'tenant.updated',
    entityType: 'Tenant',
    entityId: tenantId,
    metadata: { updatedFields: input },
  });

  return updated;
}

export async function deleteTenant(tenantId: string, actorId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    throw new NotFoundError('Workspace');
  }

  // Only ORG_ADMIN can delete entire tenants
  const orgAdmin = await prisma.membership.findFirst({
    where: {
      userId: actorId,
      organizationId: tenant.organizationId,
      role: MembershipRole.ORG_ADMIN,
      scope: MembershipScope.ORGANIZATION,
    },
  });

  if (!orgAdmin) {
    throw new ForbiddenError('Only organization admins can delete a workspace');
  }

  return prisma.tenant.delete({
    where: { id: tenantId },
  });
}
