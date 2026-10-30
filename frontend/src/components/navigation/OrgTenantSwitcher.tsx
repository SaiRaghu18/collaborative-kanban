import React, { useState } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { Building2, Layers, Check, ChevronDown, Plus } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export function OrgTenantSwitcher() {
  const {
    selectedOrg,
    selectedTenant,
    setSelectedOrg,
    setSelectedTenant,
    organizations,
    tenants,
  } = useTenant();
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-2">
      {/* ── Organization Dropdown ────────────────────────────────────────── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-3 gap-2 bg-card/60 border-border text-foreground hover:bg-accent max-w-[160px] md:max-w-[200px]"
            id="org-switcher-button"
          >
            <Building2 className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate font-medium text-xs">
              {selectedOrg ? selectedOrg.name : 'Select Org'}
            </span>
            <ChevronDown className="h-3 w-3 opacity-60 ml-auto shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">
            Organizations
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {organizations.map((org) => {
            const isSelected = selectedOrg?.id === org.id;
            return (
              <DropdownMenuItem
                key={org.id}
                onClick={() => setSelectedOrg(org)}
                className="flex items-center justify-between text-xs cursor-pointer"
              >
                <span className="truncate font-medium">{org.name}</span>
                {isSelected && <Check className="h-4 w-4 text-primary ml-2 shrink-0" />}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => navigate('/dashboard/organizations')}
            className="gap-2 text-xs text-primary font-medium cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Manage Organizations
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <span className="text-muted-foreground/40 text-xs">/</span>

      {/* ── Workspace / Tenant Dropdown ──────────────────────────────────── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-3 gap-2 bg-card/60 border-border text-foreground hover:bg-accent max-w-[160px] md:max-w-[200px]"
            id="tenant-switcher-button"
            disabled={!selectedOrg || tenants.length === 0}
          >
            <Layers className="h-4 w-4 text-indigo-400 shrink-0" />
            <span className="truncate font-medium text-xs">
              {selectedTenant ? selectedTenant.name : 'Select Workspace'}
            </span>
            <ChevronDown className="h-3 w-3 opacity-60 ml-auto shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">
            Workspaces ({selectedOrg?.name})
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {tenants.map((tenant) => {
            const isSelected = selectedTenant?.id === tenant.id;
            return (
              <DropdownMenuItem
                key={tenant.id}
                onClick={() => setSelectedTenant(tenant)}
                className="flex items-center justify-between text-xs cursor-pointer"
              >
                <span className="truncate font-medium">{tenant.name}</span>
                {isSelected && <Check className="h-4 w-4 text-primary ml-2 shrink-0" />}
              </DropdownMenuItem>
            );
          })}
          {tenants.length === 0 && (
            <div className="py-2 px-3 text-xs text-muted-foreground">
              No workspaces found.
            </div>
          )}
          {selectedOrg && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => navigate(`/dashboard/organizations/${selectedOrg.id}`)}
                className="gap-2 text-xs text-primary font-medium cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Workspace
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
