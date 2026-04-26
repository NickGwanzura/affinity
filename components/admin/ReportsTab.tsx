import React, { useEffect, useMemo, useState } from 'react';
import { Asset, CompanyDetails, LandedCostSummary, OperatingFund, AppUser } from '../../types';
import { dataService } from '../../services/dataService';
import { api } from '../../services/apiClient';
import type { DebtorEntry } from '../../services/pdfService';
import { useToast } from '../Toast';
import { Button, DriverFundsSnapshotPanel, DriverFundsSummaryPanel, InsightPanel, MetricBarList, RankedMetricList } from '../ui';
import { buildDriverFundsReportData } from '../../utils/driverFunds';

export const ReportsTab: React.FC = () => {
  const { showToast, ToastContainer } = useToast();

  const [summaries, setSummaries] = useState<LandedCostSummary[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [operatingFunds, setOperatingFunds] = useState<OperatingFund[]>([]);
  const [drivers, setDrivers] = useState<AppUser[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [company, setCompany] = useState<CompanyDetails | null>(null);
  const [debtors, setDebtors] = useState<DebtorEntry[]>([]);
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
        const [summaryData, vehicleData, expenseData, companyData, fundData, userData] = await Promise.all([
          dataService.getLandedCostSummaries(),
          dataService.getVehicles(),
          dataService.getExpenses(),
          dataService.getCompanyDetails(),
          dataService.getOperatingFunds().catch(() => [] as OperatingFund[]),
          dataService.getUsers(),
        ]);
        setSummaries(summaryData);
        setVehicles(vehicleData);
        setExpenses(expenseData);
        setCompany(companyData);
        setOperatingFunds(fundData);
        setDrivers(userData.filter((user) => user.role === 'Driver' && user.status === 'Active'));

        try {
          const assetData = (await api.assets.list()) as Asset[];
          setAssets(assetData);
        } catch {
          // assets are optional for reports
        }

        try {
          const [clientBalancesRes, invoicesData] = await Promise.all([
            dataService.getAllClientBalances({ hasOutstanding: true }),
            dataService.getInvoices(),
          ]);
          const today = new Date();
          const debtorList: DebtorEntry[] = clientBalancesRes.clients
            .filter(c => c.balance.current_balance > 0)
            .map(c => {
              const clientInvoices = invoicesData.filter(
                inv => inv.client_id === c.id && inv.status !== 'Paid' && inv.status !== 'Cancelled'
              );
              let current = 0, overdue_30 = 0, overdue_60 = 0, overdue_90 = 0, overdue_90plus = 0;
              for (const inv of clientInvoices) {
                const outstanding = Math.max(0, inv.amount_usd);
                if (!inv.due_date) { current += outstanding; continue; }
                const daysOverdue = Math.floor((today.getTime() - new Date(inv.due_date).getTime()) / 86400000);
                if (daysOverdue <= 0)        current       += outstanding;
                else if (daysOverdue <= 30)  overdue_30    += outstanding;
                else if (daysOverdue <= 60)  overdue_60    += outstanding;
                else if (daysOverdue <= 90)  overdue_90    += outstanding;
                else                         overdue_90plus += outstanding;
              }
              return {
                id: c.id,
                name: c.name,
                email: c.email,
                company: c.company || undefined,
                currency: c.balance.currency,
                total_invoiced: c.balance.total_invoiced,
                total_paid: c.balance.total_paid,
                current_balance: c.balance.current_balance,
                current,
                overdue_30,
                overdue_60,
                overdue_90,
                overdue_90plus,
              };
            });
          setDebtors(debtorList);
        } catch {
          // debtors data is optional for reports
        }
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

  const filteredExpenses = useMemo(() => {
    let filtered = [...(expenses || [])];
    if (reportDateFrom) filtered = filtered.filter(e => new Date(e.created_at) >= new Date(reportDateFrom));
    if (reportDateTo) filtered = filtered.filter(e => new Date(e.created_at) <= new Date(reportDateTo));
    if (reportVehicleFilter && reportVehicleFilter !== 'all') {
      filtered = filtered.filter(e => e.vehicle_id === reportVehicleFilter);
    }
    return filtered;
  }, [expenses, reportDateFrom, reportDateTo, reportVehicleFilter]);

  const filteredSummaries = useMemo(() => {
    if (reportVehicleFilter && reportVehicleFilter !== 'all') {
      return summaries.filter(s => s.vehicle_id === reportVehicleFilter);
    }
    return summaries;
  }, [summaries, reportVehicleFilter]);

  const filteredOperatingFunds = useMemo(() => {
    let filtered = [...operatingFunds];
    if (reportDateFrom) filtered = filtered.filter(f => new Date(f.date) >= new Date(reportDateFrom));
    if (reportDateTo) filtered = filtered.filter(f => new Date(f.date) <= new Date(reportDateTo));
    return filtered;
  }, [operatingFunds, reportDateFrom, reportDateTo]);

  const driverFundsReport = useMemo(
    () => buildDriverFundsReportData(filteredExpenses, filteredOperatingFunds, drivers, vehicles),
    [filteredExpenses, filteredOperatingFunds, drivers, vehicles],
  );

  const truncateValue = (value: string | null | undefined, length: number) =>
    value ? value.slice(0, length) : '-';


  // ── Export handlers ───────────────────────────────────────────────────────

  const handleExportPDF = async () => {
    if (!company) { notifyError('Company details not loaded. Please try again.'); return; }
    setIsExporting(true);
    try {
      const { generateFleetReportPDFAndDownload } = await import('../../services/pdfService');
      await generateFleetReportPDFAndDownload(
        filteredSummaries,
        filteredExpenses,
        vehicles,
        company,
        { dateFrom: reportDateFrom || undefined, dateTo: reportDateTo || undefined }
      );
      notifySuccess('Fleet analytics report PDF downloaded!');
    } catch (err) {
      console.error('[ReportsTab] handleExportPDF error:', err);
      notifyError('Failed to generate fleet report PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCSV = () => {
    setIsExporting(true);
    try {
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
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notifySuccess('CSV exported successfully!');
    } catch (err) {
      console.error('[ReportsTab] handleExportCSV error:', err);
      notifyError('Failed to export CSV. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleAuditReport = async () => {
    if (!company) { notifyError('Company details not loaded. Please try again.'); return; }
    setIsExporting(true);
    try {
      const { generateAuditReportPDFAndDownload } = await import('../../services/pdfService');
      await generateAuditReportPDFAndDownload(
        filteredSummaries,
        filteredExpenses,
        company,
        { dateFrom: reportDateFrom || undefined, dateTo: reportDateTo || undefined }
      );
      notifySuccess('Audit report PDF downloaded!');
    } catch (err) {
      console.error('[ReportsTab] handleAuditReport error:', err);
      notifyError('Failed to generate audit report PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExpensesReportPDF = async () => {
    if (!company) { notifyError('Company details not loaded. Please try again.'); return; }
    setIsExporting(true);
    try {
      const { generateExpensesReportPDFAndDownload } = await import('../../services/pdfService');
      await generateExpensesReportPDFAndDownload(
        filteredExpenses,
        company,
        vehicles,
        { dateFrom: reportDateFrom || undefined, dateTo: reportDateTo || undefined }
      );
      notifySuccess('Expenses report PDF downloaded!');
    } catch (err) {
      console.error('[ReportsTab] handleExpensesReportPDF error:', err);
      notifyError('Failed to generate expenses PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleAssetRegisterReportPDF = async () => {
    if (!company) { notifyError('Company details not loaded. Please try again.'); return; }
    setIsExporting(true);
    try {
      const { generateAssetRegisterReportPDFAndDownload } = await import('../../services/pdfService');
      await generateAssetRegisterReportPDFAndDownload(assets, company);
      notifySuccess('Asset register report PDF downloaded!');
    } catch (err) {
      console.error('[ReportsTab] handleAssetRegisterReportPDF error:', err);
      notifyError('Failed to generate asset register PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDebtorsReportPDF = async () => {
    if (!company) { notifyError('Company details not loaded. Please try again.'); return; }
    setIsExporting(true);
    try {
      const { generateDebtorsReportPDFAndDownload } = await import('../../services/pdfService');
      await generateDebtorsReportPDFAndDownload(debtors, company);
      notifySuccess('Debtors report PDF downloaded!');
    } catch (err) {
      console.error('[ReportsTab] handleDebtorsReportPDF error:', err);
      notifyError('Failed to generate debtors report PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDriverFundsReportPDF = async () => {
    if (!company) { notifyError('Company details not loaded. Please try again.'); return; }
    setIsExporting(true);
    try {
      const { generateDriverFundsReportPDFAndDownload } = await import('../../services/pdfService');
      await generateDriverFundsReportPDFAndDownload(
        filteredExpenses,
        filteredOperatingFunds,
        drivers,
        vehicles,
        company,
        {
          dateFrom: reportDateFrom || undefined,
          dateTo: reportDateTo || undefined,
          vehicleFilter: reportVehicleFilter !== 'all' ? (vehicles.find(v => v.id === reportVehicleFilter)?.make_model || reportVehicleFilter) : undefined,
        },
      );
      notifySuccess('Driver funds report PDF downloaded!');
    } catch (err) {
      console.error('[ReportsTab] handleDriverFundsReportPDF error:', err);
      notifyError('Failed to generate driver funds PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#D97706]"></div>
        <p className="font-bold animate-pulse uppercase tracking-widest text-xs" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Loading Report Data</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 p-8">
        <div className="rounded-full p-4" style={{ background: 'var(--cds-support-error-inverse, #fff1f1)' }}>
          <svg className="w-8 h-8" style={{ color: 'var(--cds-support-error, #da1e28)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-lg font-bold" style={{ color: 'var(--cds-text-primary, #161616)' }}>Unable to Load Reports</h3>
        <p className="text-center max-w-md" style={{ color: 'var(--cds-text-secondary, #525252)' }}>{loadError}</p>
        <Button onClick={() => window.location.reload()} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#1C1917] p-8 text-white">
        <h3 className="text-2xl font-black mb-2">Fleet Analytics &amp; Reports</h3>
        <p className="text-white/70">Comprehensive insights into your logistics operations</p>
      </div>

      {/* Filters */}
      <div className="p-6" style={{ background: 'var(--cds-background, #ffffff)', border: '1px solid var(--cds-border-subtle, #e0e0e0)' }}>
        <h4 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--cds-text-primary, #161616)' }}>
          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Report Filters
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-zinc-700 mb-2">Date From</label>
            <input type="date" value={reportDateFrom} onChange={(e) => setReportDateFrom(e.target.value)} className="w-full px-4 py-2 border focus:ring-2 focus:ring-[#D97706] outline-none" style={{ border: '1px solid var(--cds-border-subtle, #e0e0e0)' }} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-zinc-700 mb-2">Date To</label>
            <input type="date" value={reportDateTo} onChange={(e) => setReportDateTo(e.target.value)} className="w-full px-4 py-2 border focus:ring-2 focus:ring-[#D97706] outline-none" style={{ border: '1px solid var(--cds-border-subtle, #e0e0e0)' }} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-zinc-700 mb-2">Filter by Vehicle</label>
            <select value={reportVehicleFilter} onChange={(e) => setReportVehicleFilter(e.target.value)} className="w-full px-4 py-2 border focus:ring-2 focus:ring-[#D97706] outline-none" style={{ border: '1px solid var(--cds-border-subtle, #e0e0e0)' }}>
              <option value="all">All Vehicles</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.make_model} ({v.vin_number})</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={() => { setReportDateFrom(''); setReportDateTo(''); setReportVehicleFilter('all'); }} className="px-4 py-2 font-semibold hover:bg-zinc-200 transition-colors" style={{ background: 'var(--cds-layer-01, #f4f4f4)', color: 'var(--cds-text-secondary, #525252)' }}>
            Clear Filters
          </button>
          {(reportDateFrom || reportDateTo || reportVehicleFilter !== 'all') && (
            <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700  text-sm font-semibold">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Filters active - Showing filtered results
            </div>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="p-6" style={{ background: 'var(--cds-background, #ffffff)', border: '1px solid var(--cds-border-subtle, #e0e0e0)' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Total Fleet Value</p>
            <div className="w-10 h-10 flex items-center justify-center" style={{ background: 'var(--cds-support-info-inverse, #edf5ff)' }}>
              <svg className="w-5 h-5" style={{ color: 'var(--cds-interactive, #D97706)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
          </div>
          <p className="text-3xl font-bold" style={{ color: 'var(--cds-text-primary, #161616)' }}>${filteredSummaries.reduce((sum, s) => sum + (s.total_landed_cost_usd || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          <p className="text-xs mt-2" style={{ color: 'var(--cds-text-secondary, #525252)' }}>{filteredSummaries.length} vehicles</p>
        </div>

        <div className="p-6" style={{ background: 'var(--cds-background, #ffffff)', border: '1px solid var(--cds-border-subtle, #e0e0e0)' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Total Expenses</p>
            <div className="w-10 h-10 flex items-center justify-center" style={{ background: 'var(--cds-support-error-inverse, #fff1f1)' }}>
              <svg className="w-5 h-5" style={{ color: 'var(--cds-support-error, #da1e28)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
            </div>
          </div>
          <p className="text-3xl font-bold" style={{ color: 'var(--cds-text-primary, #161616)' }}>${filteredExpenses.reduce((sum, e) => sum + ((e.amount || 0) * (e.exchange_rate_to_usd || 1)), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          <p className="text-xs mt-2" style={{ color: 'var(--cds-text-secondary, #525252)' }}>{filteredExpenses.length} transactions</p>
        </div>

        <div className="p-6" style={{ background: 'var(--cds-background, #ffffff)', border: '1px solid var(--cds-border-subtle, #e0e0e0)' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Avg Cost Per Vehicle</p>
            <div className="w-10 h-10 flex items-center justify-center" style={{ background: 'var(--cds-support-success-inverse, #defbe6)' }}>
              <svg className="w-5 h-5" style={{ color: 'var(--cds-support-success, #24a148)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
            </div>
          </div>
          <p className="text-3xl font-bold" style={{ color: 'var(--cds-text-primary, #161616)' }}>${filteredSummaries.length > 0 ? (filteredSummaries.reduce((sum, s) => sum + (s.total_landed_cost_usd || 0), 0) / filteredSummaries.length).toLocaleString(undefined, { maximumFractionDigits: 0 }) : 0}</p>
          <p className="text-xs mt-2" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Per unit analysis</p>
        </div>

        <div className="p-6" style={{ background: 'var(--cds-background, #ffffff)', border: '1px solid var(--cds-border-subtle, #e0e0e0)' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Expense Ratio</p>
            <div className="w-10 h-10 bg-purple-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            </div>
          </div>
          <p className="text-3xl font-bold" style={{ color: 'var(--cds-text-primary, #161616)' }}>
            {filteredSummaries.length > 0
              ? ((filteredExpenses.reduce((sum, e) => sum + ((e.amount || 0) * (e.exchange_rate_to_usd || 1)), 0) /
                  filteredSummaries.reduce((sum, s) => sum + (s.total_landed_cost_usd || 0), 0)) * 100).toFixed(1)
              : 0}%
          </p>
          <p className="text-xs mt-2" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Expenses to value</p>
        </div>
      </div>

      {/* Driver Funds */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
        <DriverFundsSummaryPanel
          report={driverFundsReport}
          subtitle="See what was allocated, what has already been spent, and what remains available by driver."
          emptyMessage="No driver-specific disbursements found for the current filter."
          helperFormatter={(summary, formatValue) => `${summary.allocationCount} allocations • ${formatValue(summary.spentUsd)} spent`}
          action={<Button size="sm" onClick={handleDriverFundsReportPDF} disabled={isExporting}>Export Driver Funds PDF</Button>}
        />

        <DriverFundsSnapshotPanel
          report={driverFundsReport}
          subtitle="Carbon-style operational view of the disbursement cycle."
          balanceLabel="Remaining balance"
          spentHelper="{count} spend entries"
          balanceHelper="Outstanding drawdown capacity still in the field"
        />
      </div>

      {/* Detailed Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expense Breakdown by Category */}
        <div className="p-6" style={{ background: 'var(--cds-background, #ffffff)', border: '1px solid var(--cds-border-subtle, #e0e0e0)' }}>
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--cds-text-primary, #161616)' }}>
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
                    <span className="text-sm font-semibold" style={{ color: 'var(--cds-text-secondary, #525252)' }}>{category}</span>
                    <span className="text-sm font-bold text-purple-600">${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="w-full rounded-full h-2" style={{ background: 'var(--cds-layer-01, #f4f4f4)' }}>
                    <div className="bg-purple-600 h-2 rounded-full" style={{ width: `${percentage}%` }}></div>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--cds-text-secondary, #525252)' }}>{catExpenses.length} transactions &bull; {percentage.toFixed(1)}%</p>
                </div>
              ) : null;
            })}
          </div>
        </div>

        {/* Location Analysis */}
        <div className="p-6" style={{ background: 'var(--cds-background, #ffffff)', border: '1px solid var(--cds-border-subtle, #e0e0e0)' }}>
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--cds-text-primary, #161616)' }}>
            <svg className="w-5 h-5" style={{ color: 'var(--cds-interactive, #D97706)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Expenses by Location
          </h3>
          <div className="space-y-3">
            {['UK', 'Namibia', 'Zimbabwe', 'Botswana'].map(location => {
              const locExpenses = filteredExpenses.filter(e => e.location === location);
              const total = locExpenses.reduce((sum, e) => sum + ((e.amount || 0) * (e.exchange_rate_to_usd || 1)), 0);
              const totalAll = filteredExpenses.reduce((sum, e) => sum + ((e.amount || 0) * (e.exchange_rate_to_usd || 1)), 0);
              const percentage = totalAll > 0 ? (total / totalAll * 100) : 0;
              return total > 0 ? (
                <div key={location} className="flex items-center justify-between p-3 transition-colors" style={{ background: 'var(--cds-layer-01, #f4f4f4)' }}>
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--cds-text-primary, #161616)' }}>{location}</p>
                    <p className="text-xs" style={{ color: 'var(--cds-text-secondary, #525252)' }}>{locExpenses.length} transactions &bull; {percentage.toFixed(1)}% of total</p>
                  </div>
                  <span className="text-lg font-bold" style={{ color: 'var(--cds-interactive, #D97706)' }}>${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
              ) : null;
            })}
          </div>
        </div>
      </div>

      {/* Vehicle Cost Rankings */}
      <div className="p-6" style={{ background: 'var(--cds-background, #ffffff)', border: '1px solid var(--cds-border-subtle, #e0e0e0)' }}>
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--cds-text-primary, #161616)' }}>
          <svg className="w-5 h-5" style={{ color: 'var(--cds-support-success, #24a148)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
          Top Vehicles by Total Cost
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Rank</th>
                <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Vehicle</th>
                <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--cds-text-secondary, #525252)' }}>VIN</th>
                <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Status</th>
                <th className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Purchase Price</th>
                <th className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Total Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {[...filteredSummaries]
                .sort((a, b) => (b.total_landed_cost_usd || 0) - (a.total_landed_cost_usd || 0))
                .slice(0, 10)
                .map((summary, index) => (
                  <tr key={summary.vehicle_id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3">
                      <div className="w-8 h-8 bg-[#D97706] text-white flex items-center justify-center font-bold text-xs">{index + 1}</div>
                    </td>
                    <td className="px-4 py-3 font-semibold" style={{ color: 'var(--cds-text-primary, #161616)' }}>{summary.make_model}</td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--cds-text-secondary, #525252)' }}>{summary.vin_number ? `${truncateValue(summary.vin_number, 12)}...` : '-'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-1 text-xs font-semibold" style={{ background: 'var(--cds-support-info-inverse, #edf5ff)', color: 'var(--cds-interactive, #D97706)' }}>{summary.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right" style={{ color: 'var(--cds-text-secondary, #525252)' }}>£{(summary.purchase_price_gbp || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-bold" style={{ color: 'var(--cds-support-success, #24a148)' }}>${(summary.total_landed_cost_usd || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Export Section */}
      <div className="bg-[#1C1917] p-8 text-white">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-xl font-bold mb-2">Export Comprehensive Reports</h3>
            <p className="text-white/70">Download detailed analytics and reports for stakeholders</p>
          </div>
          {isExporting && (
            <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm">
              <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              <span className="text-sm font-semibold">Exporting...</span>
            </div>
          )}
        </div>
        <div className="flex gap-3 flex-wrap">
          <Button onClick={handleExportPDF} disabled={isExporting}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Export PDF Report
          </Button>
          <Button onClick={handleExportCSV} disabled={isExporting} variant="secondary">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            Export CSV Data
          </Button>
          <Button onClick={handleAuditReport} disabled={isExporting} variant="warning">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Audit Report
          </Button>
          <Button onClick={handleExpensesReportPDF} disabled={isExporting} variant="secondary">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
            Expenses Report PDF
          </Button>
          <Button onClick={handleAssetRegisterReportPDF} disabled={isExporting} variant="secondary">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            Asset Register PDF
          </Button>
          <Button onClick={handleDebtorsReportPDF} disabled={isExporting} variant="secondary">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            Debtors Report PDF
          </Button>
        </div>
        <p className="text-sm text-white/70 mt-4">
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
