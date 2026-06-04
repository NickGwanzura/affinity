import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

/**
 * Modal sizes matching Stripe/Linear premium SaaS standards:
 *   sm = 420px — confirmations, quick actions
 *   md = 640px — simple forms
 *   lg = 800px — operational forms
 *   xl = 1100px — data-heavy workflows
 */
const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-[420px]',
  md: 'max-w-[640px]',
  lg: 'max-w-[800px]',
  xl: 'max-w-[1100px]',
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
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  label,
  size = 'md',
  children,
  footer,
  preventCloseOnClickOutside = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const scrollY = window.scrollY;

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
        onCloseRef.current();
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

    // Prevent iOS rubber-band scroll on the body
    const preventTouchMove = (e: TouchEvent) => {
      if (e.target && dialogRef.current?.contains(e.target as Node)) {
        return;
      }
      e.preventDefault();
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('touchmove', preventTouchMove, { passive: false });

    const prevOverflow = document.body.style.overflow;
    const prevPosition = document.body.style.position;
    const prevTop = document.body.style.top;
    const prevWidth = document.body.style.width;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';

    const focusTimer = window.setTimeout(focusFirst, 0);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('touchmove', preventTouchMove);
      document.body.style.overflow = prevOverflow;
      document.body.style.position = prevPosition;
      document.body.style.top = prevTop;
      document.body.style.width = prevWidth;
      window.scrollTo(0, scrollY);
      previouslyFocused?.focus?.();
    };
  }, [isOpen]);

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
      className="fixed inset-0 z-[9000] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4 app-modal-overlay-enter"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`
          flex w-full flex-col bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_12px_40px_rgba(0,0,0,0.12)] outline-none
          /* Mobile: full-screen sheet with top drag handle */
          max-h-[100dvh] rounded-t-2xl
          /* Desktop: centered modal with max-width constraint */
          sm:max-h-[90vh] sm:rounded-xl sm:mx-auto
          ${sizeClasses[size]}
          app-modal-content-enter
        `}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Mobile drag-handle affordance */}
        <div
          aria-hidden="true"
          className="mx-auto mt-2 mb-1 h-1 w-10 shrink-0 rounded-full bg-stone-300 sm:hidden"
        />

        {/* ── Sticky Header ─────────────────────────────────────────────── */}
        {(title || label) && (
          <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-stone-200 bg-white px-5 py-3 sm:px-6 sm:py-3">
            <div className="min-w-0 flex-1">
              {label && (
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-600">
                  {label}
                </p>
              )}
              {title && (
                <h2 className="mt-0.5 text-base font-semibold tracking-tight text-zinc-900 truncate sm:text-lg">
                  {title}
                </h2>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-1.5 -mt-1.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-stone-100 hover:text-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* ── Scrollable Body ───────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6 sm:py-5">
          {children}
        </div>

        {/* ── Sticky Footer ─────────────────────────────────────────────── */}
        {footer && (
          <div className="sticky bottom-0 z-10 border-t border-stone-200 bg-white px-5 py-3 sm:px-6 sm:py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
