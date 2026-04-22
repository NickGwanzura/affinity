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
import { Button, InsightPanel, MetricBarList, RankedMetricList, DashboardCard } from '../ui';
import { toVehicleEditorRecord, type VehicleEditorRecord } from '../../utils/dashboardViewModels';
import ExpenseEntryModal, { type ExpenseEntryFormValue } from '../shared/ExpenseEntryModal';
import VehicleFormModal, { type VehicleFormValue } from '../shared/VehicleFormModal';
import { DollarSign, Car, ArrowUp, Trash2, Pencil } from 'lucide-react';

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
  const [newReg, setNewReg] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newPurpose, setNewPurpose] = useState<'Resale' | 'Client'>('Resale');
  const [newCbcaApplied, setNewCbcaApplied] = useState(false);
  const [newRegBookUrl, setNewRegBookUrl] = useState('');

  // Delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState<{
    id: string;
    make_model: string;
    vin_number: string;
  } | null>(null);

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
    reg: newReg,
    model: newModel,
    price: newPrice,
    purpose: newPurpose,
    cbcaApplied: newCbcaApplied,
    regBookUrl: newRegBookUrl,
  };

  const handleVehicleFormChange = (updates: Partial<VehicleFormValue>) => {
    if (updates.vin !== undefined) setNewVin(updates.vin);
    if (updates.reg !== undefined) setNewReg(updates.reg);
    if (updates.model !== undefined) setNewModel(updates.model);
    if (updates.price !== undefined) setNewPrice(updates.price);
    if (updates.purpose !== undefined) setNewPurpose(updates.purpose);
    if (updates.cbcaApplied !== undefined) setNewCbcaApplied(updates.cbcaApplied);
    if (updates.regBookUrl !== undefined) setNewRegBookUrl(updates.regBookUrl);
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
    setNewVin('');
    setNewReg('');
    setNewModel('');
    setNewPrice('');
    setNewPurpose('Resale');
    setNewCbcaApplied(false);
    setNewRegBookUrl('');
    setShowAddModal(true);
  };

  const openEditVehicleModal = (vehicle: LandedCostSummary) => {
    const vehicleRecord = toVehicleEditorRecord(vehicle);
    setEditingVehicle(vehicleRecord);
    setNewVin(vehicleRecord.vin_number);
    setNewReg(vehicleRecord.reg_number || '');
    setNewModel(vehicleRecord.make_model);
    setNewPrice(vehicleRecord.purchase_price_gbp.toString());
    setNewPurpose(vehicleRecord.purpose || 'Resale');
    setNewCbcaApplied(vehicleRecord.cbca_applied || false);
    setNewRegBookUrl(vehicleRecord.reg_book_url || '');
    setShowAddModal(true);
  };

  const openDeleteDialog = (vehicle: LandedCostSummary) => {
    setVehicleToDelete({
      id: vehicle.vehicle_id,
      make_model: vehicle.make_model,
      vin_number: vehicle.vin_number,
    });
    setShowDeleteDialog(true);
  };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        vin_number: newVin,
        reg_number: newReg,
        make_model: newModel,
        purchase_price_gbp: parseFloat(newPrice),
        status: editingVehicle ? editingVehicle.status : 'UK',
        purpose: newPurpose,
        cbca_applied: newCbcaApplied,
        reg_book_url: newRegBookUrl || null,
      };
      if (editingVehicle) {
        await dataService.updateVehicle(editingVehicle.id, payload);
      } else {
        await dataService.addVehicle(payload);
      }
      setNewVin('');
      setNewReg('');
      setNewModel('');
      setNewPrice('');
      setNewPurpose('Resale');
      setNewCbcaApplied(false);
      setNewRegBookUrl('');
      setEditingVehicle(null);
      setShowAddModal(false);
      try {
        await fetchData();
        notifySuccess(
          editingVehicle ? 'Vehicle updated successfully!' : 'Vehicle added successfully!'
        );
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
        <p className="text-[#525252] font-semibold uppercase tracking-widest text-xs">
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
        <Button type="button" onClick={openAddVehicleModal} leftIcon={<Car size={20} />}>
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
          color="blue"
          footer={
            <div className="flex items-center gap-2 text-sm font-semibold text-[#24a148]">
              <ArrowUp size={16} />
              <span>Healthy Inventory</span>
            </div>
          }
        />

        <DashboardCard
          title="In-Transit Assets"
          value={inTransitCount}
          subtitle="Active routes"
          color="green"
          footer={
            <div className="flex items-center gap-2 text-sm text-[#525252]">
              <Car size={16} />
              <span>Across Namibia & Zimbabwe</span>
            </div>
          }
        />

        <DashboardCard
          title="Fleet Efficiency"
          value="94%"
          subtitle="Operational uptime"
          color="purple"
          footer={
            <div className="w-full h-2 bg-[#e8e8e8] mt-2">
              <div className="h-full bg-[#24a148]" style={{ width: '94%' }} />
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
      <div className="bg-white border border-[#e0e0e0]">
        <div className="px-6 py-4 border-b border-[#e0e0e0] flex justify-between items-center">
          <div>
            <h3 className="m-0 text-base font-semibold text-[#161616]">Current Inventory</h3>
            <p className="mt-1 text-sm text-[#525252]">
              {summaries.length} vehicle{summaries.length !== 1 ? 's' : ''} &bull; {inTransitCount}{' '}
              in transit
            </p>
          </div>
          <div className="text-right">
            <p className="m-0 text-xs text-[#525252] uppercase tracking-wider font-semibold">
              Total Value
            </p>
            <p className="mt-1 text-xl font-semibold text-[#161616] tabular-nums">
              ${totalValuation.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#f4f4f4] border-b border-[#e0e0e0]">
                <th className="px-6 py-4 text-left font-semibold text-[#525252] uppercase text-xs tracking-wider">
                  Asset / VIN
                </th>
                <th className="px-6 py-4 text-left font-semibold text-[#525252] uppercase text-xs tracking-wider">
                  Region
                </th>
                <th className="px-6 py-4 text-left font-semibold text-[#525252] uppercase text-xs tracking-wider">
                  Purchase Cost
                </th>
                <th className="px-6 py-4 text-left font-semibold text-[#525252] uppercase text-xs tracking-wider">
                  Landed Cost
                </th>
              </tr>
            </thead>
            <tbody>
              {summaries.map(s => (
                <tr
                  key={s.vehicle_id}
                  className="border-b border-[#e0e0e0] hover:bg-[#f4f4f4] transition-colors group"
                >
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-semibold text-[#161616]">{s.make_model}</span>
                      <span className="font-mono text-xs text-[#525252] uppercase">
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
                            ? '#e0e0e0'
                            : s.status === 'Namibia'
                              ? '#f1c21b'
                              : s.status === 'Zimbabwe'
                                ? '#24a148'
                                : s.status === 'Botswana'
                                  ? '#8a3ffc'
                                  : '#D97706',
                        color: s.status === 'UK' || s.status === 'Namibia' ? '#161616' : '#ffffff',
                      }}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[#525252] tabular-nums">
                    £{s.purchase_price_gbp.toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="font-semibold text-[#161616] tabular-nums">
                          $
                          {s.total_landed_cost_usd.toLocaleString(undefined, {
                            maximumFractionDigits: 0,
                          })}
                        </span>
                        <span className="text-xs text-[#525252] uppercase tracking-wider">
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
                          className="p-2 bg-transparent border-none cursor-pointer text-[#da1e28] opacity-0 group-hover:opacity-100 transition-opacity"
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

      {/* Delete Vehicle Confirmation - Custom Modal */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white w-full max-w-lg mx-4 shadow-lg">
            <div className="px-6 py-4 border-b border-[#e0e0e0]">
              <h3 className="text-lg font-semibold text-[#161616]">Delete Vehicle?</h3>
            </div>
            <div className="px-6 py-6 flex flex-col gap-4">
              {vehicleToDelete && (
                <>
                  <p className="text-[#161616]">
                    Are you sure you want to delete <strong>{vehicleToDelete.make_model}</strong>?
                  </p>
                  <p className="font-mono text-sm text-[#525252]">
                    VIN: {vehicleToDelete.vin_number}
                  </p>
                  <div className="p-4" style={{ background: '#f1c21b' }}>
                    <p className="m-0 text-sm font-semibold text-[#161616]">
                      Warning: This action cannot be undone. All associated expenses will also be
                      deleted.
                    </p>
                  </div>
                </>
              )}
            </div>
            <div className="px-6 py-4 flex justify-end gap-2 bg-[#f4f4f4]">
              <button
                type="button"
                onClick={() => setShowDeleteDialog(false)}
                className="px-4 py-2 text-sm font-semibold text-[#161616] bg-transparent border border-[#c6c6c6] hover:bg-[#e8e8e8] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteVehicle}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#da1e28] hover:bg-red-700 transition-colors"
              >
                Delete Vehicle
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer />
    </div>
  );
};

export default VehiclesTab;
