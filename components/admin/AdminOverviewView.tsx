import React from 'react';
import type { LandedCostSummary } from '../../types';
import { InsightPanel, MetricBarList, RankedMetricList, DataTableWrapper } from '../ui';
import { ArrowUpRight, Truck, Package, Activity, Wallet } from 'lucide-react';

interface StatusDatum {
  name: string;
  value: number;
}

interface AdminOverviewViewProps {
  summaries: LandedCostSummary[];
  statusData: StatusDatum[];
  onEditVehicle: (vehicle: LandedCostSummary) => void;
  onDeleteVehicle: (vehicle: LandedCostSummary) => void;
}

interface InventoryRow {
  id: string;
  vehicle: LandedCostSummary;
  asset: React.ReactNode;
  region: React.ReactNode;
  purchaseCost: string;
  landedCost: React.ReactNode;
}

// modern region palette — kept stable across the dashboard.
const REGION_STYLES: Record<string, { bg: string; fg: string }> = {
  UK:        { bg: '#e7e5e4', fg: '#18181b' },
  Namibia:   { bg: '#f59e0b', fg: '#18181b' },
  Zimbabwe:  { bg: '#10b981', fg: '#ffffff' },
  Botswana:  { bg: '#8a3ffc', fg: '#ffffff' },
  Sold:      { bg: '#52525b', fg: '#ffffff' },
};
const DEFAULT_REGION = { bg: '#D97706', fg: '#ffffff' };

// ── KPI tile ────────────────────────────────────────────────────────────
interface KpiProps {
  eyebrow: string;
  value: React.ReactNode;
  caption: React.ReactNode;
  accent: string;
  icon: React.ReactNode;
  footer?: React.ReactNode;
}

const Kpi: React.FC<KpiProps> = ({ eyebrow, value, caption, accent, icon, footer }) => (
  <div className="group relative flex flex-col bg-white border border-[#e7e5e4] transition-colors duration-150 hover:border-[#d6d3d1]">
    <span
      aria-hidden="true"
      className="absolute inset-y-0 left-0 w-[3px]"
      style={{ background: accent }}
    />
    <div className="flex items-start justify-between gap-3 p-6 pl-7">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#52525b] mb-3">
          {eyebrow}
        </p>
        <p className="text-[32px] font-light leading-none tabular-nums text-[#18181b] mb-2">
          {value}
        </p>
        <p className="text-sm text-[#52525b] leading-snug">{caption}</p>
      </div>
      <div
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center text-white"
        style={{ background: accent }}
      >
        {icon}
      </div>
    </div>
    {footer ? (
      <div className="border-t border-[#e7e5e4] px-6 py-3 pl-7 text-sm text-[#52525b]">
        {footer}
      </div>
    ) : null}
  </div>
);

// ── Main view ──────────────────────────────────────────────────────────
export const AdminOverviewView: React.FC<AdminOverviewViewProps> = ({
  summaries,
  statusData,
  onEditVehicle,
  onDeleteVehicle,
}) => {
  const totalValuation = summaries.reduce((acc, s) => acc + s.total_landed_cost_usd, 0);
  const totalExpenses = summaries.reduce((acc, s) => acc + (s.total_expenses_usd || 0), 0);
  const inTransitCount = summaries.filter((s) => s.status !== 'Sold').length;
  const soldCount = summaries.length - inTransitCount;
  const efficiencyRate =
    summaries.length > 0 ? Math.round((inTransitCount / summaries.length) * 100) : 0;
  const avgLandedCost = summaries.length > 0 ? totalValuation / summaries.length : 0;

  const fmtMoney = (n: number, opts: Intl.NumberFormatOptions = { maximumFractionDigits: 0 }) =>
    `$${n.toLocaleString(undefined, opts)}`;

  const fmtCompact = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
  };

  const tableRows: InventoryRow[] = summaries.map((summary) => {
    const region = REGION_STYLES[summary.status] ?? DEFAULT_REGION;
    return {
      id: summary.vehicle_id,
      vehicle: summary,
      asset: (
        <div className="flex flex-col">
          <span className="font-semibold text-[#18181b]">{summary.make_model}</span>
          <span className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.08em] text-[#71717a]">
            {summary.vin_number}
          </span>
        </div>
      ),
      region: (
        <span
          className="inline-flex items-center px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]"
          style={{ background: region.bg, color: region.fg }}
        >
          {summary.status}
        </span>
      ),
      purchaseCost: `£${summary.purchase_price_gbp.toLocaleString()}`,
      landedCost: (
        <div className="flex flex-col">
          <span className="font-semibold text-[#18181b] tabular-nums">
            {fmtMoney(summary.total_landed_cost_usd)}
          </span>
          <span className="mt-0.5 text-[11px] uppercase tracking-[0.08em] text-[#71717a]">
            Total landed
          </span>
        </div>
      ),
    };
  });

  const columns = [
    { key: 'asset', header: 'Asset / VIN', width: '30%' },
    { key: 'region', header: 'Region', width: '15%' },
    { key: 'purchaseCost', header: 'Purchase cost', width: '20%' },
    { key: 'landedCost', header: 'Landed cost', width: '25%' },
  ];

  const topByLanded = [...summaries]
    .sort((a, b) => (b.total_landed_cost_usd || 0) - (a.total_landed_cost_usd || 0))
    .slice(0, 6);

  const distributionItems = statusData
    .filter((item) => item.value > 0)
    .map((item) => ({
      label: item.name,
      value: `${item.value} ${item.value === 1 ? 'vehicle' : 'vehicles'}`,
      helper:
        summaries.length > 0
          ? `${((item.value / summaries.length) * 100).toFixed(0)}% of fleet`
          : '0% of fleet',
      percent: summaries.length > 0 ? (item.value / summaries.length) * 100 : 0,
      tone: (item.name === 'Sold'
        ? 'red'
        : item.name === 'Namibia'
        ? 'green'
        : item.name === 'Zimbabwe'
        ? 'teal'
        : item.name === 'Botswana'
        ? 'purple'
        : 'blue') as 'red' | 'green' | 'teal' | 'purple' | 'blue',
    }));

  return (
    <div className="flex flex-col gap-8">
      {/* Hero strip */}
      <section className="relative overflow-hidden bg-[#18181b] text-white">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="relative flex flex-col gap-6 p-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#a8a29e]">
              Fleet overview
            </p>
            <h1 className="mt-2 text-3xl font-medium leading-tight tracking-[-0.02em] md:text-4xl">
              {summaries.length === 0
                ? 'No fleet data yet.'
                : `${summaries.length} ${summaries.length === 1 ? 'vehicle' : 'vehicles'} under management.`}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-[#a1a1aa]">
              Landed-cost, region breakdown, and inventory health in one view. Figures update
              as expenses and transits are recorded.
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-8 text-left">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-widest text-[#a8a29e]">
                Book value
              </dt>
              <dd className="mt-1 text-2xl font-light tabular-nums">{fmtCompact(totalValuation)}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-widest text-[#a8a29e]">
                In transit
              </dt>
              <dd className="mt-1 text-2xl font-light tabular-nums">{inTransitCount}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-widest text-[#a8a29e]">
                Efficiency
              </dt>
              <dd className="mt-1 text-2xl font-light tabular-nums">
                {summaries.length === 0 ? '—' : `${efficiencyRate}%`}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* KPI grid */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          eyebrow="Total asset valuation"
          value={fmtCompact(totalValuation)}
          caption="Fleet book value across all regions"
          accent="#D97706"
          icon={<Wallet size={18} strokeWidth={2} />}
          footer={
            <span className="inline-flex items-center gap-1.5 font-medium text-[#10b981]">
              <ArrowUpRight size={14} strokeWidth={2.5} />
              Healthy inventory
            </span>
          }
        />
        <Kpi
          eyebrow="In-transit assets"
          value={inTransitCount}
          caption={
            soldCount > 0
              ? `${soldCount} sold · ${summaries.length} total`
              : 'Active routes across the corridor'
          }
          accent="#059669"
          icon={<Truck size={18} strokeWidth={2} />}
          footer={
            <span className="flex items-center gap-1.5">
              <Activity size={14} strokeWidth={2} /> Live from shipment log
            </span>
          }
        />
        <Kpi
          eyebrow="Fleet efficiency"
          value={summaries.length === 0 ? '—' : `${efficiencyRate}%`}
          caption={
            summaries.length === 0
              ? 'No fleet data'
              : `${inTransitCount} of ${summaries.length} vehicles active`
          }
          accent="#8a3ffc"
          icon={<Activity size={18} strokeWidth={2} />}
          footer={
            <div className="flex items-center gap-3">
              <div className="relative h-1.5 flex-1 bg-[#f5f5f4]">
                <div
                  className="absolute inset-y-0 left-0 transition-[width] duration-500"
                  style={{ width: `${efficiencyRate}%`, background: '#10b981' }}
                />
              </div>
              <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#71717a]">
                Target 95%
              </span>
            </div>
          }
        />
        <Kpi
          eyebrow="Avg cost / vehicle"
          value={summaries.length === 0 ? '—' : fmtCompact(avgLandedCost)}
          caption={`Transit spend ${fmtCompact(totalExpenses)}`}
          accent="#f59e0b"
          icon={<Package size={18} strokeWidth={2} />}
          footer={
            <span>
              {totalValuation > 0
                ? `${((totalExpenses / totalValuation) * 100).toFixed(1)}% expense ratio`
                : '—'}
            </span>
          }
        />
      </section>

      {/* Analytics panels */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <InsightPanel
          title="Landed-cost leaders"
          subtitle="Top vehicles ranked by total landed cost with transit spend called out."
        >
          <RankedMetricList
            items={topByLanded.map((summary) => ({
              label: summary.make_model,
              value: fmtMoney(summary.total_landed_cost_usd || 0),
              helper: `${summary.vin_number} · transit ${fmtMoney(summary.total_expenses_usd || 0)}`,
              tone: 'blue' as const,
            }))}
            emptyMessage="No landed-cost data yet."
          />
        </InsightPanel>

        <InsightPanel
          title="Regional distribution"
          subtitle="Fleet distribution by operating region and status."
        >
          <MetricBarList
            items={distributionItems}
            emptyMessage="No regional distribution data yet."
          />
        </InsightPanel>
      </section>

      {/* Inventory table */}
      <section>
        <DataTableWrapper
          title="Current inventory"
          description="Fleet assets with landed-cost breakdown"
          rows={tableRows}
          columns={columns}
          onEdit={(row) => onEditVehicle(row.vehicle)}
          onDelete={(row) => onDeleteVehicle(row.vehicle)}
          emptyMessage="No vehicles in inventory."
          size="md"
        />
      </section>
    </div>
  );
};

export default AdminOverviewView;
