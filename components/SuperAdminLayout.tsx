import React, { useState } from 'react';
import {
  Content,
  Header,
  HeaderGlobalAction,
  HeaderGlobalBar,
  HeaderName,
  SideNav,
  SideNavItems,
  SideNavLink,
  SkipToContent,
  Tag,
} from '@carbon/react';
import { Logout, UserAvatar } from '@carbon/icons-react';
import type { AppUser } from '../types';

interface SuperAdminLayoutProps {
  children: React.ReactNode;
  user: AppUser;
  onLogout: () => Promise<void> | void;
  activeSection?: string;
  onSectionChange?: (section: string) => void;
}

const NAV_SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'tenants', label: 'Tenants' },
  { id: 'users', label: 'Users' },
  { id: 'logs', label: 'Audit Logs' },
  { id: 'system', label: 'System' },
  { id: 'submissions', label: 'Submissions' },
];

export const SuperAdminLayout: React.FC<SuperAdminLayoutProps> = ({
  children,
  user,
  onLogout,
  activeSection,
  onSectionChange,
}) => {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <>
      <Header aria-label="Affinity Platform Admin">
        <SkipToContent />
        <HeaderName
          href="javascript:void(0)"
          prefix=""
          onClick={(event) => event.preventDefault()}
          style={{ fontWeight: 700, letterSpacing: '0.04em' }}
        >
          Affinity Platform Admin
        </HeaderName>
        <HeaderGlobalBar>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0 0.75rem',
              color: 'var(--cds-text-on-color, #fff)',
            }}
          >
            <UserAvatar size={18} />
            <span style={{ fontSize: '0.875rem' }}>{user.email}</span>
            <Tag type="purple" size="sm">super_admin</Tag>
          </div>
          <HeaderGlobalAction
            aria-label={isLoggingOut ? 'Signing out' : 'Sign out'}
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            <Logout size={20} />
          </HeaderGlobalAction>
        </HeaderGlobalBar>
      </Header>
      <SideNav aria-label="Admin navigation" isFixedNav expanded={true}>
        <SideNavItems>
          {NAV_SECTIONS.map((section) => (
            <SideNavLink
              key={section.id}
              isActive={activeSection === section.id}
              onClick={() => onSectionChange?.(section.id)}
              href="javascript:void(0)"
            >
              {section.label}
            </SideNavLink>
          ))}
        </SideNavItems>
      </SideNav>
      <Content id="main-content" style={{ padding: 0, minHeight: '100vh', background: 'var(--cds-layer-02, #f4f4f4)' }}>
        {children}
      </Content>
    </>
  );
};

export default SuperAdminLayout;
