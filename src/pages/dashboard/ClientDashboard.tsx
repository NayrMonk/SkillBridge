import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, Briefcase, PlusCircle, MessageSquare, ArrowRight, Flame, Users, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

const statusVariant: Record<string, any> = { open: 'open', in_progress: 'in_progress', completed: 'completed', cancelled: 'rejected' };

export const ClientDashboard = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getClientDashboard()
      .then(r => setData(r.dashboard))
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  const stats = data ? [
    { icon: DollarSign, label: 'Total Spent',      val: `$${Number(data.stats.totalSpent || 0).toLocaleString()}`,   color: 'text-brand' },
    { icon: Briefcase,  label: 'Active Projects',  val: data.stats.activeProjects || 0,                              color: 'text-blue-600' },
    { icon: Users,      label: 'Total Projects',   val: data.stats.totalProjects || 0,                               color: 'text-amber-600' },
    { icon: MessageSquare, label: 'Unread Messages', val: data.stats.unreadMessages || 0,                            color: 'text-brand' },
  ] : [];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-ink mb-1">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},{' '}
            <span className="text-brand">{user?.displayName?.split(' ')[0] || 'there'}</span> 👋
          </h1>
          <p className="text-sm text-ink-4">Manage your projects and find top talent today.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/projects')}>Browse Talent</Button>
          <Button size="sm" onClick={() => navigate('/dashboard/post-project')}>
            <PlusCircle className="h-3.5 w-3.5 mr-1.5" /> Post Project
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? Array(4).fill(0).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-ink-6 p-5">
            <Skeleton className="h-4 w-4 mb-3 rounded" />
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-3 w-24" />
          </div>
        )) : stats.map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-ink-6 p-5 hover:shadow-md transition-all hover:-translate-y-0.5">
            <div className="h-9 w-9 rounded-xl bg-canvas flex items-center justify-center mb-3">
              <s.icon className={`h-4.5 w-4.5 ${s.color}`} />
            </div>
            <div className="font-display text-2xl text-ink mb-0.5">{s.val}</div>
            <div className="text-xs text-ink-4 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Projects */}
        <div className="bg-white rounded-xl border border-ink-6 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-ink-6">
            <h4 className="font-bold text-ink">My Projects</h4>
            <Link to="/projects" className="text-xs text-brand font-semibold hover:text-brand-dark flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-ink-6">
            {loading ? Array(3).fill(0).map((_, i) => (
              <div key={i} className="px-5 py-4"><Skeleton className="h-4 w-3/4 mb-2" /><Skeleton className="h-3 w-1/2" /></div>
            )) : data?.recentProjects?.length > 0 ? data.recentProjects.slice(0, 4).map((p: any) => (
              <div key={p.id} className="px-5 py-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-ink truncate">{p.title}</div>
                  <div className="text-xs text-ink-4 mt-0.5">
                    ${Number(p.budget_max || p.budget_min || 0).toLocaleString()} ·{' '}
                    {p.created_at ? formatDistanceToNow(new Date(p.created_at), { addSuffix: true }) : ''}
                  </div>
                </div>
                <Badge variant={statusVariant[p.status] || 'default'}>{p.status?.replace('_', ' ')}</Badge>
              </div>
            )) : (
              <div className="px-5 py-10 text-center">
                <Briefcase className="h-8 w-8 text-ink-5 mx-auto mb-2" />
                <p className="text-sm text-ink-4">No projects posted yet.</p>
                <Button size="sm" className="mt-3" onClick={() => navigate('/dashboard/post-project')}>
                  <PlusCircle className="h-3.5 w-3.5 mr-1.5" /> Post First Project
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Pending Applications */}
        <div className="bg-white rounded-xl border border-ink-6 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-ink-6">
            <h4 className="font-bold text-ink">Pending Applications</h4>
            <Link to="/projects" className="text-xs text-brand font-semibold hover:text-brand-dark flex items-center gap-1">
              Review all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-ink-6">
            {loading ? Array(3).fill(0).map((_, i) => (
              <div key={i} className="px-5 py-4"><Skeleton className="h-4 w-3/4 mb-2" /><Skeleton className="h-3 w-1/2" /></div>
            )) : data?.pendingApplications?.length > 0 ? data.pendingApplications.slice(0, 4).map((a: any) => (
              <div key={a.id} className="px-5 py-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-ink truncate">{a.freelancer_name || 'Freelancer'}</div>
                  <div className="text-xs text-ink-4 mt-0.5">
                    ${Number(a.proposed_budget || 0).toLocaleString()} for {a.project_title || 'project'}
                  </div>
                </div>
                <Badge variant="pending">New</Badge>
              </div>
            )) : (
              <div className="px-5 py-10 text-center">
                <Users className="h-8 w-8 text-ink-5 mx-auto mb-2" />
                <p className="text-sm text-ink-4">No pending applications.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Post a Project',    href: '/dashboard/post-project', icon: PlusCircle, sub: 'Start hiring now' },
          { label: 'Boost Visibility',  href: '/dashboard/promote',      icon: Flame,      sub: 'Get more proposals' },
          { label: 'Create a Test',     href: '/dashboard/tests',        icon: CheckCircle,sub: 'Screen applicants' },
        ].map(a => (
          <Link key={a.label} to={a.href}
            className="bg-white rounded-xl border border-ink-6 p-5 hover:border-brand/30 hover:bg-brand-ghost hover:-translate-y-0.5 transition-all group">
            <div className="h-9 w-9 rounded-xl bg-canvas flex items-center justify-center mb-3">
              <a.icon className="h-4.5 w-4.5 text-brand" />
            </div>
            <div className="text-sm font-bold text-ink group-hover:text-brand transition-colors">{a.label}</div>
            <div className="text-xs text-ink-4 mt-0.5">{a.sub}</div>
          </Link>
        ))}
      </div>
    </div>
  );
};
