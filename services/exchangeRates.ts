/**
 * Client-side exchange rate lookup.
 *
 * Fetches live rates from the server on first use, then caches them
 * in memory for the session. Falls back to the constants.ts defaults
 * if the API call fails.
 */

import { api } from './apiClient';
import { EXCHANGE_RATES } from '../constants';
import type { Currency } from '../types';

let cachedRates: Record<string, number> | null = null;
let fetchPromise: Promise<void> | null = null;

async function loadRates(): Promise<void> {
  if (cachedRates) return;
  try {
    const rates = await api.request<{ currency: string; rate_to_usd: number }[]>('/exchange-rates');
    cachedRates = {};
    for (const r of rates) {
      cachedRates[r.currency] = r.rate_to_usd;
    }
  } catch {
    // Fall back to hard-coded defaults on network failure
    cachedRates = { ...EXCHANGE_RATES };
  }
}

/**
 * Warm the cache on import (first call wins, others share the same promise).
 */
function ensureLoaded(): Promise<void> {
  if (cachedRates) return Promise.resolve();
  if (!fetchPromise) {
    fetchPromise = loadRates().finally(() => { fetchPromise = null; });
  }
  return fetchPromise;
}

/**
 * Get the USD exchange rate for a given currency.
 * Returns a promise that resolves once rates are loaded.
 */
export async function getExchangeRate(currency: string): Promise<number> {
  await ensureLoaded();
  return cachedRates?.[currency] ?? 1;
}

/**
 * Convert an amount from a given currency to USD.
 * Convenience wrapper around getExchangeRate.
 */
export async function toUSD(amount: number, currency: string): Promise<number> {
  if (!currency || currency === 'USD') return amount;
  const rate = await getExchangeRate(currency);
  return amount * rate;
}

/**
 * Pre-warm the cache. Call early in the app lifecycle (e.g. after login)
 * to avoid the first component that needs a rate having to wait.
 */
export function preloadExchangeRates(): void {
  ensureLoaded();
}

export default { getExchangeRate, toUSD, preloadExchangeRates };
