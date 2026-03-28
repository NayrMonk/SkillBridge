import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/api/client';
import { ArrowRight, Code, Palette, PenTool, Video, Brain, Flame, Star, Shield, Zap, DollarSign, Users, Briefcase } from 'lucide-react';

const categories = [
  { name: 'Development', icon: Code,    color: '#3B82F6', count: '1,240+' },
  { name: 'AI / ML',     icon: Brain,   color: '#8B5CF6', count: '856+' },
  { name: 'Design',      icon: Palette, color: '#EC4899', count: '2,100+' },
  { name: 'Writing',     icon: PenTool, color: '#F59E0B', count: '1,540+' },
  { name: 'Video',       icon: Video,   color: '#EF4444', count: '678+' },
  { name: 'Marketing',   icon: Briefcase, color: '#10B981', count: '920+' },
];

const stats = [
  { val: '12,400+', label: 'Projects Completed' },
  { val: '$4.2M+',  label: 'Paid to Freelancers' },
  { val: '98%',     label: 'Client Satisfaction' },
  { val: '2,800+',  label: 'Verified Freelancers' },
];

const howItWorksClient = [
  { n: '1', title: 'Post your project', desc: 'Describe your needs, set budget and timeline. Optional: attach a custom skill test.' },
  { n: '2', title: 'Review proposals', desc: 'See each applicants AI assessment score, test results, and portfolio.' },
  { n: '3', title: 'Pay via escrow', desc: 'Fund milestones. Release payment only when satisfied.' },
];
const howItWorksFreelancer = [
  { n: '1', title: 'Build your profile', desc: 'Add your skills, take AI assessments, and upload your resume.' },
  { n: '2', title: 'Take the AI assessment', desc: 'Answer targeted questions for each project. Get a score that proves your skills.' },
  { n: '3', title: 'Get hired and paid', desc: 'Work in milestones. Get paid automatically when the client approves.' },
];

const boostTiers = [
  { icon: '🔥', name: 'Hot', tagline: '3× more applications', color: '#FF4500', bg: '#FFF3EF',
    features: ['Above regular listings', 'Flame icon on card', 'Highlighted in search'],
    prices: [{ dur: '7 days', price: '$19' }, { dur: '14 days', price: '$34' }, { dur: '30 days', price: '$69' }] },
  { icon: '⭐', name: 'Featured', tagline: 'Maximum exposure', color: '#F59E0B', bg: '#FFFBEB',
    features: ['Pinned to marketplace top', 'Homepage spotlight section', 'Weekly newsletter inclusion'],
    prices: [{ dur: '7 days', price: '$49' }, { dur: '14 days', price: '$89' }, { dur: '30 days', price: '$179' }] },
];

export const LandingPage = () => {
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();
  const [hotProjects, setHotProjects] = useState<any[]>([]);

  useEffect(() => {
    api.getProjects({ limit: 3, promotion: 'hot' }).then(r => setHotProjects(r.projects || [])).catch(() => {});
  }, []);

  const handleCTA = () => {
    if (isAuthenticated) navigate(user?.role === 'client' ? '/dashboard/client' : '/dashboard/overview');
    else navigate('/register');
  };

  return (
    <div className="bg-canvas">

      {/* ── HERO ── */}
      <section className="max-w-7xl mx-auto px-6 pt-20 pb-24 grid lg:grid-cols-2 gap-16 items-center">
        <div>
          <div className="inline-flex items-center gap-2 bg-brand-ghost border border-brand/20 rounded-full px-4 py-1.5 mb-6">
            <span className="text-brand text-xs font-bold uppercase tracking-wider">New</span>
            <span className="text-ink-3 text-sm">AI-powered skill assessments now live</span>
          </div>
          <h1 className="font-display italic text-ink leading-tight mb-6">
            Where verified talent<br />
            <span className="text-brand">meets real opportunity.</span>
          </h1>
          <p className="text-ink-3 text-lg leading-relaxed mb-8 max-w-[480px]">
            SkillBridge connects clients with pre-screened freelancers. AI-powered assessments, escrow payments, zero fake profiles.
          </p>
          <div className="flex flex-wrap gap-3 mb-10">
            <Button size="xl" onClick={handleCTA}>
              Post a Project <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
            <Button size="xl" variant="outline" onClick={() => navigate('/projects')}>
              Browse Talent
            </Button>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-ink-4">
            {['✓ AI-Verified Talent', '✓ Escrow Protected', '✓ No Hidden Fees'].map(t => (
              <span key={t} className="font-medium">{t}</span>
            ))}
          </div>
        </div>

        {/* Hero visual — stats mockup */}
        <div className="hidden lg:block">
          <div className="relative">
            <div className="bg-white rounded-2xl shadow-lg border border-ink-6 p-6">
              <div className="flex items-center justify-between mb-5">
                <h4 className="text-sm font-bold text-ink">Dashboard Overview</h4>
                <Badge variant="active">Live</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-5">
                {[
                  { label: 'Active Projects', val: '8', color: 'brand' },
                  { label: 'Proposals', val: '24', color: 'info' },
                  { label: 'In Escrow', val: '$3.2k', color: 'warn' },
                  { label: 'Completed', val: '142', color: 'success' },
                ].map(s => (
                  <div key={s.label} className="bg-canvas rounded-xl p-3">
                    <div className="text-xl font-display text-ink mb-0.5">{s.val}</div>
                    <div className="text-xs text-ink-4">{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-2.5">
                {[
                  { name: 'React Developer', score: 92, badge: 'featured' as const },
                  { name: 'AI/ML Engineer',  score: 87, badge: 'hot' as const },
                  { name: 'UI/UX Designer',  score: 94, badge: 'verified' as const },
                ].map(f => (
                  <div key={f.name} className="flex items-center gap-3 bg-canvas rounded-lg p-2.5">
                    <div className="h-8 w-8 rounded-full bg-brand flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {f.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-ink">{f.name}</div>
                      <div className="text-xs text-ink-4">AI Score: {f.score}/100</div>
                    </div>
                    <Badge variant={f.badge} className="text-[10px]">{f.badge === 'featured' ? '⭐' : f.badge === 'hot' ? '🔥' : '✓'}</Badge>
                  </div>
                ))}
              </div>
            </div>
            {/* Floating badge */}
            <div className="absolute -top-4 -right-4 bg-brand text-white rounded-xl px-4 py-2 shadow-lg text-sm font-bold">
              🔒 Escrow Protected
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section className="bg-[#0E1B14] py-12">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map(s => (
            <div key={s.label}>
              <div className="font-display text-3xl text-white mb-1">{s.val}</div>
              <div className="text-sm text-[rgba(232,245,238,0.6)]">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="font-display text-ink mb-3">How SkillBridge Works</h2>
          <p className="text-ink-4 text-base">Simple, transparent, and fair for everyone.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-12">
          {[
            { role: 'For Clients', steps: howItWorksClient, accent: '#1A6B47' },
            { role: 'For Freelancers', steps: howItWorksFreelancer, accent: '#3B82F6' },
          ].map(block => (
            <div key={block.role} className="bg-white rounded-2xl border border-ink-6 p-8 shadow-sm">
              <div className="text-sm font-bold text-ink-4 uppercase tracking-wider mb-6">{block.role}</div>
              <div className="space-y-6">
                {block.steps.map(s => (
                  <div key={s.n} className="flex gap-4">
                    <div className="h-8 w-8 rounded-full bg-brand-ghost border-2 border-brand/30 flex items-center justify-center text-brand font-extrabold text-sm shrink-0">{s.n}</div>
                    <div>
                      <div className="font-bold text-ink mb-1">{s.title}</div>
                      <div className="text-sm text-ink-4 leading-relaxed">{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CATEGORIES ── */}
      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="font-display text-ink mb-3">Browse by Category</h2>
            <p className="text-ink-4">Find the right talent for every type of project.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {categories.map(c => (
              <Link key={c.name} to={`/projects?category=${encodeURIComponent(c.name)}`}
                className="group flex flex-col items-center gap-3 bg-canvas rounded-2xl p-5 border border-ink-6 hover:border-brand/30 hover:bg-brand-ghost transition-all duration-200 hover:-translate-y-0.5">
                <div className="h-12 w-12 rounded-xl flex items-center justify-center" style={{ background: c.color + '18' }}>
                  <c.icon className="h-5 w-5" style={{ color: c.color }} />
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold text-ink group-hover:text-brand transition-colors">{c.name}</div>
                  <div className="text-xs text-ink-4 mt-0.5">{c.count} projects</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOT PROJECTS ── */}
      {hotProjects.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 py-20">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="font-display text-ink mb-1">🔥 Hot Projects Right Now</h2>
              <p className="text-ink-4 text-sm">Boosted projects with fast turnaround and high budgets.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/projects?promotion=hot')}>
              View All <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {hotProjects.map((p: any) => (
              <Link key={p.id} to={`/projects/${p.id}`}
                className="bg-white rounded-xl border-t-4 border-[#FF4500] border-x border-b border-ink-6 p-5 hover:shadow-md transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <Badge variant="hot">🔥 Hot</Badge>
                  <span className="text-xs text-ink-4">{p.category}</span>
                </div>
                <h4 className="font-bold text-ink mb-2 group-hover:text-brand transition-colors line-clamp-2">{p.title}</h4>
                <p className="text-sm text-ink-4 line-clamp-2 mb-4">{p.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-brand font-bold">${Number(p.budget_min || p.budget_max || 0).toLocaleString()}</span>
                  <span className="text-xs text-ink-4">{p.applications_count || 0} proposals</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── BOOST PRICING ── */}
      <section id="pricing" className="bg-white py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="font-display text-ink mb-3">Boost Your Project — Get Hired Faster</h2>
            <p className="text-ink-4">Premium placement gets you 3–8× more applications.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {boostTiers.map(t => (
              <div key={t.name} className="rounded-2xl border border-ink-6 overflow-hidden shadow-sm">
                <div className="p-6" style={{ background: t.bg }}>
                  <div className="text-3xl mb-2">{t.icon}</div>
                  <div className="text-xl font-bold text-ink mb-1">{t.name}</div>
                  <div className="text-sm font-semibold" style={{ color: t.color }}>{t.tagline}</div>
                </div>
                <div className="p-6 bg-white">
                  <ul className="space-y-2 mb-6">
                    {t.features.map(f => (
                      <li key={f} className="flex items-center gap-2 text-sm text-ink-3">
                        <div className="h-4 w-4 rounded-full flex items-center justify-center" style={{ background: t.color + '20' }}>
                          <div className="h-1.5 w-1.5 rounded-full" style={{ background: t.color }} />
                        </div>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="grid grid-cols-3 gap-2">
                    {t.prices.map(p => (
                      <div key={p.dur} className="text-center border border-ink-6 rounded-xl p-3 hover:border-brand/40 hover:bg-brand-ghost transition-all cursor-pointer">
                        <div className="font-bold text-ink text-lg">{p.price}</div>
                        <div className="text-xs text-ink-4">{p.dur}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Button size="xl" onClick={() => navigate('/register')}>
              Post a Project & Boost <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-[#0E1B14] py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-display italic text-white mb-4 text-4xl">
            Ready to find your next great hire?
          </h2>
          <p className="text-[rgba(232,245,238,0.7)] text-lg mb-10 leading-relaxed">
            Join thousands of clients and freelancers who trust SkillBridge for real work and real results.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Button size="xl" onClick={() => navigate('/register')} className="bg-white text-brand-dark hover:bg-ink-6">
              Start for Free <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
            <Button size="xl" variant="ghost" onClick={() => navigate('/projects')}
              className="text-white border border-white/20 hover:bg-white/10">
              Browse Projects
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};
