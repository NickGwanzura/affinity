import React, { useRef, useState } from 'react';
import {
  Header,
  HeaderMenuButton,
  HeaderName,
  HeaderNavigation,
  HeaderMenuItem,
  HeaderGlobalBar,
  HeaderGlobalAction,
  SkipToContent,
  SideNav,
  SideNavItems,
  SideNavLink,
  Content,
  Tag,
} from '@carbon/react';
import {
  ChartBar,
  Calculator,
  Money,
  Document,
  Van,
  UserMultiple,
  Settings,
  Logout,
  UserAvatar,
  Close,
} from '@carbon/icons-react';
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
  { id: 'admin',      label: 'Dashboard',    roles: ['Admin', 'Manager'],                       Icon: ChartBar },
  { id: 'accountant', label: 'Accountant',   roles: ['Admin', 'Accountant'],                    Icon: Calculator },
  { id: 'financials', label: 'Financials',   roles: ['Admin', 'Manager', 'Accountant'],         Icon: Money },
  { id: 'documents',  label: 'Documents',    roles: ['Admin', 'Manager', 'Driver'],             Icon: Document },
  { id: 'driver',     label: 'Driver Portal',roles: ['Admin', 'Driver'],                        Icon: Van },
  { id: 'clients',    label: 'Clients',      roles: ['Admin', 'Accountant'],                    Icon: UserMultiple },
  { id: 'settings',   label: 'Settings',     roles: ['Admin'],                                  Icon: Settings },
];

const roleTagType: Record<UserRole, 'purple' | 'blue' | 'teal' | 'warm-gray'> = {
  Admin:      'purple',
  Manager:    'blue',
  Accountant: 'teal',
  Driver:     'warm-gray',
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
      <Header aria-label="Affinity Logistics">
        <SkipToContent />
        <HeaderMenuButton
          aria-label={isSideNavExpanded ? 'Close navigation menu' : 'Open navigation menu'}
          onClick={() => setIsSideNavExpanded(o => !o)}
          isActive={isSideNavExpanded}
          aria-expanded={isSideNavExpanded}
        />
        <HeaderName
          href="#"
          prefix=""
          onClick={e => e.preventDefault()}
          style={{ fontWeight: 700, letterSpacing: '0.02em', maxWidth: 'calc(100vw - 9.5rem)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          Affinity&nbsp;<span style={{ color: 'var(--cds-link-inverse, #78a9ff)', fontWeight: 400 }}>Logistics</span>
        </HeaderName>

        {/* Desktop navigation */}
        <HeaderNavigation aria-label="Affinity Logistics navigation" className="hidden lg:flex">
          {visible.map(({ id, label }) => (
            <HeaderMenuItem
              key={id}
              href="#"
              isCurrentPage={currentView === id}
              onClick={(e: React.MouseEvent) => { e.preventDefault(); navigate(id); }}
            >
              {label}
            </HeaderMenuItem>
          ))}
        </HeaderNavigation>

        <HeaderGlobalBar>
          {/* User identity chip */}
          <div
            className="hidden xl:flex"
            style={{
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0 1rem',
              borderLeft: '1px solid var(--cds-border-subtle, #393939)',
              height: '100%',
              color: 'var(--cds-text-on-color, #fff)',
              fontSize: '0.875rem',
            }}
          >
            <span style={{ fontWeight: 600 }}>{user.name}</span>
            <Tag type={roleTagType[user.role] || 'gray'} size="sm">
              {user.role}
            </Tag>
          </div>

          {/* User menu toggle */}
          <HeaderGlobalAction
            aria-label={userPanelOpen ? 'Close account menu' : 'Open account menu'}
            aria-expanded={userPanelOpen}
            onClick={() => setUserPanelOpen(o => !o)}
            isActive={userPanelOpen}
          >
            {userPanelOpen ? <Close size={20} /> : <UserAvatar size={20} />}
          </HeaderGlobalAction>

          {/* Logout action */}
          <HeaderGlobalAction
            aria-label={isLoggingOut ? 'Signing out…' : 'Logout'}
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="hidden md:flex"
          >
            <Logout size={20} />
          </HeaderGlobalAction>
        </HeaderGlobalBar>

        {/* User detail panel */}
        {userPanelOpen && (
          <div
            ref={userPanelRef}
            role="dialog"
            aria-label="Account details"
            className="fixed left-2 right-2 top-14 sm:left-auto sm:right-2"
            style={{
              width: 'min(320px, calc(100vw - 1rem))',
              background: 'var(--cds-layer-01, #f4f4f4)',
              border: '1px solid var(--cds-border-subtle, #e0e0e0)',
              zIndex: 8000,
              padding: '1rem',
              boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
              
            }}
          >
            <p style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary, #525252)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Signed in as
            </p>
            <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--cds-text-primary, #161616)', marginBottom: '0.25rem' }}>
              {user.name}
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary, #525252)', marginBottom: '1rem' }}>
              {user.email}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Tag type={roleTagType[user.role] || 'gray'}>{user.role}</Tag>
              <Tag type={user.status === 'Active' ? 'green' : 'gray'}>{user.status}</Tag>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center  border border-[var(--cds-border-subtle,#c6c6c6)] bg-[var(--cds-layer,#fff)] px-4 py-3 text-sm font-semibold text-[var(--cds-text-primary,#161616)] transition-colors hover:bg-[var(--cds-layer-hover,#e8e8e8)] md:hidden"
            >
              {isLoggingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        )}

        {/* Mobile / overlay SideNav */}
        <SideNav
          aria-label="Side navigation"
          expanded={isSideNavExpanded}
          onOverlayClick={() => setIsSideNavExpanded(false)}
          isPersistent={false}
        >
          <SideNavItems>
            <div className="border-b border-[var(--cds-border-subtle,#393939)] px-4 py-4 text-[var(--cds-text-on-color,#fff)] lg:hidden">
              <p className="text-xs uppercase tracking-[0.12em]" style={{ color: 'rgba(244, 244, 244, 0.7)' }}>Signed in as</p>
              <p className="mt-2 text-sm font-semibold">{user.name}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Tag type={roleTagType[user.role] || 'gray'} size="sm">
                  {user.role}
                </Tag>
                <Tag type={user.status === 'Active' ? 'green' : 'gray'} size="sm">
                  {user.status}
                </Tag>
              </div>
            </div>
            {visible.map(({ id, label, Icon }) => (
              <SideNavLink
                key={id}
                href="#"
                renderIcon={Icon}
                isActive={currentView === id}
                onClick={(e: React.MouseEvent) => { e.preventDefault(); navigate(id); }}
              >
                {label}
              </SideNavLink>
            ))}
          </SideNavItems>
        </SideNav>
      </Header>

      <div className="fixed inset-x-0 bottom-0 z-[7000] border-t border-[var(--cds-border-subtle,#c6c6c6)] bg-[var(--cds-layer-01,#f4f4f4)]/95 backdrop-blur md:hidden">
        <nav aria-label="Primary mobile navigation" className="overflow-x-auto px-2 py-2">
          <div className="flex min-w-max items-stretch gap-2">
            {visible.map(({ id, label, Icon }) => {
              const isActive = currentView === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => navigate(id)}
                  className={`inline-flex min-h-[52px] min-w-[88px] flex-col items-center justify-center  px-3 py-2 text-[11px] font-semibold transition-colors ${
                    isActive
                      ? 'bg-[var(--cds-layer-selected,#d0e2ff)] text-[var(--cds-text-primary,#161616)]'
                      : 'bg-transparent text-[var(--cds-text-secondary,#525252)]'
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

      <Content id="main-content" className="pb-24 md:pb-0">
        {children}
      </Content>
    </>
  );
};

export default Layout;
