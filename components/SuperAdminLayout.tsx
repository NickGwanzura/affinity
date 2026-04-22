import React, { useState } from 'react';
import { LogOut, UserCircle } from 'lucide-react';
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
      {/* Skip to content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[9000] focus:bg-white focus:px-4 focus:py-2 focus:text-black"
      >
        Skip to main content
      </a>

      <header className="fixed top-0 left-0 right-0 z-[8000] flex h-12 items-center bg-[#0f62fe] text-white">
        <a
          href="javascript:void(0)"
          onClick={(event) => event.preventDefault()}
          className="px-4 text-sm font-bold tracking-wide"
        >
          Affinity Platform Admin
        </a>

        <div className="ml-auto flex h-full items-center">
          <div className="flex items-center gap-2 px-3 text-sm">
            <UserCircle size={18} />
            <span>{user.email}</span>
            <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">
              super_admin
            </span>
          </div>
          <button
            type="button"
            aria-label={isLoggingOut ? 'Signing out' : 'Sign out'}
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="inline-flex h-12 w-12 items-center justify-center hover:bg-[#353535] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Fixed sidebar */}
      <nav
        aria-label="Admin navigation"
        className="fixed top-12 left-0 bottom-0 z-[7500] w-64 border-r border-gray-200 bg-white"
      >
        <div className="flex flex-col py-2">
          {NAV_SECTIONS.map((section) => (
            <a
              key={section.id}
              href="javascript:void(0)"
              onClick={(e) => {
                e.preventDefault();
                onSectionChange?.(section.id);
              }}
              className={`px-4 py-3 text-sm ${
                activeSection === section.id
                  ? 'border-l-4 border-[#0f62fe] bg-gray-100 font-semibold text-gray-900'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
              aria-current={activeSection === section.id ? 'page' : undefined}
            >
              {section.label}
            </a>
          ))}
        </div>
      </nav>

      <main
        id="main-content"
        className="min-h-screen bg-gray-100 pt-12 pl-64"
      >
        {children}
      </main>
    </>
  );
};

export default SuperAdminLayout;
