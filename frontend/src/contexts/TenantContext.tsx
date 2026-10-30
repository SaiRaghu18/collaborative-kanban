import React, { createContext, useContext, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as orgService from '@/services/organization.service';
import type { Organization, Tenant } from '@/types';

interface TenantContextType {
  selectedOrg: Organization | null;
  selectedTenant: Tenant | null;
  setSelectedOrg: (org: Organization | null) => void;
  setSelectedTenant: (tenant: Tenant | null) => void;
  organizations: Organization[];
  tenants: Tenant[];
  isLoadingOrgs: boolean;
  isLoadingTenants: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(() => {
    const saved = localStorage.getItem('kanban_selected_org');
    return saved ? JSON.parse(saved) : null;
  });

  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(() => {
    const saved = localStorage.getItem('kanban_selected_tenant');
    return saved ? JSON.parse(saved) : null;
  });

  // Fetch organizations user belongs to
  const { data: organizations = [], isLoading: isLoadingOrgs } = useQuery({
    queryKey: ['organizations'],
    queryFn: orgService.listOrganizations,
  });

  // If no selected org, default to the first one available
  useEffect(() => {
    if (!selectedOrg && organizations.length > 0) {
      setSelectedOrg(organizations[0]);
    } else if (selectedOrg && !organizations.some((o) => o.id === selectedOrg.id) && organizations.length > 0) {
      // If current selected org was deleted or user lost access
      setSelectedOrg(organizations[0]);
    }
  }, [organizations, selectedOrg]);

  // Save selected org in localStorage
  useEffect(() => {
    if (selectedOrg) {
      localStorage.setItem('kanban_selected_org', JSON.stringify(selectedOrg));
    } else {
      localStorage.removeItem('kanban_selected_org');
    }
  }, [selectedOrg]);

  // Fetch tenants for the selected org
  const { data: tenants = [], isLoading: isLoadingTenants } = useQuery({
    queryKey: ['tenants', selectedOrg?.id],
    queryFn: () => (selectedOrg ? orgService.listTenants(selectedOrg.id) : Promise.resolve([])),
    enabled: !!selectedOrg?.id,
  });

  // If no selected tenant or selected tenant doesn't belong to current org, default to first
  useEffect(() => {
    if (tenants.length > 0) {
      if (!selectedTenant || !tenants.some((t) => t.id === selectedTenant.id)) {
        setSelectedTenant(tenants[0]);
      }
    } else {
      setSelectedTenant(null);
    }
  }, [tenants, selectedTenant]);

  // Save selected tenant in localStorage
  useEffect(() => {
    if (selectedTenant) {
      localStorage.setItem('kanban_selected_tenant', JSON.stringify(selectedTenant));
    } else {
      localStorage.removeItem('kanban_selected_tenant');
    }
  }, [selectedTenant]);

  const handleSelectOrg = (org: Organization | null) => {
    setSelectedOrg(org);
    setSelectedTenant(null); // Clear selected tenant when switching organization
  };

  return (
    <TenantContext.Provider
      value={{
        selectedOrg,
        selectedTenant,
        setSelectedOrg: handleSelectOrg,
        setSelectedTenant,
        organizations,
        tenants,
        isLoadingOrgs,
        isLoadingTenants,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}
