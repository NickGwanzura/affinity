import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, Clock, Plus, Trash2 } from 'lucide-react';
import { Button, Modal, TextInput, Select, SelectItem, TextArea } from '../ui';
import { useToast } from '../Toast';
import { useConfirm } from '../ConfirmModal';
import { authFetch } from '../../services/authFetch';
import { formatCurrency } from '../../utils/formatters';

const API = '/api/cash-handovers';
const CURRENCIES = ['USD', 'NAD', 'ZAR', 'BWP', 'GBP'];

interface Handover {
  id: string;
  collected_by: string;
  collected_by_name?: string;
  collected_by_role?: string;
  received_by?: string;
  received_by_name?: string;
  amount: number;
  currency: string;
  description: string;
  collection_date: string;
  status: 'Pending' | 'Confirmed';
  confirmed_at?: string;
  created_at: string;
}

interface CashHandoverPanelProps {
  mode: 'collect' | 'receive';
}

const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
    status === 'Confirmed'
      ? 'bg-emerald-100 text-emerald-700'
      : 'bg-amber-100 text-amber-700'
  }`}>
    {status === 'Confirmed' ? <CheckCircle size={11} /> : <Clock size={11} />}
    {status}
  </span>
);

export const CashHandoverPanel: React.FC<CashHandoverPanelProps> = ({ mode }) => {
  const { showToast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const [rows, setRows]       = useState<Handover[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  // form state
  const [amount, setAmount]           = useState('');
  const [currency, setCurrency]       = useState('USD');
  const [description, setDescription] = useState('');
  const [date, setDate]               = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving]           = useState(false);

  const resource = mode === 'collect' ? 'my' : 'pending';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API}?resource=${resource}`);
      if (!res.ok) throw new Error('Failed to load');
      setRows(await res.json());
    } catch {
      showToast('Failed to load handovers', 'error');
    } finally {
      setLoading(false);
    }
  }, [resource, showToast]);

  useEffect(() => { load(); }, [load]);

  const openModal = () => {
    setAmount('');
    setCurrency('USD');
    setDescription('');
    setDate(new Date().toISOString().slice(0, 10));
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) { showToast('Enter a valid amount', 'error'); return; }
    setSaving(true);
    try {
      const res = await authFetch(API, {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(amount),
          currency,
          description,
          collection_date: date,
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      showToast('Collection logged — pending confirmation', 'success');
      setModalOpen(false);
      load();
    } catch (err: any) {
      showToast(err.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async (id: string) => {
    const ok = await confirm({
      title: 'Confirm Cash Receipt',
      message: 'Confirm that you have physically received this cash?',
      confirmLabel: 'Confirm Receipt',
    });
    if (!ok) return;
    try {
      const res = await authFetch(`${API}?id=${id}`, { method: 'PUT' });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      showToast('Receipt confirmed', 'success');
      load();
    } catch (err: any) {
      showToast(err.message || 'Failed to confirm', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Delete Handover',
      message: 'Delete this collection log? This cannot be undone.',
      confirmLabel: 'Delete',
      isDangerous: true,
    });
    if (!ok) return;
    try {
      const res = await authFetch(`${API}?id=${id}`, { method: 'DELETE' });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      showToast('Deleted', 'success');
      load();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete', 'error');
    }
  };

  const pendingTotal = rows
    .filter(r => r.status === 'Pending')
    .reduce((sum, r) => sum + Number(r.amount), 0);

  return (
    <div className="space-y-4">
      <ConfirmDialog />

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">
            {mode === 'collect' ? 'Cash Collections' : 'Pending Cash Handovers'}
          </h3>
          {mode === 'receive' && rows.length > 0 && (
            <p className="text-xs text-amber-600 mt-0.5">
              {rows.length} pending — approx. ${pendingTotal.toFixed(2)} USD awaiting confirmation
            </p>
          )}
        </div>
        {mode === 'collect' && (
          <Button size="sm" onClick={openModal}>
            <Plus size={14} className="mr-1" /> Log Collection
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-14 app-shimmer rounded-lg" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 py-8 text-center">
          <p className="text-sm text-zinc-500">
            {mode === 'collect' ? 'No collections logged yet.' : 'No pending handovers.'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white overflow-hidden">
          {rows.map(row => (
            <div key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-zinc-900">
                    {formatCurrency(Number(row.amount), row.currency as any)}
                  </span>
                  <StatusBadge status={row.status} />
                  {mode === 'receive' && row.collected_by_name && (
                    <span className="text-xs text-zinc-500">from {row.collected_by_name}</span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-zinc-500 truncate">{row.description}</p>
                <p className="text-xs text-zinc-400">{row.collection_date}</p>
                {row.status === 'Confirmed' && row.received_by_name && (
                  <p className="text-xs text-emerald-600">Confirmed by {row.received_by_name}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {mode === 'receive' && row.status === 'Pending' && (
                  <Button size="sm" onClick={() => handleConfirm(row.id)}>
                    Confirm Receipt
                  </Button>
                )}
                {mode === 'collect' && row.status === 'Pending' && (
                  <button
                    onClick={() => handleDelete(row.id)}
                    className="text-zinc-400 hover:text-red-500 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Log Collection Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Log Cash Collection"
        label="Cash collection"
        size="sm"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" form="handover-form" isLoading={saving}>Log Collection</Button>
          </div>
        }
      >
        <form id="handover-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <TextInput
              id="ho-amount"
              labelText="Amount *"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              required
            />
            <Select
              id="ho-currency"
              labelText="Currency"
              value={currency}
              onChange={e => setCurrency(e.target.value)}
            >
              {CURRENCIES.map(c => <SelectItem key={c} value={c} text={c} />)}
            </Select>
          </div>
          <TextInput
            id="ho-date"
            labelText="Collection Date"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
          <TextInput
            id="ho-description"
            labelText="Description *"
            placeholder="e.g. Car hire cash collections for today"
            value={description}
            onChange={e => setDescription(e.target.value)}
            required
          />
        </form>
      </Modal>
    </div>
  );
};
