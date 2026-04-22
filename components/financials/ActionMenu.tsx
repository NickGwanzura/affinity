import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical } from 'lucide-react';
import { IconButton } from '../ui';

export interface ActionItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

/**
 * Lightweight row-action dropdown. Closes on outside click. Used in every
 * Financials section table.
 */
export const ActionMenu: React.FC<{ items: ActionItem[] }> = ({ items }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <div className="relative inline-block" ref={ref}>
      <IconButton
        icon={<MoreVertical size={16} />}
        size="sm"
        variant="ghost"
        label="Actions"
        onClick={() => setOpen(v => !v)}
      />
      {open && (
        <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 shadow-lg z-50">
          {items.map((item, i) => (
            <button
              key={i}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                item.danger ? 'text-red-600' : 'text-gray-700'
              }`}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
