import React, { useState, useEffect } from 'react';
import { Modal, Button, Select, SelectItem, TextInput, TextArea } from '../ui';
import { authFetch } from '../../services/authFetch';
import { useToast } from '../Toast';
import { formatCurrency } from '../../utils/formatters';

const API = '/api/fund-disbursements';
const CURRENCIES = ['USD', 'GBP', 'NAD', 'ZAR', 'BWP'] as const;

interface User { id: string; name: string; role: string; }

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const FundDisbursementModal: React.FC<Props> = ({ isOpen, onClose, onSaved }) => {
  const { showToast } = useToast();
  const [users, setUsers]       = useState<User[]>([]);
  const [toUserId, setToUserId] = useState('');
  const [amount, setAmount]     = useState('');
  const [currency, setCurrency] = useState<string>('USD');
  const [note, setNote]         = useState('');
  const [date, setDate]         = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    authFetch(`${API}?resource=users`)
      .then(r => r.json())
      .then(setUsers)
      .catch(() => {});
  }, [isOpen]);

  const reset = () => { setToUserId(''); setAmount(''); setNote(''); setDate(new Date().toISOString().slice(0, 10)); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toUserId || !amount) return;
    setLoading(true);
    try {
      const res = await authFetch(`${API}?resource=disburse`, {
        method: 'POST',
        body: JSON.stringify({ to_user_id: toUserId, amount: parseFloat(amount), currency, note: note || undefined, disbursed_at: date }),
      });
      if (!res.ok) {
        const e = await res.json();
        const msg = e.error === 'password_change_required'
          ? 'You must change your password before disbursing funds.'
          : e.error || 'Failed to disburse';
        throw new Error(msg);
      }
      showToast('Funds disbursed', 'success');
      reset();
      onSaved();
      onClose();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const recipient = users.find(u => u.id === toUserId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Disburse Funds"
      label="Fund Management"
      size="sm"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="disburse-form" isLoading={loading}>Disburse</Button>
        </div>
      }
    >
      <form id="disburse-form" onSubmit={handleSubmit} className="space-y-3">
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">Recipient</p>
          <div className="space-y-3">
            <Select id="fd-recipient" labelText="Send To *" value={toUserId} onChange={e => setToUserId(e.target.value)} required>
              <SelectItem value="" text="Select person…" />
              {users.map(u => (
                <SelectItem key={u.id} value={u.id} text={`${u.name} — ${u.role}`} />
              ))}
            </Select>
          </div>
        </div>

        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">Amount</p>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <TextInput id="fd-amount" type="number" step="0.01" min="0.01" labelText="Amount *" value={amount} onChange={e => setAmount(e.target.value)} required placeholder="0.00" />
              <Select id="fd-currency" labelText="Currency" value={currency} onChange={e => setCurrency(e.target.value)}>
                {CURRENCIES.map(c => <SelectItem key={c} value={c} text={c} />)}
              </Select>
            </div>
            <TextInput id="fd-date" type="date" labelText="Date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>

        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">Note</p>
          <TextArea id="fd-note" labelText="Purpose / Note" rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="What is this for?" />
        </div>

        {toUserId && amount && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm text-amber-800">
              Sending <span className="font-bold">{formatCurrency(parseFloat(amount) || 0, currency as any)}</span>
              {' '}to <span className="font-bold">{recipient?.name}</span>
            </p>
          </div>
        )}
      </form>
    </Modal>
  );
};

export default FundDisbursementModal;
