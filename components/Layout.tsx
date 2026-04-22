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
  ChevronLeft,
  ChevronRight,
  Package,
  Mail,
} from 'lucide-react';
import { AppUser, UserRole } from '../types';
import affinityLogo from '../assets/affinity-logo.svg';
import { Topbar } from './Topbar';

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

const roleTagClass: Record<UserRole, string> = {
  Admin: 'bg-purple-100 text-purple-800',
  Manager: 'bg-blue-100 text-blue-800',
  Accountant: 'bg-teal-100 text-teal-800',
  Driver: 'bg-gray-100 text-gray-800',
};

export const Layout: React.FC<LayoutProps> = ({
  children,
  currentView,
  onNavigate,
  user,
  onLogout,
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const visible = navItems.filter(item => item.roles.includes(user.role));

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
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F9F9F8' }}>
      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          width: sidebarCollapsed ? '64px' : '240px',
          background: '#1C1917',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.2s ease',
          zIndex: 100,
          overflow: 'hidden',
        }}
      >
        {/* Logo area */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: sidebarCollapsed ? '1rem 0.5rem' : '1rem',
            borderBottom: '1px solid #292524',
          }}
        >
          {sidebarCollapsed ? (
            <div
              style={{
                width: '32px',
                height: '32px',
                background: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.875rem',
                fontWeight: 700,
                color: '#000',
                letterSpacing: '0',
              }}
              aria-label="Affinity Logistics"
            >
              A
            </div>
          ) : (
            <img
              src={affinityLogo}
              alt="Affinity Logistics"
              style={{
                width: '100%',
                maxWidth: '180px',
                height: 'auto',
                background: '#fff',
                padding: '0.5rem 0.75rem',
                display: 'block',
              }}
            />
          )}
        </div>

        {/* Navigation */}
        <nav
          style={{
            flex: 1,
            padding: '0.5rem',
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
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
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  width: '100%',
                  padding: sidebarCollapsed ? '0.75rem' : '0.625rem 0.75rem',
                  justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                  background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: isActive ? '#fff' : '#a8a8a8',
                  border: 'none',
                  borderRadius: 0,
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: isActive ? 600 : 400,
                  transition: 'background 0.15s ease, color 0.15s ease',
                  marginBottom: '2px',
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    e.currentTarget.style.color = '#fff';
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    e.currentTarget.style.color = '#a8a8a8';
                  }
                }}
              >
                <Icon
                  size={18}
                  color={isActive ? '#D97706' : undefined}
                />
                {!sidebarCollapsed && <span>{label}</span>}
                {isActive && !sidebarCollapsed && (
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      top: '50%',
                      right: '14px',
                      transform: 'translateY(-50%)',
                      width: '4px',
                      height: '4px',
                      background: '#D97706',
                      borderRadius: '9999px',
                    }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* User section */}
        <div
          style={{
            padding: '0.75rem',
            borderTop: '1px solid #292524',
          }}
        >
          {!sidebarCollapsed && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                padding: '0.75rem',
                marginBottom: '0.5rem',
                background: '#292524',
                borderRadius: 0,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.625rem',
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: '#44403C',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#fff',
                    flexShrink: 0,
                  }}
                >
                  {user.name
                    .split(' ')
                    .map(n => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                      color: '#fff',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {user.name}
                  </div>
                  <div
                    style={{
                      fontSize: '0.6875rem',
                      color: '#a8a8a8',
                    }}
                  >
                    {user.role}
                  </div>
                </div>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            title="Sign out"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              gap: '0.75rem',
              width: '100%',
              padding: sidebarCollapsed ? '0.75rem' : '0.625rem 0.75rem',
              background: 'transparent',
              color: '#a8a8a8',
              border: 'none',
              borderRadius: 0,
              cursor: isLoggingOut ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              transition: 'background 0.15s ease, color 0.15s ease',
              opacity: isLoggingOut ? 0.6 : 1,
            }}
            onMouseEnter={e => {
              if (!isLoggingOut) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                e.currentTarget.style.color = '#fff';
              }
            }}
            onMouseLeave={e => {
              if (!isLoggingOut) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#a8a8a8';
              }
            }}
          >
            <LogOut size={18} />
            {!sidebarCollapsed && <span>{isLoggingOut ? 'Signing out...' : 'Sign out'}</span>}
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          type="button"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            position: 'absolute',
            top: '50%',
            right: '-12px',
            transform: 'translateY(-50%)',
            width: '24px',
            height: '24px',
            background: '#1C1917',
            border: '1px solid #44403C',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#666',
            transition: 'color 0.15s ease, border-color 0.15s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = '#fff';
            e.currentTarget.style.borderColor = '#666';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = '#666';
            e.currentTarget.style.borderColor = '#333';
          }}
        >
          {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </aside>

      {/* Main content */}
      <div
        style={{
          flex: 1,
          marginLeft: sidebarCollapsed ? '64px' : '240px',
          transition: 'margin-left 0.2s ease',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Topbar user={{ name: user.name, role: user.role }} hasUnread={false} />
        <main
          id="main-content"
          style={{
            flex: 1,
            padding: '1.5rem',
            overflow: 'auto',
            background: '#F9F9F8',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
