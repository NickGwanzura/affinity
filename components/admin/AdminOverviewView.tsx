import React from 'react';
import type { LandedCostSummary } from '../../types';
import { InsightPanel, MetricBarList, RankedMetricList } from '../ui';

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
}) => (
  <>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-zinc-200 relative overflow-hidden group">
        <p className="text-zinc-400 text-xs font-black uppercase tracking-widest">Total Asset Valuation</p>
        <h2 className="text-4xl font-black mt-3 text-zinc-900">
          ${summaries.reduce((acc, summary) => acc + summary.total_landed_cost_usd, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </h2>
        <div className="mt-4 flex items-center gap-1.5 text-emerald-600 text-sm font-bold">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 10l7-7m0 0l7 7m-7-7v18" strokeWidth="3" /></svg>
          Healthy Inventory
        </div>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-sm border border-zinc-200">
        <p className="text-zinc-400 text-xs font-black uppercase tracking-widest">In-Transit Assets</p>
        <h2 className="text-4xl font-black mt-3 text-blue-600">
          {summaries.filter((summary) => summary.status !== 'Sold').length}
        </h2>
        <div className="mt-4 flex items-center gap-3">
          <span className="text-zinc-400 text-xs font-bold tracking-tight">Active routes across Namibia & Zim</span>
        </div>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-sm border border-zinc-200">
        <p className="text-zinc-400 text-xs font-black uppercase tracking-widest">Fleet Efficiency</p>
        <h2 className="text-4xl font-black mt-3 text-zinc-900">94%</h2>
        <div className="mt-5 h-2.5 bg-zinc-100 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 w-[94%] rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
        </div>
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
        subtitle="A Carbon-style distribution view of the fleet by operating region and status."
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

    <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 overflow-hidden">
      <div className="px-8 py-6 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/30">
        <h3 className="text-xl font-black text-zinc-900 tracking-tight">Current Inventory</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-100">
              <th className="px-8 py-4 font-black text-zinc-400 uppercase tracking-widest text-xs">Asset / VIN</th>
              <th className="px-8 py-4 font-black text-zinc-400 uppercase tracking-widest text-xs">Region</th>
              <th className="px-8 py-4 font-black text-zinc-400 uppercase tracking-widest text-xs">Purchase Cost</th>
              <th className="px-8 py-4 font-black text-zinc-400 uppercase tracking-widest text-xs">Landed Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {summaries.map((summary) => (
              <tr key={summary.vehicle_id} className="hover:bg-zinc-50 transition-all group">
                <td className="px-8 py-6">
                  <div className="flex flex-col">
                    <span className="font-black text-zinc-900 text-base">{summary.make_model}</span>
                    <span className="font-mono text-xs text-zinc-400 font-bold uppercase tracking-wider">{summary.vin_number}</span>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <span className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest ring-1 ${
                    summary.status === 'UK' ? 'bg-zinc-100 text-zinc-500 ring-zinc-200' :
                    summary.status === 'Namibia' ? 'bg-amber-50 text-amber-700 ring-amber-100' :
                    summary.status === 'Zimbabwe' ? 'bg-emerald-50 text-emerald-700 ring-emerald-100' :
                    summary.status === 'Botswana' ? 'bg-purple-50 text-purple-700 ring-purple-100' :
                    'bg-blue-50 text-blue-700 ring-blue-100'
                  }`}>
                    {summary.status}
                  </span>
                </td>
                <td className="px-8 py-6 font-bold text-zinc-400 tracking-tight">£{summary.purchase_price_gbp.toLocaleString()}</td>
                <td className="px-8 py-6">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-black text-zinc-900 text-lg">${summary.total_landed_cost_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      <span className="text-xs text-zinc-400 font-bold uppercase tracking-widest">Total Valuation</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onEditVehicle(summary)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg hover:bg-blue-50 text-blue-600"
                        title="Edit vehicle"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => onDeleteVehicle(summary)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg hover:bg-red-50 text-red-600"
                        title="Delete vehicle"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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

export default AdminOverviewView;
