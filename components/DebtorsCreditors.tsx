import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, RefreshCw, ChevronRight, ChevronLeft, Scale, CreditCard, Clock } from 'lucide-react';
import { authFetch } from '../services/authFetch';
import { useToast } from './Toast';
import { Button, Modal, TextInput, Select, SelectItem, TextArea } from './ui';

const API = '/api/debtors-creditors';
const CURRENCIES = ['USD', 'GBP', 'NAD', 'ZAR', 'BWP'] as const;
const DEBTOR_TYPES = ['client', 'dealer', 'individual', 'supplier', 'other'] as const;

type Side = 'debtors' | 'creditors';

interface Stats {
  debtors:  { total_outstanding: number; open_entries: number; overdue_count: number; overdue_amount: number; storage_fee_entries: number };
  creditors:{ total_outstanding: number; open_entries: number; overdue_count: number; overdue_amount: number };
}
interface Party {
  id: string; name: string; type?: string; contact_name?: string; phone?: string;
  email?: string; address?: string; notes?: string; outstanding: number; open_entries: number;
}
interface Entry {
  id: string; debtor_id?: string; creditor_id?: string; debtor_name?: string; creditor_name?: string;
  debtor_type?: string; description: string; reference?: string;
  amount: number; currency: string; due_date?: string; paid_amount: number; status: string;
  storage_fee_per_day?: number | null; storage_fee_start_date?: string | null;
  accumulated_storage_fee: number; total_owed: number; notes?: string; created_at: string;
}

const fmt = (n: number, c = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: c, minimumFractionDigits: 2 }).format(n);

const statusColor: Record<string, string> = {
  unpaid:      'bg-red-100 text-red-700',
  partial:     'bg-amber-100 text-amber-700',
  paid:        'bg-emerald-100 text-emerald-700',
  written_off: 'bg-zinc-100 text-zinc-500',
};

const typeColor: Record<string, string> = {
  client:     'bg-blue-100 text-blue-700',
  dealer:     'bg-purple-100 text-purple-700',
  individual: 'bg-amber-100 text-amber-700',
  supplier:   'bg-teal-100 text-teal-700',
  other:      'bg-zinc-100 text-zinc-500',
};

const KpiCard: React.FC<{ label: string; value: React.ReactNode; sub?: string; accent: string }> = ({ label, value, sub, accent }) => (
  <div className="relative rounded-xl border border-stone-200 bg-white p-4 pl-5 overflow-hidden">
    <span className="absolute inset-y-0 left-0 w-1 rounded-l-xl" style={{ background: accent }} />
    <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">{label}</p>
    <p className="mt-1 text-2xl font-bold tabular-nums text-zinc-900">{value}</p>
    {sub && <p className="mt-0.5 text-xs text-zinc-400">{sub}</p>}
  </div>
);

export const DebtorsCreditors: React.FC = () => {
  const { showToast } = useToast();
  const [side, setSide]             = useState<Side>('debtors');
  const [stats, setStats]           = useState<Stats | null>(null);
  const [parties, setParties]       = useState<Party[]>([]);
  const [allEntries, setAllEntries] = useState<Entry[]>([]);
  const [selected, setSelected]     = useState<Party | null>(null);
  const [entries, setEntries]       = useState<Entry[]>([]);
  const [loading, setLoading]       = useState(true);

  const [partyOpen, setPartyOpen]   = useState(false);
  const [editParty, setEditParty]   = useState<Party | null>(null);
  const [entryOpen, setEntryOpen]   = useState(false);
  const [editEntry, setEditEntry]   = useState<Entry | null>(null);
  const [payOpen, setPayOpen]       = useState(false);
  const [payEntry, setPayEntry]     = useState<Entry | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, p, e] = await Promise.all([
        authFetch(`${API}?resource=stats`).then(r => r.json()),
        authFetch(`${API}?resource=${side}`).then(r => r.json()),
        authFetch(`${API}?resource=${side === 'debtors' ? 'debtor-entries' : 'creditor-entries'}`).then(r => r.json()),
      ]);
      setStats(s);
      setParties(Array.isArray(p) ? p : []);
      setAllEntries(Array.isArray(e) ? e : []);
    } catch { showToast('Failed to load data', 'error'); }
    finally { setLoading(false); }
  }, [side, showToast]);

  useEffect(() => { setSelected(null); load(); }, [load]);

  useEffect(() => {
    if (!selected) { setEntries(allEntries); return; }
    const key = side === 'debtors' ? 'debtor_id' : 'creditor_id';
    setEntries(allEntries.filter(e => (e as any)[key] === selected.id));
  }, [selected, allEntries, side]);

  const deleteParty = async (id: string) => {
    await authFetch(`${API}?resource=${side}&id=${id}`, { method: 'DELETE' });
    showToast('Removed', 'success'); load();
  };
  const deleteEntry = async (id: string) => {
    const res = side === 'debtors' ? 'debtor-entries' : 'creditor-entries';
    await authFetch(`${API}?resource=${res}&id=${id}`, { method: 'DELETE' });
    showToast('Entry removed', 'success'); load();
  };

  const st = side === 'debtors' ? stats?.debtors : stats?.creditors;
  const accent = side === 'debtors' ? '#10b981' : '#ef4444';
  const partyLabel = side === 'debtors' ? 'Debtor' : 'Creditor';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100">
            <Scale size={20} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Debtors & Creditors</h1>
            <p className="text-sm text-zinc-500">Track what's owed to you and what you owe</p>
          </div>
        </div>
        <button onClick={load} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-700 transition-colors">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Side switcher */}
      <div className="flex rounded-xl overflow-hidden border border-stone-200 w-fit">
        {(['debtors', 'creditors'] as Side[]).map(s => (
          <button key={s} onClick={() => setSide(s)}
            className={['px-5 py-2 text-sm font-semibold transition-colors capitalize', s === side ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-500 hover:text-zinc-800'].join(' ')}>
            {s}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Total Outstanding" value={fmt(st?.total_outstanding ?? 0)} accent={accent} sub={side === 'debtors' ? 'Incl. storage fees' : undefined} />
        <KpiCard label="Open Entries"      value={st?.open_entries ?? '—'}          accent="#6366f1" />
        <KpiCard label="Overdue Entries"   value={st?.overdue_count ?? '—'}         accent="#f59e0b" sub="Past due date" />
        {side === 'debtors'
          ? <KpiCard label="Storage Fee Active" value={(stats?.debtors.storage_fee_entries ?? '—')} accent="#8b5cf6" sub="Accumulating daily" />
          : <KpiCard label="Overdue Amount"     value={fmt(st?.overdue_amount ?? 0)}                accent="#dc2626" />
        }
      </div>

      {/* Main panel */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
        {/* Party list */}
        <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
            <p className="text-sm font-semibold text-zinc-900">{partyLabel}s</p>
            <Button size="sm" variant="primary" leftIcon={<Plus size={13} />} onClick={() => { setEditParty(null); setPartyOpen(true); }}>Add</Button>
          </div>
          {loading ? (
            <p className="py-8 text-center text-xs text-zinc-400">Loading…</p>
          ) : parties.length === 0 ? (
            <p className="py-8 text-center text-xs text-zinc-400">No {partyLabel.toLowerCase()}s yet.</p>
          ) : (
            <div className="divide-y divide-stone-100 max-h-[540px] overflow-y-auto">
              {parties.map(p => (
                <div key={p.id}
                  onClick={() => setSelected(selected?.id === p.id ? null : p)}
                  className={['flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors', selected?.id === p.id ? 'bg-indigo-50' : 'hover:bg-stone-50'].join(' ')}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-zinc-900 truncate">{p.name}</p>
                      {p.type && (
                        <span className={['shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold capitalize', typeColor[p.type] ?? 'bg-zinc-100 text-zinc-500'].join(' ')}>{p.type}</span>
                      )}
                    </div>
                    {p.contact_name && <p className="text-xs text-zinc-400 truncate">{p.contact_name}</p>}
                    <p className="text-xs font-medium text-zinc-600">{fmt(p.outstanding)} outstanding</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={e => { e.stopPropagation(); setEditParty(p); setPartyOpen(true); }} className="h-6 w-6 flex items-center justify-center rounded text-zinc-400 hover:text-amber-600 hover:bg-amber-50"><Pencil size={12} /></button>
                    <button onClick={e => { e.stopPropagation(); deleteParty(p.id); }} className="h-6 w-6 flex items-center justify-center rounded text-zinc-400 hover:text-red-500 hover:bg-red-50"><Trash2 size={12} /></button>
                    {selected?.id === p.id ? <ChevronLeft size={14} className="text-indigo-500" /> : <ChevronRight size={14} className="text-zinc-300" />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Entries panel */}
        <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
            <p className="text-sm font-semibold text-zinc-900">
              {selected ? `${selected.name} — entries` : `All ${partyLabel} Entries`}
            </p>
            {selected && <Button size="sm" variant="primary" leftIcon={<Plus size={13} />} onClick={() => { setEditEntry(null); setEntryOpen(true); }}>Add Entry</Button>}
          </div>
          {loading ? (
            <p className="py-8 text-center text-xs text-zinc-400">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="py-10 text-center text-xs text-zinc-400">
              {selected ? `No entries for ${selected.name}.` : 'No entries yet. Select a party and add entries.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-stone-100 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  {!selected && <th className="px-4 py-3">{partyLabel}</th>}
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Storage Fee</th>
                  <th className="px-4 py-3">Total Owed</th>
                  <th className="px-4 py-3">Paid</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr></thead>
                <tbody className="divide-y divide-stone-100">
                  {entries.map(e => {
                    const overdue = e.due_date && e.status !== 'paid' && e.status !== 'written_off' && new Date(e.due_date) < new Date();
                    const hasStorage = side === 'debtors' && e.storage_fee_per_day && e.storage_fee_per_day > 0;
                    return (
                      <tr key={e.id} className={['hover:bg-stone-50/50', hasStorage ? 'bg-purple-50/30' : ''].join(' ')}>
                        {!selected && (
                          <td className="px-4 py-3">
                            <p className="font-medium text-zinc-800 whitespace-nowrap">{e.debtor_name || e.creditor_name}</p>
                            {e.debtor_type && <span className={['inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold capitalize', typeColor[e.debtor_type] ?? ''].join(' ')}>{e.debtor_type}</span>}
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <p className="text-zinc-800">{e.description}</p>
                          {e.notes && <p className="text-xs text-zinc-400">{e.notes}</p>}
                        </td>
                        <td className="px-4 py-3 tabular-nums font-medium text-zinc-900 whitespace-nowrap">
                          {fmt(e.amount, e.currency)}
                          {e.reference && <p className="text-[11px] text-zinc-400">{e.reference}</p>}
                        </td>
                        <td className="px-4 py-3">
                          {hasStorage ? (
                            <div className="text-xs">
                              <div className="flex items-center gap-1 text-purple-700 font-semibold">
                                <Clock size={11} />
                                {fmt(e.accumulated_storage_fee, e.currency)}
                              </div>
                              <p className="text-zinc-400">{fmt(e.storage_fee_per_day!, e.currency)}/day</p>
                            </div>
                          ) : <span className="text-zinc-300">—</span>}
                        </td>
                        <td className="px-4 py-3 tabular-nums font-bold whitespace-nowrap" style={{ color: '#D97706' }}>
                          {fmt(e.total_owed, e.currency)}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-emerald-700 whitespace-nowrap">
                          {e.paid_amount > 0 ? fmt(e.paid_amount, e.currency) : '—'}
                        </td>
                        <td className={['px-4 py-3 text-xs whitespace-nowrap', overdue ? 'font-semibold text-red-600' : 'text-zinc-500'].join(' ')}>
                          {e.due_date ?? '—'}{overdue && ' ⚠'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={['inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize', statusColor[e.status] ?? ''].join(' ')}>{e.status.replace('_', ' ')}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {e.status !== 'paid' && e.status !== 'written_off' && (
                              <button title="Record payment" onClick={() => { setPayEntry(e); setPayOpen(true); }} className="h-7 w-7 flex items-center justify-center rounded-lg text-zinc-400 hover:bg-emerald-50 hover:text-emerald-600"><CreditCard size={13} /></button>
                            )}
                            <button onClick={() => { setEditEntry(e); setEntryOpen(true); }} className="h-7 w-7 flex items-center justify-center rounded-lg text-zinc-400 hover:bg-amber-50 hover:text-amber-600"><Pencil size={13} /></button>
                            <button onClick={() => deleteEntry(e.id)} className="h-7 w-7 flex items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-500"><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <PartyModal isOpen={partyOpen} editing={editParty} side={side}
        onClose={() => { setPartyOpen(false); setEditParty(null); }}
        onSaved={() => { setPartyOpen(false); setEditParty(null); load(); }} />
      <EntryModal isOpen={entryOpen} editing={editEntry} side={side} party={selected}
        onClose={() => { setEntryOpen(false); setEditEntry(null); }}
        onSaved={() => { setEntryOpen(false); setEditEntry(null); load(); }} />
      <PaymentModal isOpen={payOpen} entry={payEntry} side={side}
        onClose={() => { setPayOpen(false); setPayEntry(null); }}
        onSaved={() => { setPayOpen(false); setPayEntry(null); load(); }} />
    </div>
  );
};

// ── Party Modal ───────────────────────────────────────────────────────────────
const PartyModal: React.FC<{ isOpen: boolean; editing: Party | null; side: Side; onClose: () => void; onSaved: () => void }> = ({ isOpen, editing, side, onClose, onSaved }) => {
  const { showToast } = useToast();
  const [name, setName]         = useState('');
  const [type, setType]         = useState<string>('other');
  const [contact, setContact]   = useState('');
  const [phone, setPhone]       = useState('');
  const [email, setEmail]       = useState('');
  const [address, setAddress]   = useState('');
  const [notes, setNotes]       = useState('');
  const [loading, setLoading]   = useState(false);
  const label = side === 'debtors' ? 'Debtor' : 'Creditor';

  useEffect(() => {
    if (isOpen) {
      setName(editing?.name ?? ''); setType(editing?.type ?? 'other'); setContact(editing?.contact_name ?? '');
      setPhone(editing?.phone ?? ''); setEmail(editing?.email ?? ''); setAddress(editing?.address ?? ''); setNotes(editing?.notes ?? '');
    }
  }, [isOpen, editing]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      const body: Record<string, unknown> = { name, contact_name: contact || undefined, phone: phone || undefined, email: email || undefined, address: address || undefined, notes: notes || undefined };
      if (side === 'debtors') body.type = type;
      const url = editing ? `${API}?resource=${side}&id=${editing.id}` : `${API}?resource=${side}`;
      const res = await authFetch(url, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(body) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
      showToast(editing ? `${label} updated` : `${label} added`, 'success');
      onSaved();
    } catch (err: any) { showToast(err.message || 'Failed', 'error'); }
    finally { setLoading(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editing ? `Edit ${label}` : `Add ${label}`} label="Ledger" size="sm"
      footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="party-form" isLoading={loading}>{editing ? 'Save' : `Add ${label}`}</Button></div>}>
      <form id="party-form" onSubmit={submit} className="space-y-3">
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 space-y-3">
          <TextInput id="p-name" labelText="Name *" value={name} onChange={e => setName(e.target.value)} required placeholder={`${label} name or company`} />
          {side === 'debtors' && (
            <Select id="p-type" labelText="Type" value={type} onChange={e => setType(e.target.value)}>
              {DEBTOR_TYPES.map(t => <SelectItem key={t} value={t} text={t.charAt(0).toUpperCase() + t.slice(1)} />)}
            </Select>
          )}
          <TextInput id="p-contact" labelText="Contact Person" value={contact} onChange={e => setContact(e.target.value)} placeholder="Primary contact" />
        </div>
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <TextInput id="p-phone" labelText="Phone"   value={phone} onChange={e => setPhone(e.target.value)} placeholder="+263…" />
            <TextInput id="p-email" labelText="Email"   value={email} onChange={e => setEmail(e.target.value)} placeholder="email@…" />
          </div>
          <TextInput id="p-address" labelText="Address" value={address} onChange={e => setAddress(e.target.value)} placeholder="Physical / postal address" />
        </div>
        <TextArea id="p-notes" labelText="Notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional notes…" />
      </form>
    </Modal>
  );
};

// ── Entry Modal ───────────────────────────────────────────────────────────────
const EntryModal: React.FC<{ isOpen: boolean; editing: Entry | null; side: Side; party: Party | null; onClose: () => void; onSaved: () => void }> = ({ isOpen, editing, side, party, onClose, onSaved }) => {
  const { showToast } = useToast();
  const [desc, setDesc]               = useState('');
  const [ref, setRef]                 = useState('');
  const [amount, setAmount]           = useState('');
  const [currency, setCurrency]       = useState('USD');
  const [dueDate, setDueDate]         = useState('');
  const [storageFee, setStorageFee]   = useState('');
  const [storageStart, setStorageStart] = useState('');
  const [notes, setNotes]             = useState('');
  const [loading, setLoading]         = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (isOpen) {
      setDesc(editing?.description ?? ''); setRef(editing?.reference ?? '');
      setAmount(editing ? String(editing.amount) : ''); setCurrency(editing?.currency ?? 'USD');
      setDueDate(editing?.due_date ?? '');
      setStorageFee(editing?.storage_fee_per_day ? String(editing.storage_fee_per_day) : '');
      setStorageStart(editing?.storage_fee_start_date ?? '');
      setNotes(editing?.notes ?? '');
    }
  }, [isOpen, editing]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      const resource = side === 'debtors' ? 'debtor-entries' : 'creditor-entries';
      const partyKey = side === 'debtors' ? 'debtor_id' : 'creditor_id';
      const body: Record<string, unknown> = {
        description: desc, reference: ref || undefined,
        amount: parseFloat(amount), currency,
        due_date: dueDate || null, notes: notes || undefined,
      };
      if (side === 'debtors') {
        body.storage_fee_per_day   = storageFee   ? parseFloat(storageFee)  : null;
        body.storage_fee_start_date = storageStart ? storageStart            : null;
      }
      const url = editing
        ? `${API}?resource=${resource}&id=${editing.id}`
        : `${API}?resource=${resource}&${partyKey}=${party!.id}`;
      const res = await authFetch(url, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(body) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
      showToast(editing ? 'Entry updated' : 'Entry added', 'success');
      onSaved();
    } catch (err: any) { showToast(err.message || 'Failed', 'error'); }
    finally { setLoading(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editing ? 'Edit Entry' : 'Add Entry'} label="Ledger" size="sm"
      footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="entry-form" isLoading={loading}>{editing ? 'Save' : 'Add Entry'}</Button></div>}>
      <form id="entry-form" onSubmit={submit} className="space-y-3">
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 space-y-3">
          <TextInput id="e-desc" labelText="Description *" value={desc} onChange={e => setDesc(e.target.value)} required placeholder="Invoice / service description" />
          <TextInput id="e-ref"  labelText="Reference"     value={ref}  onChange={e => setRef(e.target.value)}  placeholder="Invoice #, PO #, etc." />
        </div>
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <TextInput id="e-amount" type="number" step="0.01" min="0.01" labelText="Amount *" value={amount} onChange={e => setAmount(e.target.value)} required placeholder="0.00" />
            <Select id="e-cur" labelText="Currency" value={currency} onChange={e => setCurrency(e.target.value)}>
              {CURRENCIES.map(c => <SelectItem key={c} value={c} text={c} />)}
            </Select>
          </div>
          <TextInput id="e-due" type="date" labelText="Due Date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </div>

        {/* Storage fee — debtors only */}
        {side === 'debtors' && (
          <div className="rounded-xl border border-purple-200 bg-purple-50 p-3 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock size={14} className="text-purple-600" />
              <p className="text-xs font-semibold text-purple-700">Daily Storage Fee (optional)</p>
            </div>
            <p className="text-[11px] text-purple-500">Set a daily rate that auto-accumulates until the debt is fully paid.</p>
            <div className="grid grid-cols-2 gap-3">
              <TextInput id="e-sfee" type="number" step="0.01" min="0" labelText="Rate per Day" value={storageFee} onChange={e => setStorageFee(e.target.value)} placeholder="0.00" />
              <TextInput id="e-sstart" type="date" labelText="Start Date" value={storageStart} onChange={e => setStorageStart(e.target.value)} placeholder={today} />
            </div>
          </div>
        )}

        <TextArea id="e-notes" labelText="Notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any remarks…" />
      </form>
    </Modal>
  );
};

// ── Payment Modal ─────────────────────────────────────────────────────────────
const PaymentModal: React.FC<{ isOpen: boolean; entry: Entry | null; side: Side; onClose: () => void; onSaved: () => void }> = ({ isOpen, entry, side, onClose, onSaved }) => {
  const { showToast } = useToast();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && entry) setAmount(String(entry.total_owed > 0 ? entry.total_owed.toFixed(2) : (entry.amount - entry.paid_amount).toFixed(2)));
  }, [isOpen, entry]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      const resource = side === 'debtors' ? 'debtor-payment' : 'creditor-payment';
      const res = await authFetch(`${API}?resource=${resource}&id=${entry!.id}`, { method: 'POST', body: JSON.stringify({ amount: parseFloat(amount) }) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
      showToast('Payment recorded', 'success');
      onSaved();
    } catch (err: any) { showToast(err.message || 'Failed', 'error'); }
    finally { setLoading(false); }
  };

  if (!entry) return null;
  const balance = entry.amount - entry.paid_amount;
  const hasStorage = entry.storage_fee_per_day && entry.storage_fee_per_day > 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record Payment" label="Ledger" size="sm"
      footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="pay-form" isLoading={loading}>Record</Button></div>}>
      <form id="pay-form" onSubmit={submit} className="space-y-4">
        <div className="rounded-xl bg-stone-50 border border-stone-200 p-4 space-y-2">
          <p className="text-sm font-semibold text-zinc-800">{entry.description}</p>
          {entry.reference && <p className="text-xs text-zinc-400">Ref: {entry.reference}</p>}
          <div className="grid grid-cols-2 gap-2 pt-1 text-sm">
            <div><p className="text-[11px] text-zinc-400 uppercase tracking-wide">Invoice</p><p className="font-semibold text-zinc-900">{fmt(entry.amount, entry.currency)}</p></div>
            <div><p className="text-[11px] text-zinc-400 uppercase tracking-wide">Paid so far</p><p className="font-semibold text-emerald-600">{fmt(entry.paid_amount, entry.currency)}</p></div>
            {hasStorage && (
              <div><p className="text-[11px] text-zinc-400 uppercase tracking-wide">Storage fees</p><p className="font-semibold text-purple-600">{fmt(entry.accumulated_storage_fee, entry.currency)}</p></div>
            )}
            <div><p className="text-[11px] text-zinc-400 uppercase tracking-wide">Total owed</p><p className="font-bold text-amber-600">{fmt(entry.total_owed, entry.currency)}</p></div>
          </div>
        </div>
        <TextInput id="pay-amt" type="number" step="0.01" min="0.01" labelText="Payment Amount *" value={amount} onChange={e => setAmount(e.target.value)} required />
      </form>
    </Modal>
  );
};

export default DebtorsCreditors;
