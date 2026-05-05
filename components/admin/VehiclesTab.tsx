import React, { useEffect, useMemo, useState } from 'react';
import {
  LandedCostSummary,
  Currency,
  ExpenseCategory,
  VehicleStatus,
  AppUser,
  Vehicle,
  Expense,
} from '../../types';
import { dataService } from '../../services/dataService';
import { useToast } from '../Toast';
import { useConfirm } from '../shared/ConfirmModal';
import { Button, InsightPanel, MetricBarList, RankedMetricList, DashboardCard } from '../ui';
import { toVehicleEditorRecord, type VehicleEditorRecord } from '../../utils/dashboardViewModels';
import ExpenseEntryModal, { type ExpenseEntryFormValue } from '../shared/ExpenseEntryModal';
import VehicleFormModal, { type VehicleFormValue } from '../shared/VehicleFormModal';
import { DollarSign, Car, ArrowUp, Trash2, Pencil, Plus } from 'lucide-react';

export const VehiclesTab: React.FC = () => {
  const { showToast, ToastContainer } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const [summaries, setSummaries] = useState<LandedCostSummary[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<AppUser[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // Vehicle modal state
  const emptyVehicleForm: VehicleFormValue = {
    vin: '',
    reg: '',
    model: '',
    price: '',
    purpose: 'Resale',
    cbcaApplied: false,
    regBookUrl: '',
    currency: 'GBP',
  };
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<VehicleEditorRecord | null>(null);
  const [vehicleForm, setVehicleForm] = useState<VehicleFormValue>(emptyVehicleForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleVehicleFormChange = (updates: Partial<VehicleFormValue>) => {
    setVehicleForm(prev => ({ ...prev, ...updates }));
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
      setDrivers(userData.filter(user => user.role === 'Driver' && user.status === 'Active'));
    } catch (err: any) {
      console.error('[VehiclesTab] fetchData error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ── Vehicle handlers ──────────────────────────────────────────────────────

  const openAddVehicleModal = () => {
    setEditingVehicle(null);
    setVehicleForm(emptyVehicleForm);
    setShowAddModal(true);
  };

  const openEditVehicleModal = (vehicle: LandedCostSummary) => {
    const vehicleRecord = toVehicleEditorRecord(vehicle);
    setEditingVehicle(vehicleRecord);
    setVehicleForm({
      vin: vehicleRecord.vin_number,
      reg: vehicleRecord.reg_number || '',
      model: vehicleRecord.make_model,
      price: vehicleRecord.purchase_price_gbp.toString(),
      purpose: vehicleRecord.purpose || 'Resale',
      cbcaApplied: vehicleRecord.cbca_applied || false,
      regBookUrl: vehicleRecord.reg_book_url || '',
      currency: 'GBP',
    });
    setShowAddModal(true);
  };

  const openDeleteDialog = async (vehicle: LandedCostSummary) => {
    const ok = await confirm({
      title: 'Delete Vehicle?',
      message: `This will permanently delete "${vehicle.make_model}" (VIN: ${vehicle.vin_number}). All associated expenses will also be deleted.`,
      confirmLabel: 'Delete Vehicle',
      confirmVariant: 'danger',
    });
    if (!ok) return;
    try {
      await dataService.deleteVehicle(vehicle.vehicle_id);
      await fetchData();
      notifySuccess('Vehicle deleted successfully.');
    } catch (err: any) {
      console.error('[VehiclesTab] handleDeleteVehicle error:', err);
      if (err.name === 'ValidationError') {
        notifyWarning(err.message);
      } else {
        notifyError('Failed to delete vehicle. Please try again.');
      }
    }
  };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        vin_number: vehicleForm.vin,
        reg_number: vehicleForm.reg,
        make_model: vehicleForm.model,
        purchase_price_gbp: parseFloat(vehicleForm.price),
        status: editingVehicle ? editingVehicle.status : 'UK',
        purpose: vehicleForm.purpose,
        cbca_applied: vehicleForm.cbcaApplied,
        reg_book_url: vehicleForm.regBookUrl || null,
      };
      if (editingVehicle) {
        await dataService.updateVehicle(editingVehicle.id, payload);
      } else {
        await dataService.addVehicle(payload);
      }
      notifySuccess(editingVehicle ? 'Vehicle updated successfully!' : 'Vehicle added successfully!');
      setVehicleForm(emptyVehicleForm);
      setEditingVehicle(null);
      setShowAddModal(false);

      // Background refresh — fire-and-forget, surface a softer warning if it fails
      fetchData().catch((refreshError) => {
        console.error('[VehiclesTab] refresh failed:', refreshError);
        notifyWarning('Vehicle saved but failed to refresh list. Please refresh the page.');
      });
    } catch (err: any) {
      console.error('[VehiclesTab] handleSaveVehicle error:', err);
      notifyError(err?.message || 'Failed to save vehicle. Please try again.');
    } finally {
      setIsSubmitting(false);
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
      setExpenseVehicle('');
      setExpenseDesc('');
      setExpenseAmount('');
      setExpenseCurrency('NAD');
      setExpenseCategory('Fuel');
      setExpenseLocation('Namibia');
      setExpenseDriver('');
      setShowExpenseModal(false);
      notifySuccess(
        expenseDriver
          ? `Disbursement to ${expenseDriver} recorded successfully!`
          : 'Expense added successfully!'
      );
      await fetchData();
    } catch (err) {
      console.error('[VehiclesTab] handleAddExpense error:', err);
      notifyError('Failed to add expense. Please try again.');
    }
  };

  // ── Chart data ────────────────────────────────────────────────────────────

  const statusData = useMemo(
    () => [
      { name: 'UK', value: summaries.filter(s => s.status === 'UK').length },
      { name: 'Namibia', value: summaries.filter(s => s.status === 'Namibia').length },
      { name: 'Zimbabwe', value: summaries.filter(s => s.status === 'Zimbabwe').length },
      { name: 'Botswana', value: summaries.filter(s => s.status === 'Botswana').length },
      { name: 'Sold', value: summaries.filter(s => s.status === 'Sold').length },
    ],
    [summaries]
  );

  const totalValuation = summaries.reduce((acc, s) => acc + s.total_landed_cost_usd, 0);
  const inTransitCount = summaries.filter(s => s.status !== 'Sold').length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="animate-spin w-10 h-10 border-2 border-[#D97706] border-t-transparent rounded-full"></div>
        <p className="text-[#52525b] font-semibold uppercase tracking-widest text-xs">
          Loading Fleet Data
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setShowExpenseModal(true)}
          leftIcon={<DollarSign size={20} />}
        >
          Add Expense
        </Button>
        <Button type="button" onClick={openAddVehicleModal} leftIcon={<Plus size={16} />}>
          Add Vehicle
        </Button>
      </div>

      {/* Analytics Cards */}
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}
      >
        <DashboardCard
          title="Total Asset Valuation"
          value={`$${totalValuation.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          subtitle="Fleet book value"
          intent="primary"
          footer={
            <div className="flex items-center gap-2 text-sm font-semibold text-[#10b981]">
              <ArrowUp size={16} />
              <span>Healthy Inventory</span>
            </div>
          }
        />

        <DashboardCard
          title="In-Transit Assets"
          value={inTransitCount}
          subtitle="Active routes"
          intent="success"
          footer={
            <div className="flex items-center gap-2 text-sm text-[#52525b]">
              <Car size={16} />
              <span>Across Namibia & Zimbabwe</span>
            </div>
          }
        />

        <DashboardCard
          title="Fleet Efficiency"
          value="94%"
          subtitle="Operational uptime"
          intent="info"
          footer={
            <div className="w-full h-2 bg-[#f5f5f4] mt-2">
              <div className="h-full bg-[#10b981]" style={{ width: '94%' }} />
            </div>
          }
        />
      </div>

      {/* Analytics Panels */}
      <div
        className="grid gap-6"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))' }}
      >
        <InsightPanel
          title="Landed Cost Breakdown"
          subtitle="Top vehicles ranked by total landed cost, with transit spend called out."
        >
          <RankedMetricList
            items={[...summaries]
              .sort((a, b) => (b.total_landed_cost_usd || 0) - (a.total_landed_cost_usd || 0))
              .slice(0, 6)
              .map(summary => ({
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
          subtitle="Fleet distribution by operating region and status."
        >
          <MetricBarList
            items={statusData
              .filter(item => item.value > 0)
              .map(item => ({
                label: item.name,
                value: `${item.value} vehicles`,
                helper:
                  summaries.length > 0
                    ? `${((item.value / summaries.length) * 100).toFixed(1)}% of fleet`
                    : '0% of fleet',
                percent: summaries.length > 0 ? (item.value / summaries.length) * 100 : 0,
                tone:
                  item.name === 'Sold'
                    ? 'red'
                    : item.name === 'Namibia'
                      ? 'green'
                      : item.name === 'Zimbabwe'
                        ? 'teal'
                        : item.name === 'Botswana'
                          ? 'purple'
                          : 'blue',
              }))}
            emptyMessage="No distribution data available yet."
          />
        </InsightPanel>
      </div>

      {/* Inventory Table */}
      <div className="bg-white border border-[#e7e5e4]">
        <div className="px-6 py-4 border-b border-[#e7e5e4] flex justify-between items-center">
          <div>
            <h3 className="m-0 text-base font-semibold text-[#18181b]">Current Inventory</h3>
            <p className="mt-1 text-sm text-[#52525b]">
              {summaries.length} vehicle{summaries.length !== 1 ? 's' : ''} &bull; {inTransitCount}{' '}
              in transit
            </p>
          </div>
          <div className="text-right">
            <p className="m-0 text-xs text-[#52525b] uppercase tracking-wider font-semibold">
              Total Value
            </p>
            <p className="mt-1 text-xl font-semibold text-[#18181b] tabular-nums">
              ${totalValuation.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#ffffff] border-b border-[#e7e5e4]">
                <th className="px-6 py-4 text-left font-semibold text-[#52525b] uppercase text-xs tracking-wider">
                  Asset / VIN
                </th>
                <th className="px-6 py-4 text-left font-semibold text-[#52525b] uppercase text-xs tracking-wider">
                  Region
                </th>
                <th className="px-6 py-4 text-left font-semibold text-[#52525b] uppercase text-xs tracking-wider">
                  Purchase Cost
                </th>
                <th className="px-6 py-4 text-left font-semibold text-[#52525b] uppercase text-xs tracking-wider">
                  Landed Cost
                </th>
              </tr>
            </thead>
            <tbody>
              {summaries.map(s => (
                <tr
                  key={s.vehicle_id}
                  className="border-b border-[#e7e5e4] hover:bg-[#ffffff] transition-colors group"
                >
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-semibold text-[#18181b]">{s.make_model}</span>
                      <span className="font-mono text-xs text-[#52525b] uppercase">
                        {s.vin_number}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider"
                      style={{
                        background:
                          s.status === 'UK'
                            ? '#e7e5e4'
                            : s.status === 'Namibia'
                              ? '#f59e0b'
                              : s.status === 'Zimbabwe'
                                ? '#10b981'
                                : s.status === 'Botswana'
                                  ? '#8a3ffc'
                                  : '#D97706',
                        color: s.status === 'UK' || s.status === 'Namibia' ? '#18181b' : '#ffffff',
                      }}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[#52525b] tabular-nums">
                    £{s.purchase_price_gbp.toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="font-semibold text-[#18181b] tabular-nums">
                          $
                          {s.total_landed_cost_usd.toLocaleString(undefined, {
                            maximumFractionDigits: 0,
                          })}
                        </span>
                        <span className="text-xs text-[#52525b] uppercase tracking-wider">
                          Total Valuation
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditVehicleModal(s)}
                          className="p-2 bg-transparent border-none cursor-pointer text-[#D97706] opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Edit vehicle"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => openDeleteDialog(s)}
                          className="p-2 bg-transparent border-none cursor-pointer text-[#dc2626] opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete vehicle"
                        >
                          <Trash2 size={16} />
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
          setVehicleForm(emptyVehicleForm);
        }}
        onSubmit={handleSaveVehicle}
        form={vehicleForm}
        onChange={handleVehicleFormChange}
        isSubmitting={isSubmitting}
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

      <ToastContainer />
      <ConfirmDialog />
    </div>
  );
};

export default VehiclesTab;
