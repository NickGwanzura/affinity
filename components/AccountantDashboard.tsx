import React, { useEffect, useState, useMemo } from 'react';
import { Invoice, Payment, Expense, Quote, LandedCostSummary, Client, Payslip, CompanyDetails, OperatingFund, OperatingFundType, UserRole, AppUser, Employee, Vehicle, Currency, ExpenseCategory, VehicleStatus } from '../types';
import { AssetRegister } from './AssetRegister';
import AccountantClientsView from './accountant/AccountantClientsView';
import OperatingFundsView from './accountant/OperatingFundsView';
import ReportsOverviewView from './accountant/ReportsOverviewView';
import ClientFormModal, { type ClientFormValue } from './shared/ClientFormModal';
import ExpenseEntryModal, { type ExpenseEntryFormValue } from './shared/ExpenseEntryModal';
import OperatingFundEntryModal, { type OperatingFundFormValue } from './shared/OperatingFundEntryModal';
import PayslipFormModal, { createEmptyPayslipForm, type PayslipFormValue } from './shared/PayslipFormModal';
import PayslipsListView from './shared/PayslipsListView';
import { supabase } from '../services/supabaseService';
import { generateDriverFundsReportPDFAndDownload, generatePayslipPDFAndDownload, generateExpensesReportPDFAndDownload } from '../services/pdfService';
import { Button, StatCard, StatusBadge, SkeletonStatCards, SkeletonTable } from './ui';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmModal';
import { buildDriverFundsReportData } from '../utils/driverFunds';
import { formatCurrency as formatMoney, formatDate as formatDateValue } from '../utils/formatters';

export const AccountantDashboard: React.FC = () => {
  const truncateValue = (value: string | null | undefined, length: number, fallback: string = '-') =>
    value ? value.slice(0, length) : fallback;
  const { showToast, ToastContainer } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [summaries, setSummaries] = useState<LandedCostSummary[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'invoices' | 'expenses' | 'payments' | 'reports' | 'clients' | 'payslips' | 'operating-funds' | 'expense-reports' | 'assets'>('overview');
  const [userRole, setUserRole] = useState<UserRole>('Accountant');
  const [operatingFunds, setOperatingFunds] = useState<OperatingFund[]>([]);
  const [showFundModal, setShowFundModal] = useState(false);
  const [fundForm, setFundForm] = useState<{ type: OperatingFundType; amount: string; currency: 'USD' | 'GBP'; description: string; reference: string; recipient: string; approved_by: string; date: string }>({
    type: 'Received', amount: '', currency: 'USD', description: '', reference: '', recipient: '', approved_by: '', date: new Date().toISOString().split('T')[0],
  });
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showEditExpenseModal, setShowEditExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showClientModal, setShowClientModal] = useState(false);
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientForm, setClientForm] = useState({
    name: '', email: '', phone: '', address: '', company: '', notes: ''
  });
  const [payslipForm, setPayslipForm] = useState<PayslipFormValue>(createEmptyPayslipForm());
  
  // Expense Form State
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<AppUser[]>([]);
  const [expenseVehicle, setExpenseVehicle] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCurrency, setExpenseCurrency] = useState<Currency>('NAD');
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory>('Fuel');
  const [expenseLocation, setExpenseLocation] = useState<VehicleStatus>('Namibia');
  const [expenseDriver, setExpenseDriver] = useState<string>('');
  const [company, setCompany] = useState<CompanyDetails | null>(null);

  // Edit Expense State
  const [editExpenseVehicle, setEditExpenseVehicle] = useState('');
  const [editExpenseDesc, setEditExpenseDesc] = useState('');
  const [editExpenseAmount, setEditExpenseAmount] = useState('');
  const [editExpenseCurrency, setEditExpenseCurrency] = useState<Currency>('NAD');
  const [editExpenseCategory, setEditExpenseCategory] = useState<ExpenseCategory>('Fuel');
  const [editExpenseLocation, setEditExpenseLocation] = useState<VehicleStatus>('Namibia');

  const notifySuccess = (message: string) => showToast(message, 'success');
  const notifyError = (message: string) => showToast(message, 'error');
  const notifyWarning = (message: string) => showToast(message, 'warning');

  const addExpenseFormValue: ExpenseEntryFormValue = {
    vehicleId: expenseVehicle,
    amount: expenseAmount,
    currency: expenseCurrency,
    category: expenseCategory,
    location: expenseLocation,
    description: expenseDesc,
    driverName: expenseDriver,
  };

  const editExpenseFormValue: ExpenseEntryFormValue = {
    vehicleId: editExpenseVehicle,
    amount: editExpenseAmount,
    currency: editExpenseCurrency,
    category: editExpenseCategory,
    location: editExpenseLocation,
    description: editExpenseDesc,
    driverName: '',
  };

  const handleAddExpenseFormChange = (updates: Partial<ExpenseEntryFormValue>) => {
    if (updates.vehicleId !== undefined) setExpenseVehicle(updates.vehicleId);
    if (updates.amount !== undefined) setExpenseAmount(updates.amount);
    if (updates.currency !== undefined) setExpenseCurrency(updates.currency);
    if (updates.category !== undefined) setExpenseCategory(updates.category);
    if (updates.location !== undefined) setExpenseLocation(updates.location);
    if (updates.description !== undefined) setExpenseDesc(updates.description);
    if (updates.driverName !== undefined) setExpenseDriver(updates.driverName);
  };

  const handleEditExpenseFormChange = (updates: Partial<ExpenseEntryFormValue>) => {
    if (updates.vehicleId !== undefined) setEditExpenseVehicle(updates.vehicleId);
    if (updates.amount !== undefined) setEditExpenseAmount(updates.amount);
    if (updates.currency !== undefined) setEditExpenseCurrency(updates.currency);
    if (updates.category !== undefined) setEditExpenseCategory(updates.category);
    if (updates.location !== undefined) setEditExpenseLocation(updates.location);
    if (updates.description !== undefined) setEditExpenseDesc(updates.description);
  };

  const operatingFundFormValue: OperatingFundFormValue = { ...fundForm };
  const handleOperatingFundFormChange = (updates: Partial<OperatingFundFormValue>) => {
    setFundForm((prev) => ({ ...prev, ...updates }));
  };

  const clientFormValue: ClientFormValue = { ...clientForm };
  const handleClientFormChange = (updates: Partial<ClientFormValue>) => {
    setClientForm((prev) => ({ ...prev, ...updates }));
  };

  const handlePayslipFormChange = (updates: Partial<PayslipFormValue>) => {
    setPayslipForm((prev) => ({ ...prev, ...updates }));
  };

  const handleAddFund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fundForm.amount || parseFloat(fundForm.amount) <= 0) { notifyWarning('Enter a valid amount'); return; }
    if (fundForm.type === 'Disbursed' && !fundForm.recipient) { notifyWarning('Please select the driver receiving this disbursement'); return; }
    try {
      await supabase.addOperatingFund({
        type: fundForm.type,
        amount: parseFloat(fundForm.amount),
        currency: fundForm.currency,
        description: fundForm.description,
        reference: fundForm.reference || undefined,
        recipient: fundForm.recipient || undefined,
        approved_by: fundForm.approved_by || undefined,
        date: fundForm.date,
      });
      setShowFundModal(false);
      setFundForm({ type: 'Received', amount: '', currency: 'USD', description: '', reference: '', recipient: '', approved_by: '', date: new Date().toISOString().split('T')[0] });
      await loadData();
      notifySuccess('Operating fund entry added');
    } catch (err: any) { notifyError(err?.message || 'Failed to add fund entry'); }
  };

  const handleDeleteFund = async (id: string) => {
    const ok = await confirm({ title: 'Delete Entry', message: 'Remove this operating fund entry? This cannot be undone.', confirmLabel: 'Delete', isDangerous: true });
    if (!ok) return;
    try {
      await supabase.deleteOperatingFund(id);
      await loadData();
      notifySuccess('Entry deleted');
    } catch (err: any) { notifyError(err?.message || 'Failed to delete entry'); }
  };

  // FIX: Centralized data loading function with error handling
  const loadData = async (throwOnError = false) => {
    try {
      const [inv, pay, exp, quo, sum, veh, cli, psl, emp, comp, funds, users] = await Promise.all([
        supabase.getInvoices(),
        supabase.getPayments(),
        supabase.getExpenses(),
        supabase.getQuotes(),
        supabase.getLandedCostSummaries(),
        supabase.getVehicles(),
        supabase.getClients(),
        supabase.getPayslips(),
        supabase.getEmployees(),
        supabase.getCompanyDetails(),
        supabase.getOperatingFunds().catch(() => [] as import('../types').OperatingFund[]),
        supabase.getUsers(),
      ]);
      setInvoices(Array.isArray(inv) ? inv : []);
      setPayments(Array.isArray(pay) ? pay : []);
      setExpenses(Array.isArray(exp) ? exp : []);
      setQuotes(Array.isArray(quo) ? quo : []);
      setSummaries(Array.isArray(sum) ? sum : []);
      setVehicles(Array.isArray(veh) ? veh : []);
      setClients(Array.isArray(cli) ? cli : []);
      setPayslips(Array.isArray(psl) ? psl : []);
      setEmployees(Array.isArray(emp) ? emp : []);
      setCompany(comp);
      setOperatingFunds(Array.isArray(funds) ? funds : []);
      setDrivers(Array.isArray(users) ? users.filter((user) => user.role === 'Driver' && user.status === 'Active') : []);
      setLoading(false);
    } catch (error: any) {
      console.error('[AccountantDashboard] loadData: Error loading data:', error);
      setLoading(false);
      if (throwOnError) throw error;
    }
  };

  useEffect(() => {
    loadData();
    // Get current user role
    supabase.getSession().then(session => {
      if (session?.user?.role) {
        setUserRole(session.user.role);
      }
    }).catch((err: unknown) => console.error('[AccountantDashboard] getSession failed:', err));
  }, []);

  const totalRevenue = invoices
    .filter(inv => inv.status === 'Paid')
    .reduce((sum, inv) => sum + inv.amount_usd, 0);

  const totalExpenses = (expenses || []).reduce((sum, exp) => sum + ((exp.amount || 0) * (exp.exchange_rate_to_usd || 1)), 0);

  const pendingInvoices = invoices.filter(inv => inv.status === 'Sent' || inv.status === 'Overdue');
  const totalPending = pendingInvoices.reduce((sum, inv) => sum + inv.amount_usd, 0);

  const netProfit = totalRevenue - totalExpenses;

  // Current month calculations
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const monthlyRevenue = invoices
    .filter(inv => {
      const date = new Date(inv.created_at);
      return date.getMonth() === currentMonth && 
             date.getFullYear() === currentYear &&
             inv.status === 'Paid';
    })
    .reduce((sum, inv) => sum + inv.amount_usd, 0);

  const monthlyExpenses = (expenses || [])
    .filter(exp => {
      const date = new Date(exp.created_at);
      return date.getMonth() === currentMonth && 
             date.getFullYear() === currentYear;
    })
    .reduce((sum, exp) => sum + ((exp.amount || 0) * (exp.exchange_rate_to_usd || 1)), 0);

  const monthlyProfit = monthlyRevenue - monthlyExpenses;

  // Chart data preparation - Monthly trends (last 12 months)
  const monthlyTrendData = useMemo(() => {
    const months: { month: string; revenue: number; expenses: number }[] = [];
    const today = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = formatDateValue(d, 'en-US', { month: 'short', year: '2-digit' });
      
      const monthRevenue = invoices
        .filter(inv => inv.status === 'Paid' && String(inv.created_at).startsWith(monthKey))
        .reduce((sum, inv) => sum + inv.amount_usd, 0);
      
      const monthExpenses = (expenses || [])
        .filter(exp => String(exp.created_at).startsWith(monthKey))
        .reduce((sum, exp) => sum + ((exp.amount || 0) * (exp.exchange_rate_to_usd || 1)), 0);
      
      months.push({ month: monthLabel, revenue: monthRevenue, expenses: monthExpenses });
    }
    return months;
  }, [invoices, expenses]);

  // Expense by category data
  const expenseCategoryData = useMemo(() => {
    const categoryTotals: Record<string, number> = {};
    (expenses || []).forEach(exp => {
      const amount = (exp.amount || 0) * (exp.exchange_rate_to_usd || 1);
      categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + amount;
    });
    return Object.entries(categoryTotals)
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [expenses]);

  // Invoice status breakdown
  const invoiceStatusData = useMemo(() => {
    const statusCounts: Record<string, number> = { Paid: 0, Sent: 0, Draft: 0, Overdue: 0 };
    invoices.forEach(inv => {
      if (statusCounts[inv.status] !== undefined) {
        statusCounts[inv.status] += inv.amount_usd;
      }
    });
    return Object.entries(statusCounts)
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0);
  }, [invoices]);

  // Revenue by client (top 10)
  const revenueByClientData = useMemo(() => {
    const clientTotals: Record<string, number> = {};
    invoices.filter(inv => inv.status === 'Paid').forEach(inv => {
      clientTotals[inv.client_name] = (clientTotals[inv.client_name] || 0) + inv.amount_usd;
    });
    return Object.entries(clientTotals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [invoices]);

  const driverFundsReport = useMemo(
    () => buildDriverFundsReportData(expenses, operatingFunds, drivers, vehicles),
    [drivers, expenses, operatingFunds, vehicles],
  );

  // Merged client list: DB clients + unique clients extracted from invoices
  const mergedClients = useMemo(() => {
    const dbClientNames = new Set(clients.map(c => c.name.toLowerCase().trim()));
    const seen = new Set<string>();
    const invoiceOnlyClients: Client[] = [];

    for (const inv of invoices) {
      const key = inv.client_name?.toLowerCase().trim();
      if (key && !dbClientNames.has(key) && !seen.has(key)) {
        seen.add(key);
        invoiceOnlyClients.push({
          id: `__invoice__${inv.client_name}`,
          name: inv.client_name,
          email: inv.client_email || '',
          phone: '',
          address: inv.client_address || '',
          company: '',
          notes: '',
          created_at: '',
        });
      }
    }

    return [...clients, ...invoiceOnlyClients].sort((a, b) => a.name.localeCompare(b.name));
  }, [clients, invoices]);

  const getClientStats = (client: Client) => {
    const clientInvoices = invoices.filter(inv =>
      (client.id && !client.id.startsWith('__invoice__') && inv.client_id === client.id) ||
      inv.client_name?.toLowerCase().trim() === client.name.toLowerCase().trim()
    );
    return {
      count: clientInvoices.length,
      total: clientInvoices.reduce((s, inv) => s + (inv.amount_usd || 0), 0),
      lastInvoice: clientInvoices.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]?.created_at,
    };
  };

  // Expense Report filters
  const [erDateFrom, setErDateFrom] = useState('');
  const [erDateTo, setErDateTo] = useState('');
  const [erCategory, setErCategory] = useState('');
  const [erLocation, setErLocation] = useState('');
  const [erVehicle, setErVehicle] = useState('');

  const filteredExpensesForReport = useMemo(() => {
    return (expenses || []).filter(exp => {
      const d = new Date(exp.created_at);
      if (erDateFrom && d < new Date(erDateFrom)) return false;
      if (erDateTo && d > new Date(erDateTo + 'T23:59:59')) return false;
      if (erCategory && exp.category !== erCategory) return false;
      if (erLocation && exp.location !== erLocation) return false;
      if (erVehicle && exp.vehicle_id !== erVehicle) return false;
      return true;
    });
  }, [expenses, erDateFrom, erDateTo, erCategory, erLocation, erVehicle]);

  const expenseReportByCategory = useMemo(() => {
    const map: Record<string, { count: number; totalUsd: number }> = {};
    filteredExpensesForReport.forEach(exp => {
      const usd = (exp.amount || 0) * (exp.exchange_rate_to_usd || 1);
      if (!map[exp.category]) map[exp.category] = { count: 0, totalUsd: 0 };
      map[exp.category].count += 1;
      map[exp.category].totalUsd += usd;
    });
    return Object.entries(map)
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => b.totalUsd - a.totalUsd);
  }, [filteredExpensesForReport]);

  const expenseReportTotal = useMemo(() =>
    filteredExpensesForReport.reduce((s, e) => s + (e.amount || 0) * (e.exchange_rate_to_usd || 1), 0),
    [filteredExpensesForReport]);

  const handleExportExpenseReportCSV = () => {
    const headers = ['Date', 'Category', 'Location', 'Description', 'Driver', 'Amount', 'Currency', 'USD Value', 'Vehicle'];
    const rows = filteredExpensesForReport.map(e => {
      const vehicleName = vehicles.find(v => v.id === e.vehicle_id)?.make_model || '';
      return [
        formatDateValue(e.created_at, 'en-GB'),
        e.category,
        e.location,
        `"${(e.description || '').replace(/"/g, '""')}"`,
        e.driver_name || '',
        e.amount,
        e.currency,
        ((e.amount || 0) * (e.exchange_rate_to_usd || 1)).toFixed(2),
        `"${vehicleName}"`,
      ];
    });
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expense-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
      const newExpense = await supabase.addExpense({
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
      
      // FIX: Refresh all data and handle errors
      try {
        await loadData(true);
        notifySuccess(expenseDriver 
          ? `Disbursement to ${expenseDriver} recorded successfully!` 
          : 'Expense added successfully!');
      } catch (refreshError) {
        console.error('[AccountantDashboard] handleAddExpense: Expense saved but refresh failed:', refreshError);
        notifyWarning('Expense added but failed to refresh list. Please refresh the page.');
      }
    } catch (error: any) {
      console.error('[AccountantDashboard] handleAddExpense: Error adding expense:', error);
      notifyError(error?.message || 'Failed to add expense. Please try again.');
    }
  };

  // Edit Expense Handler
  const openEditExpenseModal = (expense: Expense) => {
    setEditingExpense(expense);
    setEditExpenseVehicle(expense.vehicle_id || '');
    setEditExpenseDesc(expense.description || '');
    setEditExpenseAmount(expense.amount.toString());
    setEditExpenseCurrency(expense.currency);
    setEditExpenseCategory(expense.category);
    setEditExpenseLocation(expense.location);
    setShowEditExpenseModal(true);
  };

  const handleUpdateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense || !editExpenseAmount) return;

    try {
      await supabase.updateExpense(editingExpense.id, {
        vehicle_id: editExpenseVehicle || undefined,
        description: editExpenseDesc,
        amount: parseFloat(editExpenseAmount),
        currency: editExpenseCurrency,
        category: editExpenseCategory,
        location: editExpenseLocation
      });
      
      setShowEditExpenseModal(false);
      setEditingExpense(null);
      
      // Refresh data
      await loadData(true);
      notifySuccess('Expense updated successfully!');
    } catch (error: any) {
      console.error('[AccountantDashboard] handleUpdateExpense: Error updating expense:', error);
      notifyError(error?.message || 'Failed to update expense. Please try again.');
    }
  };

  // Client CRUD handlers
  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingClient && !editingClient.id.startsWith('__invoice__')) {
        await supabase.updateClient(editingClient.id, clientForm);
      } else {
        // Virtual (invoice-sourced) clients or new clients → create in DB
        await supabase.createClient(clientForm);
      }
      
      setShowClientModal(false);
      setEditingClient(null);
      setClientForm({ name: '', email: '', phone: '', address: '', company: '', notes: '' });
      
      // FIX: Refresh all data and handle errors
      try {
        await loadData(true);
        notifySuccess(editingClient ? 'Client updated successfully!' : 'Client created successfully!');
      } catch (refreshError) {
        console.error('[AccountantDashboard] handleSaveClient: Client saved but refresh failed:', refreshError);
        notifyWarning('Client saved but failed to refresh list. Please refresh the page.');
      }
    } catch (error: any) {
      console.error('[AccountantDashboard] handleSaveClient: Error saving client:', error);
      notifyError(error?.message || 'Failed to save client. Please try again.');
    }
  };

  const handleDeleteClient = async (id: string) => {
    const approved = await confirm({
      title: 'Delete client?',
      message: 'This will permanently remove the client from the accountant workspace.',
      confirmLabel: 'Delete Client',
      confirmVariant: 'danger',
    });

    if (!approved) return;

    try {
      await supabase.deleteClient(id);
      await loadData(true);
      notifySuccess('Client deleted successfully.');
    } catch (error: any) {
      console.error('[AccountantDashboard] handleDeleteClient: Error deleting client:', error);
      notifyError(error?.message || 'Failed to delete client.');
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
      setPayslipForm(createEmptyPayslipForm());
      
      // FIX: Refresh all data and handle errors
      try {
        await loadData(true);
        notifySuccess('Payslip generated successfully!');
      } catch (refreshError) {
        console.error('[AccountantDashboard] handleGeneratePayslip: Payslip saved but refresh failed:', refreshError);
        notifyWarning('Payslip generated but failed to refresh list. Please refresh the page.');
      }
    } catch (error: any) {
      console.error('[AccountantDashboard] handleGeneratePayslip: Error generating payslip:', error);
      notifyError(error?.message || 'Failed to generate payslip. Please try again.');
    }
  };

  const handleUpdatePayslipStatus = async (id: string, status: 'Generated' | 'Approved' | 'Paid' | 'Cancelled') => {
    try {
      await supabase.updatePayslipStatus(id, status);
      await loadData(true);
    } catch (error: any) {
      console.error('Error updating payslip status:', error);
      notifyError('Failed to update payslip status.');
    }
  };

  const handleDeletePayslip = async (id: string) => {
    const approved = await confirm({
      title: 'Delete payslip?',
      message: 'This removes the payslip record from the accountant workspace.',
      confirmLabel: 'Delete Payslip',
      confirmVariant: 'danger',
    });

    if (!approved) return;

    try {
      await supabase.deletePayslip(id);
      const updatedPayslips = await supabase.getPayslips();
      setPayslips(updatedPayslips);
      notifySuccess('Payslip deleted successfully.');
    } catch (error) {
      console.error('Error deleting payslip:', error);
      notifyError('Failed to delete payslip.');
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

  const handleExportPDF = async () => {
    if (!company) { notifyError('Company details not loaded.'); return; }
    try {
      await generateExpensesReportPDFAndDownload(expenses, company, vehicles);
    } catch (err) {
      console.error('[AccountantDashboard] handleExportPDF error:', err);
      notifyError('Failed to generate PDF. Please try again.');
    }
  };

  const handleExportExpenseReportPDF = async () => {
    if (!company) { notifyError('Company details not loaded.'); return; }
    try {
      await generateExpensesReportPDFAndDownload(
        filteredExpensesForReport,
        company,
        vehicles,
        { dateFrom: erDateFrom || undefined, dateTo: erDateTo || undefined }
      );
    } catch (err) {
      console.error('[AccountantDashboard] handleExportExpenseReportPDF error:', err);
      notifyError('Failed to generate PDF. Please try again.');
    }
  };

  const handleExportCSV = () => {
    const headers = ['Date', 'Category', 'Location', 'Amount', 'Currency', 'USD Value', 'Description'];
    const rows = (expenses || []).map(e => [
      formatDate(e.created_at),
      e.category,
      e.location,
      e.amount,
      e.currency,
      (e.amount * e.exchange_rate_to_usd).toFixed(2),
      `"${(e.description || '').replace(/"/g, '""')}"`
    ]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportDriverFundsReport = async () => {
    if (!company) {
      notifyError('Company details not loaded.');
      return;
    }

    try {
      await generateDriverFundsReportPDFAndDownload(expenses, operatingFunds, drivers, vehicles, company);
      notifySuccess('Driver funds report downloaded.');
    } catch (err) {
      console.error('[AccountantDashboard] handleExportDriverFundsReport error:', err);
      notifyError('Failed to generate driver funds PDF. Please try again.');
    }
  };

  const formatCurrency = (amount: number, currency: 'USD' | 'GBP' = 'USD') =>
    formatMoney(amount, currency);

  const formatDate = (dateString: string) =>
    formatDateValue(dateString, 'en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Paid': return 'bg-green-100 text-green-700';
      case 'Sent': return 'bg-blue-100 text-blue-700';
      case 'Overdue': return 'bg-red-100 text-red-700';
      case 'Draft': return 'bg-zinc-100 text-zinc-700';
      case 'Cancelled': return 'bg-zinc-100 text-zinc-500';
      default: return 'bg-zinc-100 text-zinc-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900">Accountant Dashboard</h1>
          <p className="text-zinc-500 mt-1">Financial overview and management</p>
        </div>
        <button 
          onClick={() => setShowExpenseModal(true)}
          className="bg-green-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-green-700 transition-all shadow-xl shadow-green-100 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Add Expense
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">Total Revenue</p>
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-zinc-900">{formatCurrency(totalRevenue)}</p>
          <p className="text-xs text-green-600 mt-2 font-semibold">From {invoices.filter(i => i.status === 'Paid').length} paid invoices</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">Total Expenses</p>
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-zinc-900">{formatCurrency(totalExpenses)}</p>
          <p className="text-xs text-red-600 mt-2 font-semibold">{expenses.length} expense entries</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">Net Profit</p>
            <div className={`w-10 h-10 ${netProfit >= 0 ? 'bg-blue-100' : 'bg-orange-100'} rounded-xl flex items-center justify-center`}>
              <svg className={`w-5 h-5 ${netProfit >= 0 ? 'text-blue-600' : 'text-orange-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
          <p className={`text-3xl font-bold ${netProfit >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
            {formatCurrency(netProfit)}
          </p>
          <p className="text-xs text-zinc-500 mt-2 font-semibold">Revenue - Expenses</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">Pending Invoices</p>
            <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-zinc-900">{formatCurrency(totalPending)}</p>
          <p className="text-xs text-yellow-600 mt-2 font-semibold">{pendingInvoices.length} outstanding</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
        <div className="border-b border-zinc-200 bg-zinc-50">
          <div className="flex gap-1 p-2 flex-wrap">
            {(['overview', 'invoices', 'expenses', 'payments', 'reports', 'clients', 'payslips', 'operating-funds', 'expense-reports', 'assets'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 rounded-xl text-sm font-bold capitalize transition-all ${
                  activeTab === tab
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                {tab === 'operating-funds' ? 'Operating Funds' : tab === 'expense-reports' ? 'Expense Reports' : tab === 'assets' ? 'Asset Register' : tab}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Overview Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard 
                  title="Total Revenue" 
                  value={formatCurrency(totalRevenue)} 
                  trend="neutral"
                  icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                />
                <StatCard 
                  title="Total Expenses" 
                  value={formatCurrency(totalExpenses)} 
                  trend="neutral"
                  icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                />
                <StatCard 
                  title="Net Profit" 
                  value={formatCurrency(netProfit)} 
                  trend={netProfit >= 0 ? 'up' : 'down'}
                  trendValue={netProfit >= 0 ? 'Profitable' : 'Loss'}
                  icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
                />
                <StatCard 
                  title="Pending Amount" 
                  value={formatCurrency(totalPending)} 
                  trend="neutral"
                  trendValue={`${pendingInvoices.length} invoices`}
                  icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Invoices */}
                <div>
                  <h3 className="text-lg font-bold text-zinc-900 mb-4">Recent Invoices</h3>
                  <div className="space-y-2">
                    {invoices.slice(0, 5).map((invoice) => (
                      <div key={invoice.id} className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg">
                        <div>
                          <p className="font-semibold text-zinc-900 text-sm">{invoice.invoice_number}</p>
                          <p className="text-xs text-zinc-500">{formatDate(invoice.created_at)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-zinc-900">{formatCurrency(invoice.amount_usd, (invoice.currency as 'USD' | 'GBP') || 'USD')}</p>
                          <StatusBadge status={invoice.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Payments */}
                <div>
                  <h3 className="text-lg font-bold text-zinc-900 mb-4">Recent Payments</h3>
                  <div className="space-y-2">
                    {payments.slice(0, 5).map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg">
                        <div>
                          <p className="font-semibold text-zinc-900 text-sm">{payment.method}</p>
                          <p className="text-xs text-zinc-500">{formatDate(payment.date)}</p>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${payment.type === 'Inbound' ? 'text-green-600' : 'text-red-600'}`}>
                            {payment.type === 'Inbound' ? '+' : '-'}{formatCurrency(payment.amount_usd)}
                          </p>
                          <p className="text-xs text-zinc-500">{payment.type}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Vehicle Cost Summary */}
              <div>
                <h3 className="text-lg font-bold text-zinc-900 mb-4">Vehicle Landed Costs</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 border-b border-zinc-200">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-zinc-700">VIN</th>
                        <th className="px-4 py-3 text-left font-semibold text-zinc-700">Model</th>
                        <th className="px-4 py-3 text-right font-semibold text-zinc-700">Purchase (GBP)</th>
                        <th className="px-4 py-3 text-right font-semibold text-zinc-700">Expenses (USD)</th>
                        <th className="px-4 py-3 text-right font-semibold text-zinc-700">Total Cost (USD)</th>
                        <th className="px-4 py-3 text-center font-semibold text-zinc-700">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {summaries.map((summary) => (
                        <tr key={summary.vehicle_id} className="hover:bg-zinc-50">
                          <td className="px-4 py-3 font-mono text-xs">{summary.vin_number}</td>
                          <td className="px-4 py-3 font-medium">{summary.make_model}</td>
                          <td className="px-4 py-3 text-right">£{summary.purchase_price_gbp.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(summary.total_expenses_usd)}</td>
                          <td className="px-4 py-3 text-right font-bold">{formatCurrency(summary.total_landed_cost_usd)}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-block px-2 py-1 text-xs font-semibold rounded-md bg-zinc-100 text-zinc-700">
                              {summary.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'invoices' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-zinc-700">Invoice #</th>
                    <th className="px-4 py-3 text-left font-semibold text-zinc-700">Vehicle ID</th>
                    <th className="px-4 py-3 text-right font-semibold text-zinc-700">Amount</th>
                    <th className="px-4 py-3 text-left font-semibold text-zinc-700">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-zinc-700">Due Date</th>
                    <th className="px-4 py-3 text-left font-semibold text-zinc-700">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3 font-mono text-xs">{invoice.invoice_number}</td>
                      <td className="px-4 py-3 font-mono text-xs">{truncateValue(invoice.vehicle_id, 8)}</td>
                      <td className="px-4 py-3 text-right font-bold">{formatCurrency(invoice.amount_usd, (invoice.currency as 'USD' | 'GBP') || 'USD')}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={invoice.status} />
                      </td>
                      <td className="px-4 py-3">{formatDate(invoice.due_date)}</td>
                      <td className="px-4 py-3">{formatDate(invoice.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'expenses' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-zinc-700">Description</th>
                    <th className="px-4 py-3 text-left font-semibold text-zinc-700">Category</th>
                    <th className="px-4 py-3 text-left font-semibold text-zinc-700">Location</th>
                    <th className="px-4 py-3 text-right font-semibold text-zinc-700">Amount</th>
                    <th className="px-4 py-3 text-right font-semibold text-zinc-700">USD Value</th>
                    <th className="px-4 py-3 text-left font-semibold text-zinc-700">Date</th>
                    <th className="px-4 py-3 text-center font-semibold text-zinc-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {expenses.map((expense) => (
                    <tr key={expense.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3">{expense.description}</td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-2 py-1 text-xs font-semibold rounded-md bg-zinc-100 text-zinc-700">
                          {expense.category}
                        </span>
                      </td>
                      <td className="px-4 py-3">{expense.location}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        {expense.currency} {expense.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-bold">
                        {formatCurrency(expense.amount * expense.exchange_rate_to_usd)}
                      </td>
                      <td className="px-4 py-3">{formatDate(expense.created_at)}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => openEditExpenseModal(expense)}
                          className="text-blue-600 hover:text-blue-800 font-semibold text-xs px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                          title="Edit expense"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-zinc-700">Reference ID</th>
                    <th className="px-4 py-3 text-left font-semibold text-zinc-700">Type</th>
                    <th className="px-4 py-3 text-left font-semibold text-zinc-700">Method</th>
                    <th className="px-4 py-3 text-right font-semibold text-zinc-700">Amount</th>
                    <th className="px-4 py-3 text-left font-semibold text-zinc-700">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {payments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3 font-mono text-xs">{truncateValue(payment.reference_id, 12)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-md ${
                          payment.type === 'Inbound' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {payment.type}
                        </span>
                      </td>
                      <td className="px-4 py-3">{payment.method}</td>
                      <td className={`px-4 py-3 text-right font-bold ${
                        payment.type === 'Inbound' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {payment.type === 'Inbound' ? '+' : '-'}{formatCurrency(payment.amount_usd)}
                      </td>
                      <td className="px-4 py-3">{formatDate(payment.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'reports' && (
            <ReportsOverviewView
              monthlyRevenue={monthlyRevenue}
              monthlyExpenses={monthlyExpenses}
              monthlyProfit={monthlyProfit}
              monthlyTrendData={monthlyTrendData}
              totalPending={totalPending}
              pendingInvoiceCount={pendingInvoices.length}
              totalExpenses={totalExpenses}
              expenseCategoryData={expenseCategoryData}
              invoiceStatusData={invoiceStatusData}
              invoices={invoices}
              revenueByClientData={revenueByClientData}
              summaries={summaries}
              formatCurrency={formatCurrency}
              onExportPDF={handleExportPDF}
              onExportCSV={handleExportCSV}
              onExportDriverFundsReport={handleExportDriverFundsReport}
            />
          )}

          {activeTab === 'clients' && (
            <div className="space-y-5">
              {/* Header */}
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-zinc-900">Clients</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">{mergedClients.length} total — includes all clients from invoices</p>
                </div>
                <button
                  onClick={() => { setEditingClient(null); setClientForm({ name: '', email: '', phone: '', address: '', company: '', notes: '' }); setShowClientModal(true); }}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 flex items-center gap-2 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="2.5" /></svg>
                  Add Client
                </button>
              </div>

              <AccountantClientsView
                clients={mergedClients}
                getClientStats={getClientStats}
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
            </div>
          )}

          {activeTab === 'payslips' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-zinc-900">Payslips</h3>
                <button onClick={() => { setPayslipForm(createEmptyPayslipForm()); setShowPayslipModal(true); }} className="bg-pink-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-pink-700 flex items-center gap-2"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="2.5" /></svg> Generate Payslip</button>
              </div>
              <PayslipsListView
                payslips={payslips}
                onApprove={(id) => handleUpdatePayslipStatus(id, 'Approved')}
                onMarkPaid={(id) => handleUpdatePayslipStatus(id, 'Paid')}
                onDownload={handleDownloadPayslip}
                onDelete={handleDeletePayslip}
                showIntro={false}
              />
            </div>
          )}
          {activeTab === 'operating-funds' && (
            <OperatingFundsView
              operatingFunds={operatingFunds}
              driverFundsReport={driverFundsReport}
              formatCurrency={formatCurrency}
              onDeleteFund={handleDeleteFund}
              onExportDriverFundsReport={handleExportDriverFundsReport}
              onOpenFundModal={() => setShowFundModal(true)}
            />
          )}
          {activeTab === 'expense-reports' && (
            <div className="space-y-6">
              {/* Filters */}
              <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4">
                <h3 className="text-sm font-bold text-zinc-700 mb-3 uppercase tracking-wide">Filters</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-zinc-500 mb-1 block">From</label>
                    <input type="date" value={erDateFrom} onChange={e => setErDateFrom(e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-500 mb-1 block">To</label>
                    <input type="date" value={erDateTo} onChange={e => setErDateTo(e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-500 mb-1 block">Category</label>
                    <select value={erCategory} onChange={e => setErCategory(e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="">All Categories</option>
                      {['Fuel', 'Tolls', 'Food', 'Repairs', 'Duty', 'Shipping', 'Driver Disbursement', 'Other'].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-500 mb-1 block">Location</label>
                    <select value={erLocation} onChange={e => setErLocation(e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="">All Locations</option>
                      {['UK', 'Namibia', 'Zimbabwe', 'Botswana'].map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-500 mb-1 block">Vehicle</label>
                    <select value={erVehicle} onChange={e => setErVehicle(e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="">All Vehicles</option>
                      {vehicles.map(v => <option key={v.id} value={v.id}>{v.make_model} — {v.vin_number}</option>)}
                    </select>
                  </div>
                </div>
                {(erDateFrom || erDateTo || erCategory || erLocation || erVehicle) && (
                  <button onClick={() => { setErDateFrom(''); setErDateTo(''); setErCategory(''); setErLocation(''); setErVehicle(''); }} className="mt-3 text-xs text-blue-600 font-semibold hover:underline">
                    Clear filters
                  </button>
                )}
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white border border-zinc-200 rounded-2xl p-5">
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Total Entries</p>
                  <p className="text-3xl font-black text-zinc-900">{filteredExpensesForReport.length}</p>
                </div>
                <div className="bg-white border border-zinc-200 rounded-2xl p-5">
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Total (USD)</p>
                  <p className="text-3xl font-black text-red-600">{formatCurrency(expenseReportTotal)}</p>
                </div>
                <div className="bg-white border border-zinc-200 rounded-2xl p-5">
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Top Category</p>
                  <p className="text-2xl font-black text-zinc-900">{expenseReportByCategory[0]?.category || '—'}</p>
                  {expenseReportByCategory[0] && <p className="text-xs text-zinc-500 mt-1">{formatCurrency(expenseReportByCategory[0].totalUsd)}</p>}
                </div>
              </div>

              {/* Category Breakdown */}
              <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
                  <h3 className="font-bold text-zinc-900">Breakdown by Category</h3>
                  <div className="flex gap-2">
                    <button onClick={handleExportExpenseReportPDF} className="flex items-center gap-2 bg-emerald-600 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-emerald-700 transition-all">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      Export PDF
                    </button>
                    <button onClick={handleExportExpenseReportCSV} className="flex items-center gap-2 bg-blue-600 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-blue-700 transition-all">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      Export CSV
                    </button>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold text-zinc-600 uppercase">Category</th>
                      <th className="px-6 py-3 text-right text-xs font-bold text-zinc-600 uppercase">Entries</th>
                      <th className="px-6 py-3 text-right text-xs font-bold text-zinc-600 uppercase">Total (USD)</th>
                      <th className="px-6 py-3 text-right text-xs font-bold text-zinc-600 uppercase">% of Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {expenseReportByCategory.length === 0 ? (
                      <tr><td colSpan={4} className="px-6 py-8 text-center text-zinc-400">No expenses match the selected filters</td></tr>
                    ) : expenseReportByCategory.map(row => (
                      <tr key={row.category} className="hover:bg-zinc-50">
                        <td className="px-6 py-3 font-semibold text-zinc-900">{row.category}</td>
                        <td className="px-6 py-3 text-right text-zinc-600">{row.count}</td>
                        <td className="px-6 py-3 text-right font-bold text-zinc-900">{formatCurrency(row.totalUsd)}</td>
                        <td className="px-6 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 bg-zinc-100 rounded-full h-1.5">
                              <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${expenseReportTotal > 0 ? (row.totalUsd / expenseReportTotal) * 100 : 0}%` }} />
                            </div>
                            <span className="text-xs text-zinc-500 w-10 text-right">{expenseReportTotal > 0 ? ((row.totalUsd / expenseReportTotal) * 100).toFixed(1) : 0}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {expenseReportByCategory.length > 0 && (
                      <tr className="bg-zinc-50 font-bold">
                        <td className="px-6 py-3 text-zinc-900">Total</td>
                        <td className="px-6 py-3 text-right text-zinc-900">{filteredExpensesForReport.length}</td>
                        <td className="px-6 py-3 text-right text-zinc-900">{formatCurrency(expenseReportTotal)}</td>
                        <td className="px-6 py-3 text-right text-zinc-500">100%</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Detail Table */}
              <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-100">
                  <h3 className="font-bold text-zinc-900">All Entries <span className="text-zinc-400 font-normal text-sm">({filteredExpensesForReport.length})</span></h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold text-zinc-600 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-zinc-600 uppercase">Category</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-zinc-600 uppercase">Description</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-zinc-600 uppercase">Location</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-zinc-600 uppercase">Driver</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-zinc-600 uppercase">Amount</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-zinc-600 uppercase">USD Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {filteredExpensesForReport.length === 0 ? (
                        <tr><td colSpan={7} className="px-6 py-8 text-center text-zinc-400">No expenses match the selected filters</td></tr>
                      ) : filteredExpensesForReport.map(exp => (
                        <tr key={exp.id} className="hover:bg-zinc-50">
                          <td className="px-4 py-3 text-zinc-500 text-xs">{formatDate(exp.created_at)}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-semibold">{exp.category}</span>
                          </td>
                          <td className="px-4 py-3 text-zinc-700 max-w-[200px] truncate">{exp.description}</td>
                          <td className="px-4 py-3 text-zinc-500 text-xs">{exp.location}</td>
                          <td className="px-4 py-3 text-zinc-500 text-xs">{exp.driver_name || '—'}</td>
                          <td className="px-4 py-3 text-right font-medium">{exp.amount.toLocaleString()} {exp.currency}</td>
                          <td className="px-4 py-3 text-right font-bold text-zinc-900">{formatCurrency((exp.amount || 0) * (exp.exchange_rate_to_usd || 1))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Asset Register Tab */}
          {activeTab === 'assets' && (
            <AssetRegister userRole={userRole} />
          )}
        </div>
      </div>

      <OperatingFundEntryModal
        isOpen={showFundModal}
        title="Add Operating Fund Entry"
        onClose={() => setShowFundModal(false)}
        onSubmit={handleAddFund}
        form={operatingFundFormValue}
        onChange={handleOperatingFundFormChange}
        drivers={drivers}
        currencyOptions={['USD', 'GBP']}
        accent="indigo"
        typeSelectorVariant="select"
        showApprovedBy
        showRecipientForReceived
        recipientReceivedLabel="Source"
        submitLabel="Add Entry"
        receivedDescriptionPlaceholder="e.g. Office transfer for operations"
        disbursedDescriptionPlaceholder="e.g. Driver trip float"
      />

      <ClientFormModal
        isOpen={showClientModal}
        title={editingClient ? 'Edit Client' : 'Add New Client'}
        onClose={() => setShowClientModal(false)}
        onSubmit={handleSaveClient}
        form={clientFormValue}
        onChange={handleClientFormChange}
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

      <ExpenseEntryModal
        isOpen={showExpenseModal}
        title="Add Expense"
        submitLabel="Add Expense"
        onClose={() => setShowExpenseModal(false)}
        onSubmit={handleAddExpense}
        vehicles={vehicles}
        drivers={drivers}
        form={addExpenseFormValue}
        onChange={handleAddExpenseFormChange}
        accent="green"
      />

      {/* Edit Expense Modal */}
      <ExpenseEntryModal
        isOpen={showEditExpenseModal && Boolean(editingExpense)}
        title="Edit Expense"
        submitLabel="Update Expense"
        onClose={() => setShowEditExpenseModal(false)}
        onSubmit={handleUpdateExpense}
        vehicles={vehicles}
        drivers={drivers}
        form={editExpenseFormValue}
        onChange={handleEditExpenseFormChange}
        accent="blue"
        categoryOptions={['Fuel', 'Tolls', 'Food', 'Repairs', 'Duty', 'Shipping', 'Other']}
      />
      <ToastContainer />
      <ConfirmDialog />
    </div>
  );
};
