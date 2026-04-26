import React, { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import type {
  Client,
  CompanyDetails,
  Invoice,
  LineItem,
  Payment,
  Quote,
  Receipt,
  ReceiptItem,
  Vehicle,
} from '../../types';
import { dataService } from '../../services/dataService';
import type { StatementData } from '../../services/pdfService';
import { Button, DashboardPageHeader } from '../ui';
import { useConfirm } from '../ConfirmModal';
import { useToast } from '../Toast';
import { ClientFormModal, type ClientFormValue } from '../shared/ClientFormModal';
import { InvoiceModal } from '../shared/InvoiceModal';
import { QuoteModal } from '../shared/QuoteModal';
import { PaymentModal } from '../shared/PaymentModal';

import { FinancialsTabBar, type FinancialsTab } from './FinancialsTabBar';
import { QuotesSection } from './sections/QuotesSection';
import { InvoicesSection } from './sections/InvoicesSection';
import { PaymentsSection } from './sections/PaymentsSection';
import { ReceiptsSection } from './sections/ReceiptsSection';
import { StatementsSection } from './sections/StatementsSection';
import { formatMoney, normalizeClientName, normalizeDocumentCurrency } from './utils/formatMoney';
import {
  buildAllocations,
  buildPaymentReferenceId,
  buildReceiptItemsSnapshot,
  buildReceiptReferenceNumber,
  parseAllocationDrafts,
  resolveAllocatedInvoices,
  sumAllocations,
  validatePaymentBasics,
  type PaymentAllocationDraft,
  type PaymentAllocationPayload,
} from './utils/paymentAllocations';

// ─── Shared local types ──────────────────────────────────────────────────────

type ClientOption = {
  id: string;
  name: string;
  isRegistered: boolean;
};

const UNREGISTERED_CLIENT_PREFIX = 'unregistered:';

// ─── Pure line-item helpers (kept local; they're used across forms only) ──────

const createEmptyLineItem = (): LineItem => ({
  description: '',
  quantity: 1,
  unit_price: 0,
  amount: 0,
  discount_percentage: 0,
  discount_amount: 0,
  tax_rate: 0,
  tax_amount: 0,
});

const clampDiscountPercentage = (value: number): number =>
  Math.min(100, Math.max(0, value));

const calculateLineSubtotal = (item: Pick<LineItem, 'quantity' | 'unit_price'>): number =>
  (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);

const calculateLineDiscountAmount = (
  item: Pick<LineItem, 'quantity' | 'unit_price' | 'discount_percentage'>
): number =>
  (calculateLineSubtotal(item) *
    clampDiscountPercentage(Number(item.discount_percentage) || 0)) /
  100;

const calculateLineNetAmount = (
  item: Pick<LineItem, 'quantity' | 'unit_price' | 'discount_percentage'>
): number => Math.max(0, calculateLineSubtotal(item) - calculateLineDiscountAmount(item));

const calculateLineTaxAmount = (
  item: Pick<LineItem, 'quantity' | 'unit_price' | 'discount_percentage' | 'tax_rate'>
): number => (calculateLineNetAmount(item) * (Number(item.tax_rate) || 0)) / 100;

const calculateLineAmount = (
  item: Pick<LineItem, 'quantity' | 'unit_price' | 'discount_percentage' | 'tax_rate'>
): number => calculateLineNetAmount(item) + calculateLineTaxAmount(item);

const normalizeLineItemForForm = (item?: Partial<LineItem & ReceiptItem>): LineItem => {
  const normalized: LineItem = {
    description: item?.description || '',
    quantity: Math.max(1, Number(item?.quantity) || 1),
    unit_price: Math.max(0, Number(item?.unit_price) || 0),
    amount: 0,
    discount_percentage: clampDiscountPercentage(Number(item?.discount_percentage) || 0),
    discount_amount: 0,
    tax_rate: Math.max(0, Number(item?.tax_rate) || 0),
    tax_amount: 0,
    notes: item?.notes || '',
    line_number: item?.line_number,
    id: item?.id,
  };

  normalized.amount = calculateLineNetAmount(normalized);
  normalized.discount_amount = calculateLineDiscountAmount(normalized);
  normalized.tax_amount = calculateLineTaxAmount(normalized);

  return normalized;
};

const normalizeReceiptLineItem = (item?: Partial<ReceiptItem>): ReceiptItem => {
  const base = normalizeLineItemForForm(item) as ReceiptItem;
  if (item?.invoice_id) base.invoice_id = item.invoice_id;
  if (item?.invoice_number) base.invoice_number = item.invoice_number;
  return base;
};

const createEmptyPaymentAllocationDraft = (): PaymentAllocationDraft => ({
  invoice_id: '',
  amount: '',
});

// ─── Component ───────────────────────────────────────────────────────────────

export const Financials: React.FC = () => {
  const { showToast, ToastContainer } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const [activeTab, setActiveTab] = useState<FinancialsTab>('quotes');
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [company, setCompany] = useState<CompanyDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [statementDateFrom, setStatementDateFrom] = useState('');
  const [statementDateTo, setStatementDateTo] = useState('');
  const [, setDeletingKey] = useState<string | null>(null);
  const [isSubmittingQuote, setIsSubmittingQuote] = useState(false);
  const [isSubmittingInvoice, setIsSubmittingInvoice] = useState(false);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [convertingQuoteId, setConvertingQuoteId] = useState<string | null>(null);
  const [clientModalTarget, setClientModalTarget] = useState<'quote' | 'invoice'>('quote');
  const [clientForm, setClientForm] = useState<ClientFormValue>({
    name: '',
    email: '',
    phone: '',
    address: '',
    company: '',
    notes: '',
  });

  const [quoteForm, setQuoteForm] = useState({
    vehicle_id: '',
    client_id: '',
    client_name: '',
    client_email: '',
    client_address: '',
    currency: 'USD' as 'USD' | 'GBP',
    description: '',
    valid_until: '',
    status: 'Draft' as const,
  });
  const [quoteLineItems, setQuoteLineItems] = useState<LineItem[]>([createEmptyLineItem()]);

  const [invoiceForm, setInvoiceForm] = useState({
    invoice_kind: 'Standard' as 'Standard' | 'Deposit' | 'Final',
    vehicle_id: '',
    client_id: '',
    client_name: '',
    client_email: '',
    client_address: '',
    currency: 'USD' as 'USD' | 'GBP',
    description: '',
    notes: '',
    terms_and_conditions:
      'Payment is due by the date specified above. Please include the invoice number with your payment.',
    due_date: '',
    status: 'Sent' as const,
    batch: '',
  });
  const [batchFilter, setBatchFilter] = useState('');
  const [invoiceLineItems, setInvoiceLineItems] = useState<LineItem[]>([createEmptyLineItem()]);
  const [paymentForm, setPaymentForm] = useState({
    client_id: '',
    client_name: '',
    currency: 'USD' as 'USD' | 'GBP',
    amount: '',
    method: 'Bank Transfer',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [paymentAllocationForm, setPaymentAllocationForm] = useState<PaymentAllocationDraft[]>([
    createEmptyPaymentAllocationDraft(),
  ]);

  const calculateTotal = (items: LineItem[]): number =>
    items.reduce((sum, item) => sum + calculateLineAmount(item), 0);

  const normalizeOptionalRelatedId = (
    value: string,
    availableIds: string[]
  ): string | undefined => {
    const normalized = value.trim();
    if (!normalized) return undefined;
    return availableIds.includes(normalized) ? normalized : undefined;
  };

  const loadData = async (throwOnError = false) => {
    try {
      const [nextQuotes, nextInvoices, nextPayments, nextReceipts, nextVehicles, nextCompany, nextClients] =
        await Promise.all([
          dataService.getQuotes(),
          dataService.getInvoices(),
          dataService.getPayments(),
          dataService.getReceipts(),
          dataService.getVehicles(),
          dataService.getCompanyDetails(),
          dataService.getClients(),
        ]);

      setQuotes(nextQuotes);
      setInvoices(nextInvoices);
      setPayments(nextPayments);
      setReceipts(nextReceipts);
      setVehicles(nextVehicles);
      setCompany(nextCompany);

      const safeClients = Array.isArray(nextClients) ? nextClients : [];
      if (!Array.isArray(nextClients)) {
        console.error('[Financials] getClients returned non-array:', nextClients);
      }
      setClients(safeClients);
      setLoading(false);
    } catch (error) {
      console.error('[Financials] loadData failed:', error);
      setLoading(false);
      if (throwOnError) throw error;
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // ─── Form reset / open helpers ─────────────────────────────────────────────

  const resetQuoteForm = () => {
    setQuoteForm({
      vehicle_id: '',
      client_id: '',
      client_name: '',
      client_email: '',
      client_address: '',
      currency: 'USD',
      description: '',
      valid_until: '',
      status: 'Draft',
    });
    setQuoteLineItems([createEmptyLineItem()]);
    setEditingQuote(null);
  };

  const closeQuoteModal = () => {
    setShowQuoteModal(false);
    resetQuoteForm();
  };

  const findClientIdByName = (name?: string | null): string => {
    const trimmed = name?.trim();
    if (!trimmed) return '';
    const matched = clients.find(
      c => c.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    return matched?.id || '';
  };

  const openEditQuoteModal = (quote: Quote) => {
    const normalizedItems =
      quote.items && quote.items.length > 0
        ? quote.items.map(item => normalizeLineItemForForm(item))
        : [
            normalizeLineItemForForm({
              ...createEmptyLineItem(),
              description: quote.description || '',
              unit_price: quote.amount_usd || 0,
            }),
          ];

    const clientId = quote.client_id || findClientIdByName(quote.client_name);

    setEditingQuote(quote);
    setQuoteForm({
      vehicle_id: quote.vehicle_id || '',
      client_id: clientId,
      client_name: quote.client_name || '',
      client_email: quote.client_email || '',
      client_address: quote.client_address || '',
      currency: normalizeDocumentCurrency(quote.currency),
      description: quote.description || '',
      valid_until: quote.valid_until || '',
      status: quote.status || 'Draft',
    });
    setQuoteLineItems(normalizedItems);
    setShowQuoteModal(true);
  };

  const handleConvertToInvoice = (quote: Quote) => {
    const normalizedItems =
      quote.items && quote.items.length > 0
        ? quote.items.map(item => normalizeLineItemForForm(item))
        : [
            normalizeLineItemForForm({
              ...createEmptyLineItem(),
              description: quote.description || '',
              unit_price: quote.amount_usd || 0,
            }),
          ];

    const clientId = quote.client_id || findClientIdByName(quote.client_name);

    setConvertingQuoteId(quote.id);
    setEditingInvoice(null);
    setInvoiceForm({
      invoice_kind: 'Standard',
      vehicle_id: quote.vehicle_id || '',
      client_id: clientId,
      client_name: quote.client_name || '',
      client_email: quote.client_email || '',
      client_address: quote.client_address || '',
      currency: normalizeDocumentCurrency(quote.currency),
      description: quote.description || '',
      notes: '',
      terms_and_conditions:
        'Payment is due by the date specified above. Please include the invoice number with your payment.',
      due_date: '',
      status: 'Sent',
      batch: '',
    });
    setInvoiceLineItems(normalizedItems);
    setShowInvoiceModal(true);
  };

  const resetInvoiceForm = () => {
    setInvoiceForm({
      invoice_kind: 'Standard',
      vehicle_id: '',
      client_id: '',
      client_name: '',
      client_email: '',
      client_address: '',
      currency: 'USD',
      description: '',
      notes: '',
      terms_and_conditions:
        'Payment is due by the date specified above. Please include the invoice number with your payment.',
      due_date: '',
      status: 'Sent',
      batch: '',
    });
    setInvoiceLineItems([createEmptyLineItem()]);
    setEditingInvoice(null);
    setConvertingQuoteId(null);
  };

  const resetPaymentForm = () => {
    setPaymentForm({
      client_id: '',
      client_name: '',
      currency: 'USD',
      amount: '',
      method: 'Bank Transfer',
      date: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setPaymentAllocationForm([createEmptyPaymentAllocationDraft()]);
  };

  const openPaymentModal = () => {
    resetPaymentForm();
    setEditingPayment(null);
    setShowPaymentModal(true);
  };

  const openCreateInvoiceModal = () => {
    resetInvoiceForm();
    setShowInvoiceModal(true);
  };

  const closeInvoiceModal = () => {
    setShowInvoiceModal(false);
    resetInvoiceForm();
  };

  const openEditInvoiceModal = (invoice: Invoice) => {
    const normalizedItems =
      invoice.items && invoice.items.length > 0
        ? invoice.items.map(item => normalizeLineItemForForm(item))
        : [
            normalizeLineItemForForm({
              description: invoice.description || 'Invoice item',
              quantity: 1,
              unit_price: invoice.amount_usd || 0,
            }),
          ];

    const clientId = invoice.client_id || findClientIdByName(invoice.client_name);

    setEditingInvoice(invoice);
    setInvoiceForm({
      invoice_kind: invoice.invoice_kind || 'Standard',
      vehicle_id: invoice.vehicle_id || '',
      client_id: clientId,
      client_name: invoice.client_name || '',
      client_email: invoice.client_email || '',
      client_address: invoice.client_address || '',
      currency: normalizeDocumentCurrency(invoice.currency),
      description: invoice.description || '',
      notes: invoice.notes || '',
      terms_and_conditions:
        invoice.terms_and_conditions ||
        'Payment is due by the date specified above. Please include the invoice number with your payment.',
      due_date: invoice.due_date || '',
      status: invoice.status || 'Sent',
      batch: invoice.batch || '',
    });
    setInvoiceLineItems(normalizedItems);
    setShowInvoiceModal(true);
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setEditingPayment(null);
    resetPaymentForm();
  };

  const openEditPaymentModal = (payment: Payment) => {
    const linkedReceipt = receipts.find(receipt => receipt.payment_id === payment.id);
    const legacyInvoice = invoices.find(
      invoice =>
        invoice.invoice_number === payment.reference_id || invoice.id === payment.reference_id
    );
    const resolvedClientName =
      payment.client_name || linkedReceipt?.client_name || legacyInvoice?.client_name || '';
    const matchedClient = resolvedClientName
      ? clients.find(
          client => normalizeClientName(client.name) === normalizeClientName(resolvedClientName)
        )
      : undefined;
    const resolvedClientId =
      payment.client_id ||
      matchedClient?.id ||
      (resolvedClientName
        ? `${UNREGISTERED_CLIENT_PREFIX}${normalizeClientName(resolvedClientName)}`
        : '');
    const allocationDrafts: PaymentAllocationDraft[] =
      payment.allocations && payment.allocations.length > 0
        ? payment.allocations.map(allocation => ({
            invoice_id: allocation.invoice_id || '',
            amount: allocation.amount_allocated.toFixed(2),
          }))
        : legacyInvoice
          ? [{ invoice_id: legacyInvoice.id, amount: payment.amount_usd.toFixed(2) }]
          : [createEmptyPaymentAllocationDraft()];

    setEditingPayment(payment);
    setPaymentForm({
      client_id: resolvedClientId,
      client_name: resolvedClientName,
      currency: normalizeDocumentCurrency(payment.currency || linkedReceipt?.currency),
      amount: payment.amount_usd.toFixed(2),
      method: payment.method || 'Bank Transfer',
      date: payment.date
        ? new Date(payment.date).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      notes: linkedReceipt?.notes || '',
    });
    setPaymentAllocationForm(allocationDrafts);
    setShowPaymentModal(true);
  };

  // ─── PDF preview helpers ───────────────────────────────────────────────────

  const openPreview = (blob: Blob, title: string) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const nextUrl = URL.createObjectURL(blob);
    setPreviewUrl(nextUrl);
    setPreviewTitle(title);
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewTitle('');
  };

  // ─── Client modal (inline client create) ───────────────────────────────────

  const openClientModal = (target: 'quote' | 'invoice') => {
    setClientModalTarget(target);
    const source =
      target === 'quote'
        ? quoteForm
        : {
            client_name: invoiceForm.client_name,
            client_email: invoiceForm.client_email,
            client_address: invoiceForm.client_address,
          };

    setClientForm({
      name: source.client_name || '',
      email: source.client_email || '',
      phone: '',
      address: source.client_address || '',
      company: '',
      notes: '',
    });
    setShowClientModal(true);
  };
  void openClientModal; // reserved for inline client modal entry points

  const closeClientModal = () => {
    setShowClientModal(false);
    setClientForm({
      name: '',
      email: '',
      phone: '',
      address: '',
      company: '',
      notes: '',
    });
  };

  const handleSaveClient = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const createdClient = await dataService.createClient(clientForm);
      const nextClients = [...clients, createdClient].sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      setClients(nextClients);

      if (clientModalTarget === 'quote') {
        setQuoteForm(current => ({
          ...current,
          client_id: createdClient.id,
          client_name: createdClient.name,
          client_email: createdClient.email || '',
          client_address: createdClient.address || '',
        }));
      } else {
        setInvoiceForm(current => ({
          ...current,
          client_id: createdClient.id,
          client_name: createdClient.name,
          client_email: createdClient.email || '',
          client_address: createdClient.address || '',
        }));
      }

      closeClientModal();
      showToast('Client created and selected.', 'success');
    } catch (error: any) {
      console.error('[Financials] handleSaveClient failed:', error);
      showToast(error?.message || 'Failed to create client.', 'error');
    }
  };

  // ─── Receipt item builder used for reissues ────────────────────────────────

  const buildReceiptForPdf = (receipt: Receipt): Receipt => {
    if (receipt.items && receipt.items.length > 0) {
      return {
        ...receipt,
        items: receipt.items.map(item => normalizeReceiptLineItem(item)),
      };
    }

    const linkedPayment = receipt.payment_id
      ? payments.find(payment => payment.id === receipt.payment_id)
      : undefined;
    const linkedAllocations =
      linkedPayment?.allocations?.map(allocation => ({
        invoice_id: allocation.invoice_id,
        amount_allocated: allocation.amount_allocated,
        currency: normalizeDocumentCurrency(allocation.currency),
      })) || [];
    const allocatedInvoices = linkedAllocations
      .map(allocation => invoices.find(invoice => invoice.id === allocation.invoice_id))
      .filter((invoice): invoice is Invoice => Boolean(invoice));

    if (allocatedInvoices.length > 0 || linkedAllocations.length > 0) {
      return {
        ...receipt,
        items: buildReceiptItemsSnapshot(
          allocatedInvoices,
          linkedAllocations,
          receipt.amount_received,
          receipt.reference_number || 'Recorded payment',
          normalizeReceiptLineItem
        ),
      };
    }

    const linkedInvoice = receipt.invoice_id
      ? invoices.find(invoice => invoice.id === receipt.invoice_id)
      : undefined;
    if (linkedInvoice) {
      return {
        ...receipt,
        items: buildReceiptItemsSnapshot(
          [linkedInvoice],
          [
            {
              invoice_id: linkedInvoice.id,
              amount_allocated: receipt.amount_received,
              currency: normalizeDocumentCurrency(receipt.currency),
            },
          ],
          receipt.amount_received,
          linkedInvoice.invoice_number,
          normalizeReceiptLineItem
        ),
      };
    }

    return {
      ...receipt,
      items: buildReceiptItemsSnapshot(
        [],
        [],
        receipt.amount_received,
        receipt.reference_number || 'Recorded payment',
        normalizeReceiptLineItem
      ),
    };
  };

  // ─── Quote / Invoice submit ────────────────────────────────────────────────

  const submitQuote = async (
    formValue: typeof quoteForm = quoteForm,
    lineItemsValue: LineItem[] = quoteLineItems
  ) => {
    const validItems = lineItemsValue
      .filter(item => item.description.trim() && item.quantity > 0)
      .map(item => normalizeLineItemForForm(item));

    if (!formValue.client_name.trim()) {
      showToast('Please enter a client name before saving the quote', 'warning');
      return;
    }
    if (validItems.length === 0) {
      showToast('Please add at least one line item with a description', 'warning');
      return;
    }

    setIsSubmittingQuote(true);
    try {
      const vehicleId = normalizeOptionalRelatedId(
        formValue.vehicle_id,
        vehicles.map(v => v.id)
      );
      const clientId = normalizeOptionalRelatedId(
        formValue.client_id,
        clients.map(c => c.id)
      );

      const payload = {
        vehicle_id: vehicleId,
        client_id: clientId,
        client_name: formValue.client_name.trim(),
        client_email: formValue.client_email.trim(),
        client_address: formValue.client_address.trim(),
        currency: formValue.currency,
        amount_usd: calculateTotal(validItems),
        description: formValue.description.trim(),
        valid_until: formValue.valid_until,
        status: formValue.status,
        items: validItems.map((item, index) => ({ ...item, line_number: index + 1 })),
      };

      if (editingQuote) {
        await dataService.updateQuote(editingQuote.id, payload);
      } else {
        await dataService.createQuote(payload);
      }

      closeQuoteModal();
      await loadData(true);
      showToast(
        editingQuote ? 'Quote updated successfully!' : 'Quote created successfully!',
        'success'
      );
    } catch (error: any) {
      console.error('[Financials] submitQuote failed:', error);
      showToast(error?.message || 'Failed to save quote', 'error');
    } finally {
      setIsSubmittingQuote(false);
    }
  };
  void isSubmittingQuote;

  const submitInvoice = async (
    formValue: typeof invoiceForm = invoiceForm,
    lineItemsValue: LineItem[] = invoiceLineItems
  ) => {
    const validItems = lineItemsValue
      .filter(item => item.description.trim() && item.quantity > 0)
      .map(item => normalizeLineItemForForm(item));

    if (!formValue.client_name.trim()) {
      showToast('Please enter a client name before saving the invoice', 'warning');
      return;
    }
    if (!formValue.due_date) {
      showToast('Please choose a due date before saving the invoice', 'warning');
      return;
    }
    if (validItems.length === 0) {
      showToast('Please add at least one line item with a description', 'warning');
      return;
    }

    setIsSubmittingInvoice(true);
    try {
      const vehicleId = normalizeOptionalRelatedId(
        formValue.vehicle_id,
        vehicles.map(v => v.id)
      );
      const clientId = normalizeOptionalRelatedId(
        formValue.client_id,
        clients.map(c => c.id)
      );
      const linkedQuoteId = convertingQuoteId || editingInvoice?.quote_id || undefined;

      const payload = {
        invoice_kind: formValue.invoice_kind,
        quote_id: linkedQuoteId,
        vehicle_id: vehicleId,
        client_id: clientId,
        client_name: formValue.client_name.trim(),
        client_email: formValue.client_email.trim(),
        client_address: formValue.client_address.trim(),
        amount_usd: calculateTotal(validItems),
        currency: formValue.currency,
        description: formValue.description.trim(),
        notes: formValue.notes.trim(),
        terms_and_conditions: formValue.terms_and_conditions.trim(),
        due_date: formValue.due_date,
        status: formValue.status || 'Sent',
        batch: formValue.batch.trim() || undefined,
        items: validItems.map((item, index) => ({ ...item, line_number: index + 1 })),
      };

      if (editingInvoice) {
        await dataService.updateInvoice(editingInvoice.id, payload);
      } else {
        await dataService.createInvoice(payload);

        if (convertingQuoteId) {
          try {
            await dataService.updateQuote(convertingQuoteId, { status: 'Accepted' });
          } catch (quoteError) {
            console.warn('Failed to update quote status:', quoteError);
          }
        }
      }

      closeInvoiceModal();
      await loadData(true);
      showToast(
        editingInvoice ? 'Invoice updated successfully!' : 'Invoice created successfully!',
        'success'
      );
    } catch (error: any) {
      console.error('[Financials] submitInvoice failed:', error);
      showToast(
        error?.message || `Failed to ${editingInvoice ? 'update' : 'create'} invoice`,
        'error'
      );
    } finally {
      setIsSubmittingInvoice(false);
    }
  };
  void isSubmittingInvoice;

  // ─── PDF actions ───────────────────────────────────────────────────────────

  const requireCompany = (): CompanyDetails | null => {
    if (!company) {
      showToast('Company details are not loaded yet', 'warning');
      return null;
    }
    return company;
  };

  const handlePreviewQuote = async (quote: Quote) => {
    const c = requireCompany();
    if (!c) return;
    try {
      const { generateQuotePDF } = await import('../../services/pdfService');
      const blob = await generateQuotePDF(quote, c);
      openPreview(blob, `Quote ${quote.quote_number}`);
    } catch (error) {
      console.error('Error previewing quote PDF:', error);
      showToast('Failed to preview quote PDF', 'error');
    }
  };

  const handlePreviewInvoice = async (invoice: Invoice) => {
    const c = requireCompany();
    if (!c) return;
    try {
      const { generateInvoicePDF } = await import('../../services/pdfService');
      const blob = await generateInvoicePDF(invoice, c);
      openPreview(blob, `Invoice ${invoice.invoice_number}`);
    } catch (error) {
      console.error('Error previewing invoice PDF:', error);
      showToast('Failed to preview invoice PDF', 'error');
    }
  };

  const handleDownloadQuote = async (quote: Quote) => {
    const c = requireCompany();
    if (!c) return;
    try {
      const { generateQuotePDFAndDownload } = await import('../../services/pdfService');
      await generateQuotePDFAndDownload(quote, c);
    } catch (error) {
      console.error('Error generating quote PDF:', error);
      showToast('Failed to generate quote PDF', 'error');
    }
  };

  const handleDownloadInvoice = async (invoice: Invoice) => {
    const c = requireCompany();
    if (!c) return;
    try {
      const { generateInvoicePDFAndDownload } = await import('../../services/pdfService');
      await generateInvoicePDFAndDownload(invoice, c);
    } catch (error) {
      console.error('Error generating invoice PDF:', error);
      showToast('Failed to generate invoice PDF', 'error');
    }
  };

  const handleDownloadReceipt = async (receipt: Receipt) => {
    const c = requireCompany();
    if (!c) return;
    try {
      const { generateReceiptPDF } = await import('../../services/pdfService');
      const blob = await generateReceiptPDF(buildReceiptForPdf(receipt), c);
      openPreview(blob, `Receipt ${receipt.receipt_number}`);
    } catch (error) {
      console.error('Error generating receipt PDF:', error);
      showToast('Failed to generate receipt PDF', 'error');
    }
  };

  // ─── Record payment orchestration (split into named steps) ──────────────────

  const persistPaymentAndReceipt = async (
    paymentPayload: {
      reference_id: string;
      client_id: string | undefined;
      client_name: string;
      type: 'Inbound';
      amount_usd: number;
      currency: 'USD' | 'GBP';
      method: string;
      date: string;
      allocations: PaymentAllocationPayload[];
    },
    receiptPayload: Omit<Receipt, 'id' | 'receipt_number' | 'created_at'> & {
      items: ReceiptItem[];
    }
  ) => {
    const linkedReceipt = editingPayment
      ? receipts.find(receipt => receipt.payment_id === editingPayment.id)
      : undefined;

    const payment = editingPayment
      ? await dataService.updatePayment(editingPayment.id, paymentPayload)
      : await dataService.addPayment(paymentPayload);

    const receipt = linkedReceipt
      ? await dataService.updateReceipt(linkedReceipt.id, receiptPayload)
      : await dataService.createReceipt({ ...receiptPayload, payment_id: payment.id });

    return { payment, receipt };
  };

  const issueReceiptPdf = async (receipt: Receipt, fallbackItems: ReceiptItem[]) => {
    if (!company) return;
    try {
      const { generateReceiptPDF } = await import('../../services/pdfService');
      const blob = await generateReceiptPDF(
        { ...receipt, items: receipt.items || fallbackItems },
        company
      );
      openPreview(blob, `Receipt ${receipt.receipt_number}`);
    } catch (pdfError) {
      console.error('Receipt download failed:', pdfError);
      showToast('Payment saved, but receipt generation failed', 'warning');
    }
  };

  const handleRecordPayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Step 1 — basic validation
    const amount = parseFloat(paymentForm.amount) || 0;
    const validation = validatePaymentBasics({
      clientName: paymentForm.client_name,
      amount,
      currency: paymentForm.currency,
    });
    if (validation.ok === false) {
      showToast(validation.message, 'warning');
      return;
    }

    const clientId = clients.some(c => c.id === paymentForm.client_id)
      ? paymentForm.client_id
      : '';
    const clientName = paymentForm.client_name.trim();
    const method = paymentForm.method.trim();
    const notes = paymentForm.notes.trim();
    const selectedCurrency = paymentForm.currency || 'USD';

    // Step 2 — parse drafts + reject invalid rows
    const { parsed, invalid } = parseAllocationDrafts(paymentAllocationForm);
    if (invalid) {
      showToast('Each allocated row needs a positive amount', 'warning');
      return;
    }

    // Step 3 — build final allocations payload and validate totals
    const mergedAllocations = buildAllocations(parsed, amount, selectedCurrency);
    if (sumAllocations(mergedAllocations) - amount > 0.001) {
      showToast('Allocated total cannot exceed the payment amount', 'warning');
      return;
    }

    const allocatedInvoices = resolveAllocatedInvoices(mergedAllocations, invoices);
    const primaryInvoice = allocatedInvoices[0];
    const isMultiInvoicePayment = allocatedInvoices.length > 1;
    const referenceId = buildPaymentReferenceId(allocatedInvoices);

    setIsSubmittingPayment(true);

    const paymentDate = paymentForm.date
      ? new Date(paymentForm.date + 'T00:00:00').toISOString()
      : new Date().toISOString();

    const paymentPayload = {
      reference_id: referenceId,
      client_id: clientId || undefined,
      client_name: primaryInvoice?.client_name || clientName,
      type: 'Inbound' as const,
      amount_usd: amount,
      currency: selectedCurrency,
      method,
      date: paymentDate,
      allocations: mergedAllocations,
    };

    try {
      const receiptItems = buildReceiptItemsSnapshot(
        allocatedInvoices,
        mergedAllocations,
        amount,
        referenceId,
        normalizeReceiptLineItem
      );

      const receiptReferenceNumber = buildReceiptReferenceNumber(allocatedInvoices, referenceId);

      const receiptPayload = {
        invoice_id: allocatedInvoices.length === 1 ? primaryInvoice.id : undefined,
        client_name: primaryInvoice?.client_name || clientName,
        client_email: primaryInvoice?.client_email || undefined,
        client_address: primaryInvoice?.client_address || undefined,
        amount_received: amount,
        currency: selectedCurrency,
        payment_method: method,
        payment_date: paymentDate,
        reference_number: receiptReferenceNumber,
        notes:
          [
            notes,
            isMultiInvoicePayment
              ? `Allocated across ${allocatedInvoices.length} invoices.`
              : null,
          ]
            .filter(Boolean)
            .join(' ') || undefined,
        items: receiptItems,
        batch: primaryInvoice?.batch || undefined,
      };

      const { receipt } = await persistPaymentAndReceipt(
        paymentPayload,
        receiptPayload as any
      );

      await loadData(true);
      closePaymentModal();
      showToast(
        editingPayment
          ? 'Payment updated successfully!'
          : 'Payment recorded and receipt created!',
        'success'
      );

      await issueReceiptPdf(receipt, receiptItems);
    } catch (error: any) {
      console.error('[Financials] handleRecordPayment failed:', error);
      showToast(error?.message || 'Failed to record payment', 'error');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // ─── Statement generation ──────────────────────────────────────────────────

  const handleGenerateStatement = async () => {
    if (!selectedClient || !company) {
      showToast('Please select a client first', 'warning');
      return;
    }

    if (
      statementDateFrom &&
      statementDateTo &&
      new Date(statementDateFrom) > new Date(statementDateTo)
    ) {
      showToast('Statement start date must be before the end date', 'warning');
      return;
    }

    const normalizedClient = normalizeClientName(selectedClient);
    const isWithinStatementRange = (value?: string) => {
      if (!value) return false;
      const current = new Date(value).getTime();
      const start = statementDateFrom
        ? new Date(`${statementDateFrom}T00:00:00`).getTime()
        : null;
      const end = statementDateTo
        ? new Date(`${statementDateTo}T23:59:59`).getTime()
        : null;

      if (start !== null && current < start) return false;
      if (end !== null && current > end) return false;
      return true;
    };

    const clientInvoices = invoices.filter(
      invoice =>
        normalizeClientName(invoice.client_name?.trim()) === normalizedClient &&
        isWithinStatementRange(invoice.created_at)
    );
    if (clientInvoices.length === 0) {
      showToast('No invoices found for this client in the selected date range', 'warning');
      return;
    }

    const invoiceReferences = new Set(
      clientInvoices
        .flatMap(invoice => [invoice.invoice_number, invoice.id])
        .filter(Boolean)
    );
    const clientInvoiceIds = new Set(clientInvoices.map(invoice => invoice.id));
    const receiptLinkedPaymentIds = new Set(
      receipts
        .filter(
          receipt =>
            normalizeClientName(receipt.client_name?.trim()) === normalizedClient &&
            receipt.payment_id
        )
        .map(receipt => receipt.payment_id as string)
    );
    const receiptLinkedReferences = new Set(
      receipts
        .filter(
          receipt => normalizeClientName(receipt.client_name?.trim()) === normalizedClient
        )
        .map(receipt => receipt.reference_number)
        .filter(Boolean)
    );
    const clientPayments: Payment[] = Array.from(
      new Map<string, Payment>(
        payments
          .filter(
            payment =>
              isWithinStatementRange(payment.date) &&
              ((payment.allocations || []).some(allocation =>
                clientInvoiceIds.has(allocation.invoice_id)
              ) ||
                normalizeClientName(payment.client_name) === normalizedClient ||
                invoiceReferences.has(payment.reference_id) ||
                receiptLinkedPaymentIds.has(payment.id) ||
                receiptLinkedReferences.has(payment.reference_id))
          )
          .map(payment => [payment.id, payment])
      ).values()
    ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const sortedDates = [
      ...clientInvoices.map(invoice => invoice.created_at),
      ...clientPayments.map(payment => payment.date),
    ]
      .filter(Boolean)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    try {
      const paymentCurrencyMap = Object.fromEntries(
        clientPayments
          .filter(payment => payment.id && payment.currency)
          .map(payment => [payment.id, payment.currency as 'USD' | 'GBP'])
      );
      const statementData: StatementData = {
        client_name: clientInvoices[0]?.client_name || selectedClient,
        client_email: clientInvoices[0]?.client_email,
        client_address: clientInvoices[0]?.client_address,
        invoices: clientInvoices,
        payments: clientPayments,
        paymentCurrencyMap,
        startDate: statementDateFrom || sortedDates[0] || new Date().toISOString(),
        endDate:
          statementDateTo || sortedDates[sortedDates.length - 1] || new Date().toISOString(),
      };
      const { generateStatementPDF } = await import('../../services/pdfService');
      const blob = await generateStatementPDF(statementData, company);
      openPreview(blob, `Statement ${selectedClient}`);
      showToast('Statement generated successfully!', 'success');
    } catch (error) {
      console.error('Error generating statement PDF:', error);
      showToast('Failed to generate statement', 'error');
    }
  };

  // ─── Delete handlers ───────────────────────────────────────────────────────

  const handleDeleteQuote = async (quote: Quote) => {
    const approved = await confirm({
      title: 'Delete Quote',
      message: `Delete quote ${quote.quote_number} for ${quote.client_name}? This cannot be undone.`,
      confirmLabel: 'Delete Quote',
      confirmVariant: 'danger',
    });
    if (!approved) return;

    setDeletingKey(`quote:${quote.id}`);
    try {
      await dataService.deleteQuote(quote.id);
      await loadData(true);
      showToast('Quote deleted successfully.', 'success');
    } catch (error: any) {
      console.error('Failed to delete quote:', error);
      showToast(error?.message || 'Failed to delete quote', 'error');
    } finally {
      setDeletingKey(null);
    }
  };

  const handleDeleteInvoice = async (invoice: Invoice) => {
    const approved = await confirm({
      title: 'Delete Invoice',
      message: `Delete invoice ${invoice.invoice_number} for ${invoice.client_name}? This cannot be undone.`,
      confirmLabel: 'Delete Invoice',
      confirmVariant: 'danger',
    });
    if (!approved) return;

    setDeletingKey(`invoice:${invoice.id}`);
    try {
      await dataService.deleteInvoice(invoice.id);
      await loadData(true);
      showToast('Invoice deleted successfully.', 'success');
    } catch (error: any) {
      console.error('Failed to delete invoice:', error);
      showToast(error?.message || 'Failed to delete invoice', 'error');
    } finally {
      setDeletingKey(null);
    }
  };

  const handleDeletePayment = async (payment: Payment) => {
    const approved = await confirm({
      title: 'Delete Payment',
      message: `Delete payment ${payment.reference_id}? Any linked receipt will lose its payment reference.`,
      confirmLabel: 'Delete Payment',
      confirmVariant: 'danger',
    });
    if (!approved) return;

    setDeletingKey(`payment:${payment.id}`);
    try {
      await dataService.deletePayment(payment.id);
      await loadData(true);
      showToast('Payment deleted successfully.', 'success');
    } catch (error: any) {
      console.error('Failed to delete payment:', error);
      showToast(error?.message || 'Failed to delete payment', 'error');
    } finally {
      setDeletingKey(null);
    }
  };

  const handleDeleteReceipt = async (receipt: Receipt) => {
    const approved = await confirm({
      title: 'Delete Receipt',
      message: `Delete receipt ${receipt.receipt_number} for ${receipt.client_name}? This cannot be undone.`,
      confirmLabel: 'Delete Receipt',
      confirmVariant: 'danger',
    });
    if (!approved) return;

    setDeletingKey(`receipt:${receipt.id}`);
    try {
      await dataService.deleteReceipt(receipt.id);
      await loadData(true);
      showToast('Receipt deleted successfully.', 'success');
    } catch (error: any) {
      console.error('Failed to delete receipt:', error);
      showToast(error?.message || 'Failed to delete receipt', 'error');
    } finally {
      setDeletingKey(null);
    }
  };

  const handleClearStatement = async () => {
    const approved = await confirm({
      title: 'Clear Statement Selection',
      message: selectedClient
        ? `Remove the current statement selection for ${selectedClient}?`
        : 'Clear the current statement selection?',
      confirmLabel: 'Clear Selection',
      confirmVariant: 'primary',
    });
    if (!approved) return;

    setSelectedClient('');
    setStatementDateFrom('');
    setStatementDateTo('');
    showToast('Statement selection cleared', 'success');
  };

  const handleReissueReceipt = async (receipt: Receipt) => {
    const c = requireCompany();
    if (!c) return;
    try {
      const { generateReceiptPDF } = await import('../../services/pdfService');
      const blob = await generateReceiptPDF(buildReceiptForPdf(receipt), c);
      openPreview(blob, `Receipt ${receipt.receipt_number}`);
      showToast(
        'Receipt reissued successfully. Review and download the regenerated PDF.',
        'success'
      );
    } catch (error) {
      console.error('Error reissuing receipt PDF:', error);
      showToast('Failed to reissue receipt PDF', 'error');
    }
  };

  // ─── Derived data (memoised) ───────────────────────────────────────────────

  const clientOptions: ClientOption[] = useMemo(() => {
    const clientMap = new Map<string, ClientOption>();

    clients.forEach(client => {
      const key = normalizeClientName(client.name);
      clientMap.set(key, { id: client.id, name: client.name, isRegistered: true });
    });

    [...quotes, ...invoices, ...receipts].forEach(doc => {
      const name = doc.client_name?.trim();
      const key = normalizeClientName(name);
      if (name && key && !clientMap.has(key)) {
        clientMap.set(key, {
          id: `${UNREGISTERED_CLIENT_PREFIX}${key}`,
          name,
          isRegistered: false,
        });
      }
    });

    return Array.from(clientMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [clients, quotes, invoices, receipts]);

  const receiptByPaymentId = useMemo(
    () =>
      new Map<string, Receipt>(
        receipts
          .filter(receipt => receipt.payment_id)
          .map(receipt => [receipt.payment_id as string, receipt])
      ),
    [receipts]
  );

  const invoiceByReference = useMemo(() => {
    const map = new Map<string, Invoice>();
    invoices.forEach(invoice => {
      map.set(invoice.id, invoice);
      map.set(invoice.invoice_number, invoice);
    });
    return map;
  }, [invoices]);

  const getPaymentAllocationAmountForInvoice = (payment: Payment, invoiceId: string): number =>
    (payment.allocations || [])
      .filter(allocation => allocation.invoice_id === invoiceId)
      .reduce((sum, allocation) => sum + allocation.amount_allocated, 0);

  const getPaymentCurrency = (payment: Payment): 'USD' | 'GBP' =>
    normalizeDocumentCurrency(
      payment.currency ||
        receiptByPaymentId.get(payment.id)?.currency ||
        invoiceByReference.get(payment.reference_id)?.currency ||
        'USD'
    );

  const getPaymentClientName = (payment: Payment): string =>
    payment.client_name ||
    receiptByPaymentId.get(payment.id)?.client_name ||
    invoiceByReference.get(payment.reference_id)?.client_name ||
    'Unlinked';

  const getInvoicePaidAmount = (invoice: Invoice): number =>
    payments.reduce((sum, payment) => {
      const paymentCurrency = getPaymentCurrency(payment);
      const allocationAmount = getPaymentAllocationAmountForInvoice(payment, invoice.id);

      if ((payment.allocations?.length || 0) > 0) {
        return allocationAmount > 0 &&
          paymentCurrency === normalizeDocumentCurrency(invoice.currency)
          ? sum + allocationAmount
          : sum;
      }

      const matchesLegacyReference =
        payment.reference_id === invoice.invoice_number ||
        payment.reference_id === invoice.id;

      if (
        !matchesLegacyReference ||
        paymentCurrency !== normalizeDocumentCurrency(invoice.currency)
      ) {
        return sum;
      }

      return sum + payment.amount_usd;
    }, 0);

  const getInvoiceOutstandingAmount = (invoice: Invoice): number =>
    Math.max(0, invoice.amount_usd - getInvoicePaidAmount(invoice));

  const canInvoiceReceivePayments = (invoice: Invoice): boolean => {
    if (invoice.status === 'Cancelled') return false;
    if (invoice.status === 'Paid') {
      return getInvoiceOutstandingAmount(invoice) > 0;
    }
    return true;
  };
  void canInvoiceReceivePayments;

  const paymentFormClient = paymentForm.client_id
    ? clients.find(c => c.id === paymentForm.client_id)
    : clients.find(
        c => normalizeClientName(c.name) === normalizeClientName(paymentForm.client_name)
      );

  const paymentAllocationCandidates = useMemo(() => {
    if (!paymentForm.client_name) return [];
    return invoices
      .filter(invoice => {
        if (invoice.status === 'Cancelled') return false;
        const currencyMatch =
          normalizeDocumentCurrency(invoice.currency) ===
          normalizeDocumentCurrency(paymentForm.currency);
        if (!currencyMatch) return false;

        if (paymentFormClient && invoice.client_id && invoice.client_id === paymentFormClient.id) {
          return true;
        }
        return (
          normalizeClientName(invoice.client_name?.trim()) ===
          normalizeClientName(paymentForm.client_name)
        );
      })
      .map(invoice => ({
        invoice,
        outstandingAmount: getInvoiceOutstandingAmount(invoice),
      }))
      .sort((a, b) => {
        if (a.outstandingAmount > 0 && b.outstandingAmount <= 0) return -1;
        if (a.outstandingAmount <= 0 && b.outstandingAmount > 0) return 1;
        return new Date(a.invoice.due_date).getTime() - new Date(b.invoice.due_date).getTime();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentForm.client_name, paymentForm.currency, paymentFormClient?.id, invoices, payments]);

  const getPaymentAllocationSummary = (payment: Payment): string | null => {
    if (!payment.allocations || payment.allocations.length === 0) return null;

    const hasUnallocatedOnly = payment.allocations.every(a => !a.invoice_id);
    if (hasUnallocatedOnly) return 'Unallocated payment (client credit)';

    return payment.allocations
      .map(allocation => {
        if (!allocation.invoice_id) {
          return `Unallocated ${formatMoney(allocation.amount_allocated, allocation.currency)}`;
        }
        const invoice = invoices.find(candidate => candidate.id === allocation.invoice_id);
        return `${invoice?.invoice_number || allocation.invoice_id.slice(0, 8)} ${formatMoney(
          allocation.amount_allocated,
          allocation.currency
        )}`;
      })
      .join(' | ');
  };

  const getClientBalanceForPayment = (
    clientName: string,
    clientId?: string
  ): {
    balance: number;
    credit: number;
    currency: 'USD' | 'GBP';
    openingBalance: number;
    totalInvoiced: number;
    totalPaid: number;
  } | null => {
    if (!clientName) return null;

    const client = clientId
      ? clients.find(c => c.id === clientId)
      : clients.find(c => c.name.trim().toLowerCase() === clientName.trim().toLowerCase());

    if (client) {
      const balance = dataService.calculateClientBalance(client, invoices, payments);
      return {
        balance: balance.current_balance,
        credit: balance.credit_balance,
        currency: client.opening_balance_currency || 'USD',
        openingBalance: balance.opening_balance,
        totalInvoiced: balance.total_invoiced,
        totalPaid: balance.total_paid,
      };
    }

    const clientInvoices = invoices.filter(
      i =>
        i.client_name.trim().toLowerCase() === clientName.trim().toLowerCase() &&
        i.status !== 'Cancelled'
    );
    const clientPayments = payments.filter(
      p =>
        (p.client_name || '').trim().toLowerCase() === clientName.trim().toLowerCase() &&
        p.type === 'Inbound' &&
        !p.is_deleted
    );

    const totalInvoiced = clientInvoices.reduce((sum, i) => sum + (Number(i.amount_usd) || 0), 0);
    const totalPaid = clientPayments.reduce((sum, p) => sum + (Number(p.amount_usd) || 0), 0);
    const rawBalance = totalInvoiced - totalPaid;

    return {
      balance: rawBalance > 0 ? rawBalance : 0,
      credit: rawBalance < 0 ? Math.abs(rawBalance) : 0,
      currency: paymentForm.currency || 'USD',
      openingBalance: 0,
      totalInvoiced,
      totalPaid,
    };
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="animate-pulse flex h-64 items-center justify-center">
        Loading Financial Records...
      </div>
    );
  }

  const surface: React.CSSProperties = {
    backgroundColor: 'var(--cds-layer-01, #ffffff)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--cds-border-subtle, #d6d3d1)',
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <ToastContainer />
      <ConfirmDialog />

      {/* Header */}
      <DashboardPageHeader
        title="Financials"
        subtitle="Quotes, invoices, payments, receipts, and client statements"
        actions={
          <>
            <Button renderIcon={Plus} onClick={() => setShowQuoteModal(true)}>
              New Quote
            </Button>
            <Button variant="success" renderIcon={Plus} onClick={openCreateInvoiceModal}>
              New Invoice
            </Button>
            <Button variant="secondary" renderIcon={Plus} onClick={openPaymentModal}>
              Record Payment
            </Button>
          </>
        }
      />

      {/* Modals */}
      <QuoteModal
        open={showQuoteModal}
        editingQuote={editingQuote}
        clients={clients}
        vehicles={vehicles}
        onClose={closeQuoteModal}
        onSubmit={async ({ form, lineItems }) => {
          const normalizedItems = lineItems.map(item =>
            normalizeLineItemForForm({
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              discount_percentage: item.discount_percentage,
              tax_rate: item.tax_rate,
            })
          );

          await submitQuote(
            {
              vehicle_id: form.vehicle_id,
              client_id: form.client_id,
              client_name: form.client_name,
              client_email: form.client_email,
              client_address: form.client_address,
              currency: form.currency,
              description: form.description,
              valid_until: form.valid_until,
              status: form.status,
            },
            normalizedItems
          );
        }}
      />

      <InvoiceModal
        open={showInvoiceModal}
        editingInvoice={editingInvoice}
        clients={clients}
        vehicles={vehicles}
        onClose={closeInvoiceModal}
        onSubmit={async ({ form, lineItems }) => {
          const normalizedItems = lineItems.map(item =>
            normalizeLineItemForForm({
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              discount_percentage: item.discount_percentage,
              tax_rate: item.tax_rate,
            })
          );

          await submitInvoice(
            {
              invoice_kind: form.invoice_kind,
              vehicle_id: form.vehicle_id,
              client_id: form.client_id,
              client_name: form.client_name,
              client_email: form.client_email,
              client_address: form.client_address,
              currency: form.currency,
              description: form.description,
              notes: form.notes,
              terms_and_conditions: form.terms_and_conditions,
              due_date: form.due_date,
              status: form.status,
              batch: form.batch,
            },
            normalizedItems
          );
        }}
      />

      <PaymentModal
        open={showPaymentModal}
        editingPayment={editingPayment}
        clientOptions={clientOptions}
        allocationCandidates={paymentAllocationCandidates}
        formData={paymentForm}
        allocations={paymentAllocationForm}
        isSubmitting={isSubmittingPayment}
        clientBalance={
          paymentForm.client_name
            ? getClientBalanceForPayment(paymentForm.client_name, paymentForm.client_id)
            : null
        }
        onFormChange={updates => {
          setPaymentForm(current => ({ ...current, ...updates }));
          if (updates.currency) {
            setPaymentAllocationForm(current => {
              const filtered = current.filter(allocation => {
                const invoice = invoices.find(candidate => candidate.id === allocation.invoice_id);
                return invoice
                  ? normalizeDocumentCurrency(invoice.currency) === updates.currency
                  : true;
              });
              return filtered.length > 0 ? filtered : [createEmptyPaymentAllocationDraft()];
            });
          }
        }}
        onClientChange={(clientId, clientName) => {
          setPaymentForm(current => ({ ...current, client_id: clientId, client_name: clientName }));
          setPaymentAllocationForm([createEmptyPaymentAllocationDraft()]);
        }}
        onAllocationsChange={setPaymentAllocationForm}
        onClose={closePaymentModal}
        onSubmit={() =>
          handleRecordPayment({
            preventDefault: () => {},
          } as React.FormEvent<HTMLFormElement>)
        }
      />

      <ClientFormModal
        isOpen={showClientModal}
        title={clientModalTarget === 'quote' ? 'Add Client for Quote' : 'Add Client for Invoice'}
        onClose={closeClientModal}
        onSubmit={handleSaveClient}
        form={clientForm}
        onChange={updates => setClientForm(current => ({ ...current, ...updates }))}
        submitLabel="Create Client"
      />

      {/* PDF Preview overlay */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 backdrop-blur-sm"
            onClick={closePreview}
            style={{ backgroundColor: 'rgba(22, 22, 22, 0.6)' }}
          />
          <div className="relative h-[88vh] w-full max-w-6xl overflow-hidden" style={surface}>
            <div
              className="flex items-center justify-between gap-4 px-6 py-4"
              style={{
                borderBottomWidth: '1px',
                borderBottomStyle: 'solid',
                borderBottomColor: 'var(--cds-border-subtle, #d6d3d1)',
                backgroundColor: 'var(--cds-layer-02, #ffffff)',
              }}
            >
              <div>
                <h3
                  className="text-lg font-black"
                  style={{ color: 'var(--cds-text-primary, #18181b)' }}
                >
                  {previewTitle} Preview
                </h3>
                <p
                  className="text-sm"
                  style={{ color: 'var(--cds-text-secondary, #52525b)' }}
                >
                  Review the PDF before downloading or sharing it.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')}
                >
                  Open in New Tab
                </Button>
                <a
                  href={previewUrl}
                  download={`${previewTitle.replace(/\s+/g, '_')}.pdf`}
                  className="inline-flex items-center justify-center gap-2 h-10 px-4 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors"
                >
                  Download PDF
                </a>
                <Button variant="secondary" onClick={closePreview}>
                  Close
                </Button>
              </div>
            </div>
            <iframe
              src={previewUrl}
              title={previewTitle}
              className="h-[calc(88vh-73px)] w-full"
              style={{ backgroundColor: 'var(--cds-layer-02, #ffffff)' }}
            />
          </div>
        </div>
      )}

      {/* Tabs + active section */}
      <div className="overflow-hidden" style={surface}>
        <FinancialsTabBar
          activeTab={activeTab}
          onChange={setActiveTab}
          counts={{
            quotes: quotes.length,
            invoices: invoices.length,
            payments: payments.length,
            receipts: receipts.length,
          }}
        />

        <div className="overflow-x-auto">
          {activeTab === 'quotes' && (
            <QuotesSection
              quotes={quotes}
              onPreview={handlePreviewQuote}
              onDownload={handleDownloadQuote}
              onEdit={openEditQuoteModal}
              onConvert={handleConvertToInvoice}
              onDelete={handleDeleteQuote}
            />
          )}

          {activeTab === 'invoices' && (
            <InvoicesSection
              invoices={invoices}
              batchFilter={batchFilter}
              onBatchFilterChange={setBatchFilter}
              onClearBatchFilter={() => setBatchFilter('')}
              onPreview={handlePreviewInvoice}
              onEdit={openEditInvoiceModal}
              onDownload={handleDownloadInvoice}
              onDelete={handleDeleteInvoice}
            />
          )}

          {activeTab === 'payments' && (
            <PaymentsSection
              payments={payments}
              getPaymentClientName={getPaymentClientName}
              getPaymentCurrency={getPaymentCurrency}
              getPaymentAllocationSummary={getPaymentAllocationSummary}
              onEdit={openEditPaymentModal}
              onDelete={handleDeletePayment}
              onRecordPayment={openPaymentModal}
            />
          )}

          {activeTab === 'receipts' && (
            <ReceiptsSection
              receipts={receipts}
              onRecordPayment={openPaymentModal}
              onPreview={handleDownloadReceipt}
              onReissue={handleReissueReceipt}
              onDelete={handleDeleteReceipt}
            />
          )}

          {activeTab === 'statements' && (
            <StatementsSection
              selectedClient={selectedClient}
              statementDateFrom={statementDateFrom}
              statementDateTo={statementDateTo}
              clientOptions={clientOptions}
              onClientChange={setSelectedClient}
              onDateFromChange={setStatementDateFrom}
              onDateToChange={setStatementDateTo}
              onGenerate={handleGenerateStatement}
              onClear={handleClearStatement}
            />
          )}
        </div>
      </div>
    </div>
  );
};
