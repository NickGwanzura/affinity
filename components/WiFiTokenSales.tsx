import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Plus, Wifi, TrendingUp, DollarSign, Target } from 'lucide-react';
import { Modal, Button, TextInput, Select, SelectItem, TextArea } from './ui';
import { formatCurrency } from '../utils/formatters';
import { useToast } from './Toast';

// ── Types ─────────────────────────────────────────────────────────────────────

interface WiFiSale {
  id: string;
  sale_date: string;
  tokens_sold: number;
  package_type: string;
  selling_price: number;
  total_sales: number;
  payment_method: string;
  notes?: string;
  created_at: string;
}

interface Stats {
  today: number;
  this_week: number;
  this_month: number;
  net_profit: number;
  monthly_cost: number;
  break_even_pct: number;
}

type Tab = 'analytics' | 'recent';

const API = '/api/wifi-tokens';
const fmt = (n: number) => formatCurrency(n, 'USD');
const PAYMENT_METHODS = ['Cash', 'EcoCash', 'Bank Transfer', 'Card', 'Other'];
const PACKAGE_TYPES = ['Standard', 'Daily', 'Weekly', 'Monthly', 'Custom'];

// ── Component ─────────────────────────────────────────────────────────────────

export const WiFiTokenSales: React.FC = () => {
  const { showToast } = useToast();
  const [tab, setTab]         = useState<Tab>('analytics');
  const [loading, setLoading] = useState(true);
  const [stats, setStats]     = useState<Stats | null>(null);
  const [sales, setSales]     = useState<WiFiSale[]>([]);
  const [saleOpen, setSaleOpen] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, salesRes] = await Promise.all([
        fetch(`${API}?resource=stats`),
        fetch(`${API}?resource=sales`),
      ]);
      setStats(await statsRes.json());
      setSales(await salesRes.json());
    } catch {
      showToast('Failed to load WiFi Token data', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDelete = async (id: string) => {
    await fetch(`${API}?resource=sales&id=${id}`, { method: 'DELETE' });
    fetchAll();
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'analytics', label: 'Analytics' },
    { id: 'recent',    label: 'Recent Sales' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">WiFi Token Sales</h1>
          <p className="mt-0.5 text-sm text-zinc-500">Sales, revenue &amp; break-even tracking</p>
        </div>
        <button onClick={fetchAll} className="flex items-center gap-1.5 text-sm font-medium text-[#D97706] hover:text-amber-700">
          <RefreshCw size={14} />Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Today"      value={fmt(stats?.today ?? 0)}      Icon={Wifi} />
        <KpiCard label="This Week"  value={fmt(stats?.this_week ?? 0)}  Icon={TrendingUp} />
        <KpiCard label="This Month" value={fmt(stats?.this_month ?? 0)} Icon={DollarSign} />
        <KpiCard label="Net Profit" value={fmt(stats?.net_profit ?? 0)} Icon={Target} danger={(stats?.net_profit ?? 0) < 0} />
      </div>

      {/* Break-even Progress */}
      <BreakEvenCard stats={stats} />

      {/* Action */}
      <div>
        <Button renderIcon={Plus} onClick={() => setSaleOpen(true)}>Record WiFi Sale</Button>
      </div>

      {/* Tab Rail */}
      <div className="border-b border-stone-200">
        <div className="flex">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id ? 'border-[#D97706] text-[#D97706]' : 'border-transparent text-zinc-500 hover:text-zinc-800'
              }`}
            >{t.label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-zinc-400">Loading...</div>
      ) : (
        <>
          {tab === 'analytics' && <AnalyticsTab stats={stats} sales={sales} />}
          {tab === 'recent'    && <RecentSalesTab sales={sales} onDelete={handleDelete} />}
        </>
      )}

      <RecordWiFiSaleModal isOpen={saleOpen} onClose={() => setSaleOpen(false)} onSaved={() => { setSaleOpen(false); fetchAll(); }} />
    </div>
  );
};

// ── Break-even Card ───────────────────────────────────────────────────────────

const BreakEvenCard: React.FC<{ stats: Stats | null }> = ({ stats }) => {
  const pct  = stats?.break_even_pct ?? 0;
  const cost = stats?.monthly_cost   ?? 110;
  const rev  = stats?.this_month     ?? 0;

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Break-even Progress</p>
        <p className="text-xs text-zinc-500">{fmt(rev)} / {fmt(cost)}</p>
      </div>
      <div className="h-2.5 w-full rounded-full bg-stone-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        {pct >= 100
          ? `Break-even reached! Net profit: ${fmt(rev - cost)}`
          : `${pct.toFixed(1)}% to break-even. Monthly cost: ${fmt(cost)}`}
      </p>
    </div>
  );
};

// ── KPI Card ──────────────────────────────────────────────────────────────────

const KpiCard: React.FC<{ label: string; value: string; Icon: React.ComponentType<{ size?: number; className?: string }>; danger?: boolean }> = ({ label, value, Icon, danger }) => (
  <div className="rounded-xl border border-stone-200 bg-white p-4">
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
        <Icon size={16} className="text-blue-500" />
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{label}</p>
    </div>
    <p className={`mt-3 text-2xl font-bold tabular-nums ${danger ? 'text-red-600' : 'text-zinc-900'}`}>{value}</p>
  </div>
);

// ── Analytics Tab ─────────────────────────────────────────────────────────────

const AnalyticsTab: React.FC<{ stats: Stats | null; sales: WiFiSale[] }> = ({ stats, sales }) => {
  const totalTokens = sales.reduce((sum, s) => sum + Number(s.tokens_sold), 0);
  const avgSale = sales.length > 0
    ? sales.reduce((sum, s) => sum + Number(s.total_sales), 0) / sales.length
    : 0;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-stone-200 bg-white p-5">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">This Month Summary</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCell label="Total Revenue"  value={fmt(stats?.this_month ?? 0)} />
          <StatCell label="Monthly Cost"   value={fmt(stats?.monthly_cost ?? 110)} note="Internet Package ($110/mo)" />
          <StatCell label="Net Profit"     value={fmt(stats?.net_profit ?? 0)} accent={(stats?.net_profit ?? 0) >= 0 ? 'green' : 'red'} />
        </div>
      </div>
      <div className="rounded-xl border border-stone-200 bg-white p-5">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">Sales Activity</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatCell label="Total Sales"     value={String(sales.length)} />
          <StatCell label="Tokens Sold"     value={String(totalTokens)} />
          <StatCell label="Avg. Sale Value" value={fmt(avgSale)} />
        </div>
      </div>
    </div>
  );
};

// ── Recent Sales Tab ──────────────────────────────────────────────────────────

const RecentSalesTab: React.FC<{ sales: WiFiSale[]; onDelete: (id: string) => void }> = ({ sales, onDelete }) => (
  <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
    {sales.length === 0 ? (
      <p className="py-12 text-center text-sm text-zinc-400">No sales recorded yet.</p>
    ) : (
      <table className="w-full text-sm">
        <thead className="border-b border-stone-200 bg-stone-50">
          <tr>
            {['Date', 'Package', 'Tokens', 'Price', 'Total', 'Method'].map(col => (
              <th key={col} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{col}</th>
            ))}
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {sales.map(sale => (
            <tr key={sale.id} className="hover:bg-stone-50">
              <td className="px-4 py-3 text-zinc-700">{sale.sale_date}</td>
              <td className="px-4 py-3 text-zinc-700">{sale.package_type}</td>
              <td className="px-4 py-3 text-zinc-700">{sale.tokens_sold}</td>
              <td className="px-4 py-3 text-zinc-700">{fmt(Number(sale.selling_price))}</td>
              <td className="px-4 py-3 font-medium text-zinc-900">{fmt(Number(sale.total_sales))}</td>
              <td className="px-4 py-3 text-zinc-500">{sale.payment_method}</td>
              <td className="px-4 py-3 text-right">
                <button onClick={() => onDelete(sale.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
);

// ── Stat Cell ─────────────────────────────────────────────────────────────────

const StatCell: React.FC<{ label: string; value: string; accent?: 'green' | 'red'; note?: string }> = ({ label, value, accent, note }) => (
  <div>
    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
    <p className={`mt-1 text-xl font-bold tabular-nums ${accent === 'green' ? 'text-emerald-600' : accent === 'red' ? 'text-red-600' : 'text-zinc-900'}`}>{value}</p>
    {note && <p className="mt-0.5 text-[10px] text-zinc-400">{note}</p>}
  </div>
);

// ── Record WiFi Sale Modal ────────────────────────────────────────────────────

const RecordWiFiSaleModal: React.FC<{ isOpen: boolean; onClose: () => void; onSaved: () => void }> = ({ isOpen, onClose, onSaved }) => {
  const { showToast } = useToast();
  const [tokens, setTokens]     = useState('1');
  const [packageType, setPackageType] = useState('Standard');
  const [price, setPrice]       = useState('');
  const [method, setMethod]     = useState('Cash');
  const [date, setDate]         = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes]       = useState('');
  const [loading, setLoading]   = useState(false);

  const total = Number(tokens || 0) * Number(price || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API}?resource=sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens_sold: Number(tokens), package_type: packageType, selling_price: Number(price), payment_method: method, sale_date: date, notes }),
      });
      if (!res.ok) throw new Error('Failed to record sale');
      showToast('WiFi sale recorded', 'success');
      onSaved();
    } catch (err: any) {
      addToast({ kind: 'error', title: err.message });
    } finally { setLoading(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record WiFi Sale" label="WiFi Token Sales" size="sm"
      footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="wifi-sale-form" isLoading={loading}>Record Sale</Button></div>}
    >
      <form id="wifi-sale-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Select id="ws-pkg" labelText="Package Type" value={packageType} onChange={e => setPackageType(e.target.value)}>
            {PACKAGE_TYPES.map(p => <SelectItem key={p} value={p} text={p} />)}
          </Select>
          <TextInput id="ws-tokens" type="number" min="1" labelText="Tokens Sold *" value={tokens} onChange={e => setTokens(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <TextInput id="ws-price" type="number" step="0.01" min="0.01" labelText="Price per Token *" value={price} onChange={e => setPrice(e.target.value)} required />
          <Select id="ws-method" labelText="Payment Method" value={method} onChange={e => setMethod(e.target.value)}>
            {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m} text={m} />)}
          </Select>
        </div>
        {total > 0 && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
            <p className="text-xs text-blue-700">Total: <span className="font-bold">{formatCurrency(total, 'USD')}</span></p>
          </div>
        )}
        <TextInput id="ws-date" type="date" labelText="Sale Date" value={date} onChange={e => setDate(e.target.value)} />
        <TextArea id="ws-notes" labelText="Notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
      </form>
    </Modal>
  );
};

export default WiFiTokenSales;
