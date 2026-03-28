import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  LayoutDashboard, Briefcase, MessageSquare, Wallet, User,
  ClipboardList, TestTube, PlusCircle, LogOut, Menu,
  ChevronLeft, ChevronRight, Users, BarChart3, CreditCard,
  Star, Flame, FileText, Bell, Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem { label: string; href: string; icon: React.ElementType; badge?: number; }

const freelancerNav: NavItem[] = [
  { label: 'Dashboard',        href: '/dashboard/overview',     icon: LayoutDashboard },
  { label: 'Marketplace',      href: '/projects',               icon: Briefcase },
  { label: 'Top Matches',      href: '/dashboard/top-projects', icon: Star },
  { label: 'My Applications',  href: '/dashboard/applications', icon: ClipboardList },
  { label: 'Messages',         href: '/dashboard/messages',     icon: MessageSquare },
  { label: 'Earnings',         href: '/dashboard/wallet',       icon: Wallet },
  { label: 'Skill Tests',      href: '/dashboard/tests',        icon: TestTube },
  { label: 'My Profile',       href: '/dashboard/profile',      icon: User },
];

const clientNav: NavItem[] = [
  { label: 'Dashboard',        href: '/dashboard/client',        icon: LayoutDashboard },
  { label: 'Post a Project',   href: '/dashboard/post-project',  icon: PlusCircle },
  { label: 'My Projects',      href: '/projects',                icon: Briefcase },
  { label: 'Messages',         href: '/dashboard/messages',      icon: MessageSquare },
  { label: 'Payments',         href: '/dashboard/wallet',        icon: CreditCard },
  { label: 'Promote Projects', href: '/dashboard/promote',       icon: Flame },
  { label: 'Custom Tests',     href: '/dashboard/tests',         icon: FileText },
  { label: 'My Profile',       href: '/dashboard/profile',       icon: User },
];

const adminNav: NavItem[] = [
  { label: 'Admin Dashboard',  href: '/admin/dashboard',     icon: BarChart3 },
  { label: 'Users',            href: '/admin/users',         icon: Users },
  { label: 'Projects',         href: '/admin/projects',      icon: Briefcase },
  { label: 'Transactions',     href: '/admin/transactions',  icon: CreditCard },
];

// SkillBridge logo SVG
const Logo = () => (
  <svg viewBox="0 0 18 18" className="h-full w-full" fill="none">
    <path d="M3 9L9 3l6 6-6 6z" fill="rgba(184,224,206,0.9)" />
    <circle cx="9" cy="9" r="2.5" fill="white" />
  </svg>
);

const SidebarLink = ({
  item, collapsed, onClick
}: { item: NavItem; collapsed: boolean; onClick?: () => void }) => {
  const location = useLocation();
  const isActive = location.pathname === item.href ||
    (item.href !== '/projects' && location.pathname.startsWith(item.href + '/'));

  return (
    <Link
      to={item.href}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={cn(
        'group flex items-center gap-3 px-6 py-2.5 text-sm font-medium relative transition-all duration-150',
        collapsed && 'justify-center px-0',
        isActive
          ? 'text-white font-bold bg-[rgba(26,107,71,0.25)]'
          : 'text-[rgba(232,245,238,0.65)] hover:text-[rgba(232,245,238,0.95)] hover:bg-[rgba(232,245,238,0.07)]'
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#1A6B47] rounded-r-[2px]" />
      )}
      <item.icon className={cn(
        'shrink-0',
        collapsed ? 'h-5 w-5' : 'h-[17px] w-[17px]',
        isActive ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'
      )} />
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      {!collapsed && item.badge && item.badge > 0 && (
        <span className="ml-auto bg-[#1A6B47] text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
          {item.badge}
        </span>
      )}
    </Link>
  );
};

const SidebarInner = ({
  nav, user, collapsed, onItemClick
}: { nav: NavItem[]; user: any; collapsed: boolean; onItemClick?: () => void }) => (
  <div className="flex flex-col h-full bg-[#0E1B14]">
    {/* Header / Logo */}
    <div className={cn(
      'flex items-center border-b border-[rgba(232,245,238,0.07)] shrink-0',
      collapsed ? 'justify-center h-16 px-0' : 'h-16 px-6 gap-3'
    )}>
      <div className={cn('bg-[#1A6B47] rounded-lg flex items-center justify-center shrink-0', collapsed ? 'h-9 w-9' : 'h-8 w-8')}>
        <Logo />
      </div>
      {!collapsed && (
        <span className="text-white font-display text-xl tracking-tight">SkillBridge</span>
      )}
    </div>

    {/* Navigation */}
    <ScrollArea className="flex-1 py-3">
      <div className="space-y-0.5">
        {!collapsed && (
          <div className="px-6 py-1.5 text-[10px] font-bold tracking-[0.1em] uppercase text-[rgba(232,245,238,0.3)]">
            Main
          </div>
        )}
        {nav.map(item => (
          <SidebarLink key={item.href} item={item} collapsed={collapsed} onClick={onItemClick} />
        ))}
        <div className={cn('mt-3', !collapsed && 'border-t border-[rgba(232,245,238,0.07)] pt-3')}>
          {!collapsed && (
            <div className="px-6 py-1.5 text-[10px] font-bold tracking-[0.1em] uppercase text-[rgba(232,245,238,0.3)]">
              Account
            </div>
          )}
          <SidebarLink
            item={{ label: 'Settings', href: '/dashboard/settings', icon: Settings }}
            collapsed={collapsed} onClick={onItemClick}
          />
        </div>
      </div>
    </ScrollArea>

    {/* User footer */}
    <div className={cn(
      'border-t border-[rgba(232,245,238,0.07)] shrink-0',
      collapsed ? 'p-3 flex justify-center' : 'p-4'
    )}>
      {!collapsed ? (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-[#1A6B47] flex items-center justify-center text-white font-extrabold text-sm shrink-0">
            {(user?.name || user?.email || '?').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-white truncate">{user?.name || user?.email}</div>
            <div className="text-xs text-[rgba(232,245,238,0.5)] capitalize">{user?.role}</div>
          </div>
          <button
            onClick={() => { useAuthStore.getState().logout(); window.location.href = '/'; }}
            className="text-[rgba(232,245,238,0.4)] hover:text-[rgba(232,245,238,0.9)] transition-colors p-1"
            title="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => { useAuthStore.getState().logout(); window.location.href = '/'; }}
          className="text-[rgba(232,245,238,0.4)] hover:text-[rgba(232,245,238,0.9)] transition-colors p-2"
          title="Log out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      )}
    </div>
  </div>
);

export const DashboardLayout = () => {
  const { user } = useAuthStore();
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const getNav = () => {
    if (user?.role === 'admin') return adminNav;
    if (user?.role === 'client') return clientNav;
    return freelancerNav;
  };
  const nav = getNav();

  // Page title from current path
  const currentNav = [...freelancerNav, ...clientNav, ...adminNav].find(
    n => location.pathname === n.href || location.pathname.startsWith(n.href + '/')
  );

  return (
    <div className="min-h-screen bg-canvas flex">
      {/* Desktop Sidebar */}
      <aside className={cn(
        'hidden lg:flex flex-col fixed left-0 top-0 bottom-0 z-40 transition-all duration-300',
        sidebarOpen ? 'w-[248px]' : 'w-[64px]'
      )}>
        <SidebarInner nav={nav} user={user} collapsed={!sidebarOpen} />

        {/* Collapse toggle */}
        <button
          onClick={toggleSidebar}
          className="absolute -right-3 top-[76px] h-6 w-6 rounded-full bg-[#1A6B47] text-white flex items-center justify-center shadow-lg hover:bg-[#124D33] transition-colors z-50"
        >
          {sidebarOpen ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <button className="lg:hidden fixed left-4 top-4 z-50 h-9 w-9 rounded-lg bg-[#0E1B14] flex items-center justify-center text-white shadow-md">
            <Menu className="h-4 w-4" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[248px] p-0 border-0">
          <SidebarInner nav={nav} user={user} collapsed={false} onItemClick={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main content area */}
      <div className={cn(
        'flex-1 flex flex-col min-h-screen transition-all duration-300',
        sidebarOpen ? 'lg:ml-[248px]' : 'lg:ml-[64px]'
      )}>
        {/* Topbar */}
        <header className="sticky top-0 z-30 h-[60px] bg-canvas/95 backdrop-blur border-b border-ink-6 flex items-center px-6 gap-4 shrink-0">
          {/* Mobile burger space */}
          <div className="lg:hidden w-8" />

          <div className="flex-1">
            <div className="text-[15px] font-bold text-ink">
              {currentNav?.label || 'Dashboard'}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="h-9 w-9 rounded-lg hover:bg-ink-6 flex items-center justify-center text-ink-4 hover:text-ink transition-colors relative">
              <Bell className="h-4 w-4" />
            </button>
            <div className="h-8 w-8 rounded-full bg-brand flex items-center justify-center text-white text-xs font-extrabold">
              {(user?.name || user?.email || '?').charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
