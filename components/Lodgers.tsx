import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Plus, Home, Users, DollarSign, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import { useToast } from './Toast';
import { Button, TextInput, Select, SelectItem, TextArea } from './ui';
import { Modal } from './ui';

interface Lodger {
  id: string;
  full_name: string;
  phone_number?: string;
  id_number?: string;
  room_number: string;
  checkin_date: string;
  expected_duration_days?: number;
  deposit_amount: number;
  amount_paid: number;
  checkout_date?: string | null;
  status: string;
  notes?: string;
  total_paid: number;
}

interface LodgerPayment {
  id: string;
  lodger_id: string;
  amount: number;
  currency: string;
  payment_date: string;
  payment_method: string;
  month_covered?: string;
  notes?: string;
  lodger_name?: string;
  room_number?: string;
}

interface Stats {
  total_lodgers: number;
  total_revenue: number;
  month_revenue: number;
  occupancy: number;
  checked_out: number;
}

const API = '/api/lodgers';
const fmt = (n: number) => formatCurrency(n, 'USD');

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  CHECKED_OUT: 'bg-stone-100 text-stone-500',
};

export const Lodgers: React.FC = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [lodgers, setLodgers] = useState<Lodger[]>([]);
  const [payments, setPayments] = useState<LodgerPayment[]>([]);
  const [tab, setTab] = useState<'lodgers' | 'payments'>('lodgers');
  const [lodgerOpen, setLodgerOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [editingLodger, setEditingLodger] = useState<Lodger | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      fetch(`${API}?resource=stats`).then(r => { if (!r.ok) throw new Error('Stats failed'); return r.json(); }),
      fetch(`${API}?resource=lodgers`).then(r => { if (!r.ok) throw new Error('Lodgers failed'); return r.json(); }),
      fetch(`${API}?resource=payments`).then(r => { if (!r.ok) throw new Error('Payments failed'); return r.json(); }),
    ]);
    setStats(results[0].status === 'fulfilled' ? results[0].value : null);
    setLodgers(results[1].status === 'fulfilled' && Array.isArray(results[1].value) ? results[1].value : []);
    setPayments(results[2].status === 'fulfilled' && Array.isArray(results[2].value) ? results[2].value : []);
    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      showToast(`Failed to load ${failures.length} resource(s)`, 'error');
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDeleteLodger = async (id: string) => {
    try {
      const res = await fetch(`${API}?resource=lodgers&id=${id}`, { method: 'DELETE' });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Delete failed'); }
      showToast('Lodger checked out', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete', 'error');
    }
    fetchAll();
  };

  const handleDeletePayment = async (id: string) => {
    try {
      const res = await fetch(`${API}?resource=payments&id=${id}`, { method: 'DELETE' });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Delete failed'); }
      showToast('Payment deleted', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete', 'error');
    }
    fetchAll();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Lodgers</h1>
          <p className="mt-0.5 text-sm text-zinc-500">Accommodation & tenant management</p>
        </div>
        <button onClick={fetchAll} className="flex items-center gap-1.5 text-sm font-medium text-[#D97706] hover:text-amber-700">
          <RefreshCw size={14} />Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Active Lodgers" value={String(stats?.occupancy ?? 0)} Icon={Users} />
        <KpiCard label="Total Revenue" value={fmt(stats?.total_revenue ?? 0)} Icon={DollarSign} />
        <KpiCard label="Month Revenue" value={fmt(stats?.month_revenue ?? 0)} Icon={DollarSign} />
        <KpiCard label="Checked Out" value={String(stats?.checked_out ?? 0)} Icon={Home} />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button renderIcon={Plus} onClick={() => { setEditingLodger(null); setLodgerOpen(true); }}>Add Lodger</Button>
        <Button variant="secondary" renderIcon={Plus} onClick={() => setPaymentOpen(true)}>Record Payment</Button>
      </div>

      {/* Tabs */}
      <div className="border-b border-stone-200">
        <div className="flex">
          <button onClick={() => setTab('lodgers')}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === 'lodgers' ? 'border-[#D97706] text-[#D97706]' : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}>Lodgers</button>
          <button onClick={() => setTab('payments')}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === 'payments' ? 'border-[#D97706] text-[#D97706]' : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}>Payments</button>
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
            <div className="h-10 w-28 app-shimmer rounded-lg" />
            <div className="h-10 w-32 app-shimmer rounded-lg" />
          </div>
        </div>
      ) : (
        <>
          {tab === 'lodgers' && (
            <div className="space-y-3">
              {lodgers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-stone-100">
                    <Home size={20} className="text-zinc-400" />
                  </div>
                  <p className="text-sm font-medium text-zinc-700">No lodgers yet</p>
                  <p className="mt-1 text-xs text-zinc-400">Add your first lodger to get started.</p>
                </div>
              ) : lodgers.map(l => (
                <div key={l.id} className="rounded-xl border border-stone-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-zinc-900">{l.full_name}</span>
                        {l.room_number && <span className="text-xs text-zinc-400">Room {l.room_number}</span>}
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusColors[l.status] || 'bg-zinc-100 text-zinc-700'}`}>
                          {l.status === 'ACTIVE' ? 'Active' : 'Checked Out'}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                        <span>Deposit: {fmt(Number(l.deposit_amount))}</span>
                        <span>Paid: {fmt(Number(l.amount_paid))}</span>
                        <span>Check-in: {l.checkin_date}</span>
                        {l.checkout_date && <span>Check-out: {l.checkout_date}</span>}
                        {l.id_number && <span>ID: {l.id_number}</span>}
                      </div>
                      {l.notes && <p className="mt-1 text-xs text-zinc-400">{l.notes}</p>}
                    </div>
                    <div className="shrink-0 flex gap-2">
                      <button onClick={() => { setEditingLodger(l); setLodgerOpen(true); }} className="text-xs text-blue-500 hover:text-blue-700">Edit</button>
                      <button onClick={() => handleDeleteLodger(l.id)} className="text-xs text-red-500 hover:text-red-700">Check Out</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'payments' && (
            <div className="space-y-3">
              {payments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-stone-100">
                    <DollarSign size={20} className="text-zinc-400" />
                  </div>
                  <p className="text-sm font-medium text-zinc-700">No payments recorded yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
                  <table className="w-full text-sm table-card-mobile">
                    <thead className="border-b border-stone-200 bg-stone-50">
                      <tr>
                        {['Date', 'Lodger', 'Room', 'Amount', 'Method', 'Month'].map(col => (
                          <th key={col} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">{col}</th>
                        ))}
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {payments.map(p => (
                        <tr key={p.id} className="hover:bg-stone-50">
                          <td className="px-4 py-3 text-zinc-700" data-label="Date">{p.payment_date}</td>
                          <td className="px-4 py-3 font-medium text-zinc-900" data-label="Lodger">{p.lodger_name || '-'}</td>
                          <td className="px-4 py-3 text-zinc-500" data-label="Room">{p.room_number || '-'}</td>
                          <td className="px-4 py-3 text-zinc-900 font-semibold" data-label="Amount">{fmt(Number(p.amount))}</td>
                          <td className="px-4 py-3 text-zinc-500" data-label="Method">{p.payment_method}</td>
                          <td className="px-4 py-3 text-zinc-500" data-label="Month">{p.month_covered || '-'}</td>
                          <td className="px-4 py-3 text-right actions-cell" data-label="">
                            <button onClick={() => handleDeletePayment(p.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <LodgerFormModal
        isOpen={lodgerOpen}
        editingLodger={editingLodger}
        onClose={() => { setLodgerOpen(false); setEditingLodger(null); }}
        onSaved={() => { setLodgerOpen(false); setEditingLodger(null); fetchAll(); }}
      />
      <PaymentModal
        isOpen={paymentOpen}
        lodgers={lodgers}
        onClose={() => setPaymentOpen(false)}
        onSaved={() => { setPaymentOpen(false); fetchAll(); }}
      />
    </div>
  );
};

// ── KPI Card ──────────────────────────────────────────────────────────────────

const KpiCard: React.FC<{ label: string; value: string; Icon: React.ComponentType<{ size?: number }>; danger?: boolean }> = ({ label, value, Icon, danger }) => (
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

// ── Lodger Form Modal ─────────────────────────────────────────────────────────

const LodgerFormModal: React.FC<{
  isOpen: boolean;
  editingLodger: Lodger | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ isOpen, editingLodger, onClose, onSaved }) => {
  const { showToast } = useToast();
  const isEdit = !!editingLodger;
  const [fullName, setFullName] = useState(editingLodger?.full_name ?? '');
  const [phoneNumber, setPhoneNumber] = useState(editingLodger?.phone_number ?? '');
  const [idNumber, setIdNumber] = useState(editingLodger?.id_number ?? '');
  const [room, setRoom] = useState(editingLodger?.room_number ?? '');
  const [deposit, setDeposit] = useState(editingLodger ? String(editingLodger.deposit_amount) : '');
  const [amountPaid, setAmountPaid] = useState(editingLodger ? String(editingLodger.amount_paid) : '');
  const [expectedDays, setExpectedDays] = useState(editingLodger ? String(editingLodger.expected_duration_days ?? 1) : '1');
  const [status, setStatus] = useState(editingLodger?.status ?? 'ACTIVE');
  const [checkinDate, setCheckinDate] = useState(editingLodger?.checkin_date ?? new Date().toISOString().slice(0, 10));
  const [checkoutDate, setCheckoutDate] = useState(editingLodger?.checkout_date ?? '');
  const [notes, setNotes] = useState(editingLodger?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body: any = {
        full_name: fullName,
        phone_number: phoneNumber || undefined,
        id_number: idNumber || undefined,
        room_number: room,
        deposit_amount: Number(deposit) || 0,
        amount_paid: Number(amountPaid) || 0,
        expected_duration_days: Number(expectedDays) || 1,
        status,
        checkin_date: checkinDate,
        checkout_date: checkoutDate || null,
        notes: notes || undefined,
      };
      const res = await fetch(`${API}?resource=lodgers${isEdit ? `&id=${editingLodger!.id}` : ''}`, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed');
      showToast(isEdit ? 'Lodger updated' : 'Lodger added', 'success');
      onSaved();
    } catch {
      showToast('Failed to save', 'error');
    } finally { setSaving(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Lodger' : 'Add Lodger'} label="Lodgers" size="md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="lodger-form" isLoading={saving}>{isEdit ? 'Save Changes' : 'Add Lodger'}</Button>
        </div>
      }
    >
      <form id="lodger-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Personal Details */}
        <section>
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-400">Personal Details</h3>
            <div className="space-y-3">
            <TextInput id="lodger-name" labelText="Full Name *" value={fullName} onChange={e => setFullName(e.target.value)} required placeholder="Full name" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput id="lodger-phone" labelText="Phone" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="+264 81 123 4567" />
              <TextInput id="lodger-id" labelText="ID Number" value={idNumber} onChange={e => setIdNumber(e.target.value)} placeholder="National ID" />
            </div>            </div>
          </div>
        </section>

        {/* Accommodation Details */}
        <section>
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-400">Accommodation Details</h3>
            <div className="space-y-3">
            <TextInput id="lodger-room" labelText="Room Number *" value={room} onChange={e => setRoom(e.target.value)} required placeholder="e.g. 12A" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput id="lodger-checkin" type="date" labelText="Check-in Date" value={checkinDate} onChange={e => setCheckinDate(e.target.value)} />
              <TextInput id="lodger-checkout" type="date" labelText="Check-out Date" value={checkoutDate} onChange={e => setCheckoutDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput id="lodger-days" type="number" min="1" labelText="Expected Duration (days)" value={expectedDays} onChange={e => setExpectedDays(e.target.value)} />
              <Select id="lodger-status" labelText="Status" value={status} onChange={e => setStatus(e.target.value)}>
                <SelectItem value="ACTIVE" text="Active" />
                <SelectItem value="CHECKED_OUT" text="Checked Out" />
              </Select>
            </div>            </div>
          </div>
        </section>

        {/* Financial Details */}
        <section>
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-400">Financial Details</h3>
            <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput id="lodger-deposit" type="number" step="0.01" min="0" labelText="Deposit Amount" value={deposit} onChange={e => setDeposit(e.target.value)} />
              <TextInput id="lodger-paid" type="number" step="0.01" min="0" labelText="Amount Paid" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} />
            </div>            </div>
          </div>
        </section>

        {/* Notes */}
        <section>
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-400">Notes</h3>
            <TextArea id="lodger-notes" labelText="Notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" />
          </div>
        </section>
      </form>
    </Modal>
  );
};

// ── Payment Modal ─────────────────────────────────────────────────────────────

const PaymentModal: React.FC<{
  isOpen: boolean;
  lodgers: Lodger[];
  onClose: () => void;
  onSaved: () => void;
}> = ({ isOpen, lodgers, onClose, onSaved }) => {
  const { showToast } = useToast();
  const [lodgerId, setLodgerId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [monthCovered, setMonthCovered] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lodgerId) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}?resource=payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lodger_id: lodgerId, amount: Number(amount),
          payment_method: method, payment_date: date,
          month_covered: monthCovered || undefined, notes: notes || undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      showToast('Payment recorded', 'success');
      onSaved();
    } catch { showToast('Failed to record payment', 'error');
    } finally { setSaving(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record Payment" label="Lodgers" size="sm"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="payment-form" isLoading={saving}>Record Payment</Button>
        </div>
      }
    >
      <form id="payment-form" onSubmit={handleSubmit} className="space-y-4">
        <section>
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-400">Payment Details</h3>
            <div className="space-y-3">
            <Select id="pay-lodger" labelText="Lodger *" value={lodgerId} onChange={e => setLodgerId(e.target.value)} required>
              <SelectItem value="" text="Select lodger" />
              {lodgers.filter(l => l.status === 'ACTIVE').map(l => (
                <SelectItem key={l.id} value={l.id} text={`${l.full_name}${l.room_number ? ` (Room ${l.room_number})` : ''}`} />
              ))}
            </Select>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput id="pay-amount" type="number" step="0.01" min="0.01" labelText="Amount *" value={amount} onChange={e => setAmount(e.target.value)} required />
              <Select id="pay-method" labelText="Payment Method" value={method} onChange={e => setMethod(e.target.value)}>
                <SelectItem value="Cash" text="Cash" />
                <SelectItem value="EcoCash" text="EcoCash" />
                <SelectItem value="Bank Transfer" text="Bank Transfer" />
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput id="pay-date" type="date" labelText="Date" value={date} onChange={e => setDate(e.target.value)} />
              <TextInput id="pay-month" labelText="Month Covered" value={monthCovered} onChange={e => setMonthCovered(e.target.value)} placeholder="e.g. June 2026" />
            </div>
            <TextArea id="pay-notes" labelText="Notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" />
            </div>
          </div>
        </section>
      </form>
    </Modal>
  );
};

export default Lodgers;
