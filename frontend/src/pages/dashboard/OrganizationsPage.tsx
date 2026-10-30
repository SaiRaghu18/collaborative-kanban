import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, Plus, X, Users, LayoutDashboard, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InlineError } from '@/components/common/ErrorStates';
import { CardSkeleton } from '@/components/common/LoadingStates';
import { LoadingSpinner } from '@/components/common/LoadingStates';
import { useOrganizations, useCreateOrganization } from '@/hooks/useOrganizations';
import { toast } from '@/hooks/useToast';

const createOrgSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens'),
  description: z.string().max(500).optional(),
});

type CreateOrgForm = z.infer<typeof createOrgSchema>;

export default function OrganizationsPage() {
  const navigate = useNavigate();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const { data: organizations, isLoading, error, refetch } = useOrganizations();
  const createOrg = useCreateOrganization();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateOrgForm>({ resolver: zodResolver(createOrgSchema) });

  // Auto-generate slug from name
  const name = watch('name', '');
  const autoSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const onSubmit = async (data: CreateOrgForm) => {
    try {
      await createOrg.mutateAsync(data);
      toast({ title: 'Organization created!', description: `"${data.name}" is ready.` });
      reset();
      setShowCreateForm(false);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      toast({
        title: 'Failed to create organization',
        description: error?.response?.data?.error || 'Please try again',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Organizations
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your organizations and workspaces
          </p>
        </div>
        <Button
          variant="gradient"
          onClick={() => setShowCreateForm(true)}
          id="create-organization-button"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Organization
        </Button>
      </div>

      {/* Create org form */}
      {showCreateForm && (
        <Card className="glass-card border-primary/30 glow animate-fade-in">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Create Organization</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { setShowCreateForm(false); reset(); }}
                id="close-create-org-form"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" id="create-org-form">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="org-name">Organization name</Label>
                  <Input
                    id="org-name"
                    placeholder="Acme Corporation"
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
                  <Label htmlFor="org-slug">
                    URL slug
                    <span className="ml-2 text-xs text-muted-foreground">(auto-generated)</span>
                  </Label>
                  <Input
                    id="org-slug"
                    placeholder="acme-corporation"
                    {...register('slug')}
                  />
                  {errors.slug && <p className="text-xs text-destructive">{errors.slug.message}</p>}
                  {autoSlug && !errors.slug && (
                    <p className="text-xs text-muted-foreground">Preview: /{autoSlug}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-description">Description (optional)</Label>
                <Input id="org-description" placeholder="What does this organization do?" {...register('description')} />
              </div>
              {createOrg.error && (
                <InlineError message={(createOrg.error as {response?: {data?: {error?: string}}})?.response?.data?.error || 'Failed to create organization'} />
              )}
              <div className="flex gap-3">
                <Button type="submit" id="submit-create-org" disabled={createOrg.isPending}>
                  {createOrg.isPending ? (
                    <><LoadingSpinner size="sm" className="mr-2" />Creating...</>
                  ) : 'Create Organization'}
                </Button>
                <Button type="button" variant="ghost" onClick={() => { setShowCreateForm(false); reset(); }}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Organizations list */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
        </div>
      ) : error ? (
        <Card className="glass-card">
          <CardContent className="py-12 text-center">
            <p className="text-destructive">Failed to load organizations.</p>
            <Button variant="outline" className="mt-4" onClick={() => refetch()}>Retry</Button>
          </CardContent>
        </Card>
      ) : organizations && organizations.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {organizations.map((org) => (
            <Card
              key={org.id}
              className="glass-card hover:glow hover:border-primary/30 transition-all duration-300 cursor-pointer group"
              onClick={() => navigate(`/dashboard/organizations/${org.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold">
                    {org.name[0].toUpperCase()}
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
                    {org.role?.replace('_', ' ')}
                  </span>
                </div>
                <CardTitle className="text-base mt-3 group-hover:text-primary transition-colors">
                  {org.name}
                </CardTitle>
                {org.description && (
                  <CardDescription className="line-clamp-2 text-xs">{org.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <LayoutDashboard className="h-3 w-3" />
                      {org._count?.tenants ?? 0} workspaces
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {org._count?.memberships ?? 0} members
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
          <CardContent className="py-16 text-center">
            <div className="p-4 rounded-2xl bg-muted/30 w-fit mx-auto mb-4">
              <Building2 className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No organizations yet</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              Organizations are your top-level workspace containers. Create one to get started.
            </p>
            <Button variant="gradient" onClick={() => setShowCreateForm(true)} id="create-first-org-empty">
              <Plus className="h-4 w-4 mr-2" />
              Create your first organization
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
