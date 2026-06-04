import { authFetch } from '../services/authFetch';
import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Plus, IceCream, TrendingUp, DollarSign, BarChart3, Star } from 'lucide-react';
import { Modal, Button, TextInput, Select, SelectItem, TextArea } from './ui';
import { formatCurrency } from '../utils/formatters';
import { useToast } from './Toast';

// ── Types ─────────────────────────────────────────────────────────────────────

interface IceSale {
  id: string;
  sale_date: string;
  quantity_sold: number;
  unit_price: number;
  total_sales: number;
  payment_method: string;
  customer_name?: string;
  notes?: string;
  created_at: string;
}

interface Stats {
  today_revenue: number;
  today_quantity: number;
  week_revenue: number;
  week_quantity: number;
  month_revenue: number;
  month_quantity: number;
}

type Tab = 'overview' | 'history';

const API = '/api/ice-sales';
const fmt = (n: number) => formatCurrency(n, 'USD');
const PAYMENT_METHODS = ['Cash', 'EcoCash', 'Bank Transfer', 'Card', 'Other'];

// ── Component ─────────────────────────────────────────────────────────────────

export const IceSales: React.FC = () => {
  const { showToast } = useToast();
  const [tab, setTab]           = useState<Tab>('overview');
  const [loading, setLoading]   = useState(true);
  const [stats, setStats]       = useState<Stats | null>(null);
  const [sales, setSales]       = useState<IceSale[]>([]);
  const [saleOpen, setSaleOpen] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      authFetch(`${API}?resource=stats`).then(r => { if (!r.ok) throw new Error('Stats failed'); return r.json(); }),
      authFetch(`${API}?resource=sales`).then(r => { if (!r.ok) throw new Error('Sales failed'); return r.json(); }),
    ]);
    setStats(results[0].status === 'fulfilled' ? results[0].value : null);
    setSales(results[1].status === 'fulfilled' && Array.isArray(results[1].value) ? results[1].value : []);
    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      showToast(`Failed to load ${failures.length} resource(s)`, 'error');
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDelete = async (id: string) => {
    try {
      const res = await authFetch(`${API}?resource=sales&id=${id}`, { method: 'DELETE' });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Delete failed'); }
      showToast('Sale deleted', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete', 'error');
    }
    fetchAll();
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'history',  label: 'History' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Daily Ice Sales</h1>
          <p className="mt-0.5 text-sm text-zinc-500">Track daily ice block &amp; cube sales</p>
        </div>
        <button onClick={fetchAll} className="flex items-center gap-1.5 text-sm font-medium text-[#D97706] hover:text-amber-700">
          <RefreshCw size={14} />Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Today Revenue"  value={fmt(stats?.today_revenue ?? 0)}  Icon={TrendingUp} color="sky" />
        <KpiCard label="Today Quantity" value={`${stats?.today_quantity ?? 0}`}  Icon={IceCream}  color="cyan" />
        <KpiCard label="This Week"      value={fmt(stats?.week_revenue ?? 0)}   Icon={BarChart3} color="blue" />
        <KpiCard label="This Month"     value={fmt(stats?.month_revenue ?? 0)}  Icon={DollarSign} color="indigo" />
      </div>

      {/* Quick stats row */}
      <div className="flex flex-wrap gap-3">
        <span className="inline-flex items-center rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
          <Star size={12} className="mr-1" />
          {stats?.week_quantity ?? 0} units this week
        </span>
        <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
          {stats?.month_quantity ?? 0} units this month
        </span>
      </div>

      {/* Action */}
      <div>
        <Button renderIcon={Plus} onClick={() => setSaleOpen(true)}>Record Ice Sale</Button>
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
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="rounded-xl border border-stone-200 bg-white p-4">
                <div className="h-8 w-8 app-shimmer rounded-lg mb-3" />
                <div className="h-3 w-16 app-shimmer rounded mb-3" />
                <div className="h-7 w-28 app-shimmer rounded" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {tab === 'overview' && <OverviewTab stats={stats} sales={sales} />}
          {tab === 'history'  && <HistoryTab sales={sales} onDelete={handleDelete} />}
        </>
      )}

      <RecordIceSaleModal isOpen={saleOpen} onClose={() => setSaleOpen(false)} onSaved={() => { setSaleOpen(false); fetchAll(); }} />
    </div>
  );
};

// ── KPI Card ──────────────────────────────────────────────────────────────────

const colorMap: Record<string, { text: string; bg: string }> = {
  sky:    { text: 'text-sky-600',   bg: 'bg-sky-50' },
  cyan:   { text: 'text-cyan-600',  bg: 'bg-cyan-50' },
  blue:   { text: 'text-blue-600',  bg: 'bg-blue-50' },
  indigo: { text: 'text-indigo-600', bg: 'bg-indigo-50' },
};

const KpiCard: React.FC<{
  label: string; value: string; color: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
}> = ({ label, value, color, Icon }) => {
  const c = colorMap[color] ?? { text: 'text-zinc-600', bg: 'bg-zinc-50' };
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${c.bg}`}>
          <Icon size={16} className={c.text} />
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{label}</p>
      </div>
      <p className={`mt-3 text-2xl font-bold tabular-nums ${c.text}`}>{value}</p>
    </div>
  );
};

// ── Overview Tab ──────────────────────────────────────────────────────────────

const OverviewTab: React.FC<{ stats: Stats | null; sales: IceSale[] }> = ({ stats, sales }) => {
  const totalRevenue = sales.reduce((s, r) => s + Number(r.total_sales), 0);
  const totalUnits   = sales.reduce((s, r) => s + Number(r.quantity_sold), 0);
  const avgSale      = sales.length > 0 ? totalRevenue / sales.length : 0;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-stone-200 bg-white p-5">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-400">This Month Summary</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCell label="Revenue"       value={fmt(stats?.month_revenue ?? 0)} />
          <StatCell label="Units Sold"    value={String(stats?.month_quantity ?? 0)} />
          <StatCell label="Avg Sale"      value={fmt(avgSale)} />
        </div>
      </div>

      {/* Recent activity */}
      {sales.length > 0 && (
        <div className="rounded-xl border border-stone-200 bg-white">
          <div className="border-b border-stone-100 px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-400">Recent Sales</p>
          </div>
          <div className="divide-y divide-stone-100">
            {sales.slice(0, 5).map(s => (
              <div key={s.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <span className="font-medium text-zinc-900">{s.sale_date}</span>
                  <span className="ml-2 text-zinc-500">{s.quantity_sold} units</span>
                  {s.customer_name && <span className="ml-2 text-zinc-400">· {s.customer_name}</span>}
                </div>
                <span className="font-medium text-sky-600">{fmt(Number(s.total_sales))}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── History Tab ───────────────────────────────────────────────────────────────

const HistoryTab: React.FC<{ sales: IceSale[]; onDelete: (id: string) => void }> = ({ sales, onDelete }) => (
  <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
    {sales.length === 0 ? (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-stone-100">
          <IceCream size={20} className="text-zinc-400" />
        </div>
        <p className="text-sm font-medium text-zinc-700">No sales recorded yet</p>
      </div>
    ) : (
      <table className="w-full text-sm table-card-mobile">
        <thead className="border-b border-stone-200 bg-stone-50">
          <tr>
            {['Date', 'Qty', 'Unit Price', 'Total', 'Method', 'Customer'].map(col => (
              <th key={col} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">{col}</th>
            ))}
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {sales.map(sale => (
            <tr key={sale.id} className="hover:bg-stone-50">
              <td className="px-4 py-3 text-zinc-700" data-label="Date">{sale.sale_date}</td>
              <td className="px-4 py-3 text-zinc-700" data-label="Qty">{sale.quantity_sold}</td>
              <td className="px-4 py-3 text-zinc-700" data-label="Price">{fmt(Number(sale.unit_price))}</td>
              <td className="px-4 py-3 font-medium text-zinc-900" data-label="Total">{fmt(Number(sale.total_sales))}</td>
              <td className="px-4 py-3 text-zinc-500" data-label="Method">{sale.payment_method}</td>
              <td className="px-4 py-3 text-zinc-500" data-label="Customer">{sale.customer_name || '—'}</td>
              <td className="px-4 py-3 text-right actions-cell" data-label="">
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

const StatCell: React.FC<{ label: string; value: string; accent?: 'green' | 'red' }> = ({ label, value, accent }) => (
  <div>
    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">{label}</p>
    <p className={`mt-1 text-xl font-bold tabular-nums ${accent === 'green' ? 'text-emerald-600' : accent === 'red' ? 'text-red-600' : 'text-zinc-900'}`}>{value}</p>
  </div>
);

// ── Record Ice Sale Modal ─────────────────────────────────────────────────────

const RecordIceSaleModal: React.FC<{
  isOpen: boolean; onClose: () => void; onSaved: () => void;
}> = ({ isOpen, onClose, onSaved }) => {
  const { showToast } = useToast();
  const [qty, setQty]           = useState('1');
  const [price, setPrice]       = useState('');
  const [method, setMethod]     = useState('Cash');
  const [date, setDate]         = useState(new Date().toISOString().slice(0, 10));
  const [customer, setCustomer] = useState('');
  const [notes, setNotes]       = useState('');
  const [loading, setLoading]   = useState(false);

  const total = Number(qty || 0) * Number(price || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authFetch(`${API}?resource=sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity_sold: Number(qty),
          unit_price: Number(price),
          payment_method: method,
          sale_date: date,
          customer_name: customer || undefined,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      showToast('Ice sale recorded', 'success');
      onSaved();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally { setLoading(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record Ice Sale" label="Ice Sales" size="sm"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="ice-sale-form" isLoading={loading}>Record Sale</Button>
        </div>
      }
    >
      <form id="ice-sale-form" onSubmit={handleSubmit} className="space-y-4">
        <section>
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-400">Sale Details</h3>
            <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput id="is-qty" type="number" min="1" labelText="Quantity Sold *" value={qty} onChange={e => setQty(e.target.value)} required />
              <TextInput id="is-price" type="number" step="0.01" min="0.01" labelText="Unit Price *" value={price} onChange={e => setPrice(e.target.value)} required placeholder="e.g. 0.50" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select id="is-method" labelText="Payment Method" value={method} onChange={e => setMethod(e.target.value)}>
                {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m} text={m} />)}
              </Select>
              <TextInput id="is-date" type="date" labelText="Sale Date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <TextInput id="is-customer" labelText="Customer Name" value={customer} onChange={e => setCustomer(e.target.value)} placeholder="e.g. Shop 12" />
            <TextArea id="is-notes" labelText="Notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" />
            </div>
            {total > 0 && (
              <div className="mt-3 rounded-xl bg-sky-50 border border-sky-200 px-4 py-3">
                <p className="text-sm text-sky-700">Total: <span className="font-bold">{fmt(total)}</span></p>
              </div>
            )}
          </div>
        </section>
      </form>
    </Modal>
  );
};

export default IceSales;
