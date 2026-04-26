/**
 * Browser-side structured logger.
 *
 * Pino is Node-only, so the browser uses a thin wrapper around `console`
 * that respects a configurable minimum level. Defaults to `debug` in dev
 * and `warn` in production builds.
 */

type Level = 'debug' | 'info' | 'warn' | 'error';
type Fields = Record<string, unknown>;

const LEVEL_ORDER: Level[] = ['debug', 'info', 'warn', 'error'];
const minLevel: Level =
  (import.meta.env?.VITE_LOG_LEVEL as Level) ||
  (import.meta.env?.PROD ? 'warn' : 'debug');

function shouldLog(level: Level): boolean {
  return LEVEL_ORDER.indexOf(level) >= LEVEL_ORDER.indexOf(minLevel);
}

function emit(level: Level, msg: string, fields?: Fields): void {
  if (!shouldLog(level)) return;
  const payload = fields ? { msg, ...fields } : msg;
  // eslint-disable-next-line no-console
  console[level === 'debug' ? 'log' : level](payload);
}

export const logger = {
  debug: (msg: string, fields?: Fields) => emit('debug', msg, fields),
  info: (msg: string, fields?: Fields) => emit('info', msg, fields),
  warn: (msg: string, fields?: Fields) => emit('warn', msg, fields),
  error: (msg: string, fields?: Fields) => emit('error', msg, fields),
};
