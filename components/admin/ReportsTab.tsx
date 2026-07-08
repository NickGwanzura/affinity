import React, { useEffect, useMemo, useState } from 'react';
import { Asset, CompanyDetails, FundDisbursement, LandedCostSummary, OperatingFund, AppUser } from '../../types';
import { dataService } from '../../services/dataService';
import { api } from '../../services/apiClient';
import type { DebtorEntry } from '../../services/pdfService';
import { useToast } from '../Toast';
import { Button, DriverFundsSnapshotPanel, DriverFundsSummaryPanel, InsightPanel, MetricBarList, RankedMetricList } from '../ui';
import { buildDriverFundsReportData, buildDriverMonthlySpendReport, buildDriverForensicReport } from '../../utils/driverFunds';
import { PeriodReportPanel } from '../shared/PeriodReportPanel';

export const ReportsTab: React.FC = () => {
  const { showToast, ToastContainer } = useToast();

  const [summaries, setSummaries] = useState<LandedCostSummary[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [operatingFunds, setOperatingFunds] = useState<OperatingFund[]>([]);
  const [fundDisbursements, setFundDisbursements] = useState<FundDisbursement[]>([]);
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
        const [summaryData, vehicleData, expenseData, companyData, fundData, disbursementData, userData] = await Promise.all([
          dataService.getLandedCostSummaries(),
          dataService.getVehicles(),
          dataService.getExpenses(),
          dataService.getCompanyDetails(),
          dataService.getOperatingFunds().catch(() => [] as OperatingFund[]),
          dataService.getFundDisbursements().catch(() => [] as FundDisbursement[]),
          dataService.getUsers(),
        ]);
        setSummaries(summaryData);
        setVehicles(vehicleData);
        setExpenses(expenseData);
        setCompany(companyData);
        setOperatingFunds(fundData);
        setFundDisbursements(disbursementData);
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

  const filteredFundDisbursements = useMemo(() => {
    let filtered = [...fundDisbursements];
    if (reportDateFrom) filtered = filtered.filter(d => new Date(d.disbursed_at) >= new Date(reportDateFrom));
    if (reportDateTo) filtered = filtered.filter(d => new Date(d.disbursed_at) <= new Date(reportDateTo));
    return filtered;
  }, [fundDisbursements, reportDateFrom, reportDateTo]);

  const driverFundsReport = useMemo(
    () => buildDriverFundsReportData(filteredExpenses, filteredOperatingFunds, drivers, vehicles, filteredFundDisbursements),
    [filteredExpenses, filteredFundDisbursements, filteredOperatingFunds, drivers, vehicles],
  );

  const driverMonthlySpend = useMemo(
    () => buildDriverMonthlySpendReport(filteredExpenses, drivers),
    [filteredExpenses, drivers],
  );

  const driverForensic = useMemo(
    () => buildDriverForensicReport(filteredExpenses, drivers),
    [filteredExpenses, drivers],
  );

  const formatMonthLabel = (yyyymm: string) => {
    const [y, m] = yyyymm.split('-').map((v) => parseInt(v, 10));
    if (!y || !m) return yyyymm;
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleString(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' });
  };

  const fmtUsd = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

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

  const handleDriverMonthlySpendCSV = () => {
    setIsExporting(true);
    try {
      const months = driverMonthlySpend.months;
      const headers = [
        'Driver',
        'Total USD',
        'Months Active',
        'Avg / Month USD',
        'Fuel Total USD',
        'Fuel Months Active',
        'Avg Fuel / Month USD',
        'Tx Count',
        ...months.flatMap((m) => [`${m} Total`, `${m} Fuel`]),
      ];
      const rows = driverMonthlySpend.drivers.map((d) => {
        const monthCols = months.flatMap((m) => {
          const bucket = d.months.find((b) => b.month === m);
          return [
            (bucket?.totalUsd || 0).toFixed(2),
            (bucket?.byCategory['Fuel'] || 0).toFixed(2),
          ];
        });
        return [
          `"${d.driverName.replace(/"/g, '""')}"`,
          d.totalUsd.toFixed(2),
          String(d.monthsActive),
          d.avgPerMonthUsd.toFixed(2),
          d.fuel.totalUsd.toFixed(2),
          String(d.fuel.monthsActive),
          d.fuel.avgPerMonthUsd.toFixed(2),
          String(d.txCount),
          ...monthCols,
        ];
      });
      const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `affinity-driver-monthly-spend-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notifySuccess('Driver monthly spend CSV exported!');
    } catch (err) {
      console.error('[ReportsTab] handleDriverMonthlySpendCSV error:', err);
      notifyError('Failed to export driver monthly spend CSV.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleForensicCSV = () => {
    setIsExporting(true);
    try {
      const headers = [
        'Driver', 'Category', 'Month', 'Amount USD',
        'Prev Month USD', 'MoM Δ USD', 'MoM Δ %',
        'Mean USD', 'vs Mean Δ USD', 'vs Mean Δ %',
        'Flag',
      ];
      const rows: string[][] = [];
      for (const profile of driverForensic.drivers) {
        for (const series of [profile.fuel, profile.food] as const) {
          for (const m of series.months) {
            if (m.amountUsd === 0 && m.prevMonthUsd === 0) continue; // skip dead rows
            rows.push([
              `"${profile.driverName.replace(/"/g, '""')}"`,
              series.category,
              m.month,
              m.amountUsd.toFixed(2),
              m.prevMonthUsd === null ? '' : m.prevMonthUsd.toFixed(2),
              m.momDeltaUsd === null ? '' : m.momDeltaUsd.toFixed(2),
              m.momDeltaPct === null ? '' : m.momDeltaPct.toFixed(1),
              m.meanUsd.toFixed(2),
              m.vsMeanDeltaUsd.toFixed(2),
              m.vsMeanDeltaPct === null ? '' : m.vsMeanDeltaPct.toFixed(1),
              m.flag,
            ]);
          }
        }
      }
      const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `affinity-forensic-fuel-food-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notifySuccess('Forensic CSV exported!');
    } catch (err) {
      console.error('[ReportsTab] handleForensicCSV error:', err);
      notifyError('Failed to export forensic CSV.');
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
        filteredFundDisbursements,
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
        <p className="font-bold animate-pulse uppercase tracking-widest text-xs text-zinc-600">Loading Report Data</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 p-8">
        <div className="rounded-full p-4" style={{ background: '#fee2e2' }}>
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-zinc-900">Unable to Load Reports</h3>
        <p className="text-center max-w-md text-zinc-600">{loadError}</p>
        <Button onClick={() => window.location.reload()} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period download panel */}
      <PeriodReportPanel />

      {/* Header */}
      <div className="bg-[#1C1917] p-8 text-white">
        <h3 className="text-2xl font-black mb-2">Fleet Analytics &amp; Reports</h3>
        <p className="text-white/70">Comprehensive insights into your logistics operations</p>
      </div>

      {/* Filters */}
      <div className="p-6" style={{ background: '#ffffff', border: '1px solid #e7e5e4' }}>
        <h4 className="text-lg font-bold mb-4 flex items-center gap-2 text-zinc-900">
          <svg className="w-5 h-5 text-[#D97706]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Report Filters
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-zinc-700 mb-2">Date From</label>
            <input type="date" value={reportDateFrom} onChange={(e) => setReportDateFrom(e.target.value)} className="w-full px-4 py-2 border focus:ring-2 focus:ring-[#D97706] outline-none" style={{ border: '1px solid #e7e5e4' }} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-zinc-700 mb-2">Date To</label>
            <input type="date" value={reportDateTo} onChange={(e) => setReportDateTo(e.target.value)} className="w-full px-4 py-2 border focus:ring-2 focus:ring-[#D97706] outline-none" style={{ border: '1px solid #e7e5e4' }} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-zinc-700 mb-2">Filter by Vehicle</label>
            <select value={reportVehicleFilter} onChange={(e) => setReportVehicleFilter(e.target.value)} className="w-full px-4 py-2 border focus:ring-2 focus:ring-[#D97706] outline-none" style={{ border: '1px solid #e7e5e4' }}>
              <option value="all">All Vehicles</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.make_model} ({v.vin_number})</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={() => { setReportDateFrom(''); setReportDateTo(''); setReportVehicleFilter('all'); }} className="px-4 py-2 font-semibold hover:bg-zinc-200 transition-colors" style={{ background: '#ffffff', color: '#52525b' }}>
            Clear Filters
          </button>
          {(reportDateFrom || reportDateTo || reportVehicleFilter !== 'all') && (
            <div className="flex items-center gap-2 px-4 py-2 bg-[#D97706]/10 text-[#D97706]  text-sm font-semibold">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Filters active - Showing filtered results
            </div>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="p-6" style={{ background: '#ffffff', border: '1px solid #e7e5e4' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-zinc-600">Total Fleet Value</p>
            <div className="w-10 h-10 flex items-center justify-center" style={{ background: '#dbeafe' }}>
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-zinc-900">${filteredSummaries.reduce((sum, s) => sum + (s.total_landed_cost_usd || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          <p className="text-xs mt-2 text-zinc-600">{filteredSummaries.length} vehicles</p>
        </div>

        <div className="p-6" style={{ background: '#ffffff', border: '1px solid #e7e5e4' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-zinc-600">Total Expenses</p>
            <div className="w-10 h-10 flex items-center justify-center" style={{ background: '#fee2e2' }}>
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-zinc-900">${filteredExpenses.reduce((sum, e) => sum + ((e.amount || 0) * (e.exchange_rate_to_usd || 1)), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          <p className="text-xs mt-2 text-zinc-600">{filteredExpenses.length} transactions</p>
        </div>

        <div className="p-6" style={{ background: '#ffffff', border: '1px solid #e7e5e4' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-zinc-600">Avg Cost Per Vehicle</p>
            <div className="w-10 h-10 flex items-center justify-center" style={{ background: '#d1fae5' }}>
              <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-zinc-900">${filteredSummaries.length > 0 ? (filteredSummaries.reduce((sum, s) => sum + (s.total_landed_cost_usd || 0), 0) / filteredSummaries.length).toLocaleString(undefined, { maximumFractionDigits: 0 }) : 0}</p>
          <p className="text-xs mt-2 text-zinc-600">Per unit analysis</p>
        </div>

        <div className="p-6" style={{ background: '#ffffff', border: '1px solid #e7e5e4' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-zinc-600">Expense Ratio</p>
            <div className="w-10 h-10 bg-stone-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-stone-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-zinc-900">
            {filteredSummaries.length > 0
              ? ((filteredExpenses.reduce((sum, e) => sum + ((e.amount || 0) * (e.exchange_rate_to_usd || 1)), 0) /
                  filteredSummaries.reduce((sum, s) => sum + (s.total_landed_cost_usd || 0), 0)) * 100).toFixed(1)
              : 0}%
          </p>
          <p className="text-xs mt-2 text-zinc-600">Expenses to value</p>
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
          subtitle="modern operational view of the disbursement cycle."
          balanceLabel="Remaining balance"
          spentHelper="{count} spend entries"
          balanceHelper="Outstanding drawdown capacity still in the field"
        />
      </div>

      {/* Driver Monthly Spend (Fuel & Categories) */}
      <div className="p-6" style={{ background: '#ffffff', border: '1px solid #e7e5e4' }}>
        <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2 text-zinc-900">
              <svg className="w-5 h-5 text-[#D97706]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3v18h18M7 14l4-4 4 4 5-5" /></svg>
              Driver Monthly Spend
            </h3>
            <p className="text-sm mt-1 text-zinc-600">
              Monthly fuel and operating spend per driver, with averages across active months.
            </p>
          </div>
          <Button size="sm" onClick={handleDriverMonthlySpendCSV} disabled={isExporting || driverMonthlySpend.drivers.length === 0}>
            Export Monthly Spend CSV
          </Button>
        </div>

        {/* Overall metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="p-3" style={{ background: '#f9fafb' }}>
            <p className="text-xs uppercase font-semibold text-zinc-600">Total Spend</p>
            <p className="text-xl font-bold text-zinc-900">{fmtUsd(driverMonthlySpend.overall.totalUsd)}</p>
            <p className="text-xs text-zinc-600">{driverMonthlySpend.overall.txCount} tx · {driverMonthlySpend.overall.monthsActive} months</p>
          </div>
          <div className="p-3" style={{ background: '#f9fafb' }}>
            <p className="text-xs uppercase font-semibold text-zinc-600">Avg / Month</p>
            <p className="text-xl font-bold text-zinc-900">{fmtUsd(driverMonthlySpend.overall.avgPerMonthUsd)}</p>
            <p className="text-xs text-zinc-600">across all drivers</p>
          </div>
          <div className="p-3" style={{ background: '#f9fafb' }}>
            <p className="text-xs uppercase font-semibold text-zinc-600">Fuel Total</p>
            <p className="text-xl font-bold text-[#D97706]">{fmtUsd(driverMonthlySpend.overall.fuel.totalUsd)}</p>
            <p className="text-xs text-zinc-600">{driverMonthlySpend.overall.fuel.txCount} fills</p>
          </div>
          <div className="p-3" style={{ background: '#f9fafb' }}>
            <p className="text-xs uppercase font-semibold text-zinc-600">Avg Fuel / Month</p>
            <p className="text-xl font-bold text-[#D97706]">{fmtUsd(driverMonthlySpend.overall.fuel.avgPerMonthUsd)}</p>
            <p className="text-xs text-zinc-600">over {driverMonthlySpend.overall.fuel.monthsActive} active months</p>
          </div>
        </div>

        {driverMonthlySpend.drivers.length === 0 ? (
          <p className="text-sm py-6 text-center text-zinc-600">
            No driver-attributed expenses for the current filter.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-zinc-600">Driver</th>
                  <th className="px-3 py-2 text-right font-semibold text-zinc-600">Total</th>
                  <th className="px-3 py-2 text-right font-semibold text-zinc-600">Avg / Mo</th>
                  <th className="px-3 py-2 text-right font-semibold text-[#D97706]">Fuel Total</th>
                  <th className="px-3 py-2 text-right font-semibold text-[#D97706]">Avg Fuel / Mo</th>
                  <th className="px-3 py-2 text-right font-semibold text-zinc-600">Months</th>
                  <th className="px-3 py-2 text-left font-semibold text-zinc-600">Latest Month Breakdown</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {driverMonthlySpend.drivers.map((d) => {
                  const latest = d.months[d.months.length - 1];
                  return (
                    <tr key={d.driverName} className="hover:bg-zinc-50">
                      <td className="px-3 py-2 font-semibold text-zinc-900">{d.driverName}</td>
                      <td className="px-3 py-2 text-right font-bold text-zinc-900">{fmtUsd(d.totalUsd)}</td>
                      <td className="px-3 py-2 text-right text-zinc-900">{fmtUsd(d.avgPerMonthUsd)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-[#D97706]">{fmtUsd(d.fuel.totalUsd)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-[#D97706]">{fmtUsd(d.fuel.avgPerMonthUsd)}</td>
                      <td className="px-3 py-2 text-right text-zinc-600">{d.monthsActive}</td>
                      <td className="px-3 py-2 text-xs text-zinc-600">
                        {latest
                          ? `${formatMonthLabel(latest.month)} · ${fmtUsd(latest.totalUsd)} (Fuel ${fmtUsd(latest.byCategory['Fuel'] || 0)})`
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Forensic Variance — Fuel & Food */}
      <div className="p-6" style={{ background: '#ffffff', border: '1px solid #e7e5e4' }}>
        <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2 text-zinc-900">
              <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              Forensic — Monthly Variance (Fuel &amp; Food)
            </h3>
            <p className="text-sm mt-1 text-zinc-600">
              Per-driver month-over-month deltas and deviation from each driver&apos;s own baseline.
              Months above 150% or below 50% of the driver&apos;s mean are flagged for review.
            </p>
          </div>
          <Button size="sm" onClick={handleForensicCSV} disabled={isExporting || driverForensic.drivers.length === 0}>
            Export Forensic CSV
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="p-3" style={{ background: '#f9fafb' }}>
            <p className="text-xs uppercase font-semibold text-zinc-600">Fuel Total</p>
            <p className="text-xl font-bold text-[#D97706]">{fmtUsd(driverForensic.totals.fuelUsd)}</p>
          </div>
          <div className="p-3" style={{ background: '#f9fafb' }}>
            <p className="text-xs uppercase font-semibold text-zinc-600">Food Total</p>
            <p className="text-xl font-bold text-emerald-500">{fmtUsd(driverForensic.totals.foodUsd)}</p>
          </div>
          <div className="p-3" style={{ background: '#f9fafb' }}>
            <p className="text-xs uppercase font-semibold text-zinc-600">Flagged Drivers</p>
            <p className="text-xl font-bold text-rose-600">{driverForensic.totals.flaggedDrivers}</p>
          </div>
          <div className="p-3" style={{ background: '#f9fafb' }}>
            <p className="text-xs uppercase font-semibold text-zinc-600">Anomalies</p>
            <p className="text-xl font-bold text-rose-600">{driverForensic.totals.totalAnomalies}</p>
          </div>
        </div>

        {driverForensic.drivers.length === 0 ? (
          <p className="text-sm py-6 text-center text-zinc-600">
            No fuel or food spend attributed to drivers in the current filter.
          </p>
        ) : (
          <div className="space-y-6">
            {driverForensic.drivers.map((profile) => {
              const renderSeries = (series: typeof profile.fuel, accent: string) => {
                const visibleMonths = series.months.filter((m) => m.amountUsd > 0 || (m.prevMonthUsd ?? 0) > 0);
                if (visibleMonths.length === 0) return null;
                return (
                  <div key={series.category} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h5 className="text-sm font-bold uppercase tracking-wide" style={{ color: accent }}>{series.category}</h5>
                      <span className="text-xs text-zinc-600">
                        Mean {fmtUsd(series.meanMonthlyUsd)} · σ {fmtUsd(series.stdDevUsd)} · {series.monthsActive} active mo
                        {series.maxMonth ? ` · Peak ${formatMonthLabel(series.maxMonth.month)} ${fmtUsd(series.maxMonth.amountUsd)}` : ''}
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-zinc-50 border-b border-zinc-200">
                          <tr>
                            <th className="px-2 py-1.5 text-left font-semibold text-zinc-600">Month</th>
                            <th className="px-2 py-1.5 text-right font-semibold text-zinc-600">Amount</th>
                            <th className="px-2 py-1.5 text-right font-semibold text-zinc-600">Prev</th>
                            <th className="px-2 py-1.5 text-right font-semibold text-zinc-600">MoM Δ</th>
                            <th className="px-2 py-1.5 text-right font-semibold text-zinc-600">MoM %</th>
                            <th className="px-2 py-1.5 text-right font-semibold text-zinc-600">vs Mean</th>
                            <th className="px-2 py-1.5 text-right font-semibold text-zinc-600">Flag</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {visibleMonths.map((m) => {
                            const flagBg =
                              m.flag === 'high' ? 'bg-rose-50' :
                              m.flag === 'low'  ? 'bg-amber-50' : '';
                            const flagText =
                              m.flag === 'high' ? 'text-rose-700' :
                              m.flag === 'low'  ? 'text-amber-700' : 'text-zinc-500';
                            const momText =
                              m.momDeltaUsd === null ? 'text-zinc-400' :
                              m.momDeltaUsd > 0 ? 'text-rose-600' :
                              m.momDeltaUsd < 0 ? 'text-emerald-600' : 'text-zinc-500';
                            return (
                              <tr key={`${series.category}-${m.month}`} className={flagBg}>
                                <td className="px-2 py-1.5 font-mono text-zinc-900">{formatMonthLabel(m.month)}</td>
                                <td className="px-2 py-1.5 text-right font-semibold text-zinc-900">{fmtUsd(m.amountUsd)}</td>
                                <td className="px-2 py-1.5 text-right text-zinc-600">{m.prevMonthUsd === null ? '—' : fmtUsd(m.prevMonthUsd)}</td>
                                <td className={`px-2 py-1.5 text-right font-semibold ${momText}`}>{m.momDeltaUsd === null ? '—' : fmtUsd(m.momDeltaUsd)}</td>
                                <td className={`px-2 py-1.5 text-right ${momText}`}>{m.momDeltaPct === null ? '—' : `${m.momDeltaPct.toFixed(0)}%`}</td>
                                <td className="px-2 py-1.5 text-right text-zinc-600">{m.vsMeanDeltaPct === null ? '—' : `${m.vsMeanDeltaPct >= 0 ? '+' : ''}${m.vsMeanDeltaPct.toFixed(0)}%`}</td>
                                <td className={`px-2 py-1.5 text-right font-bold uppercase ${flagText}`}>{m.flag === 'normal' ? '·' : m.flag}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              };

              return (
                <div key={profile.driverName} className="border" style={{ borderColor: '#e7e5e4' }}>
                  <div className="flex items-center justify-between px-4 py-3 bg-zinc-50">
                    <div>
                      <p className="font-bold text-zinc-900">{profile.driverName}</p>
                      <p className="text-xs text-zinc-600">
                        Fuel {fmtUsd(profile.fuel.totalUsd)} · Food {fmtUsd(profile.food.totalUsd)}
                      </p>
                    </div>
                    {profile.flaggedMonthCount > 0 ? (
                      <span className="px-2 py-1 text-xs font-bold uppercase bg-rose-100 text-rose-700">
                        {profile.flaggedMonthCount} flagged
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-semibold uppercase bg-emerald-100 text-emerald-700">
                        Within baseline
                      </span>
                    )}
                  </div>
                  <div className="p-4 space-y-4">
                    {renderSeries(profile.fuel, '#D97706')}
                    {renderSeries(profile.food, '#10b981')}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detailed Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expense Breakdown by Category */}
        <div className="p-6" style={{ background: '#ffffff', border: '1px solid #e7e5e4' }}>
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-zinc-900">
            <svg className="w-5 h-5 text-[#D97706]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
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
                    <span className="text-sm font-semibold text-zinc-600">{category}</span>
                    <span className="text-sm font-bold text-[#D97706]">${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="w-full rounded-full h-2" style={{ background: '#ffffff' }}>
                    <div className="bg-[#D97706] h-2 rounded-full" style={{ width: `${percentage}%` }}></div>
                  </div>
                  <p className="text-xs text-zinc-600">{catExpenses.length} transactions &bull; {percentage.toFixed(1)}%</p>
                </div>
              ) : null;
            })}
          </div>
        </div>

        {/* Location Analysis */}
        <div className="p-6" style={{ background: '#ffffff', border: '1px solid #e7e5e4' }}>
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-zinc-900">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Expenses by Location
          </h3>
          <div className="space-y-3">
            {['UK', 'Namibia', 'Zimbabwe', 'Botswana'].map(location => {
              const locExpenses = filteredExpenses.filter(e => e.location === location);
              const total = locExpenses.reduce((sum, e) => sum + ((e.amount || 0) * (e.exchange_rate_to_usd || 1)), 0);
              const totalAll = filteredExpenses.reduce((sum, e) => sum + ((e.amount || 0) * (e.exchange_rate_to_usd || 1)), 0);
              const percentage = totalAll > 0 ? (total / totalAll * 100) : 0;
              return total > 0 ? (
                <div key={location} className="flex items-center justify-between p-3 transition-colors" style={{ background: '#ffffff' }}>
                  <div>
                    <p className="font-semibold text-zinc-900">{location}</p>
                    <p className="text-xs text-zinc-600">{locExpenses.length} transactions &bull; {percentage.toFixed(1)}% of total</p>
                  </div>
                  <span className="text-lg font-bold text-amber-600">${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
              ) : null;
            })}
          </div>
        </div>
      </div>

      {/* Vehicle Cost Rankings */}
      <div className="p-6" style={{ background: '#ffffff', border: '1px solid #e7e5e4' }}>
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-zinc-900">
          <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
          Top Vehicles by Total Cost
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-zinc-600">Rank</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-600">Vehicle</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-600">VIN</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-600">Status</th>
                <th className="px-4 py-3 text-right font-semibold text-zinc-600">Purchase Price</th>
                <th className="px-4 py-3 text-right font-semibold text-zinc-600">Total Cost</th>
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
                    <td className="px-4 py-3 font-semibold text-zinc-900">{summary.make_model}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-600">{summary.vin_number ? `${truncateValue(summary.vin_number, 12)}...` : '-'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-1 text-xs font-semibold" style={{ background: '#dbeafe', color: '#D97706' }}>{summary.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-600">£{(summary.purchase_price_gbp || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-500">${(summary.total_landed_cost_usd || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
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
