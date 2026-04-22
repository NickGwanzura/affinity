import React, { useState } from 'react';
import { Bell, Search } from 'lucide-react';

export interface TopbarProps {
  user: { name: string; role: string };
  hasUnread?: boolean;
  onSearch?: (query: string) => void;
}

/**
 * Topbar shell. Sticky row above the main content.
 * Left: optional search input. Right: bell + square amber avatar + name/role.
 * Visual-only: no menus or auth wiring. Port of coolpro2026's Topbar.
 */
export const Topbar: React.FC<TopbarProps> = ({ user, hasUnread = false, onSearch }) => {
  const [query, setQuery] = useState('');

  const initials = user.name
    .split(' ')
    .map(part => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSearch?.(query);
  };

  return (
    <header className="sticky top-0 z-30 h-14 bg-white border-b border-[#E7E5E4] flex items-center justify-between px-6">
      <div className="flex items-center gap-4 flex-1 max-w-md">
        {onSearch && (
          <form onSubmit={handleSubmit} className="relative w-full">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A8A29E] pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search..."
              className="w-full h-9 pl-9 pr-3 text-sm bg-[#f4f4f4] border border-transparent text-[#1C1917] placeholder:text-[#A8A29E] focus:outline-none focus:border-[#D97706]"
              aria-label="Search"
            />
          </form>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="relative p-2 text-[#78716C] hover:text-[#1C1917] hover:bg-[#F5F5F4] transition-colors"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {hasUnread && (
            <span
              aria-hidden="true"
              className="absolute top-1.5 right-1.5 h-1.5 w-1.5 bg-[#D97706]"
            />
          )}
        </button>

        <div className="flex items-center gap-2 pl-3 border-l border-[#E7E5E4]">
          <div
            aria-hidden="true"
            className="h-8 w-8 bg-[#D97706] flex items-center justify-center text-white text-xs font-bold"
          >
            {initials || 'U'}
          </div>
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
