import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, BarChart3 } from 'lucide-react';
import { formatUSD } from '../utils/formatters';
import { useToast } from './Toast';
import { api } from '../services/apiClient';
import { PeriodReportPanel } from './shared/PeriodReportPanel';

const fmt = (n: number) => formatUSD(n);

interface CeoData {
  month: string;
  from: string;
  to: string;
  wifi_tokens: number;
  lodgers: number;
  freezits: number;
  expenses: number;
  disbursements: number;
  total_income: number;
  total_outgoings: number;
  net: number;
}

const SectionHeader: React.FC<{ label: string }> = ({ label }) => (
  <div className="px-4 py-2.5 bg-stone-50 border-y border-stone-200">
    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">{label}</p>
  </div>
);

const Row: React.FC<{ label: string; value: string; bold?: boolean; positive?: boolean; negative?: boolean; total?: boolean }> = ({ label, value, bold, positive, negative, total }) => (
  <div className={`flex items-center justify-between px-4 py-3 ${total ? 'border-t-2 border-stone-300' : ''}`}>
    <span className={`text-sm capitalize ${bold ? 'font-semibold text-zinc-900' : 'text-zinc-700'}`}>{label}</span>
    <span className={`text-sm tabular-nums ${
      bold ? 'font-bold' : 'font-semibold'
    } ${
      positive ? 'text-emerald-600' : negative ? 'text-red-600' : 'text-zinc-900'
    }`}>{value}</span>
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
            <div className="h-8 w-56 app-shimmer rounded" />
            <div className="h-4 w-40 app-shimmer rounded" />
          </div>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
          {[1,2,3,4,5,6,7].map(i => (
            <div key={i} className="px-4 py-3.5 border-b border-stone-100 last:border-b-0">
              <div className="h-4 w-full app-shimmer rounded" />
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

  const hasPositiveNet = data.net >= 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">CEO Dashboard</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Monthly sales overview — {data.month}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-400">{data.from} – {data.to}</span>
          <button onClick={fetchData} className="flex items-center gap-1.5 text-sm font-medium text-[#D97706] hover:text-amber-700">
            <RefreshCw size={14} />Refresh
          </button>
        </div>
      </div>

      {/* Monthly Sales Table */}
      <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
        {/* Income Section */}
        <SectionHeader label="Income" />

        <Row label="Freezits"    value={fmt(data.freezits)}    positive />
        <Row label="Wifi Tokens" value={fmt(data.wifi_tokens)} positive />
        <Row label="Lodgers"     value={fmt(data.lodgers)}     positive />

        <Row label="Total Income" value={fmt(data.total_income)} bold positive total />

        {/* Outgoings Section */}
        <SectionHeader label="Expenses & Disbursements" />

        <Row label="Expenses"      value={fmt(data.expenses)}      negative />
        <Row label="Disbursements" value={fmt(data.disbursements)} negative />

        <Row label="Total Outgoings" value={fmt(data.total_outgoings)} bold negative total />

        {/* Net */}
        <div className="border-t-2 border-amber-500 bg-amber-50/50">
          <div className="flex items-center justify-between px-4 py-3.5">
            <span className="text-sm font-bold text-zinc-900">Net</span>
            <span className={`text-base font-bold tabular-nums ${
              hasPositiveNet ? 'text-emerald-600' : 'text-red-600'
            }`}>{fmt(data.net)}</span>
          </div>
        </div>
      </div>

      {/* PDF Reports */}
      <div className="pt-2">
        <PeriodReportPanel periods={['weekly', 'monthly']} />
      </div>
    </div>
  );
};

export default CEODashboard;
