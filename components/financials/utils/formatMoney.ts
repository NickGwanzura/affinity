/**
 * Canonical money formatter for the Financials module.
 *
 * Centralised here so Financials.tsx and the section components stay in sync.
 * Uses Intl.NumberFormat to get proper locale-aware currency formatting.
 */
export type DocumentCurrency = 'USD' | 'GBP';

export const normalizeDocumentCurrency = (currency?: string): DocumentCurrency =>
  String(currency || '').trim().toUpperCase() === 'GBP' ? 'GBP' : 'USD';

export const formatMoney = (amount: number, currency?: string): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: normalizeDocumentCurrency(currency),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);

export const normalizeClientName = (value?: string): string =>
  (value || '').trim().toLowerCase();
