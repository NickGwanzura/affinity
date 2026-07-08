/**
 * Group 3 — Zod schema validation.
 *
 * Pure schema tests: no IO, no DB, no transitive imports beyond zod.
 */

import { describe, it, expect } from 'vitest';
import {
  ClientSchema,
  InvoiceSchema,
  PaymentSchema,
  LoginSchema,
  ChangePasswordSchema,
  RegistrationRequestSchema,
} from '../../api/_schemas';

// ---------------------------------------------------------------------------

describe('ClientSchema', () => {
  it('accepts a minimal valid client and rejects the empty name', () => {
    expect(ClientSchema.safeParse({ name: 'Acme' }).success).toBe(true);
    expect(ClientSchema.safeParse({}).success).toBe(false);
    expect(ClientSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('rejects an invalid opening_balance_currency and accepts USD/GBP', () => {
    expect(ClientSchema.safeParse({ name: 'Acme', opening_balance_currency: 'EUR' }).success).toBe(false);
    expect(ClientSchema.safeParse({ name: 'Acme', opening_balance_currency: 'USD' }).success).toBe(true);
    expect(ClientSchema.safeParse({ name: 'Acme', opening_balance_currency: 'GBP' }).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe('InvoiceSchema', () => {
  it('requires at least one line item and a valid currency', () => {
    const base = {
      client_name: 'Acme',
      due_date: '2026-12-31',
      items: [{ description: 'Freight', quantity: 1, unit_price: 100 }],
    };
    expect(InvoiceSchema.safeParse(base).success).toBe(true);

    const noItems = { ...base, items: [] };
    expect(InvoiceSchema.safeParse(noItems).success).toBe(false);

    const badCurrency = { ...base, currency: 'EUR' };
    expect(InvoiceSchema.safeParse(badCurrency).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe('PaymentSchema', () => {
  it('requires positive amount_usd and validates allocation array shape', () => {
    const base = {
      client_name: 'Acme',
      amount_usd: 100,
      method: 'Bank',
      date: '2026-01-15',
    };
    expect(PaymentSchema.safeParse(base).success).toBe(true);

    expect(PaymentSchema.safeParse({ ...base, amount_usd: 0 }).success).toBe(false);
    expect(PaymentSchema.safeParse({ ...base, amount_usd: -10 }).success).toBe(false);

    const withAlloc = {
      ...base,
      allocations: [{ amount_allocated: 50, currency: 'USD' as const }],
    };
    expect(PaymentSchema.safeParse(withAlloc).success).toBe(true);

    const badAlloc = {
      ...base,
      allocations: [{ amount_allocated: -1, currency: 'USD' as const }],
    };
    expect(PaymentSchema.safeParse(badAlloc).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe('LoginSchema', () => {
  it('accepts an email or phone identifier and requires password >= 6 chars', () => {
    expect(LoginSchema.safeParse({ email: 'a@b.com', password: 'abcdef' }).success).toBe(true);
    expect(LoginSchema.safeParse({ email: '0712345678', password: 'abcdef' }).success).toBe(true);
    expect(LoginSchema.safeParse({ email: '', password: 'abcdef' }).success).toBe(false);
    expect(LoginSchema.safeParse({ email: 'a@b.com', password: 'short' }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe('ChangePasswordSchema', () => {
  it('requires a non-empty current password and an 8+ char new password', () => {
    expect(
      ChangePasswordSchema.safeParse({ currentPassword: 'old', newPassword: 'longenough' }).success,
    ).toBe(true);

    expect(
      ChangePasswordSchema.safeParse({ currentPassword: '', newPassword: 'longenough' }).success,
    ).toBe(false);

    expect(
      ChangePasswordSchema.safeParse({ currentPassword: 'old', newPassword: '2short' }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe('RegistrationRequestSchema', () => {
  it('requires name + email + an allowed role', () => {
    const ok = { name: 'Jane', email: 'jane@example.com', role: 'Driver' as const };
    expect(RegistrationRequestSchema.safeParse(ok).success).toBe(true);

    expect(
      RegistrationRequestSchema.safeParse({ name: '', email: 'jane@example.com' }).success,
    ).toBe(false);

    expect(
      RegistrationRequestSchema.safeParse({
        name: 'Jane',
        email: 'not-an-email',
      }).success,
    ).toBe(false);

    // Admin is NOT a valid role for registration requests.
    expect(
      RegistrationRequestSchema.safeParse({
        name: 'Jane',
        email: 'jane@example.com',
        role: 'Admin',
      }).success,
    ).toBe(false);
  });
});
