import React from 'react';
import { StatusBadge } from '../../ui';
import type { Quote } from '../../../types';
import { ActionMenu } from '../ActionMenu';
import { FinancialsTable, type FinancialsColumn } from '../FinancialsTable';
import { formatMoney } from '../utils/formatMoney';
import { getStatusTagType } from '../utils/statusMapping';

interface QuotesSectionProps {
  quotes: Quote[];
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
  const columns: FinancialsColumn<Quote>[] = [
    {
      key: 'quote_number',
      header: 'Quote #',
      width: '15%',
      render: row => <span className="font-mono font-semibold">{row.quote_number}</span>,
    },
    { key: 'client_name', header: 'Client', width: '25%' },
    {
      key: 'amount_usd',
      header: 'Amount',
      width: '15%',
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
      key: 'created_at',
      header: 'Created',
      width: '15%',
      render: row => new Date(row.created_at).toLocaleDateString(),
    },
    {
      key: 'actions',
      header: '',
      width: '18%',
      render: row => (
        <ActionMenu
          items={[
            { label: 'Preview', onClick: () => onPreview(row) },
            { label: 'Download PDF', onClick: () => onDownload(row) },
            { label: 'Edit', onClick: () => onEdit(row) },
            { label: 'Convert to Invoice', onClick: () => onConvert(row) },
            { label: 'Delete', onClick: () => onDelete(row), danger: true },
          ]}
        />
      ),
    },
  ];

  return <FinancialsTable rows={quotes} columns={columns} emptyMessage="No quotes found" />;
};
