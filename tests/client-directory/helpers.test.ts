/**
 * Group 1 — Money math (highest priority)
 *
 * Pins down behavior for the client directory helpers and the underlying
 * dataService.calculateClientBalance routine (which computeClientStats
 * delegates to for registered clients). All tests are pure unit tests
 * with mocked apiClient so no network IO touches the suite.
 */

import { describe, it, expect, vi } from 'vitest';
import type { Client, Invoice, Payment, Quote } from '../../types';

// Mock the API client + auth service so importing dataService (transitively
// pulled in by components/client-directory/helpers) does not try to read
// import.meta.env or hit localStorage.
vi.mock('../../services/apiClient', () => ({
  api: {},
  setToken: vi.fn(),
  getToken: vi.fn(() => null),
  removeToken: vi.fn(),
  APIError: class APIError extends Error {},
}));

vi.mock('../../services/authService', () => ({
  authService: {
    login: vi.fn(),
    logout: vi.fn(),
    getSession: vi.fn(),
    resetPassword: vi.fn(),
  },
}));

import {
  matchesClient,
  sameName,
  buildEnrichedClients,
  computeClientStats,
  buildClientLedger,
} from '../../components/client-directory/helpers';
import { dataService } from '../../services/dataService';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeClient = (overrides: Partial<Client> = {}): Client => ({
  id: 'client-1',
  name: 'Acme Logistics',
  email: 'ops@acme.test',
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

const makeInvoice = (overrides: Partial<Invoice> = {}): Invoice => ({
  id: `inv-${Math.random()}`,
  invoice_number: 'INV-001',
  client_name: 'Acme Logistics',
  amount_usd: 100,
  currency: 'USD',
  status: 'Sent',
  due_date: '2024-02-01T00:00:00Z',
  created_at: '2024-01-15T00:00:00Z',
  ...overrides,
});

const makePayment = (overrides: Partial<Payment> = {}): Payment => ({
  id: `pay-${Math.random()}`,
  reference_id: 'INV-001',
  client_name: 'Acme Logistics',
  type: 'Inbound',
  amount_usd: 50,
  currency: 'USD',
  method: 'Bank',
  date: '2024-01-20T00:00:00Z',
  created_at: '2024-01-20T00:00:00Z',
  ...overrides,
});

// ---------------------------------------------------------------------------
// matchesClient
// ---------------------------------------------------------------------------

describe('matchesClient', () => {
  it('id-match wins even when names differ', () => {
    const client = makeClient({ id: 'a', name: 'Acme' });
    const inv = makeInvoice({ client_id: 'a', client_name: 'Totally Different Co.' });
    expect(matchesClient(inv, client)).toBe(true);
  });

  it('does NOT name-fallback when client_id is set on both sides', () => {
    const client = makeClient({ id: 'a', name: 'Acme' });
    const inv = makeInvoice({ client_id: 'b', client_name: 'Acme' });
    // Same name but different ids → must not match. Pre-fix this would
    // have collapsed two distinct clients.
    expect(matchesClient(inv, client)).toBe(false);
  });

  it('falls back to case-insensitive name when client_id is null', () => {
    const client = makeClient({ id: 'a', name: 'Acme Logistics' });
    const inv = makeInvoice({ client_id: null, client_name: 'ACME LOGISTICS' });
    expect(matchesClient(inv, client)).toBe(true);
  });

  it('trims whitespace when name-falling-back', () => {
    const client = makeClient({ id: 'a', name: '  Acme  ' });
    const inv = makeInvoice({ client_id: undefined, client_name: 'acme' });
    expect(matchesClient(inv, client)).toBe(true);
  });

  it('is null-safe on both sides', () => {
    const client = makeClient({ id: 'a', name: 'Acme' });
    const inv = makeInvoice({ client_id: null, client_name: null });
    expect(matchesClient(inv, client)).toBe(false);
  });
});

describe('sameName', () => {
  it('handles undefined and empty values without throwing', () => {
    expect(sameName(undefined, undefined)).toBe(true);
    expect(sameName('', undefined)).toBe(true);
    expect(sameName('Acme', '')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildEnrichedClients
// ---------------------------------------------------------------------------

describe('buildEnrichedClients', () => {
  it('keys registered clients by id so duplicate names stay distinct', () => {
    const clients = [
      makeClient({ id: 'a', name: 'Acme' }),
      makeClient({ id: 'b', name: 'Acme' }), // same name, different id
    ];
    const result = buildEnrichedClients(clients, []);
    // Both must be preserved as separate entries.
    const matches = result.filter((c) => c.name === 'Acme');
    expect(matches).toHaveLength(2);
    expect(matches.map((c) => c.id).sort()).toEqual(['a', 'b']);
  });

  it('folds in unregistered clients found only in invoices', () => {
    const clients = [makeClient({ id: 'a', name: 'Acme' })];
    const invoices = [
      makeInvoice({ client_id: undefined, client_name: 'Ghost Client' }),
    ];
    const result = buildEnrichedClients(clients, invoices);
    expect(result).toHaveLength(2);
    const ghost = result.find((c) => c.name === 'Ghost Client');
    expect(ghost?.isRegistered).toBe(false);
  });

  it('does not fabricate a ghost when an invoice name matches a registered client', () => {
    const clients = [makeClient({ id: 'a', name: 'Acme Logistics' })];
    const invoices = [
      makeInvoice({ client_id: undefined, client_name: 'acme logistics' }),
    ];
    const result = buildEnrichedClients(clients, invoices);
    expect(result).toHaveLength(1);
    expect(result[0].isRegistered).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// dataService.calculateClientBalance — the per-currency money engine
// ---------------------------------------------------------------------------

describe('dataService.calculateClientBalance', () => {
  it('respects opening_balance and excludes Cancelled invoices', () => {
    const client = makeClient({ opening_balance: 200, opening_balance_currency: 'USD' });
    const invoices = [
      makeInvoice({ client_id: 'client-1', amount_usd: 100, status: 'Sent' }),
      makeInvoice({ client_id: 'client-1', amount_usd: 999, status: 'Cancelled' }),
    ];
    const balance = dataService.calculateClientBalance(client, invoices, []);
    expect(balance.opening_balance).toBe(200);
    expect(balance.total_invoiced).toBe(100);
    expect(balance.usd_balance).toBe(300); // 200 opening + 100 invoiced - 0 paid
  });

  it('excludes soft-deleted payments', () => {
    const client = makeClient();
    const payments = [
      makePayment({ client_id: 'client-1', amount_usd: 50 }),
      makePayment({ client_id: 'client-1', amount_usd: 9999, is_deleted: true }),
    ];
    const balance = dataService.calculateClientBalance(client, [], payments);
    expect(balance.total_paid).toBe(50);
  });

  it('keeps USD and GBP totals strictly independent', () => {
    const client = makeClient({ opening_balance: 100, opening_balance_currency: 'GBP' });
    const invoices = [
      makeInvoice({ client_id: 'client-1', amount_usd: 200, currency: 'USD' }),
      makeInvoice({ client_id: 'client-1', amount_usd: 80, currency: 'GBP' }),
    ];
    const payments = [
      makePayment({ client_id: 'client-1', amount_usd: 50, currency: 'USD' }),
      makePayment({ client_id: 'client-1', amount_usd: 30, currency: 'GBP' }),
    ];
    const balance = dataService.calculateClientBalance(client, invoices, payments);
    // USD: 0 opening + 200 invoiced - 50 paid = 150
    expect(balance.usd_balance).toBe(150);
    // GBP: 100 opening + 80 invoiced - 30 paid = 150
    expect(balance.gbp_balance).toBe(150);
  });
});

// ---------------------------------------------------------------------------
// computeClientStats — exercised through helpers.ts public surface
// ---------------------------------------------------------------------------

describe('computeClientStats', () => {
  it('counts only invoices/quotes/payments matching the client by id', () => {
    const client = makeClient({ id: 'a', name: 'Acme' });
    const otherClient = makeClient({ id: 'b', name: 'Acme' }); // same name!
    const enriched = buildEnrichedClients([client, otherClient], []);
    const invoices = [
      makeInvoice({ client_id: 'a', amount_usd: 100 }),
      makeInvoice({ client_id: 'b', amount_usd: 9999 }), // belongs to other client
    ];
    const stats = computeClientStats('Acme', enriched, invoices, [] as Quote[], []);
    // Should NOT credit the second invoice to client A despite the name match.
    expect(stats.invoiceCount).toBe(1);
    expect(stats.totalBilled).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// buildClientLedger
// ---------------------------------------------------------------------------

describe('buildClientLedger', () => {
  it('sorts entries by date ascending', () => {
    const client = { ...makeClient({ opening_balance: 0 }), isRegistered: true };
    const invoices = [
      makeInvoice({ id: 'i1', client_id: 'client-1', amount_usd: 100, created_at: '2024-03-01T00:00:00Z' }),
      makeInvoice({ id: 'i2', client_id: 'client-1', amount_usd: 200, created_at: '2024-01-01T00:00:00Z' }),
    ];
    const ledger = buildClientLedger(client, invoices, []);
    expect(ledger.map((e) => e.id)).toEqual(['i2', 'i1']);
  });

  it('filters out cancelled invoices and soft-deleted payments', () => {
    const client = { ...makeClient({ opening_balance: 0 }), isRegistered: true };
    const invoices = [
      makeInvoice({ id: 'live', client_id: 'client-1', amount_usd: 100 }),
      makeInvoice({ id: 'dead', client_id: 'client-1', amount_usd: 500, status: 'Cancelled' }),
    ];
    const payments = [
      makePayment({ id: 'p-live', client_id: 'client-1', amount_usd: 25 }),
      makePayment({ id: 'p-dead', client_id: 'client-1', amount_usd: 999, is_deleted: true }),
    ];
    const ledger = buildClientLedger(client, invoices, payments);
    const ids = ledger.map((e) => e.id);
    expect(ids).toContain('live');
    expect(ids).toContain('p-live');
    expect(ids).not.toContain('dead');
    expect(ids).not.toContain('p-dead');
  });

  it('keeps a running balance per currency and matches calculateClientBalance totals', () => {
    const client = {
      ...makeClient({ opening_balance: 0, id: 'client-1' }),
      isRegistered: true,
    };
    const invoices = [
      makeInvoice({ client_id: 'client-1', amount_usd: 200, currency: 'USD', created_at: '2024-01-01T00:00:00Z' }),
      makeInvoice({ client_id: 'client-1', amount_usd: 80, currency: 'GBP', created_at: '2024-01-02T00:00:00Z' }),
    ];
    const payments = [
      makePayment({ client_id: 'client-1', amount_usd: 50, currency: 'USD', date: '2024-01-03T00:00:00Z' }),
      makePayment({ client_id: 'client-1', amount_usd: 30, currency: 'GBP', date: '2024-01-04T00:00:00Z' }),
    ];
    const ledger = buildClientLedger(client, invoices, payments);
    // The final running balance per currency must match calculateClientBalance.
    const finalUsd = [...ledger].reverse().find((e) => e.currency === 'USD');
    const finalGbp = [...ledger].reverse().find((e) => e.currency === 'GBP');
    const expected = dataService.calculateClientBalance(client, invoices, payments);
    expect(finalUsd?.balance).toBe(expected.usd_balance); // 150
    expect(finalGbp?.balance).toBe(expected.gbp_balance); // 50
  });
});
