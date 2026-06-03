import React, { memo, useMemo } from 'react';
import { VEHICLE_STATUS } from '../../constants';
import type { LandedCostSummary } from '../../types';
import { StatCard } from '../ui';

// ============================================
// Types
// ============================================
interface DashboardStatsProps {
  summaries: LandedCostSummary[];
  efficiencyRate?: number;
}

// ============================================
// Fleet Efficiency Card (custom — has progress bar)
// ============================================
interface EfficiencyCardProps {
  efficiencyRate: number;
}

const EfficiencyCard: React.FC<EfficiencyCardProps> = memo(({ efficiencyRate }) => {
  const clamped = Math.max(0, Math.min(100, efficiencyRate));
  const statusColor =
    clamped >= 90
      ? '#10b981'
      : clamped >= 70
      ? '#f59e0b'
      : '#dc2626';
  const statusLabel =
    clamped >= 90 ? 'Excellent performance' : clamped >= 70 ? 'Good performance' : 'Needs attention';

  return (
    <div
      role="region"
      aria-label="Fleet Efficiency"
      className="bg-white p-6 relative overflow-hidden"
    >
      {/* Left accent bar */}
      <div
        className="absolute top-0 left-0 w-1 h-full"
        style={{ background: statusColor }}
      />
      <div className="pl-2">
        <p className="text-xs font-semibold text-[#52525b] tracking-[0.08em] uppercase mb-3">
          Fleet Efficiency
        </p>
        <p className="text-3xl font-light text-[#18181b] tabular-nums leading-tight mb-4">
          {clamped}%
        </p>

        {/* Progress bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-[#52525b] mb-1 font-semibold">
            <span>0%</span>
            <span>Target: 95%</span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={clamped}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Fleet efficiency percentage"
            className="h-2 bg-[#e7e5e4] overflow-hidden"
          >
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${clamped}%`,
                background: statusColor,
              }}
            />
          </div>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: statusColor }}
          />
          <span className="text-xs font-semibold text-[#52525b]">
            {statusLabel}
          </span>
        </div>
      </div>
    </div>
  );
});

EfficiencyCard.displayName = 'EfficiencyCard';

// ============================================
// Main Component
// ============================================

export const DashboardStats: React.FC<DashboardStatsProps> = memo(({ summaries, efficiencyRate = 94 }) => {
  const totalValuation = useMemo(
    () => summaries.reduce((acc, s) => acc + s.total_landed_cost_usd, 0),
    [summaries],
  );

  const inTransitCount = useMemo(
    () => summaries.filter((s) => s.status !== VEHICLE_STATUS.SOLD).length,
    [summaries],
  );

  const soldCount = useMemo(
    () => summaries.filter((s) => s.status === VEHICLE_STATUS.SOLD).length,
    [summaries],
  );

  const formatCurrency = (value: number): string => {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      role="region"
      aria-label="Dashboard statistics"
    >
      <StatCard
        title="Total Asset Valuation"
        value={formatCurrency(totalValuation)}
        subtitle="↑ Healthy Inventory"
        intent="primary"
      />

      <StatCard
        title="In-Transit Assets"
        value={inTransitCount}
        subtitle={
          soldCount > 0
            ? `${soldCount} sold · ${summaries.length} total`
            : 'Active routes across Namibia & Zim'
        }
        intent="success"
      />

      <EfficiencyCard efficiencyRate={efficiencyRate} />
    </div>
  );
});

DashboardStats.displayName = 'DashboardStats';

// ============================================
// Extended Stats Component
// ============================================
interface ExtendedDashboardStatsProps extends DashboardStatsProps {
  expenses?: { amount: number; exchange_rate_to_usd: number }[];
}

export const ExtendedDashboardStats: React.FC<ExtendedDashboardStatsProps> = memo(
  ({ summaries, expenses = [] }) => {
    const totalValuation = useMemo(
      () => summaries.reduce((acc, s) => acc + s.total_landed_cost_usd, 0),
      [summaries],
    );

    const inTransitCount = useMemo(
      () => summaries.filter((s) => s.status !== VEHICLE_STATUS.SOLD).length,
      [summaries],
    );

    const totalExpenses = useMemo(
      () => expenses.reduce((acc, exp) => acc + exp.amount * (exp.exchange_rate_to_usd || 1), 0),
      [expenses],
    );

    const averageCost = useMemo(
      () => (summaries.length > 0 ? totalValuation / summaries.length : 0),
      [summaries.length, totalValuation],
    );

    const expenseRatio = useMemo(
      () => (totalValuation > 0 ? (totalExpenses / totalValuation) * 100 : 0),
      [totalExpenses, totalValuation],
    );

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Fleet Value"
          value={`$${totalValuation.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          subtitle={`${summaries.length} vehicles`}
          intent="primary"
        />
        <StatCard
          title="In-Transit Assets"
          value={inTransitCount}
          subtitle="Active fleet"
          intent="success"
        />
        <StatCard
          title="Total Expenses"
          value={`$${totalExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          subtitle={`${expenses.length} transactions`}
          intent="warning"
        />
        <StatCard
          title="Avg Cost Per Vehicle"
          value={`$${averageCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          subtitle={`${expenseRatio.toFixed(1)}% expense ratio`}
          intent="primary"
        />
      </div>
    );
  },
);

ExtendedDashboardStats.displayName = 'ExtendedDashboardStats';

export default DashboardStats;
