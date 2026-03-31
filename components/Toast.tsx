import React, { useEffect, useSyncExternalStore } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

type ToastState = {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
};

type ToastStore = {
  toasts: ToastState[];
};

const DEFAULT_DURATION = 4000;
const MAX_MESSAGE_LENGTH = 240;

let store: ToastStore = { toasts: [] };
const listeners = new Set<() => void>();

const emitChange = () => {
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => store;

const sanitizeMessage = (message: string) => {
  const trimmed = message.trim();
  if (!trimmed) {
    return 'An unexpected error occurred. Please try again.';
  }

  if (trimmed.length <= MAX_MESSAGE_LENGTH) {
    return trimmed;
  }

  return `${trimmed.slice(0, MAX_MESSAGE_LENGTH - 1)}…`;
};

const createToastId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

export const showGlobalToast = (
  message: string,
  type: ToastType = 'info',
  duration: number = DEFAULT_DURATION,
) => {
  const nextToast: ToastState = {
    id: createToastId(),
    message: sanitizeMessage(message),
    type,
    duration,
  };

  store = {
    toasts: [...store.toasts, nextToast],
  };
  emitChange();
  return nextToast.id;
};

export const removeGlobalToast = (id: string) => {
  store = {
    toasts: store.toasts.filter((toast) => toast.id !== id),
  };
  emitChange();
};

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ message, type, onClose, duration = DEFAULT_DURATION }) => {
  useEffect(() => {
    const timer = window.setTimeout(onClose, duration);
    return () => window.clearTimeout(timer);
  }, [duration, onClose]);

  const styles = {
    success: {
      shell: 'border-emerald-200 bg-emerald-50 text-emerald-900',
      icon: 'text-emerald-600',
      progress: 'bg-emerald-500',
    },
    error: {
      shell: 'border-red-200 bg-red-50 text-red-900',
      icon: 'text-red-600',
      progress: 'bg-red-500',
    },
    warning: {
      shell: 'border-amber-200 bg-amber-50 text-amber-900',
      icon: 'text-amber-600',
      progress: 'bg-amber-500',
    },
    info: {
      shell: 'border-blue-200 bg-blue-50 text-blue-900',
      icon: 'text-blue-600',
      progress: 'bg-blue-500',
    },
  };

  const icons = {
    success: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    ),
    error: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    ),
    warning: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    ),
    info: (
      <>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8h.01" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </>
    ),
  };

  return (
    <div
      className={`pointer-events-auto relative overflow-hidden  border shadow-lg ${styles[type].shell}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex min-h-[56px] items-start gap-3 px-4 py-3">
        <span className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center ${styles[type].icon}`}>
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {icons[type]}
          </svg>
        </span>
        <p className="flex-1 text-sm font-medium leading-5">{message}</p>
        <button
          type="button"
          onClick={onClose}
          className="min-h-[36px] min-w-[36px] rounded-full text-current/60 transition-colors hover:bg-black/5 hover:text-current"
          aria-label="Dismiss notification"
        >
          <svg className="mx-auto h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="h-1 w-full bg-black/5">
        <div
          className={`h-full ${styles[type].progress}`}
          style={{
            width: '100%',
            animation: `toast-progress ${duration}ms linear forwards`,
          }}
        />
      </div>
    </div>
  );
};

export const ToastViewport: React.FC = () => {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return (
    <>
      <style>
        {`
          @keyframes toast-progress {
            from { width: 100%; }
            to { width: 0%; }
          }
        `}
      </style>
      <div className="pointer-events-none fixed inset-x-3 bottom-3 z-[9000] flex flex-col gap-3 sm:right-4 sm:left-auto sm:bottom-4 sm:w-full sm:max-w-sm">
        {snapshot.toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            onClose={() => removeGlobalToast(toast.id)}
          />
        ))}
      </div>
    </>
  );
};

export const useToast = () => {
  const showToast = (
    message: string,
    type: ToastType = 'info',
    duration: number = DEFAULT_DURATION,
  ) => showGlobalToast(message, type, duration);

  const ToastContainer = () => null;

  return { showToast, ToastContainer };
};
