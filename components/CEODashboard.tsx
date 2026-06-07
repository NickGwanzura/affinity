import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, BarChart3 } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import { useToast } from './Toast';
import { api } from '../services/apiClient';
import { PeriodReportPanel } from './shared/PeriodReportPanel';

const fmt = (n: number) => formatCurrency(n, 'USD');

interface CeoData {
  today: {
    date: string;
    income: number;
    expenses: number;
    net: number;
    income_breakdown: Record<string, number>;
    expense_breakdown: Record<string, number>;
  };
  this_month: {
    income: number;
    expenses: number;
    net: number;
    income_breakdown: Record<string, number>;
    expense_breakdown: Record<string, number>;
  };
}

const KpiCard: React.FC<{ label: string; value: string; positive?: boolean; negative?: boolean }> = ({ label, value, positive, negative }) => (
  <div className="rounded-xl border border-stone-200 bg-white p-4 sm:p-5">
    <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{label}</p>
    <p className={`mt-2 text-2xl font-bold tabular-nums ${
      positive ? 'text-emerald-600' : negative ? 'text-red-600' : 'text-zinc-900'
    }`}>{value}</p>
  </div>
);

const BreakdownTable: React.FC<{ title: string; data: Record<string, number> }> = ({ title, data }) => (
  <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
    <div className="px-4 py-3 border-b border-stone-100">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-400">{title}</p>
    </div>
    <div className="divide-y divide-stone-100">
      {Object.entries(data).map(([key, val]) => (
        <div key={key} className="flex items-center justify-between px-4 py-2.5">
          <span className="text-sm capitalize text-zinc-700">{key.replace(/_/g, ' ')}</span>
          <span className="text-sm font-semibold text-zinc-900">{fmt(Number(val))}</span>
        </div>
      ))}
    </div>
  </div>
);

export const CEODashboard: React.FC = () => {
  const { showToast } = useToast();
  const [data, setData] = useState<CeoData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.request<CeoData>('/ceo?resource=dashboard');
      setData(data);
    } catch {
      showToast('Failed to load CEO dashboard data', 'error');
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[1,2].map(i => (
            <div key={i} className="rounded-xl border border-stone-200 bg-white p-4">
              <div className="h-4 w-24 app-shimmer rounded mb-4" />
              {[1,2,3].map(j => (
                <div key={j} className="h-4 w-full app-shimmer rounded mb-3" />
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
        <button onClick={fetchData} className="mt-3 text-xs font-medium text-[#D97706] hover:text-amber-700">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">CEO Dashboard</h1>
          <p className="mt-0.5 text-sm text-zinc-500">Daily summary of income and expenses</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-1.5 text-sm font-medium text-[#D97706] hover:text-amber-700">
          <RefreshCw size={14} />Refresh
        </button>
      </div>

      {/* Today's KPIs */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-400 mb-3">
          Today &mdash; {data.today.date}
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="Income" value={fmt(data.today.income)} positive />
          <KpiCard label="Expenses" value={fmt(data.today.expenses)} negative />
          <KpiCard label="Net" value={fmt(data.today.net)} positive={data.today.net >= 0} negative={data.today.net < 0} />
          <KpiCard label="Margin" value={data.today.income > 0 ? `${Math.round((data.today.net / data.today.income) * 100)}%` : '-'} positive={data.today.net >= 0} negative={data.today.net < 0} />
        </div>
      </div>

      {/* Today's Breakdown */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <BreakdownTable title="Today's Income" data={data.today.income_breakdown} />
        <BreakdownTable title="Today's Expenses" data={data.today.expense_breakdown} />
      </div>

      {/* This Month KPIs */}
      <div className="pt-4 border-t border-stone-200">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-400 mb-3">This Month</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="Income" value={fmt(data.this_month.income)} positive />
          <KpiCard label="Expenses" value={fmt(data.this_month.expenses)} negative />
          <KpiCard label="Net" value={fmt(data.this_month.net)} positive={data.this_month.net >= 0} negative={data.this_month.net < 0} />
          <KpiCard label="Margin" value={data.this_month.income > 0 ? `${Math.round((data.this_month.net / data.this_month.income) * 100)}%` : '-'} positive={data.this_month.net >= 0} negative={data.this_month.net < 0} />
        </div>
      </div>

      {/* Month Breakdown */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <BreakdownTable title="Monthly Income" data={data.this_month.income_breakdown} />
        <BreakdownTable title="Monthly Expenses" data={data.this_month.expense_breakdown} />
      </div>

      {/* PDF Reports */}
      <div className="pt-4 border-t border-stone-200">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-400 mb-3">PDF Reports</p>
        <PeriodReportPanel periods={['weekly', 'monthly']} />
      </div>
    </div>
  );
};

export default CEODashboard;
