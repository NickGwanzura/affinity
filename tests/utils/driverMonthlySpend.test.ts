import { describe, it, expect } from 'vitest';
import { buildDriverMonthlySpendReport } from '../../utils/driverFunds';
import type { Expense } from '../../types';

const expense = (overrides: Partial<Expense>): Expense =>
  ({
    id: overrides.id || `e-${Math.random()}`,
    description: 'x',
    amount: 0,
    currency: 'USD',
    exchange_rate_to_usd: 1,
    category: 'Other',
    location: 'UK',
    created_at: '2026-01-15T00:00:00Z',
    ...overrides,
  } as Expense);

describe('buildDriverMonthlySpendReport', () => {
  it('returns an empty report for no expenses', () => {
    const r = buildDriverMonthlySpendReport([], []);
    expect(r.drivers).toEqual([]);
    expect(r.months).toEqual([]);
    expect(r.overall.totalUsd).toBe(0);
    expect(r.overall.fuel.avgPerMonthUsd).toBe(0);
  });

  it('groups by driver and month and computes fuel averages', () => {
    const expenses: Expense[] = [
      expense({ driver_name: 'David', amount: 100, category: 'Fuel', created_at: '2026-01-10T00:00:00Z' }),
      expense({ driver_name: 'David', amount: 200, category: 'Fuel', created_at: '2026-02-05T00:00:00Z' }),
      expense({ driver_name: 'David', amount: 50,  category: 'Tolls', created_at: '2026-02-06T00:00:00Z' }),
      expense({ driver_name: 'Boulton', amount: 80, category: 'Fuel', created_at: '2026-01-20T00:00:00Z' }),
      // Allocation row — must be excluded from spend report
      expense({ driver_name: 'David', amount: 9999, category: 'Driver Disbursement', created_at: '2026-01-01T00:00:00Z' }),
      // No driver attribution — excluded
      expense({ amount: 500, category: 'Fuel', created_at: '2026-01-12T00:00:00Z' }),
    ];

    const r = buildDriverMonthlySpendReport(expenses, []);

    expect(r.months).toEqual(['2026-01', '2026-02']);

    const david = r.drivers.find((d) => d.driverName === 'David')!;
    expect(david).toBeDefined();
    expect(david.totalUsd).toBe(100 + 200 + 50);
    expect(david.monthsActive).toBe(2);
    expect(david.avgPerMonthUsd).toBe(350 / 2);
    expect(david.fuel.totalUsd).toBe(300);
    expect(david.fuel.monthsActive).toBe(2);
    expect(david.fuel.avgPerMonthUsd).toBe(150);
    expect(david.byCategory['Tolls']?.totalUsd).toBe(50);
    expect(david.byCategory['Tolls']?.avgPerMonthUsd).toBe(50); // 1 active month

    const boulton = r.drivers.find((d) => d.driverName === 'Boulton')!;
    expect(boulton.totalUsd).toBe(80);
    expect(boulton.fuel.avgPerMonthUsd).toBe(80);

    // Driver order: highest total first
    expect(r.drivers[0].driverName).toBe('David');

    // Overall metrics exclude allocations and unattributed
    expect(r.overall.totalUsd).toBe(100 + 200 + 50 + 80);
    expect(r.overall.fuel.totalUsd).toBe(100 + 200 + 80);
    expect(r.overall.fuel.monthsActive).toBe(2);
    expect(r.overall.fuel.avgPerMonthUsd).toBe(380 / 2);
  });

  it('applies non-USD exchange rate when summing', () => {
    const expenses: Expense[] = [
      expense({ driver_name: 'Sipho', amount: 1000, currency: 'NAD', exchange_rate_to_usd: 0.05, category: 'Fuel', created_at: '2026-03-10T00:00:00Z' }),
    ];
    const r = buildDriverMonthlySpendReport(expenses, []);
    const sipho = r.drivers[0];
    expect(sipho.fuel.totalUsd).toBeCloseTo(50, 5);
    expect(sipho.totalUsd).toBeCloseTo(50, 5);
  });
});
