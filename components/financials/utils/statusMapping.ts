import type { Payment } from '../../../types';

/**
 * Map a document status string (Invoice/Quote/etc.) to the canonical
 * StatusBadge `status` prop. Centralising this avoids drift between
 * the Financials shell and individual section tables.
 */
export const getStatusTagType = (status: string): string => {
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

/**
 * Classify a payment into a badge variant. Preserves the load-bearing
 * `unallocated` / `UNALLOC-` semantic — do not refactor that away.
 */
export type PaymentBadge =
  | { variant: 'pending' }
  | { variant: 'success' }
  | { variant: 'info'; customColors: { bg: string; text: string } };

export const classifyPayment = (payment: Payment): PaymentBadge => {
  if (payment.status === 'unallocated' || payment.reference_id?.startsWith('UNALLOC-')) {
    return { variant: 'pending' };
  }
  if (payment.type === 'Inbound') {
    return { variant: 'success' };
  }
  return { variant: 'info', customColors: { bg: '#f3e8ff', text: '#7e22ce' } };
};
