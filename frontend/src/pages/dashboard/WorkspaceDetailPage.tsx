import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, LayoutDashboard, Plus, Users, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CardSkeleton } from '@/components/common/LoadingStates';

// Placeholder — boards feature comes in Stage 2
export default function WorkspaceDetailPage() {
  const { organizationId = '', workspaceId = '' } = useParams<{
    organizationId: string;
    workspaceId: string;
  }>();
  const navigate = useNavigate();

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <button
          onClick={() => navigate('/dashboard/organizations')}
          className="hover:text-foreground transition-colors"
          id="breadcrumb-organizations"
        >
          Organizations
        </button>
        <ChevronRight className="h-3 w-3" />
        <button
          onClick={() => navigate(`/dashboard/organizations/${organizationId}`)}
          className="hover:text-foreground transition-colors"
          id="breadcrumb-organization"
        >
          Organization
        </button>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium">Workspace</span>
      </nav>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/dashboard/organizations/${organizationId}`)}
            id="back-to-organization"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Workspace Boards</h1>
            <p className="text-muted-foreground text-sm">Manage your Kanban boards</p>
          </div>
        </div>
        <Button variant="gradient" id="create-board-button" disabled>
          <Plus className="h-4 w-4 mr-2" />
          New Board
          <span className="ml-2 text-xs opacity-70">(Stage 2)</span>
        </Button>
      </div>

      {/* Coming soon placeholder */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card className="glass-card">
            <CardContent className="py-16 text-center">
              <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-primary/20 w-fit mx-auto mb-6">
                <LayoutDashboard className="h-12 w-12 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-3">Kanban Boards</h3>
              <p className="text-muted-foreground max-w-sm mx-auto text-sm leading-relaxed">
                Real-time collaborative Kanban boards with drag-and-drop are coming in Stage 2.
                The backend APIs and database schema are already in place!
              </p>
              <div className="mt-6 flex flex-wrap gap-2 justify-center">
                {['dnd-kit', 'Socket.IO', 'Optimistic updates', 'Real-time sync'].map((tag) => (
                  <span key={tag} className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Team Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Member management coming soon</p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Activity log coming soon</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
