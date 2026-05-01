import { describe, it, expect } from 'vitest';
import { buildDriverForensicReport } from '../../utils/driverFunds';
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

describe('buildDriverForensicReport', () => {
  it('returns empty totals when no fuel/food expenses are attributed to drivers', () => {
    const r = buildDriverForensicReport([], []);
    expect(r.drivers).toEqual([]);
    expect(r.totals.flaggedDrivers).toBe(0);
    expect(r.totals.totalAnomalies).toBe(0);
  });

  it('flags a fuel month above 150% of the driver mean as high', () => {
    const expenses: Expense[] = [
      expense({ driver_name: 'David', amount: 100, category: 'Fuel', created_at: '2026-01-10T00:00:00Z' }),
      expense({ driver_name: 'David', amount: 100, category: 'Fuel', created_at: '2026-02-10T00:00:00Z' }),
      expense({ driver_name: 'David', amount: 400, category: 'Fuel', created_at: '2026-03-10T00:00:00Z' }), // 4× the prior months
    ];

    const r = buildDriverForensicReport(expenses, []);
    const david = r.drivers.find((d) => d.driverName === 'David')!;
    expect(david).toBeDefined();
    expect(david.fuel.meanMonthlyUsd).toBe(200); // (100+100+400)/3
    const march = david.fuel.months.find((m) => m.month === '2026-03')!;
    expect(march.flag).toBe('high');
    expect(march.momDeltaUsd).toBe(300);
    expect(march.momDeltaPct).toBe(300);
    expect(march.vsMeanDeltaPct).toBe(100); // 400 is +100% vs mean of 200
    expect(david.flaggedMonthCount).toBeGreaterThan(0);
    expect(r.totals.flaggedDrivers).toBe(1);
  });

  it('flags a food month below 50% of the driver mean as low', () => {
    const expenses: Expense[] = [
      expense({ driver_name: 'Sipho', amount: 100, category: 'Food', created_at: '2026-01-10T00:00:00Z' }),
      expense({ driver_name: 'Sipho', amount: 100, category: 'Food', created_at: '2026-02-10T00:00:00Z' }),
      expense({ driver_name: 'Sipho', amount: 20,  category: 'Food', created_at: '2026-03-10T00:00:00Z' }),
    ];
    const r = buildDriverForensicReport(expenses, []);
    const sipho = r.drivers.find((d) => d.driverName === 'Sipho')!;
    const march = sipho.food.months.find((m) => m.month === '2026-03')!;
    expect(march.flag).toBe('low');
  });

  it('does not flag months that are within ±50% of the mean', () => {
    const expenses: Expense[] = [
      expense({ driver_name: 'Boulton', amount: 100, category: 'Fuel', created_at: '2026-01-10T00:00:00Z' }),
      expense({ driver_name: 'Boulton', amount: 110, category: 'Fuel', created_at: '2026-02-10T00:00:00Z' }),
      expense({ driver_name: 'Boulton', amount: 90,  category: 'Fuel', created_at: '2026-03-10T00:00:00Z' }),
    ];
    const r = buildDriverForensicReport(expenses, []);
    const boulton = r.drivers.find((d) => d.driverName === 'Boulton')!;
    expect(boulton.flaggedMonthCount).toBe(0);
    expect(r.totals.flaggedDrivers).toBe(0);
  });

  it('includes inactive months as $0 and reports MoM delta against them', () => {
    const expenses: Expense[] = [
      expense({ driver_name: 'David', amount: 100, category: 'Fuel', created_at: '2026-01-10T00:00:00Z' }),
      // Boulton has no Jan fuel; February fuel will see prev = 0, MoM% = null
      expense({ driver_name: 'Boulton', amount: 200, category: 'Fuel', created_at: '2026-02-10T00:00:00Z' }),
    ];
    const r = buildDriverForensicReport(expenses, []);
    const boulton = r.drivers.find((d) => d.driverName === 'Boulton')!;
    const jan = boulton.fuel.months.find((m) => m.month === '2026-01')!;
    const feb = boulton.fuel.months.find((m) => m.month === '2026-02')!;
    expect(jan.amountUsd).toBe(0);
    expect(feb.prevMonthUsd).toBe(0);
    expect(feb.momDeltaUsd).toBe(200);
    expect(feb.momDeltaPct).toBeNull(); // can't divide by zero
  });

  it('orders drivers with the most flagged months first', () => {
    const expenses: Expense[] = [
      // Boulton: stable, no flags
      expense({ driver_name: 'Boulton', amount: 100, category: 'Fuel', created_at: '2026-01-10T00:00:00Z' }),
      expense({ driver_name: 'Boulton', amount: 100, category: 'Fuel', created_at: '2026-02-10T00:00:00Z' }),
      // David: spike
      expense({ driver_name: 'David', amount: 100, category: 'Fuel', created_at: '2026-01-10T00:00:00Z' }),
      expense({ driver_name: 'David', amount: 500, category: 'Fuel', created_at: '2026-02-10T00:00:00Z' }),
    ];
    const r = buildDriverForensicReport(expenses, []);
    expect(r.drivers[0].driverName).toBe('David');
    expect(r.drivers[0].flaggedMonthCount).toBeGreaterThan(0);
  });
});
