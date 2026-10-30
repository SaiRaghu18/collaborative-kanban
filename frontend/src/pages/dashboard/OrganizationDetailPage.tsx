import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Building2,
  Plus,
  X,
  Users,
  LayoutDashboard,
  ArrowLeft,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InlineError } from '@/components/common/ErrorStates';
import { CardSkeleton, LoadingSpinner } from '@/components/common/LoadingStates';
import { useOrganization, useTenants, useCreateTenant } from '@/hooks/useOrganizations';
import { toast } from '@/hooks/useToast';

const createTenantSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens'),
  description: z.string().max(500).optional(),
});

type CreateTenantForm = z.infer<typeof createTenantSchema>;

export default function OrganizationDetailPage() {
  const { organizationId = '' } = useParams<{ organizationId: string }>();
  const navigate = useNavigate();
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { data: org, isLoading: orgLoading } = useOrganization(organizationId);
  const { data: tenants, isLoading: tenantsLoading } = useTenants(organizationId);
  const createTenant = useCreateTenant(organizationId);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateTenantForm>({ resolver: zodResolver(createTenantSchema) });

  const onSubmit = async (data: CreateTenantForm) => {
    try {
      await createTenant.mutateAsync(data);
      toast({ title: 'Workspace created!', description: `"${data.name}" is ready.` });
      reset();
      setShowCreateForm(false);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      toast({
        title: 'Failed to create workspace',
        description: error?.response?.data?.error || 'Please try again',
        variant: 'destructive',
      });
    }
  };

  if (orgLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="h-8 w-48 skeleton rounded-lg" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <button
          onClick={() => navigate('/dashboard/organizations')}
          className="hover:text-foreground transition-colors flex items-center gap-1"
          id="back-to-organizations"
        >
          <ArrowLeft className="h-4 w-4" />
          Organizations
        </button>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium">{org?.name}</span>
      </nav>

      {/* Org header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl">
            {org?.name[0].toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{org?.name}</h1>
            {org?.description && (
              <p className="text-muted-foreground text-sm">{org.description}</p>
            )}
          </div>
        </div>
        <Button
          variant="gradient"
          onClick={() => setShowCreateForm(true)}
          id="create-workspace-button"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Workspace
        </Button>
      </div>

      {/* Create tenant form */}
      {showCreateForm && (
        <Card className="glass-card border-primary/30 glow animate-fade-in">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Create Workspace</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { setShowCreateForm(false); reset(); }}
                id="close-create-workspace-form"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CardDescription>
              Workspaces are team areas within your organization with their own boards.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" id="create-workspace-form">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tenant-name">Workspace name</Label>
                  <Input
                    id="tenant-name"
                    placeholder="Engineering"
                    {...register('name', {
                      onChange: (e) => {
                        const slug = e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, '-')
                          .replace(/^-|-$/g, '');
                        setValue('slug', slug, { shouldValidate: true });
                      },
                    })}
                  />
                  {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tenant-slug">URL slug</Label>
                  <Input id="tenant-slug" placeholder="engineering" {...register('slug')} />
                  {errors.slug && <p className="text-xs text-destructive">{errors.slug.message}</p>}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tenant-description">Description (optional)</Label>
                <Input id="tenant-description" placeholder="What does this team work on?" {...register('description')} />
              </div>
              {createTenant.error && (
                <InlineError message={(createTenant.error as {response?: {data?: {error?: string}}})?.response?.data?.error || 'Failed to create workspace'} />
              )}
              <div className="flex gap-3">
                <Button type="submit" id="submit-create-workspace" disabled={createTenant.isPending}>
                  {createTenant.isPending ? (
                    <><LoadingSpinner size="sm" className="mr-2" />Creating...</>
                  ) : 'Create Workspace'}
                </Button>
                <Button type="button" variant="ghost" onClick={() => { setShowCreateForm(false); reset(); }}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Workspaces */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5 text-primary" />
          Workspaces
          {tenants && (
            <span className="text-sm font-normal text-muted-foreground">({tenants.length})</span>
          )}
        </h2>

        {tenantsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2].map((i) => <CardSkeleton key={i} />)}
          </div>
        ) : tenants && tenants.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tenants.map((tenant) => (
              <Card
                key={tenant.id}
                className="glass-card hover:glow hover:border-primary/30 transition-all duration-300 cursor-pointer group"
                onClick={() => navigate(`/dashboard/organizations/${organizationId}/workspaces/${tenant.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white font-bold text-sm">
                    {tenant.name[0].toUpperCase()}
                  </div>
                  <CardTitle className="text-base mt-3 group-hover:text-primary transition-colors">
                    {tenant.name}
                  </CardTitle>
                  {tenant.description && (
                    <CardDescription className="text-xs line-clamp-2">{tenant.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <LayoutDashboard className="h-3 w-3" />
                        {tenant._count?.boards ?? 0} boards
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {tenant._count?.memberships ?? 0} members
                      </span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="glass-card">
            <CardContent className="py-12 text-center">
              <div className="p-4 rounded-2xl bg-muted/30 w-fit mx-auto mb-4">
                <LayoutDashboard className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No workspaces yet</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-xs mx-auto">
                Create a workspace to organize your team's Kanban boards.
              </p>
              <Button variant="gradient" onClick={() => setShowCreateForm(true)} id="create-first-workspace">
                <Plus className="h-4 w-4 mr-2" />
                Create workspace
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
