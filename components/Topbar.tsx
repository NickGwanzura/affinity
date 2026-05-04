import React from 'react';
import { Menu, Search, User, LogOut } from 'lucide-react';
import { Avatar } from './ui/Avatar';
import { OverflowMenu, OverflowMenuItem } from './ui/OverflowMenu';

export interface TopbarProps {
  user: { name: string; role: string };
  onMenuClick?: () => void;
  /**
   * Triggers the global command palette. When provided, the topbar renders a
   * search-shaped button that opens the palette and shows the ⌘K hint.
   */
  onCommandPalette?: () => void;
  /** Optional page title shown between the menu button and the search box. */
  pageTitle?: string;
  /** When provided, the user menu shows a "Profile" item. */
  onProfile?: () => void;
  /** When provided, the user menu shows a "Logout" item. */
  onLogout?: () => void;
}

// isMac: uses userAgentData when available; falls back to userAgent string.
// SSR-safe (typeof navigator guard).
const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/i.test(
    (
      navigator as unknown as { userAgentData?: { platform?: string } }
    ).userAgentData?.platform ||
      navigator.userAgent ||
      ''
  );

/** Pretty-print a raw role string. */
function formatRole(role: string): string {
  const map: Record<string, string> = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    user: 'User',
  };
  return map[role] ?? role;
}

export const Topbar: React.FC<TopbarProps> = ({
  user,
  onMenuClick,
  onCommandPalette,
  pageTitle,
  onProfile,
  onLogout,
}) => {
  const hasMenu = onProfile !== undefined || onLogout !== undefined;

  // Avatar wrapped as a renderIcon-compatible component (ignores numeric size prop)
  const AvatarIcon: React.FC<{ size?: number }> = () => (
    <Avatar name={user.name} size="md" tone="brand" />
  );

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-stone-200/80 bg-white/75 px-4 shadow-[0_1px_0_rgba(0,0,0,0.02)] backdrop-blur-md backdrop-saturate-150 supports-[backdrop-filter]:bg-white/65 sm:gap-6 sm:px-6 lg:gap-8 lg:px-8">
      {/* Skip-to-content link — first focusable element */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-1.5 focus:text-sm focus:font-medium focus:text-zinc-900 focus:shadow focus-visible:ring-2 focus-visible:ring-[var(--cds-interactive,#D97706)]"
      >
        Skip to content
      </a>

      <div className="flex flex-1 items-center gap-3 sm:gap-4 min-w-0">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open sidebar"
            className="-ml-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-stone-100 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cds-interactive,#D97706)] lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        {pageTitle && (
          <h1 className="shrink-0 text-base font-semibold text-zinc-900 sm:text-lg">
            {pageTitle}
          </h1>
        )}

        {onCommandPalette && (
          <button
            type="button"
            onClick={onCommandPalette}
            aria-label="Open command palette"
            className="group flex h-10 w-full max-w-xl items-center justify-start gap-2.5 rounded-lg border border-stone-200 bg-stone-50/80 px-3 text-left text-sm text-zinc-500 transition-[background-color,border-color,box-shadow] duration-150 hover:border-stone-300 hover:bg-white hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cds-interactive,#D97706)] sm:px-4"
          >
            <Search className="h-4 w-4 shrink-0 text-zinc-400 transition-colors group-hover:text-zinc-500" aria-hidden="true" />
            <span className="flex-1 truncate text-zinc-500 group-hover:text-zinc-600">
              <span className="hidden sm:inline">Search clients, shipments, employees…</span>
              <span className="sm:hidden">Search…</span>
            </span>
            <kbd className="ml-auto hidden items-center gap-0.5 rounded border border-stone-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 shadow-[0_1px_0_rgba(0,0,0,0.04)] sm:inline-flex">
              {isMac ? '⌘' : 'Ctrl'}K
            </kbd>
          </button>
        )}
      </div>

      <div className="flex items-center shrink-0">
        <div className="flex items-center gap-3 pl-3 sm:pl-4 sm:border-l sm:border-stone-200">
          {hasMenu ? (
            <OverflowMenu
              ariaLabel="Open user menu"
              flipped
              renderIcon={AvatarIcon}
            >
              {onProfile && (
                <OverflowMenuItem
                  itemText={
                    <span className="flex items-center gap-2">
                      <User size={14} aria-hidden="true" />
                      Profile
                    </span>
                  }
                  onClick={onProfile}
                />
              )}
              {onLogout && (
                <OverflowMenuItem
                  itemText={
                    <span className="flex items-center gap-2">
                      <LogOut size={14} aria-hidden="true" />
                      Logout
                    </span>
                  }
                  onClick={onLogout}
                />
              )}
            </OverflowMenu>
          ) : (
            <button
              type="button"
              aria-label={`Open user menu — ${user.name}`}
              aria-haspopup="menu"
              title={user.name}
              className="inline-flex items-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cds-interactive,#D97706)]"
            >
              <Avatar name={user.name} size="md" tone="brand" />
            </button>
          )}
          <div className="hidden flex-col leading-tight md:flex">
            <span className="text-sm font-medium text-zinc-900">{user.name}</span>
            <span className="text-xs text-zinc-500">{formatRole(user.role)}</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
