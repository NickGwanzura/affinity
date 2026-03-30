import React, { useEffect, useMemo, useState } from 'react';
import { LandedCostSummary, Currency, ExpenseCategory, VehicleStatus, AppUser, Vehicle, Expense } from '../../types';
import { dataService } from '../../services/dataService';
import { useToast } from '../Toast';
import { Button, InsightPanel, MetricBarList, RankedMetricList } from '../ui';
import { toVehicleEditorRecord, type VehicleEditorRecord } from '../../utils/dashboardViewModels';
import ExpenseEntryModal, { type ExpenseEntryFormValue } from '../shared/ExpenseEntryModal';
import VehicleFormModal, { type VehicleFormValue } from '../shared/VehicleFormModal';

export const VehiclesTab: React.FC = () => {
  const { showToast, ToastContainer } = useToast();

  const [summaries, setSummaries] = useState<LandedCostSummary[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<AppUser[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // Vehicle modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<VehicleEditorRecord | null>(null);
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
  const [expenseCurrency, setExpenseCurrency] = useState<Currency>('NAD');
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory>('Fuel');
  const [expenseLocation, setExpenseLocation] = useState<VehicleStatus>('Namibia');
  const [expenseDriver, setExpenseDriver] = useState('');

  const notifySuccess = (msg: string) => showToast(msg, 'success');
  const notifyError = (msg: string) => showToast(msg, 'error');
  const notifyWarning = (msg: string) => showToast(msg, 'warning');

  const expenseFormValue: ExpenseEntryFormValue = {
    vehicleId: expenseVehicle,
    amount: expenseAmount,
    currency: expenseCurrency,
    category: expenseCategory,
    location: expenseLocation,
    description: expenseDesc,
    driverName: expenseDriver,
  };

  const handleExpenseFormChange = (updates: Partial<ExpenseEntryFormValue>) => {
    if (updates.vehicleId !== undefined) setExpenseVehicle(updates.vehicleId);
    if (updates.amount !== undefined) setExpenseAmount(updates.amount);
    if (updates.currency !== undefined) setExpenseCurrency(updates.currency);
    if (updates.category !== undefined) setExpenseCategory(updates.category);
    if (updates.location !== undefined) setExpenseLocation(updates.location);
    if (updates.description !== undefined) setExpenseDesc(updates.description);
    if (updates.driverName !== undefined) setExpenseDriver(updates.driverName);
  };

  const vehicleFormValue: VehicleFormValue = {
    vin: newVin,
    model: newModel,
    price: newPrice,
  };

  const handleVehicleFormChange = (updates: Partial<VehicleFormValue>) => {
    if (updates.vin !== undefined) setNewVin(updates.vin);
    if (updates.model !== undefined) setNewModel(updates.model);
    if (updates.price !== undefined) setNewPrice(updates.price);
  };

  const fetchData = async () => {
    try {
      const [summaryData, vehicleData, expenseData, userData] = await Promise.all([
        dataService.getLandedCostSummaries(),
        dataService.getVehicles(),
        dataService.getExpenses(),
        dataService.getUsers(),
      ]);
      setSummaries(summaryData);
      setVehicles(vehicleData);
      setExpenses(expenseData);
      setDrivers(userData.filter((user) => user.role === 'Driver' && user.status === 'Active'));
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

  const openEditVehicleModal = (vehicle: LandedCostSummary) => {
    const vehicleRecord = toVehicleEditorRecord(vehicle);
    setEditingVehicle(vehicleRecord);
    setNewVin(vehicleRecord.vin_number);
    setNewModel(vehicleRecord.make_model);
    setNewPrice(vehicleRecord.purchase_price_gbp.toString());
    setShowAddModal(true);
  };

  const openDeleteDialog = (vehicle: LandedCostSummary) => {
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
        await dataService.updateVehicle(editingVehicle.id, payload);
      } else {
        await dataService.addVehicle(payload);
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
      await dataService.deleteVehicle(vehicleToDelete.id);
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
      await dataService.addExpense({
        vehicle_id: expenseVehicle || undefined,
        description: expenseDriver
          ? `Driver Disbursement - ${expenseDriver}: ${expenseDesc || 'Trip funds'}`
          : expenseDesc,
        amount: parseFloat(expenseAmount),
        currency: expenseCurrency,
        category: expenseCategory,
        location: expenseLocation,
        exchange_rate_to_usd: expenseCurrency === 'USD' ? 1 : undefined,
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

  const statusData = useMemo(() => ([
    { name: 'UK', value: summaries.filter(s => s.status === 'UK').length },
    { name: 'Namibia', value: summaries.filter(s => s.status === 'Namibia').length },
    { name: 'Zimbabwe', value: summaries.filter(s => s.status === 'Zimbabwe').length },
    { name: 'Botswana', value: summaries.filter(s => s.status === 'Botswana').length },
    { name: 'Sold', value: summaries.filter(s => s.status === 'Sold').length },
  ]), [summaries]);

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
        <Button
          type="button"
          variant="secondary"
          onClick={() => setShowExpenseModal(true)}
          leftIcon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        >
          Add Expense
        </Button>
        <Button
          type="button"
          onClick={openAddVehicleModal}
          leftIcon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="2.5" /></svg>}
        >
          Add Vehicle
        </Button>
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

      {/* Carbon Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <InsightPanel
          title="Landed Cost Breakdown"
          subtitle="Top vehicles ranked by total landed cost, with transit spend called out."
        >
          <RankedMetricList
            items={[...summaries]
              .sort((a, b) => (b.total_landed_cost_usd || 0) - (a.total_landed_cost_usd || 0))
              .slice(0, 6)
              .map((summary) => ({
                label: summary.make_model,
                value: `$${(summary.total_landed_cost_usd || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                helper: `${summary.vin_number} • transit $${(summary.total_expenses_usd || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                tone: 'blue',
              }))}
            emptyMessage="No landed-cost data available yet."
          />
        </InsightPanel>

        <InsightPanel
          title="Geographic Distribution"
          subtitle="A cleaner Carbon view of fleet concentration by operating status."
        >
          <MetricBarList
            items={statusData
              .filter((item) => item.value > 0)
              .map((item) => ({
                label: item.name,
                value: `${item.value} vehicles`,
                helper: summaries.length > 0 ? `${((item.value / summaries.length) * 100).toFixed(1)}% of fleet` : '0% of fleet',
                percent: summaries.length > 0 ? (item.value / summaries.length) * 100 : 0,
                tone: item.name === 'Sold' ? 'red' : item.name === 'Namibia' ? 'green' : item.name === 'Zimbabwe' ? 'teal' : item.name === 'Botswana' ? 'purple' : 'blue',
              }))}
            emptyMessage="No distribution data available yet."
          />
        </InsightPanel>
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
                          type="button"
                          onClick={() => openEditVehicleModal(s)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg hover:bg-blue-50 text-blue-600"
                          title="Edit vehicle"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          type="button"
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

      <VehicleFormModal
        isOpen={showAddModal}
        isEditing={Boolean(editingVehicle)}
        onClose={() => {
          setShowAddModal(false);
          setEditingVehicle(null);
        }}
        onSubmit={handleSaveVehicle}
        form={vehicleFormValue}
        onChange={handleVehicleFormChange}
      />

      <ExpenseEntryModal
        isOpen={showExpenseModal}
        title="Add Expense"
        submitLabel="Add Expense"
        onClose={() => setShowExpenseModal(false)}
        onSubmit={handleAddExpense}
        vehicles={vehicles}
        drivers={drivers}
        form={expenseFormValue}
        onChange={handleExpenseFormChange}
        accent="green"
      />

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
              <button type="button" onClick={handleDeleteVehicle} className="flex-1 px-6 py-3 rounded-xl font-bold text-sm bg-red-600 text-white hover:bg-red-700 transition-colors">Delete Vehicle</button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer />
    </div>
  );
};

export default VehiclesTab;
