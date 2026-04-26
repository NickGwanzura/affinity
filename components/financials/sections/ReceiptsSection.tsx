import React from 'react';
import { Plus, Receipt as ReceiptIcon } from 'lucide-react';
import { Button } from '../../ui';
import type { Receipt as ReceiptType } from '../../../types';
import { ActionMenu } from '../ActionMenu';
import { FinancialsTable, type FinancialsColumn } from '../FinancialsTable';
import { formatMoney } from '../utils/formatMoney';

interface ReceiptsSectionProps {
  receipts: ReceiptType[];
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
        <div
          className="text-center p-10"
          style={{
            backgroundColor: 'var(--cds-layer-01, #ffffff)',
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: 'var(--cds-border-subtle, #d6d3d1)',
          }}
        >
          <ReceiptIcon size={48} className="mx-auto text-green-600 mb-3" />
          <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--cds-text-primary, #18181b)' }}>
            Receipts
          </h3>
          <p className="text-sm mb-4" style={{ color: 'var(--cds-text-secondary, #52525b)' }}>
            Record payments and generate receipts for clients.
          </p>
          <Button renderIcon={Plus} onClick={onRecordPayment}>
            Record Payment
          </Button>
        </div>
      </div>
    );
  }

  const columns: FinancialsColumn<ReceiptType>[] = [
    {
      key: 'receipt_number',
      header: 'Receipt #',
      width: '18%',
      render: row => (
        <span className="font-mono font-semibold text-green-700">{row.receipt_number}</span>
      ),
    },
    { key: 'client_name', header: 'Client', width: '25%' },
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
      key: 'amount_received',
      header: 'Amount',
      width: '15%',
      render: row => (
        <span className="font-semibold">{formatMoney(row.amount_received, row.currency)}</span>
      ),
    },
    {
      key: 'payment_date',
      header: 'Date',
      width: '15%',
      render: row => (row.payment_date ? new Date(row.payment_date).toLocaleDateString() : '—'),
    },
    {
      key: 'actions',
      header: '',
      width: '15%',
      render: row => (
        <ActionMenu
          items={[
            { label: 'Preview PDF', onClick: () => onPreview(row) },
            { label: 'Reissue', onClick: () => onReissue(row) },
            { label: 'Delete', onClick: () => onDelete(row), danger: true },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h3
          className="text-lg font-semibold"
          style={{ color: 'var(--cds-text-primary, #18181b)' }}
        >
          All Receipts
        </h3>
        <Button renderIcon={Plus} onClick={onRecordPayment}>
          Record Payment
        </Button>
      </div>

      <FinancialsTable rows={receipts} columns={columns} emptyMessage="No receipts found" />
    </div>
  );
};
