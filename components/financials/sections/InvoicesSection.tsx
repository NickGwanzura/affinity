import React, { useMemo } from 'react';
import { Button, StatusBadge } from '../../ui';
import type { Invoice } from '../../../types';
import { ActionMenu } from '../ActionMenu';
import { FinancialsTable, type FinancialsColumn } from '../FinancialsTable';
import { formatMoney } from '../utils/formatMoney';
import { getStatusTagType } from '../utils/statusMapping';

interface InvoicesSectionProps {
  invoices: Invoice[];
  batchFilter: string;
  onBatchFilterChange: (value: string) => void;
  onClearBatchFilter: () => void;
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
  const filteredInvoices = useMemo(
    () =>
      invoices.filter(
        invoice =>
          !batchFilter || (invoice.batch || '').toLowerCase().includes(batchFilter.toLowerCase())
      ),
    [invoices, batchFilter]
  );

  const columns: FinancialsColumn<Invoice>[] = [
    {
      key: 'invoice_number',
      header: 'Invoice #',
      width: '18%',
      render: row => (
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
      render: row =>
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
      render: row => (
        <span className="font-semibold">{formatMoney(row.amount_usd, row.currency)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '12%',
      render: row => <StatusBadge status={getStatusTagType(row.status)} size="sm" />,
    },
    {
      key: 'due_date',
      header: 'Due Date',
      width: '12%',
      render: row => (row.due_date ? new Date(row.due_date).toLocaleDateString() : '—'),
    },
    {
      key: 'actions',
      header: '',
      width: '12%',
      render: row => (
        <ActionMenu
          items={[
            { label: 'Preview', onClick: () => onPreview(row) },
            { label: 'Download PDF', onClick: () => onDownload(row) },
            { label: 'Edit', onClick: () => onEdit(row) },
            { label: 'Delete', onClick: () => onDelete(row), danger: true },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <div
        className="px-4 py-3 border-b"
        style={{
          backgroundColor: 'var(--cds-layer-02, #f4f4f4)',
          borderColor: 'var(--cds-border-subtle, #c6c6c6)',
        }}
      >
        <div className="flex items-end gap-2">
          <div className="flex-1 max-w-xs">
            <label
              htmlFor="invoice-batch-filter"
              className="block text-xs mb-1"
              style={{ color: 'var(--cds-text-secondary, #525252)' }}
            >
              Filter by batch
            </label>
            <input
              id="invoice-batch-filter"
              type="text"
              value={batchFilter}
              onChange={e => onBatchFilterChange(e.target.value)}
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
            <span
              className="text-xs pb-2"
              style={{ color: 'var(--cds-text-secondary, #525252)' }}
            >
              {filteredInvoices.length} result(s)
            </span>
          )}
        </div>
      </div>

      <FinancialsTable
        rows={filteredInvoices}
        columns={columns}
        emptyMessage={batchFilter ? 'No invoices match the batch filter' : 'No invoices found'}
      />
    </div>
  );
};
