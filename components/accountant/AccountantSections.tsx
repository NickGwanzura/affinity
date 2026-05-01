import React from 'react';
import type { Currency, Expense, Invoice, LandedCostSummary, Payment } from '../../types';
import { StatCard, StatusBadge } from '../ui';

type ExpenseReportRow = {
  category: string;
  totalUsd: number;
  count: number;
};

interface AccountantOverviewSectionProps {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  totalPending: number;
  pendingInvoiceCount: number;
  invoices: Invoice[];
  payments: Payment[];
  summaries: LandedCostSummary[];
  formatCurrency: (amount: number, currency?: Currency) => string;
  formatDate: (value: string) => string;
}

export const AccountantOverviewSection: React.FC<AccountantOverviewSectionProps> = ({
  totalRevenue,
  totalExpenses,
  netProfit,
  totalPending,
  pendingInvoiceCount,
  invoices,
  payments,
  summaries,
  formatCurrency,
  formatDate,
}) => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        trendValue={`${pendingInvoiceCount} invoices`}
        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
      />
    </div>

    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div>
        <h3 className="mb-4 text-lg font-bold text-zinc-900">Recent Invoices</h3>
        <div className="space-y-2">
          {invoices.slice(0, 5).map((invoice) => (
            <div key={invoice.id} className="flex items-center justify-between bg-zinc-50 p-3">
              <div>
                <p className="text-sm font-semibold text-zinc-900">{invoice.invoice_number}</p>
                <p className="text-xs text-zinc-500">{formatDate(invoice.created_at)}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-zinc-900">{formatCurrency(invoice.amount_usd, invoice.currency || 'USD')}</p>
                <StatusBadge status={invoice.status} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-4 text-lg font-bold text-zinc-900">Recent Payments</h3>
        <div className="space-y-2">
          {payments.slice(0, 5).map((payment) => (
            <div key={payment.id} className="flex items-center justify-between bg-zinc-50 p-3">
              <div>
                <p className="text-sm font-semibold text-zinc-900">{payment.method}</p>
                <p className="text-xs text-zinc-500">{formatDate(payment.date)}</p>
              </div>
              <div className="text-right">
                <p className={`font-bold ${payment.type === 'Inbound' ? 'text-green-600' : 'text-red-600'}`}>
                  {payment.type === 'Inbound' ? '+' : '-'}
                  {formatCurrency(payment.amount_usd)}
                </p>
                <p className="text-xs text-zinc-500">{payment.type}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>

    <div>
      <h3 className="mb-4 text-lg font-bold text-zinc-900">Vehicle Landed Costs</h3>
      <div className="space-y-3 lg:hidden">
        {summaries.map((summary) => (
          <div key={summary.vehicle_id} className=" border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-zinc-500">{summary.vin_number}</p>
                <p className="mt-1 font-bold text-zinc-900">{summary.make_model}</p>
              </div>
              <span className=" bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">{summary.status}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Purchase</p>
                <p className="font-semibold text-zinc-900">£{summary.purchase_price_gbp.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Expenses</p>
                <p className="font-semibold text-zinc-900">{formatCurrency(summary.total_expenses_usd)}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Total Cost</p>
                <p className="text-lg font-black text-zinc-900">{formatCurrency(summary.total_landed_cost_usd)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50">
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
                  <span className="inline-block bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">{summary.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

interface AccountantInvoicesSectionProps {
  invoices: Invoice[];
  formatCurrency: (amount: number, currency?: Currency) => string;
  formatDate: (value: string) => string;
  truncateValue: (value: string | null | undefined, length: number, fallback?: string) => string;
}

export const AccountantInvoicesSection: React.FC<AccountantInvoicesSectionProps> = ({
  invoices,
  formatCurrency,
  formatDate,
  truncateValue,
}) => (
  <>
    <div className="space-y-3 lg:hidden">
      {invoices.map((invoice) => (
        <div key={invoice.id} className=" border border-zinc-200 bg-zinc-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs text-zinc-500">{invoice.invoice_number}</p>
              <p className="mt-1 font-bold text-zinc-900">{truncateValue(invoice.vehicle_id, 8)}</p>
            </div>
            <StatusBadge status={invoice.status} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Amount</p>
              <p className="font-bold text-zinc-900">{formatCurrency(invoice.amount_usd, invoice.currency || 'USD')}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Due Date</p>
              <p className="text-zinc-700">{formatDate(invoice.due_date)}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Created</p>
              <p className="text-zinc-700">{formatDate(invoice.created_at)}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
    <div className="hidden overflow-x-auto lg:block">
      <table className="w-full text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50">
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
              <td className="px-4 py-3 text-right font-bold">{formatCurrency(invoice.amount_usd, invoice.currency || 'USD')}</td>
              <td className="px-4 py-3"><StatusBadge status={invoice.status} /></td>
              <td className="px-4 py-3">{formatDate(invoice.due_date)}</td>
              <td className="px-4 py-3">{formatDate(invoice.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </>
);

interface AccountantExpensesSectionProps {
  expenses: Expense[];
  formatCurrency: (amount: number, currency?: Currency) => string;
  formatDate: (value: string) => string;
  onEditExpense: (expense: Expense) => void;
}

export const AccountantExpensesSection: React.FC<AccountantExpensesSectionProps> = ({
  expenses,
  formatCurrency,
  formatDate,
  onEditExpense,
}) => (
  <>
    <div className="space-y-3 lg:hidden">
      {expenses.map((expense) => (
        <div key={expense.id} className=" border border-zinc-200 bg-zinc-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-zinc-900">{expense.description}</p>
              <p className="mt-1 text-xs text-zinc-500">{formatDate(expense.created_at)}</p>
            </div>
            <button type="button" onClick={() => onEditExpense(expense)} className="text-xs font-semibold text-blue-600 hover:text-blue-800">
              Edit
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Category</p>
              <span className="inline-block bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">{expense.category}</span>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Location</p>
              <p className="text-zinc-700">{expense.location}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Amount</p>
              <p className="font-medium text-zinc-900">{expense.currency} {expense.amount.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">USD Value</p>
              <p className="font-bold text-zinc-900">{formatCurrency(expense.amount * expense.exchange_rate_to_usd)}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
    <div className="hidden overflow-x-auto lg:block">
      <table className="w-full text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50">
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
              <td className="px-4 py-3"><span className="inline-block bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">{expense.category}</span></td>
              <td className="px-4 py-3">{expense.location}</td>
              <td className="px-4 py-3 text-right font-medium">{expense.currency} {expense.amount.toLocaleString()}</td>
              <td className="px-4 py-3 text-right font-bold">{formatCurrency(expense.amount * expense.exchange_rate_to_usd)}</td>
              <td className="px-4 py-3">{formatDate(expense.created_at)}</td>
              <td className="px-4 py-3 text-center">
                <button type="button" onClick={() => onEditExpense(expense)} className="rounded px-2 py-1 text-xs font-semibold text-[#D97706] transition-colors hover:bg-amber-50 hover:text-[#92400E]">
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </>
);

interface AccountantPaymentsSectionProps {
  payments: Payment[];
  formatCurrency: (amount: number, currency?: Currency) => string;
  formatDate: (value: string) => string;
  truncateValue: (value: string | null | undefined, length: number, fallback?: string) => string;
}

export const AccountantPaymentsSection: React.FC<AccountantPaymentsSectionProps> = ({
  payments,
  formatCurrency,
  formatDate,
  truncateValue,
}) => (
  <>
    <div className="space-y-3 lg:hidden">
      {payments.map((payment) => (
        <div key={payment.id} className=" border border-zinc-200 bg-zinc-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs text-zinc-500">{truncateValue(payment.reference_id, 12)}</p>
              <p className="mt-1 font-semibold text-zinc-900">{payment.method}</p>
            </div>
            <span className={`inline-block px-2 py-1 text-xs font-semibold ${payment.type === 'Inbound' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {payment.type}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Amount</p>
              <p className={`font-bold ${payment.type === 'Inbound' ? 'text-green-600' : 'text-red-600'}`}>
                {payment.type === 'Inbound' ? '+' : '-'}
                {formatCurrency(payment.amount_usd)}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Date</p>
              <p className="text-zinc-700">{formatDate(payment.date)}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
    <div className="hidden overflow-x-auto lg:block">
      <table className="w-full text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50">
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
                <span className={`inline-block px-2 py-1 text-xs font-semibold ${payment.type === 'Inbound' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {payment.type}
                </span>
              </td>
              <td className="px-4 py-3">{payment.method}</td>
              <td className={`px-4 py-3 text-right font-bold ${payment.type === 'Inbound' ? 'text-green-600' : 'text-red-600'}`}>
                {payment.type === 'Inbound' ? '+' : '-'}
                {formatCurrency(payment.amount_usd)}
              </td>
              <td className="px-4 py-3">{formatDate(payment.date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </>
);

interface AccountantExpenseReportsSectionProps {
  erDateFrom: string;
  erDateTo: string;
  erCategory: string;
  erLocation: string;
  erVehicle: string;
  vehicles: Array<{ id: string; make_model: string; vin_number: string }>;
  filteredExpensesForReport: Expense[];
  expenseReportTotal: number;
  expenseReportByCategory: ExpenseReportRow[];
  formatCurrency: (amount: number, currency?: Currency) => string;
  formatDate: (value: string) => string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onVehicleChange: (value: string) => void;
  onClearFilters: () => void;
  onExportPDF: () => void;
  onExportCSV: () => void;
}

export const AccountantExpenseReportsSection: React.FC<AccountantExpenseReportsSectionProps> = ({
  erDateFrom,
  erDateTo,
  erCategory,
  erLocation,
  erVehicle,
  vehicles,
  filteredExpensesForReport,
  expenseReportTotal,
  expenseReportByCategory,
  formatCurrency,
  formatDate,
  onDateFromChange,
  onDateToChange,
  onCategoryChange,
  onLocationChange,
  onVehicleChange,
  onClearFilters,
  onExportPDF,
  onExportCSV,
}) => (
  <div className="space-y-6">
    <div className=" border border-zinc-200 bg-zinc-50 p-4">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-700">Filters</h3>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-500">From</label>
          <input type="date" value={erDateFrom} onChange={(event) => onDateFromChange(event.target.value)} className="w-full border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#D97706]/30" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-500">To</label>
          <input type="date" value={erDateTo} onChange={(event) => onDateToChange(event.target.value)} className="w-full border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#D97706]/30" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-500">Category</label>
          <select value={erCategory} onChange={(event) => onCategoryChange(event.target.value)} className="w-full border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#D97706]/30">
            <option value="">All Categories</option>
            {['Fuel', 'Tolls', 'Food', 'Repairs', 'Duty', 'Shipping', 'Driver Disbursement', 'Other'].map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-500">Location</label>
          <select value={erLocation} onChange={(event) => onLocationChange(event.target.value)} className="w-full border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#D97706]/30">
            <option value="">All Locations</option>
            {['UK', 'Namibia', 'Zimbabwe', 'Botswana'].map((location) => (
              <option key={location} value={location}>{location}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-500">Vehicle</label>
          <select value={erVehicle} onChange={(event) => onVehicleChange(event.target.value)} className="w-full border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#D97706]/30">
            <option value="">All Vehicles</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>{vehicle.make_model} — {vehicle.vin_number}</option>
            ))}
          </select>
        </div>
      </div>
      {erDateFrom || erDateTo || erCategory || erLocation || erVehicle ? (
        <button type="button" onClick={onClearFilters} className="mt-3 text-xs font-semibold text-blue-600 hover:underline">
          Clear filters
        </button>
      ) : null}
    </div>

    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className=" border border-zinc-200 bg-white p-5">
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-zinc-500">Total Entries</p>
        <p className="text-3xl font-black text-zinc-900">{filteredExpensesForReport.length}</p>
      </div>
      <div className=" border border-zinc-200 bg-white p-5">
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-zinc-500">Total (USD)</p>
        <p className="text-3xl font-black text-red-600">{formatCurrency(expenseReportTotal)}</p>
      </div>
      <div className=" border border-zinc-200 bg-white p-5">
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-zinc-500">Top Category</p>
        <p className="text-2xl font-black text-zinc-900">{expenseReportByCategory[0]?.category || '—'}</p>
        {expenseReportByCategory[0] ? <p className="mt-1 text-xs text-zinc-500">{formatCurrency(expenseReportByCategory[0].totalUsd)}</p> : null}
      </div>
    </div>

    <div className="overflow-hidden border border-zinc-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-zinc-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-bold text-zinc-900">Breakdown by Category</h3>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={onExportPDF} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 focus-visible:ring-offset-2">Export PDF</button>
          <button type="button" onClick={onExportCSV} className="rounded-md bg-[#D97706] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#B45309] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706]/30 focus-visible:ring-offset-2">Export CSV</button>
        </div>
      </div>
      <div className="space-y-3 p-4 lg:hidden">
        {expenseReportByCategory.length === 0 ? (
          <p className="py-8 text-center text-zinc-400">No expenses match the selected filters</p>
        ) : (
          expenseReportByCategory.map((row) => (
            <div key={row.category} className=" border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-zinc-900">{row.category}</p>
                  <p className="text-xs text-zinc-500">{row.count} entries</p>
                </div>
                <p className="font-bold text-zinc-900">{formatCurrency(row.totalUsd)}</p>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-zinc-100">
                  <div className="h-1.5 rounded-full bg-[#D97706]" style={{ width: `${expenseReportTotal > 0 ? (row.totalUsd / expenseReportTotal) * 100 : 0}%` }} />
                </div>
                <span className="w-10 text-right text-xs text-zinc-500">
                  {expenseReportTotal > 0 ? ((row.totalUsd / expenseReportTotal) * 100).toFixed(1) : 0}%
                </span>
              </div>
            </div>
          ))
        )}
      </div>
      <table className="hidden w-full text-sm lg:table">
        <thead className="bg-zinc-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-bold uppercase text-zinc-600">Category</th>
            <th className="px-6 py-3 text-right text-xs font-bold uppercase text-zinc-600">Entries</th>
            <th className="px-6 py-3 text-right text-xs font-bold uppercase text-zinc-600">Total (USD)</th>
            <th className="px-6 py-3 text-right text-xs font-bold uppercase text-zinc-600">% of Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {expenseReportByCategory.length === 0 ? (
            <tr><td colSpan={4} className="px-6 py-8 text-center text-zinc-400">No expenses match the selected filters</td></tr>
          ) : expenseReportByCategory.map((row) => (
            <tr key={row.category} className="hover:bg-zinc-50">
              <td className="px-6 py-3 font-semibold text-zinc-900">{row.category}</td>
              <td className="px-6 py-3 text-right text-zinc-600">{row.count}</td>
              <td className="px-6 py-3 text-right font-bold text-zinc-900">{formatCurrency(row.totalUsd)}</td>
              <td className="px-6 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <div className="h-1.5 w-16 rounded-full bg-zinc-100">
                    <div className="h-1.5 rounded-full bg-[#D97706]" style={{ width: `${expenseReportTotal > 0 ? (row.totalUsd / expenseReportTotal) * 100 : 0}%` }} />
                  </div>
                  <span className="w-10 text-right text-xs text-zinc-500">{expenseReportTotal > 0 ? ((row.totalUsd / expenseReportTotal) * 100).toFixed(1) : 0}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div className="overflow-hidden border border-zinc-200 bg-white">
      <div className="border-b border-zinc-100 px-6 py-4">
        <h3 className="font-bold text-zinc-900">All Entries <span className="text-sm font-normal text-zinc-400">({filteredExpensesForReport.length})</span></h3>
      </div>
      <div className="space-y-3 p-4 lg:hidden">
        {filteredExpensesForReport.length === 0 ? (
          <p className="py-8 text-center text-zinc-400">No expenses match the selected filters</p>
        ) : (
          filteredExpensesForReport.map((expense) => (
            <div key={expense.id} className=" border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="rounded bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-700">{expense.category}</span>
                  <p className="mt-2 font-medium text-zinc-900">{expense.description}</p>
                </div>
                <p className="text-xs text-zinc-500">{formatDate(expense.created_at)}</p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Location</p>
                  <p className="text-zinc-700">{expense.location}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Driver</p>
                  <p className="text-zinc-700">{expense.driver_name || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Amount</p>
                  <p className="font-medium text-zinc-900">{expense.amount.toLocaleString()} {expense.currency}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">USD Value</p>
                  <p className="font-bold text-zinc-900">{formatCurrency((expense.amount || 0) * (expense.exchange_rate_to_usd || 1))}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-zinc-600">Date</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-zinc-600">Category</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-zinc-600">Description</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-zinc-600">Location</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-zinc-600">Driver</th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase text-zinc-600">Amount</th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase text-zinc-600">USD Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {filteredExpensesForReport.length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-8 text-center text-zinc-400">No expenses match the selected filters</td></tr>
            ) : filteredExpensesForReport.map((expense) => (
              <tr key={expense.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3 text-xs text-zinc-500">{formatDate(expense.created_at)}</td>
                <td className="px-4 py-3"><span className="rounded bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-700">{expense.category}</span></td>
                <td className="max-w-[200px] truncate px-4 py-3 text-zinc-700">{expense.description}</td>
                <td className="px-4 py-3 text-xs text-zinc-500">{expense.location}</td>
                <td className="px-4 py-3 text-xs text-zinc-500">{expense.driver_name || '—'}</td>
                <td className="px-4 py-3 text-right font-medium">{expense.amount.toLocaleString()} {expense.currency}</td>
                <td className="px-4 py-3 text-right font-bold text-zinc-900">{formatCurrency((expense.amount || 0) * (expense.exchange_rate_to_usd || 1))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

