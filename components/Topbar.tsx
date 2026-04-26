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
    <header className="sticky top-0 z-30 h-14 bg-white border-b border-[#E7E5E4] flex items-center justify-between px-4 lg:px-6">
      <div className="flex items-center gap-3 flex-1 max-w-md">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open sidebar"
            className="lg:hidden p-2 -ml-2 text-[#78716C] hover:text-[#1C1917] hover:bg-[#F5F5F4] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706]"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        {onCommandPalette && (
          <button
            type="button"
            onClick={onCommandPalette}
            aria-label="Open command palette"
            className="group relative flex h-9 w-full items-center gap-2 bg-[#F5F5F4] px-3 text-left text-sm text-[#78716C] hover:bg-[#EDEBE9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706] transition-colors"
          >
            <Search className="h-4 w-4 text-[#A8A29E]" aria-hidden="true" />
            <span className="flex-1 truncate">Search…</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 border border-[#E7E5E4] bg-white px-1.5 py-0.5 text-[10px] font-medium text-[#78716C]">
              {isMac ? '⌘' : 'Ctrl'}K
            </kbd>
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Avatar name={user.name} size="md" tone="brand" />
          <div className="hidden md:flex flex-col leading-tight">
            <span className="text-sm font-medium text-[#1C1917]">{user.name}</span>
            <span className="text-xs text-[#78716C]">{user.role}</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
