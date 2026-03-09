
import React, { useEffect, useState } from 'react';
import { LandedCostSummary, VehicleStatus, Currency, Client, Employee, Payslip, CompanyDetails, OperatingFund } from '../types';
import { supabase } from '../services/supabaseService';
import { generatePayslipPDF } from '../services/pdfService';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

export const AdminDashboard: React.FC = () => {
  const [summaries, setSummaries] = useState<LandedCostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showDeleteVehicleDialog, setShowDeleteVehicleDialog] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState<{ id: string; make_model: string; vin_number: string } | null>(null);
  const [activeView, setActiveView] = useState<'dashboard' | 'reports' | 'clients' | 'employees' | 'payslips' | 'funds'>('dashboard');
  const [expenses, setExpenses] = useState<any[]>([]);

  // Report filters
  const [reportDateFrom, setReportDateFrom] = useState<string>('');
  const [reportDateTo, setReportDateTo] = useState<string>('');
  const [reportVehicleFilter, setReportVehicleFilter] = useState<string>('all');
  const [isExporting, setIsExporting] = useState(false);

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
    base_pay_usd: '', currency: 'USD' as 'USD' | 'NAD' | 'GBP',
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
    currency: 'USD' as 'USD' | 'NAD' | 'GBP',
    description: '',
    reference: '',
    recipient: '',
    date: new Date().toISOString().split('T')[0]
  });

  // Vehicle Form State
  const [newVin, setNewVin] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [editingVehicle, setEditingVehicle] = useState<any | null>(null);

  // Expense Form State

  const [vehicles, setVehicles] = useState<any[]>([]);
  const [company, setCompany] = useState<CompanyDetails | null>(null);
  const [expenseVehicle, setExpenseVehicle] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCurrency, setExpenseCurrency] = useState<'NAD' | 'GBP' | 'USD'>('NAD');
  const [expenseCategory, setExpenseCategory] = useState<'Fuel' | 'Tolls' | 'Food' | 'Repairs' | 'Duty' | 'Shipping' | 'Other'>('Fuel');
  const [expenseLocation, setExpenseLocation] = useState<'UK' | 'Namibia' | 'Zimbabwe' | 'Botswana'>('Namibia');
  const [expenseDriver, setExpenseDriver] = useState<string>('');

  // FIX: fetchData now throws errors instead of swallowing them silently
  // This ensures callers can handle refresh failures appropriately
  const fetchData = async (throwOnError = false) => {
    try {
      console.log('[AdminDashboard] fetchData: Starting data refresh...');
      const [data, vehicleData, expenseData, clientData, employeeData, payslipData, companyData, fundsData, balanceData] = await Promise.all([
        supabase.getLandedCostSummaries(),
        supabase.getVehicles(),
        supabase.getExpenses(),
        supabase.getClients(),
        supabase.getEmployees(),
        supabase.getPayslips(),
        supabase.getCompanyDetails(),
        supabase.getOperatingFunds(),
        supabase.getOperatingFundsBalance()
      ]);
      console.log('[AdminDashboard] fetchData: Successfully fetched', {
        summaries: data?.length || 0,
        vehicles: vehicleData?.length || 0,
        expenses: expenseData?.length || 0,
        operatingFunds: fundsData?.length || 0
      });
      setSummaries(data);
      setVehicles(vehicleData);
      setExpenses(expenseData);
      setClients(clientData);
      setEmployees(employeeData);
      setPayslips(payslipData);
      setCompany(companyData);
      setOperatingFunds(fundsData);
      setFundsBalance(balanceData);
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

      console.log('[AdminDashboard] handleSaveVehicle: Saving vehicle...', vehicleData);

      if (editingVehicle) {
        await supabase.updateVehicle(editingVehicle.vehicle_id || editingVehicle.id, vehicleData);
      } else {
        const newVehicle = await supabase.addVehicle(vehicleData);
        // FIX: Log the created vehicle to verify it was persisted
        console.log('[AdminDashboard] handleSaveVehicle: Vehicle created successfully:', newVehicle);
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
        alert(editingVehicle ? 'Vehicle updated successfully!' : 'Vehicle added successfully!');
      } catch (refreshError: any) {
        // Vehicle was saved but refresh failed - notify user to manually refresh
        console.error('[AdminDashboard] handleSaveVehicle: Vehicle saved but refresh failed:', refreshError);
        alert('Vehicle saved but failed to refresh list. Please refresh the page to see the new vehicle.');
      }
    } catch (error: any) {
      console.error('[AdminDashboard] handleSaveVehicle: Error saving vehicle:', error);
      alert(error.message || 'Failed to save vehicle. Please try again.');
    }
  };

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


  const openDeleteVehicleDialog = (vehicle: any) => {
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
    } catch (error: any) {
      console.error('Error deleting vehicle:', error);
      if (error.name === 'ValidationError') {
        alert(error.message);
      } else {
        alert('Failed to delete vehicle. Please try again.');
      }
      setShowDeleteVehicleDialog(false);
      setVehicleToDelete(null);
    }
  };

  // Helper functions for filtering data
  const getFilteredExpenses = () => {
    let filtered = [...(expenses || [])];

    if (reportDateFrom) {
      filtered = filtered.filter(e => new Date(e.created_at) >= new Date(reportDateFrom));
    }
    if (reportDateTo) {
      filtered = filtered.filter(e => new Date(e.created_at) <= new Date(reportDateTo));
    }
    if (reportVehicleFilter && reportVehicleFilter !== 'all') {
      filtered = filtered.filter(e => e.vehicle_id === reportVehicleFilter);
    }

    return filtered;
  };

  const getFilteredSummaries = () => {
    if (reportVehicleFilter && reportVehicleFilter !== 'all') {
      return summaries.filter(s => s.vehicle_id === reportVehicleFilter);
    }
    return summaries;
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseAmount) return;
    
    // Validate driver selection for Driver Disbursement
    if (expenseCategory === 'Driver Disbursement' && !expenseDriver) {
      alert('Please select a driver for the disbursement');
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
      alert(expenseDriver 
        ? `Disbursement to ${expenseDriver} recorded successfully!` 
        : 'Expense added successfully!');
    } catch (error) {
      console.error('Error adding expense:', error);
      alert('Failed to add expense. Please try again.');
    }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      // Get filtered data
      const filteredExpenses = getFilteredExpenses();
      const filteredSummaries = getFilteredSummaries();

      const reportContent = `
╔═══════════════════════════════════════════════════════════════════╗
║           AFFINITY LOGISTICS - FLEET ANALYTICS REPORT             ║
╚═══════════════════════════════════════════════════════════════════╝

Generated: ${new Date().toLocaleString()}
${reportDateFrom || reportDateTo ? `\nReport Period: ${reportDateFrom || 'Beginning'} to ${reportDateTo || 'Present'}` : ''}
${reportVehicleFilter !== 'all' ? `\nFiltered by Vehicle: ${vehicles.find(v => v.id === reportVehicleFilter)?.make_model || 'Unknown'}` : ''}

═══════════════════════════════════════════════════════════════════

EXECUTIVE SUMMARY
═══════════════════════════════════════════════════════════════════
Total Fleet Value:        $${filteredSummaries.reduce((sum, s) => sum + (s.total_landed_cost_usd || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
Total Expenses:          $${filteredExpenses.reduce((sum, e) => sum + ((e.amount || 0) * (e.exchange_rate_to_usd || 1)), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
Number of Vehicles:       ${filteredSummaries.length}
Number of Transactions:   ${filteredExpenses.length}
Average Cost per Vehicle: $${filteredSummaries.length > 0 ? (filteredSummaries.reduce((sum, s) => sum + (s.total_landed_cost_usd || 0), 0) / filteredSummaries.length).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}

═══════════════════════════════════════════════════════════════════

EXPENSES BY CATEGORY
═══════════════════════════════════════════════════════════════════
${['Fuel', 'Tolls', 'Food', 'Repairs', 'Duty', 'Shipping', 'Other'].map(category => {
        const categoryExpenses = filteredExpenses.filter(e => e.category === category);
        const total = categoryExpenses.reduce((sum, e) => sum + ((e.amount || 0) * (e.exchange_rate_to_usd || 1)), 0);
        const percentage = filteredExpenses.reduce((sum, e) => sum + ((e.amount || 0) * (e.exchange_rate_to_usd || 1)), 0) > 0
          ? ((total / filteredExpenses.reduce((sum, e) => sum + ((e.amount || 0) * (e.exchange_rate_to_usd || 1)), 0)) * 100).toFixed(1)
          : '0.0';
        return `${category.padEnd(15)} $${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(12)}  (${percentage}%)`;
      }).join('\n')}

═══════════════════════════════════════════════════════════════════

EXPENSES BY LOCATION
═══════════════════════════════════════════════════════════════════
${['UK', 'Namibia', 'Zimbabwe', 'Botswana'].map(location => {
        const locationExpenses = filteredExpenses.filter(e => e.location === location);
        const total = locationExpenses.reduce((sum, e) => sum + ((e.amount || 0) * (e.exchange_rate_to_usd || 1)), 0);
        const count = locationExpenses.length;
        return `${location.padEnd(15)} $${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(12)}  (${count} transactions)`;
      }).join('\n')}

═══════════════════════════════════════════════════════════════════

TOP 10 VEHICLES BY TOTAL COST
═══════════════════════════════════════════════════════════════════
Rank  VIN            Make & Model              Status      Total Cost
────  ─────────────  ────────────────────────  ──────────  ──────────
${[...filteredSummaries]
          .sort((a, b) => (b.total_landed_cost_usd || 0) - (a.total_landed_cost_usd || 0))
          .slice(0, 10)
          .map((s, i) =>
            `${(i + 1).toString().padStart(3)}   ${s.vin_number.slice(0, 13).padEnd(13)}  ${s.make_model.slice(0, 24).padEnd(24)}  ${s.status.padEnd(10)}  $${(s.total_landed_cost_usd || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
          ).join('\n')}

═══════════════════════════════════════════════════════════════════

VEHICLE STATUS DISTRIBUTION
═══════════════════════════════════════════════════════════════════
${statusData.map(s => `${s.name.padEnd(15)} ${s.value.toString().padStart(3)} vehicles`).join('\n')}

═══════════════════════════════════════════════════════════════════

This report was generated by Affinity Logistics Management System
For questions, contact: support@affinity-logistics.com
═══════════════════════════════════════════════════════════════════
`;

      const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `affinity-fleet-report-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert('Report exported successfully!');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export report. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCSV = () => {
    setIsExporting(true);
    try {
      const filteredExpenses = getFilteredExpenses();

      const headers = ['Date', 'Vehicle ID', 'Vehicle', 'Category', 'Location', 'Amount', 'Currency', 'Exchange Rate', 'USD Value', 'Description'];
      const rows = filteredExpenses.map(e => [
        new Date(e.created_at).toISOString().split('T')[0],
        e.vehicle_id || 'N/A',
        vehicles.find(v => v.id === e.vehicle_id)?.make_model || 'General',
        e.category || 'N/A',
        e.location || 'N/A',
        (e.amount || 0).toFixed(2),
        e.currency || 'USD',
        (e.exchange_rate_to_usd || 1).toFixed(4),
        ((e.amount || 0) * (e.exchange_rate_to_usd || 1)).toFixed(2),
        `"${(e.description || 'No description').replace(/"/g, '""')}"`
      ]);

      const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `affinity-expenses-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert('CSV exported successfully!');
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Failed to export CSV. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleAuditReport = () => {
    setIsExporting(true);
    try {
      const filteredExpenses = getFilteredExpenses();
      const filteredSummaries = getFilteredSummaries();

      const auditData = {
        reportDate: new Date().toISOString(),
        reportPeriod: {
          from: reportDateFrom || 'Beginning',
          to: reportDateTo || 'Present'
        },
        fleetSummary: {
          totalVehicles: filteredSummaries.length,
          totalValue: filteredSummaries.reduce((sum, s) => sum + (s.total_landed_cost_usd || 0), 0),
          averageValue: filteredSummaries.length > 0 ? filteredSummaries.reduce((sum, s) => sum + (s.total_landed_cost_usd || 0), 0) / filteredSummaries.length : 0,
          vehiclesByStatus: statusData.reduce((acc, s) => {
            acc[s.name] = s.value;
            return acc;
          }, {} as Record<string, number>)
        },
        expenses: {
          totalExpenses: filteredExpenses.reduce((sum, e) => sum + ((e.amount || 0) * (e.exchange_rate_to_usd || 1)), 0),
          totalTransactions: filteredExpenses.length,
          byCategory: ['Fuel', 'Tolls', 'Food', 'Repairs', 'Duty', 'Shipping', 'Other'].map(category => {
            const categoryExpenses = filteredExpenses.filter(e => e.category === category);
            return {
              category,
              count: categoryExpenses.length,
              total: categoryExpenses.reduce((sum, e) => sum + ((e.amount || 0) * (e.exchange_rate_to_usd || 1)), 0)
            };
          }).filter(c => c.count > 0),
          byLocation: ['UK', 'Namibia', 'Zimbabwe', 'Botswana'].map(location => {
            const locationExpenses = filteredExpenses.filter(e => e.location === location);
            return {
              location,
              count: locationExpenses.length,
              total: locationExpenses.reduce((sum, e) => sum + ((e.amount || 0) * (e.exchange_rate_to_usd || 1)), 0)
            };
          }).filter(l => l.count > 0)
        },
        vehicles: filteredSummaries.map(s => ({
          vin: s.vin_number,
          make_model: s.make_model,
          status: s.status,
          purchase_price_gbp: s.purchase_price_gbp || 0,
          total_expenses_usd: s.total_expenses_usd || 0,
          total_landed_cost_usd: s.total_landed_cost_usd || 0,
          expense_percentage: ((s.total_expenses_usd || 0) / (s.total_landed_cost_usd || 1) * 100).toFixed(2)
        }))
      };

      const auditReport = `╔═══════════════════════════════════════════════════════════════════════════════╗
║              AUDIT REPORT - AFFINITY LOGISTICS MANAGEMENT                     ║
║                        COMPREHENSIVE FLEET ANALYSIS                            ║
╚═══════════════════════════════════════════════════════════════════════════════╝

Generated: ${new Date().toLocaleString()}
Report Period: ${auditData.reportPeriod.from} → ${auditData.reportPeriod.to}
${reportVehicleFilter !== 'all' ? `Filtered by Vehicle: ${vehicles.find(v => v.id === reportVehicleFilter)?.make_model}\n` : ''}
═══════════════════════════════════════════════════════════════════════════════

FLEET SUMMARY
═══════════════════════════════════════════════════════════════════════════════
Total Vehicles:           ${auditData.fleetSummary.totalVehicles}
Total Fleet Value:        $${auditData.fleetSummary.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
Average Vehicle Value:    $${auditData.fleetSummary.averageValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

Vehicle Distribution by Status:
${Object.entries(auditData.fleetSummary.vehiclesByStatus).map(([status, count]) =>
        `  • ${status.padEnd(20)} ${count.toString().padStart(3)} vehicles`
      ).join('\n')}

═══════════════════════════════════════════════════════════════════════════════

EXPENSE ANALYSIS
═══════════════════════════════════════════════════════════════════════════════
Total Expenses:           $${auditData.expenses.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
Total Transactions:       ${auditData.expenses.totalTransactions}
Average per Transaction:  $${auditData.expenses.totalTransactions > 0 ? (auditData.expenses.totalExpenses / auditData.expenses.totalTransactions).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}

Expenses by Category:
${auditData.expenses.byCategory.map(c => {
        const percentage = ((c.total / auditData.expenses.totalExpenses) * 100).toFixed(1);
        return `  • ${c.category.padEnd(20)} $${c.total.toLocaleString(undefined, { minimumFractionDigits: 2 }).padStart(12)}  (${percentage.padStart(5)}%)  ${c.count} transactions`;
      }).join('\n')}

Expenses by Location:
${auditData.expenses.byLocation.map(l => {
        const percentage = ((l.total / auditData.expenses.totalExpenses) * 100).toFixed(1);
        return `  • ${l.location.padEnd(20)} $${l.total.toLocaleString(undefined, { minimumFractionDigits: 2 }).padStart(12)}  (${percentage.padStart(5)}%)  ${l.count} transactions`;
      }).join('\n')}

═══════════════════════════════════════════════════════════════════════════════

DETAILED VEHICLE BREAKDOWN
═══════════════════════════════════════════════════════════════════════════════
${auditData.vehicles.map((v, idx) => `
Vehicle ${idx + 1}: ${v.make_model}
VIN: ${v.vin}
Status: ${v.status}
Purchase Price (GBP): £${v.purchase_price_gbp.toLocaleString()}
Total Expenses (USD): $${v.total_expenses_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
Total Landed Cost:    $${v.total_landed_cost_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
Expense Ratio:        ${v.expense_percentage}%
${'─'.repeat(79)}`
      ).join('\n')}

═══════════════════════════════════════════════════════════════════════════════

KEY PERFORMANCE INDICATORS
═══════════════════════════════════════════════════════════════════════════════
• Fleet Utilization:      ${((auditData.fleetSummary.totalVehicles - (auditData.fleetSummary.vehiclesByStatus['Sold'] || 0)) / auditData.fleetSummary.totalVehicles * 100).toFixed(1)}%
• Average Expense/Vehicle: $${(auditData.expenses.totalExpenses / auditData.fleetSummary.totalVehicles).toLocaleString(undefined, { maximumFractionDigits: 2 })}
• Total Asset Value:      $${auditData.fleetSummary.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
• Expense to Value Ratio: ${((auditData.expenses.totalExpenses / auditData.fleetSummary.totalValue) * 100).toFixed(2)}%

═══════════════════════════════════════════════════════════════════════════════

RECOMMENDATIONS
═══════════════════════════════════════════════════════════════════════════════
${auditData.expenses.byCategory.length > 0 ? `
• Highest expense category: ${[...auditData.expenses.byCategory].sort((a, b) => b.total - a.total)[0]?.category}
  Consider strategies to optimize ${auditData.expenses.byCategory[0]?.category.toLowerCase()} costs.
` : ''}
${auditData.expenses.byLocation.length > 0 ? `
• Highest expense location: ${[...auditData.expenses.byLocation].sort((a, b) => b.total - a.total)[0]?.location}
  Review operational efficiency in ${auditData.expenses.byLocation[0]?.location}.
` : ''}
• Monitor vehicles with expense ratios >30% for potential cost optimization
• Regular maintenance scheduling can reduce repair expenses
• Consider fuel card programs to track and manage fuel costs better

═══════════════════════════════════════════════════════════════════════════════

AUDIT CERTIFICATION
═══════════════════════════════════════════════════════════════════════════════
This audit report has been automatically generated by the Affinity Logistics
Management System. All data is current as of the generation timestamp above.

For inquiries or clarifications, please contact:
  Email: support@affinity-logistics.com
  Phone: +44 20 7946 0958

═══════════════════════════════════════════════════════════════════════════════
END OF REPORT
═══════════════════════════════════════════════════════════════════════════════
`;

      const blob = new Blob([auditReport], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `affinity-audit-report-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert('Comprehensive audit report generated successfully!');
    } catch (error) {
      console.error('Error generating audit report:', error);
      alert('Failed to generate audit report. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Client CRUD handlers
  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      console.log('[AdminDashboard] handleSaveClient: Saving client...');
      if (editingClient) {
        await supabase.updateClient(editingClient.id, clientForm);
        console.log('[AdminDashboard] handleSaveClient: Client updated successfully');
      } else {
        const newClient = await supabase.createClient(clientForm);
        console.log('[AdminDashboard] handleSaveClient: Client created successfully:', newClient?.id);
      }
      setShowClientModal(false);
      setEditingClient(null);
      setClientForm({ name: '', email: '', phone: '', address: '', company: '', notes: '' });
      
      // FIX: Await fetchData and handle refresh errors
      try {
        await fetchData(true);
        alert(editingClient ? 'Client updated successfully!' : 'Client created successfully!');
      } catch (refreshError) {
        console.error('[AdminDashboard] handleSaveClient: Client saved but refresh failed:', refreshError);
        alert('Client saved but failed to refresh list. Please refresh the page.');
      }
    } catch (error: any) {
      console.error('[AdminDashboard] handleSaveClient: Error saving client:', error);
      alert(error?.message || 'Failed to save client. Please try again.');
    }
  };

  const handleDeleteClient = async (id: string) => {
    if (confirm('Are you sure you want to delete this client?')) {
      try {
        console.log('[AdminDashboard] handleDeleteClient: Deleting client:', id);
        await supabase.deleteClient(id);
        console.log('[AdminDashboard] handleDeleteClient: Client deleted successfully');
        await fetchData(true);
      } catch (error: any) {
        console.error('[AdminDashboard] handleDeleteClient: Error deleting client:', error);
        alert(error?.message || 'Failed to delete client.');
      }
    }
  };

  // Employee CRUD handlers
  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      console.log('[AdminDashboard] handleSaveEmployee: Saving employee...');
      const payload = {
        ...employeeForm,
        base_pay_usd: parseFloat(employeeForm.base_pay_usd) || 0
      };
      if (editingEmployee) {
        await supabase.updateEmployee(editingEmployee.id, payload);
        console.log('[AdminDashboard] handleSaveEmployee: Employee updated successfully');
      } else {
        const newEmployee = await supabase.createEmployee(payload);
        console.log('[AdminDashboard] handleSaveEmployee: Employee created successfully:', newEmployee?.id);
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
        alert(editingEmployee ? 'Employee updated successfully!' : 'Employee created successfully!');
      } catch (refreshError) {
        console.error('[AdminDashboard] handleSaveEmployee: Employee saved but refresh failed:', refreshError);
        alert('Employee saved but failed to refresh list. Please refresh the page.');
      }
    } catch (error: any) {
      console.error('[AdminDashboard] handleSaveEmployee: Error saving employee:', error);
      alert(error?.message || 'Failed to save employee. Please try again.');
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (confirm('Are you sure you want to delete this employee? This will also delete all associated payslips.')) {
      try {
        console.log('[AdminDashboard] handleDeleteEmployee: Deleting employee:', id);
        await supabase.deleteEmployee(id);
        console.log('[AdminDashboard] handleDeleteEmployee: Employee deleted successfully');
        await fetchData(true);
      } catch (error: any) {
        console.error('[AdminDashboard] handleDeleteEmployee: Error deleting employee:', error);
        alert(error?.message || 'Failed to delete employee.');
      }
    }
  };

  // Payslip handlers
  const handleGeneratePayslip = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      console.log('[AdminDashboard] handleGeneratePayslip: Generating payslip...');
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
      console.log('[AdminDashboard] handleGeneratePayslip: Payslip generated successfully:', newPayslip?.id);
      
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
        alert('Payslip generated successfully!');
      } catch (refreshError) {
        console.error('[AdminDashboard] handleGeneratePayslip: Payslip saved but refresh failed:', refreshError);
        alert('Payslip generated but failed to refresh list. Please refresh the page.');
      }
    } catch (error: any) {
      console.error('[AdminDashboard] handleGeneratePayslip: Error generating payslip:', error);
      alert(error?.message || 'Failed to generate payslip. Please try again.');
    }
  };

  const handleUpdatePayslipStatus = async (id: string, status: 'Generated' | 'Approved' | 'Paid' | 'Cancelled') => {
    try {
      console.log('[AdminDashboard] handleUpdatePayslipStatus: Updating status:', { id, status });
      await supabase.updatePayslipStatus(id, status);
      console.log('[AdminDashboard] handleUpdatePayslipStatus: Status updated successfully');
      await fetchData(true);
    } catch (error: any) {
      console.error('[AdminDashboard] handleUpdatePayslipStatus: Error updating payslip status:', error);
      alert(error?.message || 'Failed to update payslip status.');
    }
  };

  const handleDeletePayslip = async (id: string) => {
    if (confirm('Are you sure you want to delete this payslip?')) {
      try {
        console.log('[AdminDashboard] handleDeletePayslip: Deleting payslip:', id);
        await supabase.deletePayslip(id);
        console.log('[AdminDashboard] handleDeletePayslip: Payslip deleted successfully');
        await fetchData(true);
      } catch (error: any) {
        console.error('[AdminDashboard] handleDeletePayslip: Error deleting payslip:', error);
        alert(error?.message || 'Failed to delete payslip.');
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

  // Operating Funds handlers
  const handleAddOperatingFund = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      console.log('[AdminDashboard] handleAddOperatingFund: Adding fund transaction...');
      const payload = {
        type: fundsForm.type as 'Received' | 'Disbursed',
        amount: parseFloat(fundsForm.amount) || 0,
        currency: fundsForm.currency,
        description: fundsForm.description,
        reference: fundsForm.reference || undefined,
        recipient: fundsForm.type === 'Disbursed' ? fundsForm.recipient : undefined,
        date: fundsForm.date
      };
      
      const newFund = await supabase.addOperatingFund(payload);
      console.log('[AdminDashboard] handleAddOperatingFund: Transaction recorded:', newFund?.id);
      
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
        alert(fundsForm.type === 'Received' 
          ? 'Funds received recorded successfully!' 
          : 'Disbursement recorded successfully!');
      } catch (refreshError) {
        console.error('[AdminDashboard] handleAddOperatingFund: Saved but refresh failed:', refreshError);
        alert('Transaction saved but failed to refresh. Please refresh the page.');
      }
    } catch (error: any) {
      console.error('[AdminDashboard] handleAddOperatingFund: Error:', error);
      alert(error?.message || 'Failed to record transaction. Please try again.');
    }
  };

  const handleDeleteOperatingFund = async (id: string) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    
    try {
      await supabase.deleteOperatingFund(id);
      await fetchData(true);
      alert('Transaction deleted successfully!');
    } catch (error: any) {
      console.error('[AdminDashboard] handleDeleteOperatingFund: Error:', error);
      alert(error?.message || 'Failed to delete transaction.');
    }
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
  const statusData = [
    { name: 'UK', value: summaries.filter(s => s.status === 'UK').length },
    { name: 'Namibia', value: summaries.filter(s => s.status === 'Namibia').length },
    { name: 'Zimbabwe', value: summaries.filter(s => s.status === 'Zimbabwe').length },
    { name: 'Botswana', value: summaries.filter(s => s.status === 'Botswana').length },
    { name: 'Sold', value: summaries.filter(s => s.status === 'Sold').length },
  ];

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
        <>
          {/* Analytics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-zinc-200 relative overflow-hidden group">
              <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">Total Asset Valuation</p>
              <h2 className="text-4xl font-black mt-3 text-zinc-900">
                ${summaries.reduce((acc, s) => acc + s.total_landed_cost_usd, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </h2>
              <div className="mt-4 flex items-center gap-1.5 text-emerald-600 text-sm font-bold">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 10l7-7m0 0l7 7m-7-7v18" strokeWidth="3" /></svg>
                Healthy Inventory
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-zinc-200">
              <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">In-Transit Assets</p>
              <h2 className="text-4xl font-black mt-3 text-blue-600">
                {summaries.filter(s => s.status !== 'Sold').length}
              </h2>
              <div className="mt-4 flex items-center gap-3">
                <span className="text-zinc-400 text-xs font-bold tracking-tight">Active routes across Namibia & Zim</span>
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-zinc-200">
              <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">Fleet Efficiency</p>
              <h2 className="text-4xl font-black mt-3 text-zinc-900">
                94%
              </h2>
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
                      {statusData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} cornerRadius={8} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex flex-wrap justify-center gap-6">
                {statusData.map((s, i) => (
                  <div key={s.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i] }}></div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{s.name} ({s.value})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Active Inventory List */}
          <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 overflow-hidden">
            <div className="px-8 py-6 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/30">
              <h3 className="text-xl font-black text-zinc-900 tracking-tight">Current Inventory</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-100">
                    <th className="px-8 py-4 font-black text-zinc-400 uppercase tracking-widest text-[10px]">Asset / VIN</th>
                    <th className="px-8 py-4 font-black text-zinc-400 uppercase tracking-widest text-[10px]">Region</th>
                    <th className="px-8 py-4 font-black text-zinc-400 uppercase tracking-widest text-[10px]">Purchase Cost</th>
                    <th className="px-8 py-4 font-black text-zinc-400 uppercase tracking-widest text-[10px]">Landed Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {summaries.map((s) => (
                    <tr key={s.vehicle_id} className="hover:bg-zinc-50 transition-all group">
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className="font-black text-zinc-900 text-base">{s.make_model}</span>
                          <span className="font-mono text-[10px] text-zinc-400 font-bold uppercase tracking-wider">{s.vin_number}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ring-1 ${s.status === 'UK' ? 'bg-zinc-100 text-zinc-500 ring-zinc-200' :
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
                            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Total Valuation</span>
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
                              onClick={() => openDeleteVehicleDialog(s)}
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
        </>
      )}

      {activeView === 'reports' && (
        <div className="space-y-6">
          {/* Reports Header */}
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-8 rounded-3xl text-white">
            <h3 className="text-2xl font-black mb-2">Fleet Analytics & Reports</h3>
            <p className="text-purple-100">Comprehensive insights into your logistics operations</p>
          </div>

          {/* Report Filters */}
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
            <h4 className="text-lg font-bold text-zinc-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Report Filters
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-2">Date From</label>
                <input
                  type="date"
                  value={reportDateFrom}
                  onChange={(e) => setReportDateFrom(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-2">Date To</label>
                <input
                  type="date"
                  value={reportDateTo}
                  onChange={(e) => setReportDateTo(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-2">Filter by Vehicle</label>
                <select
                  value={reportVehicleFilter}
                  onChange={(e) => setReportVehicleFilter(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-purple-500 outline-none"
                >
                  <option value="all">All Vehicles</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.make_model} ({v.vin_number})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  setReportDateFrom('');
                  setReportDateTo('');
                  setReportVehicleFilter('all');
                }}
                className="px-4 py-2 bg-zinc-100 text-zinc-700 font-semibold rounded-lg hover:bg-zinc-200 transition-colors"
              >
                Clear Filters
              </button>
              {(reportDateFrom || reportDateTo || reportVehicleFilter !== 'all') && (
                <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 rounded-lg text-sm font-semibold">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Filters active - Showing filtered results
                </div>
              )}
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">Total Fleet Value</p>
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-3xl font-bold text-zinc-900">${getFilteredSummaries().reduce((sum, s) => sum + (s.total_landed_cost_usd || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              <p className="text-xs text-zinc-500 mt-2">{getFilteredSummaries().length} vehicles</p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">Total Expenses</p>
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                  </svg>
                </div>
              </div>
              <p className="text-3xl font-bold text-zinc-900">${getFilteredExpenses().reduce((sum, e) => sum + ((e.amount || 0) * (e.exchange_rate_to_usd || 1)), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              <p className="text-xs text-zinc-500 mt-2">{getFilteredExpenses().length} transactions</p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">Avg Cost Per Vehicle</p>
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <p className="text-3xl font-bold text-zinc-900">${getFilteredSummaries().length > 0 ? (getFilteredSummaries().reduce((sum, s) => sum + (s.total_landed_cost_usd || 0), 0) / getFilteredSummaries().length).toLocaleString(undefined, { maximumFractionDigits: 0 }) : 0}</p>
              <p className="text-xs text-zinc-500 mt-2">Per unit analysis</p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">Expense Ratio</p>
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
              <p className="text-3xl font-bold text-zinc-900">{getFilteredSummaries().length > 0 ? ((getFilteredExpenses().reduce((sum, e) => sum + ((e.amount || 0) * (e.exchange_rate_to_usd || 1)), 0) / getFilteredSummaries().reduce((sum, s) => sum + (s.total_landed_cost_usd || 0), 0)) * 100).toFixed(1) : 0}%</p>
              <p className="text-xs text-zinc-500 mt-2">Expenses to value</p>
            </div>
          </div>

          {/* Detailed Reports */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Expense Breakdown */}
            <div className="bg-white p-6 rounded-2xl border border-zinc-200">
              <h3 className="text-lg font-bold text-zinc-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                </svg>
                Expenses by Category
              </h3>
              <div className="space-y-3">
                {['Fuel', 'Tolls', 'Food', 'Repairs', 'Duty', 'Shipping', 'Other'].map(category => {
                  const categoryExpenses = getFilteredExpenses().filter(e => e.category === category);
                  const total = categoryExpenses.reduce((sum, e) => sum + ((e.amount || 0) * (e.exchange_rate_to_usd || 1)), 0);
                  const totalExpenseValue = getFilteredExpenses().reduce((sum, e) => sum + ((e.amount || 0) * (e.exchange_rate_to_usd || 1)), 0);
                  const percentage = totalExpenseValue > 0 ? (total / totalExpenseValue * 100) : 0;
                  return total > 0 ? (
                    <div key={category} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-zinc-700">{category}</span>
                        <span className="text-sm font-bold text-purple-600">${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </div>
                      <div className="w-full bg-zinc-100 rounded-full h-2">
                        <div className="bg-purple-600 h-2 rounded-full" style={{ width: `${percentage}%` }}></div>
                      </div>
                      <p className="text-xs text-zinc-500">{categoryExpenses.length} transactions • {percentage.toFixed(1)}%</p>
                    </div>
                  ) : null;
                })}
              </div>
            </div>

            {/* Location Analysis */}
            <div className="bg-white p-6 rounded-2xl border border-zinc-200">
              <h3 className="text-lg font-bold text-zinc-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Expenses by Location
              </h3>
              <div className="space-y-3">
                {['UK', 'Namibia', 'Zimbabwe', 'Botswana'].map(location => {
                  const locationExpenses = getFilteredExpenses().filter(e => e.location === location);
                  const total = locationExpenses.reduce((sum, e) => sum + ((e.amount || 0) * (e.exchange_rate_to_usd || 1)), 0);
                  const totalExpenseValue = getFilteredExpenses().reduce((sum, e) => sum + ((e.amount || 0) * (e.exchange_rate_to_usd || 1)), 0);
                  const percentage = totalExpenseValue > 0 ? (total / totalExpenseValue * 100) : 0;
                  return total > 0 ? (
                    <div key={location} className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg hover:bg-zinc-100 transition-colors">
                      <div>
                        <p className="font-semibold text-zinc-900">{location}</p>
                        <p className="text-xs text-zinc-500">{locationExpenses.length} transactions • {percentage.toFixed(1)}% of total</p>
                      </div>
                      <span className="text-lg font-bold text-blue-600">${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          </div>

          {/* Vehicle Cost Rankings */}
          <div className="bg-white p-6 rounded-2xl border border-zinc-200">
            <h3 className="text-lg font-bold text-zinc-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              Top Vehicles by Total Cost
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-zinc-700">Rank</th>
                    <th className="px-4 py-3 text-left font-semibold text-zinc-700">Vehicle</th>
                    <th className="px-4 py-3 text-left font-semibold text-zinc-700">VIN</th>
                    <th className="px-4 py-3 text-left font-semibold text-zinc-700">Status</th>
                    <th className="px-4 py-3 text-right font-semibold text-zinc-700">Purchase Price</th>
                    <th className="px-4 py-3 text-right font-semibold text-zinc-700">Total Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {[...getFilteredSummaries()].sort((a, b) => (b.total_landed_cost_usd || 0) - (a.total_landed_cost_usd || 0)).slice(0, 10).map((summary, index) => (
                    <tr key={summary.vehicle_id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 text-white rounded-lg flex items-center justify-center font-bold text-xs">
                          {index + 1}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-zinc-900">{summary.make_model}</td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-500">{summary.vin_number.slice(0, 12)}...</td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-2 py-1 text-xs font-semibold rounded-md bg-blue-50 text-blue-700">
                          {summary.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-600">£{(summary.purchase_price_gbp || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-bold text-green-600">${(summary.total_landed_cost_usd || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Export Section */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-8 rounded-2xl text-white">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-bold mb-2">Export Comprehensive Reports</h3>
                <p className="text-indigo-100">Download detailed analytics and reports for stakeholders</p>
              </div>
              {isExporting && (
                <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-lg">
                  <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span className="text-sm font-semibold">Exporting...</span>
                </div>
              )}
            </div>
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={handleExportPDF}
                disabled={isExporting}
                className="px-6 py-3 bg-white text-indigo-600 font-bold rounded-xl hover:bg-indigo-50 transition-all flex items-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export PDF Report
              </button>
              <button
                onClick={handleExportCSV}
                disabled={isExporting}
                className="px-6 py-3 bg-white/10 backdrop-blur-sm text-white font-bold rounded-xl hover:bg-white/20 transition-all flex items-center gap-2 border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Export CSV Data
              </button>
              <button
                onClick={handleAuditReport}
                disabled={isExporting}
                className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg border border-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Audit Report
              </button>
            </div>
            <p className="text-sm text-indigo-100 mt-4">
              {(reportDateFrom || reportDateTo || reportVehicleFilter !== 'all')
                ? '✓ Exports will include only filtered data'
                : 'Exports include all data across the entire fleet'}
            </p>
          </div>
        </div>
      )}

      {/* Clients View */}
      {activeView === 'clients' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-green-600 to-teal-600 p-8 rounded-3xl text-white">
            <h3 className="text-2xl font-black mb-2">Client Management</h3>
            <p className="text-green-100">Manage all your clients and contacts</p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-zinc-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-zinc-50 border-b border-zinc-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Phone</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Company</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-zinc-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {clients.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                        No clients yet. Click "Add Client" to get started.
                      </td>
                    </tr>
                  ) : (
                    clients.map((client) => (
                      <tr key={client.id} className="hover:bg-zinc-50">
                        <td className="px-6 py-4 font-semibold text-zinc-900">{client.name}</td>
                        <td className="px-6 py-4 text-zinc-600">{client.email || '-'}</td>
                        <td className="px-6 py-4 text-zinc-600">{client.phone || '-'}</td>
                        <td className="px-6 py-4 text-zinc-600">{client.company || '-'}</td>
                        <td className="px-6 py-4 text-zinc-600 text-sm">{new Date(client.created_at).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button
                            onClick={() => {
                              setEditingClient(client);
                              setClientForm({
                                name: client.name,
                                email: client.email || '',
                                phone: client.phone || '',
                                address: client.address || '',
                                company: client.company || '',
                                notes: client.notes || ''
                              });
                              setShowClientModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-800 font-semibold"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteClient(client.id)}
                            className="text-red-600 hover:text-red-800 font-semibold"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Employees View */}
      {activeView === 'employees' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-orange-600 to-red-600 p-8 rounded-3xl text-white">
            <h3 className="text-2xl font-black mb-2">Employee Management</h3>
            <p className="text-orange-100">Manage your team and their details</p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-zinc-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-zinc-50 border-b border-zinc-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Employee #</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Position</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Base Pay</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-zinc-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {employees.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-zinc-500">
                        No employees yet. Click "Add Employee" to get started.
                      </td>
                    </tr>
                  ) : (
                    employees.map((employee) => (
                      <tr key={employee.id} className="hover:bg-zinc-50">
                        <td className="px-6 py-4 font-mono text-sm text-zinc-600">{employee.employee_number}</td>
                        <td className="px-6 py-4 font-semibold text-zinc-900">{employee.name}</td>
                        <td className="px-6 py-4 text-zinc-600">{employee.position}</td>
                        <td className="px-6 py-4 text-zinc-900 font-semibold">${employee.base_pay_usd.toLocaleString()} {employee.currency}</td>
                        <td className="px-6 py-4 text-zinc-600">{employee.employment_type}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-md ${employee.status === 'Active' ? 'bg-green-100 text-green-700' :
                            employee.status === 'On Leave' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                            {employee.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button
                            onClick={() => {
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
                                tax_number: employee.tax_number || ''
                              });
                              setShowEmployeeModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-800 font-semibold"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteEmployee(employee.id)}
                            className="text-red-600 hover:text-red-800 font-semibold"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Payslips View */}
      {activeView === 'payslips' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-pink-600 to-purple-600 p-8 rounded-3xl text-white">
            <h3 className="text-2xl font-black mb-2">Payslip Management</h3>
            <p className="text-pink-100">Generate and manage employee payslips</p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-zinc-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-zinc-50 border-b border-zinc-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Payslip #</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Employee</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Period</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Gross Pay</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Net Pay</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-zinc-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {payslips.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-zinc-500">
                        No payslips yet. Click "Generate Payslip" to get started.
                      </td>
                    </tr>
                  ) : (
                    payslips.map((payslip) => (
                      <tr key={payslip.id} className="hover:bg-zinc-50">
                        <td className="px-6 py-4 font-mono text-sm text-zinc-600">{payslip.payslip_number}</td>
                        <td className="px-6 py-4 font-semibold text-zinc-900">{payslip.employee?.name || 'N/A'}</td>
                        <td className="px-6 py-4 text-zinc-600">{new Date(payslip.year, payslip.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</td>
                        <td className="px-6 py-4 text-zinc-900 font-semibold">${payslip.gross_pay.toLocaleString()}</td>
                        <td className="px-6 py-4 text-green-600 font-bold">${payslip.net_pay.toLocaleString()}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-md ${payslip.status === 'Generated' ? 'bg-blue-100 text-blue-700' :
                            payslip.status === 'Approved' ? 'bg-yellow-100 text-yellow-700' :
                              payslip.status === 'Paid' ? 'bg-green-100 text-green-700' :
                                'bg-red-100 text-red-700'
                            }`}>
                            {payslip.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {payslip.status === 'Generated' && (
                              <button
                                onClick={() => handleUpdatePayslipStatus(payslip.id, 'Approved')}
                                className="text-yellow-600 hover:text-yellow-800 font-semibold text-sm"
                              >
                                Approve
                              </button>
                            )}
                            {payslip.status === 'Approved' && (
                              <button
                                onClick={() => handleUpdatePayslipStatus(payslip.id, 'Paid')}
                                className="text-green-600 hover:text-green-800 font-semibold text-sm"
                              >
                                Mark Paid
                              </button>
                            )}
                            <button
                              onClick={() => handleDownloadPayslip(payslip)}
                              className="text-purple-600 hover:text-purple-800 font-semibold text-sm flex items-center gap-1"
                              title="Download PDF"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              PDF
                            </button>
                            <button
                              onClick={() => handleDeletePayslip(payslip.id)}
                              className="text-red-600 hover:text-red-800 font-semibold text-sm"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Operating Funds View */}
      {activeView === 'funds' && (
        <div className="space-y-6">
          {/* Balance Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 rounded-3xl text-white shadow-lg">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-emerald-100 text-sm font-semibold uppercase tracking-wide">Funds Received</span>
              </div>
              <p className="text-3xl font-black">${fundsBalance.received.toLocaleString()}</p>
            </div>
            
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-3xl text-white shadow-lg">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="text-orange-100 text-sm font-semibold uppercase tracking-wide">Total Disbursed</span>
              </div>
              <p className="text-3xl font-black">${fundsBalance.disbursed.toLocaleString()}</p>
            </div>
            
            <div className={`bg-gradient-to-br ${fundsBalance.balance >= 0 ? 'from-blue-500 to-blue-600' : 'from-red-500 to-red-600'} p-6 rounded-3xl text-white shadow-lg`}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                  </svg>
                </div>
                <span className="text-blue-100 text-sm font-semibold uppercase tracking-wide">Current Balance</span>
              </div>
              <p className="text-3xl font-black">${fundsBalance.balance.toLocaleString()}</p>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-white rounded-2xl shadow-lg border border-zinc-200 overflow-hidden">
            <div className="p-6 border-b border-zinc-200">
              <h3 className="text-xl font-bold text-zinc-900">Transaction History</h3>
              <p className="text-zinc-500 text-sm">Track all operating funds received and disbursed</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-zinc-50 border-b border-zinc-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Description</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Recipient</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Reference</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-zinc-600 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-zinc-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {operatingFunds.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-zinc-500">
                        <div className="flex flex-col items-center gap-3">
                          <svg className="w-12 h-12 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          <p>No transactions yet. Click "Record Transaction" to get started.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    operatingFunds.map((fund) => (
                      <tr key={fund.id} className="hover:bg-zinc-50">
                        <td className="px-6 py-4 text-sm text-zinc-600">
                          {new Date(fund.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-md ${
                            fund.type === 'Received' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'
                          }`}>
                            {fund.type === 'Received' ? (
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                              </svg>
                            ) : (
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                              </svg>
                            )}
                            {fund.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-semibold text-zinc-900">{fund.description}</td>
                        <td className="px-6 py-4 text-zinc-600">{fund.recipient || '-'}</td>
                        <td className="px-6 py-4 text-zinc-500 text-sm">{fund.reference || '-'}</td>
                        <td className={`px-6 py-4 text-right font-bold ${fund.type === 'Received' ? 'text-emerald-600' : 'text-orange-600'}`}>
                          {fund.type === 'Received' ? '+' : '-'}${fund.amount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleDeleteOperatingFund(fund.id)}
                            className="text-red-600 hover:text-red-800 font-semibold text-sm"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Operating Funds Modal */}
      {showFundsModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={() => setShowFundsModal(false)}></div>
          <div className="relative bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-zinc-900">Record Transaction</h3>
              <button onClick={() => setShowFundsModal(false)} className="text-zinc-400 hover:text-zinc-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAddOperatingFund} className="space-y-5">
              {/* Transaction Type */}
              <div>
                <label className="text-sm font-semibold text-zinc-700 mb-2 block">Transaction Type *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFundsForm({ ...fundsForm, type: 'Received' })}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      fundsForm.type === 'Received'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-zinc-200 hover:border-zinc-300'
                    }`}
                  >
                    <svg className="w-6 h-6 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                    <span className="font-bold">Received</span>
                    <p className="text-xs text-zinc-500 mt-1">Money from office</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFundsForm({ ...fundsForm, type: 'Disbursed' })}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      fundsForm.type === 'Disbursed'
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-zinc-200 hover:border-zinc-300'
                    }`}
                  >
                    <svg className="w-6 h-6 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                    <span className="font-bold">Disbursed</span>
                    <p className="text-xs text-zinc-500 mt-1">Paid out to driver</p>
                  </button>
                </div>
              </div>

              {/* Amount & Currency */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={fundsForm.amount}
                    onChange={(e) => setFundsForm({ ...fundsForm, amount: e.target.value })}
                    required
                    placeholder="0.00"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Currency</label>
                  <select
                    value={fundsForm.currency}
                    onChange={(e) => setFundsForm({ ...fundsForm, currency: e.target.value as any })}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="USD">USD</option>
                    <option value="NAD">NAD</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-semibold text-zinc-700 mb-2 block">Description *</label>
                <input
                  type="text"
                  value={fundsForm.description}
                  onChange={(e) => setFundsForm({ ...fundsForm, description: e.target.value })}
                  required
                  placeholder={fundsForm.type === 'Received' ? 'e.g., Operating funds from HQ' : 'e.g., Trip expenses - Harare'}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Recipient (for disbursements) */}
              {fundsForm.type === 'Disbursed' && (
                <div>
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Recipient (Driver) *</label>
                  <select
                    value={fundsForm.recipient}
                    onChange={(e) => setFundsForm({ ...fundsForm, recipient: e.target.value })}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="">-- Select Driver --</option>
                    <option value="David">David</option>
                    <option value="Boulton">Boulton</option>
                  </select>
                </div>
              )}

              {/* Reference & Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Reference</label>
                  <input
                    type="text"
                    value={fundsForm.reference}
                    onChange={(e) => setFundsForm({ ...fundsForm, reference: e.target.value })}
                    placeholder="e.g., TRF-001"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Date *</label>
                  <input
                    type="date"
                    value={fundsForm.date}
                    onChange={(e) => setFundsForm({ ...fundsForm, date: e.target.value })}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowFundsModal(false)}
                  className="flex-1 px-6 py-3 rounded-xl border border-zinc-200 text-zinc-700 font-semibold hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`flex-1 ${fundsForm.type === 'Received' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-orange-600 hover:bg-orange-700'} text-white font-bold py-3 rounded-xl shadow-lg`}
                >
                  {fundsForm.type === 'Received' ? 'Record Receipt' : 'Record Disbursement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Vehicle Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={() => setShowAddModal(false)}></div>
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

      {/* Client Modal */}
      {showClientModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={() => setShowClientModal(false)}></div>
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
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={() => setShowEmployeeModal(false)}></div>
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
                  <select value={employeeForm.currency} onChange={(e) => setEmployeeForm({ ...employeeForm, currency: e.target.value as any })} className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-orange-500 outline-none">
                    <option value="USD">USD</option>
                    <option value="NAD">NAD</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Employment Type</label>
                  <select value={employeeForm.employment_type} onChange={(e) => setEmployeeForm({ ...employeeForm, employment_type: e.target.value as any })} className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-orange-500 outline-none">
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
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={() => setShowPayslipModal(false)}></div>
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
                      <option key={m} value={m}>{new Date(2000, m - 1).toLocaleDateString('en-US', { month: 'long' })}</option>
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
    </div>
  );
};
