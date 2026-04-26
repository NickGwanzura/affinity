/**
 * Browser Sentry wrapper.
 *
 * Graceful no-op when VITE_SENTRY_DSN is unset. Basic error capture only —
 * no profiling, replay, or session tracking (cost control).
 */

import * as Sentry from '@sentry/react';

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  const dsn = import.meta.env?.VITE_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env?.MODE || 'development',
    tracesSampleRate: import.meta.env?.PROD ? 0.1 : 0,
    sendDefaultPii: false,
  });
  initialized = true;
}

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (!import.meta.env?.VITE_SENTRY_DSN) return;
  Sentry.captureException(err, context ? { extra: context } : undefined);
}

export { Sentry };
