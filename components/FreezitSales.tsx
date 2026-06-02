import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Plus, TrendingUp, BarChart2, Package, AlertTriangle } from 'lucide-react';
import { Modal, Button, TextInput, Select, SelectItem, NumberInput, TextArea } from './ui';
import { formatCurrency } from '../utils/formatters';
import { useToast } from './Toast';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FreezitItem {
  id: string;
  name: string;
  unit_cost: number;
  unit_price: number;
  stock_qty: number;
  currency: string;
}

interface FreezitSale {
  id: string;
  item_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  total_amount: number;
  currency: string;
  sale_date: string;
  notes?: string;
  created_at: string;
}

interface FreezitRestock {
  id: string;
  item_id: string;
  item_name: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  currency: string;
  restock_date: string;
  notes?: string;
  created_at: string;
}

interface FreezitBreakage {
  id: string;
  item_id: string;
  item_name: string;
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
const fmt = (n: number, currency = 'USD') =>
  formatCurrency(n, currency as any);

// ── Component ─────────────────────────────────────────────────────────────────

export const FreezitSales: React.FC = () => {
  const { addToast } = useToast();
  const [tab, setTab]           = useState<Tab>('overview');
  const [loading, setLoading]   = useState(true);
  const [stats, setStats]       = useState<Stats | null>(null);
  const [items, setItems]       = useState<FreezitItem[]>([]);
  const [sales, setSales]       = useState<FreezitSale[]>([]);
  const [restocks, setRestocks] = useState<FreezitRestock[]>([]);
  const [breakages, setBreakages] = useState<FreezitBreakage[]>([]);

  const [saleOpen, setSaleOpen]         = useState(false);
  const [stockOpen, setStockOpen]       = useState(false);
  const [restockOpen, setRestockOpen]   = useState(false);
  const [breakageOpen, setBreakageOpen] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, itemsRes, salesRes, restocksRes, breakagesRes] = await Promise.all([
        fetch(`${API}?resource=stats`),
        fetch(`${API}?resource=items`),
        fetch(`${API}?resource=sales`),
        fetch(`${API}?resource=restocks`),
        fetch(`${API}?resource=breakages`),
      ]);
      setStats(await statsRes.json());
      setItems(await itemsRes.json());
      setSales(await salesRes.json());
      setRestocks(await restocksRes.json());
      setBreakages(await breakagesRes.json());
    } catch {
      addToast({ kind: 'error', title: 'Failed to load Freezit data' });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

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
        <button
          onClick={fetchAll}
          className="flex items-center gap-1.5 text-sm font-medium text-[#D97706] hover:text-amber-700"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Today's Revenue"  value={fmt(stats?.today_revenue ?? 0)} Icon={TrendingUp} />
        <KpiCard label="Month Revenue"    value={fmt(stats?.month_revenue ?? 0)} Icon={BarChart2} />
        <KpiCard label="Gross Profit"     value={fmt(stats?.gross_profit ?? 0)}  Icon={TrendingUp} danger={(stats?.gross_profit ?? 0) < 0} />
        <KpiCard label="Stock Remaining"  value={String(stats?.stock_remaining ?? 0)} Icon={Package} />
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <Button renderIcon={Plus} onClick={() => setSaleOpen(true)}>Record Sale</Button>
        <Button variant="secondary" renderIcon={Plus} onClick={() => setStockOpen(true)}>Add Stock</Button>
        <Button variant="secondary" renderIcon={Plus} onClick={() => setRestockOpen(true)}>Restock</Button>
        <Button variant="danger" renderIcon={AlertTriangle} onClick={() => setBreakageOpen(true)}>Record Breakage</Button>
      </div>

      {/* Tab Rail */}
      <div className="border-b border-stone-200">
        <div className="flex gap-0 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-[#D97706] text-[#D97706]'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="py-12 text-center text-sm text-zinc-400">Loading...</div>
      ) : (
        <>
          {tab === 'overview' && <OverviewTab stats={stats} breakages={breakages} />}
          {tab === 'sales' && <SalesTab sales={sales} onDelete={async (id) => {
            await fetch(`${API}?resource=sales&id=${id}`, { method: 'DELETE' });
            fetchAll();
          }} />}
          {tab === 'stock' && <StockTab items={items} onDelete={async (id) => {
            await fetch(`${API}?resource=items&id=${id}`, { method: 'DELETE' });
            fetchAll();
          }} />}
          {tab === 'restock' && <RestockTab restocks={restocks} onDelete={async (id) => {
            await fetch(`${API}?resource=restocks&id=${id}`, { method: 'DELETE' });
            fetchAll();
          }} />}
          {tab === 'breakages' && <BreakagesTab breakages={breakages} onDelete={async (id) => {
            await fetch(`${API}?resource=breakages&id=${id}`, { method: 'DELETE' });
            fetchAll();
          }} />}
        </>
      )}

      {/* Modals */}
      <RecordSaleModal
        isOpen={saleOpen}
        items={items}
        onClose={() => setSaleOpen(false)}
        onSaved={() => { setSaleOpen(false); fetchAll(); }}
      />
      <AddStockModal
        isOpen={stockOpen}
        onClose={() => setStockOpen(false)}
        onSaved={() => { setStockOpen(false); fetchAll(); }}
      />
      <RestockModal
        isOpen={restockOpen}
        items={items}
        onClose={() => setRestockOpen(false)}
        onSaved={() => { setRestockOpen(false); fetchAll(); }}
      />
      <RecordBreakageModal
        isOpen={breakageOpen}
        items={items}
        onClose={() => setBreakageOpen(false)}
        onSaved={() => { setBreakageOpen(false); fetchAll(); }}
      />
    </div>
  );
};

// ── KPI Card ──────────────────────────────────────────────────────────────────

const KpiCard: React.FC<{
  label: string;
  value: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  danger?: boolean;
}> = ({ label, value, Icon, danger }) => (
  <div className="rounded-xl border border-stone-200 bg-white p-4">
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
        <Icon size={16} className="text-[#D97706]" />
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{label}</p>
    </div>
    <p className={`mt-3 text-2xl font-bold tabular-nums ${danger ? 'text-red-600' : 'text-zinc-900'}`}>
      {value}
    </p>
  </div>
);

// ── Overview Tab ──────────────────────────────────────────────────────────────

const OverviewTab: React.FC<{ stats: Stats | null; breakages: FreezitBreakage[] }> = ({ stats, breakages }) => (
  <div className="space-y-6">
    <div className="rounded-xl border border-stone-200 bg-white p-5">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">This Month</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCell label="Revenue"       value={fmt(stats?.month_revenue ?? 0)} />
        <SummaryCell label="Gross Profit"  value={fmt(stats?.gross_profit ?? 0)} accent={(stats?.gross_profit ?? 0) >= 0 ? 'green' : 'red'} />
        <SummaryCell label="Breakage Loss" value={fmt(stats?.breakage_loss ?? 0)} accent="red" />
      </div>
    </div>
    {breakages.length > 0 && (
      <div className="rounded-xl border border-red-100 bg-red-50 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-red-700">Recent Breakages</p>
        <div className="space-y-2">
          {breakages.slice(0, 3).map(b => (
            <div key={b.id} className="flex items-center justify-between text-sm">
              <span className="text-zinc-700">{b.item_name} × {b.quantity}</span>
              <span className="font-medium text-red-600">−{fmt(Number(b.estimated_loss))}</span>
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
    columns={['Date', 'Item', 'Qty', 'Unit Price', 'Total']}
    rows={sales.map(s => ({
      id: s.id,
      cells: [
        s.sale_date,
        s.item_name,
        String(s.quantity),
        fmt(Number(s.unit_price), s.currency),
        fmt(Number(s.total_amount), s.currency),
      ],
    }))}
    onDelete={onDelete}
    emptyMessage="No sales recorded yet."
  />
);

// ── Stock Tab ─────────────────────────────────────────────────────────────────

const StockTab: React.FC<{ items: FreezitItem[]; onDelete: (id: string) => void }> = ({ items, onDelete }) => (
  <DataTable
    columns={['Item', 'Stock', 'Unit Cost', 'Sell Price', 'Currency']}
    rows={items.map(i => ({
      id: i.id,
      cells: [
        i.name,
        String(i.stock_qty),
        fmt(Number(i.unit_cost), i.currency),
        fmt(Number(i.unit_price), i.currency),
        i.currency,
      ],
    }))}
    onDelete={onDelete}
    emptyMessage="No stock items added yet."
  />
);

// ── Restock Tab ───────────────────────────────────────────────────────────────

const RestockTab: React.FC<{ restocks: FreezitRestock[]; onDelete: (id: string) => void }> = ({ restocks, onDelete }) => (
  <DataTable
    columns={['Date', 'Item', 'Qty', 'Unit Cost', 'Total Cost']}
    rows={restocks.map(r => ({
      id: r.id,
      cells: [
        r.restock_date,
        r.item_name,
        String(r.quantity),
        fmt(Number(r.unit_cost), r.currency),
        fmt(Number(r.total_cost), r.currency),
      ],
    }))}
    onDelete={onDelete}
    emptyMessage="No restocks recorded yet."
  />
);

// ── Breakages Tab ─────────────────────────────────────────────────────────────

const BreakagesTab: React.FC<{ breakages: FreezitBreakage[]; onDelete: (id: string) => void }> = ({ breakages, onDelete }) => (
  <DataTable
    columns={['Date', 'Item', 'Qty', 'Est. Loss', 'Reason']}
    rows={breakages.map(b => ({
      id: b.id,
      cells: [
        b.breakage_date,
        b.item_name,
        String(b.quantity),
        fmt(Number(b.estimated_loss)),
        b.reason || '—',
      ],
    }))}
    onDelete={onDelete}
    emptyMessage="No breakages recorded."
  />
);

// ── Data Table ────────────────────────────────────────────────────────────────

const DataTable: React.FC<{
  columns: string[];
  rows: { id: string; cells: string[] }[];
  onDelete: (id: string) => void;
  emptyMessage: string;
}> = ({ columns, rows, onDelete, emptyMessage }) => (
  <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
    {rows.length === 0 ? (
      <p className="py-12 text-center text-sm text-zinc-400">{emptyMessage}</p>
    ) : (
      <table className="w-full text-sm">
        <thead className="border-b border-stone-200 bg-stone-50">
          <tr>
            {columns.map(col => (
              <th key={col} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                {col}
              </th>
            ))}
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {rows.map(row => (
            <tr key={row.id} className="hover:bg-stone-50">
              {row.cells.map((cell, i) => (
                <td key={i} className="px-4 py-3 text-zinc-700">{cell}</td>
              ))}
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => onDelete(row.id)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
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
    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
    <p className={`mt-1 text-xl font-bold tabular-nums ${
      accent === 'green' ? 'text-emerald-600' : accent === 'red' ? 'text-red-600' : 'text-zinc-900'
    }`}>{value}</p>
  </div>
);

// ── Modals ────────────────────────────────────────────────────────────────────

const RecordSaleModal: React.FC<{
  isOpen: boolean;
  items: FreezitItem[];
  onClose: () => void;
  onSaved: () => void;
}> = ({ isOpen, items, onClose, onSaved }) => {
  const { addToast } = useToast();
  const [itemId, setItemId] = useState('');
  const [qty, setQty]       = useState('1');
  const [price, setPrice]   = useState('');
  const [date, setDate]     = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes]   = useState('');
  const [loading, setLoading] = useState(false);

  const selectedItem = items.find(i => i.id === itemId);

  useEffect(() => {
    if (selectedItem) setPrice(String(selectedItem.unit_price));
  }, [selectedItem]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}?resource=sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, quantity: Number(qty), unit_price: Number(price), sale_date: date, notes }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to record sale');
      }
      addToast({ kind: 'success', title: 'Sale recorded' });
      onSaved();
    } catch (err: any) {
      addToast({ kind: 'error', title: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record Sale" label="Freezit Sales" size="sm"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="freezit-sale-form" isLoading={loading}>Record Sale</Button>
        </div>
      }
    >
      <form id="freezit-sale-form" onSubmit={handleSubmit} className="space-y-4">
        <Select id="fs-item" labelText="Item *" value={itemId} onChange={e => setItemId(e.target.value)} required>
          <SelectItem value="" text="Select item" />
          {items.map(i => <SelectItem key={i.id} value={i.id} text={`${i.name} (${i.stock_qty} in stock)`} />)}
        </Select>
        <div className="grid grid-cols-2 gap-4">
          <TextInput id="fs-qty" type="number" min="1" labelText="Quantity *" value={qty} onChange={e => setQty(e.target.value)} required />
          <TextInput id="fs-price" type="number" step="0.01" min="0" labelText="Unit Price *" value={price} onChange={e => setPrice(e.target.value)} required />
        </div>
        <TextInput id="fs-date" type="date" labelText="Sale Date" value={date} onChange={e => setDate(e.target.value)} />
        <TextArea id="fs-notes" labelText="Notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
      </form>
    </Modal>
  );
};

const AddStockModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}> = ({ isOpen, onClose, onSaved }) => {
  const { addToast } = useToast();
  const [name, setName]       = useState('');
  const [cost, setCost]       = useState('');
  const [price, setPrice]     = useState('');
  const [qty, setQty]         = useState('0');
  const [currency, setCurrency] = useState('USD');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API}?resource=items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, unit_cost: Number(cost), unit_price: Number(price), stock_qty: Number(qty), currency }),
      });
      if (!res.ok) throw new Error('Failed to add stock item');
      addToast({ kind: 'success', title: 'Stock item added' });
      onSaved();
    } catch (err: any) {
      addToast({ kind: 'error', title: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Stock Item" label="Freezit Sales" size="sm"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="freezit-stock-form" isLoading={loading}>Add Item</Button>
        </div>
      }
    >
      <form id="freezit-stock-form" onSubmit={handleSubmit} className="space-y-4">
        <TextInput id="fsi-name" labelText="Item Name *" value={name} onChange={e => setName(e.target.value)} required />
        <div className="grid grid-cols-2 gap-4">
          <TextInput id="fsi-cost" type="number" step="0.01" min="0" labelText="Unit Cost" value={cost} onChange={e => setCost(e.target.value)} />
          <TextInput id="fsi-price" type="number" step="0.01" min="0" labelText="Selling Price *" value={price} onChange={e => setPrice(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <TextInput id="fsi-qty" type="number" min="0" labelText="Opening Stock" value={qty} onChange={e => setQty(e.target.value)} />
          <Select id="fsi-currency" labelText="Currency" value={currency} onChange={e => setCurrency(e.target.value)}>
            <SelectItem value="USD" text="USD" />
            <SelectItem value="NAD" text="NAD" />
            <SelectItem value="ZAR" text="ZAR" />
            <SelectItem value="GBP" text="GBP" />
          </Select>
        </div>
      </form>
    </Modal>
  );
};

const RestockModal: React.FC<{
  isOpen: boolean;
  items: FreezitItem[];
  onClose: () => void;
  onSaved: () => void;
}> = ({ isOpen, items, onClose, onSaved }) => {
  const { addToast } = useToast();
  const [itemId, setItemId]   = useState('');
  const [qty, setQty]         = useState('');
  const [cost, setCost]       = useState('');
  const [date, setDate]       = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}?resource=restocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, quantity: Number(qty), unit_cost: Number(cost), restock_date: date, notes }),
      });
      if (!res.ok) throw new Error('Failed to record restock');
      addToast({ kind: 'success', title: 'Restock recorded' });
      onSaved();
    } catch (err: any) {
      addToast({ kind: 'error', title: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Restock Item" label="Freezit Sales" size="sm"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="freezit-restock-form" isLoading={loading}>Save Restock</Button>
        </div>
      }
    >
      <form id="freezit-restock-form" onSubmit={handleSubmit} className="space-y-4">
        <Select id="fr-item" labelText="Item *" value={itemId} onChange={e => setItemId(e.target.value)} required>
          <SelectItem value="" text="Select item" />
          {items.map(i => <SelectItem key={i.id} value={i.id} text={i.name} />)}
        </Select>
        <div className="grid grid-cols-2 gap-4">
          <TextInput id="fr-qty" type="number" min="1" labelText="Quantity *" value={qty} onChange={e => setQty(e.target.value)} required />
          <TextInput id="fr-cost" type="number" step="0.01" min="0" labelText="Unit Cost" value={cost} onChange={e => setCost(e.target.value)} />
        </div>
        <TextInput id="fr-date" type="date" labelText="Restock Date" value={date} onChange={e => setDate(e.target.value)} />
        <TextArea id="fr-notes" labelText="Notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
      </form>
    </Modal>
  );
};

const RecordBreakageModal: React.FC<{
  isOpen: boolean;
  items: FreezitItem[];
  onClose: () => void;
  onSaved: () => void;
}> = ({ isOpen, items, onClose, onSaved }) => {
  const { addToast } = useToast();
  const [itemId, setItemId]   = useState('');
  const [qty, setQty]         = useState('');
  const [reason, setReason]   = useState('');
  const [date, setDate]       = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes]     = useState('');
  const [loading, setLoading] = useState(false);

  const selectedItem = items.find(i => i.id === itemId);
  const estimatedLoss = selectedItem ? Number(qty || 0) * Number(selectedItem.unit_cost) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}?resource=breakages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, quantity: Number(qty), reason, breakage_date: date, notes }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to record breakage');
      }
      addToast({ kind: 'success', title: 'Breakage recorded' });
      onSaved();
    } catch (err: any) {
      addToast({ kind: 'error', title: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record Breakage" label="Freezit Sales" size="sm"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" type="submit" form="freezit-breakage-form" isLoading={loading}>Record Breakage</Button>
        </div>
      }
    >
      <form id="freezit-breakage-form" onSubmit={handleSubmit} className="space-y-4">
        <Select id="fb-item" labelText="Item *" value={itemId} onChange={e => setItemId(e.target.value)} required>
          <SelectItem value="" text="Select item" />
          {items.map(i => <SelectItem key={i.id} value={i.id} text={`${i.name} (${i.stock_qty} in stock)`} />)}
        </Select>
        <div className="grid grid-cols-2 gap-4">
          <TextInput id="fb-qty" type="number" min="1" labelText="Quantity Broken *" value={qty} onChange={e => setQty(e.target.value)} required />
          <TextInput id="fb-date" type="date" labelText="Date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        {estimatedLoss > 0 && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
            <p className="text-xs text-red-700">
              Estimated loss: <span className="font-bold">{fmt(estimatedLoss)}</span>
            </p>
          </div>
        )}
        <TextInput id="fb-reason" labelText="Reason" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Dropped, Freezer failure" />
        <TextArea id="fb-notes" labelText="Notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
      </form>
    </Modal>
  );
};

export default FreezitSales;
