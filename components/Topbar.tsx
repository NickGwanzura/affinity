import React from 'react';
import { Menu, Search } from 'lucide-react';
import { Avatar } from './ui/Avatar';

export interface TopbarProps {
  user: { name: string; role: string };
  onMenuClick?: () => void;
  /**
   * Triggers the global command palette. When provided, the topbar renders a
   * search-shaped button that opens the palette and shows the ⌘K hint.
   */
  onCommandPalette?: () => void;
}

const isMac =
  typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || navigator.userAgent || '');

export const Topbar: React.FC<TopbarProps> = ({
  user,
  onMenuClick,
  onCommandPalette,
}) => {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-6 border-b border-stone-200 bg-white/80 px-6 backdrop-blur lg:gap-8 lg:px-8">
      <div className="flex flex-1 items-center gap-4">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open sidebar"
            className="-ml-2 inline-flex h-10 w-10 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-stone-100 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706] lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        {onCommandPalette && (
          <button
            type="button"
            onClick={onCommandPalette}
            aria-label="Open command palette"
            className="group flex h-10 w-full max-w-xl items-center gap-3 rounded-lg border border-stone-200 bg-stone-50 px-4 text-left text-sm text-zinc-500 transition-colors hover:border-stone-300 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706]"
          >
            <Search className="h-4 w-4 text-zinc-400" aria-hidden="true" />
            <span className="flex-1 truncate">Search clients, shipments, employees…</span>
            <kbd className="hidden items-center gap-0.5 rounded border border-stone-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 sm:inline-flex">
              {isMac ? '⌘' : 'Ctrl'}K
            </kbd>
          </button>
        )}
      </div>

      <div className="flex items-center">
        <div className="flex items-center gap-3 pl-4 sm:border-l sm:border-stone-200">
          <Avatar name={user.name} size="md" tone="brand" />
          <div className="hidden flex-col leading-tight md:flex">
            <span className="text-sm font-medium text-zinc-900">{user.name}</span>
            <span className="text-xs text-zinc-500">{user.role}</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
