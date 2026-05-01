import type { AppUser, Currency, Expense, ExpenseCategory, OperatingFund, Vehicle } from '../types';
import { EXCHANGE_RATES } from '../constants';
import { createDriverIdentityNameMap, normalizeDriverIdentity } from './driverIdentity';

export interface DriverFundRow {
  id: string;
  date: string;
  driverName: string;
  source: 'Expense Disbursement' | 'Operating Fund' | 'Driver Spend';
  description: string;
  amount: number;
  currency: Currency;
  amountUsd: number;
  vehicleLabel: string;
}

export interface DriverFundSummary {
  driverName: string;
  allocatedUsd: number;
  spentUsd: number;
  balanceUsd: number;
  allocationCount: number;
  spendCount: number;
  latestActivity?: string;
  allocatedByCurrency: Partial<Record<Currency, number>>;
  spentByCurrency: Partial<Record<Currency, number>>;
  balanceByCurrency: Partial<Record<Currency, number>>;
}

export interface DriverFundsReportData {
  summaries: DriverFundSummary[];
  allocationRows: DriverFundRow[];
  spendRows: DriverFundRow[];
  totals: {
    allocatedUsd: number;
    spentUsd: number;
    balanceUsd: number;
    fundedDrivers: number;
  };
}

export function buildDriverFundsReportData(
  expenses: Expense[],
  operatingFunds: OperatingFund[],
  drivers: AppUser[] = [],
  vehicles: Vehicle[] = [],
): DriverFundsReportData {
  const driverNameMap = createDriverIdentityNameMap(drivers);

  const vehicleLabelMap = new Map(
    vehicles.map((vehicle) => [vehicle.id, `${vehicle.make_model} (${vehicle.vin_number})`]),
  );

  const canonicalDriverName = (value?: string | null) => {
    const trimmed = (value || '').trim();
    if (!trimmed) return '';
    return driverNameMap.get(normalizeDriverIdentity(trimmed)) || trimmed;
  };

  const allocationRows: DriverFundRow[] = [];
  const spendRows: DriverFundRow[] = [];

  expenses.forEach((expense) => {
    const driverName = canonicalDriverName(expense.driver_name);
    if (!driverName) return;

    const row: DriverFundRow = {
      id: expense.id,
      date: expense.created_at,
      driverName,
      source: expense.category === 'Driver Disbursement' ? 'Expense Disbursement' : 'Driver Spend',
      description: expense.description || expense.category,
      amount: expense.amount || 0,
      currency: expense.currency,
      amountUsd: (expense.amount || 0) * (expense.exchange_rate_to_usd || 1),
      vehicleLabel: expense.vehicle_id ? vehicleLabelMap.get(expense.vehicle_id) || 'Vehicle-linked' : 'General',
    };

    if (expense.category === 'Driver Disbursement') {
      allocationRows.push(row);
      return;
    }

    spendRows.push(row);
  });

  operatingFunds
    .filter((fund) => fund.type === 'Disbursed')
    .forEach((fund) => {
      const driverName = canonicalDriverName(fund.recipient);
      if (!driverName) return;

      allocationRows.push({
        id: fund.id,
        date: fund.date || fund.created_at,
        driverName,
        source: 'Operating Fund',
        description: fund.description || fund.reference || 'Operating fund allocation',
        amount: fund.amount || 0,
        currency: fund.currency,
        amountUsd: (fund.amount || 0) * (EXCHANGE_RATES[fund.currency] || 1),
        vehicleLabel: 'General',
      });
    });

  const summaryMap = new Map<string, DriverFundSummary>();

  const ensureSummary = (driverName: string) => {
    const existing = summaryMap.get(driverName);
    if (existing) return existing;

    const created: DriverFundSummary = {
      driverName,
      allocatedUsd: 0,
      spentUsd: 0,
      balanceUsd: 0,
      allocationCount: 0,
      spendCount: 0,
      allocatedByCurrency: {},
      spentByCurrency: {},
      balanceByCurrency: {},
    };
    summaryMap.set(driverName, created);
    return created;
  };

  allocationRows.forEach((row) => {
    const summary = ensureSummary(row.driverName);
    summary.allocatedUsd += row.amountUsd;
    summary.allocationCount += 1;
    summary.allocatedByCurrency[row.currency] = (summary.allocatedByCurrency[row.currency] || 0) + row.amount;
    summary.latestActivity =
      !summary.latestActivity || new Date(row.date) > new Date(summary.latestActivity)
        ? row.date
        : summary.latestActivity;
  });

  spendRows.forEach((row) => {
    const summary = ensureSummary(row.driverName);
    summary.spentUsd += row.amountUsd;
    summary.spendCount += 1;
    summary.spentByCurrency[row.currency] = (summary.spentByCurrency[row.currency] || 0) + row.amount;
    summary.latestActivity =
      !summary.latestActivity || new Date(row.date) > new Date(summary.latestActivity)
        ? row.date
        : summary.latestActivity;
  });

  const summaries = Array.from(summaryMap.values())
    .map((summary) => {
      const balanceByCurrency: Partial<Record<Currency, number>> = {};
      for (const [currency, allocated] of Object.entries(summary.allocatedByCurrency) as [Currency, number][]) {
        balanceByCurrency[currency] = (allocated || 0) - (summary.spentByCurrency[currency] || 0);
      }
      return {
        ...summary,
        balanceUsd: summary.allocatedUsd - summary.spentUsd,
        balanceByCurrency,
      };
    })
    .sort((a, b) => b.allocatedUsd - a.allocatedUsd);

  const allocatedUsd = allocationRows.reduce((sum, row) => sum + row.amountUsd, 0);
  const spentUsd = spendRows.reduce((sum, row) => sum + row.amountUsd, 0);

  return {
    summaries,
    allocationRows: allocationRows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    spendRows: spendRows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    totals: {
      allocatedUsd,
      spentUsd,
      balanceUsd: allocatedUsd - spentUsd,
      fundedDrivers: summaries.filter((summary) => summary.allocatedUsd > 0).length,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Driver monthly spend report (fuel & other categories)
// ─────────────────────────────────────────────────────────────────────────────

export interface DriverMonthBucket {
  month: string; // YYYY-MM
  totalUsd: number;
  byCategory: Partial<Record<ExpenseCategory, number>>;
  txCount: number;
}

export interface DriverCategoryStat {
  totalUsd: number;
  txCount: number;
  monthsActive: number;
  avgPerMonthUsd: number;
}

export interface DriverMonthlySpendSummary {
  driverName: string;
  months: DriverMonthBucket[];
  totalUsd: number;
  txCount: number;
  monthsActive: number;
  avgPerMonthUsd: number;
  byCategory: Partial<Record<ExpenseCategory, DriverCategoryStat>>;
  fuel: DriverCategoryStat;
}

export interface DriverMonthlySpendReport {
  drivers: DriverMonthlySpendSummary[];
  months: string[]; // sorted ascending
  overall: {
    totalUsd: number;
    txCount: number;
    monthsActive: number;
    avgPerMonthUsd: number;
    fuel: DriverCategoryStat;
    byCategory: Partial<Record<ExpenseCategory, DriverCategoryStat>>;
  };
}

const monthKey = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

const emptyCategoryStat = (): DriverCategoryStat => ({
  totalUsd: 0,
  txCount: 0,
  monthsActive: 0,
  avgPerMonthUsd: 0,
});

export function buildDriverMonthlySpendReport(
  expenses: Expense[],
  drivers: AppUser[] = [],
): DriverMonthlySpendReport {
  const driverNameMap = createDriverIdentityNameMap(drivers);
  const canonicalDriverName = (value?: string | null) => {
    const trimmed = (value || '').trim();
    if (!trimmed) return '';
    return driverNameMap.get(normalizeDriverIdentity(trimmed)) || trimmed;
  };

  // driver -> month -> bucket
  const perDriver = new Map<string, Map<string, DriverMonthBucket>>();
  // driver -> category -> { totalUsd, txCount, monthsSet }
  const perDriverCat = new Map<string, Map<ExpenseCategory, { totalUsd: number; txCount: number; months: Set<string> }>>();
  const overallMonths = new Map<string, DriverMonthBucket>();
  const overallCat = new Map<ExpenseCategory, { totalUsd: number; txCount: number; months: Set<string> }>();

  for (const expense of expenses) {
    // Driver Disbursement is an allocation, not a spend — exclude from spend report.
    if (expense.category === 'Driver Disbursement') continue;

    const driverName = canonicalDriverName(expense.driver_name);
    if (!driverName) continue;

    const m = monthKey(expense.created_at);
    if (!m) continue;

    const usd = (expense.amount || 0) * (expense.exchange_rate_to_usd || 1);
    const category = (expense.category || 'Other') as ExpenseCategory;

    let monthMap = perDriver.get(driverName);
    if (!monthMap) {
      monthMap = new Map();
      perDriver.set(driverName, monthMap);
    }
    let bucket = monthMap.get(m);
    if (!bucket) {
      bucket = { month: m, totalUsd: 0, byCategory: {}, txCount: 0 };
      monthMap.set(m, bucket);
    }
    bucket.totalUsd += usd;
    bucket.txCount += 1;
    bucket.byCategory[category] = (bucket.byCategory[category] || 0) + usd;

    let catMap = perDriverCat.get(driverName);
    if (!catMap) {
      catMap = new Map();
      perDriverCat.set(driverName, catMap);
    }
    let catEntry = catMap.get(category);
    if (!catEntry) {
      catEntry = { totalUsd: 0, txCount: 0, months: new Set() };
      catMap.set(category, catEntry);
    }
    catEntry.totalUsd += usd;
    catEntry.txCount += 1;
    catEntry.months.add(m);

    let overallBucket = overallMonths.get(m);
    if (!overallBucket) {
      overallBucket = { month: m, totalUsd: 0, byCategory: {}, txCount: 0 };
      overallMonths.set(m, overallBucket);
    }
    overallBucket.totalUsd += usd;
    overallBucket.txCount += 1;
    overallBucket.byCategory[category] = (overallBucket.byCategory[category] || 0) + usd;

    let overallCatEntry = overallCat.get(category);
    if (!overallCatEntry) {
      overallCatEntry = { totalUsd: 0, txCount: 0, months: new Set() };
      overallCat.set(category, overallCatEntry);
    }
    overallCatEntry.totalUsd += usd;
    overallCatEntry.txCount += 1;
    overallCatEntry.months.add(m);
  }

  const driverSummaries: DriverMonthlySpendSummary[] = [];

  for (const [driverName, monthMap] of perDriver.entries()) {
    const months = Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));
    const totalUsd = months.reduce((sum, b) => sum + b.totalUsd, 0);
    const txCount = months.reduce((sum, b) => sum + b.txCount, 0);
    const monthsActive = months.length;

    const byCategory: Partial<Record<ExpenseCategory, DriverCategoryStat>> = {};
    const catMap = perDriverCat.get(driverName) || new Map();
    for (const [category, entry] of catMap.entries()) {
      const active = entry.months.size;
      byCategory[category] = {
        totalUsd: entry.totalUsd,
        txCount: entry.txCount,
        monthsActive: active,
        avgPerMonthUsd: active > 0 ? entry.totalUsd / active : 0,
      };
    }

    const fuel = byCategory['Fuel'] || emptyCategoryStat();

    driverSummaries.push({
      driverName,
      months,
      totalUsd,
      txCount,
      monthsActive,
      avgPerMonthUsd: monthsActive > 0 ? totalUsd / monthsActive : 0,
      byCategory,
      fuel,
    });
  }

  driverSummaries.sort((a, b) => b.totalUsd - a.totalUsd);

  const sortedOverallMonths = Array.from(overallMonths.values()).sort((a, b) => a.month.localeCompare(b.month));
  const overallTotalUsd = sortedOverallMonths.reduce((sum, b) => sum + b.totalUsd, 0);
  const overallTxCount = sortedOverallMonths.reduce((sum, b) => sum + b.txCount, 0);
  const overallMonthsActive = sortedOverallMonths.length;

  const overallByCategory: Partial<Record<ExpenseCategory, DriverCategoryStat>> = {};
  for (const [category, entry] of overallCat.entries()) {
    const active = entry.months.size;
    overallByCategory[category] = {
      totalUsd: entry.totalUsd,
      txCount: entry.txCount,
      monthsActive: active,
      avgPerMonthUsd: active > 0 ? entry.totalUsd / active : 0,
    };
  }

  return {
    drivers: driverSummaries,
    months: sortedOverallMonths.map((b) => b.month),
    overall: {
      totalUsd: overallTotalUsd,
      txCount: overallTxCount,
      monthsActive: overallMonthsActive,
      avgPerMonthUsd: overallMonthsActive > 0 ? overallTotalUsd / overallMonthsActive : 0,
      fuel: overallByCategory['Fuel'] || emptyCategoryStat(),
      byCategory: overallByCategory,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Driver forensic report — monthly variances on Food & Fuel
// Flags months that deviate materially from the driver's own baseline
// (MoM swings + deviation from per-driver mean). Intended for fraud/audit
// review, not budgeting.
// ─────────────────────────────────────────────────────────────────────────────

export type ForensicFlag = 'high' | 'low' | 'normal';

export interface MonthlyCategoryVariance {
  month: string;             // YYYY-MM
  amountUsd: number;
  prevMonthUsd: number | null;
  momDeltaUsd: number | null;
  momDeltaPct: number | null;     // null when previous month is 0 / undefined
  meanUsd: number;                // mean across the driver's active months for this category
  vsMeanDeltaUsd: number;
  vsMeanDeltaPct: number | null;  // null when mean is 0
  flag: ForensicFlag;
}

export interface DriverForensicCategorySeries {
  category: 'Fuel' | 'Food';
  totalUsd: number;
  meanMonthlyUsd: number;
  stdDevUsd: number;
  monthsActive: number;
  maxMonth: { month: string; amountUsd: number } | null;
  minMonth: { month: string; amountUsd: number } | null;
  months: MonthlyCategoryVariance[];
  anomalies: MonthlyCategoryVariance[];
}

export interface DriverForensicProfile {
  driverName: string;
  fuel: DriverForensicCategorySeries;
  food: DriverForensicCategorySeries;
  flaggedMonthCount: number;
}

export interface DriverForensicReport {
  drivers: DriverForensicProfile[];
  months: string[];
  totals: {
    fuelUsd: number;
    foodUsd: number;
    flaggedDrivers: number;
    totalAnomalies: number;
  };
}

const FORENSIC_HIGH_MULTIPLIER = 1.5;  // > 150% of driver's mean → flagged high
const FORENSIC_LOW_MULTIPLIER = 0.5;   // < 50% of driver's mean (and > 0) → flagged low

const buildCategorySeries = (
  category: 'Fuel' | 'Food',
  monthsInRange: string[],
  driverMonths: Map<string, DriverMonthBucket>,
): DriverForensicCategorySeries => {
  const raw = monthsInRange.map((month) => ({
    month,
    amountUsd: driverMonths.get(month)?.byCategory[category] || 0,
  }));

  const active = raw.filter((r) => r.amountUsd > 0);
  const totalUsd = active.reduce((s, r) => s + r.amountUsd, 0);
  const mean = active.length > 0 ? totalUsd / active.length : 0;
  const variance =
    active.length > 0
      ? active.reduce((s, r) => s + (r.amountUsd - mean) ** 2, 0) / active.length
      : 0;
  const stdDev = Math.sqrt(variance);

  const months: MonthlyCategoryVariance[] = raw.map((row, idx) => {
    const prev = idx > 0 ? raw[idx - 1].amountUsd : null;
    const momDeltaUsd = prev !== null ? row.amountUsd - prev : null;
    const momDeltaPct = prev !== null && prev > 0 ? ((row.amountUsd - prev) / prev) * 100 : null;
    const vsMeanDeltaUsd = row.amountUsd - mean;
    const vsMeanDeltaPct = mean > 0 ? (vsMeanDeltaUsd / mean) * 100 : null;

    let flag: ForensicFlag = 'normal';
    if (mean > 0 && row.amountUsd > 0) {
      if (row.amountUsd > mean * FORENSIC_HIGH_MULTIPLIER) flag = 'high';
      else if (row.amountUsd < mean * FORENSIC_LOW_MULTIPLIER) flag = 'low';
    }

    return {
      month: row.month,
      amountUsd: row.amountUsd,
      prevMonthUsd: prev,
      momDeltaUsd,
      momDeltaPct,
      meanUsd: mean,
      vsMeanDeltaUsd,
      vsMeanDeltaPct,
      flag,
    };
  });

  const maxMonth = active.reduce<{ month: string; amountUsd: number } | null>(
    (acc, r) => (!acc || r.amountUsd > acc.amountUsd ? r : acc),
    null,
  );
  const minMonth = active.reduce<{ month: string; amountUsd: number } | null>(
    (acc, r) => (!acc || r.amountUsd < acc.amountUsd ? r : acc),
    null,
  );

  return {
    category,
    totalUsd,
    meanMonthlyUsd: mean,
    stdDevUsd: stdDev,
    monthsActive: active.length,
    maxMonth,
    minMonth,
    months,
    anomalies: months.filter((m) => m.flag !== 'normal'),
  };
};

export function buildDriverForensicReport(
  expenses: Expense[],
  drivers: AppUser[] = [],
): DriverForensicReport {
  const monthly = buildDriverMonthlySpendReport(expenses, drivers);
  const monthsInRange = monthly.months;

  // Re-index per-driver monthly buckets for O(1) category lookups.
  const perDriverMonths = new Map<string, Map<string, DriverMonthBucket>>();
  for (const driver of monthly.drivers) {
    const map = new Map<string, DriverMonthBucket>();
    for (const bucket of driver.months) map.set(bucket.month, bucket);
    perDriverMonths.set(driver.driverName, map);
  }

  const profiles: DriverForensicProfile[] = monthly.drivers
    .map((driver) => {
      const driverMonths = perDriverMonths.get(driver.driverName) || new Map();
      const fuel = buildCategorySeries('Fuel', monthsInRange, driverMonths);
      const food = buildCategorySeries('Food', monthsInRange, driverMonths);
      return {
        driverName: driver.driverName,
        fuel,
        food,
        flaggedMonthCount: fuel.anomalies.length + food.anomalies.length,
      };
    })
    .filter((profile) => profile.fuel.totalUsd > 0 || profile.food.totalUsd > 0);

  // Sort by exposure: drivers with more flagged months first, then by combined spend.
  profiles.sort((a, b) => {
    if (b.flaggedMonthCount !== a.flaggedMonthCount) return b.flaggedMonthCount - a.flaggedMonthCount;
    return b.fuel.totalUsd + b.food.totalUsd - (a.fuel.totalUsd + a.food.totalUsd);
  });

  const totalAnomalies = profiles.reduce((s, p) => s + p.flaggedMonthCount, 0);
  const flaggedDrivers = profiles.filter((p) => p.flaggedMonthCount > 0).length;
  const fuelUsd = profiles.reduce((s, p) => s + p.fuel.totalUsd, 0);
  const foodUsd = profiles.reduce((s, p) => s + p.food.totalUsd, 0);

  return {
    drivers: profiles,
    months: monthsInRange,
    totals: { fuelUsd, foodUsd, flaggedDrivers, totalAnomalies },
  };
}
