import React from 'react';
import { Plus } from 'lucide-react';
import { Button, StatusBadge } from '../../ui';
import type { Payment } from '../../../types';
import { ActionMenu } from '../ActionMenu';
import { FinancialsTable, type FinancialsColumn } from '../FinancialsTable';
import { formatMoney } from '../utils/formatMoney';
import { classifyPayment } from '../utils/statusMapping';

type PaymentRow = Payment & { client: string; reference_id: string };

interface PaymentsSectionProps {
  payments: Payment[];
  getPaymentClientName: (payment: Payment) => string;
  getPaymentCurrency: (payment: Payment) => string;
  getPaymentAllocationSummary: (payment: Payment) => string | null;
  onEdit: (payment: Payment) => void;
  onDelete: (payment: Payment) => void;
  onRecordPayment?: () => void;
}

const renderPaymentStatus = (payment: Payment): React.ReactNode => {
  const badge = classifyPayment(payment);
  if (badge.variant === 'info') {
    return <StatusBadge status="info" size="sm" customColors={badge.customColors} />;
  }
  return <StatusBadge status={badge.variant} size="sm" />;
};

export const PaymentsSection: React.FC<PaymentsSectionProps> = ({
  payments,
  getPaymentClientName,
  getPaymentCurrency,
  getPaymentAllocationSummary,
  onEdit,
  onDelete,
  onRecordPayment,
}) => {
  const rows: PaymentRow[] = payments.map(payment => ({
    ...payment,
    client: getPaymentClientName(payment),
  }));

  const columns: FinancialsColumn<PaymentRow>[] = [
    { key: 'client', header: 'Client', width: '20%' },
    {
      key: 'reference_id',
      header: 'Reference',
      width: '22%',
      render: row => (
        <div>
          <span className="font-mono text-xs">{row.reference_id}</span>
          {getPaymentAllocationSummary(row) && (
            <p className="text-xs text-gray-500 mt-0.5">{getPaymentAllocationSummary(row)}</p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '12%',
      render: row => renderPaymentStatus(row),
    },
    {
      key: 'amount_usd',
      header: 'Amount',
      width: '12%',
      render: row => (
        <span className="font-semibold text-green-700">
          {formatMoney(row.amount_usd, getPaymentCurrency(row))}
        </span>
      ),
    },
    { key: 'method', header: 'Method', width: '12%' },
    {
      key: 'date',
      header: 'Date',
      width: '12%',
      render: row => (row.date ? new Date(row.date).toLocaleDateString() : '—'),
    },
    {
      key: 'actions',
      header: '',
      width: '10%',
      render: row => (
        <ActionMenu
          items={[
            { label: 'Edit', onClick: () => onEdit(row) },
            { label: 'Delete', onClick: () => onDelete(row), danger: true },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      {onRecordPayment && (
        <div
          className="px-4 py-3 border-b flex justify-end"
          style={{ borderColor: 'var(--cds-border-subtle, #c6c6c6)' }}
        >
          <Button renderIcon={Plus} onClick={onRecordPayment}>
            Record Payment
          </Button>
        </div>
      )}
      <FinancialsTable rows={rows} columns={columns} emptyMessage="No payments recorded" />
    </div>
  );
};
