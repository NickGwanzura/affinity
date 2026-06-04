import React, { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  Briefcase,
  Calculator,
  DollarSign,
  FileText,
  Truck,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Package,
  Mail,
  Receipt,
  X,
  LineChart,
  Banknote,
  Wallet,
  Map,
  Boxes,
  Snowflake,
  Wifi,
  ShieldCheck,
  Car,
  Building2,
  TrendingUp,
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
  | 'employees'
  | 'driver-entries'
  | 'shipments'
  | 'updates'
  | 'reports'
  | 'payslips'
  | 'funds'
  | 'trips'
  | 'assets'
  | 'freezit'
  | 'wifi-tokens'
  | 'car-hire'
  | 'ice-sales'
  | 'director'
  | 'ceo'
  | 'lodgers'
  | 'sales-pl';

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
  { id: 'admin',          label: 'Dashboard',        roles: ['Admin', 'Manager'],                    Icon: BarChart3  },
  { id: 'director',       label: 'Director',         roles: ['Admin', 'Director'],                   Icon: ShieldCheck },
  { id: 'freezit',        label: 'Freezit Sales',    roles: ['Admin', 'Sales'],                      Icon: Snowflake  },
  { id: 'wifi-tokens',    label: 'WiFi Token Sales', roles: ['Admin', 'Sales'],                      Icon: Wifi       },
  { id: 'car-hire',       label: 'Car Hire',         roles: ['Admin', 'Car Hire'],                    Icon: Car        },
  { id: 'ice-sales',      label: 'Ice Sales',        roles: ['Admin', 'Sales'],                      Icon: Snowflake   },
  { id: 'lodgers',        label: 'Lodgers',          roles: ['Admin', 'Sales'],                      Icon: Building2   },
  { id: 'sales-pl',       label: 'Sales P&L',        roles: ['Admin', 'Sales'],                      Icon: TrendingUp  },
  { id: 'accountant',     label: 'Accountant',       roles: ['Admin', 'Accountant'],                 Icon: Calculator },
  { id: 'financials',     label: 'Financials',       roles: ['Admin', 'Manager', 'Accountant'],      Icon: DollarSign },
  { id: 'reports',        label: 'Reports',          roles: ['Admin', 'Manager', 'Accountant'],      Icon: LineChart  },
  { id: 'clients',        label: 'Clients',          roles: ['Admin', 'Accountant'],                 Icon: Users      },
  { id: 'shipments',      label: 'Shipments',        roles: ['Admin', 'Manager', 'Accountant'],      Icon: Package    },
  { id: 'trips',          label: 'Trip Planner',     roles: ['Admin', 'Manager'],                    Icon: Map        },
  { id: 'driver',         label: 'Driver Portal',    roles: ['Admin', 'Driver'],                     Icon: Truck      },
  { id: 'driver-entries', label: 'Driver Entries',   roles: ['Admin', 'Manager'],                    Icon: Receipt    },
  { id: 'documents',      label: 'Documents',        roles: ['Admin', 'Manager', 'Driver'],          Icon: FileText   },
  { id: 'employees',      label: 'Employees',        roles: ['Admin', 'Manager'],                    Icon: Briefcase  },
  { id: 'payslips',       label: 'Payslips',         roles: ['Admin', 'Manager'],                    Icon: Banknote   },
  { id: 'funds',          label: 'Operating Funds',  roles: ['Admin', 'Accountant', 'Manager'],      Icon: Wallet     },
  { id: 'assets',         label: 'Asset Register',   roles: ['Admin', 'Manager'],                    Icon: Boxes      },
  { id: 'ceo',            label: 'CEO Dashboard',    roles: ['Admin', 'CEO'],                        Icon: LineChart  },
  { id: 'updates',        label: 'Updates',          roles: ['Admin'],                               Icon: Mail       },
  { id: 'settings',       label: 'Settings',         roles: ['Admin'],                               Icon: Settings   },
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
        className="flex items-center justify-center border-b border-[#292524]/80"
        style={{ padding: sidebarCollapsed ? '0.875rem 0.5rem' : '1rem' }}
      >
        {sidebarCollapsed ? (
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#D97706] text-sm font-bold text-white shadow-sm"
            aria-label="Affinity Logistics"
          >
            A
          </div>
        ) : (
          <img
            src={affinityLogo}
            alt="Affinity Logistics"
            className="block h-auto w-full"
            style={{ maxWidth: '160px', filter: 'brightness(0) invert(1)' }}
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
                'group relative flex w-full items-center gap-3 rounded-lg transition-[background-color,color] duration-150',
                'border-0 cursor-pointer mb-0.5',
                sidebarCollapsed ? 'justify-center px-3 py-3' : 'justify-start px-3 py-2.5',
                isActive
                  ? 'bg-white/[0.08] text-white font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
                  : 'bg-transparent text-[#a1a1aa] font-normal hover:bg-white/[0.05] hover:text-white focus-visible:bg-white/[0.05] focus-visible:text-white',
                'text-sm focus:outline-none focus-visible:outline-none',
              ].join(' ')}
            >
              {/* Strong left accent bar on active — anchored slightly inset for refined feel */}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-[#D97706] shadow-[0_0_12px_rgba(217,119,6,0.45)]"
                />
              )}
              <Icon size={18} color={isActive ? '#D97706' : undefined} />
              {!sidebarCollapsed && <span className="truncate">{label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Sidebar footer — identity card + collapse toggle. Logout has moved
          to the topbar avatar menu (Linear/Stripe pattern). */}
      <div className="border-t border-[#292524]/80 p-3">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2.5 rounded-md bg-gradient-to-br from-[#2a2724] to-[#1f1c1a] p-2.5 ring-1 ring-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <Avatar name={user.name} size="md" tone="sidebar" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-white">{user.name}</div>
              <div className="text-[11px] text-[#a1a1aa]">{user.role}</div>
            </div>
          </div>
        )}

        {/* Collapse toggle (desktop only) */}
        <button
          type="button"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={[
            'mt-2 hidden lg:flex w-full items-center gap-3 rounded-lg bg-transparent text-xs transition-colors duration-150',
            sidebarCollapsed ? 'justify-center px-3 py-1.5' : 'justify-start px-3 py-1.5',
            'border-0 cursor-pointer text-[#71717a] hover:text-white hover:bg-white/[0.04] focus-visible:text-white focus-visible:bg-white/[0.04] focus:outline-none',
          ].join(' ')}
        >
          {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          {!sidebarCollapsed && <span>Collapse</span>}
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
          className="app-fade-in fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Sidebar — desktop fixed, mobile drawer */}
      <aside
        ref={sidebarRef}
        aria-label="Sidebar"
        className={[
          'fixed inset-y-0 left-0 z-50 flex flex-col overflow-hidden text-white shadow-2xl shadow-black/30 lg:shadow-none',
          'bg-[#1C1917]',
          'transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
          // Desktop: always visible, width transitions
          'lg:translate-x-0 lg:transition-[transform,width] lg:duration-200 lg:ease-out',
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
          className="absolute right-2 top-2 z-10 flex h-10 w-10 items-center justify-center rounded-lg text-[#a1a1aa] hover:bg-white/[0.06] hover:text-white focus-visible:bg-white/[0.06] focus-visible:text-white focus:outline-none lg:hidden"
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
          onLogout={handleLogout}
        />
        <main
          id="main-content"
          className="flex-1 overflow-auto bg-[#F9F9F8] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8"
        >
          <div className="mb-4 sm:mb-5 lg:mb-6">
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
