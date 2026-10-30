import { Request, Response } from 'express';
import * as orgService from '../services/organization.service';
import * as membershipService from '../services/membership.service';
import * as activityLogService from '../services/activityLog.service';
import { sendSuccess, sendCreated } from '../utils/apiResponse';

// ─── Organizations ────────────────────────────────────────────────────────────

export async function createOrganization(req: Request, res: Response): Promise<void> {
  const organization = await orgService.createOrganization(req.body, req.user!.id);
  sendCreated(res, { organization }, 'Organization created successfully');
}

export async function listOrganizations(req: Request, res: Response): Promise<void> {
  const organizations = await orgService.listOrganizationsForUser(req.user!.id);
  sendSuccess(res, { organizations });
}

export async function getOrganization(req: Request, res: Response): Promise<void> {
  const organizationId = req.params.organizationId as string;
  const organization = await orgService.getOrganizationById(organizationId, req.user!.id);
  sendSuccess(res, { organization });
}

export async function updateOrganization(req: Request, res: Response): Promise<void> {
  const organizationId = req.params.organizationId as string;
  const organization = await orgService.updateOrganization(organizationId, req.body, req.user!.id);
  sendSuccess(res, { organization }, 'Organization updated successfully');
}

export async function deleteOrganization(req: Request, res: Response): Promise<void> {
  const organizationId = req.params.organizationId as string;
  await orgService.deleteOrganization(organizationId, req.user!.id);
  sendSuccess(res, null, 'Organization deleted successfully');
}

// ─── Tenants ──────────────────────────────────────────────────────────────────

export async function createTenant(req: Request, res: Response): Promise<void> {
  const organizationId = req.params.organizationId as string;
  const tenant = await orgService.createTenant(organizationId, req.body, req.user!.id);
  sendCreated(res, { tenant }, 'Workspace created successfully');
}

export async function listTenants(req: Request, res: Response): Promise<void> {
  const organizationId = req.params.organizationId as string;
  const tenants = await orgService.listTenantsForUser(req.user!.id, organizationId);
  sendSuccess(res, { tenants });
}

export async function getTenant(req: Request, res: Response): Promise<void> {
  const tenantId = req.params.tenantId as string;
  const tenant = await orgService.getTenantById(tenantId, req.user!.id);
  sendSuccess(res, { tenant });
}

export async function updateTenant(req: Request, res: Response): Promise<void> {
  const tenantId = req.params.tenantId as string;
  const tenant = await orgService.updateTenant(tenantId, req.body, req.user!.id);
  sendSuccess(res, { tenant }, 'Workspace updated successfully');
}

export async function deleteTenant(req: Request, res: Response): Promise<void> {
  const tenantId = req.params.tenantId as string;
  await orgService.deleteTenant(tenantId, req.user!.id);
  sendSuccess(res, null, 'Workspace deleted successfully');
}

// ─── Organization Memberships ─────────────────────────────────────────────────

export async function addOrgMember(req: Request, res: Response): Promise<void> {
  const organizationId = req.params.organizationId as string;
  const membership = await membershipService.addOrgMember(organizationId, req.body, req.user!.id);
  sendCreated(res, { membership }, 'Member added to organization');
}

export async function listOrgMembers(req: Request, res: Response): Promise<void> {
  const organizationId = req.params.organizationId as string;
  const members = await membershipService.listOrgMembers(organizationId);
  sendSuccess(res, { members });
}

export async function updateOrgMemberRole(req: Request, res: Response): Promise<void> {
  const organizationId = req.params.organizationId as string;
  const membershipId = req.params.membershipId as string;
  const membership = await membershipService.updateOrgMemberRole(
    organizationId,
    membershipId,
    req.body.role,
    req.user!.id
  );
  sendSuccess(res, { membership }, 'Member role updated successfully');
}

export async function removeOrgMember(req: Request, res: Response): Promise<void> {
  const organizationId = req.params.organizationId as string;
  const membershipId = req.params.membershipId as string;
  await membershipService.removeOrgMember(organizationId, membershipId, req.user!.id);
  sendSuccess(res, null, 'Member removed from organization');
}

// ─── Tenant Memberships ───────────────────────────────────────────────────────

export async function addTenantMember(req: Request, res: Response): Promise<void> {
  const tenantId = req.params.tenantId as string;
  const membership = await membershipService.addTenantMember(tenantId, req.body, req.user!.id);
  sendCreated(res, { membership }, 'Member added to workspace');
}

export async function listTenantMembers(req: Request, res: Response): Promise<void> {
  const tenantId = req.params.tenantId as string;
  const members = await membershipService.listTenantMembers(tenantId);
  sendSuccess(res, { members });
}

export async function updateTenantMemberRole(req: Request, res: Response): Promise<void> {
  const tenantId = req.params.tenantId as string;
  const membershipId = req.params.membershipId as string;
  const membership = await membershipService.updateTenantMemberRole(
    tenantId,
    membershipId,
    req.body.role,
    req.user!.id
  );
  sendSuccess(res, { membership }, 'Workspace member role updated');
}

export async function removeTenantMember(req: Request, res: Response): Promise<void> {
  const tenantId = req.params.tenantId as string;
  const membershipId = req.params.membershipId as string;
  await membershipService.removeTenantMember(tenantId, membershipId, req.user!.id);
  sendSuccess(res, null, 'Member removed from workspace');
}

// ─── Activity Logs ────────────────────────────────────────────────────────────

export async function listActivityLogs(req: Request, res: Response): Promise<void> {
  const tenantId = req.params.tenantId as string;
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

  const result = await activityLogService.listActivityLogsForTenant(tenantId, { page, limit });
  sendSuccess(res, result);
}
