import React from 'react';
import type { LandedCostSummary } from '../../types';
import { InsightPanel, MetricBarList, RankedMetricList, DashboardCard, DataTableWrapper } from '../ui';
import { ArrowUp, DeliveryTruck, Edit, TrashCan } from '@carbon/icons-react';
import { Button, Tag } from '@carbon/react';

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
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontWeight: 600, color: 'var(--cds-text-primary, #161616)' }}>{summary.make_model}</span>
        <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--cds-text-secondary, #525252)', textTransform: 'uppercase' }}>
          {summary.vin_number}
        </span>
      </div>
    ),
    region: (
      <Tag
        type={
          summary.status === 'UK'
            ? 'gray'
            : summary.status === 'Namibia'
            ? 'warm-gray'
            : summary.status === 'Zimbabwe'
            ? 'green'
            : summary.status === 'Botswana'
            ? 'purple'
            : 'blue'
        }
        size="sm"
      >
        {summary.status}
      </Tag>
    ),
    purchaseCost: `£${summary.purchase_price_gbp.toLocaleString()}`,
    landedCost: (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontWeight: 600, color: 'var(--cds-text-primary, #161616)', fontVariantNumeric: 'tabular-nums' }}>
          ${summary.total_landed_cost_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary, #525252)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
      {/* KPI Cards - Using Carbon-compliant DashboardCard */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        <DashboardCard
          title="Total Asset Valuation"
          value={`$${totalValuation.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          subtitle="Fleet book value"
          color="blue"
          footer={
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--cds-support-success, #24a148)', fontSize: '0.875rem', fontWeight: 600 }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--cds-text-secondary, #525252)', fontSize: '0.875rem' }}>
              <DeliveryTruck size={16} />
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
            <div style={{ width: '100%', height: 8, background: 'var(--cds-layer-accent-01, #e8e8e8)', marginTop: '0.5rem' }}>
              <div style={{ width: `${efficiencyRate}%`, height: '100%', background: 'var(--cds-support-success, #24a148)' }} />
            </div>
          }
        />
      </div>

      {/* Analytics Panels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
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

      {/* Inventory Table - Using Carbon DataTable */}
      <div style={{ marginTop: '1.5rem' }}>
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
