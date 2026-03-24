import type { AppUser, Currency, Expense, OperatingFund, Vehicle } from '../types';
import { EXCHANGE_RATES } from '../constants';

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

const normalizeName = (value?: string | null) => (value || '').trim().toLowerCase();

export function buildDriverFundsReportData(
  expenses: Expense[],
  operatingFunds: OperatingFund[],
  drivers: AppUser[] = [],
  vehicles: Vehicle[] = [],
): DriverFundsReportData {
  const driverNameMap = new Map<string, string>();
  drivers
    .filter((driver) => driver.role === 'Driver')
    .forEach((driver) => {
      const normalized = normalizeName(driver.name);
      if (normalized) {
        driverNameMap.set(normalized, driver.name.trim());
      }
    });

  const vehicleLabelMap = new Map(
    vehicles.map((vehicle) => [vehicle.id, `${vehicle.make_model} (${vehicle.vin_number})`]),
  );

  const canonicalDriverName = (value?: string | null) => {
    const trimmed = (value || '').trim();
    if (!trimmed) return '';
    return driverNameMap.get(normalizeName(trimmed)) || trimmed;
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
    };
    summaryMap.set(driverName, created);
    return created;
  };

  allocationRows.forEach((row) => {
    const summary = ensureSummary(row.driverName);
    summary.allocatedUsd += row.amountUsd;
    summary.allocationCount += 1;
    summary.latestActivity =
      !summary.latestActivity || new Date(row.date) > new Date(summary.latestActivity)
        ? row.date
        : summary.latestActivity;
  });

  spendRows.forEach((row) => {
    const summary = ensureSummary(row.driverName);
    summary.spentUsd += row.amountUsd;
    summary.spendCount += 1;
    summary.latestActivity =
      !summary.latestActivity || new Date(row.date) > new Date(summary.latestActivity)
        ? row.date
        : summary.latestActivity;
  });

  const summaries = Array.from(summaryMap.values())
    .map((summary) => ({
      ...summary,
      balanceUsd: summary.allocatedUsd - summary.spentUsd,
    }))
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
