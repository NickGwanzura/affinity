import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';

export interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  Icon?: React.ComponentType<{ size?: number }>;
  onSelect: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  items: CommandItem[];
  placeholder?: string;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  items,
  placeholder = 'Search actions, pages…',
}) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      it =>
        it.label.toLowerCase().includes(q) ||
        (it.hint ? it.hint.toLowerCase().includes(q) : false),
    );
  }, [items, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      // Focus on next paint so the input is mounted
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(i => (filtered.length === 0 ? 0 : (i + 1) % filtered.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(i =>
          filtered.length === 0 ? 0 : (i - 1 + filtered.length) % filtered.length,
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = filtered[activeIndex];
        if (item) {
          item.onSelect();
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, filtered, activeIndex, onClose]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-cmd-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[10vh] sm:pt-[14vh]"
      onClick={onClose}
    >
      <div
        aria-hidden="true"
        className="app-modal-overlay-enter fixed inset-0 bg-black/45 backdrop-blur-[3px]"
      />
      <div
        onClick={e => e.stopPropagation()}
        className="app-modal-content-enter relative w-full max-w-xl overflow-hidden rounded-xl bg-white border border-stone-200 shadow-2xl ring-1 ring-black/5"
      >
        <div className="flex items-center gap-3 border-b border-stone-200 px-4">
          <Search className="h-4 w-4 text-zinc-400" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={placeholder}
            className="h-12 flex-1 border-0 bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-0 shadow-none"
            style={{ minHeight: '3rem' }}
            aria-label="Search commands"
            aria-controls="command-palette-list"
            aria-activedescendant={
              filtered[activeIndex] ? `cmd-${filtered[activeIndex].id}` : undefined
            }
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-stone-300 bg-stone-50 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
            ESC
          </kbd>
        </div>

        <div
          ref={listRef}
          id="command-palette-list"
          role="listbox"
          className="max-h-[50vh] overflow-y-auto py-1"
        >
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 text-zinc-400 ring-1 ring-stone-200/80">
                <Search size={18} aria-hidden="true" />
              </div>
              <p className="text-sm font-medium text-zinc-700">No matches for &ldquo;{query}&rdquo;</p>
              <p className="mt-1 text-xs text-zinc-500">Try a different search term.</p>
            </div>
          ) : (
            filtered.map((item, idx) => {
              const Icon = item.Icon;
              const isActive = idx === activeIndex;
              return (
                <button
                  key={item.id}
                  id={`cmd-${item.id}`}
                  data-cmd-index={idx}
                  role="option"
                  aria-selected={isActive}
                  type="button"
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => {
                    item.onSelect();
                    onClose();
                  }}
                  className={[
                    'relative flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors duration-100',
                    'border-0 cursor-pointer focus:outline-none',
                    isActive
                      ? 'bg-stone-100 text-zinc-900'
                      : 'bg-transparent text-zinc-600 hover:bg-stone-50',
                  ].join(' ')}
                >
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-[#D97706] shadow-[0_0_10px_rgba(217,119,6,0.4)]"
                    />
                  )}
                  {Icon && (
                    <Icon
                      size={16}
                    />
                  )}
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.hint && (
                    <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium">
                      {item.hint}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-stone-200 bg-stone-50 px-4 py-2 text-[11px] text-zinc-500">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-stone-300 bg-white px-1 py-0.5 shadow-[0_1px_0_rgba(0,0,0,0.04)]">↑↓</kbd>
              Navigate
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-stone-300 bg-white px-1 py-0.5 shadow-[0_1px_0_rgba(0,0,0,0.04)]">↵</kbd>
              Select
            </span>
          </div>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border border-stone-300 bg-white px-1 py-0.5 shadow-[0_1px_0_rgba(0,0,0,0.04)]">⌘K</kbd>
            to open
          </span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
