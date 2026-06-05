import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, RefreshCw, Store } from 'lucide-react';
import { authFetch } from '../services/authFetch';
import { useToast } from './Toast';
import { Button, Modal, TextInput, Select, SelectItem, TextArea, Tag } from './ui';

const API = '/api/rentals';
const CURRENCIES = ['USD', 'GBP', 'NAD', 'ZAR', 'BWP'] as const;
const METHODS = ['Cash', 'Bank Transfer', 'EFT', 'Mobile Money', 'Cheque', 'Other'] as const;
const UNIT_STATUSES = ['available', 'occupied', 'maintenance'] as const;

type Tab = 'overview' | 'units' | 'tenants' | 'payments';

interface Stats {
  total_units: number; occupied: number; available: number; maintenance: number;
  expected_monthly: number; collected_this_month: number; arrears_count: number;
}
interface Tenant {
  id: string; name: string; business_name?: string; phone?: string;
  email?: string; id_number?: string; notes?: string;
  unit_number?: string; unit_name?: string;
}
interface Unit {
  id: string; unit_number: string; name?: string; location?: string;
  monthly_rent: number; currency: string; status: string;
  tenant_id?: string; tenant_name?: string; tenant_business?: string;
  start_date?: string; notes?: string;
}
interface Payment {
  id: string; unit_id: string; tenant_id?: string; amount: number; currency: string;
  payment_date: string; month_covered: string; payment_method: string; notes?: string;
  unit_number?: string; unit_name?: string; tenant_name?: string;
}

const fmt = (n: number, c = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: c, minimumFractionDigits: 2 }).format(n);

const statusColor: Record<string, 'green' | 'red' | 'warm-gray'> = {
  occupied: 'green', available: 'teal' as any, maintenance: 'warm-gray',
};

// ── KPI Card ────────────────────────────────────────────────────────────────
const KpiCard: React.FC<{ label: string; value: React.ReactNode; sub?: string; accent?: string }> = ({ label, value, sub, accent = '#D97706' }) => (
  <div className="relative rounded-xl border border-stone-200 bg-white p-4 pl-5 overflow-hidden">
    <span className="absolute inset-y-0 left-0 w-1 rounded-l-xl" style={{ background: accent }} />
    <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">{label}</p>
    <p className="mt-1 text-2xl font-bold tabular-nums text-zinc-900">{value}</p>
    {sub && <p className="mt-0.5 text-xs text-zinc-400">{sub}</p>}
  </div>
);

// ── Main Component ───────────────────────────────────────────────────────────
export const Rentals: React.FC = () => {
  const { showToast } = useToast();
  const [tab, setTab]           = useState<Tab>('overview');
  const [loading, setLoading]   = useState(true);
  const [stats, setStats]       = useState<Stats | null>(null);
  const [units, setUnits]       = useState<Unit[]>([]);
  const [tenants, setTenants]   = useState<Tenant[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  const [unitOpen, setUnitOpen]       = useState(false);
  const [tenantOpen, setTenantOpen]   = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [editUnit, setEditUnit]       = useState<Unit | null>(null);
  const [editTenant, setEditTenant]   = useState<Tenant | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, u, t, p] = await Promise.all([
        authFetch(`${API}?resource=stats`).then(r => r.json()),
        authFetch(`${API}?resource=units`).then(r => r.json()),
        authFetch(`${API}?resource=tenants`).then(r => r.json()),
        authFetch(`${API}?resource=payments`).then(r => r.json()),
      ]);
      setStats(s); setUnits(u); setTenants(t); setPayments(p);
    } catch { showToast('Failed to load data', 'error'); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const deleteUnit    = async (id: string) => { await authFetch(`${API}?resource=units&id=${id}`, { method: 'DELETE' }); showToast('Unit removed', 'success'); load(); };
  const deleteTenant  = async (id: string) => { await authFetch(`${API}?resource=tenants&id=${id}`, { method: 'DELETE' }); showToast('Tenant removed', 'success'); load(); };
  const deletePayment = async (id: string) => { await authFetch(`${API}?resource=payments&id=${id}`, { method: 'DELETE' }); showToast('Payment removed', 'success'); load(); };

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'units',    label: `Units (${units.length})` },
    { id: 'tenants',  label: `Tenants (${tenants.length})` },
    { id: 'payments', label: 'Payments' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
            <Store size={20} className="text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Shop Rentals</h1>
            <p className="text-sm text-zinc-500">Manage commercial units, tenants and rent payments</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-700 transition-colors">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b border-stone-200">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={['flex items-center px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                tab === t.id ? 'border-amber-500 text-amber-600' : 'border-transparent text-zinc-500 hover:text-zinc-800'].join(' ')}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Overview ── */}
      {tab === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard label="Total Units"       value={stats?.total_units ?? '—'} />
            <KpiCard label="Occupied"          value={stats?.occupied ?? '—'}    accent="#10b981" />
            <KpiCard label="Available"         value={stats?.available ?? '—'}   accent="#6366f1" />
            <KpiCard label="Maintenance"       value={stats?.maintenance ?? '—'} accent="#f59e0b" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <KpiCard label="Expected Monthly"    value={stats ? fmt(stats.expected_monthly) : '—'}     sub="From occupied units" accent="#D97706" />
            <KpiCard label="Collected This Month" value={stats ? fmt(stats.collected_this_month) : '—'} sub="Payments received"    accent="#10b981" />
            <KpiCard label="Units in Arrears"    value={stats?.arrears_count ?? '—'}                   sub="No payment this month" accent="#ef4444" />
          </div>

          {/* Quick units list */}
          <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-stone-100">
              <p className="text-sm font-semibold text-zinc-900">All Units</p>
              <Button size="sm" variant="primary" leftIcon={<Plus size={14} />} onClick={() => { setEditUnit(null); setUnitOpen(true); }}>Add Unit</Button>
            </div>
            {loading ? (
              <p className="py-8 text-center text-sm text-zinc-400">Loading…</p>
            ) : units.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-400">No units yet. Add your first shop unit above.</p>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-stone-100 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  <th className="px-5 py-3">Unit</th>
                  <th className="px-5 py-3">Tenant</th>
                  <th className="px-5 py-3">Rent</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3" />
                </tr></thead>
                <tbody className="divide-y divide-stone-100">
                  {units.map(u => (
                    <tr key={u.id} className="hover:bg-stone-50/50">
                      <td className="px-5 py-3">
                        <p className="font-semibold text-zinc-900">{u.unit_number}</p>
                        {u.name && <p className="text-xs text-zinc-400">{u.name}</p>}
                        {u.location && <p className="text-xs text-zinc-400">{u.location}</p>}
                      </td>
                      <td className="px-5 py-3">{u.tenant_name ? <><p className="font-medium text-zinc-800">{u.tenant_name}</p>{u.tenant_business && <p className="text-xs text-zinc-400">{u.tenant_business}</p>}</> : <span className="text-zinc-400">—</span>}</td>
                      <td className="px-5 py-3 tabular-nums font-medium text-zinc-800">{fmt(u.monthly_rent, u.currency)}<span className="text-xs text-zinc-400">/mo</span></td>
                      <td className="px-5 py-3"><Tag type={statusColor[u.status] ?? 'warm-gray'}>{u.status}</Tag></td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setEditUnit(u); setUnitOpen(true); }} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-amber-50 hover:text-amber-600 transition-colors"><Pencil size={13} /></button>
                          <button onClick={() => deleteUnit(u.id)} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Units tab ── */}
      {tab === 'units' && (
        <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-stone-100">
            <p className="text-sm font-semibold text-zinc-900">Shop Units</p>
            <Button size="sm" variant="primary" leftIcon={<Plus size={14} />} onClick={() => { setEditUnit(null); setUnitOpen(true); }}>Add Unit</Button>
          </div>
          {loading ? <p className="py-8 text-center text-sm text-zinc-400">Loading…</p> : units.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-400">No units yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-stone-100 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                <th className="px-5 py-3">Unit No.</th><th className="px-5 py-3">Name / Location</th>
                <th className="px-5 py-3">Tenant</th><th className="px-5 py-3">Monthly Rent</th>
                <th className="px-5 py-3">Status</th><th className="px-5 py-3" />
              </tr></thead>
              <tbody className="divide-y divide-stone-100">
                {units.map(u => (
                  <tr key={u.id} className="hover:bg-stone-50/50">
                    <td className="px-5 py-3 font-semibold text-zinc-900">{u.unit_number}</td>
                    <td className="px-5 py-3"><p className="text-zinc-800">{u.name || '—'}</p>{u.location && <p className="text-xs text-zinc-400">{u.location}</p>}</td>
                    <td className="px-5 py-3">{u.tenant_name ? <><p className="font-medium text-zinc-800">{u.tenant_name}</p>{u.tenant_business && <p className="text-xs text-zinc-400">{u.tenant_business}</p>}</> : <span className="text-zinc-400">Vacant</span>}</td>
                    <td className="px-5 py-3 tabular-nums">{fmt(u.monthly_rent, u.currency)}<span className="text-xs text-zinc-400">/mo</span></td>
                    <td className="px-5 py-3"><Tag type={statusColor[u.status] ?? 'warm-gray'}>{u.status}</Tag></td>
                    <td className="px-5 py-3"><div className="flex gap-1">
                      <button onClick={() => { setEditUnit(u); setUnitOpen(true); }} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-amber-50 hover:text-amber-600"><Pencil size={13} /></button>
                      <button onClick={() => deleteUnit(u.id)} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-500"><Trash2 size={13} /></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Tenants tab ── */}
      {tab === 'tenants' && (
        <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-stone-100">
            <p className="text-sm font-semibold text-zinc-900">Tenants</p>
            <Button size="sm" variant="primary" leftIcon={<Plus size={14} />} onClick={() => { setEditTenant(null); setTenantOpen(true); }}>Add Tenant</Button>
          </div>
          {loading ? <p className="py-8 text-center text-sm text-zinc-400">Loading…</p> : tenants.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-400">No tenants yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-stone-100 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                <th className="px-5 py-3">Name</th><th className="px-5 py-3">Business</th>
                <th className="px-5 py-3">Contact</th><th className="px-5 py-3">Unit</th><th className="px-5 py-3" />
              </tr></thead>
              <tbody className="divide-y divide-stone-100">
                {tenants.map(t => (
                  <tr key={t.id} className="hover:bg-stone-50/50">
                    <td className="px-5 py-3 font-medium text-zinc-900">{t.name}{t.id_number && <p className="text-xs text-zinc-400">ID: {t.id_number}</p>}</td>
                    <td className="px-5 py-3 text-zinc-700">{t.business_name || '—'}</td>
                    <td className="px-5 py-3"><p className="text-zinc-700">{t.phone || '—'}</p>{t.email && <p className="text-xs text-zinc-400">{t.email}</p>}</td>
                    <td className="px-5 py-3">{t.unit_number ? <span className="font-medium text-amber-600">{t.unit_number}</span> : <span className="text-zinc-400">—</span>}</td>
                    <td className="px-5 py-3"><div className="flex gap-1">
                      <button onClick={() => { setEditTenant(t); setTenantOpen(true); }} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-amber-50 hover:text-amber-600"><Pencil size={13} /></button>
                      <button onClick={() => deleteTenant(t.id)} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-500"><Trash2 size={13} /></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Payments tab ── */}
      {tab === 'payments' && (
        <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-stone-100">
            <p className="text-sm font-semibold text-zinc-900">Rent Payments</p>
            <Button size="sm" variant="primary" leftIcon={<Plus size={14} />} onClick={() => setPaymentOpen(true)}>Record Payment</Button>
          </div>
          {loading ? <p className="py-8 text-center text-sm text-zinc-400">Loading…</p> : payments.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-400">No payments recorded yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-stone-100 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                <th className="px-5 py-3">Date</th><th className="px-5 py-3">Unit</th>
                <th className="px-5 py-3">Tenant</th><th className="px-5 py-3">Month</th>
                <th className="px-5 py-3">Amount</th><th className="px-5 py-3">Method</th><th className="px-5 py-3" />
              </tr></thead>
              <tbody className="divide-y divide-stone-100">
                {payments.map(p => (
                  <tr key={p.id} className="hover:bg-stone-50/50">
                    <td className="px-5 py-3 text-zinc-700">{p.payment_date}</td>
                    <td className="px-5 py-3 font-semibold text-zinc-900">{p.unit_number}</td>
                    <td className="px-5 py-3 text-zinc-700">{p.tenant_name || '—'}</td>
                    <td className="px-5 py-3 text-zinc-700">{p.month_covered}</td>
                    <td className="px-5 py-3 font-semibold tabular-nums text-emerald-700">{fmt(p.amount, p.currency)}</td>
                    <td className="px-5 py-3 text-zinc-500">{p.payment_method}</td>
                    <td className="px-5 py-3"><button onClick={() => deletePayment(p.id)} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-500"><Trash2 size={13} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Modals ── */}
      <UnitModal
        isOpen={unitOpen}
        editing={editUnit}
        tenants={tenants}
        onClose={() => { setUnitOpen(false); setEditUnit(null); }}
        onSaved={() => { setUnitOpen(false); setEditUnit(null); load(); }}
      />
      <TenantModal
        isOpen={tenantOpen}
        editing={editTenant}
        onClose={() => { setTenantOpen(false); setEditTenant(null); }}
        onSaved={() => { setTenantOpen(false); setEditTenant(null); load(); }}
      />
      <PaymentModal
        isOpen={paymentOpen}
        units={units}
        onClose={() => setPaymentOpen(false)}
        onSaved={() => { setPaymentOpen(false); load(); }}
      />
    </div>
  );
};

// ── Unit Modal ───────────────────────────────────────────────────────────────
const UnitModal: React.FC<{ isOpen: boolean; editing: Unit | null; tenants: Tenant[]; onClose: () => void; onSaved: () => void }> = ({ isOpen, editing, tenants, onClose, onSaved }) => {
  const { showToast } = useToast();
  const [unitNumber, setUnitNumber] = useState('');
  const [name, setName]             = useState('');
  const [location, setLocation]     = useState('');
  const [rent, setRent]             = useState('');
  const [currency, setCurrency]     = useState('USD');
  const [status, setStatus]         = useState<string>('available');
  const [tenantId, setTenantId]     = useState('');
  const [startDate, setStartDate]   = useState('');
  const [notes, setNotes]           = useState('');
  const [loading, setLoading]       = useState(false);

  useEffect(() => {
    if (isOpen) {
      setUnitNumber(editing?.unit_number ?? '');
      setName(editing?.name ?? '');
      setLocation(editing?.location ?? '');
      setRent(editing ? String(editing.monthly_rent) : '');
      setCurrency(editing?.currency ?? 'USD');
      setStatus(editing?.status ?? 'available');
      setTenantId(editing?.tenant_id ?? '');
      setStartDate(editing?.start_date ?? '');
      setNotes(editing?.notes ?? '');
    }
  }, [isOpen, editing]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const body = { unit_number: unitNumber, name: name || undefined, location: location || undefined, monthly_rent: parseFloat(rent) || 0, currency, status, tenant_id: tenantId || null, start_date: startDate || null, notes: notes || undefined };
      const url  = editing ? `${API}?resource=units&id=${editing.id}` : `${API}?resource=units`;
      const res  = await authFetch(url, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(body) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      showToast(editing ? 'Unit updated' : 'Unit added', 'success');
      onSaved();
    } catch (err: any) { showToast(err.message || 'Failed', 'error'); }
    finally { setLoading(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editing ? 'Edit Unit' : 'Add Shop Unit'} label="Rentals" size="sm"
      footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="unit-form" isLoading={loading}>{editing ? 'Save' : 'Add Unit'}</Button></div>}>
      <form id="unit-form" onSubmit={submit} className="space-y-3">
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <TextInput id="u-num"  labelText="Unit Number *" value={unitNumber} onChange={e => setUnitNumber(e.target.value)} required placeholder="e.g. A1" />
            <TextInput id="u-name" labelText="Name"          value={name}       onChange={e => setName(e.target.value)}       placeholder="e.g. Corner Shop" />
          </div>
          <TextInput id="u-loc" labelText="Location" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Ground Floor, Block B" />
        </div>
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <TextInput id="u-rent" type="number" step="0.01" min="0" labelText="Monthly Rent *" value={rent} onChange={e => setRent(e.target.value)} required placeholder="0.00" />
            <Select id="u-cur" labelText="Currency" value={currency} onChange={e => setCurrency(e.target.value)}>
              {CURRENCIES.map(c => <SelectItem key={c} value={c} text={c} />)}
            </Select>
          </div>
          <Select id="u-status" labelText="Status" value={status} onChange={e => setStatus(e.target.value)}>
            {UNIT_STATUSES.map(s => <SelectItem key={s} value={s} text={s.charAt(0).toUpperCase() + s.slice(1)} />)}
          </Select>
        </div>
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 space-y-3">
          <Select id="u-tenant" labelText="Assign Tenant" value={tenantId} onChange={e => setTenantId(e.target.value)}>
            <SelectItem value="" text="— Vacant —" />
            {tenants.map(t => <SelectItem key={t.id} value={t.id} text={t.business_name ? `${t.name} (${t.business_name})` : t.name} />)}
          </Select>
          <TextInput id="u-start" type="date" labelText="Occupancy Start Date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <TextArea id="u-notes" labelText="Notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional notes…" />
      </form>
    </Modal>
  );
};

// ── Tenant Modal ─────────────────────────────────────────────────────────────
const TenantModal: React.FC<{ isOpen: boolean; editing: Tenant | null; onClose: () => void; onSaved: () => void }> = ({ isOpen, editing, onClose, onSaved }) => {
  const { showToast } = useToast();
  const [name, setBiz]          = useState('');
  const [bizName, setBizName]   = useState('');
  const [phone, setPhone]       = useState('');
  const [email, setEmail]       = useState('');
  const [idNum, setIdNum]       = useState('');
  const [notes, setNotes]       = useState('');
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    if (isOpen) {
      setBiz(editing?.name ?? '');
      setBizName(editing?.business_name ?? '');
      setPhone(editing?.phone ?? '');
      setEmail(editing?.email ?? '');
      setIdNum(editing?.id_number ?? '');
      setNotes(editing?.notes ?? '');
    }
  }, [isOpen, editing]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const body = { name, business_name: bizName || undefined, phone: phone || undefined, email: email || undefined, id_number: idNum || undefined, notes: notes || undefined };
      const url  = editing ? `${API}?resource=tenants&id=${editing.id}` : `${API}?resource=tenants`;
      const res  = await authFetch(url, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(body) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      showToast(editing ? 'Tenant updated' : 'Tenant added', 'success');
      onSaved();
    } catch (err: any) { showToast(err.message || 'Failed', 'error'); }
    finally { setLoading(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editing ? 'Edit Tenant' : 'Add Tenant'} label="Rentals" size="sm"
      footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="tenant-form" isLoading={loading}>{editing ? 'Save' : 'Add Tenant'}</Button></div>}>
      <form id="tenant-form" onSubmit={submit} className="space-y-3">
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 space-y-3">
          <TextInput id="t-name"    labelText="Full Name *"    value={name}    onChange={e => setBiz(e.target.value)}     required placeholder="Tenant full name" />
          <TextInput id="t-biz"     labelText="Business Name"  value={bizName} onChange={e => setBizName(e.target.value)} placeholder="Trading as…" />
        </div>
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <TextInput id="t-phone" labelText="Phone"    value={phone} onChange={e => setPhone(e.target.value)}  placeholder="+263…" />
            <TextInput id="t-email" labelText="Email"    value={email} onChange={e => setEmail(e.target.value)}  placeholder="email@…" />
          </div>
          <TextInput id="t-id"    labelText="ID / Passport No." value={idNum} onChange={e => setIdNum(e.target.value)} placeholder="National ID or passport" />
        </div>
        <TextArea id="t-notes" labelText="Notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes about this tenant…" />
      </form>
    </Modal>
  );
};

// ── Payment Modal ─────────────────────────────────────────────────────────────
const PaymentModal: React.FC<{ isOpen: boolean; units: Unit[]; onClose: () => void; onSaved: () => void }> = ({ isOpen, units, onClose, onSaved }) => {
  const { showToast }   = useToast();
  const today           = new Date().toISOString().slice(0, 10);
  const currentMonth    = today.slice(0, 7);
  const [unitId, setUnitId]       = useState('');
  const [amount, setAmount]       = useState('');
  const [currency, setCurrency]   = useState('USD');
  const [date, setDate]           = useState(today);
  const [month, setMonth]         = useState(currentMonth);
  const [method, setMethod]       = useState('Cash');
  const [notes, setNotes]         = useState('');
  const [loading, setLoading]     = useState(false);

  useEffect(() => { if (isOpen) { setUnitId(''); setAmount(''); setDate(today); setMonth(currentMonth); setMethod('Cash'); setNotes(''); } }, [isOpen]);

  const selectedUnit = units.find(u => u.id === unitId);
  useEffect(() => { if (selectedUnit) { setAmount(String(selectedUnit.monthly_rent)); setCurrency(selectedUnit.currency); } }, [unitId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const body = { unit_id: unitId, tenant_id: selectedUnit?.tenant_id || null, amount: parseFloat(amount), currency, payment_date: date, month_covered: month, payment_method: method, notes: notes || undefined };
      const res  = await authFetch(`${API}?resource=payments`, { method: 'POST', body: JSON.stringify(body) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      showToast('Payment recorded', 'success');
      onSaved();
    } catch (err: any) { showToast(err.message || 'Failed', 'error'); }
    finally { setLoading(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record Rent Payment" label="Rentals" size="sm"
      footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="payment-form" isLoading={loading}>Record Payment</Button></div>}>
      <form id="payment-form" onSubmit={submit} className="space-y-3">
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 space-y-3">
          <Select id="p-unit" labelText="Shop Unit *" value={unitId} onChange={e => setUnitId(e.target.value)} required>
            <SelectItem value="" text="Select unit…" />
            {units.map(u => <SelectItem key={u.id} value={u.id} text={`${u.unit_number}${u.name ? ` — ${u.name}` : ''}${u.tenant_name ? ` (${u.tenant_name})` : ''}`} />)}
          </Select>
        </div>
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <TextInput id="p-amt"  type="number" step="0.01" min="0.01" labelText="Amount *" value={amount} onChange={e => setAmount(e.target.value)} required placeholder="0.00" />
            <Select id="p-cur" labelText="Currency" value={currency} onChange={e => setCurrency(e.target.value)}>
              {CURRENCIES.map(c => <SelectItem key={c} value={c} text={c} />)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextInput id="p-date"  type="date"  labelText="Payment Date"   value={date}  onChange={e => setDate(e.target.value)} />
            <TextInput id="p-month" type="month" labelText="Month Covered"  value={month} onChange={e => setMonth(e.target.value)} />
          </div>
          <Select id="p-method" labelText="Payment Method" value={method} onChange={e => setMethod(e.target.value)}>
            {METHODS.map(m => <SelectItem key={m} value={m} text={m} />)}
          </Select>
        </div>
        <TextArea id="p-notes" labelText="Notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Receipt number, remarks…" />
      </form>
    </Modal>
  );
};

export default Rentals;
