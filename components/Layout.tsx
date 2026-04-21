import React, { useRef, useState } from 'react';
import {
  BarChart3,
  Calculator,
  DollarSign,
  FileText,
  Truck,
  Users,
  Settings,
  LogOut,
  UserCircle,
  X,
  Menu,
} from 'lucide-react';
import { AppUser, UserRole } from '../types';

export type AppView = 'admin' | 'driver' | 'accountant' | 'settings' | 'financials' | 'documents' | 'clients';

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
  { id: 'admin',      label: 'Dashboard',    roles: ['Admin', 'Manager'],                       Icon: BarChart3 },
  { id: 'accountant', label: 'Accountant',   roles: ['Admin', 'Accountant'],                    Icon: Calculator },
  { id: 'financials', label: 'Financials',   roles: ['Admin', 'Manager', 'Accountant'],         Icon: DollarSign },
  { id: 'documents',  label: 'Documents',    roles: ['Admin', 'Manager', 'Driver'],             Icon: FileText },
  { id: 'driver',     label: 'Driver Portal',roles: ['Admin', 'Driver'],                        Icon: Truck },
  { id: 'clients',    label: 'Clients',      roles: ['Admin', 'Accountant'],                    Icon: Users },
  { id: 'settings',   label: 'Settings',     roles: ['Admin'],                                  Icon: Settings },
];

const roleTagClass: Record<UserRole, string> = {
  Admin:      'bg-purple-100 text-purple-800',
  Manager:    'bg-blue-100 text-blue-800',
  Accountant: 'bg-teal-100 text-teal-800',
  Driver:     'bg-gray-100 text-gray-800',
};

export const Layout: React.FC<LayoutProps> = ({ children, currentView, onNavigate, user, onLogout }) => {
  const [isSideNavExpanded, setIsSideNavExpanded] = useState(false);
  const [userPanelOpen, setUserPanelOpen]         = useState(false);
  const [isLoggingOut, setIsLoggingOut]           = useState(false);
  const userPanelRef = useRef<HTMLDivElement>(null);

  const visible = navItems.filter(item => item.roles.includes(user.role));

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setIsLoggingOut(false);
      setUserPanelOpen(false);
    }
  };

  const navigate = (id: AppView) => {
    onNavigate(id);
    setIsSideNavExpanded(false);
  };

  return (
    <>
      {/* Skip to content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[9000] focus:bg-white focus:px-4 focus:py-2 focus:text-black"
      >
        Skip to main content
      </a>

      <header className="fixed top-0 left-0 right-0 z-[8000] flex h-12 items-center bg-[#161616] text-white">
        {/* Hamburger menu button */}
        <button
          type="button"
          aria-label={isSideNavExpanded ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={isSideNavExpanded}
          onClick={() => setIsSideNavExpanded(o => !o)}
          className="inline-flex h-12 w-12 items-center justify-center hover:bg-[#353535] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
        >
          {isSideNavExpanded ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* Logo / HeaderName */}
        <a
          href="#"
          onClick={e => e.preventDefault()}
          className="px-4 text-sm font-bold tracking-wide"
          style={{ maxWidth: 'min(200px, calc(100vw - 7rem))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          Affinity&nbsp;<span className="font-normal text-blue-300">Logistics</span>
        </a>

        {/* Desktop navigation */}
        <nav aria-label="Affinity Logistics navigation" className="hidden lg:flex">
          {visible.map(({ id, label }) => (
            <a
              key={id}
              href="#"
              onClick={(e: React.MouseEvent) => { e.preventDefault(); navigate(id); }}
              className={`px-4 py-3 text-sm ${currentView === id ? 'border-b-2 border-white font-semibold' : 'hover:bg-[#353535]'}`}
              aria-current={currentView === id ? 'page' : undefined}
            >
              {label}
            </a>
          ))}
        </nav>

        {/* Global bar */}
        <div className="ml-auto flex h-full items-center">
          {/* User identity chip */}
          <div className="hidden h-full items-center gap-2 border-l border-gray-600 px-4 text-sm xl:flex">
            <span className="font-semibold">{user.name}</span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${roleTagClass[user.role] || 'bg-gray-100 text-gray-800'}`}>
              {user.role}
            </span>
          </div>

          {/* User menu toggle */}
          <button
            type="button"
            aria-label={userPanelOpen ? 'Close account menu' : 'Open account menu'}
            aria-expanded={userPanelOpen}
            onClick={() => setUserPanelOpen(o => !o)}
            className={`inline-flex h-12 w-12 items-center justify-center ${userPanelOpen ? 'bg-[#353535]' : 'hover:bg-[#353535]'} focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white`}
          >
            {userPanelOpen ? <X size={20} /> : <UserCircle size={20} />}
          </button>

          {/* Logout action */}
          <button
            type="button"
            aria-label={isLoggingOut ? 'Signing out…' : 'Logout'}
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="hidden h-12 w-12 items-center justify-center hover:bg-[#353535] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white md:inline-flex"
          >
            <LogOut size={20} />
          </button>
        </div>

        {/* User detail panel */}
        {userPanelOpen && (
          <div
            ref={userPanelRef}
            role="dialog"
            aria-label="Account details"
            className="fixed left-2 right-2 top-12 z-[8000] p-4 sm:left-auto sm:right-2 sm:w-80"
            style={{
              width: 'min(320px, calc(100vw - 1rem))',
              background: '#f4f4f4',
              border: '1px solid #e0e0e0',
              boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            }}
          >
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
              Signed in as
            </p>
            <p className="mb-1 text-sm font-semibold text-gray-900">{user.name}</p>
            <p className="mb-4 text-xs text-gray-500">{user.email}</p>
            <div className="flex flex-wrap gap-2">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${roleTagClass[user.role] || 'bg-gray-100 text-gray-800'}`}>
                {user.role}
              </span>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${user.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                {user.status}
              </span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="mt-4 inline-flex h-11 w-full items-center justify-center border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-100 md:hidden"
            >
              {isLoggingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        )}

        {/* Mobile / overlay SideNav */}
        {isSideNavExpanded && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-[7500] bg-black/50"
              onClick={() => setIsSideNavExpanded(false)}
              aria-hidden="true"
            />
            <nav
              aria-label="Side navigation"
              className="fixed top-12 left-0 bottom-0 z-[7600] w-64 bg-[#161616] text-white"
            >
              <div className="border-b border-gray-700 px-4 py-4 lg:hidden">
                <p className="text-xs uppercase tracking-widest text-gray-400">Signed in as</p>
                <p className="mt-2 text-sm font-semibold">{user.name}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${roleTagClass[user.role] || 'bg-gray-100 text-gray-800'}`}>
                    {user.role}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${user.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {user.status}
                  </span>
                </div>
              </div>
              <div className="flex flex-col py-2">
                {visible.map(({ id, label, Icon }) => (
                  <a
                    key={id}
                    href="#"
                    onClick={(e: React.MouseEvent) => { e.preventDefault(); navigate(id); }}
                    className={`flex items-center gap-3 px-4 py-3 text-sm ${currentView === id ? 'border-l-4 border-white bg-[#353535] font-semibold' : 'hover:bg-[#353535]'}`}
                    aria-current={currentView === id ? 'page' : undefined}
                  >
                    <Icon size={18} />
                    {label}
                  </a>
                ))}
              </div>
            </nav>
          </>
        )}
      </header>

      {/* Mobile bottom nav */}
      <div className="fixed inset-x-0 bottom-0 z-[7000] border-t border-gray-300 bg-white/95 backdrop-blur md:hidden">
        <nav aria-label="Primary mobile navigation" className="overflow-x-auto px-2 py-2">
          <div className="flex min-w-max items-stretch gap-2">
            {visible.map(({ id, label, Icon }) => {
              const isActive = currentView === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => navigate(id)}
                  className={`inline-flex min-h-[52px] min-w-[88px] flex-col items-center justify-center px-3 py-2 text-[11px] font-semibold transition-colors ${
                    isActive
                      ? 'bg-blue-100 text-gray-900'
                      : 'bg-transparent text-gray-500'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon size={18} />
                  <span className="mt-1 whitespace-nowrap">{label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      <main id="main-content" className="pt-12 pb-24 md:pb-0">
        {children}
      </main>
    </>
  );
};

export default Layout;
