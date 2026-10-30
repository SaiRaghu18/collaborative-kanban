import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { MembershipRole, MembershipScope } from '@prisma/client';
import { sendForbidden, sendNotFound } from '../utils/apiResponse';

/**
 * Ensures authenticated user is attached to req.user.
 */
function checkUserAuth(req: Request, res: Response): string | null {
  const userId = req.user?.id;
  if (!userId) {
    sendForbidden(res, 'Authentication required');
    return null;
  }
  return userId;
}

/**
 * Verifies that the authenticated user has access to req.params.organizationId.
 */
export async function requireOrgAccess(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = checkUserAuth(req, res);
  if (!userId) return;

  const organizationId = req.params.organizationId as string;
  if (!organizationId) {
    sendForbidden(res, 'Organization ID required');
    return;
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId,
      organizationId,
      scope: MembershipScope.ORGANIZATION,
    },
    include: { organization: true },
  });

  if (!membership) {
    sendNotFound(res, 'Organization');
    return;
  }

  (req as Request & { orgMembership?: typeof membership }).orgMembership = membership;
  next();
}

/**
 * Verifies that the authenticated user has access to the tenant (workspace).
 * Accepts tenantId from req.params.tenantId or req.body.tenantId.
 * Permits access if user is ORG_ADMIN of parent organization OR explicit tenant member.
 */
export async function requireTenantAccess(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = checkUserAuth(req, res);
  if (!userId) return;

  const tenantId = (req.params.tenantId || req.body?.tenantId) as string;
  if (!tenantId) {
    sendForbidden(res, 'Tenant context required');
    return;
  }

  // 1. Fetch tenant to know its parent organization
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  if (!tenant) {
    sendNotFound(res, 'Workspace');
    return;
  }

  // 2. If organizationId is also in params, verify tenant belongs to that org (prevent cross-org access)
  const orgParam = req.params.organizationId as string;
  if (orgParam && tenant.organizationId !== orgParam) {
    sendNotFound(res, 'Workspace');
    return;
  }

  // 3. Check if user is ORG_ADMIN in the tenant's parent org
  const orgAdminMembership = await prisma.membership.findFirst({
    where: {
      userId,
      organizationId: tenant.organizationId,
      role: MembershipRole.ORG_ADMIN,
      scope: MembershipScope.ORGANIZATION,
    },
  });

  if (orgAdminMembership) {
    (req as Request & { tenantContext?: typeof tenant }).tenantContext = tenant;
    next();
    return;
  }

  // 4. Check explicit tenant membership
  const tenantMembership = await prisma.membership.findFirst({
    where: {
      userId,
      tenantId: tenant.id,
      scope: MembershipScope.TENANT,
    },
  });

  if (!tenantMembership) {
    sendForbidden(res, 'You do not have access to this workspace');
    return;
  }

  (req as Request & { tenantContext?: typeof tenant }).tenantContext = tenant;
  next();
}

/**
 * Verifies user has access to req.params.boardId.
 * Resolves the board -> tenant -> verifies user has access to that tenant.
 * Attaches board & tenant to req for downstream usage.
 */
export async function requireBoardAccess(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = checkUserAuth(req, res);
  if (!userId) return;

  const boardId = req.params.boardId as string;
  if (!boardId) {
    sendForbidden(res, 'Board ID required');
    return;
  }

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: { tenant: true },
  });

  if (!board) {
    sendNotFound(res, 'Board');
    return;
  }

  // Check tenant access for this board's tenant
  const isOrgAdmin = await prisma.membership.findFirst({
    where: {
      userId,
      organizationId: board.tenant.organizationId,
      role: MembershipRole.ORG_ADMIN,
      scope: MembershipScope.ORGANIZATION,
    },
  });

  if (isOrgAdmin) {
    (req as Request & { boardContext?: typeof board }).boardContext = board;
    next();
    return;
  }

  const tenantMember = await prisma.membership.findFirst({
    where: {
      userId,
      tenantId: board.tenantId,
      scope: MembershipScope.TENANT,
    },
  });

  if (!tenantMember) {
    sendForbidden(res, 'You do not have access to this board');
    return;
  }

  (req as Request & { boardContext?: typeof board }).boardContext = board;
  next();
}

/**
 * Verifies user has access to req.params.columnId.
 * Resolves column -> board -> tenant -> verifies user has tenant access.
 */
export async function requireColumnAccess(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = checkUserAuth(req, res);
  if (!userId) return;

  const columnId = req.params.columnId as string;
  if (!columnId) {
    sendForbidden(res, 'Column ID required');
    return;
  }

  const column = await prisma.column.findUnique({
    where: { id: columnId },
    include: {
      board: {
        include: { tenant: true },
      },
    },
  });

  if (!column) {
    sendNotFound(res, 'Column');
    return;
  }

  const tenant = column.board.tenant;
  const isOrgAdmin = await prisma.membership.findFirst({
    where: {
      userId,
      organizationId: tenant.organizationId,
      role: MembershipRole.ORG_ADMIN,
      scope: MembershipScope.ORGANIZATION,
    },
  });

  if (isOrgAdmin) {
    (req as Request & { columnContext?: typeof column }).columnContext = column;
    next();
    return;
  }

  const tenantMember = await prisma.membership.findFirst({
    where: {
      userId,
      tenantId: tenant.id,
      scope: MembershipScope.TENANT,
    },
  });

  if (!tenantMember) {
    sendForbidden(res, 'You do not have access to this column');
    return;
  }

  (req as Request & { columnContext?: typeof column }).columnContext = column;
  next();
}

/**
 * Verifies user has access to req.params.taskId.
 * Resolves task -> tenant -> verifies user has tenant access.
 */
export async function requireTaskAccess(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = checkUserAuth(req, res);
  if (!userId) return;

  const taskId = req.params.taskId as string;
  if (!taskId) {
    sendForbidden(res, 'Task ID required');
    return;
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      column: {
        include: { board: true },
      },
      tenant: true,
    },
  });

  if (!task) {
    sendNotFound(res, 'Task');
    return;
  }

  const isOrgAdmin = await prisma.membership.findFirst({
    where: {
      userId,
      organizationId: task.tenant.organizationId,
      role: MembershipRole.ORG_ADMIN,
      scope: MembershipScope.ORGANIZATION,
    },
  });

  if (isOrgAdmin) {
    (req as Request & { taskContext?: typeof task }).taskContext = task;
    next();
    return;
  }

  const tenantMember = await prisma.membership.findFirst({
    where: {
      userId,
      tenantId: task.tenantId,
      scope: MembershipScope.TENANT,
    },
  });

  if (!tenantMember) {
    sendForbidden(res, 'You do not have access to this task');
    return;
  }

  (req as Request & { taskContext?: typeof task }).taskContext = task;
  next();
}

/**
 * Role-check factory: requires user to hold one of the specified roles in the organization.
 */
export function requireOrgRole(...allowedRoles: MembershipRole[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = checkUserAuth(req, res);
    if (!userId) return;

    const organizationId = req.params.organizationId as string;
    if (!organizationId) {
      sendForbidden(res, 'Organization ID required');
      return;
    }

    const membership = await prisma.membership.findFirst({
      where: {
        userId,
        organizationId,
        scope: MembershipScope.ORGANIZATION,
        role: { in: allowedRoles },
      },
    });

    if (!membership) {
      sendForbidden(res, 'Insufficient permissions in this organization');
      return;
    }

    next();
  };
}

/**
 * Role-check factory: requires user to hold one of the specified roles in the tenant.
 * Note: ORG_ADMINs automatically qualify.
 */
export function requireTenantRole(...allowedRoles: MembershipRole[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = checkUserAuth(req, res);
    if (!userId) return;

    const tenantId = (req.params.tenantId || req.body?.tenantId) as string;
    if (!tenantId) {
      sendForbidden(res, 'Tenant context required');
      return;
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      sendNotFound(res, 'Workspace');
      return;
    }

    // ORG_ADMIN always passes
    const orgAdmin = await prisma.membership.findFirst({
      where: {
        userId,
        organizationId: tenant.organizationId,
        role: MembershipRole.ORG_ADMIN,
        scope: MembershipScope.ORGANIZATION,
      },
    });

    if (orgAdmin) {
      next();
      return;
    }

    const tenantMember = await prisma.membership.findFirst({
      where: {
        userId,
        tenantId,
        scope: MembershipScope.TENANT,
        role: { in: allowedRoles },
      },
    });

    if (!tenantMember) {
      sendForbidden(res, 'Insufficient permissions in this workspace');
      return;
    }

    next();
  };
}
