import React, { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  Calculator,
  DollarSign,
  FileText,
  Truck,
  Users,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Package,
  Mail,
  X,
} from 'lucide-react';
import { AppUser, UserRole } from '../types';
import affinityLogo from '../assets/affinity-logo.svg';
import { Topbar } from './Topbar';
import { Avatar } from './ui/Avatar';
import { CommandPalette, type CommandItem } from './ui/CommandPalette';
import { Breadcrumbs, type BreadcrumbItem } from './ui/Breadcrumbs';

export type AppView =
  | 'admin'
  | 'driver'
  | 'accountant'
  | 'settings'
  | 'financials'
  | 'documents'
  | 'clients'
  | 'shipments'
  | 'updates';

interface LayoutProps {
  children: React.ReactNode;
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  user: AppUser;
  onLogout: () => Promise<void> | void;
}

const navItems: {
  id: AppView;
  label: string;
  roles: UserRole[];
  Icon: React.ComponentType<{ size?: number }>;
}[] = [
  { id: 'admin', label: 'Dashboard', roles: ['Admin', 'Manager'], Icon: BarChart3 },
  { id: 'accountant', label: 'Accountant', roles: ['Admin', 'Accountant'], Icon: Calculator },
  {
    id: 'financials',
    label: 'Financials',
    roles: ['Admin', 'Manager', 'Accountant'],
    Icon: DollarSign,
  },
  { id: 'documents', label: 'Documents', roles: ['Admin', 'Manager', 'Driver'], Icon: FileText },
  { id: 'driver', label: 'Driver Portal', roles: ['Admin', 'Driver'], Icon: Truck },
  { id: 'clients', label: 'Clients', roles: ['Admin', 'Accountant'], Icon: Users },
  { id: 'shipments', label: 'Shipments', roles: ['Admin', 'Manager', 'Accountant'], Icon: Package },
  { id: 'updates', label: 'Updates', roles: ['Admin'], Icon: Mail },
  { id: 'settings', label: 'Settings', roles: ['Admin'], Icon: Settings },
];

const SIDEBAR_OPEN_WIDTH = 240;
const SIDEBAR_COLLAPSED_WIDTH = 64;

export const Layout: React.FC<LayoutProps> = ({
  children,
  currentView,
  onNavigate,
  user,
  onLogout,
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const visible = navItems.filter(item => item.roles.includes(user.role));

  // ⌘K / Ctrl+K to toggle command palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setPaletteOpen(open => !open);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const commandItems: CommandItem[] = visible.map(({ id, label, Icon }) => ({
    id,
    label: `Go to ${label}`,
    hint: id === currentView ? 'current' : undefined,
    Icon,
    onSelect: () => onNavigate(id),
  }));

  const currentNav = visible.find(n => n.id === currentView);
  const breadcrumbs: BreadcrumbItem[] = currentNav
    ? [
        { label: 'Affinity' },
        { label: currentNav.label },
      ]
    : [{ label: 'Affinity' }];

  useEffect(() => {
    if (!mobileOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  const navigate = (id: AppView) => {
    onNavigate(id);
    setMobileOpen(false);
  };

  const sidebarWidth = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_OPEN_WIDTH;

  const sidebarContent = (
    <>
      {/* Logo area */}
      <div
        className="flex items-center justify-center border-b border-[#292524]"
        style={{ padding: sidebarCollapsed ? '1rem 0.5rem' : '1rem' }}
      >
        {sidebarCollapsed ? (
          <div
            className="flex h-8 w-8 items-center justify-center bg-white text-sm font-bold text-black"
            aria-label="Affinity Logistics"
          >
            A
          </div>
        ) : (
          <img
            src={affinityLogo}
            alt="Affinity Logistics"
            className="block h-auto w-full bg-white"
            style={{ maxWidth: '180px', padding: '0.5rem 0.75rem' }}
          />
        )}
      </div>

      {/* Navigation */}
      <nav
        className="flex-1 overflow-y-auto overflow-x-hidden p-2"
        aria-label="Main navigation"
      >
        {visible.map(({ id, label, Icon }) => {
          const isActive = currentView === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => navigate(id)}
              title={sidebarCollapsed ? label : undefined}
              aria-current={isActive ? 'page' : undefined}
              className={[
                'group relative flex w-full items-center gap-3 transition-colors duration-150',
                'border-0 cursor-pointer mb-0.5',
                sidebarCollapsed ? 'justify-center px-3 py-3' : 'justify-start px-3 py-2.5',
                isActive
                  ? 'bg-white/[0.08] text-white font-semibold'
                  : 'bg-transparent text-[#a1a1aa] font-normal hover:bg-white/[0.04] hover:text-white focus-visible:bg-white/[0.04] focus-visible:text-white',
                'text-sm focus:outline-none focus-visible:outline-none',
              ].join(' ')}
            >
              {/* Strong left accent bar on active */}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#D97706]"
                />
              )}
              <Icon size={18} color={isActive ? '#D97706' : undefined} />
              {!sidebarCollapsed && <span>{label}</span>}
            </button>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-[#292524] p-3">
        {!sidebarCollapsed && (
          <div className="mb-2 flex items-center gap-2.5 bg-[#292524] p-3">
            <Avatar name={user.name} size="md" tone="sidebar" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-white">{user.name}</div>
              <div className="text-[11px] text-[#a1a1aa]">{user.role}</div>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          title="Sign out"
          className={[
            'flex w-full items-center gap-3 bg-transparent text-sm transition-colors',
            sidebarCollapsed ? 'justify-center px-3 py-3' : 'justify-start px-3 py-2.5',
            isLoggingOut
              ? 'cursor-not-allowed text-[#a1a1aa] opacity-60'
              : 'cursor-pointer text-[#a1a1aa] hover:bg-white/[0.06] hover:text-white focus-visible:bg-white/[0.06] focus-visible:text-white',
            'border-0 focus:outline-none',
          ].join(' ')}
        >
          <LogOut size={18} />
          {!sidebarCollapsed && <span>{isLoggingOut ? 'Signing out...' : 'Sign out'}</span>}
        </button>

        {/* Collapse toggle (desktop only, repositioned to bottom) */}
        <button
          type="button"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={[
            'mt-2 hidden lg:flex w-full items-center gap-3 bg-transparent text-sm transition-colors',
            sidebarCollapsed ? 'justify-center px-3 py-2' : 'justify-start px-3 py-2',
            'border-0 cursor-pointer text-[#666] hover:text-white focus-visible:text-white focus:outline-none',
          ].join(' ')}
        >
          {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          {!sidebarCollapsed && <span className="text-xs">Collapse</span>}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-[#F9F9F8]">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          aria-hidden="true"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Sidebar — desktop fixed, mobile drawer */}
      <aside
        ref={sidebarRef}
        aria-label="Sidebar"
        className={[
          'fixed inset-y-0 left-0 z-50 flex flex-col overflow-hidden text-white transition-transform duration-200 ease-out',
          'bg-[#1C1917]',
          // Desktop: always visible, width transitions
          'lg:translate-x-0 lg:transition-[transform,width]',
          // Mobile: slide in/out
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
        style={{ width: sidebarWidth }}
      >
        {/* Mobile close button */}
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Close sidebar"
          className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center text-[#a1a1aa] hover:text-white focus-visible:text-white focus:outline-none lg:hidden"
        >
          <X size={18} />
        </button>
        {sidebarContent}
      </aside>

      {/* Main content — only offset on desktop where sidebar is fixed */}
      <div
        className="flex min-h-screen flex-1 flex-col transition-[margin] duration-200 ease-out lg:ml-[var(--sidebar-w)]"
        style={{ ['--sidebar-w' as string]: `${sidebarWidth}px` }}
      >
        <Topbar
          user={{ name: user.name, role: user.role }}
          onMenuClick={() => setMobileOpen(true)}
          onCommandPalette={() => setPaletteOpen(true)}
        />
        <main
          id="main-content"
          className="flex-1 overflow-auto bg-[#F9F9F8] p-6"
        >
          <div className="mb-4">
            <Breadcrumbs items={breadcrumbs} />
          </div>
          {children}
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        items={commandItems}
      />
    </div>
  );
};

export default Layout;
