
import React, { useEffect, useMemo, useState } from 'react';
import { LandedCostSummary, VehicleStatus, Currency, Client, Employee, Payslip, CompanyDetails, OperatingFund, UserRole, AppUser, Expense, Vehicle, ExpenseCategory } from '../types';
import { supabase } from '../services/supabaseService';
import { AssetRegister } from './AssetRegister';
import { generateDriverFundsReportPDFAndDownload, generatePayslipPDFAndDownload } from '../services/pdfService';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmModal';
import AdminFundsView from './admin/AdminFundsView';
import AdminClientsView from './admin/AdminClientsView';
import AdminEmployeesView from './admin/AdminEmployeesView';
import AdminOverviewView from './admin/AdminOverviewView';
import ReportsTab from './admin/ReportsTab';
import ExpenseEntryModal, { type ExpenseEntryFormValue } from './shared/ExpenseEntryModal';
import OperatingFundEntryModal, { type OperatingFundFormValue } from './shared/OperatingFundEntryModal';
import PayslipsListView from './shared/PayslipsListView';
import { buildDriverFundsReportData } from '../utils/driverFunds';
import { toVehicleEditorRecord, type VehicleEditorRecord } from '../utils/dashboardViewModels';
import { getMonthName } from '../utils/formatters';

export const AdminDashboard: React.FC = () => {
  const truncateValue = (value: string | null | undefined, length: number, fallback: string = '-') =>
    value ? value.slice(0, length) : fallback;
  const { showToast, ToastContainer } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const [summaries, setSummaries] = useState<LandedCostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showDeleteVehicleDialog, setShowDeleteVehicleDialog] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState<{ id: string; make_model: string; vin_number: string } | null>(null);
  const [activeView, setActiveView] = useState<'dashboard' | 'reports' | 'clients' | 'employees' | 'payslips' | 'funds' | 'assets'>('dashboard');
  const [userRole, setUserRole] = useState<UserRole>('Admin');
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // Clients state
  const [clients, setClients] = useState<Client[]>([]);
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientForm, setClientForm] = useState({
    name: '', email: '', phone: '', address: '', company: '', notes: ''
  });

  // Employees state
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeForm, setEmployeeForm] = useState({
    name: '', email: '', phone: '', department: '', position: '',
    base_pay_usd: '', currency: 'USD' as 'USD' | 'NAD' | 'GBP' | 'BWP',
    employment_type: 'Full-time' as 'Full-time' | 'Part-time' | 'Contract' | 'Intern',
    date_hired: '', national_id: '', bank_account: '', bank_name: '', tax_number: ''
  });

  // Payslips state
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [payslipForm, setPayslipForm] = useState({
    employee_id: '', month: new Date().getMonth() + 1, year: new Date().getFullYear(),
    base_pay: '', overtime_hours: '', overtime_rate: '', bonus: '', allowances: '', commission: '',
    tax_deduction: '', pension_deduction: '', health_insurance: '', other_deductions: '',
    payment_date: '', payment_method: 'Bank Transfer' as string, notes: ''
  });

  // Operating Funds state - Track money received from office and disbursements
  const [operatingFunds, setOperatingFunds] = useState<OperatingFund[]>([]);
  const [fundsBalance, setFundsBalance] = useState<{ received: number; disbursed: number; balance: number }>({ received: 0, disbursed: 0, balance: 0 });
  const [showFundsModal, setShowFundsModal] = useState(false);
  const [fundsForm, setFundsForm] = useState({
    type: 'Received' as 'Received' | 'Disbursed',
    amount: '',
    currency: 'USD' as 'USD' | 'NAD' | 'GBP' | 'BWP',
    description: '',
    reference: '',
    recipient: '',
    date: new Date().toISOString().split('T')[0]
  });

  // Vehicle Form State
  const [newVin, setNewVin] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newPrice, setNewPrice] = useState('');
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
    setFundsForm((prev) => ({ ...prev, ...updates }));
  };

  // FIX: fetchData now throws errors instead of swallowing them silently
  // This ensures callers can handle refresh failures appropriately
  const fetchData = async (throwOnError = false) => {
    try {
      const [data, vehicleData, expenseData, clientData, employeeData, payslipData, companyData, fundsData, balanceData, userData] = await Promise.all([
        supabase.getLandedCostSummaries(),
        supabase.getVehicles(),
        supabase.getExpenses(),
        supabase.getClients(),
        supabase.getEmployees(),
        supabase.getPayslips(),
        supabase.getCompanyDetails(),
        supabase.getOperatingFunds(),
        supabase.getOperatingFundsBalance(),
        supabase.getUsers()
      ]);
      setSummaries(data);
      setVehicles(vehicleData);
      setExpenses(expenseData);
      setClients(clientData);
      setEmployees(employeeData);
      setPayslips(payslipData);
      setCompany(companyData);
      setOperatingFunds(fundsData);
      setFundsBalance(balanceData);
      setDrivers(userData.filter((user) => user.role === 'Driver' && user.status === 'Active'));
      setLoading(false);
    } catch (error: any) {
      console.error('[AdminDashboard] fetchData: FAILED to refresh data:', error?.message || error);
      setLoading(false);
      // FIX: Re-throw error when called from save handlers so they can notify user
      if (throwOnError) {
        throw error;
      }
    }
  };

  useEffect(() => {
    fetchData();
    // Get current user role
    supabase.getSession().then(session => {
      if (session?.user?.role) {
        setUserRole(session.user.role);
      }
    }).catch((err: unknown) => console.error('[AdminDashboard] getSession failed:', err));
  }, []);

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const vehicleData = {
        vin_number: newVin,
        make_model: newModel,
        purchase_price_gbp: parseFloat(newPrice),
        status: editingVehicle ? editingVehicle.status : 'UK'
      };

      if (editingVehicle) {
        await supabase.updateVehicle(editingVehicle.id, vehicleData);
      } else {
        await supabase.addVehicle(vehicleData);
      }

      // Reset form state
      setNewVin('');
      setNewModel('');
      setNewPrice('');
      setEditingVehicle(null);
      setShowAddModal(false);

      // FIX: Refresh data with throwOnError=true to catch any refresh failures
      // This ensures user is notified if vehicle was saved but list refresh failed
      try {
        await fetchData(true);
        notifySuccess(editingVehicle ? 'Vehicle updated successfully!' : 'Vehicle added successfully!');
      } catch (refreshError: any) {
        // Vehicle was saved but refresh failed - notify user to manually refresh
        console.error('[AdminDashboard] handleSaveVehicle: Vehicle saved but refresh failed:', refreshError);
        notifyWarning('Vehicle saved but failed to refresh list. Please refresh the page to see the new vehicle.');
      }
    } catch (error: any) {
      console.error('[AdminDashboard] handleSaveVehicle: Error saving vehicle:', error);
      notifyError(error.message || 'Failed to save vehicle. Please try again.');
    }
  };

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


  const openDeleteVehicleDialog = (vehicle: LandedCostSummary) => {
    setVehicleToDelete({
      id: vehicle.vehicle_id,
      make_model: vehicle.make_model,
      vin_number: vehicle.vin_number
    });
    setShowDeleteVehicleDialog(true);
  };

  const handleDeleteVehicle = async () => {
    if (!vehicleToDelete) return;
    try {
      await supabase.deleteVehicle(vehicleToDelete.id);
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
      await supabase.addExpense({
        vehicle_id: expenseVehicle || undefined,
        description: expenseDriver 
          ? `Driver Disbursement - ${expenseDriver}: ${expenseDesc || 'Trip funds'}`
          : expenseDesc,
        amount: parseFloat(expenseAmount),
        currency: expenseCurrency,
        category: expenseCategory,
        location: expenseLocation,
        receipt_url: 'https://picsum.photos/400/600',
        driver_name: expenseDriver || undefined
      });

      setExpenseVehicle('');
      setExpenseDesc('');
      setExpenseAmount('');
      setExpenseCurrency('NAD');
      setExpenseCategory('Fuel');
      setExpenseLocation('Namibia');
      setExpenseDriver('');
      setShowExpenseModal(false);
      notifySuccess(expenseDriver 
        ? `Disbursement to ${expenseDriver} recorded successfully!` 
        : 'Expense added successfully!');
    } catch (error) {
      console.error('Error adding expense:', error);
      notifyError('Failed to add expense. Please try again.');
    }
  };

  // Client CRUD handlers
  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingClient) {
        await supabase.updateClient(editingClient.id, clientForm);
      } else {
        const newClient = await supabase.createClient(clientForm);
      }
      setShowClientModal(false);
      setEditingClient(null);
      setClientForm({ name: '', email: '', phone: '', address: '', company: '', notes: '' });
      
      // FIX: Await fetchData and handle refresh errors
      try {
        await fetchData(true);
        notifySuccess(editingClient ? 'Client updated successfully!' : 'Client created successfully!');
      } catch (refreshError) {
        console.error('[AdminDashboard] handleSaveClient: Client saved but refresh failed:', refreshError);
        notifyWarning('Client saved but failed to refresh list. Please refresh the page.');
      }
    } catch (error: any) {
      console.error('[AdminDashboard] handleSaveClient: Error saving client:', error);
      notifyError(error?.message || 'Failed to save client. Please try again.');
    }
  };

  const handleDeleteClient = async (id: string) => {
    const approved = await confirm({
      title: 'Delete client?',
      message: 'This will permanently remove the client from the system.',
      confirmLabel: 'Delete Client',
      confirmVariant: 'danger',
    });

    if (!approved) return;

    try {
      await supabase.deleteClient(id);
      await fetchData(true);
      notifySuccess('Client deleted successfully.');
    } catch (error: any) {
      console.error('[AdminDashboard] handleDeleteClient: Error deleting client:', error);
      notifyError(error?.message || 'Failed to delete client.');
    }
  };

  // Employee CRUD handlers
  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...employeeForm,
        base_pay_usd: parseFloat(employeeForm.base_pay_usd) || 0
      };
      if (editingEmployee) {
        await supabase.updateEmployee(editingEmployee.id, payload);
      } else {
        const newEmployee = await supabase.createEmployee(payload);
      }
      setShowEmployeeModal(false);
      setEditingEmployee(null);
      setEmployeeForm({
        name: '', email: '', phone: '', department: '', position: '',
        base_pay_usd: '', currency: 'USD',
        employment_type: 'Full-time',
        date_hired: '', national_id: '', bank_account: '', bank_name: '', tax_number: ''
      });
      
      // FIX: Await fetchData and handle refresh errors
      try {
        await fetchData(true);
        notifySuccess(editingEmployee ? 'Employee updated successfully!' : 'Employee created successfully!');
      } catch (refreshError) {
        console.error('[AdminDashboard] handleSaveEmployee: Employee saved but refresh failed:', refreshError);
        notifyWarning('Employee saved but failed to refresh list. Please refresh the page.');
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
      await supabase.deleteEmployee(id);
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
        notes: payslipForm.notes
      };
      const newPayslip = await supabase.generatePayslip(payload);
      
      setShowPayslipModal(false);
      setPayslipForm({
        employee_id: '', month: new Date().getMonth() + 1, year: new Date().getFullYear(),
        base_pay: '', overtime_hours: '', overtime_rate: '', bonus: '', allowances: '', commission: '',
        tax_deduction: '', pension_deduction: '', health_insurance: '', other_deductions: '',
        payment_date: '', payment_method: 'Bank Transfer', notes: ''
      });
      
      // FIX: Await fetchData and handle refresh errors
      try {
        await fetchData(true);
        notifySuccess('Payslip generated successfully!');
      } catch (refreshError) {
        console.error('[AdminDashboard] handleGeneratePayslip: Payslip saved but refresh failed:', refreshError);
        notifyWarning('Payslip generated but failed to refresh list. Please refresh the page.');
      }
    } catch (error: any) {
      console.error('[AdminDashboard] handleGeneratePayslip: Error generating payslip:', error);
      notifyError(error?.message || 'Failed to generate payslip. Please try again.');
    }
  };

  const handleUpdatePayslipStatus = async (id: string, status: 'Generated' | 'Approved' | 'Paid' | 'Cancelled') => {
    try {
      await supabase.updatePayslipStatus(id, status);
      await fetchData(true);
    } catch (error: any) {
      console.error('[AdminDashboard] handleUpdatePayslipStatus: Error updating payslip status:', error);
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
      await supabase.deletePayslip(id);
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
      await generatePayslipPDFAndDownload(payslip, company);
    } catch (error) {
      console.error('Error generating payslip PDF:', error);
      notifyError('Failed to generate PDF');
    }
  };

  // Calculate real-time payslip totals
  const calculatePayslipTotals = () => {
    const basePay = parseFloat(payslipForm.base_pay) || 0;
    const overtimePay = (parseFloat(payslipForm.overtime_hours) || 0) * (parseFloat(payslipForm.overtime_rate) || 0);
    const bonus = parseFloat(payslipForm.bonus) || 0;
    const allowances = parseFloat(payslipForm.allowances) || 0;
    const commission = parseFloat(payslipForm.commission) || 0;
    const grossPay = basePay + overtimePay + bonus + allowances + commission;

    const tax = parseFloat(payslipForm.tax_deduction) || 0;
    const pension = parseFloat(payslipForm.pension_deduction) || 0;
    const health = parseFloat(payslipForm.health_insurance) || 0;
    const otherDeductions = parseFloat(payslipForm.other_deductions) || 0;
    const totalDeductions = tax + pension + health + otherDeductions;

    const netPay = grossPay - totalDeductions;

    return { grossPay, totalDeductions, netPay, overtimePay };
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
        date: fundsForm.date
      };
      
      await supabase.addOperatingFund(payload);
      
      setShowFundsModal(false);
      setFundsForm({
        type: 'Received',
        amount: '',
        currency: 'USD',
        description: '',
        reference: '',
        recipient: '',
        date: new Date().toISOString().split('T')[0]
      });
      
      try {
        await fetchData(true);
        notifySuccess(fundsForm.type === 'Received' 
          ? 'Funds received recorded successfully!' 
          : 'Disbursement recorded successfully!');
      } catch (refreshError) {
        console.error('[AdminDashboard] handleAddOperatingFund: Saved but refresh failed:', refreshError);
        notifyWarning('Transaction saved but failed to refresh. Please refresh the page.');
      }
    } catch (error: any) {
      console.error('[AdminDashboard] handleAddOperatingFund: Error:', error);
      notifyError(error?.message || 'Failed to record transaction. Please try again.');
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
      await supabase.deleteOperatingFund(id);
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
      await generateDriverFundsReportPDFAndDownload(
        expenses,
        operatingFunds,
        drivers,
        vehicles,
        company,
      );
      notifySuccess('Driver funds report PDF downloaded!');
    } catch (error: any) {
      console.error('[AdminDashboard] handleExportDriverFundsReport:', error);
      notifyError(error?.message || 'Failed to export the driver funds report.');
    }
  };

  const statusData = useMemo(() => ([
    { name: 'UK', value: summaries.filter(s => s.status === 'UK').length },
    { name: 'Namibia', value: summaries.filter(s => s.status === 'Namibia').length },
    { name: 'Zimbabwe', value: summaries.filter(s => s.status === 'Zimbabwe').length },
    { name: 'Botswana', value: summaries.filter(s => s.status === 'Botswana').length },
    { name: 'Sold', value: summaries.filter(s => s.status === 'Sold').length },
  ]), [summaries]);

  const driverFundsReport = useMemo(
    () => buildDriverFundsReportData(expenses, operatingFunds, drivers, vehicles),
    [drivers, expenses, operatingFunds, vehicles],
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4 font-sans">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-zinc-500 font-bold animate-pulse uppercase tracking-widest text-xs">Initializing Fleet Data</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700 font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Admin Dashboard</h2>
          <p className="text-zinc-500 font-medium">Fleet, clients, employees & payroll management</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap overflow-x-auto pb-2">
          <button
            onClick={() => setActiveView('dashboard')}
            className={`${activeView === 'dashboard' ? 'bg-blue-600 text-white' : 'bg-zinc-100 text-zinc-700'} px-4 py-2 rounded-xl font-bold text-sm hover:shadow-lg transition-all flex items-center gap-2 whitespace-nowrap`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            Fleet
          </button>
          <button
            onClick={() => setActiveView('reports')}
            className={`${activeView === 'reports' ? 'bg-purple-600 text-white' : 'bg-zinc-100 text-zinc-700'} px-4 py-2 rounded-xl font-bold text-sm hover:shadow-lg transition-all flex items-center gap-2 whitespace-nowrap`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Reports
          </button>
          <button
            onClick={() => setActiveView('clients')}
            className={`${activeView === 'clients' ? 'bg-green-600 text-white' : 'bg-zinc-100 text-zinc-700'} px-4 py-2 rounded-xl font-bold text-sm hover:shadow-lg transition-all flex items-center gap-2 whitespace-nowrap`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            Clients
          </button>
          <button
            onClick={() => setActiveView('employees')}
            className={`${activeView === 'employees' ? 'bg-orange-600 text-white' : 'bg-zinc-100 text-zinc-700'} px-4 py-2 rounded-xl font-bold text-sm hover:shadow-lg transition-all flex items-center gap-2 whitespace-nowrap`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            Employees
          </button>
          <button
            onClick={() => setActiveView('payslips')}
            className={`${activeView === 'payslips' ? 'bg-pink-600 text-white' : 'bg-zinc-100 text-zinc-700'} px-4 py-2 rounded-xl font-bold text-sm hover:shadow-lg transition-all flex items-center gap-2 whitespace-nowrap`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Payslips
          </button>
          <button
            onClick={() => setActiveView('funds')}
            className={`${activeView === 'funds' ? 'bg-emerald-600 text-white' : 'bg-zinc-100 text-zinc-700'} px-4 py-2 rounded-xl font-bold text-sm hover:shadow-lg transition-all flex items-center gap-2 whitespace-nowrap`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            Operating Funds
          </button>
          <button
            onClick={() => setActiveView('assets')}
            className={`${activeView === 'assets' ? 'bg-purple-600 text-white' : 'bg-zinc-100 text-zinc-700'} px-4 py-2 rounded-xl font-bold text-sm hover:shadow-lg transition-all flex items-center gap-2 whitespace-nowrap`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
            Asset Register
          </button>
        </div>
      </div>

      {/* Action buttons for active view */}
      {activeView === 'dashboard' && (
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
      )}

      {activeView === 'clients' && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditingClient(null);
              setClientForm({ name: '', email: '', phone: '', address: '', company: '', notes: '' });
              setShowClientModal(true);
            }}
            className="bg-green-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-green-700 transition-all shadow-xl shadow-green-100 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="2.5" /></svg>
            Add Client
          </button>
        </div>
      )}

      {activeView === 'employees' && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditingEmployee(null);
              setEmployeeForm({
                name: '', email: '', phone: '', department: '', position: '',
                base_pay_usd: '', currency: 'USD',
                employment_type: 'Full-time',
                date_hired: '', national_id: '', bank_account: '', bank_name: '', tax_number: ''
              });
              setShowEmployeeModal(true);
            }}
            className="bg-orange-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-orange-700 transition-all shadow-xl shadow-orange-100 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="2.5" /></svg>
            Add Employee
          </button>
        </div>
      )}

      {activeView === 'payslips' && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setPayslipForm({
                employee_id: '', month: new Date().getMonth() + 1, year: new Date().getFullYear(),
                base_pay: '', overtime_hours: '', overtime_rate: '', bonus: '', allowances: '', commission: '',
                tax_deduction: '', pension_deduction: '', health_insurance: '', other_deductions: '',
                payment_date: '', payment_method: 'Bank Transfer', notes: ''
              });
              setShowPayslipModal(true);
            }}
            className="bg-pink-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-pink-700 transition-all shadow-xl shadow-pink-100 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="2.5" /></svg>
            Generate Payslip
          </button>
        </div>
      )}

      {activeView === 'funds' && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setFundsForm({
                type: 'Received',
                amount: '',
                currency: 'USD',
                description: '',
                reference: '',
                recipient: '',
                date: new Date().toISOString().split('T')[0]
              });
              setShowFundsModal(true);
            }}
            className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="2.5" /></svg>
            Record Transaction
          </button>
        </div>
      )}

      {activeView === 'dashboard' && (
        <AdminOverviewView
          summaries={summaries}
          statusData={statusData}
          onEditVehicle={openEditVehicleModal}
          onDeleteVehicle={openDeleteVehicleDialog}
        />
      )}

      {activeView === 'reports' && <ReportsTab />}

      {/* Clients View */}
      {activeView === 'clients' && (
        <AdminClientsView
          clients={clients}
          onEditClient={(client) => {
            setEditingClient(client);
            setClientForm({
              name: client.name,
              email: client.email || '',
              phone: client.phone || '',
              address: client.address || '',
              company: client.company || '',
              notes: client.notes || '',
            });
            setShowClientModal(true);
          }}
          onDeleteClient={handleDeleteClient}
        />
      )}

      {/* Employees View */}
      {activeView === 'employees' && (
        <AdminEmployeesView
          employees={employees}
          onEditEmployee={(employee) => {
            setEditingEmployee(employee);
            setEmployeeForm({
              name: employee.name,
              email: employee.email || '',
              phone: employee.phone || '',
              department: employee.department || '',
              position: employee.position,
              base_pay_usd: employee.base_pay_usd.toString(),
              currency: employee.currency,
              employment_type: employee.employment_type,
              date_hired: employee.date_hired,
              national_id: employee.national_id || '',
              bank_account: employee.bank_account || '',
              bank_name: employee.bank_name || '',
              tax_number: employee.tax_number || '',
            });
            setShowEmployeeModal(true);
          }}
          onDeleteEmployee={handleDeleteEmployee}
        />
      )}

      {/* Payslips View */}
      {activeView === 'payslips' && (
        <PayslipsListView
          payslips={payslips}
          onApprove={(id) => handleUpdatePayslipStatus(id, 'Approved')}
          onMarkPaid={(id) => handleUpdatePayslipStatus(id, 'Paid')}
          onDownload={handleDownloadPayslip}
          onDelete={handleDeletePayslip}
        />
      )}

      {/* Operating Funds View */}
      {activeView === 'funds' && (
        <AdminFundsView
          fundsBalance={fundsBalance}
          operatingFunds={operatingFunds}
          driverFundsReport={driverFundsReport}
          onDeleteOperatingFund={handleDeleteOperatingFund}
          onExportDriverFundsReport={handleExportDriverFundsReport}
        />
      )}

      {/* Asset Register View */}
      {activeView === 'assets' && (
        <AssetRegister userRole={userRole} />
      )}

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
        submitLabel={(type) => (type === 'Received' ? 'Record Receipt' : 'Record Disbursement')}
      />

      {/* Add Vehicle Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm cursor-pointer" onClick={() => setShowAddModal(false)}></div>
          <div className="relative bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-zinc-900">{editingVehicle ? 'Edit Vehicle' : 'Add Vehicle'}</h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingVehicle(null);
                }}
                className="text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveVehicle} className="space-y-5">

              <div>
                <label className="text-sm font-semibold text-zinc-700 mb-2 block">VIN Number *</label>
                <input
                  type="text"
                  value={newVin}
                  onChange={(e) => setNewVin(e.target.value)}
                  required
                  placeholder="Enter VIN number"
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                />
                <p className="text-xs text-zinc-400 mt-1">Unique vehicle identification number</p>
              </div>

              <div>
                <label className="text-sm font-semibold text-zinc-700 mb-2 block">Make & Model *</label>
                <input
                  type="text"
                  value={newModel}
                  onChange={(e) => setNewModel(e.target.value)}
                  required
                  placeholder="e.g. Toyota Land Cruiser V8"
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-zinc-700 mb-2 block">Purchase Price (GBP) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  required
                  placeholder="0.00"
                  min="0"
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                />
                <p className="text-xs text-zinc-400 mt-1">Purchase price in British Pounds</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm text-blue-800 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>New vehicles are set to "UK" status by default. You can update the status later.</span>
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-6 py-3 rounded-xl border border-zinc-200 text-zinc-700 font-semibold hover:bg-zinc-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`flex-1 ${editingVehicle ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'} text-white font-bold py-3 rounded-xl shadow-lg transition-all`}
                >
                  {editingVehicle ? 'Save Changes' : 'Add Vehicle'}
                </button>

              </div>
            </form>
          </div>
        </div>
      )}

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

      {/* Client Modal */}
      {showClientModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm cursor-pointer" onClick={() => setShowClientModal(false)}></div>
          <div className="relative bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-zinc-900 mb-6">{editingClient ? 'Edit Client' : 'Add New Client'}</h3>
            <form onSubmit={handleSaveClient} className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-zinc-700 mb-2 block">Name *</label>
                <input
                  type="text"
                  value={clientForm.name}
                  onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Email *</label>
                  <input
                    type="email"
                    value={clientForm.email}
                    onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-green-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Phone</label>
                  <input
                    type="tel"
                    value={clientForm.phone}
                    onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-green-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-zinc-700 mb-2 block">Company</label>
                <input
                  type="text"
                  value={clientForm.company}
                  onChange={(e) => setClientForm({ ...clientForm, company: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-zinc-700 mb-2 block">Address</label>
                <input
                  type="text"
                  value={clientForm.address}
                  onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-zinc-700 mb-2 block">Notes</label>
                <textarea
                  value={clientForm.notes}
                  onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-green-500 outline-none resize-none"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowClientModal(false)} className="flex-1 px-6 py-3 rounded-xl border border-zinc-200 text-zinc-700 font-semibold hover:bg-zinc-50">Cancel</button>
                <button type="submit" className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl shadow-lg">Save Client</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Employee Modal */}
      {showEmployeeModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm cursor-pointer" onClick={() => setShowEmployeeModal(false)}></div>
          <div className="relative bg-white rounded-3xl p-8 max-w-3xl w-full shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-zinc-900 mb-6">{editingEmployee ? 'Edit Employee' : 'Add New Employee'}</h3>
            <form onSubmit={handleSaveEmployee} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Full Name *</label>
                  <input type="text" value={employeeForm.name} onChange={(e) => setEmployeeForm({ ...employeeForm, name: e.target.value })} required className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-orange-500 outline-none" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Email *</label>
                  <input type="email" value={employeeForm.email} onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })} required className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-orange-500 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Phone</label>
                  <input type="tel" value={employeeForm.phone} onChange={(e) => setEmployeeForm({ ...employeeForm, phone: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-orange-500 outline-none" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Department</label>
                  <input type="text" value={employeeForm.department} onChange={(e) => setEmployeeForm({ ...employeeForm, department: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-orange-500 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Position *</label>
                  <input type="text" value={employeeForm.position} onChange={(e) => setEmployeeForm({ ...employeeForm, position: e.target.value })} required className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-orange-500 outline-none" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Base Pay (USD) *</label>
                  <input type="number" step="0.01" value={employeeForm.base_pay_usd} onChange={(e) => setEmployeeForm({ ...employeeForm, base_pay_usd: e.target.value })} required className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-orange-500 outline-none" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Currency</label>
                  <select value={employeeForm.currency} onChange={(e) => setEmployeeForm({ ...employeeForm, currency: e.target.value as Employee['currency'] })} className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-orange-500 outline-none">
                    <option value="USD">USD</option>
                    <option value="NAD">NAD</option>
                    <option value="GBP">GBP</option>
                    <option value="BWP">BWP</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Employment Type</label>
                  <select value={employeeForm.employment_type} onChange={(e) => setEmployeeForm({ ...employeeForm, employment_type: e.target.value as Employee['employment_type'] })} className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-orange-500 outline-none">
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Intern">Intern</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Date Hired *</label>
                  <input type="date" value={employeeForm.date_hired} onChange={(e) => setEmployeeForm({ ...employeeForm, date_hired: e.target.value })} required className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-orange-500 outline-none" />
                </div>
              </div>
              <div className="border-t border-zinc-200 pt-4 mt-4">
                <h4 className="text-sm font-bold text-zinc-700 mb-3">Optional Banking & Tax Details</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-zinc-700 mb-2 block">National ID</label>
                    <input type="text" value={employeeForm.national_id} onChange={(e) => setEmployeeForm({ ...employeeForm, national_id: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-orange-500 outline-none" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-zinc-700 mb-2 block">Tax Number</label>
                    <input type="text" value={employeeForm.tax_number} onChange={(e) => setEmployeeForm({ ...employeeForm, tax_number: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-orange-500 outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="text-sm font-semibold text-zinc-700 mb-2 block">Bank Name</label>
                    <input type="text" value={employeeForm.bank_name} onChange={(e) => setEmployeeForm({ ...employeeForm, bank_name: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-orange-500 outline-none" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-zinc-700 mb-2 block">Bank Account</label>
                    <input type="text" value={employeeForm.bank_account} onChange={(e) => setEmployeeForm({ ...employeeForm, bank_account: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-orange-500 outline-none" />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowEmployeeModal(false)} className="flex-1 px-6 py-3 rounded-xl border border-zinc-200 text-zinc-700 font-semibold hover:bg-zinc-50">Cancel</button>
                <button type="submit" className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-xl shadow-lg">Save Employee</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payslip Modal */}
      {showPayslipModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm cursor-pointer" onClick={() => setShowPayslipModal(false)}></div>
          <div className="relative bg-white rounded-3xl p-8 max-w-4xl w-full shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-zinc-900 mb-6">Generate Payslip</h3>
            <form onSubmit={handleGeneratePayslip} className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-3 md:col-span-1">
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Employee *</label>
                  <select
                    value={payslipForm.employee_id}
                    onChange={(e) => {
                      const empId = e.target.value;
                      const emp = employees.find(e => e.id === empId);
                      setPayslipForm({ ...payslipForm, employee_id: empId, base_pay: emp ? emp.base_pay_usd.toString() : '' });
                    }}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-pink-500 outline-none"
                  >
                    <option value="">Select Employee</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} - {emp.position}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Month *</label>
                  <select value={payslipForm.month} onChange={(e) => setPayslipForm({ ...payslipForm, month: parseInt(e.target.value) })} required className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-pink-500 outline-none">
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                      <option key={m} value={m}>{getMonthName(m)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Year *</label>
                  <input type="number" value={payslipForm.year} onChange={(e) => setPayslipForm({ ...payslipForm, year: parseInt(e.target.value) })} required className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-pink-500 outline-none" />
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                <h4 className="text-sm font-bold text-green-800 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Earnings
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-zinc-600 mb-1 block">Base Pay *</label>
                    <input type="number" step="0.01" value={payslipForm.base_pay} onChange={(e) => setPayslipForm({ ...payslipForm, base_pay: e.target.value })} required className="w-full px-3 py-2 rounded-lg border border-green-300 focus:ring-2 focus:ring-green-500 outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-600 mb-1 block">OT Hours</label>
                    <input type="number" step="0.01" value={payslipForm.overtime_hours} onChange={(e) => setPayslipForm({ ...payslipForm, overtime_hours: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-green-300 focus:ring-2 focus:ring-green-500 outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-600 mb-1 block">OT Rate</label>
                    <input type="number" step="0.01" value={payslipForm.overtime_rate} onChange={(e) => setPayslipForm({ ...payslipForm, overtime_rate: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-green-300 focus:ring-2 focus:ring-green-500 outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-600 mb-1 block">Bonus</label>
                    <input type="number" step="0.01" value={payslipForm.bonus} onChange={(e) => setPayslipForm({ ...payslipForm, bonus: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-green-300 focus:ring-2 focus:ring-green-500 outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-600 mb-1 block">Allowances</label>
                    <input type="number" step="0.01" value={payslipForm.allowances} onChange={(e) => setPayslipForm({ ...payslipForm, allowances: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-green-300 focus:ring-2 focus:ring-green-500 outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-600 mb-1 block">Commission</label>
                    <input type="number" step="0.01" value={payslipForm.commission} onChange={(e) => setPayslipForm({ ...payslipForm, commission: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-green-300 focus:ring-2 focus:ring-green-500 outline-none" />
                  </div>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                <h4 className="text-sm font-bold text-red-800 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                  Deductions
                </h4>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-zinc-600 mb-1 block">Tax</label>
                    <input type="number" step="0.01" value={payslipForm.tax_deduction} onChange={(e) => setPayslipForm({ ...payslipForm, tax_deduction: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-red-300 focus:ring-2 focus:ring-red-500 outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-600 mb-1 block">Pension</label>
                    <input type="number" step="0.01" value={payslipForm.pension_deduction} onChange={(e) => setPayslipForm({ ...payslipForm, pension_deduction: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-red-300 focus:ring-2 focus:ring-red-500 outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-600 mb-1 block">Health Insurance</label>
                    <input type="number" step="0.01" value={payslipForm.health_insurance} onChange={(e) => setPayslipForm({ ...payslipForm, health_insurance: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-red-300 focus:ring-2 focus:ring-red-500 outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-600 mb-1 block">Other</label>
                    <input type="number" step="0.01" value={payslipForm.other_deductions} onChange={(e) => setPayslipForm({ ...payslipForm, other_deductions: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-red-300 focus:ring-2 focus:ring-red-500 outline-none" />
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 text-white">
                <div className="grid grid-cols-3 gap-6 text-center">
                  <div>
                    <p className="text-xs text-blue-200 mb-1 uppercase tracking-wide font-semibold">Gross Pay</p>
                    <p className="text-2xl font-black">${calculatePayslipTotals().grossPay.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-200 mb-1 uppercase tracking-wide font-semibold">Deductions</p>
                    <p className="text-2xl font-black">-${calculatePayslipTotals().totalDeductions.toLocaleString()}</p>
                  </div>
                  <div className="border-l-2 border-white/30 pl-6">
                    <p className="text-xs text-blue-200 mb-1 uppercase tracking-wide font-semibold">Net Pay</p>
                    <p className="text-3xl font-black">${calculatePayslipTotals().netPay.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Payment Date</label>
                  <input type="date" value={payslipForm.payment_date} onChange={(e) => setPayslipForm({ ...payslipForm, payment_date: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-pink-500 outline-none" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Payment Method</label>
                  <select value={payslipForm.payment_method} onChange={(e) => setPayslipForm({ ...payslipForm, payment_method: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-pink-500 outline-none">
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Mobile Money">Mobile Money</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-zinc-700 mb-2 block">Notes</label>
                <textarea value={payslipForm.notes} onChange={(e) => setPayslipForm({ ...payslipForm, notes: e.target.value })} rows={2} className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-pink-500 outline-none resize-none" />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowPayslipModal(false)} className="flex-1 px-6 py-3 rounded-xl border border-zinc-200 text-zinc-700 font-semibold hover:bg-zinc-50">Cancel</button>
                <button type="submit" className="flex-1 bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 rounded-xl shadow-lg">Generate Payslip</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Vehicle Confirmation Dialog */}
      {showDeleteVehicleDialog && vehicleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm" onClick={() => setShowDeleteVehicleDialog(false)}></div>
          <div className="relative bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
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
              <button
                type="button"
                onClick={() => setShowDeleteVehicleDialog(false)}
                className="flex-1 px-6 py-3 rounded-xl font-bold text-sm text-zinc-700 border border-zinc-200 hover:bg-zinc-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteVehicle}
                className="flex-1 px-6 py-3 rounded-xl font-bold text-sm bg-red-600 text-white hover:bg-red-700 transition-colors"
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
