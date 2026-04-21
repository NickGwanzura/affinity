import React, { useEffect, useRef, useState } from 'react';
import { MoreVertical } from 'lucide-react';

interface OverflowMenuProps {
  children:    React.ReactNode;
  size?:       'sm' | 'md' | 'lg';
  className?:  string;
  ariaLabel?:  string;
  flipped?:    boolean;
  renderIcon?: React.ComponentType<{ size?: number }>;
}

export const OverflowMenu: React.FC<OverflowMenuProps> = ({
  children, size = 'md', className = '', ariaLabel = 'Options', flipped, renderIcon: RenderIcon,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const btnSize = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-12 w-12' : 'h-10 w-10';

  return (
    <div ref={ref} className={`relative inline-block ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center justify-center ${btnSize} text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500`}
      >
        {RenderIcon ? <RenderIcon size={16} /> : <MoreVertical size={16} />}
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute z-50 mt-1 min-w-[10rem] border border-gray-200 bg-white py-1 shadow-lg ${
            flipped ? 'left-0' : 'right-0'
          }`}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
};

interface OverflowMenuItemProps {
  itemText:   React.ReactNode;
  onClick?:   () => void;
  disabled?:  boolean;
  hasDivider?: boolean;
  isDelete?:  boolean;
  className?: string;
}
export const OverflowMenuItem: React.FC<OverflowMenuItemProps> = ({
  itemText, onClick, disabled, hasDivider, isDelete, className = '',
}) => (
  <>
    {hasDivider && <div className="my-1 border-t border-gray-200" />}
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed ${
        isDelete ? 'text-red-600 hover:bg-red-50' : 'text-gray-800'
      } ${className}`}
    >
      {itemText}
    </button>
  </>
);
