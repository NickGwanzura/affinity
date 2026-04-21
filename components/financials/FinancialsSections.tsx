import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Download,
  Pencil,
  Trash2,
  Receipt,
  FilePlus,
  DollarSign,
  BarChart3,
  MoreVertical,
} from 'lucide-react';
import { Button, IconButton, StatusBadge, DataTableWrapper } from '../ui';
import type { Invoice, Payment, Quote, Receipt as ReceiptType } from '../../types';

export type FinancialsTab = 'quotes' | 'invoices' | 'payments' | 'receipts' | 'statements';

// ============================================================================
// Helper Functions
// ============================================================================

const formatMoney = (amount: number, currency?: string): string => {
  const symbol = currency === 'GBP' ? '£' : '$';
  return `${symbol}${(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const getStatusTagType = (status: string): string => {
  switch (status) {
    case 'Paid':
    case 'Accepted':
      return 'paid';
    case 'Sent':
    case 'Active':
      return 'sent';
    case 'Draft':
    case 'Pending':
      return 'draft';
    case 'Overdue':
      return 'overdue';
    case 'Rejected':
    case 'Cancelled':
      return 'cancelled';
    default:
      return 'info';
  }
};

const getPaymentStatusTag = (payment: Payment): React.ReactNode => {
  if (payment.status === 'unallocated' || payment.reference_id?.startsWith('UNALLOC-')) {
    return <StatusBadge status="pending" size="sm" />;
  }
  if (payment.type === 'Inbound') {
    return <StatusBadge status="success" size="sm" />;
  }
  return <StatusBadge status="info" size="sm" customColors={{ bg: '#f3e8ff', text: '#7e22ce' }} />;
};

// ============================================================================
// Action Dropdown
// ============================================================================

interface ActionItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

const ActionMenu: React.FC<{ items: ActionItem[] }> = ({ items }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <div className="relative inline-block" ref={ref}>
      <IconButton
        icon={<MoreVertical size={16} />}
        size="sm"
        variant="ghost"
        label="Actions"
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
        <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 shadow-lg z-50">
          {items.map((item, i) => (
            <button
              key={i}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${item.danger ? 'text-red-600' : 'text-gray-700'}`}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Tab Bar Component
// ============================================================================

interface FinancialsTabBarProps {
  activeTab: FinancialsTab;
  onChange: (tab: FinancialsTab) => void;
  counts: {
    quotes: number;
    invoices: number;
    payments: number;
    receipts: number;
  };
}

export const FinancialsTabBar: React.FC<FinancialsTabBarProps> = ({ activeTab, onChange, counts }) => {
  const tabs: { id: FinancialsTab; label: string; icon: React.ElementType }[] = [
    { id: 'quotes', label: 'Quotes', icon: FilePlus },
    { id: 'invoices', label: 'Invoices', icon: Receipt },
    { id: 'payments', label: 'Payments', icon: DollarSign },
    { id: 'receipts', label: 'Receipts', icon: Download },
    { id: 'statements', label: 'Statements', icon: BarChart3 },
  ];

  const getCount = (id: FinancialsTab): number | undefined => {
    if (id === 'quotes') return counts.quotes;
    if (id === 'invoices') return counts.invoices;
    if (id === 'payments') return counts.payments;
    if (id === 'receipts') return counts.receipts;
    return undefined;
  };

  return (
    <div className="border-b border-gray-200">
      <div className="flex overflow-x-auto">
        {tabs.map((tab) => {
          const count = getCount(tab.id);
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                isActive
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <Icon size={16} />
              {tab.label}
              {typeof count === 'number' && (
                <span className="ml-1 text-xs opacity-70">({count})</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// Quotes Section
// ============================================================================

interface QuotesSectionProps {
  quotes: Quote[];
  deletingKey: string | null;
  formatMoney: (amount: number, currency?: string) => string;
  onPreview: (quote: Quote) => void;
  onDownload: (quote: Quote) => void;
  onEdit: (quote: Quote) => void;
  onConvert: (quote: Quote) => void;
  onDelete: (quote: Quote) => void;
}

export const QuotesSection: React.FC<QuotesSectionProps> = ({
  quotes,
  onPreview,
  onDownload,
  onEdit,
  onConvert,
  onDelete,
}) => {
  const columns = [
    {
      key: 'quote_number',
      header: 'Quote #',
      width: '15%',
      render: (row: any) => <span className="font-mono font-semibold">{row.quote_number}</span>,
    },
    { key: 'client_name', header: 'Client', width: '25%' },
    {
      key: 'amount_usd',
      header: 'Amount',
      width: '15%',
      render: (row: any) => <span className="font-semibold">{formatMoney(row.amount_usd, row.currency)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      width: '12%',
      render: (row: any) => <StatusBadge status={getStatusTagType(row.status)} size="sm" />,
    },
    {
      key: 'created_at',
      header: 'Created',
      width: '15%',
      render: (row: any) => new Date(row.created_at).toLocaleDateString(),
    },
    {
      key: 'actions',
      header: '',
      width: '18%',
      render: (row: any) => (
        <ActionMenu
          items={[
            { label: 'Preview', onClick: () => onPreview(row as Quote) },
            { label: 'Download PDF', onClick: () => onDownload(row as Quote) },
            { label: 'Edit', onClick: () => onEdit(row as Quote) },
            { label: 'Convert to Invoice', onClick: () => onConvert(row as Quote) },
            { label: 'Delete', onClick: () => onDelete(row as Quote), danger: true },
          ]}
        />
      ),
    },
  ];

  const rows = quotes.map((quote) => ({ ...quote, actions: '' })) as any[];

  return (
    <DataTableWrapper
      rows={rows}
      columns={columns}
      search
      emptyMessage="No quotes found"
    />
  );
};

// ============================================================================
// Invoices Section
// ============================================================================

interface InvoicesSectionProps {
  invoices: Invoice[];
  batchFilter: string;
  onBatchFilterChange: (value: string) => void;
  onClearBatchFilter: () => void;
  deletingKey: string | null;
  formatMoney: (amount: number, currency?: string) => string;
  onPreview: (invoice: Invoice) => void;
  onEdit: (invoice: Invoice) => void;
  onDownload: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
}

export const InvoicesSection: React.FC<InvoicesSectionProps> = ({
  invoices,
  batchFilter,
  onBatchFilterChange,
  onClearBatchFilter,
  onPreview,
  onEdit,
  onDownload,
  onDelete,
}) => {
  const filteredInvoices = invoices.filter(
    (invoice) => !batchFilter || (invoice.batch || '').toLowerCase().includes(batchFilter.toLowerCase())
  );

  const columns = [
    {
      key: 'invoice_number',
      header: 'Invoice #',
      width: '18%',
      render: (row: any) => (
        <div>
          <span className="font-mono font-semibold block">{row.invoice_number}</span>
          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 mt-0.5">
            {row.invoice_kind || 'Standard'}
          </span>
        </div>
      ),
    },
    { key: 'client_name', header: 'Client', width: '22%' },
    {
      key: 'batch',
      header: 'Batch',
      width: '12%',
      render: (row: any) =>
        row.batch ? (
          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-cyan-100 text-cyan-800">
            {row.batch}
          </span>
        ) : (
          <span className="text-gray-500">—</span>
        ),
    },
    {
      key: 'amount_usd',
      header: 'Amount',
      width: '12%',
      render: (row: any) => <span className="font-semibold">{formatMoney(row.amount_usd, row.currency)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      width: '12%',
      render: (row: any) => <StatusBadge status={getStatusTagType(row.status)} size="sm" />,
    },
    {
      key: 'due_date',
      header: 'Due Date',
      width: '12%',
      render: (row: any) => (row.due_date ? new Date(row.due_date).toLocaleDateString() : '—'),
    },
    {
      key: 'actions',
      header: '',
      width: '12%',
      render: (row: any) => (
        <ActionMenu
          items={[
            { label: 'Preview', onClick: () => onPreview(row as Invoice) },
            { label: 'Download PDF', onClick: () => onDownload(row as Invoice) },
            { label: 'Edit', onClick: () => onEdit(row as Invoice) },
            { label: 'Delete', onClick: () => onDelete(row as Invoice), danger: true },
          ]}
        />
      ),
    },
  ];

  const rows = filteredInvoices.map((invoice) => ({ ...invoice, actions: '' })) as any[];

  return (
    <div>
      {/* Batch Filter */}
      <div className="px-4 py-3 bg-gray-100 border-b border-gray-200">
        <div className="flex items-end gap-2">
          <div className="flex-1 max-w-xs">
            <label htmlFor="invoice-batch-filter" className="block text-xs text-gray-600 mb-1">
              Filter by batch
            </label>
            <input
              id="invoice-batch-filter"
              type="text"
              value={batchFilter}
              onChange={(e) => onBatchFilterChange(e.target.value)}
              placeholder="Enter batch code..."
              className="w-full h-8 px-3 text-sm border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          {batchFilter && (
            <Button variant="ghost" size="sm" onClick={onClearBatchFilter}>
              Clear
            </Button>
          )}
          {batchFilter && (
            <span className="text-xs text-gray-600 pb-2">{filteredInvoices.length} result(s)</span>
          )}
        </div>
      </div>

      <DataTableWrapper
        rows={rows}
        columns={columns}
        search
        emptyMessage={batchFilter ? 'No invoices match the batch filter' : 'No invoices found'}
      />
    </div>
  );
};

// ============================================================================
// Payments Section
// ============================================================================

interface PaymentsSectionProps {
  payments: Payment[];
  deletingKey: string | null;
  formatMoney: (amount: number, currency?: string) => string;
  getPaymentClientName: (payment: Payment) => string;
  getPaymentCurrency: (payment: Payment) => string;
  getPaymentAllocationSummary: (payment: Payment) => string | null;
  onEdit: (payment: Payment) => void;
  onDelete: (payment: Payment) => void;
  onRecordPayment?: () => void;
}

export const PaymentsSection: React.FC<PaymentsSectionProps> = ({
  payments,
  getPaymentClientName,
  getPaymentCurrency,
  getPaymentAllocationSummary,
  onEdit,
  onDelete,
  onRecordPayment,
}) => {
  const columns = [
    { key: 'client', header: 'Client', width: '20%' },
    {
      key: 'reference_id',
      header: 'Reference',
      width: '22%',
      render: (row: any) => (
        <div>
          <span className="font-mono text-xs">{row.reference_id}</span>
          {getPaymentAllocationSummary(row as Payment) && (
            <p className="text-xs text-gray-500 mt-0.5">{getPaymentAllocationSummary(row as Payment)}</p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '12%',
      render: (row: any) => getPaymentStatusTag(row as Payment),
    },
    {
      key: 'amount_usd',
      header: 'Amount',
      width: '12%',
      render: (row: any) => (
        <span className="font-semibold text-green-700">
          {formatMoney(row.amount_usd, getPaymentCurrency(row as Payment))}
        </span>
      ),
    },
    { key: 'method', header: 'Method', width: '12%' },
    {
      key: 'date',
      header: 'Date',
      width: '12%',
      render: (row: any) => (row.date ? new Date(row.date).toLocaleDateString() : '—'),
    },
    {
      key: 'actions',
      header: '',
      width: '10%',
      render: (row: any) => (
        <ActionMenu
          items={[
            { label: 'Edit', onClick: () => onEdit(row as Payment) },
            { label: 'Delete', onClick: () => onDelete(row as Payment), danger: true },
          ]}
        />
      ),
    },
  ];

  const rows = payments.map((payment) => ({
    ...payment,
    client: getPaymentClientName(payment),
    actions: '',
  })) as any[];

  return (
    <div>
      {onRecordPayment && (
        <div className="px-4 py-3 border-b border-gray-200 flex justify-end">
          <Button renderIcon={Plus} onClick={onRecordPayment}>
            Record Payment
          </Button>
        </div>
      )}
      <DataTableWrapper
        rows={rows}
        columns={columns}
        search
        emptyMessage="No payments recorded"
      />
    </div>
  );
};

// ============================================================================
// Receipts Section
// ============================================================================

interface ReceiptsSectionProps {
  receipts: ReceiptType[];
  deletingKey: string | null;
  formatMoney: (amount: number, currency?: string) => string;
  onRecordPayment: () => void;
  onPreview: (receipt: ReceiptType) => void;
  onReissue: (receipt: ReceiptType) => void;
  onDelete: (receipt: ReceiptType) => void;
}

export const ReceiptsSection: React.FC<ReceiptsSectionProps> = ({
  receipts,
  onRecordPayment,
  onPreview,
  onReissue,
  onDelete,
}) => {
  if (receipts.length === 0) {
    return (
      <div className="p-8">
        <div className="text-center p-10 bg-white border border-gray-200">
          <Receipt size={48} className="mx-auto text-green-600 mb-3" />
          <h3 className="text-base font-semibold text-gray-900 mb-2">Receipts</h3>
          <p className="text-sm text-gray-500 mb-4">
            Record payments and generate receipts for clients.
          </p>
          <Button renderIcon={Plus} onClick={onRecordPayment}>
            Record Payment
          </Button>
        </div>
      </div>
    );
  }

  const columns = [
    {
      key: 'receipt_number',
      header: 'Receipt #',
      width: '18%',
      render: (row: any) => (
        <span className="font-mono font-semibold text-green-700">{row.receipt_number}</span>
      ),
    },
    { key: 'client_name', header: 'Client', width: '25%' },
    {
      key: 'batch',
      header: 'Batch',
      width: '12%',
      render: (row: any) =>
        row.batch ? (
          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-cyan-100 text-cyan-800">
            {row.batch}
          </span>
        ) : (
          <span className="text-gray-500">—</span>
        ),
    },
    {
      key: 'amount_received',
      header: 'Amount',
      width: '15%',
      render: (row: any) => <span className="font-semibold">{formatMoney(row.amount_received, row.currency)}</span>,
    },
    {
      key: 'payment_date',
      header: 'Date',
      width: '15%',
      render: (row: any) => (row.payment_date ? new Date(row.payment_date).toLocaleDateString() : '—'),
    },
    {
      key: 'actions',
      header: '',
      width: '15%',
      render: (row: any) => (
        <ActionMenu
          items={[
            { label: 'Preview PDF', onClick: () => onPreview(row as ReceiptType) },
            { label: 'Reissue', onClick: () => onReissue(row as ReceiptType) },
            { label: 'Delete', onClick: () => onDelete(row as ReceiptType), danger: true },
          ]}
        />
      ),
    },
  ];

  const rows = receipts.map((receipt) => ({ ...receipt, actions: '' })) as any[];

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">All Receipts</h3>
        <Button renderIcon={Plus} onClick={onRecordPayment}>
          Record Payment
        </Button>
      </div>

      <DataTableWrapper
        rows={rows}
        columns={columns}
        search
        emptyMessage="No receipts found"
      />
    </div>
  );
};

// ============================================================================
// Statements Section
// ============================================================================

interface StatementsSectionProps {
  selectedClient: string;
  statementDateFrom: string;
  statementDateTo: string;
  clientOptions: { id: string; name: string }[];
  onClientChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onGenerate: () => void;
  onClear: () => void;
}

export const StatementsSection: React.FC<StatementsSectionProps> = ({
  selectedClient,
  statementDateFrom,
  statementDateTo,
  clientOptions,
  onClientChange,
  onDateFromChange,
  onDateToChange,
  onGenerate,
  onClear,
}) => {
  return (
    <div className="p-8">
      <div className="max-w-xl mx-auto text-center bg-white border border-gray-200 p-8">
        <BarChart3 size={48} className="mx-auto text-blue-600 mb-3" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Client Statements</h3>
        <p className="text-sm text-gray-500 mb-6">
          Generate a branded statement for a client using their invoices and matching payments,
          optionally filtered by date range.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left mb-6">
          <div className="md:col-span-2">
            <label htmlFor="statement-client" className="block text-xs text-gray-600 mb-1">
              Client
            </label>
            <select
              id="statement-client"
              value={selectedClient}
              onChange={(e) => onClientChange(e.target.value)}
              className="w-full h-10 px-3 text-sm border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select a client</option>
              {clientOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="statement-from" className="block text-xs text-gray-600 mb-1">
              From Date
            </label>
            <input
              id="statement-from"
              type="date"
              value={statementDateFrom}
              onChange={(e) => onDateFromChange(e.target.value)}
              className="w-full h-10 px-3 text-sm border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="statement-to" className="block text-xs text-gray-600 mb-1">
              To Date
            </label>
            <input
              id="statement-to"
              type="date"
              value={statementDateTo}
              onChange={(e) => onDateToChange(e.target.value)}
              className="w-full h-10 px-3 text-sm border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex gap-2 justify-center flex-wrap">
          <Button onClick={onGenerate} disabled={!selectedClient}>
            Generate Statement
          </Button>
          <Button variant="ghost" onClick={onClear} disabled={!selectedClient}>
            Clear Selection
          </Button>
        </div>
      </div>
    </div>
  );
};
