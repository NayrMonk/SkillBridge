import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const Logo = () => (
  <div className="flex items-center gap-2.5">
    <div className="h-9 w-9 bg-brand rounded-xl flex items-center justify-center">
      <svg viewBox="0 0 18 18" className="h-6 w-6" fill="none">
        <path d="M3 9L9 3l6 6-6 6z" fill="rgba(184,224,206,0.9)" />
        <circle cx="9" cy="9" r="2.5" fill="white" />
      </svg>
    </div>
    <span className="text-2xl font-display text-white">SkillBridge</span>
  </div>
);

const perks = [
  'AI-verified talent — no fake profiles',
  'Escrow-protected payments always',
  'Free applications for verified talent',
  'Built-in project workspaces',
];

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.email) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Valid email required';
    if (!form.password) e.password = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      setLoading(true);
      const res = await api.login(form.email, form.password);
      login(res.user, res.token);
      toast.success('Welcome back!');
      const from = (location.state as any)?.from?.pathname;
      if (from) navigate(from);
      else if (res.user.role === 'client') navigate('/dashboard/client');
      else if (res.user.role === 'admin') navigate('/admin/dashboard');
      else navigate('/dashboard/overview');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Invalid credentials');
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
          <div className="absolute top-1/3 -left-16 w-64 h-64 rounded-full bg-brand/5" />
        </div>
        <Link to="/"><Logo /></Link>
        <div className="mt-auto mb-auto pt-16">
          <h2 className="text-4xl font-display italic text-white mb-4 leading-tight">Welcome back.</h2>
          <p className="text-[rgba(232,245,238,0.7)] text-base mb-10 leading-relaxed">
            Your projects, proposals, and verified profile are waiting inside your dashboard.
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
        <div className="w-full max-w-[420px]">
          <div className="lg:hidden mb-8"><Link to="/"><div className="flex items-center gap-2"><div className="h-8 w-8 bg-brand rounded-lg flex items-center justify-center"><svg viewBox="0 0 18 18" className="h-5 w-5" fill="none"><path d="M3 9L9 3l6 6-6 6z" fill="rgba(184,224,206,0.9)" /><circle cx="9" cy="9" r="2.5" fill="white" /></svg></div><span className="text-xl font-display">SkillBridge</span></div></Link></div>

          <div className="mb-8">
            <h3 className="text-2xl font-display text-ink mb-1">Log In</h3>
            <p className="text-sm text-ink-4">Enter your credentials to access your dashboard.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[13px] font-bold text-ink-2 mb-1.5">Email Address</label>
              <Input type="email" placeholder="you@example.com" value={form.email}
                onChange={e => { setForm({...form, email: e.target.value}); setErrors({...errors, email: ''}); }}
                className={errors.email ? 'border-danger' : ''} />
              {errors.email && <p className="mt-1 text-xs text-danger">{errors.email}</p>}
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[13px] font-bold text-ink-2">Password</label>
                <span className="text-xs text-ink-4 cursor-pointer hover:text-brand">Forgot password?</span>
              </div>
              <div className="relative">
                <Input type={showPw ? 'text' : 'password'} placeholder="Your password"
                  value={form.password}
                  onChange={e => { setForm({...form, password: e.target.value}); setErrors({...errors, password: ''}); }}
                  className={`pr-10 ${errors.password ? 'border-danger' : ''}`} />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-4 hover:text-ink-2">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-danger">{errors.password}</p>}
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Logging in…</> : 'Log In to Dashboard'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-4">
            Don't have an account?{' '}
            <Link to="/register" className="text-brand font-bold hover:text-brand-dark">Create one free</Link>
          </p>
        </div>
      </div>
    </div>
  );
};
