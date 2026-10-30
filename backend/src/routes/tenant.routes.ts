import { Router } from 'express';
import * as orgController from '../controllers/organization.controller';
import * as kanbanController from '../controllers/kanban.controller';
import { authenticate } from '../middleware/authenticate';
import { requireTenantAccess, requireTenantRole } from '../middleware/authorization';
import { validate } from '../middleware/validate';
import {
  updateTenantSchema,
  addTenantMemberSchema,
  updateTenantMemberRoleSchema,
  createBoardSchema,
} from '../validators/kanban.validator';
import { MembershipRole } from '@prisma/client';

const router = Router();

router.use(authenticate);

// ─── Tenant Details & Modification ────────────────────────────────────────────

// GET    /api/tenants/:tenantId
router.get(
  '/:tenantId',
  requireTenantAccess,
  orgController.getTenant
);

// PATCH  /api/tenants/:tenantId
router.patch(
  '/:tenantId',
  requireTenantAccess,
  requireTenantRole(MembershipRole.TENANT_ADMIN),
  validate(updateTenantSchema),
  orgController.updateTenant
);

// DELETE /api/tenants/:tenantId
router.delete(
  '/:tenantId',
  requireTenantAccess,
  requireTenantRole(MembershipRole.ORG_ADMIN), // Only Org Admin can permanently delete a tenant
  orgController.deleteTenant
);

// ─── Tenant Memberships ───────────────────────────────────────────────────────

// POST   /api/tenants/:tenantId/members
router.post(
  '/:tenantId/members',
  requireTenantAccess,
  requireTenantRole(MembershipRole.TENANT_ADMIN),
  validate(addTenantMemberSchema),
  orgController.addTenantMember
);

// GET    /api/tenants/:tenantId/members
router.get(
  '/:tenantId/members',
  requireTenantAccess,
  orgController.listTenantMembers
);

// PATCH  /api/tenants/:tenantId/members/:membershipId
router.patch(
  '/:tenantId/members/:membershipId',
  requireTenantAccess,
  requireTenantRole(MembershipRole.TENANT_ADMIN),
  validate(updateTenantMemberRoleSchema),
  orgController.updateTenantMemberRole
);

// DELETE /api/tenants/:tenantId/members/:membershipId
router.delete(
  '/:tenantId/members/:membershipId',
  requireTenantAccess,
  requireTenantRole(MembershipRole.TENANT_ADMIN),
  orgController.removeTenantMember
);

// ─── Tenant-Scoped Boards ─────────────────────────────────────────────────────

// POST   /api/tenants/:tenantId/boards
router.post(
  '/:tenantId/boards',
  requireTenantAccess,
  validate(createBoardSchema),
  kanbanController.createBoard
);

// GET    /api/tenants/:tenantId/boards
router.get(
  '/:tenantId/boards',
  requireTenantAccess,
  kanbanController.listBoards
);

// ─── Tenant Activity Logs ─────────────────────────────────────────────────────

// GET    /api/tenants/:tenantId/activity-logs
router.get(
  '/:tenantId/activity-logs',
  requireTenantAccess,
  orgController.listActivityLogs
);

export default router;
