import { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Search, Briefcase, MessageSquare, Bell, User, Menu, X, Wallet, LayoutDashboard, LogOut, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const Logo = () => (
  <Link to="/" className="flex items-center gap-2.5">
    <div className="h-8 w-8 bg-brand rounded-lg flex items-center justify-center shrink-0">
      <svg viewBox="0 0 18 18" className="h-5 w-5" fill="none">
        <path d="M3 9L9 3l6 6-6 6z" fill="rgba(184,224,206,0.9)" />
        <circle cx="9" cy="9" r="2.5" fill="white" />
      </svg>
    </div>
    <span className="text-xl font-display text-ink tracking-tight">SkillBridge</span>
  </Link>
);

export const MainLayout = () => {
  const { user, isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [unread, setUnread] = useState({ messages: 0, notifications: 0 });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const fetch = async () => {
      try {
        const [m, n] = await Promise.all([
          api.getUnreadMessageCount(),
          api.getNotifications({ unreadOnly: true, limit: 1 }),
        ]);
        setUnread({ messages: m.unreadCount, notifications: n.unreadCount });
      } catch {}
    };
    fetch();
    const t = setInterval(fetch, 30000);
    return () => clearInterval(t);
  }, [isAuthenticated]);

  return (
    <div className="min-h-screen bg-canvas">
      {/* Nav */}
      <nav className={cn(
        'fixed top-0 left-0 right-0 z-50 h-16 transition-all duration-200',
        'bg-canvas/95 backdrop-blur-md border-b border-ink-6',
        scrolled && 'shadow-sm'
      )}>
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between gap-6">
          <Logo />

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1">
            {[
              { label: 'Find Work', href: '/projects' },
              { label: 'How It Works', href: '/#how' },
              { label: 'Pricing', href: '/#pricing' },
            ].map(l => (
              <Link key={l.href} to={l.href}
                className="px-4 py-2 text-sm font-medium text-ink-3 hover:text-ink hover:bg-ink-6 rounded-lg transition-all duration-150">
                {l.label}
              </Link>
            ))}
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <button onClick={() => navigate('/dashboard/messages')}
                  className="relative h-9 w-9 flex items-center justify-center rounded-lg text-ink-4 hover:text-ink hover:bg-ink-6 transition-colors">
                  <MessageSquare className="h-4 w-4" />
                  {unread.messages > 0 && (
                    <span className="absolute top-1 right-1 h-4 w-4 bg-danger text-white text-[9px] font-extrabold rounded-full flex items-center justify-center">
                      {unread.messages}
                    </span>
                  )}
                </button>
                <button className="relative h-9 w-9 flex items-center justify-center rounded-lg text-ink-4 hover:text-ink hover:bg-ink-6 transition-colors">
                  <Bell className="h-4 w-4" />
                  {unread.notifications > 0 && (
                    <span className="absolute top-1 right-1 h-4 w-4 bg-danger text-white text-[9px] font-extrabold rounded-full flex items-center justify-center">
                      {unread.notifications}
                    </span>
                  )}
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-ink-6 transition-colors">
                      <div className="h-7 w-7 rounded-full bg-brand flex items-center justify-center text-white text-xs font-extrabold">
                        {(user?.displayName || user?.email || '?').charAt(0).toUpperCase()}
                      </div>
                      <span className="hidden sm:block text-sm font-semibold text-ink max-w-[120px] truncate">
                        {user?.displayName || user?.email}
                      </span>
                      <ChevronDown className="h-3.5 w-3.5 text-ink-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52 border-ink-6">
                    <DropdownMenuItem onClick={() => navigate('/dashboard/profile')}>
                      <User className="mr-2 h-4 w-4 text-ink-4" /> Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/dashboard/wallet')}>
                      <Wallet className="mr-2 h-4 w-4 text-ink-4" /> Wallet
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(user?.role === 'client' ? '/dashboard/client' : '/dashboard/overview')}>
                      <LayoutDashboard className="mr-2 h-4 w-4 text-ink-4" /> Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => { logout(); navigate('/'); }} className="text-danger">
                      <LogOut className="mr-2 h-4 w-4" /> Log Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>Log In</Button>
                <Button size="sm" onClick={() => navigate('/register')}>Get Started</Button>
              </div>
            )}
            <button className="md:hidden h-9 w-9 flex items-center justify-center rounded-lg text-ink-3 hover:bg-ink-6" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-ink-6 bg-canvas px-6 py-4 space-y-1">
            {[{ label: 'Find Work', href: '/projects' }, { label: 'How It Works', href: '/#how' }].map(l => (
              <Link key={l.href} to={l.href} onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-ink-3 hover:text-ink hover:bg-ink-6">
                {l.label}
              </Link>
            ))}
            {!isAuthenticated && (
              <div className="pt-2 flex flex-col gap-2">
                <Button variant="outline" className="w-full" onClick={() => { navigate('/login'); setMobileOpen(false); }}>Log In</Button>
                <Button className="w-full" onClick={() => { navigate('/register'); setMobileOpen(false); }}>Get Started</Button>
              </div>
            )}
          </div>
        )}
      </nav>

      <main className="pt-16"><Outlet /></main>

      {/* Footer */}
      <footer className="bg-[#0E1B14] text-[rgba(232,245,238,0.65)]">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="h-8 w-8 bg-brand rounded-lg flex items-center justify-center">
                  <svg viewBox="0 0 18 18" className="h-5 w-5" fill="none">
                    <path d="M3 9L9 3l6 6-6 6z" fill="rgba(184,224,206,0.9)" />
                    <circle cx="9" cy="9" r="2.5" fill="white" />
                  </svg>
                </div>
                <span className="text-xl font-display text-white">SkillBridge</span>
              </div>
              <p className="text-sm leading-relaxed">Verified talent. Real projects. No scams.</p>
            </div>
            {[
              { title: 'For Freelancers', links: [{ label: 'Find Work', href: '/projects' }, { label: 'Create Profile', href: '/register' }, { label: 'Skill Tests', href: '/register' }] },
              { title: 'For Clients', links: [{ label: 'Post a Project', href: '/register' }, { label: 'Find Talent', href: '/projects' }, { label: 'Create Tests', href: '/register' }] },
              { title: 'Company', links: [{ label: 'How It Works', href: '/#how' }, { label: 'Pricing', href: '/#pricing' }, { label: 'Privacy Policy', href: '/' }] },
            ].map(col => (
              <div key={col.title}>
                <h5 className="text-white font-bold mb-4 text-sm tracking-wide">{col.title}</h5>
                <ul className="space-y-2.5">
                  {col.links.map(l => (
                    <li key={l.label}><Link to={l.href} className="text-sm hover:text-white transition-colors">{l.label}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-[rgba(232,245,238,0.07)] pt-8 text-center text-sm">
            © {new Date().getFullYear()} SkillBridge. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};
