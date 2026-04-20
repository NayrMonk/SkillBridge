import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eye, EyeOff, Loader2, CheckCircle, User, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const perks = [
  'AI skill verification — instant credibility',
  'Escrow-protected milestone payments',
  'Zero application fees for verified talent',
  'Real-time messaging with clients',
];

export const RegisterPage = () => {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [role, setRole] = useState<'freelancer' | 'client'>('freelancer');
  const [form, setForm] = useState({ displayName: '', email: '', password: '', headline: '', agreeTerms: false });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.displayName.trim()) e.displayName = 'Name is required';
    if (!form.email) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Valid email required';
    if (!form.password || form.password.length < 8) e.password = 'Password must be at least 8 characters';
    if (!form.agreeTerms) e.terms = 'You must accept the terms';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      setLoading(true);
      const res = await api.register({ email: form.email, password: form.password, role, displayName: form.displayName, headline: form.headline });
      login(res.user, res.token);
      toast.success('Account created! Complete your profile.');
      navigate('/complete-profile');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex w-[420px] shrink-0 flex-col bg-[#0E1B14] px-12 py-14 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full bg-brand/10" />
        </div>
        <Link to="/">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 bg-brand rounded-xl flex items-center justify-center">
              <svg viewBox="0 0 18 18" className="h-6 w-6" fill="none"><path d="M3 9L9 3l6 6-6 6z" fill="rgba(184,224,206,0.9)" /><circle cx="9" cy="9" r="2.5" fill="white" /></svg>
            </div>
            <span className="text-2xl font-display text-white">SkillBridge</span>
          </div>
        </Link>
        <div className="mt-auto mb-auto pt-16">
          <h2 className="text-4xl font-display italic text-white mb-4 leading-tight">
            Join 2,800+<br />verified freelancers.
          </h2>
          <p className="text-[rgba(232,245,238,0.7)] text-base mb-10 leading-relaxed">
            Build your verified profile, get hired faster, and earn more with escrow protection.
          </p>
          <ul className="space-y-4">
            {perks.map(p => (
              <li key={p} className="flex items-center gap-3 text-sm text-[rgba(232,245,238,0.75)]">
                <div className="h-5 w-5 rounded-full bg-brand/30 flex items-center justify-center shrink-0">
                  <CheckCircle className="h-3 w-3 text-[#B8E0CE]" />
                </div>
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center bg-canvas px-6 py-12">
        <div className="w-full max-w-[440px]">
          <div className="mb-8">
            <h3 className="text-2xl font-display text-ink mb-1">Create Account</h3>
            <p className="text-sm text-ink-4">It's free. No credit card required.</p>
          </div>

          {/* Role selector */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {([
              { val: 'freelancer', label: 'Freelancer', sub: 'I want to find work', icon: User },
              { val: 'client',     label: 'Client',     sub: 'I want to hire talent', icon: Building2 },
            ] as const).map(r => (
              <button key={r.val} type="button" onClick={() => setRole(r.val)}
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-150 cursor-pointer',
                  role === r.val
                    ? 'border-brand bg-brand-ghost text-brand-dark'
                    : 'border-ink-5 bg-white text-ink-3 hover:border-brand/40'
                )}>
                <r.icon className={cn('h-5 w-5', role === r.val ? 'text-brand' : 'text-ink-4')} />
                <div className="text-center">
                  <div className={cn('text-sm font-bold', role === r.val ? 'text-brand-dark' : 'text-ink-2')}>{r.label}</div>
                  <div className="text-xs text-ink-4 mt-0.5">{r.sub}</div>
                </div>
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[13px] font-bold text-ink-2 mb-1.5">Full Name</label>
              <Input placeholder="Your full name" value={form.displayName}
                onChange={e => { setForm({...form, displayName: e.target.value}); setErrors({...errors, displayName: ''}); }}
                className={errors.displayName ? 'border-danger' : ''} />
              {errors.displayName && <p className="mt-1 text-xs text-danger">{errors.displayName}</p>}
            </div>
            <div>
              <label className="block text-[13px] font-bold text-ink-2 mb-1.5">Email Address</label>
              <Input type="email" placeholder="you@example.com" value={form.email}
                onChange={e => { setForm({...form, email: e.target.value}); setErrors({...errors, email: ''}); }}
                className={errors.email ? 'border-danger' : ''} />
              {errors.email && <p className="mt-1 text-xs text-danger">{errors.email}</p>}
            </div>
            {role === 'freelancer' && (
              <div>
                <label className="block text-[13px] font-bold text-ink-2 mb-1.5">Professional Title <span className="text-ink-4 font-normal">(optional)</span></label>
                <Input placeholder="e.g. React Developer" value={form.headline}
                  onChange={e => setForm({...form, headline: e.target.value})} />
              </div>
            )}
            <div>
              <label className="block text-[13px] font-bold text-ink-2 mb-1.5">Password</label>
              <div className="relative">
                <Input type={showPw ? 'text' : 'password'} placeholder="8+ characters" value={form.password}
                  onChange={e => { setForm({...form, password: e.target.value}); setErrors({...errors, password: ''}); }}
                  className={`pr-10 ${errors.password ? 'border-danger' : ''}`} />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-4 hover:text-ink-2">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-danger">{errors.password}</p>}
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={form.agreeTerms}
                onChange={e => { setForm({...form, agreeTerms: e.target.checked}); setErrors({...errors, terms: ''}); }}
                className="mt-0.5 accent-brand" />
              <span className="text-sm text-ink-3">
                I agree to the <span className="text-brand font-semibold">Terms of Service</span> and <span className="text-brand font-semibold">Privacy Policy</span>
              </span>
            </label>
            {errors.terms && <p className="text-xs text-danger">{errors.terms}</p>}

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating account…</> : 'Create Account →'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-4">
            Already have an account?{' '}
            <Link to="/login" className="text-brand font-bold hover:text-brand-dark">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};
