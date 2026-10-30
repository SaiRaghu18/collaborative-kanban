import { Router } from 'express';
import * as orgController from '../controllers/organization.controller';
import { authenticate } from '../middleware/authenticate';
import { requireOrgAccess, requireOrgRole } from '../middleware/authorization';
import { validate } from '../middleware/validate';
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  createTenantSchema,
  addOrgMemberSchema,
  updateOrgMemberRoleSchema,
} from '../validators/kanban.validator';
import { MembershipRole } from '@prisma/client';

const router = Router();

// All organization routes require authenticated user
router.use(authenticate);

// ─── Organizations CRUD ───────────────────────────────────────────────────────

// POST   /api/organizations
router.post(
  '/',
  validate(createOrganizationSchema),
  orgController.createOrganization
);

// GET    /api/organizations
router.get(
  '/',
  orgController.listOrganizations
);

// GET    /api/organizations/:organizationId
router.get(
  '/:organizationId',
  requireOrgAccess,
  orgController.getOrganization
);

// PATCH  /api/organizations/:organizationId
router.patch(
  '/:organizationId',
  requireOrgAccess,
  requireOrgRole(MembershipRole.ORG_ADMIN),
  validate(updateOrganizationSchema),
  orgController.updateOrganization
);

// DELETE /api/organizations/:organizationId
router.delete(
  '/:organizationId',
  requireOrgAccess,
  requireOrgRole(MembershipRole.ORG_ADMIN),
  orgController.deleteOrganization
);

// ─── Organization-Scoped Tenant Creation & Listing ───────────────────────────

// POST   /api/organizations/:organizationId/tenants
router.post(
  '/:organizationId/tenants',
  requireOrgAccess,
  requireOrgRole(MembershipRole.ORG_ADMIN),
  validate(createTenantSchema),
  orgController.createTenant
);

// GET    /api/organizations/:organizationId/tenants
router.get(
  '/:organizationId/tenants',
  requireOrgAccess,
  orgController.listTenants
);

// ─── Organization Memberships ─────────────────────────────────────────────────

// POST   /api/organizations/:organizationId/members
router.post(
  '/:organizationId/members',
  requireOrgAccess,
  requireOrgRole(MembershipRole.ORG_ADMIN),
  validate(addOrgMemberSchema),
  orgController.addOrgMember
);

// GET    /api/organizations/:organizationId/members
router.get(
  '/:organizationId/members',
  requireOrgAccess,
  orgController.listOrgMembers
);

// PATCH  /api/organizations/:organizationId/members/:membershipId
router.patch(
  '/:organizationId/members/:membershipId',
  requireOrgAccess,
  requireOrgRole(MembershipRole.ORG_ADMIN),
  validate(updateOrgMemberRoleSchema),
  orgController.updateOrgMemberRole
);

// DELETE /api/organizations/:organizationId/members/:membershipId
router.delete(
  '/:organizationId/members/:membershipId',
  requireOrgAccess,
  requireOrgRole(MembershipRole.ORG_ADMIN),
  orgController.removeOrgMember
);

export default router;
