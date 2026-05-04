import React, { useEffect, useMemo, useState } from 'react';
import {
  DollarSign,
  Car,
  Users,
  User,
  UserPlus,
  FileText,
  Map,
  Receipt,
  Truck,
  Wrench,
  TrendingUp,
} from 'lucide-react';
import {
  LandedCostSummary,
  VehicleStatus,
  Currency,
  Client,
  Employee,
  Payslip,
  CompanyDetails,
  OperatingFund,
  UserRole,
  AppUser,
  Expense,
  Vehicle,
  ExpenseCategory,
  Trip,
  Invoice,
} from '../types';
import { dataService } from '../services/dataService';
import { useSession } from '../contexts/SessionContext';
import { AssetRegister } from './AssetRegister';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmModal';
import {
  Button,
  DashboardPageHeader,
  DashboardKpiCard,
  DashboardSection,
} from './ui';
import AdminFundsView from './admin/AdminFundsView';
import AdminClientsView from './admin/AdminClientsView';
import AdminDriverEntriesView from './admin/AdminDriverEntriesView';
import AdminEmployeesView from './admin/AdminEmployeesView';
import AdminOverviewView from './admin/AdminOverviewView';
import { ClientFormModalWithBalance, useClientCrud } from './client-directory';
import DashboardSectionSwitcher from './shared/DashboardSectionSwitcher';
import EmployeeFormModal, {
  createEmptyEmployeeForm,
  toEmployeeFormValue,
  type EmployeeFormValue,
} from './shared/EmployeeFormModal';
import ReportsTab from './admin/ReportsTab';
import ExpenseEntryModal, { type ExpenseEntryFormValue } from './shared/ExpenseEntryModal';
import OperatingFundEntryModal, {
  type OperatingFundFormValue,
} from './shared/OperatingFundEntryModal';
import PayslipFormModal, {
  createEmptyPayslipForm,
  type PayslipFormValue,
} from './shared/PayslipFormModal';
import PayslipsListView from './shared/PayslipsListView';
import TripPlannerModal, {
  createEmptyTripForm,
  type TripFormValue,
} from './shared/TripPlannerModal';
import VehicleFormModal, { type VehicleFormValue } from './shared/VehicleFormModal';
import AdminTripsView from './admin/AdminTripsView';
import { buildDriverFundsReportData } from '../utils/driverFunds';
import { toVehicleEditorRecord, type VehicleEditorRecord } from '../utils/dashboardViewModels';
import { tripPlannerFormSchema, getFirstValidationMessage } from '../utils/clientValidation';
import { ZodError } from 'zod';

export type AdminDashboardView =
  | 'dashboard'
  | 'reports'
  | 'clients'
  | 'employees'
  | 'driver-entries'
  | 'payslips'
  | 'funds'
  | 'trips'
  | 'assets';

export interface AdminDashboardProps {
  initialView?: AdminDashboardView;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ initialView = 'dashboard' }) => {
  const truncateValue = (
    value: string | null | undefined,
    length: number,
    fallback: string = '-'
  ) => (value ? value.slice(0, length) : fallback);
  const { showToast, ToastContainer } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const [summaries, setSummaries] = useState<LandedCostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showDeleteVehicleDialog, setShowDeleteVehicleDialog] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState<{
    id: string;
    make_model: string;
    vin_number: string;
  } | null>(null);
  const [activeView, setActiveView] = useState<AdminDashboardView>(initialView);
  useEffect(() => {
    setActiveView(initialView);
  }, [initialView]);
  const session = useSession();
  const userRole: UserRole = session?.user?.role ?? 'Admin';
  const userName: string = session?.user?.name ?? '';
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [shipments, setShipments] = useState<any[]>([]);

  // Clients state
  const [clients, setClients] = useState<Client[]>([]);

  const crud = useClientCrud({
    addClient: (c) => setClients(prev => [...prev, c]),
    patchClient: (id, partial) => setClients(prev => prev.map(c => c.id === id ? { ...c, ...partial } : c)),
    removeClient: (id) => setClients(prev => prev.filter(c => c.id !== id)),
    showToast,
    confirm,
    onDeleteSelected: () => {},
  });

  // Employees state
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeForm, setEmployeeForm] = useState<EmployeeFormValue>(createEmptyEmployeeForm());

  // Payslips state
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [payslipForm, setPayslipForm] = useState<PayslipFormValue>(createEmptyPayslipForm());

  // Operating Funds state - Track money received from office and disbursements
  const [operatingFunds, setOperatingFunds] = useState<OperatingFund[]>([]);
  const [fundsBalance, setFundsBalance] = useState<{
    received: number;
    disbursed: number;
    balance: number;
  }>({ received: 0, disbursed: 0, balance: 0 });
  const [showFundsModal, setShowFundsModal] = useState(false);
  const [fundsForm, setFundsForm] = useState({
    type: 'Received' as 'Received' | 'Disbursed',
    amount: '',
    currency: 'USD' as 'USD' | 'NAD' | 'GBP' | 'BWP',
    description: '',
    reference: '',
    recipient: '',
    date: new Date().toISOString().split('T')[0],
  });

  // Vehicle Form State
  const [newVin, setNewVin] = useState('');
  const [newReg, setNewReg] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newPurpose, setNewPurpose] = useState<'Resale' | 'Client'>('Resale');
  const [newCbcaApplied, setNewCbcaApplied] = useState(false);
  const [newRegBookUrl, setNewRegBookUrl] = useState('');
  const [editingVehicle, setEditingVehicle] = useState<VehicleEditorRecord | null>(null);

  // Expense Form State
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<AppUser[]>([]);
  const [company, setCompany] = useState<CompanyDetails | null>(null);
  const [expenseVehicle, setExpenseVehicle] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCurrency, setExpenseCurrency] = useState<Currency>('NAD');
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory>('Fuel');
  const [expenseLocation, setExpenseLocation] = useState<VehicleStatus>('Namibia');
  const [expenseDriver, setExpenseDriver] = useState<string>('');
  const [trips, setTrips] = useState<Trip[]>([]);
  const [showTripModal, setShowTripModal] = useState(false);
  const [isSavingTrip, setIsSavingTrip] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [tripForm, setTripForm] = useState<TripFormValue>(createEmptyTripForm());

  const notifySuccess = (message: string) => showToast(message, 'success');
  const notifyError = (message: string) => showToast(message, 'error');
  const notifyWarning = (message: string) => showToast(message, 'warning');

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

  const operatingFundFormValue: OperatingFundFormValue = { ...fundsForm };
  const handleOperatingFundFormChange = (updates: Partial<OperatingFundFormValue>) => {
    setFundsForm(prev => ({ ...prev, ...updates }));
  };

  const handleEmployeeFormChange = (updates: Partial<EmployeeFormValue>) => {
    setEmployeeForm(prev => ({ ...prev, ...updates }));
  };

  const handlePayslipFormChange = (updates: Partial<PayslipFormValue>) => {
    setPayslipForm(prev => ({ ...prev, ...updates }));
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

  const handleTripFormChange = (updates: Partial<TripFormValue>) => {
    setTripForm(prev => ({ ...prev, ...updates }));
  };

  // FIX: fetchData now throws errors instead of swallowing them silently
  // This ensures callers can handle refresh failures appropriately
  const fetchData = async (throwOnError = false) => {
    try {
      const [
        data,
        vehicleData,
        expenseData,
        clientData,
        employeeData,
        payslipData,
        companyData,
        fundsData,
        balanceData,
        userData,
        tripData,
        invoiceData,
        shipmentData,
      ] = await Promise.all([
        dataService.getLandedCostSummaries(),
        dataService.getVehicles(),
        dataService.getExpenses(),
        dataService.getClients(),
        dataService.getEmployees(),
        dataService.getPayslips(),
        dataService.getCompanyDetails(),
        dataService.getOperatingFunds(),
        dataService.getOperatingFundsBalance(),
        dataService.getUsers(),
        dataService.getTrips(),
        dataService.getInvoices().catch(() => [] as Invoice[]),
        dataService.getShipments().catch(() => [] as any[]),
      ]);
      setSummaries(data);
      setVehicles(vehicleData);
      setExpenses(expenseData);
      setInvoices(invoiceData);
      setShipments(shipmentData);
      setClients(clientData);
      setEmployees(employeeData);
      setPayslips(payslipData);
      setCompany(companyData);
      setOperatingFunds(fundsData);
      setFundsBalance(balanceData);
      setDrivers(userData.filter(user => user.role === 'Driver' && user.status === 'Active'));
      setTrips(tripData);
      setLoading(false);
    } catch (error: any) {
      console.error('[AdminDashboard] fetchData: FAILED to refresh data:', error?.message || error);
      setLoading(false);
      // FIX: Re-throw error when called from save handlers so they can notify user
      if (throwOnError) {
        throw error;
      }
      notifyError('Failed to load dashboard data. Please refresh the page.');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const vehicleData = {
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
        await dataService.updateVehicle(editingVehicle.id, vehicleData);
      } else {
        await dataService.addVehicle(vehicleData);
      }

      // Reset form state
      setNewVin('');
      setNewReg('');
      setNewModel('');
      setNewPrice('');
      setNewPurpose('Resale');
      setNewCbcaApplied(false);
      setNewRegBookUrl('');
      setEditingVehicle(null);
      setShowAddModal(false);

      // FIX: Refresh data with throwOnError=true to catch any refresh failures
      // This ensures user is notified if vehicle was saved but list refresh failed
      try {
        await fetchData(true);
        notifySuccess(
          editingVehicle ? 'Vehicle updated successfully!' : 'Vehicle added successfully!'
        );
      } catch (refreshError: any) {
        // Vehicle was saved but refresh failed - notify user to manually refresh
        console.error(
          '[AdminDashboard] handleSaveVehicle: Vehicle saved but refresh failed:',
          refreshError
        );
        showToast(
          'Vehicle saved but failed to refresh list. Please refresh the page.',
          'warning',
          6000
        );
      }
    } catch (error: any) {
      console.error('[AdminDashboard] handleSaveVehicle: Error saving vehicle:', error);
      notifyError(error.message || 'Failed to save vehicle. Please try again.');
    }
  };

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

  const resetTripModal = () => {
    setEditingTrip(null);
    setTripForm(createEmptyTripForm());
    setShowTripModal(false);
  };

  const populateTripForm = (trip: Trip): TripFormValue => {
    const toInputValue = (value?: string | null) => {
      if (!value) return '';
      const date = new Date(value);
      const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
      return local.toISOString().slice(0, 16);
    };

    return {
      title: trip.title,
      status: trip.status,
      assigned_driver_id: trip.assigned_driver_id || '',
      assigned_vehicle_id: trip.assigned_vehicle_id || '',
      route_origin: trip.route_origin,
      route_destination: trip.route_destination,
      route_waypoints: (trip.route_waypoints || []).join(', '),
      departure_date: toInputValue(trip.departure_date),
      eta_date: toInputValue(trip.eta_date),
      actual_departure_at: toInputValue(trip.actual_departure_at),
      actual_arrival_at: toInputValue(trip.actual_arrival_at),
      notes: trip.notes || '',
    };
  };

  const openCreateTripModal = () => {
    setEditingTrip(null);
    setTripForm(createEmptyTripForm());
    setShowTripModal(true);
  };

  const openEditTripModal = (trip: Trip) => {
    setEditingTrip(trip);
    setTripForm(populateTripForm(trip));
    setShowTripModal(true);
  };

  const handleSaveTrip = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSavingTrip(true);
    try {
      tripPlannerFormSchema.parse(tripForm);

      const payload = {
        title: tripForm.title.trim(),
        status: tripForm.status,
        assigned_driver_id: tripForm.assigned_driver_id || null,
        assigned_vehicle_id: tripForm.assigned_vehicle_id || null,
        route_origin: tripForm.route_origin.trim(),
        route_destination: tripForm.route_destination.trim(),
        route_waypoints: tripForm.route_waypoints
          .split(',')
          .map(value => value.trim())
          .filter(Boolean),
        departure_date: tripForm.departure_date,
        eta_date: tripForm.eta_date,
        actual_departure_at: tripForm.actual_departure_at || null,
        actual_arrival_at: tripForm.actual_arrival_at || null,
        notes: tripForm.notes.trim() || null,
      };

      if (editingTrip) {
        await dataService.updateTrip(editingTrip.id, payload);
      } else {
        await dataService.createTrip(payload as any);
      }

      resetTripModal();
      await fetchData(true);
      notifySuccess(editingTrip ? 'Trip updated successfully!' : 'Trip created successfully!');
    } catch (error: any) {
      console.error('[AdminDashboard] handleSaveTrip error:', error);
      if (error instanceof ZodError) {
        notifyWarning(getFirstValidationMessage(error));
      } else {
        notifyError(error?.message || 'Failed to save trip. Please try again.');
      }
    } finally {
      setIsSavingTrip(false);
    }
  };

  const handleDeleteTrip = async (trip: Trip) => {
    const confirmed = await confirm({
      title: 'Delete Trip',
      message: `Delete ${trip.trip_number} (${trip.title})? This cannot be undone.`,
      confirmLabel: 'Delete Trip',
      cancelLabel: 'Cancel',
      confirmVariant: 'danger',
    });
    if (!confirmed) return;

    try {
      await dataService.deleteTrip(trip.id);
      await fetchData(true);
      notifySuccess('Trip deleted successfully.');
    } catch (error: any) {
      console.error('[AdminDashboard] handleDeleteTrip error:', error);
      notifyError(error?.message || 'Failed to delete trip.');
    }
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

  const openDeleteVehicleDialog = (vehicle: LandedCostSummary) => {
    setVehicleToDelete({
      id: vehicle.vehicle_id,
      make_model: vehicle.make_model,
      vin_number: vehicle.vin_number,
    });
    setShowDeleteVehicleDialog(true);
  };

  const handleDeleteVehicle = async () => {
    if (!vehicleToDelete) return;
    try {
      await dataService.deleteVehicle(vehicleToDelete.id);
      setShowDeleteVehicleDialog(false);
      setVehicleToDelete(null);
      fetchData();
      notifySuccess('Vehicle deleted successfully.');
    } catch (error: any) {
      console.error('Error deleting vehicle:', error);
      if (error.name === 'ValidationError') {
        notifyWarning(error.message);
      } else {
        notifyError('Failed to delete vehicle. Please try again.');
      }
      setShowDeleteVehicleDialog(false);
      setVehicleToDelete(null);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseAmount) return;

    // Validate driver selection for Driver Disbursement
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
    } catch (error) {
      console.error('Error adding expense:', error);
      notifyError('Failed to add expense. Please try again.');
    }
  };

  // Employee CRUD handlers
  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...employeeForm,
        base_pay_usd: parseFloat(employeeForm.base_pay_usd) || 0,
      };
      if (editingEmployee) {
        await dataService.updateEmployee(editingEmployee.id, payload);
      } else {
        const newEmployee = await dataService.createEmployee(payload);
      }
      setShowEmployeeModal(false);
      setEditingEmployee(null);
      setEmployeeForm(createEmptyEmployeeForm());

      // FIX: Await fetchData and handle refresh errors
      try {
        await fetchData(true);
        notifySuccess(
          editingEmployee ? 'Employee updated successfully!' : 'Employee created successfully!'
        );
      } catch (refreshError) {
        console.error(
          '[AdminDashboard] handleSaveEmployee: Employee saved but refresh failed:',
          refreshError
        );
        showToast(
          'Employee saved but failed to refresh list. Please refresh the page.',
          'warning',
          6000
        );
      }
    } catch (error: any) {
      console.error('[AdminDashboard] handleSaveEmployee: Error saving employee:', error);
      notifyError(error?.message || 'Failed to save employee. Please try again.');
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    const approved = await confirm({
      title: 'Delete employee?',
      message: 'This will also delete all associated payslips.',
      confirmLabel: 'Delete Employee',
      confirmVariant: 'danger',
    });

    if (!approved) return;

    try {
      await dataService.deleteEmployee(id);
      await fetchData(true);
      notifySuccess('Employee deleted successfully.');
    } catch (error: any) {
      console.error('[AdminDashboard] handleDeleteEmployee: Error deleting employee:', error);
      notifyError(error?.message || 'Failed to delete employee.');
    }
  };

  // Payslip handlers
  const handleGeneratePayslip = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        employee_id: payslipForm.employee_id,
        month: payslipForm.month,
        year: payslipForm.year,
        base_pay: parseFloat(payslipForm.base_pay) || 0,
        overtime_hours: parseFloat(payslipForm.overtime_hours) || 0,
        overtime_rate: parseFloat(payslipForm.overtime_rate) || 0,
        bonus: parseFloat(payslipForm.bonus) || 0,
        allowances: parseFloat(payslipForm.allowances) || 0,
        commission: parseFloat(payslipForm.commission) || 0,
        tax_deduction: parseFloat(payslipForm.tax_deduction) || 0,
        pension_deduction: parseFloat(payslipForm.pension_deduction) || 0,
        health_insurance: parseFloat(payslipForm.health_insurance) || 0,
        other_deductions: parseFloat(payslipForm.other_deductions) || 0,
        payment_date: payslipForm.payment_date,
        payment_method: payslipForm.payment_method,
        notes: payslipForm.notes,
      };
      const newPayslip = await dataService.generatePayslip(payload);

      setShowPayslipModal(false);
      setPayslipForm(createEmptyPayslipForm());

      // FIX: Await fetchData and handle refresh errors
      try {
        await fetchData(true);
        notifySuccess('Payslip generated successfully!');
      } catch (refreshError) {
        console.error(
          '[AdminDashboard] handleGeneratePayslip: Payslip saved but refresh failed:',
          refreshError
        );
        showToast(
          'Payslip generated but failed to refresh list. Please refresh the page.',
          'warning',
          6000
        );
      }
    } catch (error: any) {
      console.error('[AdminDashboard] handleGeneratePayslip: Error generating payslip:', error);
      notifyError(error?.message || 'Failed to generate payslip. Please try again.');
    }
  };

  const handleUpdatePayslipStatus = async (
    id: string,
    status: 'Generated' | 'Approved' | 'Paid' | 'Cancelled'
  ) => {
    try {
      await dataService.updatePayslipStatus(id, status);
      await fetchData(true);
      const statusLabel =
        status === 'Approved'
          ? 'approved'
          : status === 'Paid'
            ? 'marked as paid'
            : status.toLowerCase();
      notifySuccess(`Payslip ${statusLabel} successfully.`);
    } catch (error: any) {
      console.error(
        '[AdminDashboard] handleUpdatePayslipStatus: Error updating payslip status:',
        error
      );
      notifyError(error?.message || 'Failed to update payslip status.');
    }
  };

  const handleDeletePayslip = async (id: string) => {
    const approved = await confirm({
      title: 'Delete payslip?',
      message: 'This removes the generated payslip record.',
      confirmLabel: 'Delete Payslip',
      confirmVariant: 'danger',
    });

    if (!approved) return;

    try {
      await dataService.deletePayslip(id);
      await fetchData(true);
      notifySuccess('Payslip deleted successfully.');
    } catch (error: any) {
      console.error('[AdminDashboard] handleDeletePayslip: Error deleting payslip:', error);
      notifyError(error?.message || 'Failed to delete payslip.');
    }
  };

  const handleDownloadPayslip = async (payslip: Payslip) => {
    if (!company) {
      notifyError('Company details not loaded. Please try again.');
      return;
    }
    try {
      const { generatePayslipPDFAndDownload } = await import('../services/pdfService');
      await generatePayslipPDFAndDownload(payslip, company);
    } catch (error) {
      console.error('Error generating payslip PDF:', error);
      notifyError('Failed to generate PDF');
    }
  };

  // Operating Funds handlers
  const handleAddOperatingFund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fundsForm.type === 'Disbursed' && !fundsForm.recipient) {
      notifyWarning('Please select the driver receiving this disbursement');
      return;
    }
    try {
      const payload = {
        type: fundsForm.type as 'Received' | 'Disbursed',
        amount: parseFloat(fundsForm.amount) || 0,
        currency: fundsForm.currency,
        description: fundsForm.description,
        reference: fundsForm.reference || undefined,
        recipient: fundsForm.type === 'Disbursed' ? fundsForm.recipient : undefined,
        date: fundsForm.date,
      };

      await dataService.addOperatingFund(payload);

      setShowFundsModal(false);
      setFundsForm({
        type: 'Received',
        amount: '',
        currency: 'USD',
        description: '',
        reference: '',
        recipient: '',
        date: new Date().toISOString().split('T')[0],
      });

      try {
        await fetchData(true);
        notifySuccess(
          fundsForm.type === 'Received'
            ? 'Funds received recorded successfully!'
            : 'Disbursement recorded successfully!'
        );
      } catch (refreshError) {
        console.error(
          '[AdminDashboard] handleAddOperatingFund: Saved but refresh failed:',
          refreshError
        );
        showToast(
          'Transaction saved but failed to refresh. Please refresh the page.',
          'warning',
          6000
        );
      }
    } catch (error: any) {
      console.error('[AdminDashboard] handleAddOperatingFund: Error:', error);
      notifyError(error?.message || 'Failed to record transaction. Please try again.');
    }
  };

  const handleDeleteExpense = async (id: string) => {
    const approved = await confirm({
      title: 'Delete expense entry?',
      message: 'This will permanently remove the expense from the ledger.',
      confirmLabel: 'Delete Entry',
      confirmVariant: 'danger',
    });
    if (!approved) return;

    try {
      await dataService.deleteExpense(id);
      await fetchData(true);
      notifySuccess('Entry deleted successfully.');
    } catch (error: any) {
      console.error('[AdminDashboard] handleDeleteExpense error:', error);
      notifyError(error?.message || 'Failed to delete entry.');
    }
  };

  const handleDeleteOperatingFund = async (id: string) => {
    const approved = await confirm({
      title: 'Delete transaction?',
      message: 'This will remove the operating funds transaction from the ledger.',
      confirmLabel: 'Delete Transaction',
      confirmVariant: 'danger',
    });

    if (!approved) return;

    try {
      await dataService.deleteOperatingFund(id);
      await fetchData(true);
      notifySuccess('Transaction deleted successfully!');
    } catch (error: any) {
      console.error('[AdminDashboard] handleDeleteOperatingFund: Error:', error);
      notifyError(error?.message || 'Failed to delete transaction.');
    }
  };

  const handleExportDriverFundsReport = async () => {
    if (!company) {
      notifyWarning('Company details are still loading. Please try again in a moment.');
      return;
    }

    try {
      const { generateDriverFundsReportPDFAndDownload } = await import('../services/pdfService');
      await generateDriverFundsReportPDFAndDownload(
        expenses,
        operatingFunds,
        drivers,
        vehicles,
        company
      );
      notifySuccess('Driver funds report PDF downloaded!');
    } catch (error: any) {
      console.error('[AdminDashboard] handleExportDriverFundsReport:', error);
      notifyError(error?.message || 'Failed to export the driver funds report.');
    }
  };

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

  // ── Top-line KPIs for the dashboard shell ───────────────────────────
  // Revenue MTD: sum of paid invoices in the current month
  // Outstanding: count of unpaid (Sent + Overdue)
  // Active Shipments: in-transit + pending
  // Vehicle Utilization: % of fleet not sold (analog for true utilization)
  const dashboardKpis = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const revenueMtd = invoices
      .filter(invoice => invoice.status === 'Paid')
      .filter(invoice => {
        const created = invoice.created_at ? new Date(invoice.created_at).getTime() : 0;
        return created >= monthStart;
      })
      .reduce((sum, invoice) => sum + (invoice.amount_usd || 0), 0);

    const outstandingInvoices = invoices.filter(
      invoice => invoice.status === 'Sent' || invoice.status === 'Overdue'
    ).length;

    const activeShipments = shipments.filter(
      shipment => shipment.status === 'In Transit' || shipment.status === 'Pending'
    ).length;

    const totalVehicles = summaries.length;
    const activeVehicles = summaries.filter(s => s.status !== 'Sold').length;
    const utilizationPct =
      totalVehicles > 0 ? Math.round((activeVehicles / totalVehicles) * 100) : 0;

    const fmtCompact = (n: number) => {
      if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
      if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
      return `$${n.toFixed(0)}`;
    };

    return {
      revenueMtd,
      revenueMtdLabel: fmtCompact(revenueMtd),
      outstandingInvoices,
      activeShipments,
      utilizationLabel: totalVehicles === 0 ? '-' : `${utilizationPct}%`,
      utilizationTrend:
        totalVehicles === 0
          ? 'No fleet data'
          : `${activeVehicles} of ${totalVehicles} active`,
    };
  }, [invoices, shipments, summaries]);

  const driverFundsReport = useMemo(
    () => buildDriverFundsReportData(expenses, operatingFunds, drivers, vehicles),
    [drivers, expenses, operatingFunds, vehicles]
  );

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '24rem',
          gap: '1rem',
        }}
      >
        <div
          className="animate-spin"
          style={{
            width: '3rem',
            height: '3rem',
            border: '2px solid #2563eb',
            borderTopColor: 'transparent',
            borderRadius: '50%',
          }}
        ></div>
        <p
          style={{
            color: '#52525b',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontSize: '0.75rem',
          }}
        >
          Initializing Fleet Data
        </p>
      </div>
    );
  }

  const adminViewOptions: Array<{
    id: AdminDashboardView;
    label: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'dashboard',
      label: 'Fleet',
      icon: <Car size={16} />,
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: <FileText size={16} />,
    },
    {
      id: 'clients',
      label: 'Clients',
      icon: <Users size={16} />,
    },
    {
      id: 'employees',
      label: 'Employees',
      icon: <User size={16} />,
    },
    {
      id: 'driver-entries',
      label: 'Driver Entries',
      icon: <Receipt size={16} />,
    },
    {
      id: 'payslips',
      label: 'Payslips',
      icon: <FileText size={16} />,
    },
    {
      id: 'funds',
      label: 'Operating Funds',
      icon: <DollarSign size={16} />,
    },
    {
      id: 'trips',
      label: 'Trip Planner',
      icon: <Map size={16} />,
    },
    {
      id: 'assets',
      label: 'Asset Register',
      icon: <Car size={16} />,
    },
  ];

  const activeViewLabel =
    adminViewOptions.find(option => option.id === activeView)?.label ?? 'Dashboard';

  const activeViewActions = (() => {
    switch (activeView) {
      case 'dashboard':
        return (
          <>
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
          </>
        );
      case 'clients':
        return (
          <Button type="button" onClick={crud.openAdd} leftIcon={<UserPlus size={16} />}>
            Add Client
          </Button>
        );
      case 'employees':
        return (
          <Button
            type="button"
            onClick={() => {
              setEditingEmployee(null);
              setEmployeeForm(createEmptyEmployeeForm());
              setShowEmployeeModal(true);
            }}
            leftIcon={<User size={20} />}
          >
            Add Employee
          </Button>
        );
      case 'payslips':
        return (
          <Button
            type="button"
            onClick={() => {
              setPayslipForm(createEmptyPayslipForm());
              setShowPayslipModal(true);
            }}
            leftIcon={<FileText size={20} />}
          >
            Generate Payslip
          </Button>
        );
      case 'funds':
        return (
          <Button
            type="button"
            onClick={() => {
              setFundsForm({
                type: 'Received',
                amount: '',
                currency: 'USD',
                description: '',
                reference: '',
                recipient: '',
                date: new Date().toISOString().split('T')[0],
              });
              setShowFundsModal(true);
            }}
            leftIcon={<DollarSign size={20} />}
          >
            Record Transaction
          </Button>
        );
      case 'trips':
        return (
          <Button type="button" onClick={openCreateTripModal} leftIcon={<Map size={20} />}>
            Create Trip
          </Button>
        );
      default:
        return null;
    }
  })();

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Admin Dashboard"
        subtitle={
          userName
            ? `Welcome back, ${userName}`
            : 'Fleet, clients, employees & payroll management'
        }
        actions={
          <>
            <DashboardSectionSwitcher
              value={activeView}
              onChange={setActiveView}
              label="Section"
              options={adminViewOptions}
            />
            {activeViewActions}
          </>
        }
      />

      {/* Top-line KPI grid — rendered for every view so the shell stays consistent */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <DashboardKpiCard
          label="Revenue MTD"
          value={dashboardKpis.revenueMtdLabel}
          icon={DollarSign}
          iconTone="amber"
          trend="Paid invoices this month"
          trendIcon={<TrendingUp className="h-4 w-4" />}
        />
        <DashboardKpiCard
          label="Outstanding Invoices"
          value={dashboardKpis.outstandingInvoices}
          icon={FileText}
          iconTone="rose"
          trend="Sent or overdue"
        />
        <DashboardKpiCard
          label="Active Shipments"
          value={dashboardKpis.activeShipments}
          icon={Truck}
          iconTone="blue"
          trend="In transit or pending"
        />
        <DashboardKpiCard
          label="Vehicle Utilization"
          value={dashboardKpis.utilizationLabel}
          icon={Wrench}
          iconTone="emerald"
          trend={dashboardKpis.utilizationTrend}
        />
      </div>

      <DashboardSection title={activeViewLabel}>
        {activeView === 'dashboard' && (
          <AdminOverviewView
            summaries={summaries}
            statusData={statusData}
            onEditVehicle={openEditVehicleModal}
            onDeleteVehicle={openDeleteVehicleDialog}
          />
        )}

        {activeView === 'reports' && <ReportsTab />}

        {activeView === 'clients' && (
          <AdminClientsView
            clients={clients}
            onEditClient={crud.openEdit}
            onDeleteClient={(id) => {
              const client = clients.find(c => c.id === id);
              if (client) crud.handleDelete(client);
            }}
          />
        )}

        {activeView === 'employees' && (
          <AdminEmployeesView
            employees={employees}
            onEditEmployee={employee => {
              setEditingEmployee(employee);
              setEmployeeForm(toEmployeeFormValue(employee));
              setShowEmployeeModal(true);
            }}
            onDeleteEmployee={handleDeleteEmployee}
          />
        )}

        {activeView === 'driver-entries' && (
          <AdminDriverEntriesView
            expenses={expenses}
            vehicles={vehicles}
            drivers={drivers}
            onDeleteExpense={handleDeleteExpense}
          />
        )}

        {activeView === 'payslips' && (
          <PayslipsListView
            payslips={payslips}
            onApprove={id => handleUpdatePayslipStatus(id, 'Approved')}
            onMarkPaid={id => handleUpdatePayslipStatus(id, 'Paid')}
            onDownload={handleDownloadPayslip}
            onDelete={handleDeletePayslip}
          />
        )}

        {activeView === 'funds' && (
          <AdminFundsView
            fundsBalance={fundsBalance}
            operatingFunds={operatingFunds}
            driverFundsReport={driverFundsReport}
            onDeleteOperatingFund={handleDeleteOperatingFund}
            onExportDriverFundsReport={handleExportDriverFundsReport}
          />
        )}

        {activeView === 'trips' && (
          <AdminTripsView
            trips={trips}
            onEditTrip={openEditTripModal}
            onDeleteTrip={handleDeleteTrip}
          />
        )}

        {activeView === 'assets' && <AssetRegister userRole={userRole} />}
      </DashboardSection>

      <TripPlannerModal
        isOpen={showTripModal}
        mode={editingTrip ? 'edit' : 'create'}
        form={tripForm}
        drivers={drivers}
        vehicles={vehicles}
        isSubmitting={isSavingTrip}
        onChange={handleTripFormChange}
        onClose={resetTripModal}
        onSubmit={handleSaveTrip}
      />

      <OperatingFundEntryModal
        isOpen={showFundsModal}
        title="Record Transaction"
        onClose={() => setShowFundsModal(false)}
        onSubmit={handleAddOperatingFund}
        form={operatingFundFormValue}
        onChange={handleOperatingFundFormChange}
        drivers={drivers}
        currencyOptions={['USD', 'NAD', 'GBP', 'BWP']}
        accent="emerald"
        typeSelectorVariant="cards"
        submitLabel={type => (type === 'Received' ? 'Record Receipt' : 'Record Disbursement')}
      />

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

      <ClientFormModalWithBalance
        isOpen={crud.isOpen}
        title={crud.editing ? 'Edit Client' : 'Add New Client'}
        onClose={crud.close}
        onSubmit={crud.handleSave}
        form={crud.form}
        onChange={crud.setFormField}
        submitLabel={crud.editing ? 'Save Changes' : 'Create Client'}
        isSubmitting={crud.isSubmitting}
      />

      <EmployeeFormModal
        isOpen={showEmployeeModal}
        title={editingEmployee ? 'Edit Employee' : 'Add New Employee'}
        onClose={() => setShowEmployeeModal(false)}
        onSubmit={handleSaveEmployee}
        form={employeeForm}
        onChange={handleEmployeeFormChange}
      />

      <PayslipFormModal
        isOpen={showPayslipModal}
        title="Generate Payslip"
        onClose={() => setShowPayslipModal(false)}
        onSubmit={handleGeneratePayslip}
        form={payslipForm}
        onChange={handlePayslipFormChange}
        employees={employees}
      />

      {/* Delete Vehicle Confirmation Dialog */}
      {showDeleteVehicleDialog && vehicleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            onClick={() => setShowDeleteVehicleDialog(false)}
          ></div>
          <div className="relative bg-white  p-8 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4">
              <svg
                className="w-6 h-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h3 className="text-2xl font-black text-zinc-900 mb-2">Delete Vehicle?</h3>
            <p className="text-zinc-600 mb-4">
              Are you sure you want to delete{' '}
              <span className="font-bold">{vehicleToDelete.make_model}</span> (VIN:{' '}
              {vehicleToDelete.vin_number})?
            </p>
            <div className="bg-amber-50 border border-amber-200  p-4 mb-6">
              <div className="flex items-start gap-2">
                <svg
                  className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <p className="text-sm font-bold text-amber-800">Warning</p>
                  <p className="text-xs text-amber-700 mt-1">
                    This action cannot be undone. All associated expenses will also be deleted.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteVehicleDialog(false)}
                className="flex-1 px-6 py-3  font-bold text-sm text-zinc-700 border border-zinc-200 hover:bg-zinc-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteVehicle}
                className="flex-1 px-6 py-3  font-bold text-sm bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Delete Vehicle
              </button>
            </div>
          </div>
        </div>
      )}
      <ToastContainer />
      <ConfirmDialog />
    </div>
  );
};
