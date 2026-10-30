import { prisma } from '../config/database';
import { MembershipRole, MembershipScope } from '@prisma/client';
import { ConflictError, ForbiddenError, NotFoundError } from '../utils/errors';
import { createActivityLog } from './activityLog.service';
import type { AddOrgMemberInput, AddTenantMemberInput } from './organization.service';

// ─────────────────────────────────────────────────────────────────────────────
// ORGANIZATION MEMBERSHIPS
// ─────────────────────────────────────────────────────────────────────────────

export async function addOrgMember(
  organizationId: string,
  input: AddOrgMemberInput,
  actorId: string
) {
  // 1. Verify actor is ORG_ADMIN
  const actorMembership = await prisma.membership.findFirst({
    where: {
      userId: actorId,
      organizationId,
      role: MembershipRole.ORG_ADMIN,
      scope: MembershipScope.ORGANIZATION,
    },
  });

  if (!actorMembership) {
    throw new ForbiddenError('Only organization admins can add organization members');
  }

  // 2. Prevent self-privilege manipulation
  if (input.userId === actorId) {
    throw new ForbiddenError('Cannot modify your own membership role');
  }

  // 3. Verify target user exists
  const targetUser = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!targetUser) {
    throw new NotFoundError('User');
  }

  // 4. Check for duplicate membership
  const existing = await prisma.membership.findFirst({
    where: {
      userId: input.userId,
      organizationId,
      scope: MembershipScope.ORGANIZATION,
    },
  });

  if (existing) {
    throw new ConflictError('User is already a member of this organization');
  }

  return prisma.membership.create({
    data: {
      userId: input.userId,
      organizationId,
      role: input.role,
      scope: MembershipScope.ORGANIZATION,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      },
    },
  });
}

export async function listOrgMembers(organizationId: string) {
  return prisma.membership.findMany({
    where: { organizationId, scope: MembershipScope.ORGANIZATION },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
}

export async function updateOrgMemberRole(
  organizationId: string,
  membershipId: string,
  newRole: MembershipRole,
  actorId: string
) {
  // 1. Verify actor is ORG_ADMIN
  const actorMembership = await prisma.membership.findFirst({
    where: {
      userId: actorId,
      organizationId,
      role: MembershipRole.ORG_ADMIN,
      scope: MembershipScope.ORGANIZATION,
    },
  });

  if (!actorMembership) {
    throw new ForbiddenError('Only organization admins can update organization roles');
  }

  // 2. Target membership must exist and belong to this org
  const targetMembership = await prisma.membership.findFirst({
    where: { id: membershipId, organizationId, scope: MembershipScope.ORGANIZATION },
  });

  if (!targetMembership) {
    throw new NotFoundError('Membership');
  }

  // 3. Prevent self-demotion / privilege escalation
  if (targetMembership.userId === actorId) {
    throw new ForbiddenError('Cannot change your own role');
  }

  // 4. Protect the last ORG_ADMIN
  if (targetMembership.role === MembershipRole.ORG_ADMIN && newRole !== MembershipRole.ORG_ADMIN) {
    const adminCount = await prisma.membership.count({
      where: {
        organizationId,
        role: MembershipRole.ORG_ADMIN,
        scope: MembershipScope.ORGANIZATION,
      },
    });

    if (adminCount <= 1) {
      throw new ForbiddenError('Cannot demote the last organization administrator');
    }
  }

  return prisma.membership.update({
    where: { id: membershipId },
    data: { role: newRole },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      },
    },
  });
}

export async function removeOrgMember(
  organizationId: string,
  membershipId: string,
  actorId: string
) {
  // 1. Verify actor is ORG_ADMIN
  const actorMembership = await prisma.membership.findFirst({
    where: {
      userId: actorId,
      organizationId,
      role: MembershipRole.ORG_ADMIN,
      scope: MembershipScope.ORGANIZATION,
    },
  });

  if (!actorMembership) {
    throw new ForbiddenError('Only organization admins can remove members');
  }

  const targetMembership = await prisma.membership.findFirst({
    where: { id: membershipId, organizationId, scope: MembershipScope.ORGANIZATION },
  });

  if (!targetMembership) {
    throw new NotFoundError('Membership');
  }

  // Prevent self removal
  if (targetMembership.userId === actorId) {
    throw new ForbiddenError('Cannot remove yourself from the organization');
  }

  // Protect the last ORG_ADMIN
  if (targetMembership.role === MembershipRole.ORG_ADMIN) {
    const adminCount = await prisma.membership.count({
      where: {
        organizationId,
        role: MembershipRole.ORG_ADMIN,
        scope: MembershipScope.ORGANIZATION,
      },
    });

    if (adminCount <= 1) {
      throw new ForbiddenError('Cannot remove the last organization administrator');
    }
  }

  // Removing from org also cascades to remove their tenant memberships in that org
  return prisma.$transaction(async (tx) => {
    await tx.membership.deleteMany({
      where: {
        userId: targetMembership.userId,
        organizationId,
        scope: MembershipScope.TENANT,
      },
    });

    return tx.membership.delete({
      where: { id: membershipId },
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TENANT / WORKSPACE MEMBERSHIPS
// ─────────────────────────────────────────────────────────────────────────────

export async function addTenantMember(
  tenantId: string,
  input: AddTenantMemberInput,
  actorId: string
) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    throw new NotFoundError('Workspace');
  }

  // Verify actor is ORG_ADMIN or TENANT_ADMIN
  const actorMembership = await prisma.membership.findFirst({
    where: {
      userId: actorId,
      organizationId: tenant.organizationId,
      OR: [
        { scope: MembershipScope.ORGANIZATION, role: MembershipRole.ORG_ADMIN },
        { scope: MembershipScope.TENANT, tenantId, role: MembershipRole.TENANT_ADMIN },
      ],
    },
  });

  if (!actorMembership) {
    throw new ForbiddenError('Only workspace or organization admins can add members');
  }

  // User must exist
  const targetUser = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!targetUser) {
    throw new NotFoundError('User');
  }

  // User must already belong to the parent organization
  const orgMembership = await prisma.membership.findFirst({
    where: {
      userId: input.userId,
      organizationId: tenant.organizationId,
      scope: MembershipScope.ORGANIZATION,
    },
  });

  if (!orgMembership) {
    throw new ForbiddenError('User must be a member of the organization before joining a workspace');
  }

  // Check duplicate
  const existing = await prisma.membership.findFirst({
    where: {
      userId: input.userId,
      tenantId,
      scope: MembershipScope.TENANT,
    },
  });

  if (existing) {
    throw new ConflictError('User is already a member of this workspace');
  }

  return prisma.$transaction(async (tx) => {
    const membership = await tx.membership.create({
      data: {
        userId: input.userId,
        organizationId: tenant.organizationId,
        tenantId,
        role: input.role,
        scope: MembershipScope.TENANT,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    await createActivityLog(
      {
        tenantId,
        actorId,
        action: 'member.added',
        entityType: 'Membership',
        entityId: membership.id,
        metadata: { addedUserId: input.userId, role: input.role },
      },
      tx
    );

    return membership;
  });
}

export async function listTenantMembers(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    throw new NotFoundError('Workspace');
  }

  return prisma.membership.findMany({
    where: { tenantId, scope: MembershipScope.TENANT },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
}

export async function updateTenantMemberRole(
  tenantId: string,
  membershipId: string,
  newRole: MembershipRole,
  actorId: string
) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    throw new NotFoundError('Workspace');
  }

  // Tenant role cannot be ORG_ADMIN
  if (newRole === MembershipRole.ORG_ADMIN) {
    throw new ForbiddenError('Cannot assign ORG_ADMIN at workspace level');
  }

  // Verify actor has admin rights in this tenant
  const actorMembership = await prisma.membership.findFirst({
    where: {
      userId: actorId,
      organizationId: tenant.organizationId,
      OR: [
        { scope: MembershipScope.ORGANIZATION, role: MembershipRole.ORG_ADMIN },
        { scope: MembershipScope.TENANT, tenantId, role: MembershipRole.TENANT_ADMIN },
      ],
    },
  });

  if (!actorMembership) {
    throw new ForbiddenError('Only workspace admins or organization admins can update workspace roles');
  }

  const target = await prisma.membership.findFirst({
    where: { id: membershipId, tenantId, scope: MembershipScope.TENANT },
  });

  if (!target) {
    throw new NotFoundError('Membership');
  }

  if (target.userId === actorId) {
    throw new ForbiddenError('Cannot change your own role');
  }

  // Protect last TENANT_ADMIN
  if (target.role === MembershipRole.TENANT_ADMIN && newRole !== MembershipRole.TENANT_ADMIN) {
    const adminCount = await prisma.membership.count({
      where: { tenantId, role: MembershipRole.TENANT_ADMIN, scope: MembershipScope.TENANT },
    });
    if (adminCount <= 1) {
      throw new ForbiddenError('Cannot demote the last workspace administrator');
    }
  }

  const updated = await prisma.membership.update({
    where: { id: membershipId },
    data: { role: newRole },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      },
    },
  });

  await createActivityLog({
    tenantId,
    actorId,
    action: 'member.role_updated',
    entityType: 'Membership',
    entityId: membershipId,
    metadata: { targetUserId: target.userId, newRole },
  });

  return updated;
}

export async function removeTenantMember(
  tenantId: string,
  membershipId: string,
  actorId: string
) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    throw new NotFoundError('Workspace');
  }

  // Verify actor admin access
  const actorMembership = await prisma.membership.findFirst({
    where: {
      userId: actorId,
      organizationId: tenant.organizationId,
      OR: [
        { scope: MembershipScope.ORGANIZATION, role: MembershipRole.ORG_ADMIN },
        { scope: MembershipScope.TENANT, tenantId, role: MembershipRole.TENANT_ADMIN },
      ],
    },
  });

  if (!actorMembership) {
    throw new ForbiddenError('Only workspace admins or organization admins can remove workspace members');
  }

  const target = await prisma.membership.findFirst({
    where: { id: membershipId, tenantId, scope: MembershipScope.TENANT },
  });

  if (!target) {
    throw new NotFoundError('Membership');
  }

  if (target.userId === actorId) {
    throw new ForbiddenError('Cannot remove yourself from the workspace');
  }

  // Protect last TENANT_ADMIN
  if (target.role === MembershipRole.TENANT_ADMIN) {
    const adminCount = await prisma.membership.count({
      where: { tenantId, role: MembershipRole.TENANT_ADMIN, scope: MembershipScope.TENANT },
    });
    if (adminCount <= 1) {
      throw new ForbiddenError('Cannot remove the last workspace administrator');
    }
  }

  await createActivityLog({
    tenantId,
    actorId,
    action: 'member.removed',
    entityType: 'Membership',
    entityId: membershipId,
    metadata: { removedUserId: target.userId },
  });

  return prisma.membership.delete({
    where: { id: membershipId },
  });
}
