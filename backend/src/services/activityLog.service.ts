import { prisma } from '../config/database';
import { Prisma } from '@prisma/client';
import { broadcastToTenant } from '../config/socket';

export interface CreateActivityLogParams {
  tenantId: string;
  actorId: string;
  action: string;
  entityType: 'Organization' | 'Tenant' | 'Membership' | 'Board' | 'Column' | 'Task';
  entityId: string;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Creates an activity log entry inside an optional transaction.
 * If tx is provided, it participates in that transaction to ensure atomicity.
 */
export async function createActivityLog(
  params: CreateActivityLogParams,
  tx?: Prisma.TransactionClient
) {
  const client = tx || prisma;
  const log = await client.activityLog.create({
    data: {
      tenantId: params.tenantId,
      actorId: params.actorId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metadata: params.metadata ?? Prisma.JsonNull,
    },
    include: {
      actor: {
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

  // If not inside an outer caller transaction, broadcast immediately.
  // Otherwise, caller services broadcast via broadcastActivity after tx commits.
  if (!tx) {
    broadcastToTenant(params.tenantId, 'activity:created', log);
  }

  return log;
}

/**
 * Broadcasts an activity log to the authorized tenant room after a transaction commits.
 */
export function broadcastActivity(tenantId: string, log: unknown): void {
  broadcastToTenant(tenantId, 'activity:created', log);
}

/**
 * Retrieves activity logs for an authorized tenant, sorted newest first with pagination.
 */
export async function listActivityLogsForTenant(
  tenantId: string,
  options: { page?: number; limit?: number } = {}
) {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || 20));
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where: { tenantId },
      include: {
        actor: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.activityLog.count({
      where: { tenantId },
    }),
  ]);

  return {
    logs,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + logs.length < total,
    },
  };
}
