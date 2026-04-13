import React, { memo, useMemo } from 'react';
import { Tile } from '@carbon/react';
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
      ? 'var(--cds-support-success, #24a148)'
      : clamped >= 70
      ? 'var(--cds-support-warning, #f1c21b)'
      : 'var(--cds-support-error, #da1e28)';
  const statusLabel =
    clamped >= 90 ? 'Excellent performance' : clamped >= 70 ? 'Good performance' : 'Needs attention';

  return (
    <Tile
      role="region"
      aria-label="Fleet Efficiency"
      style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}
    >
      {/* Left accent bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 4,
          height: '100%',
          background: statusColor,
        }}
      />
      <div style={{ paddingLeft: '0.5rem' }}>
        <p
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--cds-text-secondary, #525252)',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            margin: '0 0 0.75rem',
          }}
        >
          Fleet Efficiency
        </p>
        <p
          style={{
            fontSize: '2rem',
            fontWeight: 300,
            color: 'var(--cds-text-primary, #161616)',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.1,
            margin: '0 0 1rem',
          }}
        >
          {clamped}%
        </p>

        {/* Progress bar */}
        <div style={{ marginBottom: '0.75rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.75rem',
              color: 'var(--cds-text-secondary, #525252)',
              marginBottom: '0.375rem',
              fontWeight: 600,
            }}
          >
            <span>0%</span>
            <span>Target: 95%</span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={clamped}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Fleet efficiency percentage"
            style={{
              height: 8,
              background: 'var(--cds-layer-02, #e0e0e0)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${clamped}%`,
                background: statusColor,
                transition: 'width 600ms cubic-bezier(0.2, 0, 0.38, 0.9)',
              }}
            />
          </div>
        </div>

        {/* Status indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            aria-hidden="true"
            style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, flexShrink: 0 }}
          />
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--cds-text-secondary, #525252)' }}>
            {statusLabel}
          </span>
        </div>
      </div>
    </Tile>
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
        color="blue"
      />

      <StatCard
        title="In-Transit Assets"
        value={inTransitCount}
        subtitle={
          soldCount > 0
            ? `${soldCount} sold · ${summaries.length} total`
            : 'Active routes across Namibia & Zim'
        }
        color="green"
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
          color="blue"
        />
        <StatCard
          title="In-Transit Assets"
          value={inTransitCount}
          subtitle="Active fleet"
          color="green"
        />
        <StatCard
          title="Total Expenses"
          value={`$${totalExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          subtitle={`${expenses.length} transactions`}
          color="amber"
        />
        <StatCard
          title="Avg Cost Per Vehicle"
          value={`$${averageCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          subtitle={`${expenseRatio.toFixed(1)}% expense ratio`}
          color="blue"
        />
      </div>
    );
  },
);

ExtendedDashboardStats.displayName = 'ExtendedDashboardStats';

export default DashboardStats;
