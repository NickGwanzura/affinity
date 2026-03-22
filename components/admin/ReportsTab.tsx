import React, { useEffect, useState } from 'react';
import { LandedCostSummary } from '../../types';
import { supabase } from '../../services/supabaseService';
import { useToast } from '../Toast';

export const ReportsTab: React.FC = () => {
  const { showToast, ToastContainer } = useToast();

  const [summaries, setSummaries] = useState<LandedCostSummary[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const [reportDateFrom, setReportDateFrom] = useState('');
  const [reportDateTo, setReportDateTo] = useState('');
  const [reportVehicleFilter, setReportVehicleFilter] = useState('all');

  const notifySuccess = (msg: string) => showToast(msg, 'success');
  const notifyError = (msg: string) => showToast(msg, 'error');

  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [summaryData, vehicleData, expenseData] = await Promise.all([
          supabase.getLandedCostSummaries(),
          supabase.getVehicles(),
          supabase.getExpenses(),
        ]);
        setSummaries(summaryData);
        setVehicles(vehicleData);
        setExpenses(expenseData);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('[ReportsTab] load error:', err);
        setLoadError(errorMessage);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ── Filtering helpers ─────────────────────────────────────────────────────

  const getFilteredExpenses = () => {
    let filtered = [...(expenses || [])];
    if (reportDateFrom) filtered = filtered.filter(e => new Date(e.created_at) >= new Date(reportDateFrom));
    if (reportDateTo) filtered = filtered.filter(e => new Date(e.created_at) <= new Date(reportDateTo));
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

  const truncateValue = (value: string | null | undefined, length: number) =>
    value ? value.slice(0, length) : '-';

  const statusData = [
    { name: 'UK', value: summaries.filter(s => s.status === 'UK').length },
    { name: 'Namibia', value: summaries.filter(s => s.status === 'Namibia').length },
    { name: 'Zimbabwe', value: summaries.filter(s => s.status === 'Zimbabwe').length },
    { name: 'Botswana', value: summaries.filter(s => s.status === 'Botswana').length },
    { name: 'Sold', value: summaries.filter(s => s.status === 'Sold').length },
  ];

  // ── Export handlers ───────────────────────────────────────────────────────

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
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
  const catExpenses = filteredExpenses.filter(e => e.category === category);
  const total = catExpenses.reduce((sum, e) => sum + ((e.amount || 0) * (e.exchange_rate_to_usd || 1)), 0);
  const totalAll = filteredExpenses.reduce((sum, e) => sum + ((e.amount || 0) * (e.exchange_rate_to_usd || 1)), 0);
  const percentage = totalAll > 0 ? ((total / totalAll) * 100).toFixed(1) : '0.0';
  return `${category.padEnd(15)} $${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(12)}  (${percentage}%)`;
}).join('\n')}

═══════════════════════════════════════════════════════════════════

EXPENSES BY LOCATION
═══════════════════════════════════════════════════════════════════
${['UK', 'Namibia', 'Zimbabwe', 'Botswana'].map(location => {
  const locExpenses = filteredExpenses.filter(e => e.location === location);
  const total = locExpenses.reduce((sum, e) => sum + ((e.amount || 0) * (e.exchange_rate_to_usd || 1)), 0);
  return `${location.padEnd(15)} $${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(12)}  (${locExpenses.length} transactions)`;
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
    `${(i + 1).toString().padStart(3)}   ${truncateValue(s.vin_number, 13).padEnd(13)}  ${truncateValue(s.make_model, 24).padEnd(24)}  ${(s.status || '-').padEnd(10)}  $${(s.total_landed_cost_usd || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
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
      notifySuccess('Report exported successfully!');
    } catch (err) {
      console.error('[ReportsTab] handleExportPDF error:', err);
      notifyError('Failed to export report. Please try again.');
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
      notifySuccess('CSV exported successfully!');
    } catch (err) {
      console.error('[ReportsTab] handleExportCSV error:', err);
      notifyError('Failed to export CSV. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleAuditReport = () => {
    setIsExporting(true);
    try {
      const filteredExpenses = getFilteredExpenses();
      const filteredSummaries = getFilteredSummaries();

      const totalExpenses = filteredExpenses.reduce((sum, e) => sum + ((e.amount || 0) * (e.exchange_rate_to_usd || 1)), 0);
      const totalValue = filteredSummaries.reduce((sum, s) => sum + (s.total_landed_cost_usd || 0), 0);
      const avgValue = filteredSummaries.length > 0 ? totalValue / filteredSummaries.length : 0;

      const byCategory = ['Fuel', 'Tolls', 'Food', 'Repairs', 'Duty', 'Shipping', 'Other'].map(category => {
        const catExpenses = filteredExpenses.filter(e => e.category === category);
        return { category, count: catExpenses.length, total: catExpenses.reduce((sum, e) => sum + ((e.amount || 0) * (e.exchange_rate_to_usd || 1)), 0) };
      }).filter(c => c.count > 0);

      const byLocation = ['UK', 'Namibia', 'Zimbabwe', 'Botswana'].map(location => {
        const locExpenses = filteredExpenses.filter(e => e.location === location);
        return { location, count: locExpenses.length, total: locExpenses.reduce((sum, e) => sum + ((e.amount || 0) * (e.exchange_rate_to_usd || 1)), 0) };
      }).filter(l => l.count > 0);

      const vehiclesByStatus = statusData.reduce((acc, s) => { acc[s.name] = s.value; return acc; }, {} as Record<string, number>);
      const soldCount = vehiclesByStatus['Sold'] || 0;

      const auditReport = `╔═══════════════════════════════════════════════════════════════════════════════╗
║              AUDIT REPORT - AFFINITY LOGISTICS MANAGEMENT                     ║
║                        COMPREHENSIVE FLEET ANALYSIS                            ║
╚═══════════════════════════════════════════════════════════════════════════════╝

Generated: ${new Date().toLocaleString()}
Report Period: ${reportDateFrom || 'Beginning'} → ${reportDateTo || 'Present'}
${reportVehicleFilter !== 'all' ? `Filtered by Vehicle: ${vehicles.find(v => v.id === reportVehicleFilter)?.make_model}\n` : ''}
═══════════════════════════════════════════════════════════════════════════════

FLEET SUMMARY
═══════════════════════════════════════════════════════════════════════════════
Total Vehicles:           ${filteredSummaries.length}
Total Fleet Value:        $${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
Average Vehicle Value:    $${avgValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

Vehicle Distribution by Status:
${Object.entries(vehiclesByStatus).map(([status, count]) =>
  `  • ${status.padEnd(20)} ${String(count).padStart(3)} vehicles`
).join('\n')}

═══════════════════════════════════════════════════════════════════════════════

EXPENSE ANALYSIS
═══════════════════════════════════════════════════════════════════════════════
Total Expenses:           $${totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
Total Transactions:       ${filteredExpenses.length}
Average per Transaction:  $${filteredExpenses.length > 0 ? (totalExpenses / filteredExpenses.length).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}

Expenses by Category:
${byCategory.map(c => {
  const pct = ((c.total / totalExpenses) * 100).toFixed(1);
  return `  • ${c.category.padEnd(20)} $${c.total.toLocaleString(undefined, { minimumFractionDigits: 2 }).padStart(12)}  (${pct.padStart(5)}%)  ${c.count} transactions`;
}).join('\n')}

Expenses by Location:
${byLocation.map(l => {
  const pct = ((l.total / totalExpenses) * 100).toFixed(1);
  return `  • ${l.location.padEnd(20)} $${l.total.toLocaleString(undefined, { minimumFractionDigits: 2 }).padStart(12)}  (${pct.padStart(5)}%)  ${l.count} transactions`;
}).join('\n')}

═══════════════════════════════════════════════════════════════════════════════

DETAILED VEHICLE BREAKDOWN
═══════════════════════════════════════════════════════════════════════════════
${filteredSummaries.map((v, idx) => `
Vehicle ${idx + 1}: ${v.make_model}
VIN: ${v.vin_number}
Status: ${v.status}
Purchase Price (GBP): £${v.purchase_price_gbp.toLocaleString()}
Total Expenses (USD): $${v.total_expenses_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
Total Landed Cost:    $${v.total_landed_cost_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
Expense Ratio:        ${((v.total_expenses_usd || 0) / (v.total_landed_cost_usd || 1) * 100).toFixed(2)}%
${'─'.repeat(79)}`
).join('\n')}

═══════════════════════════════════════════════════════════════════════════════

KEY PERFORMANCE INDICATORS
═══════════════════════════════════════════════════════════════════════════════
• Fleet Utilization:      ${filteredSummaries.length > 0 ? (((filteredSummaries.length - soldCount) / filteredSummaries.length) * 100).toFixed(1) : 0}%
• Average Expense/Vehicle: $${filteredSummaries.length > 0 ? (totalExpenses / filteredSummaries.length).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0'}
• Total Asset Value:      $${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
• Expense to Value Ratio: ${totalValue > 0 ? ((totalExpenses / totalValue) * 100).toFixed(2) : 0}%

═══════════════════════════════════════════════════════════════════════════════

RECOMMENDATIONS
═══════════════════════════════════════════════════════════════════════════════
${byCategory.length > 0 ? `
• Highest expense category: ${[...byCategory].sort((a, b) => b.total - a.total)[0]?.category}
  Consider strategies to optimize ${byCategory[0]?.category.toLowerCase()} costs.
` : ''}${byLocation.length > 0 ? `
• Highest expense location: ${[...byLocation].sort((a, b) => b.total - a.total)[0]?.location}
  Review operational efficiency in ${byLocation[0]?.location}.
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
      notifySuccess('Comprehensive audit report generated successfully!');
    } catch (err) {
      console.error('[ReportsTab] handleAuditReport error:', err);
      notifyError('Failed to generate audit report. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600"></div>
        <p className="text-zinc-500 font-bold animate-pulse uppercase tracking-widest text-xs">Loading Report Data</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 p-8">
        <div className="rounded-full bg-red-100 p-4">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-zinc-900">Unable to Load Reports</h3>
        <p className="text-zinc-500 text-center max-w-md">{loadError}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-4 px-6 py-2 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const filteredExpenses = getFilteredExpenses();
  const filteredSummaries = getFilteredSummaries();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-8 rounded-3xl text-white">
        <h3 className="text-2xl font-black mb-2">Fleet Analytics &amp; Reports</h3>
        <p className="text-purple-100">Comprehensive insights into your logistics operations</p>
      </div>

      {/* Filters */}
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
            <input type="date" value={reportDateFrom} onChange={(e) => setReportDateFrom(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-purple-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-zinc-700 mb-2">Date To</label>
            <input type="date" value={reportDateTo} onChange={(e) => setReportDateTo(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-purple-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-zinc-700 mb-2">Filter by Vehicle</label>
            <select value={reportVehicleFilter} onChange={(e) => setReportVehicleFilter(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-purple-500 outline-none">
              <option value="all">All Vehicles</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.make_model} ({v.vin_number})</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={() => { setReportDateFrom(''); setReportDateTo(''); setReportVehicleFilter('all'); }} className="px-4 py-2 bg-zinc-100 text-zinc-700 font-semibold rounded-lg hover:bg-zinc-200 transition-colors">
            Clear Filters
          </button>
          {(reportDateFrom || reportDateTo || reportVehicleFilter !== 'all') && (
            <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 rounded-lg text-sm font-semibold">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
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
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-zinc-900">${filteredSummaries.reduce((sum, s) => sum + (s.total_landed_cost_usd || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          <p className="text-xs text-zinc-500 mt-2">{filteredSummaries.length} vehicles</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">Total Expenses</p>
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-zinc-900">${filteredExpenses.reduce((sum, e) => sum + ((e.amount || 0) * (e.exchange_rate_to_usd || 1)), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          <p className="text-xs text-zinc-500 mt-2">{filteredExpenses.length} transactions</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">Avg Cost Per Vehicle</p>
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-zinc-900">${filteredSummaries.length > 0 ? (filteredSummaries.reduce((sum, s) => sum + (s.total_landed_cost_usd || 0), 0) / filteredSummaries.length).toLocaleString(undefined, { maximumFractionDigits: 0 }) : 0}</p>
          <p className="text-xs text-zinc-500 mt-2">Per unit analysis</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">Expense Ratio</p>
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-zinc-900">
            {filteredSummaries.length > 0
              ? ((filteredExpenses.reduce((sum, e) => sum + ((e.amount || 0) * (e.exchange_rate_to_usd || 1)), 0) /
                  filteredSummaries.reduce((sum, s) => sum + (s.total_landed_cost_usd || 0), 0)) * 100).toFixed(1)
              : 0}%
          </p>
          <p className="text-xs text-zinc-500 mt-2">Expenses to value</p>
        </div>
      </div>

      {/* Detailed Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expense Breakdown by Category */}
        <div className="bg-white p-6 rounded-2xl border border-zinc-200">
          <h3 className="text-lg font-bold text-zinc-900 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
            Expenses by Category
          </h3>
          <div className="space-y-3">
            {['Fuel', 'Tolls', 'Food', 'Repairs', 'Duty', 'Shipping', 'Other'].map(category => {
              const catExpenses = filteredExpenses.filter(e => e.category === category);
              const total = catExpenses.reduce((sum, e) => sum + ((e.amount || 0) * (e.exchange_rate_to_usd || 1)), 0);
              const totalAll = filteredExpenses.reduce((sum, e) => sum + ((e.amount || 0) * (e.exchange_rate_to_usd || 1)), 0);
              const percentage = totalAll > 0 ? (total / totalAll * 100) : 0;
              return total > 0 ? (
                <div key={category} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-zinc-700">{category}</span>
                    <span className="text-sm font-bold text-purple-600">${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="w-full bg-zinc-100 rounded-full h-2">
                    <div className="bg-purple-600 h-2 rounded-full" style={{ width: `${percentage}%` }}></div>
                  </div>
                  <p className="text-xs text-zinc-500">{catExpenses.length} transactions &bull; {percentage.toFixed(1)}%</p>
                </div>
              ) : null;
            })}
          </div>
        </div>

        {/* Location Analysis */}
        <div className="bg-white p-6 rounded-2xl border border-zinc-200">
          <h3 className="text-lg font-bold text-zinc-900 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Expenses by Location
          </h3>
          <div className="space-y-3">
            {['UK', 'Namibia', 'Zimbabwe', 'Botswana'].map(location => {
              const locExpenses = filteredExpenses.filter(e => e.location === location);
              const total = locExpenses.reduce((sum, e) => sum + ((e.amount || 0) * (e.exchange_rate_to_usd || 1)), 0);
              const totalAll = filteredExpenses.reduce((sum, e) => sum + ((e.amount || 0) * (e.exchange_rate_to_usd || 1)), 0);
              const percentage = totalAll > 0 ? (total / totalAll * 100) : 0;
              return total > 0 ? (
                <div key={location} className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg hover:bg-zinc-100 transition-colors">
                  <div>
                    <p className="font-semibold text-zinc-900">{location}</p>
                    <p className="text-xs text-zinc-500">{locExpenses.length} transactions &bull; {percentage.toFixed(1)}% of total</p>
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
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
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
              {[...filteredSummaries]
                .sort((a, b) => (b.total_landed_cost_usd || 0) - (a.total_landed_cost_usd || 0))
                .slice(0, 10)
                .map((summary, index) => (
                  <tr key={summary.vehicle_id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 text-white rounded-lg flex items-center justify-center font-bold text-xs">{index + 1}</div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-zinc-900">{summary.make_model}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">{summary.vin_number ? `${truncateValue(summary.vin_number, 12)}...` : '-'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-1 text-xs font-semibold rounded-md bg-blue-50 text-blue-700">{summary.status}</span>
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
              <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              <span className="text-sm font-semibold">Exporting...</span>
            </div>
          )}
        </div>
        <div className="flex gap-3 flex-wrap">
          <button onClick={handleExportPDF} disabled={isExporting} className="px-6 py-3 bg-white text-indigo-600 font-bold rounded-xl hover:bg-indigo-50 transition-all flex items-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Export PDF Report
          </button>
          <button onClick={handleExportCSV} disabled={isExporting} className="px-6 py-3 bg-white/10 backdrop-blur-sm text-white font-bold rounded-xl hover:bg-white/20 transition-all flex items-center gap-2 border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            Export CSV Data
          </button>
          <button onClick={handleAuditReport} disabled={isExporting} className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg border border-amber-400 disabled:opacity-50 disabled:cursor-not-allowed">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Audit Report
          </button>
        </div>
        <p className="text-sm text-indigo-100 mt-4">
          {(reportDateFrom || reportDateTo || reportVehicleFilter !== 'all')
            ? '✓ Exports will include only filtered data'
            : 'Exports include all data across the entire fleet'}
        </p>
      </div>

      <ToastContainer />
    </div>
  );
};

export default ReportsTab;
