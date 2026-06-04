import React, { useState, useEffect, useCallback } from 'react';
import { Wallet, Plus, Trash2, RefreshCw } from 'lucide-react';
import { Button, Tag } from '../ui';
import { authFetch } from '../../services/authFetch';
import { useToast } from '../Toast';
import { formatCurrency } from '../../utils/formatters';
import { FundUsageModal } from './FundUsageModal';
import { FundDisbursementModal } from './FundDisbursementModal';

const API = '/api/fund-disbursements';

interface Disbursement {
  id: string;
  amount: number;
  currency: string;
  note?: string;
  disbursed_at: string;
  from_name?: string;
  from_role?: string;
  to_name?: string;
  to_role?: string;
}

interface UsageLog {
  id: string;
  amount: number;
  currency: string;
  description: string;
  category: string;
  source: string;
  usage_date: string;
}

interface Balance {
  received: number;
  used: number;
  balance: number;
}

interface Props {
  canDisburse?: boolean;
}

export const MyFundsWidget: React.FC<Props> = ({ canDisburse = false }) => {
  const { showToast } = useToast();
  const [balance, setBalance]           = useState<Balance | null>(null);
  const [received, setReceived]         = useState<Disbursement[]>([]);
  const [usage, setUsage]               = useState<UsageLog[]>([]);
  const [sent, setSent]                 = useState<Disbursement[]>([]);
  const [loading, setLoading]           = useState(true);
  const [expenseOpen, setExpenseOpen]   = useState(false);
  const [disburseOpen, setDisburseOpen] = useState(false);
  const [tab, setTab]                   = useState<'expenses' | 'received' | 'sent'>('expenses');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const reqs = [
        authFetch(`${API}?resource=balance`).then(r => r.json()),
        authFetch(`${API}?resource=received`).then(r => r.json()),
        authFetch(`${API}?resource=usage`).then(r => r.json()),
        ...(canDisburse ? [authFetch(`${API}?resource=sent`).then(r => r.json())] : []),
      ];
      const results = await Promise.allSettled(reqs);
      if (results[0].status === 'fulfilled') {
        const b = results[0].value;
        setBalance({ received: Number(b.received), used: Number(b.used), balance: Number(b.balance) });
      }
      if (results[1].status === 'fulfilled') setReceived(results[1].value);
      if (results[2].status === 'fulfilled') setUsage(results[2].value);
      if (canDisburse && results[3]?.status === 'fulfilled') setSent((results[3] as PromiseFulfilledResult<any>).value);
    } catch {
      showToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }, [canDisburse, showToast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const deleteExpense = async (id: string) => {
    try {
      await authFetch(`${API}?resource=usage&id=${id}`, { method: 'DELETE' });
      showToast('Expense deleted', 'success');
      fetchAll();
    } catch { showToast('Failed to delete', 'error'); }
  };

  const tabs = [
    { id: 'expenses' as const, label: 'My Expenses' },
    { id: 'received' as const, label: 'Received Funds' },
    ...(canDisburse ? [{ id: 'sent' as const, label: 'Disbursed' }] : []),
  ];

  const fmt = (n: number, c = 'USD') => formatCurrency(n, c as any);

  const totalLogged = usage.reduce((s, u) => s + Number(u.amount), 0);

  return (
    <div className="space-y-4">
      {/* Summary strip — shows disbursed balance if any received, otherwise just total logged */}
      <div className="grid gap-3" style={{ gridTemplateColumns: (balance?.received ?? 0) > 0 ? 'repeat(3,1fr)' : 'repeat(2,1fr)' }}>
        <div className="rounded-xl border border-stone-200 bg-white p-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">Total Logged</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-orange-600">
            {loading ? '—' : `$${totalLogged.toFixed(2)}`}
          </p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">Entries</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-zinc-900">
            {loading ? '—' : usage.length}
          </p>
        </div>
        {(balance?.received ?? 0) > 0 && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-600">Disbursed Balance</p>
            <p className={`mt-1 text-lg font-bold tabular-nums ${(balance?.balance ?? 0) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
              {loading ? '—' : `$${(balance?.balance ?? 0).toFixed(2)}`}
            </p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button size="sm" variant="primary" leftIcon={<Plus size={14} />} onClick={() => setExpenseOpen(true)}>
            Log Expense
          </Button>
          {canDisburse && (
            <Button size="sm" variant="secondary" leftIcon={<Wallet size={14} />} onClick={() => setDisburseOpen(true)}>
              Disburse
            </Button>
          )}
        </div>
        <button onClick={fetchAll} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-700 transition-colors">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
        <div className="flex border-b border-stone-200">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'text-amber-600 border-b-2 border-amber-500 -mb-px bg-amber-50/50'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="divide-y divide-stone-100">
          {/* My Expenses tab — always first, no disbursement required */}
          {tab === 'expenses' && (
            loading
              ? <p className="py-8 text-center text-sm text-zinc-400">Loading…</p>
              : usage.length === 0
              ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-zinc-400">No expenses logged yet.</p>
                  <p className="mt-1 text-xs text-zinc-300">Use "Log Expense" above to record any spend.</p>
                </div>
              )
              : usage.map(u => (
                  <div key={u.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-zinc-900">{fmt(u.amount, u.currency)}</p>
                        <Tag type="warm-gray">{u.category}</Tag>
                        <Tag type="blue">{u.source}</Tag>
                      </div>
                      <p className="mt-0.5 text-xs text-zinc-500 truncate">{u.description}</p>
                      <p className="mt-0.5 text-[11px] text-zinc-400">{u.usage_date}</p>
                    </div>
                    <button
                      onClick={() => deleteExpense(u.id)}
                      className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
          )}

          {/* Received Funds tab */}
          {tab === 'received' && (
            loading
              ? <p className="py-8 text-center text-sm text-zinc-400">Loading…</p>
              : received.length === 0
              ? <p className="py-8 text-center text-sm text-zinc-400">No funds disbursed to you yet.</p>
              : received.map(d => (
                  <div key={d.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-900">
                        {fmt(d.amount, d.currency)}
                        {d.from_name && <span className="ml-2 font-normal text-zinc-500">from {d.from_name}</span>}
                      </p>
                      {d.note && <p className="mt-0.5 text-xs text-zinc-500 truncate">{d.note}</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      <Tag type="teal">{d.from_role ?? 'Staff'}</Tag>
                      <p className="mt-0.5 text-[11px] text-zinc-400">{d.disbursed_at}</p>
                    </div>
                  </div>
                ))
          )}

          {/* Disbursed tab (disbursers only) */}
          {tab === 'sent' && canDisburse && (
            loading
              ? <p className="py-8 text-center text-sm text-zinc-400">Loading…</p>
              : sent.length === 0
              ? <p className="py-8 text-center text-sm text-zinc-400">No disbursements sent yet.</p>
              : sent.map(d => (
                  <div key={d.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-900">
                        {fmt(d.amount, d.currency)}
                        {d.to_name && <span className="ml-2 font-normal text-zinc-500">to {d.to_name}</span>}
                      </p>
                      {d.note && <p className="mt-0.5 text-xs text-zinc-500 truncate">{d.note}</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      <Tag type="blue">{d.to_role ?? 'Staff'}</Tag>
                      <p className="mt-0.5 text-[11px] text-zinc-400">{d.disbursed_at}</p>
                    </div>
                  </div>
                ))
          )}
        </div>
      </div>

      <FundUsageModal
        isOpen={expenseOpen}
        onClose={() => setExpenseOpen(false)}
        onSaved={fetchAll}
      />
      {canDisburse && (
        <FundDisbursementModal
          isOpen={disburseOpen}
          onClose={() => setDisburseOpen(false)}
          onSaved={fetchAll}
        />
      )}
    </div>
  );
};

export default MyFundsWidget;
