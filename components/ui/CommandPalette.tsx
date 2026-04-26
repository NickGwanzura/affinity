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
      className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh]"
      onClick={onClose}
    >
      <div
        aria-hidden="true"
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
      />
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-xl bg-white border border-[#E7E5E4] shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-[#E7E5E4] px-4">
          <Search className="h-4 w-4 text-[#A8A29E]" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={placeholder}
            className="h-12 flex-1 border-0 bg-transparent text-sm text-[#1C1917] placeholder:text-[#A8A29E] focus:outline-none focus:ring-0"
            aria-label="Search commands"
            aria-controls="command-palette-list"
            aria-activedescendant={
              filtered[activeIndex] ? `cmd-${filtered[activeIndex].id}` : undefined
            }
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 border border-[#E7E5E4] bg-[#F5F5F4] px-1.5 py-0.5 text-[10px] font-medium text-[#78716C]">
            ESC
          </kbd>
        </div>

        <div
          ref={listRef}
          id="command-palette-list"
          role="listbox"
          className="max-h-[50vh] overflow-y-auto"
        >
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-[#78716C]">
              No matches for &ldquo;{query}&rdquo;.
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
                    'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors',
                    'border-0 cursor-pointer focus:outline-none',
                    isActive
                      ? 'bg-[#F5F5F4] text-[#1C1917]'
                      : 'bg-transparent text-[#525252] hover:bg-[#F5F5F4]',
                  ].join(' ')}
                >
                  {isActive && (
                    <span aria-hidden="true" className="absolute left-0 h-6 w-[3px] bg-[#D97706]" />
                  )}
                  {Icon && <Icon size={16} />}
                  <span className="flex-1">{item.label}</span>
                  {item.hint && (
                    <span className="text-xs text-[#A8A29E]">{item.hint}</span>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[#E7E5E4] bg-[#FAFAF9] px-4 py-2 text-[11px] text-[#78716C]">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="border border-[#E7E5E4] bg-white px-1 py-0.5">↑↓</kbd> Navigate
            </span>
            <span>
              <kbd className="border border-[#E7E5E4] bg-white px-1 py-0.5">↵</kbd> Select
            </span>
          </div>
          <span>
            <kbd className="border border-[#E7E5E4] bg-white px-1 py-0.5">⌘K</kbd> to open
          </span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
