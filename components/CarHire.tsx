import { authFetch } from '../services/authFetch';
import React, { useState, useEffect, useCallback } from 'react';
import { CashHandoverPanel } from './shared/CashHandoverPanel';
import {
  RefreshCw, Plus, Car, TrendingUp, DollarSign, Calendar,
  AlertTriangle, CheckCircle, Clock, Wrench,
} from 'lucide-react';
import { Modal, Button, TextInput, Select, SelectItem, TextArea } from './ui';
import { formatCurrency } from '../utils/formatters';
import { useToast } from './Toast';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Vehicle {
  id: string;
  make_model: string;
  registration: string;
  year?: number;
  color?: string;
  daily_rate: number;
  currency: string;
  status: 'Available' | 'Hired' | 'Maintenance' | 'Inactive';
  notes?: string;
  total_hires: number;
  total_income: number;
  total_expenses: number;
}

interface Booking {
  id: string;
  vehicle_id: string;
  make_model?: string;
  registration?: string;
  hirer_name: string;
  hirer_phone?: string;
  hirer_id_number?: string;
  start_date: string;
  end_date: string;
  days: number;
  daily_rate: number;
  total_amount: number;
  amount_paid: number;
  payment_method: string;
  currency: string;
  status: 'Confirmed' | 'Active' | 'Completed' | 'Cancelled';
  notes?: string;
  created_at: string;
}

interface Expense {
  id: string;
  vehicle_id: string;
  make_model?: string;
  registration?: string;
  category: string;
  amount: number;
  currency: string;
  expense_date: string;
  description?: string;
  created_at: string;
}

interface Stats {
  month_income: number;
  month_expenses: number;
  month_net: number;
  month_hires: number;
  active_hires: number;
  total_hires: number;
  outstanding_balance: number;
}

interface MonthlyRow {
  month: string;
  income: number;
  expenses: number;
  net: number;
  hires: number;
}

type Tab = 'overview' | 'bookings' | 'expenses' | 'vehicles' | 'handover';

const API = '/api/car-hire';
const fmt = (n: number, currency = 'USD') => formatCurrency(n, currency as any);
const CURRENCIES = ['USD', 'NAD', 'ZAR', 'BWP', 'GBP'];
const PAYMENT_METHODS = ['Cash', 'EcoCash', 'Bank Transfer', 'Card', 'Other'];
const EXPENSE_CATEGORIES = ['Fuel', 'Insurance', 'Maintenance', 'Tyres', 'Licensing', 'Cleaning', 'Toll', 'Other'];
const VEHICLE_STATUSES = ['Available', 'Hired', 'Maintenance', 'Inactive'];
const BOOKING_STATUSES = ['Confirmed', 'Active', 'Completed', 'Cancelled'];

// ── Component ─────────────────────────────────────────────────────────────────

export const CarHire: React.FC = () => {
  const { showToast } = useToast();
  const [tab, setTab]             = useState<Tab>('overview');
  const [loading, setLoading]     = useState(true);
  const [stats, setStats]         = useState<Stats | null>(null);
  const [vehicles, setVehicles]   = useState<Vehicle[]>([]);
  const [bookings, setBookings]   = useState<Booking[]>([]);
  const [expenses, setExpenses]   = useState<Expense[]>([]);
  const [monthly, setMonthly]     = useState<MonthlyRow[]>([]);

  const [hireOpen, setHireOpen]         = useState(false);
  const [expenseOpen, setExpenseOpen]   = useState(false);
  const [vehicleOpen, setVehicleOpen]   = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        authFetch(`${API}?resource=stats`).then(r => { if (!r.ok) throw new Error('Stats failed'); return r.json(); }),
        authFetch(`${API}?resource=vehicles`).then(r => { if (!r.ok) throw new Error('Vehicles failed'); return r.json(); }),
        authFetch(`${API}?resource=bookings`).then(r => { if (!r.ok) throw new Error('Bookings failed'); return r.json(); }),
        authFetch(`${API}?resource=expenses`).then(r => { if (!r.ok) throw new Error('Expenses failed'); return r.json(); }),
        authFetch(`${API}?resource=monthly`).then(r => { if (!r.ok) throw new Error('Monthly failed'); return r.json(); }),
      ]);
      setStats(results[0].status === 'fulfilled' ? results[0].value : null);
      setVehicles(results[1].status === 'fulfilled' && Array.isArray(results[1].value) ? results[1].value : []);
      setBookings(results[2].status === 'fulfilled' && Array.isArray(results[2].value) ? results[2].value : []);
      setExpenses(results[3].status === 'fulfilled' && Array.isArray(results[3].value) ? results[3].value : []);
      setMonthly(results[4].status === 'fulfilled' && Array.isArray(results[4].value) ? results[4].value : []);
      const failures = results.filter(r => r.status === 'rejected');
      if (failures.length > 0) {
        showToast(`Failed to load ${failures.length} resource(s)`, 'error');
      }
    } catch {
      showToast('Failed to load Car Hire data', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDeleteBooking = async (id: string) => {
    try {
      const res = await authFetch(`${API}?resource=bookings&id=${id}`, { method: 'DELETE' });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Delete failed'); }
      showToast('Booking deleted', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete', 'error');
    }
    fetchAll();
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      const res = await authFetch(`${API}?resource=expenses&id=${id}`, { method: 'DELETE' });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Delete failed'); }
      showToast('Expense deleted', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete', 'error');
    }
    fetchAll();
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview',  label: 'Overview'  },
    { id: 'bookings',  label: 'Bookings'  },
    { id: 'expenses',  label: 'Expenses'  },
    { id: 'vehicles',  label: 'Vehicles'  },
    { id: 'handover',  label: 'Cash Handover' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Car Hiring</h1>
          <p className="mt-0.5 text-sm text-zinc-500">Hire tracking, expenses &amp; monthly P&amp;L</p>
        </div>
        <button onClick={fetchAll} className="flex items-center gap-1.5 text-sm font-medium text-[#D97706] hover:text-amber-700">
          <RefreshCw size={14} />Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Month Income"    value={fmt(stats?.month_income ?? 0)}    Icon={DollarSign} color="emerald" />
        <KpiCard label="Month Expenses"  value={fmt(stats?.month_expenses ?? 0)}  Icon={TrendingUp}  color="orange" />
        <KpiCard label="Month Net"       value={fmt(stats?.month_net ?? 0)}       Icon={TrendingUp}  color={(stats?.month_net ?? 0) >= 0 ? 'blue' : 'red'} />
        <KpiCard label="Total Hires"     value={String(stats?.total_hires ?? 0)}  Icon={Car}        color="amber" />
      </div>

      {/* Status row */}
      <div className="flex flex-wrap gap-3">
        <StatusPill label={`${stats?.active_hires ?? 0} Active`}  color="emerald" />
        <StatusPill label={`${stats?.month_hires ?? 0} This Month`} color="blue" />
        {(stats?.outstanding_balance ?? 0) > 0 && (
          <StatusPill label={`${fmt(stats!.outstanding_balance)} Outstanding`} color="amber" />
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <Button renderIcon={Plus} onClick={() => setHireOpen(true)}>Record Hire</Button>
        <Button variant="secondary" renderIcon={Plus} onClick={() => setExpenseOpen(true)}>Add Expense</Button>
        <Button variant="ghost" renderIcon={Car} onClick={() => setVehicleOpen(true)}>Manage Vehicles</Button>
      </div>

      {/* Tab Rail */}
      <div className="border-b border-stone-200">
        <div className="flex overflow-x-auto scrollbar-hide">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`shrink-0 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id ? 'border-[#D97706] text-[#D97706]' : 'border-transparent text-zinc-500 hover:text-zinc-800'
              }`}
            >{t.label}</button>
          ))}
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[1,2].map(i => (
              <div key={i} className="rounded-xl border border-stone-200 bg-white p-4">
                <div className="h-10 w-full app-shimmer rounded mb-3" />
                <div className="h-6 w-3/4 app-shimmer rounded mb-2" />
                <div className="h-4 w-1/2 app-shimmer rounded" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {tab === 'overview'  && <OverviewTab stats={stats} monthly={monthly} vehicles={vehicles} />}
          {tab === 'bookings'  && <BookingsTab bookings={bookings} onEdit={setEditingBooking} onDelete={handleDeleteBooking} />}
          {tab === 'expenses'  && <ExpensesTab expenses={expenses} onDelete={handleDeleteExpense} />}
          {tab === 'vehicles'  && <VehiclesTab vehicles={vehicles} />}
          {tab === 'handover'  && (
            <div className="rounded-xl border border-stone-200 bg-white p-4">
              <CashHandoverPanel mode="collect" />
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <RecordHireModal
        isOpen={hireOpen}
        vehicles={vehicles}
        onClose={() => setHireOpen(false)}
        onSaved={() => { setHireOpen(false); fetchAll(); }}
      />
      <AddExpenseModal
        isOpen={expenseOpen}
        vehicles={vehicles}
        onClose={() => setExpenseOpen(false)}
        onSaved={() => { setExpenseOpen(false); fetchAll(); }}
      />
      <ManageVehiclesModal
        isOpen={vehicleOpen}
        vehicles={vehicles}
        onClose={() => setVehicleOpen(false)}
        onSaved={fetchAll}
      />
      {editingBooking && (
        <EditBookingModal
          booking={editingBooking}
          onClose={() => setEditingBooking(null)}
          onSaved={() => { setEditingBooking(null); fetchAll(); }}
        />
      )}
    </div>
  );
};

// ── KPI Card ──────────────────────────────────────────────────────────────────

const colorText: Record<string, string> = {
  emerald: 'text-emerald-600', orange: 'text-orange-600',
  blue: 'text-blue-600', red: 'text-red-600', amber: 'text-amber-600',
};
const colorBg: Record<string, string> = {
  emerald: 'bg-emerald-50', orange: 'bg-orange-50',
  blue: 'bg-blue-50', red: 'bg-red-50', amber: 'bg-amber-50',
};

const KpiCard: React.FC<{
  label: string; value: string; color: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
}> = ({ label, value, color, Icon }) => (
  <div className="rounded-xl border border-stone-200 bg-white p-4">
    <div className="flex items-center gap-2">
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${colorBg[color] ?? 'bg-stone-100'}`}>
        <Icon size={16} className={colorText[color] ?? 'text-zinc-600'} />
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{label}</p>
    </div>
    <p className={`mt-3 truncate text-xl font-bold tabular-nums ${colorText[color] ?? 'text-zinc-900'}`}>{value}</p>
  </div>
);

const StatusPill: React.FC<{ label: string; color: string }> = ({ label, color }) => (
  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium
    ${color === 'emerald' ? 'bg-emerald-50 text-emerald-700' :
      color === 'blue'    ? 'bg-blue-50 text-blue-700' :
      color === 'amber'   ? 'bg-amber-50 text-amber-700' :
      'bg-stone-100 text-stone-700'}`}>
    {label}
  </span>
);

// ── Overview Tab ──────────────────────────────────────────────────────────────

const OverviewTab: React.FC<{ stats: Stats | null; monthly: MonthlyRow[]; vehicles: Vehicle[] }> = ({ stats, monthly, vehicles }) => (
  <div className="space-y-5">
    {/* Vehicle status cards */}
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {vehicles.map(v => (
        <div key={v.id} className="rounded-xl border border-stone-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-zinc-900 truncate">{v.make_model}</p>
              <p className="text-xs text-zinc-500">{v.registration} {v.year ? `· ${v.year}` : ''}</p>
            </div>
            <VehicleStatusBadge status={v.status} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">Hires</p>
              <p className="mt-0.5 text-base font-bold text-zinc-900">{v.total_hires}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">Income</p>
              <p className="mt-0.5 text-base font-bold text-emerald-600">{fmt(Number(v.total_income), v.currency)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">Expenses</p>
              <p className="mt-0.5 text-base font-bold text-orange-600">{fmt(Number(v.total_expenses), v.currency)}</p>
            </div>
          </div>
        </div>
      ))}
    </div>

    {/* Monthly P&L table */}
    {monthly.length > 0 && (
      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-stone-200 bg-stone-50">
            <tr>
              {['Month', 'Hires', 'Income', 'Expenses', 'Net P&L'].map(col => (
                <th key={col} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {monthly.map(row => (
              <tr key={row.month} className="hover:bg-stone-50">
                <td className="px-4 py-3 font-medium text-zinc-900">{row.month}</td>
                <td className="px-4 py-3 text-zinc-700">{row.hires}</td>
                <td className="px-4 py-3 text-emerald-600 font-medium">{fmt(row.income)}</td>
                <td className="px-4 py-3 text-orange-600 font-medium">{fmt(row.expenses)}</td>
                <td className={`px-4 py-3 font-bold ${row.net >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {row.net >= 0 ? '+' : ''}{fmt(row.net)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

// ── Bookings Tab ──────────────────────────────────────────────────────────────

const BookingsTab: React.FC<{
  bookings: Booking[];
  onEdit: (b: Booking) => void;
  onDelete: (id: string) => void;
}> = ({ bookings, onEdit, onDelete }) => (
  <div className="space-y-3">
    {bookings.length === 0 ? (
      <div className="py-16 text-center text-sm text-zinc-400">No hire records yet.</div>
    ) : bookings.map(b => (
      <div key={b.id} className={`rounded-xl border bg-white p-4 ${
        b.status === 'Active' ? 'border-l-4 border-l-emerald-400' :
        b.status === 'Completed' ? 'border-l-4 border-l-blue-400' :
        b.status === 'Cancelled' ? 'border-l-4 border-l-stone-300' :
        'border-l-4 border-l-amber-400'
      }`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <BookingStatusBadge status={b.status} />
              <span className="text-xs text-zinc-500">{b.start_date} → {b.end_date}</span>
              <span className="text-xs text-zinc-400">({b.days} day{b.days !== 1 ? 's' : ''})</span>
            </div>
            <p className="font-semibold text-zinc-900">{b.hirer_name}</p>
            {b.hirer_phone && <p className="text-xs text-zinc-500">{b.hirer_phone}</p>}
            <p className="mt-1 text-xs text-zinc-400">{b.make_model} · {b.registration}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-bold text-zinc-900">{fmt(Number(b.total_amount), b.currency)}</p>
            {Number(b.amount_paid) < Number(b.total_amount) && (
              <p className="text-xs text-amber-600 mt-0.5">
                Paid: {fmt(Number(b.amount_paid), b.currency)}
              </p>
            )}
            <div className="mt-2 flex justify-end gap-3">
              <button onClick={() => onEdit(b)} className="text-xs text-blue-500 hover:text-blue-700">Edit</button>
              <button onClick={() => onDelete(b.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
            </div>
          </div>
        </div>
      </div>
    ))}
  </div>
);

// ── Expenses Tab ──────────────────────────────────────────────────────────────

const ExpensesTab: React.FC<{ expenses: Expense[]; onDelete: (id: string) => void }> = ({ expenses, onDelete }) => (
  <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
    {expenses.length === 0 ? (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-stone-100">
          <TrendingUp size={20} className="text-zinc-400" />
        </div>
        <p className="text-sm font-medium text-zinc-700">No expenses recorded yet</p>
      </div>
    ) : (
      <table className="w-full text-sm table-card-mobile">
        <thead className="border-b border-stone-200 bg-stone-50">
          <tr>
            {['Date', 'Vehicle', 'Category', 'Amount', 'Description'].map(col => (
              <th key={col} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">{col}</th>
            ))}
            <th className="px-4 py-3 w-16" />
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {expenses.map(e => (
            <tr key={e.id} className="hover:bg-stone-50">
              <td className="px-4 py-3 text-zinc-700" data-label="Date">{e.expense_date}</td>
              <td className="px-4 py-3 text-zinc-700" data-label="Vehicle">{e.make_model ?? '—'}</td>
              <td className="px-4 py-3" data-label="Category">
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-700">{e.category}</span>
              </td>
              <td className="px-4 py-3 font-medium text-orange-600" data-label="Amount">{fmt(Number(e.amount), e.currency)}</td>
              <td className="px-4 py-3 text-zinc-500 max-w-[180px]" data-label="Desc">{e.description || '—'}</td>
              <td className="px-4 py-3 text-right actions-cell" data-label="">
                <button onClick={() => onDelete(e.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
);

// ── Vehicles Tab ──────────────────────────────────────────────────────────────

const VehiclesTab: React.FC<{ vehicles: Vehicle[] }> = ({ vehicles }) => (
  <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
    {vehicles.length === 0 ? (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-stone-100">
          <Car size={20} className="text-zinc-400" />
        </div>
        <p className="text-sm font-medium text-zinc-700">No vehicles added yet</p>
      </div>
    ) : (
      <table className="w-full text-sm table-card-mobile">
        <thead className="border-b border-stone-200 bg-stone-50">
          <tr>
            {['Vehicle', 'Reg', 'Rate/Day', 'Status', 'Total Hires', 'Total Income', 'Total Expenses', 'Net'].map(col => (
              <th key={col} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {vehicles.map(v => (
            <tr key={v.id} className="hover:bg-stone-50">
              <td className="px-4 py-3 font-medium text-zinc-900" data-label="Vehicle">{v.make_model}</td>
              <td className="px-4 py-3 text-zinc-700" data-label="Reg">{v.registration}</td>
              <td className="px-4 py-3 text-zinc-700" data-label="Rate">{fmt(Number(v.daily_rate), v.currency)}</td>
              <td className="px-4 py-3" data-label="Status"><VehicleStatusBadge status={v.status} /></td>
              <td className="px-4 py-3 text-zinc-700" data-label="Hires">{v.total_hires}</td>
              <td className="px-4 py-3 text-emerald-600 font-medium" data-label="Income">{fmt(Number(v.total_income), v.currency)}</td>
              <td className="px-4 py-3 text-orange-600 font-medium" data-label="Expenses">{fmt(Number(v.total_expenses), v.currency)}</td>
              <td className={`px-4 py-3 font-bold ${(Number(v.total_income) - Number(v.total_expenses)) >= 0 ? 'text-emerald-700' : 'text-red-600'}`} data-label="Net">
                {fmt(Number(v.total_income) - Number(v.total_expenses), v.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
);

// ── Status Badges ─────────────────────────────────────────────────────────────

const VehicleStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, string> = {
    Available:   'bg-emerald-50 text-emerald-700',
    Hired:       'bg-blue-50 text-blue-700',
    Maintenance: 'bg-amber-50 text-amber-700',
    Inactive:    'bg-stone-100 text-stone-600',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${map[status] ?? 'bg-stone-100 text-stone-600'}`}>
      {status}
    </span>
  );
};

const BookingStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, string> = {
    Confirmed: 'bg-amber-50 text-amber-700',
    Active:    'bg-emerald-50 text-emerald-700',
    Completed: 'bg-blue-50 text-blue-700',
    Cancelled: 'bg-stone-100 text-stone-500',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${map[status] ?? 'bg-stone-100 text-stone-600'}`}>
      {status}
    </span>
  );
};

// ── Record Hire Modal ─────────────────────────────────────────────────────────

const RecordHireModal: React.FC<{
  isOpen: boolean; vehicles: Vehicle[];
  onClose: () => void; onSaved: () => void;
}> = ({ isOpen, vehicles, onClose, onSaved }) => {
  const { showToast } = useToast();
  const [vehicleId, setVehicleId]   = useState('');
  const [hirerName, setHirerName]   = useState('');
  const [phone, setPhone]           = useState('');
  const [idNumber, setIdNumber]     = useState('');
  const [startDate, setStartDate]   = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate]       = useState('');
  const [dailyRate, setDailyRate]   = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [method, setMethod]         = useState('Cash');
  const [status, setStatus]         = useState('Confirmed');
  const [currency, setCurrency]     = useState('USD');
  const [notes, setNotes]           = useState('');
  const [loading, setLoading]       = useState(false);

  const selectedVehicle = vehicles.find(v => v.id === vehicleId);
  useEffect(() => {
    if (selectedVehicle) setDailyRate(String(selectedVehicle.daily_rate));
  }, [selectedVehicle]);

  const days = startDate && endDate
    ? Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1)
    : 0;
  const totalAmount = days * (Number(dailyRate) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleId || !endDate) return;
    setLoading(true);
    try {
      const res = await authFetch(`${API}?resource=bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle_id: vehicleId, hirer_name: hirerName, hirer_phone: phone || undefined,
          hirer_id_number: idNumber || undefined, start_date: startDate, end_date: endDate,
          daily_rate: Number(dailyRate), total_amount: totalAmount,
          amount_paid: Number(amountPaid) || 0, payment_method: method,
          currency, status, notes: notes || undefined,
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      showToast('Hire recorded', 'success');
      onSaved();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally { setLoading(false); }
  };

  const balance = totalAmount - (Number(amountPaid) || 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record Hire" label="Car Hiring" size="md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="hire-form" isLoading={loading}>Record Hire</Button>
        </div>
      }
    >
      <form id="hire-form" onSubmit={handleSubmit} className="space-y-3">
        {/* Customer Information */}
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">Customer Information</p>
          <div className="space-y-3">
            <TextInput id="h-name" labelText="Full Name *" value={hirerName} onChange={e => setHirerName(e.target.value)} required placeholder="Full name" />
            <div className="grid grid-cols-2 gap-3">
              <TextInput id="h-phone" type="tel" labelText="Phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+264 81 000 0000" />
              <TextInput id="h-id" labelText="ID / Passport" value={idNumber} onChange={e => setIdNumber(e.target.value)} placeholder="National ID" />
            </div>
          </div>
        </div>

        {/* Rental Information */}
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">Rental Information</p>
          <div className="space-y-3">
            <Select id="h-vehicle" labelText="Vehicle *" value={vehicleId} onChange={e => setVehicleId(e.target.value)} required>
              <SelectItem value="" text="Select vehicle" />
              {vehicles.filter(v => v.status !== 'Inactive').map(v => (
                <SelectItem key={v.id} value={v.id} text={`${v.make_model} (${v.registration}) — ${v.status}`} />
              ))}
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <TextInput id="h-start" type="date" labelText="Start Date *" value={startDate} onChange={e => setStartDate(e.target.value)} required />
              <TextInput id="h-end" type="date" labelText="End Date *" value={endDate} onChange={e => setEndDate(e.target.value)} required />
            </div>
          </div>
        </div>

        {/* Payment */}
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">Payment</p>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <TextInput id="h-rate" type="number" step="0.01" min="0" labelText="Daily Rate *" value={dailyRate} onChange={e => setDailyRate(e.target.value)} required />
              <Select id="h-currency" labelText="Currency" value={currency} onChange={e => setCurrency(e.target.value)}>
                {CURRENCIES.map(c => <SelectItem key={c} value={c} text={c} />)}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TextInput id="h-paid" type="number" step="0.01" min="0" labelText="Amount Paid" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} />
              <Select id="h-method" labelText="Payment Method" value={method} onChange={e => setMethod(e.target.value)}>
                {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m} text={m} />)}
              </Select>
            </div>
          </div>
        </div>

        {/* Auto-calculated summary — appears once dates + rate are set */}
        {days > 0 && totalAmount > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-600">Rental Summary</p>
            <div className="space-y-2">
              {selectedVehicle && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-zinc-500">Vehicle</span>
                  <span className="text-sm font-medium text-zinc-900">{selectedVehicle.make_model} · {selectedVehicle.registration}</span>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-zinc-500">Duration</span>
                <span className="text-sm font-medium text-zinc-900">{days} day{days !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-zinc-500">Rate</span>
                <span className="text-sm font-medium text-zinc-900">{fmt(Number(dailyRate) || 0, currency)} / day</span>
              </div>
              <div className="mt-1 border-t border-amber-200 pt-2 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-zinc-900">Total</span>
                <span className="text-sm font-bold text-zinc-900 tabular-nums">{fmt(totalAmount, currency)}</span>
              </div>
              {Number(amountPaid) > 0 && (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-zinc-500">Paid</span>
                    <span className="text-sm font-medium text-emerald-700 tabular-nums">{fmt(Number(amountPaid), currency)}</span>
                  </div>
                  {balance > 0 && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-amber-700">Balance Due</span>
                      <span className="text-sm font-bold text-amber-700 tabular-nums">{fmt(balance, currency)}</span>
                    </div>
                  )}
                  {balance <= 0 && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-emerald-600">Fully paid</span>
                      <CheckCircle size={14} className="text-emerald-500" />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Status & Notes */}
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">Status &amp; Notes</p>
          <div className="space-y-3">
            <Select id="h-status" labelText="Booking Status" value={status} onChange={e => setStatus(e.target.value)}>
              {BOOKING_STATUSES.map(s => <SelectItem key={s} value={s} text={s} />)}
            </Select>
            <TextArea id="h-notes" labelText="Notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes about this hire" />
          </div>
        </div>
      </form>
    </Modal>
  );
};

// ── Add Expense Modal ─────────────────────────────────────────────────────────

const AddExpenseModal: React.FC<{
  isOpen: boolean; vehicles: Vehicle[];
  onClose: () => void; onSaved: () => void;
}> = ({ isOpen, vehicles, onClose, onSaved }) => {
  const { showToast } = useToast();
  const [vehicleId, setVehicleId] = useState('');
  const [category, setCategory]   = useState('Fuel');
  const [amount, setAmount]       = useState('');
  const [currency, setCurrency]   = useState('USD');
  const [date, setDate]           = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [loading, setLoading]     = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleId) return;
    setLoading(true);
    try {
      const res = await authFetch(`${API}?resource=expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicle_id: vehicleId, category, amount: Number(amount), currency, expense_date: date, description: description || undefined }),
      });
      if (!res.ok) throw new Error('Failed to add expense');
      showToast('Expense added', 'success');
      onSaved();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally { setLoading(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Expense" label="Car Hiring" size="sm"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="expense-form-hire" isLoading={loading}>Add Expense</Button>
        </div>
      }
    >
      <form id="expense-form-hire" onSubmit={handleSubmit} className="space-y-3">
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">Expense Details</p>
          <div className="space-y-3">
            <Select id="exp-vehicle" labelText="Vehicle *" value={vehicleId} onChange={e => setVehicleId(e.target.value)} required>
              <SelectItem value="" text="Select vehicle" />
              {vehicles.map(v => <SelectItem key={v.id} value={v.id} text={`${v.make_model} (${v.registration})`} />)}
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Select id="exp-category" labelText="Category" value={category} onChange={e => setCategory(e.target.value)}>
                {EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c} text={c} />)}
              </Select>
              <TextInput id="exp-date" type="date" labelText="Date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TextInput id="exp-amount" type="number" step="0.01" min="0.01" labelText="Amount *" value={amount} onChange={e => setAmount(e.target.value)} required />
              <Select id="exp-currency" labelText="Currency" value={currency} onChange={e => setCurrency(e.target.value)}>
                {CURRENCIES.map(c => <SelectItem key={c} value={c} text={c} />)}
              </Select>
            </div>
            <TextArea id="exp-desc" labelText="Description" rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Full tank, oil change..." />
          </div>
        </div>
      </form>
    </Modal>
  );
};

// ── Manage Vehicles Modal ─────────────────────────────────────────────────────

const ManageVehiclesModal: React.FC<{
  isOpen: boolean; vehicles: Vehicle[];
  onClose: () => void; onSaved: () => void;
}> = ({ isOpen, vehicles, onClose, onSaved }) => {
  const { showToast } = useToast();
  const [addMode, setAddMode]     = useState(false);
  const [name, setName]           = useState('');
  const [reg, setReg]             = useState('');
  const [year, setYear]           = useState('');
  const [color, setColor]         = useState('');
  const [rate, setRate]           = useState('');
  const [currency, setCurrency]   = useState('USD');
  const [loading, setLoading]     = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authFetch(`${API}?resource=vehicles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ make_model: name, registration: reg, year: year ? Number(year) : undefined, color: color || undefined, daily_rate: Number(rate), currency }),
      });
      if (!res.ok) throw new Error('Failed to add vehicle');
      showToast(`${name} added`, 'success');
      setAddMode(false); setName(''); setReg(''); setYear(''); setColor(''); setRate('');
      onSaved();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally { setLoading(false); }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const res = await authFetch(`${API}?resource=vehicles&id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update status');
    } catch {} 
    onSaved();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manage Vehicles" label="Car Hiring" size="md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {!addMode && <Button variant="ghost" onClick={onClose}>Close</Button>}
          {!addMode && <Button renderIcon={Plus} onClick={() => setAddMode(true)}>Add Vehicle</Button>}
        </div>
      }
    >
      <div className="space-y-4">
        {addMode && (
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">New Vehicle</p>
            <form onSubmit={handleAdd} className="space-y-3">
              <TextInput id="mv-name" labelText="Make &amp; Model *" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Nissan Note" required />
              <div className="grid grid-cols-2 gap-3">
                <TextInput id="mv-reg" labelText="Registration *" value={reg} onChange={e => setReg(e.target.value)} required />
                <TextInput id="mv-year" type="number" labelText="Year" value={year} onChange={e => setYear(e.target.value)} placeholder="e.g. 2020" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <TextInput id="mv-rate" type="number" step="0.01" labelText="Daily Rate *" value={rate} onChange={e => setRate(e.target.value)} required />
                <Select id="mv-currency" labelText="Currency" value={currency} onChange={e => setCurrency(e.target.value)}>
                  {CURRENCIES.map(c => <SelectItem key={c} value={c} text={c} />)}
                </Select>
              </div>
              <TextInput id="mv-color" labelText="Color" value={color} onChange={e => setColor(e.target.value)} placeholder="e.g. White" />
              <div className="flex gap-2 pt-1">
                <Button type="submit" size="md" isLoading={loading}>Save Vehicle</Button>
                <Button type="button" variant="ghost" size="md" onClick={() => setAddMode(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        )}

        {/* Vehicle List */}
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">Vehicles ({vehicles.length})</p>
          {vehicles.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-400">No vehicles yet. Add one above.</p>
          ) : (
            <div className="space-y-2">
              {vehicles.map(v => (
                <div key={v.id} className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-zinc-900 truncate">{v.make_model}</p>
                    <p className="text-xs text-zinc-500">{v.registration} · {fmt(Number(v.daily_rate), v.currency)}/day</p>
                  </div>
                  <Select
                    id={`mv-status-${v.id}`}
                    labelText=""
                    hideLabel
                    value={v.status}
                    onChange={e => handleStatusChange(v.id, e.target.value)}
                    className="w-36 text-sm"
                  >
                    {VEHICLE_STATUSES.map(s => <SelectItem key={s} value={s} text={s} />)}
                  </Select>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

// ── Edit Booking Modal ────────────────────────────────────────────────────────

const EditBookingModal: React.FC<{
  booking: Booking; onClose: () => void; onSaved: () => void;
}> = ({ booking, onClose, onSaved }) => {
  const { showToast } = useToast();
  const [status, setStatus]       = useState(booking.status);
  const [amountPaid, setAmountPaid] = useState(String(booking.amount_paid));
  const [endDate, setEndDate]     = useState(booking.end_date);
  const [notes, setNotes]         = useState(booking.notes ?? '');
  const [loading, setLoading]     = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authFetch(`${API}?resource=bookings&id=${booking.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, amount_paid: Number(amountPaid), end_date: endDate, notes: notes || undefined }),
      });
      if (!res.ok) throw new Error('Failed to update booking');
      showToast('Booking updated', 'success');
      onSaved();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally { setLoading(false); }
  };

  return (
    <Modal isOpen={!!booking} onClose={onClose} title={`Edit — ${booking.hirer_name}`} label="Car Hiring" size="sm"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="edit-booking-form" isLoading={loading}>Save Changes</Button>
        </div>
      }
    >
      <form id="edit-booking-form" onSubmit={handleSubmit} className="space-y-3">
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">Booking Details</p>
          <div className="space-y-3">
            <Select id="eb-status" labelText="Status" value={status} onChange={e => setStatus(e.target.value as any)}>
              {BOOKING_STATUSES.map(s => <SelectItem key={s} value={s} text={s} />)}
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <TextInput id="eb-paid" type="number" step="0.01" min="0" labelText="Amount Paid" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} />
              <TextInput id="eb-end" type="date" labelText="End Date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <TextArea id="eb-notes" labelText="Notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" />
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default CarHire;
