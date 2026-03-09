import React, { memo, useMemo } from 'react';
import { VEHICLE_STATUS } from '../../constants';
import type { LandedCostSummary } from '../../types';

// ============================================
// Types
// ============================================
interface DashboardStatsProps {
  summaries: LandedCostSummary[];
  efficiencyRate?: number;
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    label: string;
  };
  variant: 'primary' | 'secondary' | 'tertiary';
  icon?: React.ReactNode;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get variant-based styles for stat cards
 */
const getVariantStyles = (variant: StatCardProps['variant']) => {
  const styles = {
    primary: {
      card: 'bg-white',
      title: 'text-zinc-400',
      value: 'text-zinc-900',
      trend: 'text-emerald-600'
    },
    secondary: {
      card: 'bg-white',
      title: 'text-zinc-400',
      value: 'text-blue-600',
      trend: 'text-zinc-400'
    },
    tertiary: {
      card: 'bg-white',
      title: 'text-zinc-400',
      value: 'text-zinc-900',
      trend: 'text-emerald-600'
    }
  };
  return styles[variant];
};

// ============================================
// Sub-Components
// ============================================

const StatCard: React.FC<StatCardProps> = memo(({
  title,
  value,
  subtitle,
  trend,
  variant,
  icon
}) => {
  const styles = getVariantStyles(variant);

  return (
    <div 
      className={`${styles.card} p-8 rounded-3xl shadow-sm border border-zinc-200 relative overflow-hidden group transition-all duration-300 hover:shadow-md`}
      role="region"
      aria-label={title}
    >
      {/* Title */}
      <p className={`${styles.title} text-[10px] font-black uppercase tracking-widest`}>
        {title}
      </p>

      {/* Value */}
      <h2 className={`${styles.value} text-4xl font-black mt-3`}>
        {value}
      </h2>

      {/* Trend or Subtitle */}
      {trend && (
        <div className={`mt-4 flex items-center gap-1.5 ${styles.trend} text-sm font-bold`}>
          {trend.direction === 'up' && (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          )}
          {trend.direction === 'down' && (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          )}
          {trend.direction === 'neutral' && (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 12h14" />
            </svg>
          )}
          {trend.label}
        </div>
      )}

      {subtitle && !trend && (
        <div className="mt-4 flex items-center gap-3">
          <span className="text-zinc-400 text-xs font-bold tracking-tight">{subtitle}</span>
        </div>
      )}

      {/* Icon (if provided) */}
      {icon && (
        <div className="absolute top-6 right-6 opacity-10 group-hover:opacity-20 transition-opacity">
          {icon}
        </div>
      )}
    </div>
  );
});

StatCard.displayName = 'StatCard';

/**
 * Fleet Efficiency Card with Progress Bar
 */
interface EfficiencyCardProps {
  efficiencyRate: number;
}

const EfficiencyCard: React.FC<EfficiencyCardProps> = memo(({ efficiencyRate }) => {
  // Clamp efficiency rate between 0 and 100
  const clampedRate = Math.max(0, Math.min(100, efficiencyRate));

  return (
    <div 
      className="bg-white p-8 rounded-3xl shadow-sm border border-zinc-200 relative overflow-hidden group transition-all duration-300 hover:shadow-md"
      role="region"
      aria-label="Fleet Efficiency"
    >
      <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">
        Fleet Efficiency
      </p>
      <h2 className="text-4xl font-black mt-3 text-zinc-900">
        {clampedRate}%
      </h2>
      
      {/* Progress Bar */}
      <div className="mt-5">
        <div className="flex justify-between text-xs text-zinc-400 mb-1.5 font-semibold">
          <span>0%</span>
          <span>Target: 95%</span>
        </div>
        <div 
          className="h-2.5 bg-zinc-100 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={clampedRate}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Fleet efficiency percentage"
        >
          <div 
            className="h-full bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)] transition-all duration-1000 ease-out"
            style={{ width: `${clampedRate}%` }}
          />
        </div>
      </div>

      {/* Status indicator */}
      <div className="mt-4 flex items-center gap-2">
        <div 
          className={`w-2.5 h-2.5 rounded-full ${
            clampedRate >= 90 ? 'bg-emerald-500' : 
            clampedRate >= 70 ? 'bg-amber-500' : 'bg-red-500'
          }`}
          aria-hidden="true"
        />
        <span className="text-xs font-semibold text-zinc-500">
          {clampedRate >= 90 ? 'Excellent performance' : 
           clampedRate >= 70 ? 'Good performance' : 'Needs attention'}
        </span>
      </div>
    </div>
  );
});

EfficiencyCard.displayName = 'EfficiencyCard';

// ============================================
// Main Component
// ============================================

export const DashboardStats: React.FC<DashboardStatsProps> = memo(({
  summaries,
  efficiencyRate = 94
}) => {
  // Calculate total asset valuation
  const totalValuation = useMemo(() => 
    summaries.reduce((acc, summary) => acc + summary.total_landed_cost_usd, 0),
  [summaries]);

  // Calculate in-transit assets count
  const inTransitCount = useMemo(() => 
    summaries.filter(s => s.status !== VEHICLE_STATUS.SOLD).length,
  [summaries]);

  // Calculate sold count
  const soldCount = useMemo(() => 
    summaries.filter(s => s.status === VEHICLE_STATUS.SOLD).length,
  [summaries]);

  // Calculate average cost per vehicle
  const averageCost = useMemo(() => 
    summaries.length > 0 ? totalValuation / summaries.length : 0,
  [summaries.length, totalValuation]);

  // Format currency values
  const formatCurrency = (value: number): string => {
    if (value >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(1)}M`;
    }
    if (value >= 1_000) {
      return `$${(value / 1_000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  return (
    <div 
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      role="region"
      aria-label="Dashboard statistics"
    >
      {/* Total Asset Valuation */}
      <StatCard
        title="Total Asset Valuation"
        value={formatCurrency(totalValuation)}
        trend={{
          direction: 'up',
          label: 'Healthy Inventory'
        }}
        variant="primary"
        icon={
          <svg className="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />

      {/* In-Transit Assets */}
      <StatCard
        title="In-Transit Assets"
        value={inTransitCount}
        subtitle={soldCount > 0 ? `${soldCount} sold • ${summaries.length} total` : `Active routes across Namibia & Zim`}
        variant="secondary"
        icon={
          <svg className="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
          </svg>
        }
      />

      {/* Fleet Efficiency */}
      <EfficiencyCard efficiencyRate={efficiencyRate} />
    </div>
  );
});

DashboardStats.displayName = 'DashboardStats';

// ============================================
// Extended Stats Component (for detailed views)
// ============================================

interface ExtendedDashboardStatsProps extends DashboardStatsProps {
  expenses?: { amount: number; exchange_rate_to_usd: number }[];
}

/**
 * Extended dashboard stats including expense information
 */
export const ExtendedDashboardStats: React.FC<ExtendedDashboardStatsProps> = memo(({
  summaries,
  expenses = [],
  efficiencyRate = 94
}) => {
  // Calculate base stats
  const totalValuation = useMemo(() => 
    summaries.reduce((acc, summary) => acc + summary.total_landed_cost_usd, 0),
  [summaries]);

  const inTransitCount = useMemo(() => 
    summaries.filter(s => s.status !== VEHICLE_STATUS.SOLD).length,
  [summaries]);

  // Calculate expense stats
  const totalExpenses = useMemo(() => 
    expenses.reduce((acc, exp) => acc + (exp.amount * (exp.exchange_rate_to_usd || 1)), 0),
  [expenses]);

  const averageCost = useMemo(() => 
    summaries.length > 0 ? totalValuation / summaries.length : 0,
  [summaries.length, totalValuation]);

  const expenseRatio = useMemo(() => 
    totalValuation > 0 ? (totalExpenses / totalValuation) * 100 : 0,
  [totalExpenses, totalValuation]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Total Fleet Value */}
      <StatCard
        title="Total Fleet Value"
        value={`$${totalValuation.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
        subtitle={`${summaries.length} vehicles`}
        variant="primary"
      />

      {/* In-Transit */}
      <StatCard
        title="In-Transit Assets"
        value={inTransitCount}
        trend={{ direction: 'neutral', label: 'Active fleet' }}
        variant="secondary"
      />

      {/* Total Expenses */}
      <StatCard
        title="Total Expenses"
        value={`$${totalExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
        subtitle={`${expenses.length} transactions`}
        variant="tertiary"
      />

      {/* Average Cost */}
      <StatCard
        title="Avg Cost Per Vehicle"
        value={`$${averageCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
        subtitle={`${expenseRatio.toFixed(1)}% expense ratio`}
        variant="primary"
      />
    </div>
  );
});

ExtendedDashboardStats.displayName = 'ExtendedDashboardStats';

export default DashboardStats;
