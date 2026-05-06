/**
 * Idempotency-Key handling for money-mutating POST handlers.
 *
 * Wraps a handler so that repeated requests carrying the same
 * `Idempotency-Key` header (within 24h, scoped to user + endpoint) return
 * the cached response body instead of running the handler again. Header is
 * optional — without it, the handler runs as before.
 *
 * Storage: public.idempotency_keys (see migrations/0035).
 */

import type { ApiResponse } from './_types.js';
import type { AuthenticatedRequest } from './_middleware.js';
import { sql } from './_db.js';
import { logger } from './_logger.js';
import { captureException } from './_sentry.js';

const IDEMPOTENCY_HEADER = 'idempotency-key';
const TTL_HOURS = 24;
const MAX_KEY_LENGTH = 200;

type CachedRow = {
  response_body: unknown;
  response_status: number;
};

function readIdempotencyKey(req: AuthenticatedRequest): string | null {
  const raw = req.headers[IDEMPOTENCY_HEADER];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_KEY_LENGTH) return null;
  return trimmed;
}

async function lookupCached(
  key: string,
  userId: string | null,
  endpoint: string
): Promise<CachedRow | null> {
  try {
    const rows = userId
      ? await sql`
          SELECT response_body, response_status
          FROM public.idempotency_keys
          WHERE key = ${key}
            AND user_id = ${userId}::uuid
            AND endpoint = ${endpoint}
            AND created_at > NOW() - INTERVAL '${sql.unsafe(String(TTL_HOURS))} hours'
          LIMIT 1
        `
      : await sql`
          SELECT response_body, response_status
          FROM public.idempotency_keys
          WHERE key = ${key}
            AND user_id IS NULL
            AND endpoint = ${endpoint}
            AND created_at > NOW() - INTERVAL '${sql.unsafe(String(TTL_HOURS))} hours'
          LIMIT 1
        `;
    return (rows[0] as CachedRow | undefined) ?? null;
  } catch (error) {
    // Missing table or transient DB issue — fall through to running the
    // handler. Idempotency is best-effort; never block real traffic.
    logger.warn({ err: error, key, endpoint }, '[Idempotency] lookup failed');
    captureException(error, { stage: 'idempotency.lookup', endpoint });
    return null;
  }
}

async function storeCached(
  key: string,
  userId: string | null,
  endpoint: string,
  status: number,
  body: unknown
): Promise<void> {
  try {
    await sql`
      INSERT INTO public.idempotency_keys (key, user_id, endpoint, response_body, response_status)
      VALUES (
        ${key},
        ${userId}::uuid,
        ${endpoint},
        ${JSON.stringify(body ?? null)}::jsonb,
        ${status}
      )
      ON CONFLICT (key) DO NOTHING
    `;
  } catch (error) {
    logger.warn({ err: error, key, endpoint }, '[Idempotency] store failed');
    captureException(error, { stage: 'idempotency.store', endpoint });
  }
}

/**
 * Wrap a handler so it observes the Idempotency-Key header (when present).
 *
 *   await withIdempotency(req, res, 'POST /invoices', () => createInvoice(req, res));
 *
 * The handler is responsible for sending the response as usual. We
 * intercept `res.json` / `res.status` so we can capture the final body and
 * status, then persist it on success (2xx). Non-2xx responses are NOT
 * cached — the client should be able to fix the request and retry.
 */
export async function withIdempotency(
  req: AuthenticatedRequest,
  res: ApiResponse,
  endpoint: string,
  handler: () => Promise<unknown> | unknown
): Promise<void> {
  const key = readIdempotencyKey(req);
  if (!key) {
    await handler();
    return;
  }

  const userId = req.user?.id ?? null;
  const cached = await lookupCached(key, userId, endpoint);
  if (cached) {
    res.setHeader('Idempotent-Replay', 'true');
    res.status(cached.response_status).json(cached.response_body);
    return;
  }

  // Intercept res.status / res.json to capture the final outgoing payload.
  let capturedStatus = 200;
  let capturedBody: unknown = undefined;

  const originalStatus = res.status.bind(res);
  const originalJson = res.json.bind(res);

  res.status = ((code: number) => {
    capturedStatus = code;
    return originalStatus(code);
  }) as typeof res.status;

  res.json = ((body: unknown) => {
    capturedBody = body;
    return originalJson(body);
  }) as typeof res.json;

  try {
    await handler();
  } finally {
    // Restore original methods so any post-response code paths (audit,
    // background tasks) see the unmodified res object.
    res.status = originalStatus;
    res.json = originalJson;
  }

  // Cache only successful (2xx) JSON responses. 4xx/5xx must be retryable.
  if (capturedStatus >= 200 && capturedStatus < 300 && capturedBody !== undefined) {
    await storeCached(key, userId, endpoint, capturedStatus, capturedBody);
  }
}
