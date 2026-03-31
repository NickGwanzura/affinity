import React from 'react';
import type { LandedCostSummary } from '../../types';
import { InsightPanel, MetricBarList, RankedMetricList, DashboardCard } from '../ui';
import { ArrowUp, DeliveryTruck } from '@carbon/icons-react';

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

      {/* Inventory Table - Styled with Carbon tokens */}
      <div style={{ marginTop: '1.5rem', background: 'var(--cds-layer-01, #ffffff)', border: '1px solid var(--cds-border-subtle, #e0e0e0)' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--cds-border-subtle, #e0e0e0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--cds-text-primary, #161616)' }}>Current Inventory</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'var(--cds-layer-02, #f4f4f4)', borderBottom: '1px solid var(--cds-border-subtle, #e0e0e0)' }}>
                <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontWeight: 600, color: 'var(--cds-text-secondary, #525252)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Asset / VIN</th>
                <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontWeight: 600, color: 'var(--cds-text-secondary, #525252)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Region</th>
                <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontWeight: 600, color: 'var(--cds-text-secondary, #525252)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Purchase Cost</th>
                <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontWeight: 600, color: 'var(--cds-text-secondary, #525252)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Landed Cost</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((summary) => (
                <tr
                  key={summary.vehicle_id}
                  style={{ borderBottom: '1px solid var(--cds-border-subtle, #e0e0e0)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--cds-layer-hover, #f4f4f4)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600, color: 'var(--cds-text-primary, #161616)' }}>{summary.make_model}</span>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--cds-text-secondary, #525252)', textTransform: 'uppercase' }}>{summary.vin_number}</span>
                    </div>
                  </td>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.75rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        background:
                          summary.status === 'UK'
                            ? 'var(--cds-layer-02, #e0e0e0)'
                            : summary.status === 'Namibia'
                            ? 'var(--cds-support-warning, #f1c21b)'
                            : summary.status === 'Zimbabwe'
                            ? 'var(--cds-support-success, #24a148)'
                            : summary.status === 'Botswana'
                            ? '#8a3ffc'
                            : 'var(--cds-support-info, #0f62fe)',
                        color:
                          summary.status === 'UK'
                            ? 'var(--cds-text-primary, #161616)'
                            : summary.status === 'Namibia'
                            ? 'var(--cds-text-primary, #161616)'
                            : '#ffffff',
                      }}
                    >
                      {summary.status}
                    </span>
                  </td>
                  <td style={{ padding: '1rem 1.5rem', color: 'var(--cds-text-secondary, #525252)', fontVariantNumeric: 'tabular-nums' }}>
                    £{summary.purchase_price_gbp.toLocaleString()}
                  </td>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600, color: 'var(--cds-text-primary, #161616)', fontVariantNumeric: 'tabular-nums' }}>
                          ${summary.total_landed_cost_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary, #525252)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Valuation</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <button
                          onClick={() => onEditVehicle(summary)}
                          style={{
                            padding: '0.5rem',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--cds-interactive, #0f62fe)',
                            opacity: 0,
                            transition: 'opacity 0.15s',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
                          title="Edit vehicle"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => onDeleteVehicle(summary)}
                          style={{
                            padding: '0.5rem',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--cds-support-error, #da1e28)',
                            opacity: 0,
                            transition: 'opacity 0.15s',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
                          title="Delete vehicle"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default AdminOverviewView;
