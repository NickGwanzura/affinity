import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export type ModalSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

const sizeClasses: Record<ModalSize, string> = {
  xs: 'max-w-sm',
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
  '2xl': 'max-w-7xl',
};

interface ModalProps {
  isOpen:   boolean;
  onClose:  () => void;
  title?:   string;
  label?:   string;
  size?:    ModalSize;
  children: React.ReactNode;
  footer?:  React.ReactNode;
  preventCloseOnClickOutside?: boolean;
  danger?:  boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  label,
  size = 'lg',
  children,
  footer,
  preventCloseOnClickOutside = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), ' +
      'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const getFocusable = (): HTMLElement[] => {
      if (!dialogRef.current) return [];
      const nodeList = dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector);
      const result: HTMLElement[] = [];
      nodeList.forEach((el) => {
        if (!el.hasAttribute('aria-hidden')) result.push(el);
      });
      return result;
    };

    const focusFirst = () => {
      const items = getFocusable();
      const target =
        items.find((el) => el.getAttribute('aria-label') !== 'Close') ?? items[0] ?? dialogRef.current;
      target?.focus();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = getFocusable();
      if (items.length === 0) {
        e.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(focusFirst, 0);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      previouslyFocused?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const onBackdrop = (e: React.MouseEvent) => {
    if (preventCloseOnClickOutside) return;
    if (e.target === containerRef.current) onClose();
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={onBackdrop}
      role="dialog"
      aria-modal="true"
      aria-label={title ?? label}
      className="app-modal-overlay-enter fixed inset-0 z-[9000] flex items-end justify-center bg-black/55 backdrop-blur-[3px] sm:items-center sm:p-4"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`app-modal-content-enter flex max-h-[95dvh] w-full flex-col bg-white shadow-2xl ring-1 ring-black/5 outline-none rounded-t-2xl sm:max-h-[90vh] sm:rounded-xl ${sizeClasses[size]}`}
        onMouseDown={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Mobile drag-handle affordance — purely decorative dismissibility cue. */}
        <div
          aria-hidden="true"
          className="mx-auto mt-2.5 mb-0.5 h-1 w-10 shrink-0 rounded-full bg-stone-300 sm:hidden"
        />
        {(title || label) && (
          <div className="flex items-start justify-between gap-4 border-b border-stone-200 px-5 py-4 sm:px-8 sm:py-6">
            <div className="min-w-0">
              {label && (
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#D97706]">
                  {label}
                </p>
              )}
              {title && (
                <h2 className="mt-1 text-lg font-semibold tracking-tight text-zinc-900 truncate sm:text-xl">
                  {title}
                </h2>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-m-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-stone-100 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706] sm:h-9 sm:w-9"
            >
              <X size={20} />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-7">{children}</div>

        {footer && (
          <div className="border-t border-stone-200 bg-stone-50/60 px-5 py-4 sm:px-8 sm:py-5">{footer}</div>
        )}
      </div>
    </div>
  );
};

export default Modal;
