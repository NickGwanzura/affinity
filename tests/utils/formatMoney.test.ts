/**
 * Group 6 — Money formatter (Financials module canonical Intl wrapper).
 */

import { describe, it, expect } from 'vitest';
import {
  formatMoney,
  normalizeDocumentCurrency,
} from '../../components/financials/utils/formatMoney';

describe('formatMoney', () => {
  it('formats USD with $, two decimals, and thousand separators', () => {
    const result = formatMoney(1234.5, 'USD');
    expect(result).toContain('$');
    expect(result).toContain('1,234.50');
  });

  it('formats GBP with £ and the same shape', () => {
    const result = formatMoney(1234.5, 'GBP');
    expect(result).toContain('£');
    expect(result).toContain('1,234.50');
  });

  it('renders negative amounts (Intl en-US uses a leading minus by default)', () => {
    const negUsd = formatMoney(-99.5, 'USD');
    // Intl en-US currency style emits "-$99.50". We assert the bits we care
    // about — sign + currency + magnitude — without pinning the exact glyph
    // (Intl can output a Unicode minus on some platforms).
    expect(negUsd).toMatch(/[-−]/);
    expect(negUsd).toContain('$');
    expect(negUsd).toContain('99.50');
  });
});

describe('normalizeDocumentCurrency', () => {
  it('returns GBP for any case/whitespace variation, otherwise USD', () => {
    expect(normalizeDocumentCurrency('GBP')).toBe('GBP');
    expect(normalizeDocumentCurrency(' gbp ')).toBe('GBP');
    expect(normalizeDocumentCurrency('USD')).toBe('USD');
    expect(normalizeDocumentCurrency('eur')).toBe('USD'); // unknown → USD default
    expect(normalizeDocumentCurrency(undefined)).toBe('USD');
  });
});
