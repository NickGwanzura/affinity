import React, { useEffect, useState, useMemo } from 'react';
import { Invoice, Payment, Expense, Quote, LandedCostSummary, Client, Payslip, CompanyDetails } from '../types';
import { supabase } from '../services/supabaseService';
import { generatePayslipPDF } from '../services/pdfService';
import { Button, StatCard, EmptyState, StatusBadge, SkeletonStatCards, SkeletonChart, SkeletonTable } from './ui';
import { TrendLineChart, DonutPieChart, SimpleBarChart, CHART_COLORS } from './ui/Charts';
import { defaultIcons } from './ui/EmptyState';

export const AccountantDashboard: React.FC = () => {
  const truncateValue = (value: string | null | undefined, length: number, fallback: string = '-') =>
    value ? value.slice(0, length) : fallback;

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [summaries, setSummaries] = useState<LandedCostSummary[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'invoices' | 'expenses' | 'payments' | 'reports' | 'clients' | 'payslips'>('overview');
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showEditExpenseModal, setShowEditExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showClientModal, setShowClientModal] = useState(false);
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientForm, setClientForm] = useState({
    name: '', email: '', phone: '', address: '', company: '', notes: ''
  });
  const [payslipForm, setPayslipForm] = useState({
    employee_id: '', month: new Date().getMonth() + 1, year: new Date().getFullYear(),
    base_pay: '', overtime_hours: '', overtime_rate: '', bonus: '', allowances: '', commission: '',
    tax_deduction: '', pension_deduction: '', health_insurance: '', other_deductions: '',
    payment_date: '', payment_method: 'Bank Transfer' as string, notes: ''
  });
  
  // Expense Form State
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [expenseVehicle, setExpenseVehicle] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCurrency, setExpenseCurrency] = useState<'NAD' | 'GBP' | 'USD' | 'BWP'>('NAD');
  const [expenseCategory, setExpenseCategory] = useState<'Fuel' | 'Tolls' | 'Food' | 'Repairs' | 'Duty' | 'Shipping' | 'Other'>('Fuel');
  const [expenseLocation, setExpenseLocation] = useState<'UK' | 'Namibia' | 'Zimbabwe' | 'Botswana'>('Namibia');
  const [expenseDriver, setExpenseDriver] = useState<string>('');
  const [company, setCompany] = useState<CompanyDetails | null>(null);

  // Edit Expense State
  const [editExpenseVehicle, setEditExpenseVehicle] = useState('');
  const [editExpenseDesc, setEditExpenseDesc] = useState('');
  const [editExpenseAmount, setEditExpenseAmount] = useState('');
  const [editExpenseCurrency, setEditExpenseCurrency] = useState<'NAD' | 'GBP' | 'USD' | 'BWP'>('NAD');
  const [editExpenseCategory, setEditExpenseCategory] = useState<'Fuel' | 'Tolls' | 'Food' | 'Repairs' | 'Duty' | 'Shipping' | 'Other'>('Fuel');
  const [editExpenseLocation, setEditExpenseLocation] = useState<'UK' | 'Namibia' | 'Zimbabwe' | 'Botswana'>('Namibia');

  // FIX: Centralized data loading function with error handling
  const loadData = async (throwOnError = false) => {
    try {
      console.log('[AccountantDashboard] loadData: Fetching data...');
      const [inv, pay, exp, quo, sum, veh, cli, psl, emp, comp] = await Promise.all([
        supabase.getInvoices(),
        supabase.getPayments(),
        supabase.getExpenses(),
        supabase.getQuotes(),
        supabase.getLandedCostSummaries(),
        supabase.getVehicles(),
        supabase.getClients(),
        supabase.getPayslips(),
        supabase.getEmployees(),
        supabase.getCompanyDetails()
      ]);
      console.log('[AccountantDashboard] loadData: Successfully fetched all data');
      setInvoices(inv);
      setPayments(pay);
      setExpenses(exp);
      setQuotes(quo);
      setSummaries(sum);
      setVehicles(veh);
      setClients(cli);
      setPayslips(psl);
      setEmployees(emp);
      setCompany(comp);
      setLoading(false);
    } catch (error: any) {
      console.error('[AccountantDashboard] loadData: Error loading data:', error);
      setLoading(false);
      if (throwOnError) throw error;
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
      const monthLabel = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      
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

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseAmount) return;
    
    // Validate driver selection for Driver Disbursement
    if (expenseCategory === 'Driver Disbursement' && !expenseDriver) {
      alert('Please select a driver for the disbursement');
      return;
    }

    try {
      console.log('[AccountantDashboard] handleAddExpense: Adding expense...');
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
      console.log('[AccountantDashboard] handleAddExpense: Expense added successfully:', newExpense?.id);
      
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
        alert(expenseDriver 
          ? `Disbursement to ${expenseDriver} recorded successfully!` 
          : 'Expense added successfully!');
      } catch (refreshError) {
        console.error('[AccountantDashboard] handleAddExpense: Expense saved but refresh failed:', refreshError);
        alert('Expense added but failed to refresh list. Please refresh the page.');
      }
    } catch (error: any) {
      console.error('[AccountantDashboard] handleAddExpense: Error adding expense:', error);
      alert(error?.message || 'Failed to add expense. Please try again.');
    }
  };

  // Edit Expense Handler
  const openEditExpenseModal = (expense: Expense) => {
    setEditingExpense(expense);
    setEditExpenseVehicle(expense.vehicle_id || '');
    setEditExpenseDesc(expense.description || '');
    setEditExpenseAmount(expense.amount.toString());
    setEditExpenseCurrency(expense.currency);
    setEditExpenseCategory(expense.category as any);
    setEditExpenseLocation(expense.location as any);
    setShowEditExpenseModal(true);
  };

  const handleUpdateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense || !editExpenseAmount) return;

    try {
      console.log('[AccountantDashboard] handleUpdateExpense: Updating expense...');
      await supabase.updateExpense(editingExpense.id, {
        vehicle_id: editExpenseVehicle || undefined,
        description: editExpenseDesc,
        amount: parseFloat(editExpenseAmount),
        currency: editExpenseCurrency,
        category: editExpenseCategory,
        location: editExpenseLocation
      });
      console.log('[AccountantDashboard] handleUpdateExpense: Expense updated successfully');
      
      setShowEditExpenseModal(false);
      setEditingExpense(null);
      
      // Refresh data
      await loadData(true);
      alert('Expense updated successfully!');
    } catch (error: any) {
      console.error('[AccountantDashboard] handleUpdateExpense: Error updating expense:', error);
      alert(error?.message || 'Failed to update expense. Please try again.');
    }
  };

  // Client CRUD handlers
  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      console.log('[AccountantDashboard] handleSaveClient: Saving client...');
      if (editingClient) {
        await supabase.updateClient(editingClient.id, clientForm);
        console.log('[AccountantDashboard] handleSaveClient: Client updated successfully');
      } else {
        const newClient = await supabase.createClient(clientForm);
        console.log('[AccountantDashboard] handleSaveClient: Client created successfully:', newClient?.id);
      }
      
      setShowClientModal(false);
      setEditingClient(null);
      setClientForm({ name: '', email: '', phone: '', address: '', company: '', notes: '' });
      
      // FIX: Refresh all data and handle errors
      try {
        await loadData(true);
        alert(editingClient ? 'Client updated successfully!' : 'Client created successfully!');
      } catch (refreshError) {
        console.error('[AccountantDashboard] handleSaveClient: Client saved but refresh failed:', refreshError);
        alert('Client saved but failed to refresh list. Please refresh the page.');
      }
    } catch (error: any) {
      console.error('[AccountantDashboard] handleSaveClient: Error saving client:', error);
      alert(error?.message || 'Failed to save client. Please try again.');
    }
  };

  const handleDeleteClient = async (id: string) => {
    if (confirm('Are you sure you want to delete this client?')) {
      try {
        console.log('[AccountantDashboard] handleDeleteClient: Deleting client:', id);
        await supabase.deleteClient(id);
        console.log('[AccountantDashboard] handleDeleteClient: Client deleted successfully');
        await loadData(true);
      } catch (error: any) {
        console.error('[AccountantDashboard] handleDeleteClient: Error deleting client:', error);
        alert(error?.message || 'Failed to delete client.');
      }
    }
  };

  // Payslip handlers
  const handleGeneratePayslip = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      console.log('[AccountantDashboard] handleGeneratePayslip: Generating payslip...');
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
      console.log('[AccountantDashboard] handleGeneratePayslip: Payslip generated successfully:', newPayslip?.id);
      
      setShowPayslipModal(false);
      setPayslipForm({
        employee_id: '', month: new Date().getMonth() + 1, year: new Date().getFullYear(),
        base_pay: '', overtime_hours: '', overtime_rate: '', bonus: '', allowances: '', commission: '',
        tax_deduction: '', pension_deduction: '', health_insurance: '', other_deductions: '',
        payment_date: '', payment_method: 'Bank Transfer', notes: ''
      });
      
      // FIX: Refresh all data and handle errors
      try {
        await loadData(true);
        alert('Payslip generated successfully!');
      } catch (refreshError) {
        console.error('[AccountantDashboard] handleGeneratePayslip: Payslip saved but refresh failed:', refreshError);
        alert('Payslip generated but failed to refresh list. Please refresh the page.');
      }
    } catch (error: any) {
      console.error('[AccountantDashboard] handleGeneratePayslip: Error generating payslip:', error);
      alert(error?.message || 'Failed to generate payslip. Please try again.');
    }
  };

  const handleUpdatePayslipStatus = async (id: string, status: 'Generated' | 'Approved' | 'Paid' | 'Cancelled') => {
    try {
      console.log('[AccountantDashboard] handleUpdatePayslipStatus: Updating status:', { id, status });
      await supabase.updatePayslipStatus(id, status);
      console.log('[AccountantDashboard] handleUpdatePayslipStatus: Status updated successfully');
      await loadData(true);
    } catch (error: any) {
      console.error('Error updating payslip status:', error);
      alert('Failed to update payslip status.');
    }
  };

  const handleDeletePayslip = async (id: string) => {
    if (confirm('Are you sure you want to delete this payslip?')) {
      try {
        await supabase.deletePayslip(id);
        const updatedPayslips = await supabase.getPayslips();
        setPayslips(updatedPayslips);
      } catch (error) {
        console.error('Error deleting payslip:', error);
        alert('Failed to delete payslip.');
      }
    }
  };

  const handleDownloadPayslip = async (payslip: Payslip) => {
    if (!company) {
      alert('Company details not loaded. Please try again.');
      return;
    }
    try {
      await generatePayslipPDF(payslip, company);
    } catch (error) {
      console.error('Error generating payslip PDF:', error);
      alert('Failed to generate PDF');
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

  const handleExportPDF = () => {
    const reportContent = `Financial Report\n\nRevenue: ${formatCurrency(totalRevenue)}\nExpenses: ${formatCurrency(totalExpenses)}\nNet Profit: ${formatCurrency(netProfit)}\nPending Invoices: ${formatCurrency(totalPending)}\n\nGenerated: ${new Date().toLocaleString()}`;
    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financial-report-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const headers = ['Date', 'Category', 'Location', 'Amount', 'Currency', 'USD Value', 'Description'];
    const rows = (expenses || []).map(e => [
      new Date(e.created_at).toLocaleDateString(),
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

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
            {(['overview', 'invoices', 'expenses', 'payments', 'reports', 'clients', 'payslips'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 rounded-xl text-sm font-bold capitalize transition-all ${
                  activeTab === tab
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                {tab}
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
                          <p className="font-bold text-zinc-900">{formatCurrency(invoice.amount_usd)}</p>
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
                      <td className="px-4 py-3 text-right font-bold">{formatCurrency(invoice.amount_usd)}</td>
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
            <div className="space-y-6">
              {/* Stats Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard 
                  title="This Month Revenue" 
                  value={formatCurrency(monthlyRevenue)} 
                  trend={monthlyRevenue > (monthlyTrendData[10]?.revenue || 0) ? 'up' : 'down'}
                  trendValue={`${monthlyTrendData[10]?.revenue ? Math.abs(Math.round(((monthlyRevenue - monthlyTrendData[10].revenue) / monthlyTrendData[10].revenue) * 100)) : 0}% vs last month`}
                  icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                />
                <StatCard 
                  title="This Month Expenses" 
                  value={formatCurrency(monthlyExpenses)} 
                  trend={monthlyExpenses < (monthlyTrendData[10]?.expenses || 0) ? 'up' : 'down'}
                  trendValue={`${monthlyTrendData[10]?.expenses ? Math.abs(Math.round(((monthlyExpenses - monthlyTrendData[10].expenses) / monthlyTrendData[10].expenses) * 100)) : 0}% vs last month`}
                  icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                />
                <StatCard 
                  title="Net Profit" 
                  value={formatCurrency(monthlyProfit)} 
                  trend={monthlyProfit >= 0 ? 'up' : 'down'}
                  trendValue={monthlyProfit >= 0 ? 'Positive' : 'Negative'}
                  icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
                />
                <StatCard 
                  title="Pending Invoices" 
                  value={formatCurrency(totalPending)} 
                  trend="neutral"
                  trendValue={`${pendingInvoices.length} invoices`}
                  icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                />
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Revenue vs Expenses Trend */}
                <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
                  <h3 className="text-lg font-bold text-zinc-900 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                    </svg>
                    Revenue vs Expenses Trend (12 Months)
                  </h3>
                  {loading ? (
                    <SkeletonChart />
                  ) : monthlyTrendData.some(d => d.revenue > 0 || d.expenses > 0) ? (
                    <TrendLineChart data={monthlyTrendData} />
                  ) : (
                    <EmptyState 
                      title="No trend data available" 
                      description="Financial data will appear here once you have invoices and expenses."
                      icon={defaultIcons.chart}
                    />
                  )}
                </div>

                {/* Expense by Category Pie Chart */}
                <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
                  <h3 className="text-lg font-bold text-zinc-900 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                    </svg>
                    Expenses by Category
                  </h3>
                  {loading ? (
                    <SkeletonChart />
                  ) : expenseCategoryData.length > 0 ? (
                    <DonutPieChart data={expenseCategoryData} />
                  ) : (
                    <EmptyState 
                      title="No expense data" 
                      description="Expense categories will appear here once you add expenses."
                      icon={defaultIcons.document}
                    />
                  )}
                </div>
              </div>

              {/* Secondary Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Invoice Status Breakdown */}
                <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
                  <h3 className="text-lg font-bold text-zinc-900 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Invoice Status Breakdown
                  </h3>
                  {loading ? (
                    <SkeletonChart />
                  ) : invoiceStatusData.length > 0 ? (
                    <DonutPieChart data={invoiceStatusData} colors={[CHART_COLORS.success, CHART_COLORS.warning, CHART_COLORS.info, CHART_COLORS.danger]} />
                  ) : (
                    <EmptyState 
                      title="No invoice data" 
                      description="Invoice status breakdown will appear here once you create invoices."
                      icon={defaultIcons.document}
                    />
                  )}
                </div>

                {/* Revenue by Client Bar Chart */}
                <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
                  <h3 className="text-lg font-bold text-zinc-900 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Top Clients by Revenue
                  </h3>
                  {loading ? (
                    <SkeletonChart />
                  ) : revenueByClientData.length > 0 ? (
                    <SimpleBarChart data={revenueByClientData} />
                  ) : (
                    <EmptyState 
                      title="No client revenue data" 
                      description="Client revenue data will appear here once you have paid invoices."
                      icon={defaultIcons.users}
                    />
                  )}
                </div>
              </div>

              {/* Detailed Reports */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Vehicles by Cost */}
                <div className="bg-white p-6 rounded-2xl border border-zinc-200">
                  <h3 className="text-lg font-bold text-zinc-900 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Top Vehicles by Total Cost
                  </h3>
                  <div className="space-y-2">
                    {[...summaries]
                      .sort((a, b) => b.total_landed_cost_usd - a.total_landed_cost_usd)
                      .slice(0, 5)
                      .map((summary, index) => (
                      <div key={summary.vehicle_id} className="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg">
                        <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center font-bold">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-zinc-900 text-sm">{summary.make_model}</p>
                          <p className="text-xs text-zinc-500">{summary.vin_number}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-zinc-900">{formatCurrency(summary.total_landed_cost_usd)}</p>
                          <span className="text-xs text-zinc-500">{summary.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Invoice Status Summary */}
                <div className="bg-white p-6 rounded-2xl border border-zinc-200">
                  <h3 className="text-lg font-bold text-zinc-900 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Invoice Summary
                  </h3>
                  <div className="space-y-3">
                    {['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'].map(status => {
                      const statusInvoices = invoices.filter(inv => inv.status === status);
                      const total = statusInvoices.reduce((sum, inv) => sum + inv.amount_usd, 0);
                      return statusInvoices.length > 0 ? (
                        <div key={status} className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <StatusBadge status={status} />
                            <span className="text-sm text-zinc-600">({statusInvoices.length})</span>
                          </div>
                          <span className="text-sm font-bold text-zinc-900">{formatCurrency(total)}</span>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              </div>

              {/* Export Options */}
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 rounded-2xl text-white">
                <h3 className="text-lg font-bold mb-2">Export Reports</h3>
                <p className="text-sm text-blue-100 mb-4">Download comprehensive financial reports for your records</p>
                <div className="flex gap-3">
                  <button onClick={handleExportPDF} className="px-6 py-3 bg-white text-blue-600 font-bold rounded-xl hover:bg-blue-50 transition-all flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export PDF
                  </button>
                  <button onClick={handleExportCSV} className="px-6 py-3 bg-white/10 backdrop-blur-sm text-white font-bold rounded-xl hover:bg-white/20 transition-all flex items-center gap-2 border border-white/20">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Export CSV
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'clients' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-zinc-900">Clients</h3>
                <button onClick={() => { setEditingClient(null); setClientForm({ name: '', email: '', phone: '', address: '', company: '', notes: '' }); setShowClientModal(true); }} className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 flex items-center gap-2"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="2.5" /></svg> Add Client</button>
              </div>
              <table className="w-full">
                <thead className="bg-zinc-50">
                  <tr><th className="px-4 py-3 text-left text-xs font-bold text-zinc-600 uppercase">Name</th><th className="px-4 py-3 text-left text-xs font-bold text-zinc-600 uppercase">Email</th><th className="px-4 py-3 text-left text-xs font-bold text-zinc-600 uppercase">Phone</th><th className="px-4 py-3 text-left text-xs font-bold text-zinc-600 uppercase">Company</th><th className="px-4 py-3 text-right text-xs font-bold text-zinc-600 uppercase">Actions</th></tr>
                </thead>
                <tbody>
                  {clients.length === 0 ? <tr><td colSpan={5} className="px-6 py-8 text-center text-zinc-500">No clients yet</td></tr> : clients.map(client => (
                    <tr key={client.id} className="hover:bg-zinc-50 border-t">
                      <td className="px-4 py-3 font-semibold">{client.name}</td>
                      <td className="px-4 py-3 text-zinc-600">{client.email || '-'}</td>
                      <td className="px-4 py-3 text-zinc-600">{client.phone || '-'}</td>
                      <td className="px-4 py-3 text-zinc-600">{client.company || '-'}</td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button onClick={() => { setEditingClient(client); setClientForm({ name: client.name, email: client.email || '', phone: client.phone || '', address: client.address || '', company: client.company || '', notes: client.notes || '' }); setShowClientModal(true); }} className="text-blue-600 hover:text-blue-800 font-semibold">Edit</button>
                        <button onClick={() => handleDeleteClient(client.id)} className="text-red-600 hover:text-red-800 font-semibold">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'payslips' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-zinc-900">Payslips</h3>
                <button onClick={() => { setPayslipForm({ employee_id: '', month: new Date().getMonth() + 1, year: new Date().getFullYear(), base_pay: '', overtime_hours: '', overtime_rate: '', bonus: '', allowances: '', commission: '', tax_deduction: '', pension_deduction: '', health_insurance: '', other_deductions: '', payment_date: '', payment_method: 'Bank Transfer', notes: '' }); setShowPayslipModal(true); }} className="bg-pink-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-pink-700 flex items-center gap-2"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="2.5" /></svg> Generate Payslip</button>
              </div>
              <table className="w-full">
                <thead className="bg-zinc-50">
                  <tr><th className="px-4 py-3 text-left text-xs font-bold text-zinc-600 uppercase">Payslip #</th><th className="px-4 py-3 text-left text-xs font-bold text-zinc-600 uppercase">Employee</th><th className="px-4 py-3 text-left text-xs font-bold text-zinc-600 uppercase">Period</th><th className="px-4 py-3 text-left text-xs font-bold text-zinc-600 uppercase">Gross Pay</th><th className="px-4 py-3 text-left text-xs font-bold text-zinc-600 uppercase">Net Pay</th><th className="px-4 py-3 text-left text-xs font-bold text-zinc-600 uppercase">Status</th><th className="px-4 py-3 text-right text-xs font-bold text-zinc-600 uppercase">Actions</th></tr>
                </thead>
                <tbody>
                  {payslips.length === 0 ? <tr><td colSpan={7} className="px-6 py-8 text-center text-zinc-500">No payslips yet</td></tr> : payslips.map(payslip => (
                    <tr key={payslip.id} className="hover:bg-zinc-50 border-t">
                      <td className="px-4 py-3 font-mono text-sm">{payslip.payslip_number}</td>
                      <td className="px-4 py-3 font-semibold">{payslip.employee?.name || 'N/A'}</td>
                      <td className="px-4 py-3">{new Date(payslip.year, payslip.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</td>
                      <td className="px-4 py-3 font-semibold">${payslip.gross_pay.toLocaleString()}</td>
                      <td className="px-4 py-3 text-green-600 font-bold">${payslip.net_pay.toLocaleString()}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-1 text-xs font-semibold rounded-md ${payslip.status === 'Generated' ? 'bg-blue-100 text-blue-700' : payslip.status === 'Approved' ? 'bg-yellow-100 text-yellow-700' : payslip.status === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{payslip.status}</span></td>
                      <td className="px-4 py-3 text-right space-x-2">
                        {payslip.status === 'Generated' && <button onClick={() => handleUpdatePayslipStatus(payslip.id, 'Approved')} className="text-yellow-600 hover:text-yellow-800 font-semibold text-sm">Approve</button>}
                        {payslip.status === 'Approved' && <button onClick={() => handleUpdatePayslipStatus(payslip.id, 'Paid')} className="text-green-600 hover:text-green-800 font-semibold text-sm">Mark Paid</button>}
                        <button onClick={() => handleDownloadPayslip(payslip)} className="text-purple-600 hover:text-purple-800 font-semibold text-sm inline-flex items-center gap-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>PDF</button>
                        <button onClick={() => handleDeletePayslip(payslip.id)} className="text-red-600 hover:text-red-800 font-semibold text-sm">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Client Modal - Reusing AdminDashboard modal structure */}
      {showClientModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={() => setShowClientModal(false)}></div>
          <div className="relative bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-zinc-900 mb-6">{editingClient ? 'Edit Client' : 'Add New Client'}</h3>
            <form onSubmit={handleSaveClient} className="space-y-4">
              <div><label className="text-sm font-semibold text-zinc-700 mb-2 block">Name *</label><input type="text" value={clientForm.name} onChange={(e) => setClientForm({...clientForm, name: e.target.value})} required className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-green-500 outline-none" /></div>
              <div className="grid grid-cols-2 gap-4"><div><label className="text-sm font-semibold text-zinc-700 mb-2 block">Email *</label><input type="email" value={clientForm.email} onChange={(e) => setClientForm({...clientForm, email: e.target.value})} required className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-green-500 outline-none" /></div><div><label className="text-sm font-semibold text-zinc-700 mb-2 block">Phone</label><input type="tel" value={clientForm.phone} onChange={(e) => setClientForm({...clientForm, phone: e.target.value})} className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-green-500 outline-none" /></div></div>
              <div><label className="text-sm font-semibold text-zinc-700 mb-2 block">Company</label><input type="text" value={clientForm.company} onChange={(e) => setClientForm({...clientForm, company: e.target.value})} className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-green-500 outline-none" /></div>
              <div><label className="text-sm font-semibold text-zinc-700 mb-2 block">Address</label><input type="text" value={clientForm.address} onChange={(e) => setClientForm({...clientForm, address: e.target.value})} className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-green-500 outline-none" /></div>
              <div><label className="text-sm font-semibold text-zinc-700 mb-2 block">Notes</label><textarea value={clientForm.notes} onChange={(e) => setClientForm({...clientForm, notes: e.target.value})} rows={3} className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-green-500 outline-none resize-none" /></div>
              <div className="flex gap-3 pt-4"><button type="button" onClick={() => setShowClientModal(false)} className="flex-1 px-6 py-3 rounded-xl border text-zinc-700 font-semibold hover:bg-zinc-50">Cancel</button><button type="submit" className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl">Save Client</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Payslip Modal - Compact version */}
      {showPayslipModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={() => setShowPayslipModal(false)}></div>
          <div className="relative bg-white rounded-3xl p-8 max-w-4xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-zinc-900 mb-6">Generate Payslip</h3>
            <form onSubmit={handleGeneratePayslip} className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-3 md:col-span-1"><label className="text-sm font-semibold text-zinc-700 mb-2 block">Employee *</label><select value={payslipForm.employee_id} onChange={(e) => { const empId = e.target.value; const emp = employees.find(e => e.id === empId); setPayslipForm({...payslipForm, employee_id: empId, base_pay: emp ? emp.base_pay_usd.toString() : ''}); }} required className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-pink-500 outline-none"><option value="">Select Employee</option>{employees.map(emp => (<option key={emp.id} value={emp.id}>{emp.name} - {emp.position}</option>))}</select></div>
                <div><label className="text-sm font-semibold text-zinc-700 mb-2 block">Month *</label><select value={payslipForm.month} onChange={(e) => setPayslipForm({...payslipForm, month: parseInt(e.target.value)})} required className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-pink-500 outline-none">{Array.from({length: 12}, (_, i) => i + 1).map(m => (<option key={m} value={m}>{new Date(2000, m - 1).toLocaleDateString('en-US', {month: 'long'})}</option>))}</select></div>
                <div><label className="text-sm font-semibold text-zinc-700 mb-2 block">Year *</label><input type="number" value={payslipForm.year} onChange={(e) => setPayslipForm({...payslipForm, year: parseInt(e.target.value)})} required className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-pink-500 outline-none" /></div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4"><h4 className="text-sm font-bold text-green-800 mb-3">Earnings</h4><div className="grid grid-cols-3 gap-4"><div><label className="text-xs font-semibold text-zinc-600 mb-1 block">Base Pay *</label><input type="number" step="0.01" value={payslipForm.base_pay} onChange={(e) => setPayslipForm({...payslipForm, base_pay: e.target.value})} required className="w-full px-3 py-2 rounded-lg border border-green-300 focus:ring-2 focus:ring-green-500 outline-none" /></div><div><label className="text-xs font-semibold text-zinc-600 mb-1 block">OT Hours</label><input type="number" step="0.01" value={payslipForm.overtime_hours} onChange={(e) => setPayslipForm({...payslipForm, overtime_hours: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-green-300 focus:ring-2 focus:ring-green-500 outline-none" /></div><div><label className="text-xs font-semibold text-zinc-600 mb-1 block">OT Rate</label><input type="number" step="0.01" value={payslipForm.overtime_rate} onChange={(e) => setPayslipForm({...payslipForm, overtime_rate: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-green-300 focus:ring-2 focus:ring-green-500 outline-none" /></div><div><label className="text-xs font-semibold text-zinc-600 mb-1 block">Bonus</label><input type="number" step="0.01" value={payslipForm.bonus} onChange={(e) => setPayslipForm({...payslipForm, bonus: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-green-300 focus:ring-2 focus:ring-green-500 outline-none" /></div><div><label className="text-xs font-semibold text-zinc-600 mb-1 block">Allowances</label><input type="number" step="0.01" value={payslipForm.allowances} onChange={(e) => setPayslipForm({...payslipForm, allowances: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-green-300 focus:ring-2 focus:ring-green-500 outline-none" /></div><div><label className="text-xs font-semibold text-zinc-600 mb-1 block">Commission</label><input type="number" step="0.01" value={payslipForm.commission} onChange={(e) => setPayslipForm({...payslipForm, commission: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-green-300 focus:ring-2 focus:ring-green-500 outline-none" /></div></div></div>
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4"><h4 className="text-sm font-bold text-red-800 mb-3">Deductions</h4><div className="grid grid-cols-4 gap-4"><div><label className="text-xs font-semibold text-zinc-600 mb-1 block">Tax</label><input type="number" step="0.01" value={payslipForm.tax_deduction} onChange={(e) => setPayslipForm({...payslipForm, tax_deduction: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-red-300 focus:ring-2 focus:ring-red-500 outline-none" /></div><div><label className="text-xs font-semibold text-zinc-600 mb-1 block">Pension</label><input type="number" step="0.01" value={payslipForm.pension_deduction} onChange={(e) => setPayslipForm({...payslipForm, pension_deduction: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-red-300 focus:ring-2 focus:ring-red-500 outline-none" /></div><div><label className="text-xs font-semibold text-zinc-600 mb-1 block">Health Insurance</label><input type="number" step="0.01" value={payslipForm.health_insurance} onChange={(e) => setPayslipForm({...payslipForm, health_insurance: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-red-300 focus:ring-2 focus:ring-red-500 outline-none" /></div><div><label className="text-xs font-semibold text-zinc-600 mb-1 block">Other</label><input type="number" step="0.01" value={payslipForm.other_deductions} onChange={(e) => setPayslipForm({...payslipForm, other_deductions: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-red-300 focus:ring-2 focus:ring-red-500 outline-none" /></div></div></div>
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 text-white"><div className="grid grid-cols-3 gap-6 text-center"><div><p className="text-xs text-blue-200 mb-1 uppercase font-semibold">Gross Pay</p><p className="text-2xl font-black">${calculatePayslipTotals().grossPay.toLocaleString()}</p></div><div><p className="text-xs text-blue-200 mb-1 uppercase font-semibold">Deductions</p><p className="text-2xl font-black">-${calculatePayslipTotals().totalDeductions.toLocaleString()}</p></div><div className="border-l-2 border-white/30 pl-6"><p className="text-xs text-blue-200 mb-1 uppercase font-semibold">Net Pay</p><p className="text-3xl font-black">${calculatePayslipTotals().netPay.toLocaleString()}</p></div></div></div>
              <div className="grid grid-cols-2 gap-4"><div><label className="text-sm font-semibold text-zinc-700 mb-2 block">Payment Date</label><input type="date" value={payslipForm.payment_date} onChange={(e) => setPayslipForm({...payslipForm, payment_date: e.target.value})} className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-pink-500 outline-none" /></div><div><label className="text-sm font-semibold text-zinc-700 mb-2 block">Payment Method</label><select value={payslipForm.payment_method} onChange={(e) => setPayslipForm({...payslipForm, payment_method: e.target.value})} className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-pink-500 outline-none"><option value="Bank Transfer">Bank Transfer</option><option value="Cash">Cash</option><option value="Cheque">Cheque</option><option value="Mobile Money">Mobile Money</option></select></div></div>
              <div className="flex gap-3 pt-4"><button type="button" onClick={() => setShowPayslipModal(false)} className="flex-1 px-6 py-3 rounded-xl border text-zinc-700 font-semibold hover:bg-zinc-50">Cancel</button><button type="submit" className="flex-1 bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 rounded-xl">Generate Payslip</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={() => setShowExpenseModal(false)}></div>
          <div className="relative bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-zinc-900">Add Expense</h3>
              <button 
                onClick={() => setShowExpenseModal(false)}
                className="text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-5">
              <div>
                <label className="text-sm font-semibold text-zinc-700 mb-2 block">Vehicle Selection <span className="text-zinc-400 text-xs">(Optional)</span></label>
                <select
                  value={expenseVehicle}
                  onChange={(e) => setExpenseVehicle(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all outline-none"
                >
                  <option value="">None (General expense)</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>{v.make_model} ({v.vin_number})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    required
                    placeholder="0.00"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Currency</label>
                  <select
                    value={expenseCurrency}
                    onChange={(e) => setExpenseCurrency(e.target.value as any)}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  >
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
                  <select
                    value={expenseCategory}
                    onChange={(e) => {
                      setExpenseCategory(e.target.value as any);
                      if (e.target.value !== 'Driver Disbursement') {
                        setExpenseDriver('');
                      }
                    }}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  >
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
                  <select
                    value={expenseLocation}
                    onChange={(e) => setExpenseLocation(e.target.value as any)}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  >
                    <option value="UK">UK</option>
                    <option value="Namibia">Namibia</option>
                    <option value="Zimbabwe">Zimbabwe</option>
                    <option value="Botswana">Botswana</option>
                  </select>
                </div>
              </div>

              {/* Driver Selection - Only shown for Driver Disbursement */}
              {expenseCategory === 'Driver Disbursement' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <label className="text-sm font-semibold text-amber-800 mb-2 block">
                    Select Driver <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={expenseDriver}
                    onChange={(e) => setExpenseDriver(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-amber-300 bg-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                  >
                    <option value="">-- Select Driver --</option>
                    <option value="David">David</option>
                    <option value="Boulton">Boulton</option>
                  </select>
                  <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    Money disbursed to this driver for trip expenses
                  </p>
                </div>
              )}

              <div>
                <label className="text-sm font-semibold text-zinc-700 mb-2 block">
                  Description {expenseCategory === 'Other' && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  placeholder={expenseCategory === 'Other' ? "Please specify the type of expense" : "E.g. Full tank at Engen Windhoek"}
                  rows={3}
                  required={expenseCategory === 'Other'}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none"
                />
                {expenseCategory === 'Other' && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    Required: Please describe what this expense is for
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="flex-1 px-6 py-3 rounded-xl border border-zinc-200 text-zinc-700 font-semibold hover:bg-zinc-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-green-200 transition-all"
                >
                  Add Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Expense Modal */}
      {showEditExpenseModal && editingExpense && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={() => setShowEditExpenseModal(false)}></div>
          <div className="relative bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-zinc-900">Edit Expense</h3>
              <button 
                onClick={() => setShowEditExpenseModal(false)}
                className="text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleUpdateExpense} className="space-y-5">
              <div>
                <label className="text-sm font-semibold text-zinc-700 mb-2 block">Vehicle Selection <span className="text-zinc-400 text-xs">(Optional)</span></label>
                <select
                  value={editExpenseVehicle}
                  onChange={(e) => setEditExpenseVehicle(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                >
                  <option value="">None (General expense)</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>{v.make_model} ({v.vin_number})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editExpenseAmount}
                    onChange={(e) => setEditExpenseAmount(e.target.value)}
                    required
                    placeholder="0.00"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Currency <span className="text-blue-600">*</span></label>
                  <select
                    value={editExpenseCurrency}
                    onChange={(e) => setEditExpenseCurrency(e.target.value as any)}
                    className="w-full px-4 py-3 rounded-xl border border-blue-300 bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-semibold"
                  >
                    <option value="NAD">NAD (Namibia)</option>
                    <option value="GBP">GBP (UK)</option>
                    <option value="USD">USD (General)</option>
                    <option value="BWP">BWP (Botswana)</option>
                  </select>
                  <p className="text-xs text-blue-600 mt-1">Change the currency for this expense</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Category</label>
                  <select
                    value={editExpenseCategory}
                    onChange={(e) => setEditExpenseCategory(e.target.value as any)}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    <option value="Fuel">Fuel</option>
                    <option value="Tolls">Tolls</option>
                    <option value="Food">Food</option>
                    <option value="Repairs">Repairs</option>
                    <option value="Duty">Duty</option>
                    <option value="Shipping">Shipping</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Location</label>
                  <select
                    value={editExpenseLocation}
                    onChange={(e) => setEditExpenseLocation(e.target.value as any)}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    <option value="UK">UK</option>
                    <option value="Namibia">Namibia</option>
                    <option value="Zimbabwe">Zimbabwe</option>
                    <option value="Botswana">Botswana</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-zinc-700 mb-2 block">Description</label>
                <textarea
                  value={editExpenseDesc}
                  onChange={(e) => setEditExpenseDesc(e.target.value)}
                  placeholder="E.g. Full tank at Engen Windhoek"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditExpenseModal(false)}
                  className="flex-1 px-6 py-3 rounded-xl border border-zinc-200 text-zinc-700 font-semibold hover:bg-zinc-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-200 transition-all"
                >
                  Update Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
