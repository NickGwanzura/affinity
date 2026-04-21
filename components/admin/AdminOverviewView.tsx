import React from 'react';
import type { LandedCostSummary } from '../../types';
import { InsightPanel, MetricBarList, RankedMetricList, DashboardCard, DataTableWrapper } from '../ui';
import { ArrowUp, Truck, Pencil, Trash2 } from 'lucide-react';

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

// Convert LandedCostSummary to table row format
interface InventoryRow {
  id: string;
  vehicle: LandedCostSummary;
  asset: React.ReactNode;
  region: React.ReactNode;
  purchaseCost: string;
  landedCost: React.ReactNode;
}

export const AdminOverviewView: React.FC<AdminOverviewViewProps> = ({
  summaries,
  statusData,
  onEditVehicle,
  onDeleteVehicle,
}) => {
  const totalValuation = summaries.reduce((acc, s) => acc + s.total_landed_cost_usd, 0);
  const inTransitCount = summaries.filter((s) => s.status !== 'Sold').length;
  const efficiencyRate = summaries.length > 0
    ? Math.round((inTransitCount / summaries.length) * 100)
    : 0;

  // Transform summaries into table rows
  const tableRows: InventoryRow[] = summaries.map((summary) => ({
    id: summary.vehicle_id,
    vehicle: summary,
    asset: (
      <div className="flex flex-col">
        <span className="font-semibold text-[#161616]">{summary.make_model}</span>
        <span className="font-mono text-xs text-[#525252] uppercase">
          {summary.vin_number}
        </span>
      </div>
    ),
    region: (
      <span
        className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider"
        style={{
          background:
            summary.status === 'UK'
              ? '#e0e0e0'
              : summary.status === 'Namibia'
              ? '#f1c21b'
              : summary.status === 'Zimbabwe'
              ? '#24a148'
              : summary.status === 'Botswana'
              ? '#8a3ffc'
              : '#0f62fe',
          color:
            summary.status === 'UK' || summary.status === 'Namibia'
              ? '#161616'
              : '#ffffff',
        }}
      >
        {summary.status}
      </span>
    ),
    purchaseCost: `£${summary.purchase_price_gbp.toLocaleString()}`,
    landedCost: (
      <div className="flex flex-col">
        <span className="font-semibold text-[#161616] tabular-nums">
          ${summary.total_landed_cost_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </span>
        <span className="text-xs text-[#525252] uppercase tracking-wider">
          Total Valuation
        </span>
      </div>
    ),
  }));

  const columns = [
    { key: 'asset', header: 'Asset / VIN', width: '30%' },
    { key: 'region', header: 'Region', width: '15%' },
    { key: 'purchaseCost', header: 'Purchase Cost', width: '20%' },
    { key: 'landedCost', header: 'Landed Cost', width: '25%' },
  ];

  return (
    <>
      {/* KPI Cards */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <DashboardCard
          title="Total Asset Valuation"
          value={`$${totalValuation.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          subtitle="Fleet book value"
          color="blue"
          footer={
            <div className="flex items-center gap-2 text-sm font-semibold text-[#24a148]">
              <ArrowUp size={16} />
              <span>Healthy Inventory</span>
            </div>
          }
        />

        <DashboardCard
          title="In-Transit Assets"
          value={inTransitCount}
          subtitle="Active routes"
          color="green"
          footer={
            <div className="flex items-center gap-2 text-sm text-[#525252]">
              <Truck size={16} />
              <span>Across Namibia & Zimbabwe</span>
            </div>
          }
        />

        <DashboardCard
          title="Fleet Efficiency"
          value={summaries.length === 0 ? '—' : `${efficiencyRate}%`}
          subtitle={summaries.length === 0 ? 'No fleet data' : `${inTransitCount} of ${summaries.length} vehicles active`}
          color="purple"
          footer={
            <div className="w-full h-2 bg-[#e8e8e8] mt-2">
              <div className="h-full bg-[#24a148]" style={{ width: `${efficiencyRate}%` }} />
            </div>
          }
        />
      </div>

      {/* Analytics Panels */}
      <div className="grid gap-6 mt-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))' }}>
        <InsightPanel
          title="Landed Cost Breakdown"
          subtitle="Top vehicles ranked by total landed cost with the transit component called out."
        >
          <RankedMetricList
            items={[...summaries]
              .sort((a, b) => (b.total_landed_cost_usd || 0) - (a.total_landed_cost_usd || 0))
              .slice(0, 6)
              .map((summary) => ({
                label: summary.make_model,
                value: `$${(summary.total_landed_cost_usd || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                helper: `${summary.vin_number} • transit $${(summary.total_expenses_usd || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                tone: 'blue' as const,
              }))}
            emptyMessage="No landed-cost data yet."
          />
        </InsightPanel>

        <InsightPanel
          title="Geographic Distribution"
          subtitle="Fleet distribution by operating region and status."
        >
          <MetricBarList
            items={statusData
              .filter((item) => item.value > 0)
              .map((item) => ({
                label: item.name,
                value: `${item.value} vehicles`,
                helper: summaries.length > 0 ? `${((item.value / summaries.length) * 100).toFixed(1)}% of fleet` : '0% of fleet',
                percent: summaries.length > 0 ? (item.value / summaries.length) * 100 : 0,
                tone: item.name === 'Sold' ? 'red' : item.name === 'Namibia' ? 'green' : item.name === 'Zimbabwe' ? 'teal' : item.name === 'Botswana' ? 'purple' : 'blue',
              }))}
            emptyMessage="No regional distribution data yet."
          />
        </InsightPanel>
      </div>

      {/* Inventory Table */}
      <div className="mt-6">
        <DataTableWrapper
          title="Current Inventory"
          description="Fleet assets with landed cost breakdown"
          rows={tableRows}
          columns={columns}
          onEdit={(row) => onEditVehicle(row.vehicle)}
          onDelete={(row) => onDeleteVehicle(row.vehicle)}
          emptyMessage="No vehicles in inventory."
          size="md"
        />
      </div>
    </>
  );
};

export default AdminOverviewView;
