/**
 * Backend structured logger.
 *
 * - Pretty-prints to stdout in dev (via pino-pretty).
 * - Emits JSON in production for log aggregators.
 * - Redacts password / token / cookie fields automatically so callers
 *   can pass request payloads without leaking secrets.
 */

import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  transport: isDev ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
  base: {
    service: 'affinity-api',
    env: process.env.NODE_ENV || 'development',
  },
  redact: {
    paths: [
      'password',
      'password_hash',
      'password_salt',
      'token',
      'invite_token',
      '*.password',
      '*.password_hash',
      '*.token',
      'req.headers.authorization',
      'req.headers.cookie',
    ],
    censor: '[REDACTED]',
  },
});

export function withRequestContext(req: {
  headers?: Record<string, string | string[] | undefined>;
  user?: { id?: string };
}) {
  const requestId = req.headers?.['x-request-id'];
  const userId = req.user?.id;
  return logger.child({
    requestId: Array.isArray(requestId) ? requestId[0] : requestId,
    userId,
  });
}
