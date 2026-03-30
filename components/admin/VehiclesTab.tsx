import React, { useEffect, useMemo, useState } from 'react';
import { LandedCostSummary, Currency, ExpenseCategory, VehicleStatus, AppUser, Vehicle, Expense } from '../../types';
import { dataService } from '../../services/dataService';
import { useToast } from '../Toast';
import { Button, InsightPanel, MetricBarList, RankedMetricList, DashboardCard } from '../ui';
import { toVehicleEditorRecord, type VehicleEditorRecord } from '../../utils/dashboardViewModels';
import ExpenseEntryModal, { type ExpenseEntryFormValue } from '../shared/ExpenseEntryModal';
import VehicleFormModal, { type VehicleFormValue } from '../shared/VehicleFormModal';
import { Money, Car, ArrowUp, TrashCan, Edit } from '@carbon/icons-react';
import { Tile, Modal, Stack } from '@carbon/react';

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

  const totalValuation = summaries.reduce((acc, s) => acc + s.total_landed_cost_usd, 0);
  const inTransitCount = summaries.filter(s => s.status !== 'Sold').length;

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '16rem', gap: '1rem' }}>
        <div className="animate-spin" style={{ width: '2.5rem', height: '2.5rem', border: '2px solid var(--cds-interactive, #0f62fe)', borderTopColor: 'transparent', borderRadius: '50%' }}></div>
        <p style={{ color: 'var(--cds-text-secondary, #525252)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.75rem' }}>Loading Fleet Data</p>
      </div>
    );
  }

  return (
    <Stack gap={8}>
      {/* Action buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setShowExpenseModal(true)}
          leftIcon={<Money size={20} />}
        >
          Add Expense
        </Button>
        <Button
          type="button"
          onClick={openAddVehicleModal}
          leftIcon={<Vehicle size={20} />}
        >
          Add Vehicle
        </Button>
      </div>

      {/* Analytics Cards - Carbon compliant */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        <DashboardCard
          title="Total Asset Valuation"
          value={`$${totalValuation.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          subtitle="Fleet book value"
          color="blue"
          footer={
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--cds-support-success, #24a148)', fontSize: '0.875rem', fontWeight: 600 }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--cds-text-secondary, #525252)', fontSize: '0.875rem' }}>
              <Vehicle size={16} />
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
            <div style={{ width: '100%', height: 8, background: 'var(--cds-layer-accent-01, #e8e8e8)', marginTop: '0.5rem' }}>
              <div style={{ width: '94%', height: '100%', background: 'var(--cds-support-success, #24a148)' }} />
            </div>
          }
        />
      </div>

      {/* Analytics Panels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
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
          subtitle="Fleet distribution by operating region and status."
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

      {/* Inventory Table - Carbon styled */}
      <Tile style={{ padding: 0 }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--cds-border-subtle, #e0e0e0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--cds-text-primary, #161616)' }}>Current Inventory</h3>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--cds-text-secondary, #525252)' }}>
              {summaries.length} vehicle{summaries.length !== 1 ? 's' : ''} &bull; {inTransitCount} in transit
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--cds-text-secondary, #525252)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Total Value</p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '1.25rem', fontWeight: 600, color: 'var(--cds-text-primary, #161616)', fontVariantNumeric: 'tabular-nums' }}>
              ${totalValuation.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'var(--cds-layer-02, #f4f4f4)', borderBottom: '1px solid var(--cds-border-subtle, #e0e0e0)' }}>
                <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontWeight: 600, color: 'var(--cds-text-secondary, #525252)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Asset / VIN</th>
                <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontWeight: 600, color: 'var(--cds-text-secondary, #525252)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Region</th>
                <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontWeight: 600, color: 'var(--cds-text-secondary, #525252)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Purchase Cost</th>
                <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontWeight: 600, color: 'var(--cds-text-secondary, #525252)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Landed Cost</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s) => (
                <tr
                  key={s.vehicle_id}
                  style={{ borderBottom: '1px solid var(--cds-border-subtle, #e0e0e0)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--cds-layer-hover, #f4f4f4)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600, color: 'var(--cds-text-primary, #161616)' }}>{s.make_model}</span>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--cds-text-secondary, #525252)', textTransform: 'uppercase' }}>{s.vin_number}</span>
                    </div>
                  </td>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.75rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        background:
                          s.status === 'UK'
                            ? 'var(--cds-layer-02, #e0e0e0)'
                            : s.status === 'Namibia'
                            ? 'var(--cds-support-warning, #f1c21b)'
                            : s.status === 'Zimbabwe'
                            ? 'var(--cds-support-success, #24a148)'
                            : s.status === 'Botswana'
                            ? '#8a3ffc'
                            : 'var(--cds-support-info, #0f62fe)',
                        color:
                          s.status === 'UK'
                            ? 'var(--cds-text-primary, #161616)'
                            : s.status === 'Namibia'
                            ? 'var(--cds-text-primary, #161616)'
                            : '#ffffff',
                      }}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td style={{ padding: '1rem 1.5rem', color: 'var(--cds-text-secondary, #525252)', fontVariantNumeric: 'tabular-nums' }}>
                    £{s.purchase_price_gbp.toLocaleString()}
                  </td>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600, color: 'var(--cds-text-primary, #161616)', fontVariantNumeric: 'tabular-nums' }}>
                          ${s.total_landed_cost_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary, #525252)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Valuation</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <button
                          onClick={() => openEditVehicleModal(s)}
                          style={{
                            padding: '0.5rem',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--cds-interactive, #0f62fe)',
                            opacity: 0,
                            transition: 'opacity 0.15s',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
                          title="Edit vehicle"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => openDeleteDialog(s)}
                          style={{
                            padding: '0.5rem',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--cds-support-error, #da1e28)',
                            opacity: 0,
                            transition: 'opacity 0.15s',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
                          title="Delete vehicle"
                        >
                          <TrashCan size={16} />
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Tile>

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

      {/* Delete Vehicle Confirmation - Carbon Modal */}
      <Modal
        open={showDeleteDialog}
        modalHeading="Delete Vehicle?"
        primaryButtonText="Delete Vehicle"
        secondaryButtonText="Cancel"
        danger
        onRequestClose={() => setShowDeleteDialog(false)}
        onRequestSubmit={handleDeleteVehicle}
      >
        {vehicleToDelete && (
          <Stack gap={4}>
            <p style={{ color: 'var(--cds-text-primary, #161616)' }}>
              Are you sure you want to delete <strong>{vehicleToDelete.make_model}</strong>?
            </p>
            <p style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: 'var(--cds-text-secondary, #525252)' }}>
              VIN: {vehicleToDelete.vin_number}
            </p>
            <Tile style={{ background: 'var(--cds-support-warning, #f1c21b)', padding: '1rem' }}>
              <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--cds-text-primary, #161616)' }}>
                Warning: This action cannot be undone. All associated expenses will also be deleted.
              </p>
            </Tile>
          </Stack>
        )}
      </Modal>

      <ToastContainer />
    </Stack>
  );
};

export default VehiclesTab;
