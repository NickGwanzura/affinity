import React from 'react';
import type { LandedCostSummary, Invoice, Currency } from '../../types';
import { Button, InsightPanel, MetricBarList, RankedMetricList, StatCard } from '../ui';

interface MonthlyTrendDatum {
  month: string;
  revenue: number;
  expenses: number;
}

interface MetricDatum {
  name: string;
  value: number;
}

interface ReportsOverviewViewProps {
  monthlyRevenue: number;
  monthlyExpenses: number;
  monthlyProfit: number;
  monthlyTrendData: MonthlyTrendDatum[];
  totalPending: number;
  pendingInvoiceCount: number;
  totalExpenses: number;
  expenseCategoryData: MetricDatum[];
  invoiceStatusData: MetricDatum[];
  invoices: Invoice[];
  revenueByClientData: MetricDatum[];
  summaries: LandedCostSummary[];
  formatCurrency: (amount: number, currency?: Currency) => string;
  onExportPDF: () => void;
  onExportCSV: () => void;
  onExportDriverFundsReport: () => void;
}

export const ReportsOverviewView: React.FC<ReportsOverviewViewProps> = ({
  monthlyRevenue,
  monthlyExpenses,
  monthlyProfit,
  monthlyTrendData,
  totalPending,
  pendingInvoiceCount,
  totalExpenses,
  expenseCategoryData,
  invoiceStatusData,
  invoices,
  revenueByClientData,
  summaries,
  formatCurrency,
  onExportPDF,
  onExportCSV,
  onExportDriverFundsReport,
}) => (
  <div className="space-y-6">
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
        trendValue={`${pendingInvoiceCount} invoices`}
        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
      />
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <InsightPanel
        title="Revenue vs Expenses Trend"
        subtitle="A clearer Carbon-style readout of the last six months of movement."
      >
        <RankedMetricList
          items={monthlyTrendData
            .slice(-6)
            .reverse()
            .map((month) => ({
              label: month.month,
              value: formatCurrency(month.revenue),
              helper: `${formatCurrency(month.expenses)} expenses • ${formatCurrency(month.revenue - month.expenses)} net`,
              tone: month.revenue >= month.expenses ? 'green' : 'red',
            }))}
          emptyMessage="No trend data available yet."
        />
      </InsightPanel>

      <InsightPanel
        title="Expenses by Category"
        subtitle="See which cost buckets are consuming the most cash right now."
      >
        <MetricBarList
          items={expenseCategoryData.map((item) => ({
            label: item.name,
            value: formatCurrency(item.value),
            helper: `${item.value > 0 && totalExpenses > 0 ? ((item.value / totalExpenses) * 100).toFixed(1) : '0.0'}% of total spend`,
            percent: totalExpenses > 0 ? (item.value / totalExpenses) * 100 : 0,
            tone: item.name === 'Fuel' ? 'blue' : item.name === 'Repairs' ? 'red' : item.name === 'Food' ? 'amber' : 'teal',
          }))}
          emptyMessage="No expense categories available yet."
        />
      </InsightPanel>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <InsightPanel
        title="Invoice Status Breakdown"
        subtitle="Outstanding exposure, won revenue, and work still in motion."
      >
        <MetricBarList
          items={invoiceStatusData.map((item) => ({
            label: item.name,
            value: formatCurrency(item.value),
            helper: `${invoices.filter((invoice) => invoice.status === item.name).length} invoices`,
            percent: invoices.length > 0 ? (invoices.filter((invoice) => invoice.status === item.name).length / invoices.length) * 100 : 0,
            tone: item.name === 'Paid' ? 'green' : item.name === 'Overdue' ? 'red' : item.name === 'Sent' ? 'amber' : 'blue',
          }))}
          emptyMessage="No invoice data available yet."
        />
      </InsightPanel>

      <InsightPanel
        title="Top Clients by Revenue"
        subtitle="Your most valuable accounts ranked by paid invoice volume."
      >
        <RankedMetricList
          items={revenueByClientData.map((item) => ({
            label: item.name,
            value: formatCurrency(item.value),
            helper: `${invoices.filter((invoice) => invoice.status === 'Paid' && invoice.client_name === item.name).length} paid invoices`,
            tone: 'purple',
          }))}
          emptyMessage="No client revenue data available yet."
        />
      </InsightPanel>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <InsightPanel
        title="Top Vehicles by Total Cost"
        subtitle="The most capital-intensive units in the fleet right now."
      >
        <RankedMetricList
          items={[...summaries]
            .sort((a, b) => b.total_landed_cost_usd - a.total_landed_cost_usd)
            .slice(0, 5)
            .map((summary) => ({
              label: summary.make_model,
              value: formatCurrency(summary.total_landed_cost_usd),
              helper: `${summary.vin_number} • ${summary.status}`,
              tone: 'blue',
            }))}
          emptyMessage="No vehicle cost data available yet."
        />
      </InsightPanel>

      <InsightPanel
        title="Invoice Summary"
        subtitle="Status-by-status collection picture in one place."
      >
        <MetricBarList
          items={['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled']
            .map((status) => {
              const statusInvoices = invoices.filter((invoice) => invoice.status === status);
              const total = statusInvoices.reduce((sum, invoice) => sum + invoice.amount_usd, 0);
              return {
                label: status,
                value: formatCurrency(total),
                helper: `${statusInvoices.length} invoices`,
                percent: invoices.length > 0 ? (statusInvoices.length / invoices.length) * 100 : 0,
                tone: status === 'Paid' ? 'green' : status === 'Overdue' ? 'red' : status === 'Sent' ? 'amber' : 'gray',
                count: statusInvoices.length,
              };
            })
            .filter((item) => item.count > 0)
            .map(({ count, ...item }) => item)}
          emptyMessage="No invoice summary available yet."
        />
      </InsightPanel>
    </div>

    <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
      <h3 className="text-lg font-bold mb-2">Export Reports</h3>
      <p className="text-sm text-blue-100 mb-4">Download comprehensive financial reports for your records</p>
      <div className="flex gap-3 flex-wrap">
        <Button variant="secondary" onClick={onExportPDF}>Export Expenses PDF</Button>
        <Button variant="ghost" onClick={onExportCSV}>Export Expenses CSV</Button>
        <Button variant="ghost" onClick={onExportDriverFundsReport}>Export Driver Funds PDF</Button>
      </div>
    </div>
  </div>
);

export default ReportsOverviewView;
