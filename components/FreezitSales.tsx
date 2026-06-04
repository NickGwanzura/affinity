import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Plus, TrendingUp, BarChart2, Package, AlertTriangle } from 'lucide-react';
import { Modal, Button, TextInput, Select, SelectItem, TextArea } from './ui';
import { formatCurrency } from '../utils/formatters';
import { useToast } from './Toast';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FreezitStock {
  id: string;
  product_name: string;
  batch_date: string;
  opening_qty: number;
  received_qty: number;
  unit_cost: number;
  unit_selling_price: number;
  damaged_qty: number;
  wastage_qty: number;
  missing_qty: number;
  supplier_name?: string;
  notes?: string;
  available_qty: number;
}

interface FreezitSale {
  id: string;
  sale_date: string;
  qty_sold: number;
  unit_selling_price: number;
  total_sales_value: number;
  payment_method: string;
  product_name?: string;
  notes?: string;
  created_at: string;
}

interface FreezitRestock {
  id: string;
  restock_date: string;
  supplier_name?: string;
  qty_received: number;
  unit_cost: number;
  total_cost: number;
  notes?: string;
  created_at: string;
}

interface FreezitBreakage {
  id: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
  estimated_loss: number;
  reason?: string;
  breakage_date: string;
  notes?: string;
  created_at: string;
}

interface Stats {
  today_revenue: number;
  month_revenue: number;
  gross_profit: number;
  stock_remaining: number;
  breakage_loss: number;
}

type Tab = 'overview' | 'sales' | 'stock' | 'restock' | 'breakages';

const API = '/api/freezit';
const fmt = (n: number) => formatCurrency(n, 'USD');
const PAYMENT_METHODS = ['Cash', 'EcoCash', 'Bank Transfer', 'Card', 'Other'];

// ── Component ─────────────────────────────────────────────────────────────────

export const FreezitSales: React.FC = () => {
  const { showToast } = useToast();
  const [tab, setTab]               = useState<Tab>('overview');
  const [loading, setLoading]       = useState(true);
  const [stats, setStats]           = useState<Stats | null>(null);
  const [stock, setStock]           = useState<FreezitStock[]>([]);
  const [sales, setSales]           = useState<FreezitSale[]>([]);
  const [restocks, setRestocks]     = useState<FreezitRestock[]>([]);
  const [breakages, setBreakages]   = useState<FreezitBreakage[]>([]);

  const [saleOpen, setSaleOpen]         = useState(false);
  const [stockOpen, setStockOpen]       = useState(false);
  const [restockOpen, setRestockOpen]   = useState(false);
  const [breakageOpen, setBreakageOpen] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        fetch(`${API}?resource=stats`).then(r => { if (!r.ok) throw new Error('Stats failed'); return r.json(); }),
        fetch(`${API}?resource=stock`).then(r => { if (!r.ok) throw new Error('Stock failed'); return r.json(); }),
        fetch(`${API}?resource=sales`).then(r => { if (!r.ok) throw new Error('Sales failed'); return r.json(); }),
        fetch(`${API}?resource=restocks`).then(r => { if (!r.ok) throw new Error('Restocks failed'); return r.json(); }),
        fetch(`${API}?resource=breakages`).then(r => { if (!r.ok) throw new Error('Breakages failed'); return r.json(); }),
      ]);
      setStats(results[0].status === 'fulfilled' ? results[0].value : null);
      setStock(results[1].status === 'fulfilled' && Array.isArray(results[1].value) ? results[1].value : []);
      setSales(results[2].status === 'fulfilled' && Array.isArray(results[2].value) ? results[2].value : []);
      setRestocks(results[3].status === 'fulfilled' && Array.isArray(results[3].value) ? results[3].value : []);
      setBreakages(results[4].status === 'fulfilled' && Array.isArray(results[4].value) ? results[4].value : []);
      const failures = results.filter(r => r.status === 'rejected');
      if (failures.length > 0) {
        showToast(`Failed to load ${failures.length} resource(s)`, 'error');
      }
    } catch {
      showToast('Failed to load Freezit data', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview',  label: 'Overview' },
    { id: 'sales',     label: 'Sales' },
    { id: 'stock',     label: 'Stock' },
    { id: 'restock',   label: 'Restock' },
    { id: 'breakages', label: 'Breakages' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Freezit Sales</h1>
          <p className="mt-0.5 text-sm text-zinc-500">Stock, sales &amp; profit tracking</p>
        </div>
        <button onClick={fetchAll} className="flex items-center gap-1.5 text-sm font-medium text-[#D97706] hover:text-amber-700">
          <RefreshCw size={14} />Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Today's Revenue"  value={fmt(stats?.today_revenue ?? 0)}  Icon={TrendingUp} />
        <KpiCard label="Month Revenue"    value={fmt(stats?.month_revenue ?? 0)}  Icon={BarChart2} />
        <KpiCard label="Gross Profit"     value={fmt(stats?.gross_profit ?? 0)}   Icon={TrendingUp} danger={(stats?.gross_profit ?? 0) < 0} />
        <KpiCard label="Stock Remaining"  value={String(Math.round(stats?.stock_remaining ?? 0))} Icon={Package} />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button renderIcon={Plus} onClick={() => setSaleOpen(true)}>Record Sale</Button>
        <Button variant="secondary" renderIcon={Plus} onClick={() => setStockOpen(true)}>Add Stock</Button>
        <Button variant="secondary" renderIcon={Plus} onClick={() => setRestockOpen(true)}>Restock</Button>
        <Button variant="danger" renderIcon={AlertTriangle} onClick={() => setBreakageOpen(true)}>Record Breakage</Button>
      </div>

      {/* Tab Rail */}
      <div className="border-b border-stone-200">
        <div className="flex overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`shrink-0 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
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
          <div className="flex gap-3">
            {[1,2,3,4].map(i => <div key={i} className="h-10 w-28 app-shimmer rounded-lg" />)}
          </div>
        </div>
      ) : (
        <>
          {tab === 'overview'  && <OverviewTab stats={stats} breakages={breakages} />}
          {tab === 'sales'     && <SalesTab sales={sales} onDelete={async id => { try { const r = await fetch(`${API}?resource=sales&id=${id}`, { method: 'DELETE' }); if (!r.ok) throw new Error(); } catch {} fetchAll(); }} />}
          {tab === 'stock'     && <StockTab stock={stock} onDelete={async id => { try { const r = await fetch(`${API}?resource=stock&id=${id}`, { method: 'DELETE' }); if (!r.ok) throw new Error(); } catch {} fetchAll(); }} />}
          {tab === 'restock'   && <RestockTab restocks={restocks} onDelete={async id => { try { const r = await fetch(`${API}?resource=restocks&id=${id}`, { method: 'DELETE' }); if (!r.ok) throw new Error(); } catch {} fetchAll(); }} />}
          {tab === 'breakages' && <BreakagesTab breakages={breakages} onDelete={async id => { try { const r = await fetch(`${API}?resource=breakages&id=${id}`, { method: 'DELETE' }); if (!r.ok) throw new Error(); } catch {} fetchAll(); }} />}
        </>
      )}

      <RecordSaleModal isOpen={saleOpen} stock={stock} onClose={() => setSaleOpen(false)} onSaved={() => { setSaleOpen(false); fetchAll(); }} />
      <AddStockModal isOpen={stockOpen} onClose={() => setStockOpen(false)} onSaved={() => { setStockOpen(false); fetchAll(); }} />
      <RestockModal isOpen={restockOpen} onClose={() => setRestockOpen(false)} onSaved={() => { setRestockOpen(false); fetchAll(); }} />
      <RecordBreakageModal isOpen={breakageOpen} stock={stock} onClose={() => setBreakageOpen(false)} onSaved={() => { setBreakageOpen(false); fetchAll(); }} />
    </div>
  );
};

// ── KPI Card ──────────────────────────────────────────────────────────────────

const KpiCard: React.FC<{ label: string; value: string; Icon: React.ComponentType<{ size?: number; className?: string }>; danger?: boolean }> = ({ label, value, Icon, danger }) => (
  <div className="rounded-xl border border-stone-200 bg-white p-4">
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
        <Icon size={16} className="text-[#D97706]" />
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{label}</p>
    </div>
    <p className={`mt-3 text-2xl font-bold tabular-nums ${danger ? 'text-red-600' : 'text-zinc-900'}`}>{value}</p>
  </div>
);

// ── Overview Tab ──────────────────────────────────────────────────────────────

const OverviewTab: React.FC<{ stats: Stats | null; breakages: FreezitBreakage[] }> = ({ stats, breakages }) => (
  <div className="space-y-5">
    <div className="rounded-xl border border-stone-200 bg-white p-5">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-400">This Month</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCell label="Revenue"       value={formatCurrency(stats?.month_revenue ?? 0, 'USD')} />
        <SummaryCell label="Gross Profit"  value={formatCurrency(stats?.gross_profit ?? 0, 'USD')}  accent={(stats?.gross_profit ?? 0) >= 0 ? 'green' : 'red'} />
        <SummaryCell label="Breakage Loss" value={formatCurrency(stats?.breakage_loss ?? 0, 'USD')} accent="red" />
      </div>
    </div>
    {breakages.length > 0 && (
      <div className="rounded-xl border border-red-100 bg-red-50 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-red-700">Recent Breakages</p>
        <div className="space-y-2">
          {breakages.slice(0, 3).map(b => (
            <div key={b.id} className="flex items-center justify-between text-sm">
              <span className="text-zinc-700">{b.product_name} × {b.quantity}</span>
              <span className="font-medium text-red-600">−{formatCurrency(Number(b.estimated_loss), 'USD')}</span>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

// ── Sales Tab ─────────────────────────────────────────────────────────────────

const SalesTab: React.FC<{ sales: FreezitSale[]; onDelete: (id: string) => void }> = ({ sales, onDelete }) => (
  <DataTable
    columns={['Date', 'Product', 'Qty', 'Unit Price', 'Total', 'Method']}
    rows={sales.map(s => ({
      id: s.id,
      cells: [s.sale_date, s.product_name || '—', String(s.qty_sold), fmt(Number(s.unit_selling_price)), fmt(Number(s.total_sales_value)), s.payment_method],
    }))}
    onDelete={onDelete}
    emptyMessage="No sales recorded yet."
  />
);

// ── Stock Tab ─────────────────────────────────────────────────────────────────

const StockTab: React.FC<{ stock: FreezitStock[]; onDelete: (id: string) => void }> = ({ stock, onDelete }) => (
  <DataTable
    columns={['Product', 'Available', 'Cost', 'Sell Price', 'Supplier']}
    rows={stock.map(s => ({
      id: s.id,
      cells: [s.product_name, String(Math.round(Number(s.available_qty))), fmt(Number(s.unit_cost)), fmt(Number(s.unit_selling_price)), s.supplier_name || '—'],
    }))}
    onDelete={onDelete}
    emptyMessage="No stock items yet."
  />
);

// ── Restock Tab ───────────────────────────────────────────────────────────────

const RestockTab: React.FC<{ restocks: FreezitRestock[]; onDelete: (id: string) => void }> = ({ restocks, onDelete }) => (
  <DataTable
    columns={['Date', 'Supplier', 'Qty Received', 'Unit Cost', 'Total Cost']}
    rows={restocks.map(r => ({
      id: r.id,
      cells: [r.restock_date, r.supplier_name || '—', String(r.qty_received), fmt(Number(r.unit_cost)), fmt(Number(r.total_cost))],
    }))}
    onDelete={onDelete}
    emptyMessage="No restocks recorded yet."
  />
);

// ── Breakages Tab ─────────────────────────────────────────────────────────────

const BreakagesTab: React.FC<{ breakages: FreezitBreakage[]; onDelete: (id: string) => void }> = ({ breakages, onDelete }) => (
  <DataTable
    columns={['Date', 'Product', 'Qty', 'Est. Loss', 'Reason']}
    rows={breakages.map(b => ({
      id: b.id,
      cells: [b.breakage_date, b.product_name, String(b.quantity), fmt(Number(b.estimated_loss)), b.reason || '—'],
    }))}
    onDelete={onDelete}
    emptyMessage="No breakages recorded."
  />
);

// ── Data Table ────────────────────────────────────────────────────────────────

const DataTable: React.FC<{ columns: string[]; rows: { id: string; cells: string[] }[]; onDelete: (id: string) => void; emptyMessage: string }> = ({ columns, rows, onDelete, emptyMessage }) => (
  <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
    {rows.length === 0 ? (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-stone-100">
          <Package size={20} className="text-zinc-400" />
        </div>
        <p className="text-sm font-medium text-zinc-700">{emptyMessage}</p>
      </div>
    ) : (
      <table className="w-full text-sm table-card-mobile">
        <thead className="border-b border-stone-200 bg-stone-50">
          <tr>
            {columns.map(col => <th key={col} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">{col}</th>)}
            <th className="px-4 py-3 w-16" />
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {rows.map(row => (
            <tr key={row.id} className="hover:bg-stone-50">
              {row.cells.map((cell, i) => <td key={i} className="px-4 py-3 text-zinc-700" data-label={columns[i]}>{cell}</td>)}
              <td className="px-4 py-3 text-right actions-cell" data-label="">
                <button onClick={() => onDelete(row.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
);

// ── Summary Cell ──────────────────────────────────────────────────────────────

const SummaryCell: React.FC<{ label: string; value: string; accent?: 'green' | 'red' }> = ({ label, value, accent }) => (
  <div>
    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">{label}</p>
    <p className={`mt-1 text-xl font-bold tabular-nums ${accent === 'green' ? 'text-emerald-600' : accent === 'red' ? 'text-red-600' : 'text-zinc-900'}`}>{value}</p>
  </div>
);

// ── Record Sale Modal ─────────────────────────────────────────────────────────

const RecordSaleModal: React.FC<{ isOpen: boolean; stock: FreezitStock[]; onClose: () => void; onSaved: () => void }> = ({ isOpen, stock, onClose, onSaved }) => {
  const { showToast } = useToast();
  const [stockId, setStockId]   = useState('');
  const [qty, setQty]           = useState('1');
  const [price, setPrice]       = useState('');
  const [method, setMethod]     = useState('Cash');
  const [date, setDate]         = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes]       = useState('');
  const [loading, setLoading]   = useState(false);

  const selected = stock.find(s => s.id === stockId);
  useEffect(() => { if (selected) setPrice(String(selected.unit_selling_price)); }, [selected]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}?resource=sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock_id: stockId, qty_sold: Number(qty), unit_selling_price: Number(price), payment_method: method, sale_date: date, notes }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      showToast('Sale recorded', 'success');
      onSaved();
    } catch (err: any) {
      showToast(err.message || 'Failed to record sale', 'error');
    } finally { setLoading(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record Sale" label="Freezit Sales" size="sm"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="fz-sale-form" isLoading={loading}>Record Sale</Button>
        </div>
      }
    >
      <form id="fz-sale-form" onSubmit={handleSubmit} className="space-y-4">
        <section>
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-400">Sale Details</h3>
            <div className="space-y-3">
            <Select id="fzs-item" labelText="Stock Item *" value={stockId} onChange={e => setStockId(e.target.value)} required>
              <SelectItem value="" text="Select item" />
              {stock.map(s => <SelectItem key={s.id} value={s.id} text={`${s.product_name} (${Math.round(Number(s.available_qty))} available)`} />)}
            </Select>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput id="fzs-qty" type="number" min="1" labelText="Quantity *" value={qty} onChange={e => setQty(e.target.value)} required />
              <TextInput id="fzs-price" type="number" step="0.01" min="0" labelText="Unit Price *" value={price} onChange={e => setPrice(e.target.value)} required />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select id="fzs-method" labelText="Payment Method" value={method} onChange={e => setMethod(e.target.value)}>
                {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m} text={m} />)}
              </Select>
              <TextInput id="fzs-date" type="date" labelText="Date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <TextArea id="fzs-notes" labelText="Notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" />
            </div>
          </div>
        </section>
      </form>
    </Modal>
  );
};

// ── Add Stock Modal ───────────────────────────────────────────────────────────

const AddStockModal: React.FC<{ isOpen: boolean; onClose: () => void; onSaved: () => void }> = ({ isOpen, onClose, onSaved }) => {
  const { showToast } = useToast();
  const [name, setName]         = useState('');
  const [cost, setCost]         = useState('');
  const [price, setPrice]       = useState('');
  const [openingQty, setOpeningQty] = useState('0');
  const [supplier, setSupplier] = useState('');
  const [batchDate, setBatchDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API}?resource=stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_name: name, unit_cost: Number(cost), unit_selling_price: Number(price), opening_qty: Number(openingQty), received_qty: 0, supplier_name: supplier, batch_date: batchDate }),
      });
      if (!res.ok) throw new Error('Failed to add stock');
      showToast('Stock item added', 'success');
      onSaved();
    } catch (err: any) {
      showToast(err.message || 'Failed to add stock', 'error');
    } finally { setLoading(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Stock Item" label="Freezit Sales" size="sm"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="fz-stock-form" isLoading={loading}>Add Item</Button>
        </div>
      }
    >
      <form id="fz-stock-form" onSubmit={handleSubmit} className="space-y-4">
        <section>
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-400">Stock Details</h3>
            <div className="space-y-3">
            <TextInput id="fzst-name" labelText="Product Name *" value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Freezit Mango" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput id="fzst-cost" type="number" step="0.01" min="0" labelText="Unit Cost" value={cost} onChange={e => setCost(e.target.value)} />
              <TextInput id="fzst-price" type="number" step="0.01" min="0" labelText="Selling Price *" value={price} onChange={e => setPrice(e.target.value)} required />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput id="fzst-qty" type="number" min="0" labelText="Opening Qty" value={openingQty} onChange={e => setOpeningQty(e.target.value)} />
              <TextInput id="fzst-date" type="date" labelText="Batch Date" value={batchDate} onChange={e => setBatchDate(e.target.value)} />
            </div>
            <TextInput id="fzst-supplier" labelText="Supplier" value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Optional supplier name" />
            </div>
          </div>
        </section>
      </form>
    </Modal>
  );
};

// ── Restock Modal ─────────────────────────────────────────────────────────────

const RestockModal: React.FC<{ isOpen: boolean; onClose: () => void; onSaved: () => void }> = ({ isOpen, onClose, onSaved }) => {
  const { showToast } = useToast();
  const [qty, setQty]           = useState('');
  const [cost, setCost]         = useState('');
  const [supplier, setSupplier] = useState('');
  const [date, setDate]         = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API}?resource=restocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qty_received: Number(qty), unit_cost: Number(cost), supplier_name: supplier, restock_date: date, notes }),
      });
      if (!res.ok) throw new Error('Failed to record restock');
      showToast('Restock recorded', 'success');
      onSaved();
    } catch (err: any) {
      showToast(err.message || 'Failed to record restock', 'error');
    } finally { setLoading(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record Restock" label="Freezit Sales" size="sm"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="fz-restock-form" isLoading={loading}>Save Restock</Button>
        </div>
      }
    >
      <form id="fz-restock-form" onSubmit={handleSubmit} className="space-y-4">
        <section>
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-400">Restock Details</h3>
            <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput id="fzr-qty" type="number" min="1" labelText="Qty Received *" value={qty} onChange={e => setQty(e.target.value)} required />
              <TextInput id="fzr-cost" type="number" step="0.01" min="0" labelText="Unit Cost" value={cost} onChange={e => setCost(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput id="fzr-supplier" labelText="Supplier" value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Supplier name" />
              <TextInput id="fzr-date" type="date" labelText="Date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <TextArea id="fzr-notes" labelText="Notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" />
            </div>
          </div>
        </section>
      </form>
    </Modal>
  );
};

// ── Record Breakage Modal ─────────────────────────────────────────────────────

const RecordBreakageModal: React.FC<{ isOpen: boolean; stock: FreezitStock[]; onClose: () => void; onSaved: () => void }> = ({ isOpen, stock, onClose, onSaved }) => {
  const { showToast } = useToast();
  const [stockId, setStockId]   = useState('');
  const [qty, setQty]           = useState('');
  const [reason, setReason]     = useState('');
  const [date, setDate]         = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes]       = useState('');
  const [loading, setLoading]   = useState(false);

  const selected = stock.find(s => s.id === stockId);
  const estimatedLoss = selected ? Number(qty || 0) * Number(selected.unit_cost) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}?resource=breakages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock_id: stockId, quantity: Number(qty), reason, breakage_date: date, notes }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      showToast('Breakage recorded', 'success');
      onSaved();
    } catch (err: any) {
      showToast(err.message || 'Failed to record breakage', 'error');
    } finally { setLoading(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record Breakage" label="Freezit Sales" size="sm"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" type="submit" form="fz-breakage-form" isLoading={loading}>Record Breakage</Button>
        </div>
      }
    >
      <form id="fz-breakage-form" onSubmit={handleSubmit} className="space-y-4">
        <section>
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-400">Breakage Details</h3>
            <div className="space-y-3">
            <Select id="fzb-item" labelText="Stock Item *" value={stockId} onChange={e => setStockId(e.target.value)} required>
              <SelectItem value="" text="Select item" />
              {stock.map(s => <SelectItem key={s.id} value={s.id} text={`${s.product_name} (${Math.round(Number(s.available_qty))} available)`} />)}
            </Select>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput id="fzb-qty" type="number" min="1" labelText="Quantity *" value={qty} onChange={e => setQty(e.target.value)} required />
              <TextInput id="fzb-date" type="date" labelText="Date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <TextInput id="fzb-reason" labelText="Reason" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Melted, Dropped, Freezer failure" />
            <TextArea id="fzb-notes" labelText="Notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional details" />
            </div>
            {estimatedLoss > 0 && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm text-red-700">Estimated loss: <span className="font-bold">{fmt(estimatedLoss)}</span></p>
              </div>
            )}
          </div>
        </section>
      </form>
    </Modal>
  );
};

export default FreezitSales;
