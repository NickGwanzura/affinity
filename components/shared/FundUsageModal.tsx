import React, { useState } from 'react';
import { Modal, Button, TextInput, Select, SelectItem, TextArea } from '../ui';
import { authFetch } from '../../services/authFetch';
import { useToast } from '../Toast';

const API = '/api/fund-disbursements';
const CURRENCIES = ['USD', 'GBP', 'NAD', 'ZAR', 'BWP'] as const;
const CATEGORIES = ['General', 'Fuel', 'Food & Meals', 'Transport', 'Supplies', 'Communication', 'Accommodation', 'Maintenance', 'Other'];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  availableBalance?: number;
  currency?: string;
}

export const FundUsageModal: React.FC<Props> = ({ isOpen, onClose, onSaved, availableBalance, currency: defaultCurrency = 'USD' }) => {
  const { showToast } = useToast();
  const [amount, setAmount]         = useState('');
  const [currency, setCurrency]     = useState(defaultCurrency);
  const [description, setDescription] = useState('');
  const [category, setCategory]     = useState('General');
  const [date, setDate]             = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading]       = useState(false);

  const reset = () => { setAmount(''); setDescription(''); setCategory('General'); setDate(new Date().toISOString().slice(0, 10)); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authFetch(`${API}?resource=usage`, {
        method: 'POST',
        body: JSON.stringify({ amount: parseFloat(amount), currency, description, category, usage_date: date }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      showToast('Usage logged', 'success');
      reset();
      onSaved();
      onClose();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Log Fund Usage"
      label="My Funds"
      size="sm"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="usage-form" isLoading={loading}>Log Usage</Button>
        </div>
      }
    >
      <form id="usage-form" onSubmit={handleSubmit} className="space-y-3">
        {availableBalance !== undefined && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-sm text-emerald-800">
              Available balance: <span className="font-bold">${availableBalance.toFixed(2)}</span>
            </p>
          </div>
        )}

        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">Expense Details</p>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <TextInput id="fu-amount" type="number" step="0.01" min="0.01" labelText="Amount *" value={amount} onChange={e => setAmount(e.target.value)} required placeholder="0.00" />
              <Select id="fu-currency" labelText="Currency" value={currency} onChange={e => setCurrency(e.target.value)}>
                {CURRENCIES.map(c => <SelectItem key={c} value={c} text={c} />)}
              </Select>
            </div>
            <Select id="fu-category" labelText="Category" value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORIES.map(c => <SelectItem key={c} value={c} text={c} />)}
            </Select>
            <TextInput id="fu-date" type="date" labelText="Date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>

        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
          <TextArea id="fu-desc" labelText="Description *" rows={2} value={description} onChange={e => setDescription(e.target.value)} required placeholder="What was this spent on?" />
        </div>
      </form>
    </Modal>
  );
};

export default FundUsageModal;
