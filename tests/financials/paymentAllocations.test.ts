/**
 * Group 5 — Payment allocation builders.
 *
 * Pure-logic helpers driving the record-payment / receipt-reissue flow.
 * No IO, no React.
 */

import { describe, it, expect } from 'vitest';
import {
  validatePaymentBasics,
  buildAllocations,
  buildPaymentReferenceId,
  parseAllocationDrafts,
} from '../../components/financials/utils/paymentAllocations';
import type { Invoice } from '../../types';

const makeInvoice = (overrides: Partial<Invoice>): Invoice => ({
  id: overrides.id ?? 'inv',
  invoice_number: overrides.invoice_number ?? 'INV-001',
  client_name: 'Acme',
  amount_usd: 100,
  currency: 'USD',
  status: 'Sent',
  due_date: '2026-12-31',
  created_at: '2026-01-01',
  ...overrides,
});

// ---------------------------------------------------------------------------

describe('validatePaymentBasics', () => {
  it('accepts a fully populated payment', () => {
    expect(
      validatePaymentBasics({ clientName: 'Acme', amount: 100, currency: 'USD' }),
    ).toEqual({ ok: true });
  });

  it('rejects an empty client name', () => {
    const result = validatePaymentBasics({ clientName: '   ', amount: 100, currency: 'USD' });
    expect(result.ok).toBe(false);
    // Narrow the discriminated union before reading message.
    expect(result.ok === false && result.message.toLowerCase().includes('client')).toBe(true);
  });

  it('rejects zero or negative amounts', () => {
    expect(validatePaymentBasics({ clientName: 'Acme', amount: 0, currency: 'USD' }).ok).toBe(false);
    expect(validatePaymentBasics({ clientName: 'Acme', amount: -1, currency: 'USD' }).ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe('buildAllocations', () => {
  it('splits a payment across multiple invoices and groups duplicates', () => {
    const drafts = parseAllocationDrafts([
      { invoice_id: 'inv-1', amount: '50' },
      { invoice_id: 'inv-2', amount: '30' },
      { invoice_id: 'inv-1', amount: '20' }, // same invoice, second row
    ]);
    const built = buildAllocations(drafts.parsed, 100, 'USD');
    expect(built).toHaveLength(2);
    const inv1 = built.find((a) => a.invoice_id === 'inv-1');
    const inv2 = built.find((a) => a.invoice_id === 'inv-2');
    expect(inv1?.amount_allocated).toBe(70); // 50 + 20
    expect(inv2?.amount_allocated).toBe(30);
    expect(built.every((a) => a.currency === 'USD')).toBe(true);
    expect(built.every((a) => a.status === 'allocated')).toBe(true);
  });

  it('falls back to a single unallocated entry when no invoice rows are populated', () => {
    const built = buildAllocations([], 200, 'GBP');
    expect(built).toHaveLength(1);
    expect(built[0]).toMatchObject({
      amount_allocated: 200,
      currency: 'GBP',
      status: 'unallocated',
    });
    expect(built[0].invoice_id).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------

describe('buildPaymentReferenceId', () => {
  it('returns the invoice number when exactly one invoice is allocated', () => {
    const ref = buildPaymentReferenceId([makeInvoice({ id: 'a', invoice_number: 'INV-777' })]);
    expect(ref).toBe('INV-777');
  });

  it('returns a PAY-{timestamp} reference when multiple invoices are allocated', () => {
    const ref = buildPaymentReferenceId([
      makeInvoice({ id: 'a', invoice_number: 'INV-1' }),
      makeInvoice({ id: 'b', invoice_number: 'INV-2' }),
    ]);
    expect(ref).toMatch(/^PAY-\d+$/);
  });
});
