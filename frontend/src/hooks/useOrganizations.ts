import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as orgService from '@/services/organization.service';
import type { CreateOrganizationInput, CreateTenantInput } from '@/types';

// ─── Query Keys ───────────────────────────────────────────────────────────────
export const orgKeys = {
  all: ['organizations'] as const,
  detail: (id: string) => ['organizations', id] as const,
  tenants: (orgId: string) => ['organizations', orgId, 'tenants'] as const,
  tenant: (orgId: string, tenantId: string) =>
    ['organizations', orgId, 'tenants', tenantId] as const,
  orgMembers: (orgId: string) => ['organizations', orgId, 'members'] as const,
  tenantMembers: (orgId: string, tenantId: string) =>
    ['organizations', orgId, 'tenants', tenantId, 'members'] as const,
};

// ─── Organizations ────────────────────────────────────────────────────────────

export function useOrganizations() {
  return useQuery({
    queryKey: orgKeys.all,
    queryFn: orgService.listOrganizations,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useOrganization(orgId: string) {
  return useQuery({
    queryKey: orgKeys.detail(orgId),
    queryFn: () => orgService.getOrganization(orgId),
    enabled: !!orgId,
  });
}

export function useCreateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOrganizationInput) =>
      orgService.createOrganization(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orgKeys.all });
    },
  });
}

// ─── Tenants ──────────────────────────────────────────────────────────────────

export function useTenants(orgId: string) {
  return useQuery({
    queryKey: orgKeys.tenants(orgId),
    queryFn: () => orgService.listTenants(orgId),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateTenant(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTenantInput) => orgService.createTenant(orgId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orgKeys.tenants(orgId) });
    },
  });
}

// ─── Members ──────────────────────────────────────────────────────────────────

export function useOrgMembers(orgId: string) {
  return useQuery({
    queryKey: orgKeys.orgMembers(orgId),
    queryFn: () => orgService.listOrgMembers(orgId),
    enabled: !!orgId,
  });
}

export function useTenantMembers(orgId: string, tenantId: string) {
  return useQuery({
    queryKey: orgKeys.tenantMembers(orgId, tenantId),
    queryFn: () => orgService.listTenantMembers(orgId, tenantId),
    enabled: !!orgId && !!tenantId,
  });
}
