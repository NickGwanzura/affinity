import React, { useEffect, useState, useMemo } from 'react';
import { Invoice, Payment, Expense, Quote, LandedCostSummary, Client, Payslip, CompanyDetails, OperatingFund, OperatingFundType, UserRole, AppUser, Employee, Vehicle, Currency, ExpenseCategory, VehicleStatus } from '../types';
import { AssetRegister } from './AssetRegister';
import AccountantClientsView from './accountant/AccountantClientsView';
import {
  AccountantExpenseReportsSection,
  AccountantExpensesSection,
  AccountantInvoicesSection,
  AccountantOverviewSection,
  AccountantPaymentsSection,
} from './accountant/AccountantSections';
import OperatingFundsView from './accountant/OperatingFundsView';
import ReportsOverviewView from './accountant/ReportsOverviewView';
import { ClientFormModalWithBalance, useClientCrud } from './client-directory';
import DashboardSectionSwitcher from './shared/DashboardSectionSwitcher';
import ExpenseEntryModal, { type ExpenseEntryFormValue } from './shared/ExpenseEntryModal';
import OperatingFundEntryModal, { type OperatingFundFormValue } from './shared/OperatingFundEntryModal';
import PayslipFormModal, { createEmptyPayslipForm, type PayslipFormValue } from './shared/PayslipFormModal';
import PayslipsListView from './shared/PayslipsListView';
import { dataService } from '../services/dataService';
import { useSession } from '../contexts/SessionContext';
import { EXCHANGE_RATES } from '../constants';
import { Plus, FileText, DollarSign, Wallet, LineChart, Clock, Receipt } from 'lucide-react';
import { MyFundsWidget } from './shared/MyFundsWidget';
import {
  Button,
  StatCard,
  StatusBadge,
  SkeletonStatCards,
  SkeletonTable,
  DashboardPageHeader,
  DashboardKpiCard,
  DashboardSection,
} from './ui';
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
  const session = useSession();
  const userRole: UserRole = session?.user?.role ?? 'Accountant';
  const userName: string = session?.user?.name ?? '';
  const [operatingFunds, setOperatingFunds] = useState<OperatingFund[]>([]);
  const [showFundModal, setShowFundModal] = useState(false);
  const [fundForm, setFundForm] = useState<{ type: OperatingFundType; amount: string; currency: Currency; description: string; reference: string; recipient: string; approved_by: string; date: string }>({
    type: 'Received', amount: '', currency: 'USD', description: '', reference: '', recipient: '', approved_by: '', date: new Date().toISOString().split('T')[0],
  });
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showEditExpenseModal, setShowEditExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showPayslipModal, setShowPayslipModal] = useState(false);
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

  const crud = useClientCrud({
    addClient: (c) => setClients(prev => [...prev, c]),
    patchClient: (id, partial) => setClients(prev => prev.map(c => c.id === id ? { ...c, ...partial } : c)),
    removeClient: (id) => setClients(prev => prev.filter(c => c.id !== id)),
    showToast,
    confirm,
    onDeleteSelected: () => {},
  });

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

  const handlePayslipFormChange = (updates: Partial<PayslipFormValue>) => {
    setPayslipForm((prev) => ({ ...prev, ...updates }));
  };

  const handleAddFund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fundForm.amount || parseFloat(fundForm.amount) <= 0) { notifyWarning('Enter a valid amount'); return; }
    if (fundForm.type === 'Disbursed' && !fundForm.recipient) { notifyWarning('Please select the driver receiving this disbursement'); return; }
    try {
      await dataService.addOperatingFund({
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
      notifySuccess('Operating fund recorded successfully.');
    } catch (err: any) { notifyError(err?.message || 'Failed to record operating fund. Please try again.'); }
  };

  const handleDeleteFund = async (id: string) => {
    const ok = await confirm({ title: 'Delete Entry', message: 'Remove this operating fund entry? This cannot be undone.', confirmLabel: 'Delete', isDangerous: true });
    if (!ok) return;
    try {
      await dataService.deleteOperatingFund(id);
      await loadData();
      notifySuccess('Operating fund deleted successfully.');
    } catch (err: any) { notifyError(err?.message || 'Failed to delete operating fund. Please try again.'); }
  };

  // FIX: Centralized data loading function with error handling
  const loadData = async (throwOnError = false) => {
    try {
      const [inv, pay, exp, quo, sum, veh, cli, psl, emp, comp, funds, users] = await Promise.all([
        dataService.getInvoices(),
        dataService.getPayments(),
        dataService.getExpenses(),
        dataService.getQuotes(),
        dataService.getLandedCostSummaries(),
        dataService.getVehicles(),
        dataService.getClients(),
        dataService.getPayslips(),
        dataService.getEmployees(),
        dataService.getCompanyDetails(),
        dataService.getOperatingFunds().catch(() => [] as import('../types').OperatingFund[]),
        dataService.getUsers(),
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
      notifyError('Failed to load dashboard data. Please refresh the page.');
    }
  };

  useEffect(() => {
    loadData();
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

  // ── Top-line KPIs for the dashboard shell ───────────────────────────
  // Revenue MTD: sum of paid invoices this month
  // Outstanding: sum of unpaid invoice amounts
  // Expenses MTD: sum expenses this month
  // Cash Position: operating funds running balance (received - disbursed)
  const dashboardKpis = useMemo(() => {
    const cashPosition = (operatingFunds || []).reduce((total, fund) => {
      const usd = (fund.amount || 0) * (EXCHANGE_RATES[fund.currency] || 1);
      return total + (fund.type === 'Received' ? usd : -usd);
    }, 0);

    const fmtCompact = (n: number) => {
      const abs = Math.abs(n);
      const sign = n < 0 ? '-' : '';
      if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
      if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
      return `${sign}$${abs.toFixed(0)}`;
    };

    return {
      revenueMtdLabel: fmtCompact(monthlyRevenue),
      outstandingLabel: fmtCompact(totalPending),
      expensesMtdLabel: fmtCompact(monthlyExpenses),
      cashPositionLabel: fmtCompact(cashPosition),
    };
  }, [monthlyRevenue, totalPending, monthlyExpenses, operatingFunds]);

  const accountantTabOptions: Array<{
    id: 'overview' | 'invoices' | 'expenses' | 'payments' | 'reports' | 'clients' | 'payslips' | 'operating-funds' | 'expense-reports' | 'assets';
    label: string;
  }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'invoices', label: 'Invoices' },
    { id: 'expenses', label: 'Expenses' },
    { id: 'payments', label: 'Payments' },
    { id: 'reports', label: 'Reports' },
    { id: 'clients', label: 'Clients' },
    { id: 'payslips', label: 'Payslips' },
    { id: 'operating-funds', label: 'Operating Funds' },
    { id: 'expense-reports', label: 'Expense Reports' },
    { id: 'assets', label: 'Asset Register' },
  ];

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
      const newExpense = await dataService.addExpense({
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
      await dataService.updateExpense(editingExpense.id, {
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
      const newPayslip = await dataService.generatePayslip(payload);
      
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
      await dataService.updatePayslipStatus(id, status);
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
      await dataService.deletePayslip(id);
      const updatedPayslips = await dataService.getPayslips();
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
      const { generatePayslipPDFAndDownload } = await import('../services/pdfService');
      await generatePayslipPDFAndDownload(payslip, company);
    } catch (error) {
      console.error('Error generating payslip PDF:', error);
      notifyError('Failed to generate PDF');
    }
  };

  const handleExportPDF = async () => {
    if (!company) { notifyError('Company details not loaded.'); return; }
    try {
      const { generateExpensesReportPDFAndDownload } = await import('../services/pdfService');
      await generateExpensesReportPDFAndDownload(expenses, company, vehicles);
    } catch (err) {
      console.error('[AccountantDashboard] handleExportPDF error:', err);
      notifyError('Failed to generate PDF. Please try again.');
    }
  };

  const handleExportExpenseReportPDF = async () => {
    if (!company) { notifyError('Company details not loaded.'); return; }
    try {
      const { generateExpensesReportPDFAndDownload } = await import('../services/pdfService');
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
      const { generateDriverFundsReportPDFAndDownload } = await import('../services/pdfService');
      await generateDriverFundsReportPDFAndDownload(expenses, operatingFunds, drivers, vehicles, company);
      notifySuccess('Driver funds report downloaded.');
    } catch (err) {
      console.error('[AccountantDashboard] handleExportDriverFundsReport error:', err);
      notifyError('Failed to generate driver funds PDF. Please try again.');
    }
  };

  const formatCurrency = (amount: number, currency: Currency = 'USD') =>
    formatMoney(amount, currency);

  const formatDate = (dateString: string) =>
    formatDateValue(dateString, 'en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-stone-200 border-t-[#D97706]"></div>
      </div>
    );
  }

  const activeTabLabel =
    accountantTabOptions.find(option => option.id === activeTab)?.label ?? 'Overview';

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Accountant Dashboard"
        subtitle={userName ? `Welcome back, ${userName}` : 'Financial overview and management'}
        actions={
          <Button variant="primary" leftIcon={<Plus size={20} />} onClick={() => setShowExpenseModal(true)}>
            Add Expense
          </Button>
        }
      />

      {/* Top-line KPI grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <DashboardKpiCard
          label="Revenue MTD"
          value={dashboardKpis.revenueMtdLabel}
          icon={DollarSign}
          iconTone="amber"
          trend="Paid invoices this month"
        />
        <DashboardKpiCard
          label="Outstanding"
          value={dashboardKpis.outstandingLabel}
          icon={FileText}
          iconTone="rose"
          trend={`${pendingInvoices.length} unpaid invoice${pendingInvoices.length === 1 ? '' : 's'}`}
        />
        <DashboardKpiCard
          label="Expenses MTD"
          value={dashboardKpis.expensesMtdLabel}
          icon={Receipt}
          iconTone="stone"
          trend="This month"
        />
        <DashboardKpiCard
          label="Cash Position"
          value={dashboardKpis.cashPositionLabel}
          icon={Wallet}
          iconTone="emerald"
          trend="Operating funds balance"
        />
      </div>

      {/* Section navigation — full-width tab rail, scrolls horizontally
          when there are too many sections to fit. */}
      <DashboardSectionSwitcher
        value={activeTab}
        onChange={setActiveTab}
        label="Section"
        options={accountantTabOptions}
      />

      <DashboardSection title={activeTabLabel}>
        <div className="space-y-6">
          {activeTab === 'overview' && (
            <AccountantOverviewSection
              totalRevenue={totalRevenue}
              totalExpenses={totalExpenses}
              netProfit={netProfit}
              totalPending={totalPending}
              pendingInvoiceCount={pendingInvoices.length}
              invoices={invoices}
              payments={payments}
              summaries={summaries}
              formatCurrency={formatCurrency}
              formatDate={formatDate}
            />
          )}

          {activeTab === 'invoices' && (
            <AccountantInvoicesSection
              invoices={invoices}
              formatCurrency={formatCurrency}
              formatDate={formatDate}
              truncateValue={truncateValue}
            />
          )}

          {activeTab === 'expenses' && (
            <AccountantExpensesSection
              expenses={expenses}
              formatCurrency={formatCurrency}
              formatDate={formatDate}
              onEditExpense={openEditExpenseModal}
            />
          )}

          {activeTab === 'payments' && (
            <AccountantPaymentsSection
              payments={payments}
              formatCurrency={formatCurrency}
              formatDate={formatDate}
              truncateValue={truncateValue}
            />
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
                  <h3 className="text-lg font-bold" style={{ color: '#18181b' }}>Clients</h3>
                  <p className="text-xs mt-0.5" style={{ color: '#52525b' }}>{mergedClients.length} total — includes all clients from invoices</p>
                </div>
                <Button variant="primary" size="sm" leftIcon={<Plus size={16} />} onClick={crud.openAdd}>
                  Add Client
                </Button>
              </div>

              <AccountantClientsView
                clients={mergedClients}
                getClientStats={getClientStats}
                onEditClient={crud.openEdit}
                onDeleteClient={(id) => {
                  const c = mergedClients.find(x => x.id === id);
                  if (c) crud.handleDelete(c);
                }}
              />
            </div>
          )}

          {activeTab === 'payslips' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold" style={{ color: '#18181b' }}>Payslips</h3>
                <Button variant="primary" size="sm" leftIcon={<FileText size={16} />} onClick={() => { setPayslipForm(createEmptyPayslipForm()); setShowPayslipModal(true); }}>Generate Payslip</Button>
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
            <AccountantExpenseReportsSection
              erDateFrom={erDateFrom}
              erDateTo={erDateTo}
              erCategory={erCategory}
              erLocation={erLocation}
              erVehicle={erVehicle}
              vehicles={vehicles}
              filteredExpensesForReport={filteredExpensesForReport}
              expenseReportTotal={expenseReportTotal}
              expenseReportByCategory={expenseReportByCategory}
              formatCurrency={formatCurrency}
              formatDate={formatDate}
              onDateFromChange={setErDateFrom}
              onDateToChange={setErDateTo}
              onCategoryChange={setErCategory}
              onLocationChange={setErLocation}
              onVehicleChange={setErVehicle}
              onClearFilters={() => {
                setErDateFrom('');
                setErDateTo('');
                setErCategory('');
                setErLocation('');
                setErVehicle('');
              }}
              onExportPDF={handleExportExpenseReportPDF}
              onExportCSV={handleExportExpenseReportCSV}
            />
          )}

          {/* Asset Register Tab */}
          {activeTab === 'assets' && (
            <AssetRegister userRole={userRole} />
          )}
        </div>
      </DashboardSection>

      <DashboardSection title="My Funds" subtitle="Log expenses and disburse funds to others. Every entry is visible in the audit trail.">
        <MyFundsWidget canDisburse={true} />
      </DashboardSection>

      <OperatingFundEntryModal
        isOpen={showFundModal}
        title="Add Operating Fund Entry"
        onClose={() => setShowFundModal(false)}
        onSubmit={handleAddFund}
        form={operatingFundFormValue}
        onChange={handleOperatingFundFormChange}
        drivers={drivers}
        currencyOptions={['USD', 'NAD', 'GBP', 'BWP', 'ZAR']}
        accent="indigo"
        typeSelectorVariant="select"
        showApprovedBy
        showRecipientForReceived
        recipientReceivedLabel="Source"
        submitLabel="Add Entry"
        receivedDescriptionPlaceholder="e.g. Office transfer for operations"
        disbursedDescriptionPlaceholder="e.g. Driver trip float"
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
