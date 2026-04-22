import type { Invoice, ReceiptItem } from '../../../types';
import { normalizeDocumentCurrency, type DocumentCurrency } from './formatMoney';

/**
 * Pure helpers for the payment/receipt recording flow.
 *
 * These functions know nothing about React or services. They transform the
 * drafted allocation rows from the form into the server payload shape, and
 * back out into receipt line items for PDF / persistence.
 */

export interface PaymentAllocationDraft {
  invoice_id: string;
  amount: string;
}

export interface PaymentAllocationPayload {
  invoice_id?: string;
  amount_allocated: number;
  currency: DocumentCurrency;
  status?: 'allocated' | 'unallocated' | 'credit';
}

export interface PaymentValidationInput {
  clientName: string;
  amount: number;
  currency: DocumentCurrency | '';
}

export type PaymentValidationResult =
  | { ok: true }
  | { ok: false; message: string };

export const validatePaymentBasics = ({
  clientName,
  amount,
  currency,
}: PaymentValidationInput): PaymentValidationResult => {
  if (!clientName.trim()) {
    return { ok: false, message: 'Please select a client' };
  }
  if (!currency) {
    return { ok: false, message: 'Please select a currency' };
  }
  if (amount <= 0) {
    return { ok: false, message: 'Please enter a payment amount greater than zero' };
  }
  return { ok: true };
};

/**
 * Parse drafted allocation rows into normalised { invoice_id, amount_allocated }
 * objects, dropping rows that are entirely blank. Returns an object with the
 * parsed drafts plus the first invalid row (row with an invoice but zero/negative amount).
 */
export const parseAllocationDrafts = (drafts: PaymentAllocationDraft[]) => {
  const parsed = drafts
    .map(allocation => ({
      invoice_id: allocation.invoice_id,
      amount_allocated: parseFloat(allocation.amount) || 0,
    }))
    .filter(allocation => allocation.invoice_id || allocation.amount_allocated > 0);

  const invalid = parsed.find(
    allocation => allocation.invoice_id && allocation.amount_allocated <= 0
  );

  return { parsed, invalid };
};

/**
 * Build the final mergedAllocations array for the payment payload.
 * Groups allocations by invoice_id and, if none are allocated to an invoice,
 * returns a single unallocated entry (client credit) for the full amount.
 */
export const buildAllocations = (
  parsed: Array<{ invoice_id: string; amount_allocated: number }>,
  fallbackAmount: number,
  currency: DocumentCurrency
): PaymentAllocationPayload[] => {
  const hasInvoiceAllocations = parsed.some(a => a.invoice_id && a.amount_allocated > 0);

  if (!hasInvoiceAllocations) {
    return [
      {
        amount_allocated: fallbackAmount,
        currency,
        status: 'unallocated',
      },
    ];
  }

  const byInvoice = parsed
    .filter(a => a.invoice_id)
    .reduce((acc, allocation) => {
      const existing = acc.get(allocation.invoice_id);
      if (existing) {
        existing.amount_allocated += allocation.amount_allocated;
      } else {
        acc.set(allocation.invoice_id, {
          invoice_id: allocation.invoice_id,
          amount_allocated: allocation.amount_allocated,
          currency,
          status: 'allocated',
        });
      }
      return acc;
    }, new Map<string, PaymentAllocationPayload>());

  return Array.from(byInvoice.values());
};

export const sumAllocations = (allocations: PaymentAllocationPayload[]): number =>
  allocations.reduce((sum, a) => sum + a.amount_allocated, 0);

export const buildPaymentReferenceId = (allocatedInvoices: Invoice[]): string => {
  if (allocatedInvoices.length === 1) {
    return allocatedInvoices[0].invoice_number;
  }
  return `PAY-${Date.now()}`;
};

export const buildReceiptReferenceNumber = (
  allocatedInvoices: Invoice[],
  paymentReferenceId: string
): string => {
  if (allocatedInvoices.length === 1) {
    return allocatedInvoices[0].invoice_number;
  }
  if (allocatedInvoices.length > 1) {
    return allocatedInvoices.map(invoice => invoice.invoice_number).join(', ');
  }
  return paymentReferenceId;
};

export const resolveAllocatedInvoices = (
  allocations: PaymentAllocationPayload[],
  invoices: Invoice[]
): Invoice[] =>
  allocations
    .filter(a => a.invoice_id)
    .map(allocation => invoices.find(invoice => invoice.id === allocation.invoice_id))
    .filter((invoice): invoice is Invoice => Boolean(invoice));

// Re-export type so callers only need to import from this module.
export type { DocumentCurrency };
export { normalizeDocumentCurrency };

/** Describe an allocation for building receipt line items (simplified shape). */
export type AllocationForReceipt = {
  invoice_id?: string;
  amount_allocated: number;
  currency: DocumentCurrency;
};

/**
 * Used by both the record-payment flow and the reissue-receipt flow to
 * generate human-readable line items for the receipt PDF.
 *
 * Requires the caller to pass `normalizeLineItem` so that the resulting
 * items are shaped like the rest of the app's LineItem records.
 */
export const buildReceiptItemsSnapshot = (
  allocatedInvoices: Invoice[],
  allocations: AllocationForReceipt[],
  totalAmount: number,
  fallbackReference: string,
  normalizeLineItem: (item: Partial<ReceiptItem>) => ReceiptItem
): ReceiptItem[] => {
  if (allocatedInvoices.length === 1) {
    const invoice = allocatedInvoices[0];
    const invoiceItems = (invoice.items || []).map(item =>
      normalizeLineItem({
        ...item,
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
      })
    );
    const invoiceTotal =
      invoice.amount_usd || invoiceItems.reduce((sum, item) => sum + (item.amount || 0), 0);

    if (invoiceItems.length > 0 && Math.abs(invoiceTotal - totalAmount) < 0.01) {
      return invoiceItems;
    }
  }

  if (allocations.length > 0) {
    return allocations.map((allocation, index) => {
      const invoice = allocation.invoice_id
        ? allocatedInvoices.find(candidate => candidate.id === allocation.invoice_id)
        : undefined;
      return {
        ...normalizeLineItem({
          description: invoice
            ? `Payment toward ${invoice.invoice_number}${invoice.description ? ` - ${invoice.description}` : ''}`
            : !allocation.invoice_id
              ? 'Unallocated client payment'
              : `Payment allocation ${index + 1}`,
          quantity: 1,
          unit_price: allocation.amount_allocated,
          discount_percentage: 0,
        }),
        invoice_id: invoice?.id,
        invoice_number: invoice?.invoice_number,
      };
    });
  }

  return [
    normalizeLineItem({
      description: fallbackReference || 'Recorded payment',
      quantity: 1,
      unit_price: totalAmount,
      discount_percentage: 0,
    }),
  ];
};
