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
  const [balance, setBalance]     = useState<Balance | null>(null);
  const [received, setReceived]   = useState<Disbursement[]>([]);
  const [usage, setUsage]         = useState<UsageLog[]>([]);
  const [sent, setSent]           = useState<Disbursement[]>([]);
  const [loading, setLoading]     = useState(true);
  const [usageOpen, setUsageOpen] = useState(false);
  const [disburseOpen, setDisburseOpen] = useState(false);
  const [tab, setTab]             = useState<'received' | 'usage' | 'sent'>('received');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const reqs: Promise<Response>[] = [
        authFetch(`${API}?resource=balance`),
        authFetch(`${API}?resource=received`),
        authFetch(`${API}?resource=usage`),
      ];
      if (canDisburse) reqs.push(authFetch(`${API}?resource=sent`));

      const results = await Promise.allSettled(reqs.map(r => r.then(x => x.json())));
      if (results[0].status === 'fulfilled') setBalance(results[0].value);
      if (results[1].status === 'fulfilled') setReceived(results[1].value);
      if (results[2].status === 'fulfilled') setUsage(results[2].value);
      if (canDisburse && results[3]?.status === 'fulfilled') setSent((results[3] as PromiseFulfilledResult<any>).value);
    } catch {
      showToast('Failed to load fund data', 'error');
    } finally {
      setLoading(false);
    }
  }, [canDisburse, showToast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const deleteUsage = async (id: string) => {
    try {
      await authFetch(`${API}?resource=usage&id=${id}`, { method: 'DELETE' });
      showToast('Usage entry deleted', 'success');
      fetchAll();
    } catch { showToast('Failed to delete', 'error'); }
  };

  const tabs = [
    { id: 'received' as const, label: 'Received' },
    { id: 'usage' as const, label: 'My Usage' },
    ...(canDisburse ? [{ id: 'sent' as const, label: 'Sent' }] : []),
  ];

  const fmt = (n: number, c = 'USD') => formatCurrency(n, c as any);

  return (
    <div className="space-y-4">
      {/* Balance strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Received', value: balance?.received ?? 0, color: 'text-emerald-600' },
          { label: 'Used',     value: balance?.used ?? 0,     color: 'text-orange-600' },
          { label: 'Balance',  value: balance?.balance ?? 0,  color: (balance?.balance ?? 0) >= 0 ? 'text-zinc-900' : 'text-red-600' },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-xl border border-stone-200 bg-white p-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">{kpi.label}</p>
            <p className={`mt-1 text-lg font-bold tabular-nums ${kpi.color}`}>
              {loading ? '—' : `$${kpi.value.toFixed(2)}`}
            </p>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button size="sm" variant="primary" leftIcon={<Plus size={14} />} onClick={() => setUsageOpen(true)}>
            Log Usage
          </Button>
          {canDisburse && (
            <Button size="sm" variant="secondary" leftIcon={<Wallet size={14} />} onClick={() => setDisburseOpen(true)}>
              Disburse
            </Button>
          )}
        </div>
        <button
          onClick={fetchAll}
          className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-700 transition-colors"
        >
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
          {/* Received tab */}
          {tab === 'received' && (
            loading
              ? <p className="py-8 text-center text-sm text-zinc-400">Loading…</p>
              : received.length === 0
              ? <p className="py-8 text-center text-sm text-zinc-400">No disbursements received yet.</p>
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

          {/* Usage tab */}
          {tab === 'usage' && (
            loading
              ? <p className="py-8 text-center text-sm text-zinc-400">Loading…</p>
              : usage.length === 0
              ? <p className="py-8 text-center text-sm text-zinc-400">No usage logged yet.</p>
              : usage.map(u => (
                  <div key={u.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-900">{fmt(u.amount, u.currency)}</p>
                      <p className="mt-0.5 text-xs text-zinc-500 truncate">{u.description}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <Tag type="warm-gray">{u.category}</Tag>
                        <p className="mt-0.5 text-[11px] text-zinc-400">{u.usage_date}</p>
                      </div>
                      <button
                        onClick={() => deleteUsage(u.id)}
                        className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
          )}

          {/* Sent tab (disbursers only) */}
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
        isOpen={usageOpen}
        onClose={() => setUsageOpen(false)}
        onSaved={fetchAll}
        availableBalance={balance?.balance}
        currency="USD"
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
