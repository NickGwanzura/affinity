import React from 'react';
import { Tag } from '../ui';
import type { DataTableColumn } from '../ui';
import type { Invoice, Quote, Payment } from '../../types';
import { formatMoney } from './types';

const formattedDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString() : '–';

export const invoiceColumns: DataTableColumn<Invoice>[] = [
  { key: 'invoice_number', header: 'Invoice #' },
  { key: 'created_at', header: 'Date', render: (r) => formattedDate(r.created_at) },
  { key: 'due_date', header: 'Due', render: (r) => formattedDate(r.due_date) },
  {
    key: 'status',
    header: 'Status',
    render: (r) => (
      <Tag
        type={
          r.status === 'Paid'
            ? 'green'
            : r.status === 'Overdue'
              ? 'red'
              : r.status === 'Draft'
                ? 'gray'
                : 'blue'
        }
        size="sm"
      >
        {r.status}
      </Tag>
    ),
  },
  {
    key: 'amount_usd',
    header: 'Amount',
    render: (r) => (
      <span className="font-semibold">{formatMoney(r.amount_usd, r.currency || 'USD')}</span>
    ),
  },
];

export const quoteColumns: DataTableColumn<Quote>[] = [
  { key: 'quote_number', header: 'Quote #' },
  { key: 'created_at', header: 'Date', render: (r) => formattedDate(r.created_at) },
  {
    key: 'valid_until',
    header: 'Valid Until',
    render: (r) => formattedDate(r.valid_until),
  },
  {
    key: 'status',
    header: 'Status',
    render: (r) => (
      <Tag
        type={r.status === 'Accepted' ? 'green' : r.status === 'Rejected' ? 'red' : 'blue'}
        size="sm"
      >
        {r.status}
      </Tag>
    ),
  },
  {
    key: 'amount_usd',
    header: 'Amount',
    render: (r) => (
      <span className="font-semibold">{formatMoney(r.amount_usd, r.currency || 'USD')}</span>
    ),
  },
];

export const paymentColumns: DataTableColumn<Payment>[] = [
  { key: 'reference_id', header: 'Ref', render: (r) => r.reference_id || '–' },
  { key: 'date', header: 'Date', render: (r) => formattedDate(r.date) },
  { key: 'method', header: 'Method', render: (r) => r.method || '–' },
  {
    key: 'status',
    header: 'Status',
    render: (r) => (
      <Tag type={r.status === 'unallocated' ? 'gray' : 'green'} size="sm">
        {r.status === 'unallocated' ? 'Unallocated' : 'Allocated'}
      </Tag>
    ),
  },
  {
    key: 'amount_usd',
    header: 'Amount',
    render: (r) => (
      <span className="font-semibold text-green-600">
        {formatMoney(r.amount_usd, r.currency || 'USD')}
      </span>
    ),
  },
];
