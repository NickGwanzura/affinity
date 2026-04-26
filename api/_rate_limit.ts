/* global process */

/**
 * Rate Limiter — pluggable backend.
 *
 * - When UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set, uses
 *   Upstash Redis with sliding-window via INCR + PEXPIRE so the limit is
 *   shared across all serverless / Railway instances.
 * - Otherwise falls back to a per-process in-memory Map (the same logic
 *   that previously lived in api/_db.ts). Note the fallback resets on cold
 *   start and is bypassable on multi-instance deployments — see the
 *   matching warning in .env.example.
 *
 * Always returns a Promise<boolean> so call sites can swap backends without
 * a code change beyond `await`.
 */

import { Redis } from '@upstash/redis';
import { logger } from './_logger.js';
import { captureException } from './_sentry.js';

type RateLimitBackend = (
  identifier: string,
  maxRequests: number,
  windowMs: number
) => Promise<boolean>;

// ---------------------------------------------------------------------------
// In-memory fallback (matches the original _db.ts implementation)
// ---------------------------------------------------------------------------

const memoryRateLimits = new Map<string, { count: number; resetTime: number }>();

const memoryBackend: RateLimitBackend = async (identifier, maxRequests, windowMs) => {
  const now = Date.now();

  for (const [key, record] of memoryRateLimits.entries()) {
    if (now > record.resetTime) {
      memoryRateLimits.delete(key);
    }
  }

  const record = memoryRateLimits.get(identifier);

  if (!record || now > record.resetTime) {
    memoryRateLimits.set(identifier, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count++;
  return true;
};

// ---------------------------------------------------------------------------
// Upstash backend — sliding window via INCR + PEXPIRE
// ---------------------------------------------------------------------------

let upstashClient: Redis | null = null;

function getUpstashClient(): Redis | null {
  if (upstashClient) return upstashClient;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  upstashClient = new Redis({ url, token });
  return upstashClient;
}

const upstashBackend: RateLimitBackend = async (identifier, maxRequests, windowMs) => {
  const client = getUpstashClient();
  if (!client) {
    return memoryBackend(identifier, maxRequests, windowMs);
  }

  const bucket = Math.floor(Date.now() / windowMs);
  const key = `rl:${identifier}:${bucket}`;

  try {
    const count = await client.incr(key);
    if (count === 1) {
      // First request in this window — set TTL just over the window so the
      // key is GC'd shortly after the bucket rolls over.
      await client.pexpire(key, windowMs + 1000);
    }
    return count <= maxRequests;
  } catch (error) {
    logger.warn({ err: error, identifier }, '[RateLimit] Upstash error — falling back to memory');
    captureException(error, { stage: 'rateLimit.upstash', identifier });
    return memoryBackend(identifier, maxRequests, windowMs);
  }
};

// ---------------------------------------------------------------------------
// Module-level backend selection
// ---------------------------------------------------------------------------

const backend: RateLimitBackend =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? upstashBackend
    : memoryBackend;

export function checkRateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60000
): Promise<boolean> {
  return backend(identifier, maxRequests, windowMs);
}
