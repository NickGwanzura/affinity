/**
 * Lightweight in-memory cache store for API responses.
 *
 * Follows the same module-level store + useSyncExternalStore pattern as Toast.tsx.
 * - Cache entries have a configurable TTL (default 5 minutes).
 * - GET requests are cached transparently by URL+params.
 * - POST/PUT/DELETE invalidate matching cache entries.
 * - The React hook is optional; the cache works without it.
 */

import { useSyncExternalStore, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

interface CacheStore {
  entries: ReadonlyMap<string, CacheEntry>;
  pending: ReadonlyMap<string, Promise<unknown>>; // in-flight dedup
}

type Listener = () => void;

// ── Module-level store ─────────────────────────────────────────────────────

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

let store: CacheStore = {
  entries: new Map(),
  pending: new Map(),
};

const listeners = new Set<Listener>();

const emitChange = () => {
  listeners.forEach((l) => l());
};

const subscribe = (listener: Listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => store;

// ── Cache operations ───────────────────────────────────────────────────────

/**
 * Set a cache entry.
 * @param key    Unique cache key (usually the URL + query string).
 * @param data   Response data to cache.
 * @param ttlMs  Time-to-live in milliseconds (default 5 min).
 */
export function cacheSet(key: string, data: unknown, ttlMs: number = DEFAULT_TTL_MS): void {
  const entries = new Map(store.entries);
  entries.set(key, { data, expiresAt: Date.now() + ttlMs });

  // Clean up expired entries while we're at it
  const now = Date.now();
  for (const [k, v] of entries) {
    if (v.expiresAt <= now && k !== key) entries.delete(k);
  }

  store = { entries, pending: store.pending };
  emitChange();
}

/**
 * Get a cache entry (returns null if missing or expired).
 */
export function cacheGet<T = unknown>(key: string): T | null {
  const entry = store.entries.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    // Lazy-clean expired entry
    if (entry && entry.expiresAt <= Date.now()) {
      cacheRemove(key);
    }
    return null;
  }
  return entry.data as T;
}

/**
 * Remove a specific cache entry.
 */
export function cacheRemove(key: string): void {
  if (!store.entries.has(key)) return;
  const entries = new Map(store.entries);
  entries.delete(key);
  store = { entries, pending: store.pending };
  emitChange();
}

/**
 * Remove all cache entries whose key matches a prefix pattern.
 * Used to bust related caches after a mutation.
 *
 * e.g. cacheInvalidate('/vehicles') clears /vehicles, /vehicles?id=X, etc.
 *     cacheInvalidate() clears everything.
 */
export function cacheInvalidate(pattern?: string): void {
  if (!pattern) {
    store = { entries: new Map(), pending: new Map() };
    emitChange();
    return;
  }

  const entries = new Map(store.entries);
  for (const key of entries.keys()) {
    if (key.startsWith(pattern)) entries.delete(key);
  }
  store = { entries, pending: store.pending };
  emitChange();
}

/**
 * Track an in-flight promise so duplicate concurrent requests share one fetch.
 * Returns true if this call "won" (should fetch) and false if another in-flight
 * call is already pending.
 */
export function cacheTrackPending(key: string, promise: Promise<unknown>): boolean {
  if (store.pending.has(key)) return false; // already in-flight
  const pending = new Map(store.pending);
  pending.set(key, promise);

  // Remove from pending when it resolves/rejects
  const cleanup = () => {
    const p2 = new Map(store.pending);
    p2.delete(key);
    store = { entries: store.entries, pending: p2 };
    emitChange();
  };
  promise.then(cleanup, cleanup);

  store = { entries: store.entries, pending };
  emitChange();
  return true;
}

// ── React hook ─────────────────────────────────────────────────────────────

export interface CacheHook {
  entries: ReadonlyMap<string, CacheEntry>;
  set: typeof cacheSet;
  get: typeof cacheGet;
  remove: typeof cacheRemove;
  invalidate: typeof cacheInvalidate;
}

export function useCache(): CacheHook {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const set = useCallback(cacheSet, []);
  const get = useCallback(cacheGet, []);
  const remove = useCallback(cacheRemove, []);
  const invalidate = useCallback(cacheInvalidate, []);

  return {
    entries: snapshot.entries,
    set,
    get,
    remove,
    invalidate,
  };
}
