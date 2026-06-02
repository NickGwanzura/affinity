import React, { useState, useEffect, useCallback } from 'react';
import { ArrowDownLeft, ArrowUpRight, RefreshCw, TrendingUp, BarChart2, List } from 'lucide-react';
import { Modal, Button, TextInput, Select, SelectItem, TextArea } from './ui';
import { formatCurrency } from '../utils/formatters';
import { useToast } from './Toast';
import { useSession } from '../contexts/SessionContext';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DirectorTx {
  id: string;
  type: 'Received' | 'Disbursed';
  amount: number;
  currency: string;
  party: string;
  purpose: string;
  description?: string;
  date: string;
  recorded_by: string;
  reference?: string;
  created_at: string;
}

interface Stats {
  total_received: number;
  total_disbursed: number;
  net_balance: number;
  month_received: number;
  month_disbursed: number;
  tx_count: number;
  sales_today: number;
  sales_this_month: number;
}

interface SaleFeedItem {
  date: string;
  source: string;
  item: string;
  quantity: number;
  total: number;
  payment_method: string;
  notes?: string;
}

type Tab = 'overview' | 'history' | 'sales';

const API = '/api/director';
const fmt = (n: number, currency = 'USD') => formatCurrency(n, currency as any);
const CURRENCIES = ['USD', 'NAD', 'ZAR', 'BWP', 'GBP'];
const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'EcoCash', 'Card', 'Other'];

// ── Component ─────────────────────────────────────────────────────────────────

export const DirectorsDashboard: React.FC = () => {
  const { showToast } = useToast();
  const session = useSession();

  const [tab, setTab]           = useState<Tab>('overview');
  const [loading, setLoading]   = useState(true);
  const [stats, setStats]       = useState<Stats | null>(null);
  const [txs, setTxs]           = useState<DirectorTx[]>([]);
  const [sales, setSales]       = useState<SaleFeedItem[]>([]);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [disburseOpen, setDisburseOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<DirectorTx | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, txRes, salesRes] = await Promise.all([
        fetch(`${API}?resource=stats`),
        fetch(`${API}?resource=transactions`),
        fetch(`${API}?resource=sales`),
      ]);
      setStats(await statsRes.json());
      setTxs(await txRes.json());
      setSales(await salesRes.json());
    } catch {
      showToast('Failed to load Director data', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDelete = async (id: string) => {
    await fetch(`${API}?resource=transactions&id=${id}`, { method: 'DELETE' });
    showToast('Transaction deleted', 'success');
    fetchAll();
  };

  const tabs = [
    { id: 'overview' as Tab, label: 'Overview',     Icon: TrendingUp },
    { id: 'history'  as Tab, label: 'History',      Icon: List       },
    { id: 'sales'    as Tab, label: 'Sales Report',  Icon: BarChart2  },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Director</h1>
          <p className="mt-0.5 text-sm text-zinc-500">Fund movements &amp; sales oversight</p>
        </div>
        <button onClick={fetchAll} className="flex items-center gap-1.5 text-sm font-medium text-[#D97706] hover:text-amber-700">
          <RefreshCw size={14} />Refresh
        </button>
      </div>

      {/* Primary Action Buttons — large, mobile-friendly */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setReceiveOpen(true)}
          className="flex flex-col items-center gap-2 rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-4 py-5 transition-colors hover:bg-emerald-100 active:scale-95"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
            <ArrowDownLeft size={24} />
          </div>
          <span className="text-base font-bold text-emerald-700">Receive</span>
          <span className="text-xs text-emerald-600">Record money received</span>
        </button>

        <button
          onClick={() => setDisburseOpen(true)}
          className="flex flex-col items-center gap-2 rounded-2xl border-2 border-orange-200 bg-orange-50 px-4 py-5 transition-colors hover:bg-orange-100 active:scale-95"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500 text-white shadow-sm">
            <ArrowUpRight size={24} />
          </div>
          <span className="text-base font-bold text-orange-700">Disburse</span>
          <span className="text-xs text-orange-600">Record money paid out</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Total Received"  value={fmt(stats?.total_received ?? 0)}  color="emerald" />
        <KpiCard label="Total Disbursed" value={fmt(stats?.total_disbursed ?? 0)} color="orange"  />
        <KpiCard label="Net Balance"     value={fmt(stats?.net_balance ?? 0)}      color={(stats?.net_balance ?? 0) >= 0 ? 'blue' : 'red'} />
        <KpiCard label="Sales Today"     value={fmt(stats?.sales_today ?? 0)}      color="amber"  />
      </div>

      {/* Tab Rail */}
      <div className="border-b border-stone-200">
        <div className="flex overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex shrink-0 items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id ? 'border-[#D97706] text-[#D97706]' : 'border-transparent text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <t.Icon size={14} />{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="py-16 text-center text-sm text-zinc-400">Loading...</div>
      ) : (
        <>
          {tab === 'overview' && <OverviewTab stats={stats} txs={txs} />}
          {tab === 'history'  && <HistoryTab txs={txs} onEdit={setEditingTx} onDelete={handleDelete} />}
          {tab === 'sales'    && <SalesTab sales={sales} stats={stats} />}
        </>
      )}

      {/* Modals */}
      <TransactionModal
        isOpen={receiveOpen}
        type="Received"
        userName={session?.user?.name ?? ''}
        onClose={() => setReceiveOpen(false)}
        onSaved={() => { setReceiveOpen(false); fetchAll(); }}
      />
      <TransactionModal
        isOpen={disburseOpen}
        type="Disbursed"
        userName={session?.user?.name ?? ''}
        onClose={() => setDisburseOpen(false)}
        onSaved={() => { setDisburseOpen(false); fetchAll(); }}
      />
      {editingTx && (
        <TransactionModal
          isOpen={!!editingTx}
          type={editingTx.type}
          editingTx={editingTx}
          userName={session?.user?.name ?? ''}
          onClose={() => setEditingTx(null)}
          onSaved={() => { setEditingTx(null); fetchAll(); }}
        />
      )}
    </div>
  );
};

// ── KPI Card ──────────────────────────────────────────────────────────────────

const colorMap: Record<string, string> = {
  emerald: 'bg-emerald-50 text-emerald-700',
  orange:  'bg-orange-50 text-orange-700',
  blue:    'bg-blue-50 text-blue-700',
  red:     'bg-red-50 text-red-600',
  amber:   'bg-amber-50 text-amber-700',
};

const KpiCard: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div className={`rounded-xl border border-stone-200 bg-white p-4`}>
    <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{label}</p>
    <p className={`mt-2 text-lg font-bold tabular-nums ${colorMap[color]?.split(' ')[1] ?? 'text-zinc-900'}`}>{value}</p>
  </div>
);

// ── Overview Tab ──────────────────────────────────────────────────────────────

const OverviewTab: React.FC<{ stats: Stats | null; txs: DirectorTx[] }> = ({ stats, txs }) => {
  const received  = txs.filter(t => t.type === 'Received').slice(0, 3);
  const disbursed = txs.filter(t => t.type === 'Disbursed').slice(0, 3);

  return (
    <div className="space-y-5">
      {/* This month summary */}
      <div className="rounded-xl border border-stone-200 bg-white p-5">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">This Month</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <SummaryCell label="Received"   value={fmt(stats?.month_received ?? 0)}  color="emerald" />
          <SummaryCell label="Disbursed"  value={fmt(stats?.month_disbursed ?? 0)} color="orange"  />
          <SummaryCell label="Sales"      value={fmt(stats?.sales_this_month ?? 0)} color="blue" className="col-span-2 sm:col-span-1" />
        </div>
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <RecentList title="Recently Received" color="emerald" txs={received} />
        <RecentList title="Recently Disbursed" color="orange" txs={disbursed} />
      </div>
    </div>
  );
};

// ── History Tab ───────────────────────────────────────────────────────────────

const HistoryTab: React.FC<{
  txs: DirectorTx[];
  onEdit: (tx: DirectorTx) => void;
  onDelete: (id: string) => void;
}> = ({ txs, onEdit, onDelete }) => (
  <div className="space-y-3">
    {txs.length === 0 ? (
      <div className="py-16 text-center text-sm text-zinc-400">No transactions recorded yet.</div>
    ) : (
      txs.map(tx => (
        <div key={tx.id} className={`rounded-xl border bg-white p-4 ${tx.type === 'Received' ? 'border-l-4 border-l-emerald-400' : 'border-l-4 border-l-orange-400'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  tx.type === 'Received' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'
                }`}>
                  {tx.type === 'Received' ? <ArrowDownLeft size={10} /> : <ArrowUpRight size={10} />}
                  {tx.type}
                </span>
                <span className="text-xs text-zinc-500">{tx.date}</span>
                {tx.reference && <span className="text-xs text-zinc-400">#{tx.reference}</span>}
              </div>
              <p className="mt-1.5 font-semibold text-zinc-900">
                {tx.type === 'Received' ? 'From' : 'To'}: {tx.party}
              </p>
              <p className="text-sm text-zinc-600">{tx.purpose}</p>
              {tx.description && <p className="mt-1 text-xs text-zinc-400">{tx.description}</p>}
              <p className="mt-1 text-[11px] text-zinc-400">Recorded by {tx.recorded_by}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className={`text-lg font-bold tabular-nums ${tx.type === 'Received' ? 'text-emerald-600' : 'text-orange-600'}`}>
                {tx.type === 'Received' ? '+' : '−'}{fmt(Number(tx.amount), tx.currency)}
              </p>
              <div className="mt-2 flex gap-2 justify-end">
                <button onClick={() => onEdit(tx)} className="text-xs text-blue-500 hover:text-blue-700">Edit</button>
                <button onClick={() => onDelete(tx.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
              </div>
            </div>
          </div>
        </div>
      ))
    )}
  </div>
);

// ── Sales Tab ─────────────────────────────────────────────────────────────────

const SalesTab: React.FC<{ sales: SaleFeedItem[]; stats: Stats | null }> = ({ sales, stats }) => (
  <div className="space-y-5">
    <div className="rounded-xl border border-stone-200 bg-white p-5">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">Sales Summary</h3>
      <div className="grid grid-cols-2 gap-4">
        <SummaryCell label="Today's Sales"      value={fmt(stats?.sales_today ?? 0)}      color="amber" />
        <SummaryCell label="This Month's Sales" value={fmt(stats?.sales_this_month ?? 0)} color="blue"  />
      </div>
    </div>

    <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
      {sales.length === 0 ? (
        <p className="py-12 text-center text-sm text-zinc-400">No sales data yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="border-b border-stone-200 bg-stone-50">
            <tr>
              {['Date', 'Source', 'Item', 'Qty', 'Total', 'Method'].map(col => (
                <th key={col} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {sales.map((sale, i) => (
              <tr key={i} className="hover:bg-stone-50">
                <td className="px-4 py-3 text-zinc-700">{sale.date}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    sale.source === 'Freezit' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'
                  }`}>{sale.source}</span>
                </td>
                <td className="px-4 py-3 text-zinc-700">{sale.item}</td>
                <td className="px-4 py-3 text-zinc-700">{sale.quantity}</td>
                <td className="px-4 py-3 font-semibold text-zinc-900">{fmt(Number(sale.total))}</td>
                <td className="px-4 py-3 text-zinc-500">{sale.payment_method}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  </div>
);

// ── Helper Components ─────────────────────────────────────────────────────────

const SummaryCell: React.FC<{ label: string; value: string; color: string; className?: string }> = ({ label, value, color, className = '' }) => {
  const textColor = color === 'emerald' ? 'text-emerald-600' : color === 'orange' ? 'text-orange-600' : color === 'red' ? 'text-red-600' : color === 'amber' ? 'text-amber-600' : 'text-blue-600';
  return (
    <div className={className}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${textColor}`}>{value}</p>
    </div>
  );
};

const RecentList: React.FC<{ title: string; color: string; txs: DirectorTx[] }> = ({ title, color, txs }) => {
  const borderColor = color === 'emerald' ? 'border-emerald-100' : 'border-orange-100';
  const bgColor     = color === 'emerald' ? 'bg-emerald-50' : 'bg-orange-50';
  const textColor   = color === 'emerald' ? 'text-emerald-700' : 'text-orange-700';
  const amountColor = color === 'emerald' ? 'text-emerald-600' : 'text-orange-600';

  return (
    <div className={`rounded-xl border ${borderColor} ${bgColor} p-4`}>
      <p className={`mb-3 text-xs font-semibold uppercase tracking-wider ${textColor}`}>{title}</p>
      {txs.length === 0 ? (
        <p className="text-xs text-zinc-400">None yet</p>
      ) : (
        <div className="space-y-3">
          {txs.map(tx => (
            <div key={tx.id} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-800">{tx.party}</p>
                <p className="truncate text-xs text-zinc-500">{tx.purpose} · {tx.date}</p>
              </div>
              <p className={`shrink-0 text-sm font-bold tabular-nums ${amountColor}`}>
                {fmt(Number(tx.amount), tx.currency)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Transaction Modal ─────────────────────────────────────────────────────────

const TransactionModal: React.FC<{
  isOpen: boolean;
  type: 'Received' | 'Disbursed';
  userName: string;
  editingTx?: DirectorTx;
  onClose: () => void;
  onSaved: () => void;
}> = ({ isOpen, type, userName, editingTx, onClose, onSaved }) => {
  const { showToast } = useToast();
  const isEdit = !!editingTx;

  const [amount, setAmount]       = useState(editingTx ? String(editingTx.amount) : '');
  const [currency, setCurrency]   = useState(editingTx?.currency ?? 'USD');
  const [party, setParty]         = useState(editingTx?.party ?? '');
  const [purpose, setPurpose]     = useState(editingTx?.purpose ?? '');
  const [description, setDescription] = useState(editingTx?.description ?? '');
  const [date, setDate]           = useState(editingTx?.date ?? new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState(editingTx?.reference ?? '');
  const [loading, setLoading]     = useState(false);

  const isReceived = (editingTx?.type ?? type) === 'Received';
  const accentColor = isReceived ? 'text-emerald-600' : 'text-orange-600';
  const partyLabel  = isReceived ? 'Received From *' : 'Disbursed To *';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const url = isEdit
        ? `${API}?resource=transactions&id=${editingTx!.id}`
        : `${API}?resource=transactions`;
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: editingTx?.type ?? type,
          amount: Number(amount),
          currency,
          party,
          purpose,
          description: description || undefined,
          date,
          reference: reference || undefined,
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      addToast({ kind: 'success', title: isEdit ? 'Transaction updated' : `${type} recorded` });
      onSaved();
    } catch (err: any) {
      addToast({ kind: 'error', title: err.message });
    } finally {
      setLoading(false);
    }
  };

  const formId = `dir-tx-form-${type.toLowerCase()}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? `Edit ${editingTx!.type}` : type === 'Received' ? 'Record Receipt' : 'Record Disbursement'}
      label="Director"
      size="sm"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            form={formId}
            isLoading={loading}
            variant={isReceived ? 'primary' : 'primary'}
          >
            {isEdit ? 'Save Changes' : isReceived ? 'Record Receipt' : 'Record Disbursement'}
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-3">
        {/* Type badge */}
        <div className={`flex items-center gap-2 rounded-xl p-3 ${isReceived ? 'bg-emerald-50' : 'bg-orange-50'}`}>
          {isReceived ? <ArrowDownLeft size={18} className="text-emerald-600" /> : <ArrowUpRight size={18} className="text-orange-600" />}
          <span className={`text-sm font-semibold ${accentColor}`}>
            {isReceived ? 'Money received by director' : 'Money paid out by director'}
          </span>
        </div>

        <TextInput
          id={`${formId}-party`}
          labelText={partyLabel}
          value={party}
          onChange={e => setParty(e.target.value)}
          placeholder={isReceived ? 'Who gave the money' : 'Who received the money'}
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <TextInput
            id={`${formId}-amount`}
            type="number"
            step="0.01"
            min="0.01"
            labelText="Amount *"
            placeholder="0.00"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            required
          />
          <Select id={`${formId}-currency`} labelText="Currency" value={currency} onChange={e => setCurrency(e.target.value)}>
            {CURRENCIES.map(c => <SelectItem key={c} value={c} text={c} />)}
          </Select>
        </div>

        <TextInput
          id={`${formId}-purpose`}
          labelText="Purpose *"
          value={purpose}
          onChange={e => setPurpose(e.target.value)}
          placeholder={isReceived ? 'e.g. Sales proceeds, Office float' : 'e.g. Trip expenses, Staff wages'}
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <TextInput id={`${formId}-date`} type="date" labelText="Date" value={date} onChange={e => setDate(e.target.value)} />
          <TextInput id={`${formId}-ref`} labelText="Reference" value={reference} onChange={e => setReference(e.target.value)} placeholder="Optional" />
        </div>

        <TextArea
          id={`${formId}-desc`}
          labelText="Description"
          rows={2}
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Any additional notes..."
        />

        <p className="text-xs text-zinc-400">Will be recorded as: <span className="font-medium text-zinc-600">{userName || 'Director'}</span></p>
      </form>
    </Modal>
  );
};

export default DirectorsDashboard;
