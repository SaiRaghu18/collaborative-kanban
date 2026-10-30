import apiClient, { extractData } from '@/lib/apiClient';
import type {
  Organization,
  CreateOrganizationInput,
  Tenant,
  CreateTenantInput,
  Membership,
} from '@/types';

// ─── Organizations ────────────────────────────────────────────────────────────

export async function listOrganizations(): Promise<Organization[]> {
  const res = await apiClient.get('/organizations');
  const data = extractData<{ organizations: Organization[] }>(res);
  return data.organizations;
}

export async function getOrganization(orgId: string): Promise<Organization> {
  const res = await apiClient.get(`/organizations/${orgId}`);
  const data = extractData<{ organization: Organization }>(res);
  return data.organization;
}

export async function createOrganization(
  input: CreateOrganizationInput
): Promise<Organization> {
  const res = await apiClient.post('/organizations', input);
  const data = extractData<{ organization: Organization }>(res);
  return data.organization;
}

// ─── Tenants ──────────────────────────────────────────────────────────────────

export async function listTenants(orgId: string): Promise<Tenant[]> {
  const res = await apiClient.get(`/organizations/${orgId}/tenants`);
  const data = extractData<{ tenants: Tenant[] }>(res);
  return data.tenants;
}

export async function getTenant(orgId: string, tenantId: string): Promise<Tenant> {
  const res = await apiClient.get(`/organizations/${orgId}/tenants/${tenantId}`);
  const data = extractData<{ tenant: Tenant }>(res);
  return data.tenant;
}

export async function createTenant(
  orgId: string,
  input: CreateTenantInput
): Promise<Tenant> {
  const res = await apiClient.post(`/organizations/${orgId}/tenants`, input);
  const data = extractData<{ tenant: Tenant }>(res);
  return data.tenant;
}

// ─── Members ──────────────────────────────────────────────────────────────────

export async function listOrgMembers(orgId: string): Promise<Membership[]> {
  const res = await apiClient.get(`/organizations/${orgId}/members`);
  const data = extractData<{ members: Membership[] }>(res);
  return data.members;
}

export async function listTenantMembers(
  orgId: string,
  tenantId: string
): Promise<Membership[]> {
  const res = await apiClient.get(
    `/organizations/${orgId}/tenants/${tenantId}/members`
  );
  const data = extractData<{ members: Membership[] }>(res);
  return data.members;
}
