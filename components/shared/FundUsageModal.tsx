import React, { useState } from 'react';
import { Modal, Button, TextInput, Select, SelectItem, TextArea } from '../ui';
import { authFetch } from '../../services/authFetch';
import { useToast } from '../Toast';

const API = '/api/fund-disbursements';
const CURRENCIES = ['USD', 'GBP', 'NAD', 'ZAR', 'BWP'] as const;
const CATEGORIES = ['General', 'Fuel', 'Food & Meals', 'Transport', 'Supplies', 'Communication', 'Accommodation', 'Maintenance', 'Other'];
const SOURCES = [
  'Sales Revenue',
  'Disbursed Funds',
  'Petty Cash',
  'Company Account',
  'Personal (reimburse)',
  'Other',
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const FundUsageModal: React.FC<Props> = ({ isOpen, onClose, onSaved }) => {
  const { showToast } = useToast();
  const [amount, setAmount]           = useState('');
  const [currency, setCurrency]       = useState('USD');
  const [description, setDescription] = useState('');
  const [category, setCategory]       = useState('General');
  const [source, setSource]           = useState('Sales Revenue');
  const [date, setDate]               = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading]         = useState(false);

  const reset = () => {
    setAmount(''); setDescription(''); setCategory('General');
    setSource('Sales Revenue'); setDate(new Date().toISOString().slice(0, 10));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authFetch(`${API}?resource=usage`, {
        method: 'POST',
        body: JSON.stringify({ amount: parseFloat(amount), currency, description, category, source, usage_date: date }),
      });
      if (!res.ok) {
        const e = await res.json();
        const msg = e.error === 'password_change_required'
          ? 'You must change your password before logging expenses. Ask your admin to reset it.'
          : e.error || 'Failed to log expense';
        throw new Error(msg);
      }
      showToast('Expense logged', 'success');
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
      title="Log Expense"
      label="My Expenses"
      size="sm"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="expense-log-form" isLoading={loading}>Log Expense</Button>
        </div>
      }
    >
      <form id="expense-log-form" onSubmit={handleSubmit} className="space-y-3">
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">Amount</p>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <TextInput id="fu-amount" type="number" step="0.01" min="0.01" labelText="Amount *" value={amount} onChange={e => setAmount(e.target.value)} required placeholder="0.00" />
              <Select id="fu-currency" labelText="Currency" value={currency} onChange={e => setCurrency(e.target.value)}>
                {CURRENCIES.map(c => <SelectItem key={c} value={c} text={c} />)}
              </Select>
            </div>
            <TextInput id="fu-date" type="date" labelText="Date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>

        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">Classification</p>
          <div className="space-y-3">
            <Select id="fu-source" labelText="Paid from *" value={source} onChange={e => setSource(e.target.value)}>
              {SOURCES.map(s => <SelectItem key={s} value={s} text={s} />)}
            </Select>
            <Select id="fu-category" labelText="Category" value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORIES.map(c => <SelectItem key={c} value={c} text={c} />)}
            </Select>
          </div>
        </div>

        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
          <TextArea id="fu-desc" labelText="Description *" rows={2} value={description} onChange={e => setDescription(e.target.value)} required placeholder="What was this expense for?" />
        </div>
      </form>
    </Modal>
  );
};

export default FundUsageModal;
