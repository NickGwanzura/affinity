import React, { useEffect, useState } from 'react';
import { LandedCostSummary } from '../../types';
import { supabase } from '../../services/supabaseService';
import { useToast } from '../Toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export const VehiclesTab: React.FC = () => {
  const { showToast, ToastContainer } = useToast();

  const [summaries, setSummaries] = useState<LandedCostSummary[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Vehicle modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<any | null>(null);
  const [newVin, setNewVin] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newPrice, setNewPrice] = useState('');

  // Delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState<{ id: string; make_model: string; vin_number: string } | null>(null);

  // Expense modal state
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseVehicle, setExpenseVehicle] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCurrency, setExpenseCurrency] = useState<'NAD' | 'GBP' | 'USD' | 'BWP'>('NAD');
  const [expenseCategory, setExpenseCategory] = useState<string>('Fuel');
  const [expenseLocation, setExpenseLocation] = useState<string>('Namibia');
  const [expenseDriver, setExpenseDriver] = useState('');

  const notifySuccess = (msg: string) => showToast(msg, 'success');
  const notifyError = (msg: string) => showToast(msg, 'error');
  const notifyWarning = (msg: string) => showToast(msg, 'warning');

  const fetchData = async () => {
    try {
      const [summaryData, vehicleData, expenseData] = await Promise.all([
        supabase.getLandedCostSummaries(),
        supabase.getVehicles(),
        supabase.getExpenses(),
      ]);
      setSummaries(summaryData);
      setVehicles(vehicleData);
      setExpenses(expenseData);
    } catch (err: any) {
      console.error('[VehiclesTab] fetchData error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // ── Vehicle handlers ──────────────────────────────────────────────────────

  const openAddVehicleModal = () => {
    setEditingVehicle(null);
    setNewVin('');
    setNewModel('');
    setNewPrice('');
    setShowAddModal(true);
  };

  const openEditVehicleModal = (vehicle: any) => {
    setEditingVehicle(vehicle);
    setNewVin(vehicle.vin_number);
    setNewModel(vehicle.make_model);
    setNewPrice(vehicle.purchase_price_gbp.toString());
    setShowAddModal(true);
  };

  const openDeleteDialog = (vehicle: any) => {
    setVehicleToDelete({ id: vehicle.vehicle_id, make_model: vehicle.make_model, vin_number: vehicle.vin_number });
    setShowDeleteDialog(true);
  };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        vin_number: newVin,
        make_model: newModel,
        purchase_price_gbp: parseFloat(newPrice),
        status: editingVehicle ? editingVehicle.status : 'UK'
      };
      if (editingVehicle) {
        await supabase.updateVehicle(editingVehicle.vehicle_id || editingVehicle.id, payload);
      } else {
        await supabase.addVehicle(payload);
      }
      setNewVin(''); setNewModel(''); setNewPrice('');
      setEditingVehicle(null);
      setShowAddModal(false);
      try {
        await fetchData();
        notifySuccess(editingVehicle ? 'Vehicle updated successfully!' : 'Vehicle added successfully!');
      } catch {
        notifyWarning('Vehicle saved but failed to refresh list. Please refresh the page.');
      }
    } catch (err: any) {
      console.error('[VehiclesTab] handleSaveVehicle error:', err);
      notifyError(err.message || 'Failed to save vehicle. Please try again.');
    }
  };

  const handleDeleteVehicle = async () => {
    if (!vehicleToDelete) return;
    try {
      await supabase.deleteVehicle(vehicleToDelete.id);
      setShowDeleteDialog(false);
      setVehicleToDelete(null);
      await fetchData();
      notifySuccess('Vehicle deleted successfully.');
    } catch (err: any) {
      console.error('[VehiclesTab] handleDeleteVehicle error:', err);
      if (err.name === 'ValidationError') {
        notifyWarning(err.message);
      } else {
        notifyError('Failed to delete vehicle. Please try again.');
      }
      setShowDeleteDialog(false);
      setVehicleToDelete(null);
    }
  };

  // ── Expense handler ───────────────────────────────────────────────────────

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseAmount) return;
    if (expenseCategory === 'Driver Disbursement' && !expenseDriver) {
      notifyWarning('Please select a driver for the disbursement');
      return;
    }
    try {
      await supabase.addExpense({
        vehicle_id: expenseVehicle || undefined,
        description: expenseDriver
          ? `Driver Disbursement - ${expenseDriver}: ${expenseDesc || 'Trip funds'}`
          : expenseDesc,
        amount: parseFloat(expenseAmount),
        currency: expenseCurrency,
        category: expenseCategory as any,
        location: expenseLocation as any,
        receipt_url: 'https://picsum.photos/400/600',
        driver_name: expenseDriver || undefined,
      });
      setExpenseVehicle(''); setExpenseDesc(''); setExpenseAmount('');
      setExpenseCurrency('NAD'); setExpenseCategory('Fuel');
      setExpenseLocation('Namibia'); setExpenseDriver('');
      setShowExpenseModal(false);
      notifySuccess(expenseDriver
        ? `Disbursement to ${expenseDriver} recorded successfully!`
        : 'Expense added successfully!');
      await fetchData();
    } catch (err) {
      console.error('[VehiclesTab] handleAddExpense error:', err);
      notifyError('Failed to add expense. Please try again.');
    }
  };

  // ── Chart data ────────────────────────────────────────────────────────────

  const statusData = [
    { name: 'UK', value: summaries.filter(s => s.status === 'UK').length },
    { name: 'Namibia', value: summaries.filter(s => s.status === 'Namibia').length },
    { name: 'Zimbabwe', value: summaries.filter(s => s.status === 'Zimbabwe').length },
    { name: 'Botswana', value: summaries.filter(s => s.status === 'Botswana').length },
    { name: 'Sold', value: summaries.filter(s => s.status === 'Sold').length },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        <p className="text-zinc-500 font-bold animate-pulse uppercase tracking-widest text-xs">Loading Fleet Data</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setShowExpenseModal(true)}
          className="bg-green-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-green-700 transition-all shadow-xl shadow-green-100 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Add Expense
        </button>
        <button
          onClick={openAddVehicleModal}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="2.5" /></svg>
          Add Vehicle
        </button>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-zinc-200 relative overflow-hidden group">
          <p className="text-zinc-400 text-xs font-black uppercase tracking-widest">Total Asset Valuation</p>
          <h2 className="text-4xl font-black mt-3 text-zinc-900">
            ${summaries.reduce((acc, s) => acc + s.total_landed_cost_usd, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </h2>
          <div className="mt-4 flex items-center gap-1.5 text-emerald-600 text-sm font-bold">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 10l7-7m0 0l7 7m-7-7v18" strokeWidth="3" /></svg>
            Healthy Inventory
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-sm border border-zinc-200">
          <p className="text-zinc-400 text-xs font-black uppercase tracking-widest">In-Transit Assets</p>
          <h2 className="text-4xl font-black mt-3 text-blue-600">
            {summaries.filter(s => s.status !== 'Sold').length}
          </h2>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-zinc-400 text-xs font-bold tracking-tight">Active routes across Namibia & Zim</span>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-sm border border-zinc-200">
          <p className="text-zinc-400 text-xs font-black uppercase tracking-widest">Fleet Efficiency</p>
          <h2 className="text-4xl font-black mt-3 text-zinc-900">94%</h2>
          <div className="mt-5 h-2.5 bg-zinc-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 w-[94%] rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
          </div>
        </div>
      </div>

      {/* Visual Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-zinc-200">
          <h3 className="text-xl font-black mb-8 text-zinc-900 tracking-tight">Landed Cost Breakdown</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summaries}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="vin_number" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                <Legend iconType="circle" />
                <Bar dataKey="total_expenses_usd" name="Transit Expenses" fill="#3b82f6" stackId="a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="total_landed_cost_usd" name="Base Purchase" fill="#f1f5f9" stackId="a" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-sm border border-zinc-200">
          <h3 className="text-xl font-black mb-8 text-zinc-900 tracking-tight">Geographic Distribution</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={65} outerRadius={100} paddingAngle={8} dataKey="value">
                  {statusData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} cornerRadius={8} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-6">
            {statusData.map((s, i) => (
              <div key={s.name} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i] }}></div>
                <span className="text-xs font-black uppercase tracking-widest text-zinc-500">{s.name} ({s.value})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 overflow-hidden">
        <div className="px-8 py-6 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/30">
          <div>
            <h3 className="text-xl font-black text-zinc-900 tracking-tight">Current Inventory</h3>
            <p className="text-sm text-zinc-500 mt-1">
              {summaries.length} vehicle{summaries.length !== 1 ? 's' : ''} &bull; {summaries.filter(s => s.status !== 'Sold').length} in transit
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest">Total Value</p>
            <p className="text-2xl font-black text-zinc-900">
              ${summaries.reduce((acc, s) => acc + s.total_landed_cost_usd, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100">
                <th className="px-8 py-4 font-black text-zinc-400 uppercase tracking-widest text-xs">Asset / VIN</th>
                <th className="px-8 py-4 font-black text-zinc-400 uppercase tracking-widest text-xs">Region</th>
                <th className="px-8 py-4 font-black text-zinc-400 uppercase tracking-widest text-xs">Purchase Cost</th>
                <th className="px-8 py-4 font-black text-zinc-400 uppercase tracking-widest text-xs">Landed Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {summaries.map((s) => (
                <tr key={s.vehicle_id} className="hover:bg-zinc-50 transition-all group">
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <span className="font-black text-zinc-900 text-base">{s.make_model}</span>
                      <span className="font-mono text-xs text-zinc-400 font-bold uppercase tracking-wider">{s.vin_number}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest ring-1 ${
                      s.status === 'UK' ? 'bg-zinc-100 text-zinc-500 ring-zinc-200' :
                      s.status === 'Namibia' ? 'bg-amber-50 text-amber-700 ring-amber-100' :
                      s.status === 'Zimbabwe' ? 'bg-emerald-50 text-emerald-700 ring-emerald-100' :
                      s.status === 'Botswana' ? 'bg-purple-50 text-purple-700 ring-purple-100' :
                      'bg-blue-50 text-blue-700 ring-blue-100'
                    }`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-8 py-6 font-bold text-zinc-400 tracking-tight">£{s.purchase_price_gbp.toLocaleString()}</td>
                  <td className="px-8 py-6">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="font-black text-zinc-900 text-lg">${s.total_landed_cost_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        <span className="text-xs text-zinc-400 font-bold uppercase tracking-widest">Total Valuation</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditVehicleModal(s)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg hover:bg-blue-50 text-blue-600"
                          title="Edit vehicle"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => openDeleteDialog(s)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg hover:bg-red-50 text-red-600"
                          title="Delete vehicle"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Vehicle Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm cursor-pointer" onClick={() => setShowAddModal(false)}></div>
          <div className="relative bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-zinc-900">{editingVehicle ? 'Edit Vehicle' : 'Add Vehicle'}</h3>
              <button onClick={() => { setShowAddModal(false); setEditingVehicle(null); }} className="text-zinc-400 hover:text-zinc-600 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSaveVehicle} className="space-y-5">
              <div>
                <label className="text-sm font-semibold text-zinc-700 mb-2 block">VIN Number *</label>
                <input type="text" value={newVin} onChange={(e) => setNewVin(e.target.value)} required placeholder="Enter VIN number" className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none" />
                <p className="text-xs text-zinc-400 mt-1">Unique vehicle identification number</p>
              </div>
              <div>
                <label className="text-sm font-semibold text-zinc-700 mb-2 block">Make & Model *</label>
                <input type="text" value={newModel} onChange={(e) => setNewModel(e.target.value)} required placeholder="e.g. Toyota Land Cruiser V8" className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none" />
              </div>
              <div>
                <label className="text-sm font-semibold text-zinc-700 mb-2 block">Purchase Price (GBP) *</label>
                <input type="number" step="0.01" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} required placeholder="0.00" min="0" className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none" />
                <p className="text-xs text-zinc-400 mt-1">Purchase price in British Pounds</p>
              </div>
              {!editingVehicle && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-sm text-blue-800 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span>New vehicles are set to &quot;UK&quot; status by default. You can update the status later.</span>
                  </p>
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 px-6 py-3 rounded-xl border border-zinc-200 text-zinc-700 font-semibold hover:bg-zinc-50 transition-colors">Cancel</button>
                <button type="submit" className={`flex-1 ${editingVehicle ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'} text-white font-bold py-3 rounded-xl shadow-lg transition-all`}>
                  {editingVehicle ? 'Save Changes' : 'Add Vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm cursor-pointer" onClick={() => setShowExpenseModal(false)}></div>
          <div className="relative bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-zinc-900">Add Expense</h3>
              <button onClick={() => setShowExpenseModal(false)} className="text-zinc-400 hover:text-zinc-600 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleAddExpense} className="space-y-5">
              <div>
                <label className="text-sm font-semibold text-zinc-700 mb-2 block">Vehicle Selection <span className="text-zinc-400 text-xs">(Optional)</span></label>
                <select value={expenseVehicle} onChange={(e) => setExpenseVehicle(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all outline-none">
                  <option value="">None (General expense)</option>
                  {vehicles.map((v) => <option key={v.id} value={v.id}>{v.make_model} ({v.vin_number})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Amount</label>
                  <input type="number" step="0.01" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} required placeholder="0.00" className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Currency</label>
                  <select value={expenseCurrency} onChange={(e) => setExpenseCurrency(e.target.value as any)} className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none">
                    <option value="NAD">NAD (Namibia)</option>
                    <option value="GBP">GBP (UK)</option>
                    <option value="USD">USD (General)</option>
                    <option value="BWP">BWP (Botswana)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Category</label>
                  <select value={expenseCategory} onChange={(e) => { setExpenseCategory(e.target.value); if (e.target.value !== 'Driver Disbursement') setExpenseDriver(''); }} className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none">
                    <option value="Fuel">Fuel</option>
                    <option value="Tolls">Tolls</option>
                    <option value="Food">Food</option>
                    <option value="Repairs">Repairs</option>
                    <option value="Duty">Duty</option>
                    <option value="Shipping">Shipping</option>
                    <option value="Driver Disbursement">💰 Driver Disbursement</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Location</label>
                  <select value={expenseLocation} onChange={(e) => setExpenseLocation(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none">
                    <option value="UK">UK</option>
                    <option value="Namibia">Namibia</option>
                    <option value="Zimbabwe">Zimbabwe</option>
                    <option value="Botswana">Botswana</option>
                  </select>
                </div>
              </div>
              {expenseCategory === 'Driver Disbursement' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <label className="text-sm font-semibold text-amber-800 mb-2 block">Select Driver <span className="text-red-500">*</span></label>
                  <select value={expenseDriver} onChange={(e) => setExpenseDriver(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-amber-300 bg-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none">
                    <option value="">-- Select Driver --</option>
                    <option value="David">David</option>
                    <option value="Boulton">Boulton</option>
                  </select>
                  <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                    Money disbursed to this driver for trip expenses
                  </p>
                </div>
              )}
              <div>
                <label className="text-sm font-semibold text-zinc-700 mb-2 block">
                  Description {expenseCategory === 'Other' && <span className="text-red-500">*</span>}
                </label>
                <textarea value={expenseDesc} onChange={(e) => setExpenseDesc(e.target.value)} placeholder={expenseCategory === 'Other' ? 'Please specify the type of expense' : 'E.g. Full tank at Engen Windhoek'} rows={3} required={expenseCategory === 'Other'} className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none" />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowExpenseModal(false)} className="flex-1 px-6 py-3 rounded-xl border border-zinc-200 text-zinc-700 font-semibold hover:bg-zinc-50 transition-colors">Cancel</button>
                <button type="submit" className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-green-200 transition-all">Add Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Vehicle Confirmation Dialog */}
      {showDeleteDialog && vehicleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm" onClick={() => setShowDeleteDialog(false)}></div>
          <div className="relative bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-2xl font-black text-zinc-900 mb-2">Delete Vehicle?</h3>
            <p className="text-zinc-600 mb-4">
              Are you sure you want to delete <span className="font-bold">{vehicleToDelete.make_model}</span> (VIN: {vehicleToDelete.vin_number})?
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-sm font-bold text-amber-800">Warning</p>
                  <p className="text-xs text-amber-700 mt-1">This action cannot be undone. All associated expenses will also be deleted.</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowDeleteDialog(false)} className="flex-1 px-6 py-3 rounded-xl font-bold text-sm text-zinc-700 border border-zinc-200 hover:bg-zinc-50 transition-colors">Cancel</button>
              <button onClick={handleDeleteVehicle} className="flex-1 px-6 py-3 rounded-xl font-bold text-sm bg-red-600 text-white hover:bg-red-700 transition-colors">Delete Vehicle</button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer />
    </div>
  );
};

export default VehiclesTab;
