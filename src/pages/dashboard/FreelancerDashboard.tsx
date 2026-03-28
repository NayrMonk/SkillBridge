import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, Briefcase, ClipboardList, MessageSquare, ArrowRight, Star, Zap, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

const statusVariant: Record<string, any> = { pending: 'pending', hired: 'hired', rejected: 'rejected', shortlisted: 'verified' };

export const FreelancerDashboard = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getFreelancerDashboard()
      .then(r => setData(r.dashboard))
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  const stats = data ? [
    { icon: DollarSign,   label: 'Total Earned',         val: `$${Number(data.stats.totalEarnings || 0).toLocaleString()}`, color: 'text-brand' },
    { icon: Briefcase,    label: 'Active Projects',       val: data.stats.activeJobs || 0,            color: 'text-blue-600' },
    { icon: ClipboardList,label: 'Pending Applications',  val: data.stats.pendingApplications || 0,   color: 'text-amber-600' },
    { icon: MessageSquare,label: 'Unread Messages',        val: data.stats.unreadMessages || 0,        color: 'text-brand' },
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
          <p className="text-sm text-ink-4">Here's what's happening with your freelance work today.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/projects')}>Browse Projects</Button>
          <Button size="sm" onClick={() => navigate('/dashboard/tests')}>
            <Zap className="h-3.5 w-3.5 mr-1.5" /> Take Skill Test
          </Button>
        </div>
      </div>

      {/* Verify nudge */}
      {user && !user.isVerified && (
        <div className="rounded-xl p-5 flex items-center justify-between gap-4 flex-wrap"
          style={{ background: 'linear-gradient(135deg, #1A6B47, #22885C)' }}>
          <div>
            <h4 className="text-white font-bold mb-1">Complete your verification</h4>
            <p className="text-[rgba(255,255,255,.85)] text-sm">Verified freelancers get 3× more responses from clients.</p>
          </div>
          <Button variant="white" size="sm" onClick={() => navigate('/dashboard/profile')}>
            Start Verification →
          </Button>
        </div>
      )}

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
            <div className={`h-9 w-9 rounded-xl bg-canvas flex items-center justify-center mb-3`}>
              <s.icon className={`h-4.5 w-4.5 ${s.color}`} />
            </div>
            <div className="font-display text-2xl text-ink mb-0.5">{s.val}</div>
            <div className="text-xs text-ink-4 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Applications */}
        <div className="bg-white rounded-xl border border-ink-6 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-ink-6">
            <h4 className="font-bold text-ink">Recent Applications</h4>
            <Link to="/dashboard/applications" className="text-xs text-brand font-semibold hover:text-brand-dark flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-ink-6">
            {loading ? Array(3).fill(0).map((_, i) => (
              <div key={i} className="px-5 py-4"><Skeleton className="h-4 w-3/4 mb-2" /><Skeleton className="h-3 w-1/2" /></div>
            )) : data?.recentApplications?.length > 0 ? data.recentApplications.slice(0, 4).map((a: any) => (
              <div key={a.id} className="px-5 py-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-ink truncate">{a.project_title || a.title || 'Project'}</div>
                  <div className="text-xs text-ink-4 mt-0.5">
                    ${Number(a.proposed_budget || 0).toLocaleString()} · {a.created_at ? formatDistanceToNow(new Date(a.created_at), { addSuffix: true }) : ''}
                  </div>
                </div>
                <Badge variant={statusVariant[a.status] || 'default'}>{a.status}</Badge>
              </div>
            )) : (
              <div className="px-5 py-10 text-center">
                <ClipboardList className="h-8 w-8 text-ink-5 mx-auto mb-2" />
                <p className="text-sm text-ink-4">No applications yet.</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/projects')}>Browse Projects</Button>
              </div>
            )}
          </div>
        </div>

        {/* Top Project Matches */}
        <div className="bg-white rounded-xl border border-ink-6 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-ink-6">
            <h4 className="font-bold text-ink flex items-center gap-1.5"><Star className="h-4 w-4 text-amber-500" /> Top Matches For You</h4>
            <Link to="/dashboard/top-projects" className="text-xs text-brand font-semibold hover:text-brand-dark flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-ink-6">
            {loading ? Array(3).fill(0).map((_, i) => (
              <div key={i} className="px-5 py-4"><Skeleton className="h-4 w-3/4 mb-2" /><Skeleton className="h-3 w-1/2" /></div>
            )) : (
              <div className="px-5 py-10 text-center">
                <Star className="h-8 w-8 text-ink-5 mx-auto mb-2" />
                <p className="text-sm text-ink-4">Add skills to see top matches.</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/dashboard/profile')}>Add Skills</Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Browse Marketplace',     href: '/projects',               icon: Briefcase,     sub: 'Find your next project' },
          { label: 'Take AI Assessment',     href: '/projects',               icon: Zap,           sub: 'Prove your skills' },
          { label: 'View My Applications',   href: '/dashboard/applications', icon: ClipboardList, sub: 'Track your proposals' },
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
