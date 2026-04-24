import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export type ModalSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const sizeClasses: Record<ModalSize, string> = {
  xs: 'max-w-sm',
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
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

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
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
      className="fixed inset-0 z-[9000] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
    >
      <div
        className={`flex max-h-[95vh] w-full flex-col bg-white shadow-xl sm:max-h-[90vh] ${sizeClasses[size]}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {(title || label) && (
          <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-4">
            <div className="min-w-0">
              {label && (
                <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                  {label}
                </p>
              )}
              {title && (
                <h2 className="mt-0.5 text-lg font-semibold text-gray-900 truncate">
                  {title}
                </h2>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-m-2 shrink-0 p-2 text-gray-500 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#D97706]"
            >
              <X size={20} />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <div className="border-t border-gray-200 px-6 py-4">{footer}</div>
        )}
      </div>
    </div>
  );
};

export default Modal;
