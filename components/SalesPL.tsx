import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, RefreshCw, BarChart3 } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import { useToast } from './Toast';

const API = '/api/sales-pl';
const fmt = (n: number) => formatCurrency(n, 'USD');

interface PLData {
  periods: {
    today: {
      revenue: number;
      breakdown: Record<string, number>;
    };
    this_week: {
      revenue: number;
      breakdown: Record<string, number>;
    };
    this_month: {
      revenue: number;
      cogs: number;
      wifi_cost: number;
      gross_profit: number;
      gross_margin_pct: number;
      breakdown: Record<string, number>;
    };
  };
}

const KpiCard: React.FC<{ label: string; value: string; positive?: boolean; negative?: boolean }> = ({ label, value, positive, negative }) => (
  <div className="rounded-xl border border-stone-200 bg-white p-4">
    <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{label}</p>
    <p className={`mt-2 text-2xl font-bold tabular-nums ${
      positive ? 'text-emerald-600' : negative ? 'text-red-600' : 'text-zinc-900'
    }`}>{value}</p>
  </div>
);

const BreakdownRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-100 last:border-b-0">
    <span className="text-sm capitalize text-zinc-700">{label}</span>
    <span className="text-sm font-semibold text-zinc-900">{value}</span>
  </div>
);

export const SalesPL: React.FC = () => {
  const { showToast } = useToast();
  const [data, setData] = useState<PLData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(API);
      if (!res.ok) throw new Error('Failed');
      setData(await res.json());
    } catch {
      showToast('Failed to load P&L data', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="h-8 w-48 app-shimmer rounded" />
            <div className="h-4 w-36 app-shimmer rounded" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="rounded-xl border border-stone-200 bg-white p-4">
              <div className="h-3 w-16 app-shimmer rounded mb-3" />
              <div className="h-7 w-28 app-shimmer rounded" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[1,2,3].map(i => (
            <div key={i} className="rounded-xl border border-stone-200 bg-white p-4">
              <div className="h-4 w-32 app-shimmer rounded mb-4" />
              {[1,2,3,4].map(j => (
                <div key={j} className="h-4 w-full app-shimmer rounded mb-2" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-stone-100">
          <BarChart3 size={24} className="text-zinc-400" />
        </div>
        <p className="text-sm font-medium text-zinc-700">No data available</p>
      </div>
    );
  }

  const { today, this_week: week, this_month: month } = data.periods;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Profit & Loss</h1>
          <p className="mt-0.5 text-sm text-zinc-500">Consolidated sales performance</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-1.5 text-sm font-medium text-[#D97706] hover:text-amber-700">
          <RefreshCw size={14} />Refresh
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Today"       value={fmt(today.revenue)} positive />
        <KpiCard label="This Week"   value={fmt(week.revenue)}  positive />
        <KpiCard label="Month Gross" value={fmt(month.gross_profit)} positive={month.gross_profit >= 0} negative={month.gross_profit < 0} />
        <KpiCard label="Margin"      value={`${month.gross_margin_pct}%`} positive={month.gross_margin_pct >= 20} negative={month.gross_margin_pct < 10} />
      </div>

      {/* Revenue cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-100 bg-stone-50">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-400">Today — {fmt(today.revenue)}</p>
          </div>
          <div>
            {Object.entries(today.breakdown).map(([key, val]) => (
              <BreakdownRow key={key} label={key} value={fmt(Number(val))} />
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-100 bg-stone-50">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-400">This Week — {fmt(week.revenue)}</p>
          </div>
          <div>
            {Object.entries(week.breakdown).map(([key, val]) => (
              <BreakdownRow key={key} label={key} value={fmt(Number(val))} />
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-100 bg-stone-50">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-400">This Month — {fmt(month.revenue)}</p>
          </div>
          <div>
            {Object.entries(month.breakdown).map(([key, val]) => (
              <BreakdownRow key={key} label={key} value={fmt(Number(val))} />
            ))}
          </div>
        </div>
      </div>

      {/* Cost breakdown */}
      <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-100">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-400">Month Cost Breakdown</p>
        </div>
        <div>
          <BreakdownRow label="Revenue" value={fmt(month.revenue)} />
          <BreakdownRow label="COGS (Freezit)" value={fmt(month.cogs)} />
          <BreakdownRow label="WiFi Internet Cost" value={fmt(month.wifi_cost)} />
          <div className="flex items-center justify-between px-4 py-3 bg-amber-50">
            <span className="text-sm font-bold text-zinc-800">Gross Profit</span>
            <span className={`text-sm font-bold ${month.gross_profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {fmt(month.gross_profit)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesPL;
