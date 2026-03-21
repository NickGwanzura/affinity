import React, { useEffect, useState } from 'react';
import { Client, CompanyDetails, Invoice, LineItem, Payment, Quote, Receipt, ReceiptItem, Vehicle } from '../types';
import { supabase } from '../services/supabaseService';
import {
  generateInvoicePDF,
  generateInvoicePDFAndDownload,
  generateQuotePDF,
  generateQuotePDFAndDownload,
  generateReceiptPDF,
  generateStatementPDF,
} from '../services/pdfService';
import { useConfirm } from './ConfirmModal';
import { useToast } from './Toast';

type PaymentAllocationDraft = {
  invoice_id: string;
  amount: string;
};

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

const clampDiscountPercentage = (value: number): number => Math.min(100, Math.max(0, value));

const calculateLineSubtotal = (item: Pick<LineItem, 'quantity' | 'unit_price'>): number =>
  (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);

const calculateLineDiscountAmount = (item: Pick<LineItem, 'quantity' | 'unit_price' | 'discount_percentage'>): number =>
  (calculateLineSubtotal(item) * clampDiscountPercentage(Number(item.discount_percentage) || 0)) / 100;

const calculateLineNetAmount = (
  item: Pick<LineItem, 'quantity' | 'unit_price' | 'discount_percentage'>
): number => Math.max(0, calculateLineSubtotal(item) - calculateLineDiscountAmount(item));

const calculateLineTaxAmount = (
  item: Pick<LineItem, 'quantity' | 'unit_price' | 'discount_percentage' | 'tax_rate'>
): number => (calculateLineNetAmount(item) * (Number(item.tax_rate) || 0)) / 100;

const calculateLineAmount = (
  item: Pick<LineItem, 'quantity' | 'unit_price' | 'discount_percentage' | 'tax_rate'>
): number => calculateLineNetAmount(item) + calculateLineTaxAmount(item);

const normalizeLineItemForForm = (item?: Partial<LineItem>): LineItem => {
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

const calculateDocumentSummary = (items: LineItem[]) =>
  items.reduce(
    (summary, item) => ({
      subtotal: summary.subtotal + calculateLineSubtotal(item),
      discount: summary.discount + calculateLineDiscountAmount(item),
      tax: summary.tax + calculateLineTaxAmount(item),
      total: summary.total + calculateLineAmount(item),
    }),
    { subtotal: 0, discount: 0, tax: 0, total: 0 }
  );

const normalizeDocumentCurrency = (currency?: string): 'USD' | 'GBP' =>
  String(currency || '')
    .trim()
    .toUpperCase() === 'GBP'
    ? 'GBP'
    : 'USD';

const formatMoney = (amount: number, currency?: string) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: normalizeDocumentCurrency(currency),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

const normalizeClientName = (value?: string) => (value || '').trim().toLowerCase();
const createEmptyPaymentAllocationDraft = (): PaymentAllocationDraft => ({
  invoice_id: '',
  amount: '',
});

export const Financials: React.FC = () => {
  const { showToast, ToastContainer } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const [activeTab, setActiveTab] = useState<'quotes' | 'invoices' | 'payments' | 'receipts' | 'statements'>('quotes');
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [statementDateFrom, setStatementDateFrom] = useState('');
  const [statementDateTo, setStatementDateTo] = useState('');
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);

  const [quoteForm, setQuoteForm] = useState({
    vehicle_id: '',
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
    client_name: '',
    currency: 'USD' as 'USD' | 'GBP',
    amount: '',
    method: 'Bank Transfer',
    notes: '',
  });
  const [paymentAllocationForm, setPaymentAllocationForm] = useState<PaymentAllocationDraft[]>([createEmptyPaymentAllocationDraft()]);

  const calculateTotal = (items: LineItem[]): number =>
    items.reduce((sum, item) => sum + calculateLineAmount(item), 0);

  const updateLineItem = (
    items: LineItem[],
    setter: React.Dispatch<React.SetStateAction<LineItem[]>>,
    index: number,
    field: keyof LineItem,
    value: string | number
  ) => {
    const updated = [...items];
    updated[index] = normalizeLineItemForForm({ ...updated[index], [field]: value });
    setter(updated);
  };

  const loadData = async (throwOnError = false) => {
    try {
      const [nextQuotes, nextInvoices, nextPayments, nextReceipts, nextVehicles, nextCompany, nextClients] = await Promise.all([
        supabase.getQuotes(),
        supabase.getInvoices(),
        supabase.getPayments(),
        supabase.getReceipts(),
        supabase.getVehicles(),
        supabase.getCompanyDetails(),
        supabase.getClients(),
      ]);

      setQuotes(nextQuotes);
      setInvoices(nextInvoices);
      setPayments(nextPayments);
      setReceipts(nextReceipts);
      setVehicles(nextVehicles);
      setCompany(nextCompany);
      setClients(nextClients);
      setLoading(false);
    } catch (error) {
      console.error('[Financials] loadData failed:', error);
      setLoading(false);
      if (throwOnError) {
        throw error;
      }
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const resetQuoteForm = () => {
    setQuoteForm({
      vehicle_id: '',
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

  const openEditQuoteModal = (quote: Quote) => {
    const normalizedItems =
      quote.items && quote.items.length > 0
        ? quote.items.map(item => normalizeLineItemForForm(item))
        : [normalizeLineItemForForm({ ...createEmptyLineItem(), description: quote.description || '', unit_price: quote.amount_usd || 0 })];

    setEditingQuote(quote);
    setQuoteForm({
      vehicle_id: quote.vehicle_id || '',
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
        : [normalizeLineItemForForm({ ...createEmptyLineItem(), description: quote.description || '', unit_price: quote.amount_usd || 0 })];

    setEditingInvoice(null);
    setInvoiceForm({
      invoice_kind: 'Standard',
      vehicle_id: quote.vehicle_id || '',
      client_name: quote.client_name || '',
      client_email: quote.client_email || '',
      client_address: quote.client_address || '',
      currency: normalizeDocumentCurrency(quote.currency),
      description: quote.description || '',
      notes: '',
      terms_and_conditions: 'Payment is due by the date specified above. Please include the invoice number with your payment.',
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
  };

  const resetPaymentForm = () => {
    setPaymentForm({
      client_name: '',
      currency: 'USD',
      amount: '',
      method: 'Bank Transfer',
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

    setEditingInvoice(invoice);
    setInvoiceForm({
      invoice_kind: invoice.invoice_kind || 'Standard',
      vehicle_id: invoice.vehicle_id || '',
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
      invoice => invoice.invoice_number === payment.reference_id || invoice.id === payment.reference_id
    );
    const allocationDrafts =
      payment.allocations && payment.allocations.length > 0
        ? payment.allocations.map(allocation => ({
            invoice_id: allocation.invoice_id,
            amount: allocation.amount_allocated.toFixed(2),
          }))
        : legacyInvoice
          ? [{ invoice_id: legacyInvoice.id, amount: payment.amount_usd.toFixed(2) }]
          : [createEmptyPaymentAllocationDraft()];

    setEditingPayment(payment);
    setPaymentForm({
      client_name: payment.client_name || linkedReceipt?.client_name || legacyInvoice?.client_name || '',
      currency: normalizeDocumentCurrency(payment.currency || linkedReceipt?.currency),
      amount: payment.amount_usd.toFixed(2),
      method: payment.method || 'Bank Transfer',
      notes: linkedReceipt?.notes || '',
    });
    setPaymentAllocationForm(allocationDrafts);
    setShowPaymentModal(true);
  };

  const openPreview = (blob: Blob, title: string) => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    const nextUrl = URL.createObjectURL(blob);
    setPreviewUrl(nextUrl);
    setPreviewTitle(title);
  };

  const closePreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setPreviewTitle('');
  };

  const buildReceiptItemsSnapshot = (
    allocatedInvoices: Invoice[],
    allocations: Array<{ invoice_id: string; amount_allocated: number; currency: 'USD' | 'GBP' }>,
    totalAmount: number,
    fallbackReference: string
  ): ReceiptItem[] => {
    if (allocatedInvoices.length === 1) {
      const invoice = allocatedInvoices[0];
      const invoiceItems = (invoice.items || []).map(item =>
        normalizeLineItemForForm({
          ...item,
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
        })
      ) as ReceiptItem[];
      const invoiceTotal = invoice.amount_usd || calculateTotal(invoiceItems);

      if (invoiceItems.length > 0 && Math.abs(invoiceTotal - totalAmount) < 0.01) {
        return invoiceItems;
      }
    }

    if (allocations.length > 0) {
      return allocations.map((allocation, index) => {
        const invoice = allocatedInvoices.find(candidate => candidate.id === allocation.invoice_id);
        return {
          ...normalizeLineItemForForm({
            description: invoice
              ? `Payment toward ${invoice.invoice_number}${invoice.description ? ` - ${invoice.description}` : ''}`
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
      normalizeLineItemForForm({
        description: fallbackReference || 'Recorded payment',
        quantity: 1,
        unit_price: totalAmount,
        discount_percentage: 0,
      }) as ReceiptItem,
    ];
  };

  const buildReceiptForPdf = (receipt: Receipt): Receipt => {
    if (receipt.items && receipt.items.length > 0) {
      return {
        ...receipt,
        items: receipt.items.map(item => ({
          ...normalizeLineItemForForm(item),
          invoice_id: item.invoice_id,
          invoice_number: item.invoice_number,
        }) as ReceiptItem),
      };
    }

    const linkedPayment = receipt.payment_id ? payments.find(payment => payment.id === receipt.payment_id) : undefined;
    const linkedAllocations =
      linkedPayment?.allocations?.map(allocation => ({
        invoice_id: allocation.invoice_id,
        amount_allocated: allocation.amount_allocated,
        currency: normalizeDocumentCurrency(allocation.currency),
      })) || [];
    const allocatedInvoices = linkedAllocations
      .map(allocation => invoices.find(invoice => invoice.id === allocation.invoice_id))
      .filter(Boolean) as Invoice[];

    if (allocatedInvoices.length > 0 || linkedAllocations.length > 0) {
      return {
        ...receipt,
        items: buildReceiptItemsSnapshot(
          allocatedInvoices,
          linkedAllocations,
          receipt.amount_received,
          receipt.reference_number || 'Recorded payment'
        ),
      };
    }

    const linkedInvoice = receipt.invoice_id ? invoices.find(invoice => invoice.id === receipt.invoice_id) : undefined;
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
          linkedInvoice.invoice_number
        ),
      };
    }

    return {
      ...receipt,
      items: buildReceiptItemsSnapshot([], [], receipt.amount_received, receipt.reference_number || 'Recorded payment'),
    };
  };

  const handleCreateQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = quoteLineItems
      .filter(item => item.description.trim() && item.quantity > 0)
      .map(item => normalizeLineItemForForm(item));

    if (validItems.length === 0) {
      showToast('Please add at least one line item with a description', 'warning');
      return;
    }

    try {
      const payload = {
        vehicle_id: quoteForm.vehicle_id || undefined,
        client_name: quoteForm.client_name,
        client_email: quoteForm.client_email,
        client_address: quoteForm.client_address,
        currency: quoteForm.currency,
        amount_usd: calculateTotal(validItems),
        description: quoteForm.description,
        valid_until: quoteForm.valid_until,
        status: quoteForm.status,
        items: validItems.map((item, index) => ({ ...item, line_number: index + 1 })),
      };

      if (editingQuote) {
        await supabase.updateQuote(editingQuote.id, payload);
      } else {
        await supabase.createQuote(payload);
      }

      closeQuoteModal();
      await loadData(true);
      showToast(editingQuote ? 'Quote updated successfully!' : 'Quote created successfully!', 'success');
    } catch (error: any) {
      console.error('[Financials] handleCreateQuote failed:', error);
      showToast(error?.message || 'Failed to save quote', 'error');
    }
  };

  const handleSubmitInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = invoiceLineItems
      .filter(item => item.description.trim() && item.quantity > 0)
      .map(item => normalizeLineItemForForm(item));

    if (validItems.length === 0) {
      showToast('Please add at least one line item with a description', 'warning');
      return;
    }

    try {
      const payload = {
        invoice_kind: invoiceForm.invoice_kind,
        vehicle_id: invoiceForm.vehicle_id || undefined,
        client_name: invoiceForm.client_name,
        client_email: invoiceForm.client_email,
        client_address: invoiceForm.client_address,
        amount_usd: calculateTotal(validItems),
        currency: invoiceForm.currency,
        description: invoiceForm.description,
        notes: invoiceForm.notes,
        terms_and_conditions: invoiceForm.terms_and_conditions,
        due_date: invoiceForm.due_date,
        status: invoiceForm.status || 'Sent',
        batch: invoiceForm.batch || undefined,
        items: validItems.map((item, index) => ({ ...item, line_number: index + 1 })),
      };

      if (editingInvoice) {
        await supabase.updateInvoice(editingInvoice.id, payload);
      } else {
        await supabase.createInvoice(payload);
      }

      closeInvoiceModal();
      await loadData(true);
      showToast(editingInvoice ? 'Invoice updated successfully!' : 'Invoice created successfully!', 'success');
    } catch (error: any) {
      console.error('[Financials] handleSubmitInvoice failed:', error);
      showToast(error?.message || `Failed to ${editingInvoice ? 'update' : 'create'} invoice`, 'error');
    }
  };

  const handlePreviewQuote = async (quote: Quote) => {
    if (!company) {
      showToast('Company details are not loaded yet', 'warning');
      return;
    }

    try {
      const blob = await generateQuotePDF(quote, company);
      openPreview(blob, `Quote ${quote.quote_number}`);
    } catch (error) {
      console.error('Error previewing quote PDF:', error);
      showToast('Failed to preview quote PDF', 'error');
    }
  };

  const handlePreviewInvoice = async (invoice: Invoice) => {
    if (!company) {
      showToast('Company details are not loaded yet', 'warning');
      return;
    }

    try {
      const blob = await generateInvoicePDF(invoice, company);
      openPreview(blob, `Invoice ${invoice.invoice_number}`);
    } catch (error) {
      console.error('Error previewing invoice PDF:', error);
      showToast('Failed to preview invoice PDF', 'error');
    }
  };

  const handleDownloadQuote = async (quote: Quote) => {
    if (!company) {
      showToast('Company details are not loaded yet', 'warning');
      return;
    }

    try {
      await generateQuotePDFAndDownload(quote, company);
    } catch (error) {
      console.error('Error generating quote PDF:', error);
      showToast('Failed to generate quote PDF', 'error');
    }
  };

  const handleDownloadInvoice = async (invoice: Invoice) => {
    if (!company) {
      showToast('Company details are not loaded yet', 'warning');
      return;
    }

    try {
      await generateInvoicePDFAndDownload(invoice, company);
    } catch (error) {
      console.error('Error generating invoice PDF:', error);
      showToast('Failed to generate invoice PDF', 'error');
    }
  };

  const handleDownloadReceipt = async (receipt: Receipt) => {
    if (!company) {
      showToast('Company details are not loaded yet', 'warning');
      return;
    }

    try {
      const blob = await generateReceiptPDF(buildReceiptForPdf(receipt), company);
      openPreview(blob, `Receipt ${receipt.receipt_number}`);
    } catch (error) {
      console.error('Error generating receipt PDF:', error);
      showToast('Failed to generate receipt PDF', 'error');
    }
  };

  const handleRecordPayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const clientName = paymentForm.client_name.trim();
    const amount = parseFloat(paymentForm.amount) || 0;
    const method = paymentForm.method.trim();
    const notes = paymentForm.notes.trim();

    if (!clientName) {
      showToast('Please select a client', 'warning');
      return;
    }

    if (!paymentForm.currency) {
      showToast('Please select a currency', 'warning');
      return;
    }

    if (amount <= 0) {
      showToast('Please enter a payment amount greater than zero', 'warning');
      return;
    }

    const selectedCurrency = paymentForm.currency || 'USD';
    const draftedAllocations = paymentAllocationForm
      .map(allocation => ({
        invoice_id: allocation.invoice_id,
        amount_allocated: parseFloat(allocation.amount) || 0,
      }))
      .filter(allocation => allocation.invoice_id || allocation.amount_allocated > 0);

    const invalidAllocation = draftedAllocations.find(
      allocation => !allocation.invoice_id || allocation.amount_allocated <= 0
    );
    if (invalidAllocation) {
      showToast('Each allocation row needs both an invoice and an amount', 'warning');
      return;
    }

    const mergedAllocations = Array.from(
      draftedAllocations.reduce((acc, allocation) => {
        acc.set(allocation.invoice_id, (acc.get(allocation.invoice_id) || 0) + allocation.amount_allocated);
        return acc;
      }, new Map<string, number>())
    ).map(([invoice_id, amount_allocated]) => ({
      invoice_id,
      amount_allocated,
      currency: selectedCurrency,
    }));

    const totalAllocated = mergedAllocations.reduce((sum, allocation) => sum + allocation.amount_allocated, 0);
    if (totalAllocated - amount > 0.001) {
      showToast('Allocated total cannot exceed the payment amount', 'warning');
      return;
    }

    const allocatedInvoices = mergedAllocations
      .map(allocation => invoices.find(invoice => invoice.id === allocation.invoice_id))
      .filter(Boolean) as Invoice[];
    const primaryInvoice = allocatedInvoices[0];
    const isMultiInvoicePayment = allocatedInvoices.length > 1;
    const linkedReceipt = editingPayment
      ? receipts.find(receipt => receipt.payment_id === editingPayment.id)
      : undefined;
    const referenceId =
      allocatedInvoices.length === 1
        ? primaryInvoice.invoice_number
        : allocatedInvoices.length > 1
          ? `ALLOC-${Date.now()}`
          : `PAY-${Date.now()}`;

    try {
      const payment = editingPayment
        ? await supabase.updatePayment(editingPayment.id, {
            reference_id: referenceId,
            client_name: primaryInvoice?.client_name || clientName,
            type: 'Inbound',
            amount_usd: amount,
            currency: selectedCurrency,
            method,
            date: editingPayment.date,
          })
        : await supabase.addPayment({
            reference_id: referenceId,
            client_name: primaryInvoice?.client_name || clientName,
            type: 'Inbound',
            amount_usd: amount,
            currency: selectedCurrency,
            method,
            date: new Date().toISOString(),
          });

      await supabase.replacePaymentAllocations(payment.id, mergedAllocations);

      const receiptItems = buildReceiptItemsSnapshot(
        allocatedInvoices,
        mergedAllocations,
        amount,
        referenceId
      );

      const receiptPayload = {
        invoice_id: allocatedInvoices.length === 1 ? primaryInvoice.id : undefined,
        payment_id: payment.id,
        client_name: primaryInvoice?.client_name || clientName,
        client_email: primaryInvoice?.client_email,
        client_address: primaryInvoice?.client_address,
        amount_received: amount,
        currency: selectedCurrency,
        payment_method: method,
        payment_date: payment.date,
        reference_number:
          allocatedInvoices.length === 1
            ? primaryInvoice.invoice_number
            : isMultiInvoicePayment
              ? allocatedInvoices.map(invoice => invoice.invoice_number).join(', ')
              : payment.reference_id,
        notes:
          [
            notes,
            isMultiInvoicePayment
              ? `Allocated across ${allocatedInvoices.length} invoices.`
              : null,
          ]
            .filter(Boolean)
            .join(' ')
            || undefined,
        items: receiptItems,
        batch: primaryInvoice?.batch || undefined,
      };

      const receipt = linkedReceipt
        ? await supabase.updateReceipt(linkedReceipt.id, receiptPayload)
        : await supabase.createReceipt(receiptPayload);

      await loadData(true);
      closePaymentModal();
      showToast(editingPayment ? 'Payment updated successfully!' : 'Payment recorded and receipt created!', 'success');

      if (company) {
        try {
          const blob = await generateReceiptPDF(
            {
              ...receipt,
              items: receipt.items || receiptItems,
            },
            company
          );
          openPreview(blob, `Receipt ${receipt.receipt_number}`);
        } catch (pdfError) {
          console.error('Receipt download failed:', pdfError);
          showToast('Payment saved, but receipt generation failed', 'warning');
        }
      }
    } catch (error: any) {
      console.error('[Financials] handleRecordPayment failed:', error);
      showToast(error?.message || 'Failed to record payment', 'error');
    }
  };

  const handleGenerateStatement = async () => {
    if (!selectedClient || !company) {
      showToast('Please select a client first', 'warning');
      return;
    }

    if (statementDateFrom && statementDateTo && new Date(statementDateFrom) > new Date(statementDateTo)) {
      showToast('Statement start date must be before the end date', 'warning');
      return;
    }

    const normalizedClient = normalizeClientName(selectedClient);
    const isWithinStatementRange = (value?: string) => {
      if (!value) return false;
      const current = new Date(value).getTime();
      const start = statementDateFrom ? new Date(`${statementDateFrom}T00:00:00`).getTime() : null;
      const end = statementDateTo ? new Date(`${statementDateTo}T23:59:59`).getTime() : null;

      if (start !== null && current < start) return false;
      if (end !== null && current > end) return false;
      return true;
    };

    const clientInvoices = invoices.filter(
      invoice =>
        normalizeClientName(invoice.client_name) === normalizedClient &&
        isWithinStatementRange(invoice.created_at)
    );
    if (clientInvoices.length === 0) {
      showToast('No invoices found for this client in the selected date range', 'warning');
      return;
    }

    const invoiceReferences = new Set(
      clientInvoices.flatMap(invoice => [invoice.invoice_number, invoice.id]).filter(Boolean)
    );
    const clientInvoiceIds = new Set(clientInvoices.map(invoice => invoice.id));
    const receiptLinkedPaymentIds = new Set(
      receipts
        .filter(receipt => normalizeClientName(receipt.client_name) === normalizedClient && receipt.payment_id)
        .map(receipt => receipt.payment_id as string)
    );
    const receiptLinkedReferences = new Set(
      receipts
        .filter(receipt => normalizeClientName(receipt.client_name) === normalizedClient)
        .map(receipt => receipt.reference_number)
        .filter(Boolean)
    );
    const clientPayments = Array.from(
      new Map(
        payments
          .filter(
            payment =>
              isWithinStatementRange(payment.date) &&
              (
                (payment.allocations || []).some(allocation => clientInvoiceIds.has(allocation.invoice_id)) ||
                normalizeClientName(payment.client_name) === normalizedClient ||
                invoiceReferences.has(payment.reference_id) ||
                receiptLinkedPaymentIds.has(payment.id) ||
                receiptLinkedReferences.has(payment.reference_id)
              )
          )
          .map(payment => [payment.id, payment])
      ).values()
    ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const sortedDates = [...clientInvoices.map(invoice => invoice.created_at), ...clientPayments.map(payment => payment.date)]
      .filter(Boolean)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    try {
      const paymentCurrencyMap = Object.fromEntries(
        clientPayments
          .filter(payment => payment.id && payment.currency)
          .map(payment => [payment.id, payment.currency as 'USD' | 'GBP'])
      );
      const statementData = {
        client_name: clientInvoices[0]?.client_name || selectedClient,
        client_email: clientInvoices[0]?.client_email,
        client_address: clientInvoices[0]?.client_address,
        invoices: clientInvoices,
        payments: clientPayments,
        paymentCurrencyMap,
        startDate: statementDateFrom || sortedDates[0] || new Date().toISOString(),
        endDate: statementDateTo || sortedDates[sortedDates.length - 1] || new Date().toISOString(),
      };
      const blob = await generateStatementPDF(statementData, company);
      openPreview(blob, `Statement ${selectedClient}`);
      showToast('Statement generated successfully!', 'success');
    } catch (error) {
      console.error('Error generating statement PDF:', error);
      showToast('Failed to generate statement', 'error');
    }
  };

  const handleDeleteQuote = async (quote: Quote) => {
    const approved = await confirm({
      title: 'Delete Quote',
      message: `Delete quote ${quote.quote_number} for ${quote.client_name}? This cannot be undone.`,
      confirmLabel: 'Delete Quote',
      confirmVariant: 'danger',
    });

    if (!approved) {
      return;
    }

    const key = `quote:${quote.id}`;
    setDeletingKey(key);
    try {
      await supabase.deleteQuote(quote.id);
      await loadData(true);
      showToast('Quote deleted successfully', 'success');
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

    if (!approved) {
      return;
    }

    const key = `invoice:${invoice.id}`;
    setDeletingKey(key);
    try {
      await supabase.deleteInvoice(invoice.id);
      await loadData(true);
      showToast('Invoice deleted successfully', 'success');
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

    if (!approved) {
      return;
    }

    const key = `payment:${payment.id}`;
    setDeletingKey(key);
    try {
      await supabase.deletePayment(payment.id);
      await loadData(true);
      showToast('Payment deleted successfully', 'success');
    } catch (error: any) {
      console.error('Failed to delete payment:', error);
      showToast(error?.message || 'Failed to delete payment', 'error');
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

    if (!approved) {
      return;
    }

    setSelectedClient('');
    setStatementDateFrom('');
    setStatementDateTo('');
    showToast('Statement selection cleared', 'success');
  };

  const handleReissueReceipt = async (receipt: Receipt) => {
    if (!company) {
      showToast('Company details are not loaded yet', 'warning');
      return;
    }

    try {
      const blob = await generateReceiptPDF(buildReceiptForPdf(receipt), company);
      openPreview(blob, `Receipt ${receipt.receipt_number}`);
      showToast('Receipt reissued successfully. Review and download the regenerated PDF.', 'success');
    } catch (error) {
      console.error('Error reissuing receipt PDF:', error);
      showToast('Failed to reissue receipt PDF', 'error');
    }
  };

  const clientOptions = Array.from(
    new Set(
      [...quotes.map(quote => quote.client_name), ...invoices.map(invoice => invoice.client_name), ...receipts.map(receipt => receipt.client_name)].filter(Boolean)
    )
  ).sort();
  const receiptByPaymentId = new Map(
    receipts
      .filter(receipt => receipt.payment_id)
      .map(receipt => [receipt.payment_id as string, receipt])
  );
  const invoiceByReference = new Map<string, Invoice>();
  invoices.forEach(invoice => {
    invoiceByReference.set(invoice.id, invoice);
    invoiceByReference.set(invoice.invoice_number, invoice);
  });
  const getPaymentAllocationAmountForInvoice = (payment: Payment, invoiceId: string): number =>
    (payment.allocations || [])
      .filter(allocation => allocation.invoice_id === invoiceId)
      .reduce((sum, allocation) => sum + allocation.amount_allocated, 0);
  const getPaymentCurrency = (payment: Payment): 'USD' | 'GBP' =>
    normalizeDocumentCurrency(
      payment.currency || receiptByPaymentId.get(payment.id)?.currency || invoiceByReference.get(payment.reference_id)?.currency || 'USD'
    );
  const getPaymentClientName = (payment: Payment): string =>
    payment.client_name || receiptByPaymentId.get(payment.id)?.client_name || invoiceByReference.get(payment.reference_id)?.client_name || 'Unlinked';
  const getInvoicePaidAmount = (invoice: Invoice): number =>
    payments.reduce((sum, payment) => {
      const paymentCurrency = getPaymentCurrency(payment);
      const allocationAmount = getPaymentAllocationAmountForInvoice(payment, invoice.id);

      if ((payment.allocations?.length || 0) > 0) {
        return allocationAmount > 0 && paymentCurrency === normalizeDocumentCurrency(invoice.currency)
          ? sum + allocationAmount
          : sum;
      }

      const matchesLegacyReference =
        payment.reference_id === invoice.invoice_number ||
        payment.reference_id === invoice.id;

      if (!matchesLegacyReference || paymentCurrency !== normalizeDocumentCurrency(invoice.currency)) {
        return sum;
      }

      return sum + payment.amount_usd;
    }, 0);
  const getInvoiceOutstandingAmount = (invoice: Invoice): number =>
    Math.max(0, invoice.amount_usd - getInvoicePaidAmount(invoice));
  const paymentAllocationCandidates = paymentForm.client_name
    ? invoices
        .filter(
          invoice =>
            normalizeClientName(invoice.client_name) === normalizeClientName(paymentForm.client_name) &&
            normalizeDocumentCurrency(invoice.currency) === normalizeDocumentCurrency(paymentForm.currency)
        )
        .map(invoice => ({
          invoice,
          outstandingAmount: getInvoiceOutstandingAmount(invoice),
        }))
        .filter(({ outstandingAmount }) => outstandingAmount > 0)
        .sort((a, b) => new Date(a.invoice.due_date).getTime() - new Date(b.invoice.due_date).getTime())
    : [];
  const selectedPaymentAllocationInvoiceIds = new Set(
    paymentAllocationForm.map(allocation => allocation.invoice_id).filter(Boolean)
  );
  const getPaymentAllocationSummary = (payment: Payment): string | null => {
    if (!payment.allocations || payment.allocations.length === 0) {
      return null;
    }

    return payment.allocations
      .map(allocation => {
        const invoice = invoices.find(candidate => candidate.id === allocation.invoice_id);
        return `${invoice?.invoice_number || allocation.invoice_id.slice(0, 8)} ${formatMoney(allocation.amount_allocated, allocation.currency)}`;
      })
      .join(' | ');
  };
  const quoteTotals = calculateDocumentSummary(quoteLineItems);
  const invoiceTotals = calculateDocumentSummary(invoiceLineItems);

  if (loading) {
    return <div className="animate-pulse flex h-64 items-center justify-center">Loading Financial Records...</div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <ToastContainer />
      <ConfirmDialog />

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900">Finance</h2>
          <p className="font-medium text-zinc-500">Quotes, Billing, Receipts, Statements</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button
            onClick={openCreateInvoiceModal}
            className="flex-1 sm:flex-none items-center justify-center gap-2 rounded-xl bg-green-600 px-6 py-4 sm:py-2.5 text-base sm:text-sm font-bold text-white shadow-xl shadow-green-100 transition-all hover:bg-green-700 active:scale-[0.98]"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Invoice
          </button>
          <button
            onClick={() => setShowQuoteModal(true)}
            className="flex-1 sm:flex-none items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-4 sm:py-2.5 text-base sm:text-sm font-bold text-white shadow-xl shadow-blue-100 transition-all hover:bg-blue-700"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Quote
          </button>
        </div>
      </div>

      {showQuoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={closeQuoteModal} />
          <div className="relative max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-2xl sm:rounded-3xl bg-white p-4 sm:p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h3 className="text-lg sm:text-2xl font-black text-zinc-900">
                {editingQuote ? `Edit Quote` : 'Create Quote'}
              </h3>
              <button
                type="button"
                onClick={closeQuoteModal}
                className="lg:hidden p-2 -mr-2 text-zinc-400 hover:text-zinc-600"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateQuote} className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="col-span-1 sm:col-span-2">
                  <label className="text-sm font-semibold text-zinc-700">Vehicle (Optional)</label>
                  <select
                    value={quoteForm.vehicle_id}
                    onChange={e => setQuoteForm({ ...quoteForm, vehicle_id: e.target.value })}
                    className="w-full rounded-xl border border-zinc-200 px-3 py-3 sm:px-4 sm:py-3 text-sm sm:text-base outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">No Vehicle</option>
                    {vehicles.map(vehicle => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.make_model} ({vehicle.vin_number})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-zinc-700">Client *</label>
                  <select
                    required
                    value={clients.find(c => c.name === quoteForm.client_name)?.id ?? ''}
                    onChange={e => {
                      const client = clients.find(c => c.id === e.target.value);
                      setQuoteForm({
                        ...quoteForm,
                        client_name: client?.name ?? '',
                        client_email: client?.email ?? '',
                        client_address: client?.address ?? '',
                      });
                    }}
                    className="w-full rounded-xl border border-zinc-200 px-3 py-3 sm:px-4 sm:py-3 text-sm sm:text-base outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select…</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-zinc-700">Email</label>
                  <input
                    type="email"
                    value={quoteForm.client_email}
                    onChange={e => setQuoteForm({ ...quoteForm, client_email: e.target.value })}
                    className="w-full rounded-xl border border-zinc-200 px-3 py-3 sm:px-4 sm:py-3 text-sm sm:text-base outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <label className="text-sm font-semibold text-zinc-700">Address</label>
                  <textarea
                    rows={2}
                    value={quoteForm.client_address}
                    onChange={e => setQuoteForm({ ...quoteForm, client_address: e.target.value })}
                    className="w-full rounded-xl border border-zinc-200 px-3 py-3 sm:px-4 sm:py-3 text-sm sm:text-base outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-zinc-700">Valid Until</label>
                  <input
                    type="date"
                    value={quoteForm.valid_until}
                    onChange={e => setQuoteForm({ ...quoteForm, valid_until: e.target.value })}
                    className="w-full rounded-xl border border-zinc-200 px-3 py-3 sm:px-4 sm:py-3 text-sm sm:text-base outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-zinc-700">Currency</label>
                  <select
                    value={quoteForm.currency}
                    onChange={e => setQuoteForm({ ...quoteForm, currency: e.target.value as 'USD' | 'GBP' })}
                    className="w-full rounded-xl border border-zinc-200 px-3 py-3 sm:px-4 sm:py-3 text-sm sm:text-base outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <label className="text-sm font-semibold text-zinc-700">Notes</label>
                  <input
                    value={quoteForm.description}
                    onChange={e => setQuoteForm({ ...quoteForm, description: e.target.value })}
                    placeholder="Additional notes..."
                    className="w-full rounded-xl border border-zinc-200 px-3 py-3 sm:px-4 sm:py-3 text-sm sm:text-base outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2 mt-2 border-t pt-4">
                  <div className="mb-3 flex items-center justify-between">
                    <label className="text-sm font-bold text-zinc-800">Line Items</label>
                    <button
                      type="button"
                      onClick={() => setQuoteLineItems([...quoteLineItems, createEmptyLineItem()])}
                      className="rounded-lg bg-blue-100 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-200"
                    >
                      + Add Line
                    </button>
                  </div>

                  <div className="space-y-3">
                    {quoteLineItems.map((item, index) => (
                      <div key={index} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                        <div className="grid grid-cols-12 items-end gap-2">
                          <div className="col-span-4">
                            <label className="text-xs text-zinc-500">Description</label>
                            <input
                              required
                              value={item.description}
                              onChange={e =>
                                updateLineItem(quoteLineItems, setQuoteLineItems, index, 'description', e.target.value)
                              }
                              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="col-span-1">
                            <label className="text-xs text-zinc-500">Qty</label>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={e =>
                                updateLineItem(
                                  quoteLineItems,
                                  setQuoteLineItems,
                                  index,
                                  'quantity',
                                  parseFloat(e.target.value) || 1
                                )
                              }
                              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-xs text-zinc-500">Unit Price</label>
                            <input
                              type="number"
                              step="0.01"
                              value={item.unit_price}
                              onChange={e =>
                                updateLineItem(
                                  quoteLineItems,
                                  setQuoteLineItems,
                                  index,
                                  'unit_price',
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-xs text-zinc-500">Discount %</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={item.discount_percentage || 0}
                              onChange={e =>
                                updateLineItem(
                                  quoteLineItems,
                                  setQuoteLineItems,
                                  index,
                                  'discount_percentage',
                                  clampDiscountPercentage(parseFloat(e.target.value) || 0)
                                )
                              }
                              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-xs text-zinc-500">Amount</label>
                            <div className="rounded-lg bg-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-700">
                              {formatMoney(calculateLineAmount(item), quoteForm.currency)}
                            </div>
                          </div>
                          <div className="col-span-1 flex justify-end">
                            {quoteLineItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setQuoteLineItems(quoteLineItems.filter((_, lineIndex) => lineIndex !== index))}
                                className="w-full rounded-lg p-2 sm:p-2 text-red-500 hover:bg-red-50 touch-manipulation"
                              >
                                <svg className="mx-auto h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                        {(item.discount_percentage || 0) > 0 && (
                          <p className="mt-2 text-xs text-zinc-500">
                            Discount applied: {formatMoney(calculateLineDiscountAmount(item), quoteForm.currency)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex justify-end border-t pt-3">
                    <div className="text-right">
                      <div className="space-y-1 text-sm text-zinc-500">
                        <div>Subtotal: {formatMoney(quoteTotals.subtotal, quoteForm.currency)}</div>
                        <div>Discounts: {formatMoney(quoteTotals.discount, quoteForm.currency)}</div>
                        <div>Tax: {formatMoney(quoteTotals.tax, quoteForm.currency)}</div>
                      </div>
                      <div className="mt-2">
                        <span className="text-sm text-zinc-500">Total:</span>
                        <span className="ml-3 text-2xl font-black text-zinc-900">
                          {formatMoney(quoteTotals.total, quoteForm.currency)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="sticky bottom-0 -mx-4 sm:mx-0 -mb-4 sm:mb-0 bg-white pt-4 sm:pt-4 border-t border-zinc-100 mt-4 sm:mt-4">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={closeQuoteModal}
                    className="flex-1 rounded-xl border border-zinc-200 px-4 py-3 sm:py-3 text-sm font-bold text-zinc-500 hover:bg-zinc-50 touch-manipulation"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 rounded-xl bg-blue-600 px-4 py-3 sm:py-3 text-sm font-bold text-white hover:bg-blue-700 touch-manipulation">
                    {editingQuote ? 'Save' : 'Create'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={closeInvoiceModal} />
          <div className="relative max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-2xl sm:rounded-3xl bg-white p-4 sm:p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-4 sm:mb-2">
              <h3 className="text-lg sm:text-2xl font-black text-zinc-900">
                {editingInvoice ? `Edit Invoice ${editingInvoice.invoice_number}` : 'Create Invoice'}
              </h3>
              <button
                type="button"
                onClick={closeInvoiceModal}
                className="lg:hidden p-2 -mr-2 text-zinc-400 hover:text-zinc-600"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="mb-4 sm:mb-6 text-xs sm:text-sm text-zinc-500">
              {editingInvoice
                ? 'Update the invoice details, currency, status, notes, and line items while keeping the existing invoice number.'
                : 'Build a polished customer invoice with itemized charges, tailored notes, and clear payment terms.'}
            </p>
            <form onSubmit={handleSubmitInvoice} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {editingInvoice && (
                  <div className="col-span-2">
                    <label className="text-sm font-semibold text-zinc-700">Invoice Number</label>
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 font-mono text-sm font-bold text-green-700">
                      {editingInvoice.invoice_number}
                    </div>
                  </div>
                )}
                <div className="col-span-1 sm:col-span-2">
                  <label className="text-sm font-semibold text-zinc-700">Vehicle (Optional)</label>
                  <select
                    value={invoiceForm.vehicle_id}
                    onChange={e => setInvoiceForm({ ...invoiceForm, vehicle_id: e.target.value })}
                    className="w-full rounded-xl border border-zinc-200 px-3 py-3 sm:px-4 sm:py-3 text-sm sm:text-base outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">No Vehicle (Custom Invoice)</option>
                    {vehicles.map(vehicle => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.make_model} ({vehicle.vin_number})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-1 sm:col-span-1">
                  <label className="text-sm font-semibold text-zinc-700">Client *</label>
                  <select
                    required
                    value={clients.find(c => c.name === invoiceForm.client_name)?.id ?? ''}
                    onChange={e => {
                      const client = clients.find(c => c.id === e.target.value);
                      setInvoiceForm({
                        ...invoiceForm,
                        client_name: client?.name ?? '',
                        client_email: client?.email ?? '',
                        client_address: client?.address ?? '',
                      });
                    }}
                    className="w-full rounded-xl border border-zinc-200 px-3 py-3 sm:px-4 sm:py-3 text-sm sm:text-base outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Select…</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ''}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-1 sm:col-span-1">
                  <label className="text-sm font-semibold text-zinc-700">Email</label>
                  <input
                    type="email"
                    value={invoiceForm.client_email}
                    onChange={e => setInvoiceForm({ ...invoiceForm, client_email: e.target.value })}
                    className="w-full rounded-xl border border-zinc-200 px-3 py-3 sm:px-4 sm:py-3 text-sm sm:text-base outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <label className="text-sm font-semibold text-zinc-700">Address</label>
                  <textarea
                    rows={2}
                    value={invoiceForm.client_address}
                    onChange={e => setInvoiceForm({ ...invoiceForm, client_address: e.target.value })}
                    className="w-full rounded-xl border border-zinc-200 px-3 py-3 sm:px-4 sm:py-3 text-sm sm:text-base outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div className="col-span-1 sm:col-span-1">
                  <label className="text-sm font-semibold text-zinc-700">Type</label>
                  <select
                    value={invoiceForm.invoice_kind}
                    onChange={e =>
                      setInvoiceForm({
                        ...invoiceForm,
                        invoice_kind: e.target.value as 'Standard' | 'Deposit' | 'Final',
                      })
                    }
                    className="w-full rounded-xl border border-zinc-200 px-3 py-3 sm:px-4 sm:py-3 text-sm sm:text-base outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="Standard">Standard</option>
                    <option value="Deposit">Deposit</option>
                    <option value="Final">Final</option>
                  </select>
                </div>
                <div className="col-span-1 sm:col-span-1">
                  <label className="text-sm font-semibold text-zinc-700">Currency</label>
                  <select
                    value={invoiceForm.currency}
                    onChange={e => setInvoiceForm({ ...invoiceForm, currency: e.target.value as 'USD' | 'GBP' })}
                    className="w-full rounded-xl border border-zinc-200 px-3 py-3 sm:px-4 sm:py-3 text-sm sm:text-base outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
                <div className="col-span-1 sm:col-span-1">
                  <label className="text-sm font-semibold text-zinc-700">Due Date *</label>
                  <input
                    type="date"
                    required
                    value={invoiceForm.due_date}
                    onChange={e => setInvoiceForm({ ...invoiceForm, due_date: e.target.value })}
                    className="w-full rounded-xl border border-zinc-200 px-3 py-3 sm:px-4 sm:py-3 text-sm sm:text-base outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div className="col-span-1 sm:col-span-1">
                  <label className="text-sm font-semibold text-zinc-700">Batch</label>
                  <input
                    type="text"
                    placeholder="MAR-2026"
                    value={invoiceForm.batch}
                    onChange={e => setInvoiceForm({ ...invoiceForm, batch: e.target.value })}
                    className="w-full rounded-xl border border-zinc-200 px-3 py-3 sm:px-4 sm:py-3 text-sm sm:text-base outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <label className="text-sm font-semibold text-zinc-700">Status</label>
                  <select
                    value={invoiceForm.status}
                    onChange={e => setInvoiceForm({ ...invoiceForm, status: e.target.value as Invoice['status'] })}
                    className="w-full rounded-xl border border-zinc-200 px-3 py-3 sm:px-4 sm:py-3 text-sm sm:text-base outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Sent">Sent</option>
                    <option value="Paid">Paid</option>
                    <option value="Overdue">Overdue</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <label className="text-sm font-semibold text-zinc-700">Summary</label>
                  <input
                    value={invoiceForm.description}
                    onChange={e => setInvoiceForm({ ...invoiceForm, description: e.target.value })}
                    placeholder="Short invoice summary..."
                    className="w-full rounded-xl border border-zinc-200 px-3 py-3 sm:px-4 sm:py-3 text-sm sm:text-base outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <label className="text-sm font-semibold text-zinc-700">Notes</label>
                  <textarea
                    rows={2}
                    value={invoiceForm.notes}
                    onChange={e => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
                    placeholder="Optional notes..."
                    className="w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50/70 px-3 py-3 sm:px-4 sm:py-3 text-sm sm:text-base outline-none focus:bg-white focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <label className="text-sm font-semibold text-zinc-700">Terms</label>
                  <textarea
                    rows={2}
                    value={invoiceForm.terms_and_conditions}
                    onChange={e => setInvoiceForm({ ...invoiceForm, terms_and_conditions: e.target.value })}
                    placeholder="Payment terms..."
                    className="w-full resize-none rounded-xl border border-emerald-200 bg-emerald-50/50 px-3 py-3 sm:px-4 sm:py-3 text-sm sm:text-base outline-none focus:bg-white focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div className="col-span-1 sm:col-span-2 mt-2 border-t pt-4">
                  <div className="mb-3 flex items-center justify-between">
                    <label className="text-sm font-bold text-zinc-800">Line Items</label>
                    <button
                      type="button"
                      onClick={() => setInvoiceLineItems([...invoiceLineItems, createEmptyLineItem()])}
                      className="rounded-lg bg-green-100 px-3 py-2 text-xs font-bold text-green-700 hover:bg-green-200"
                    >
                      + Add
                    </button>
                  </div>

                  <div className="space-y-3">
                    {invoiceLineItems.map((item, index) => (
                      <div key={index} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                        <div className="grid grid-cols-2 md:grid-cols-12 gap-2 sm:gap-3">
                          <div className="col-span-2 md:col-span-6">
                            <label className="text-xs text-zinc-500">Description</label>
                            <input
                              required
                              value={item.description}
                              onChange={e =>
                                updateLineItem(invoiceLineItems, setInvoiceLineItems, index, 'description', e.target.value)
                              }
                              className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 sm:py-2 text-sm outline-none focus:ring-2 focus:ring-green-500"
                            />
                          </div>
                          <div className="col-span-1 md:col-span-2">
                            <label className="text-xs text-zinc-500">Qty</label>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={e =>
                                updateLineItem(
                                  invoiceLineItems,
                                  setInvoiceLineItems,
                                  index,
                                  'quantity',
                                  parseFloat(e.target.value) || 1
                                )
                              }
                              className="w-full rounded-lg border border-zinc-200 px-2 py-2.5 sm:py-2 text-sm outline-none focus:ring-2 focus:ring-green-500"
                            />
                          </div>
                          <div className="col-span-1 md:col-span-2">
                            <label className="text-xs text-zinc-500">Price</label>
                            <input
                              type="number"
                              step="0.01"
                              value={item.unit_price}
                              onChange={e =>
                                updateLineItem(
                                  invoiceLineItems,
                                  setInvoiceLineItems,
                                  index,
                                  'unit_price',
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-full rounded-lg border border-zinc-200 px-2 py-2.5 sm:py-2 text-sm outline-none focus:ring-2 focus:ring-green-500"
                            />
                          </div>
                          <div className="hidden md:block md:col-span-1">
                            <label className="text-xs text-zinc-500">Disc %</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={item.discount_percentage || 0}
                              onChange={e =>
                                updateLineItem(
                                  invoiceLineItems,
                                  setInvoiceLineItems,
                                  index,
                                  'discount_percentage',
                                  clampDiscountPercentage(parseFloat(e.target.value) || 0)
                                )
                              }
                              className="w-full rounded-lg border border-zinc-200 px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500"
                            />
                          </div>
                          <div className="col-span-2 md:col-span-1">
                            <label className="text-xs text-zinc-500">Total</label>
                            <div className="rounded-lg bg-zinc-100 px-2 py-2.5 sm:py-2 text-sm font-semibold text-zinc-700">
                              {formatMoney(calculateLineAmount(item), invoiceForm.currency)}
                            </div>
                          </div>
                        </div>
                        {/* Mobile-only discount row */}
                        <div className="mt-2 md:hidden">
                          <label className="text-xs text-zinc-500">Discount %</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={item.discount_percentage || 0}
                            onChange={e =>
                              updateLineItem(
                                invoiceLineItems,
                                setInvoiceLineItems,
                                index,
                                'discount_percentage',
                                clampDiscountPercentage(parseFloat(e.target.value) || 0)
                              )
                            }
                            className="w-24 rounded-lg border border-zinc-200 px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                        {(item.discount_percentage || 0) > 0 && (
                          <p className="mt-2 text-xs text-zinc-500">
                            Discount: -{formatMoney(calculateLineDiscountAmount(item), invoiceForm.currency)}
                          </p>
                        )}
                        {invoiceLineItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setInvoiceLineItems(invoiceLineItems.filter((_, lineIndex) => lineIndex !== index))
                            }
                            className="mt-2 w-full rounded-lg py-3 sm:py-2 text-xs font-bold text-red-500 hover:bg-red-50 touch-manipulation"
                          >
                            Remove Line
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex justify-end border-t pt-3">
                    <div className="text-right">
                      <div className="space-y-1 text-sm text-zinc-500">
                        <div>Subtotal: {formatMoney(invoiceTotals.subtotal, invoiceForm.currency)}</div>
                        <div>Discounts: {formatMoney(invoiceTotals.discount, invoiceForm.currency)}</div>
                        <div>Tax: {formatMoney(invoiceTotals.tax, invoiceForm.currency)}</div>
                      </div>
                      <div className="mt-2">
                        <span className="text-sm text-zinc-500">Total:</span>
                        <span className="ml-3 text-2xl font-black text-zinc-900">
                          {formatMoney(invoiceTotals.total, invoiceForm.currency)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-4 sticky bottom-0 bg-white pt-4 border-t">
                <button
                  type="button"
                  onClick={closeInvoiceModal}
                  className="flex-1 rounded-xl border border-zinc-200 px-4 py-4 sm:py-3 text-base sm:text-sm font-bold text-zinc-500 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 rounded-xl bg-green-600 px-4 py-4 sm:py-3 text-base sm:text-sm font-bold text-white hover:bg-green-700 shadow-lg">
                  {editingInvoice ? 'Save Changes' : 'Create Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={closePaymentModal} />
          <div className="relative max-h-[95vh] w-full max-w-xl overflow-y-auto rounded-2xl sm:rounded-3xl bg-white p-4 sm:p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-3 sm:mb-2">
              <h3 className="text-lg sm:text-2xl font-black text-zinc-900">{editingPayment ? 'Edit Payment' : 'Record Payment'}</h3>
              <button
                type="button"
                onClick={closePaymentModal}
                className="lg:hidden p-2 -mr-2 text-zinc-400 hover:text-zinc-600"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="mb-4 sm:mb-6 text-xs sm:text-sm text-zinc-500">
              {editingPayment
                ? 'Update the payment, reallocate it across invoices, and refresh the linked receipt.'
                : 'Record an inbound payment and immediately create a receipt.'}
            </p>
            <form onSubmit={handleRecordPayment} className="space-y-3 sm:space-y-4">
              <div>
                <label className="text-sm font-semibold text-zinc-700">Client *</label>
                <select
                  required
                  value={paymentForm.client_name}
                  onChange={e => {
                    const nextClient = e.target.value;
                    setPaymentForm(current => ({
                      ...current,
                      client_name: nextClient,
                    }));
                    setPaymentAllocationForm([createEmptyPaymentAllocationDraft()]);
                  }}
                  className="w-full rounded-xl border border-zinc-200 px-3 py-3 sm:px-4 sm:py-3 text-sm sm:text-base outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Select client</option>
                  {clientOptions.map(clientName => (
                    <option key={clientName} value={clientName}>
                      {clientName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="col-span-1">
                  <label className="text-sm font-semibold text-zinc-700">Amount *</label>
                  <input
                    required
                    value={paymentForm.amount}
                    onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full rounded-xl border border-zinc-200 px-3 py-3 sm:px-4 sm:py-3 text-sm sm:text-base outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div className="col-span-1">
                  <label className="text-sm font-semibold text-zinc-700">Currency</label>
                  <select
                    value={paymentForm.currency}
                    onChange={e => {
                      const nextCurrency = e.target.value as 'USD' | 'GBP';
                      setPaymentForm({ ...paymentForm, currency: nextCurrency });
                      setPaymentAllocationForm(current =>
                        current.filter(allocation => {
                          const invoice = invoices.find(candidate => candidate.id === allocation.invoice_id);
                          return invoice ? normalizeDocumentCurrency(invoice.currency) === nextCurrency : true;
                        }).length > 0
                          ? current.filter(allocation => {
                              const invoice = invoices.find(candidate => candidate.id === allocation.invoice_id);
                              return invoice ? normalizeDocumentCurrency(invoice.currency) === nextCurrency : true;
                            })
                          : [createEmptyPaymentAllocationDraft()]
                      );
                    }}
                    className="w-full rounded-xl border border-zinc-200 px-3 py-3 sm:px-4 sm:py-3 text-sm sm:text-base outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-sm font-semibold text-zinc-700">Method</label>
                  <select
                    value={paymentForm.method}
                    onChange={e => setPaymentForm({ ...paymentForm, method: e.target.value })}
                    className="w-full rounded-xl border border-zinc-200 px-3 py-3 sm:px-4 sm:py-3 text-sm sm:text-base outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="Check">Check</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex-1">
                    <label className="text-sm font-semibold text-zinc-700">Allocations (Optional)</label>
                    <p className="mt-1 text-xs text-zinc-500">Split this payment across open invoices.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPaymentAllocationForm(current => [...current, createEmptyPaymentAllocationDraft()])}
                    disabled={!paymentForm.client_name}
                    className="w-full sm:w-auto rounded-xl border border-green-200 px-3 py-3 sm:py-2 text-xs font-bold text-green-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation"
                  >
                    + Add
                  </button>
                </div>
                <div className="mt-4 space-y-3">
                  {paymentAllocationForm.map((allocation, index) => {
                    const selectedInvoice = invoices.find(invoice => invoice.id === allocation.invoice_id);
                    const selectedInvoiceOutstanding = selectedInvoice ? getInvoiceOutstandingAmount(selectedInvoice) : 0;
                    const invoiceOptions = paymentAllocationCandidates.filter(
                      ({ invoice }) =>
                        !selectedPaymentAllocationInvoiceIds.has(invoice.id) || invoice.id === allocation.invoice_id
                    );

                    return (
                      <div key={`${allocation.invoice_id || 'new'}-${index}`} className="rounded-2xl border border-zinc-200 bg-white p-3 sm:p-4">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.6fr,0.9fr,auto]">
                          <div>
                            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Invoice</label>
                            <select
                              value={allocation.invoice_id}
                              onChange={e => {
                                const nextInvoiceId = e.target.value;
                                const matchedInvoice = invoices.find(invoice => invoice.id === nextInvoiceId);
                                setPaymentAllocationForm(current =>
                                  current.map((entry, entryIndex) =>
                                    entryIndex === index
                                      ? {
                                          ...entry,
                                          invoice_id: nextInvoiceId,
                                          amount:
                                            entry.amount ||
                                            (matchedInvoice ? String(getInvoiceOutstandingAmount(matchedInvoice).toFixed(2)) : ''),
                                        }
                                      : entry
                                  )
                                );
                              }}
                              className="w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:ring-2 focus:ring-green-500"
                            >
                              <option value="">Select invoice</option>
                              {invoiceOptions.map(({ invoice, outstandingAmount }) => (
                                <option key={invoice.id} value={invoice.id}>
                                  {invoice.invoice_number} · {formatMoney(outstandingAmount, invoice.currency)} due
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Allocated Amount</label>
                            <input
                              value={allocation.amount}
                              onChange={e =>
                                setPaymentAllocationForm(current =>
                                  current.map((entry, entryIndex) =>
                                    entryIndex === index ? { ...entry, amount: e.target.value } : entry
                                  )
                                )
                              }
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              className="w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:ring-2 focus:ring-green-500"
                            />
                            {selectedInvoice ? (
                              <p className="mt-1 text-[11px] text-zinc-500">
                                Outstanding: {formatMoney(selectedInvoiceOutstanding, selectedInvoice.currency)}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex items-end">
                            <button
                              type="button"
                              onClick={() =>
                                setPaymentAllocationForm(current =>
                                  current.length === 1
                                    ? [createEmptyPaymentAllocationDraft()]
                                    : current.filter((_, entryIndex) => entryIndex !== index)
                                )
                              }
                              className="rounded-xl border border-red-200 px-3 py-3 sm:py-2 text-xs font-bold text-red-600 hover:bg-red-50 touch-manipulation"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {!paymentForm.client_name ? (
                    <p className="text-xs text-zinc-500">Choose a client first to allocate this payment to invoices.</p>
                  ) : paymentAllocationCandidates.length === 0 ? (
                    <p className="text-xs text-zinc-500">No open invoices found for this client in {paymentForm.currency}.</p>
                  ) : null}
                  <div className="flex items-center justify-between rounded-xl bg-zinc-900 px-4 py-3 text-sm text-white">
                    <span className="font-semibold text-zinc-200">Allocated Total</span>
                    <span className="font-black">
                      {formatMoney(
                        paymentAllocationForm.reduce((sum, allocation) => sum + (parseFloat(allocation.amount) || 0), 0),
                        paymentForm.currency
                      )}
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-zinc-700">Notes</label>
                <textarea
                  rows={2}
                  value={paymentForm.notes}
                  onChange={e => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  placeholder="Optional receipt notes..."
                  className="w-full rounded-xl border border-zinc-200 px-3 py-3 sm:px-4 sm:py-3 text-sm sm:text-base outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="sticky bottom-0 -mx-4 sm:mx-0 -mb-4 sm:mb-0 bg-white pt-4 sm:pt-4 border-t border-zinc-100 mt-4 sm:mt-4">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={closePaymentModal}
                    className="flex-1 rounded-xl border border-zinc-200 px-4 py-3 sm:py-3 text-sm font-bold text-zinc-500 hover:bg-zinc-50 touch-manipulation"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 rounded-xl bg-green-600 px-4 py-3 sm:py-3 text-sm font-bold text-white hover:bg-green-700 touch-manipulation">
                    {editingPayment ? 'Save' : 'Record'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" onClick={closePreview} />
          <div className="relative h-[88vh] w-full max-w-6xl overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-zinc-200 bg-zinc-50 px-6 py-4">
              <div>
                <h3 className="text-lg font-black text-zinc-900">{previewTitle} Preview</h3>
                <p className="text-sm text-zinc-500">Review the PDF before downloading or sharing it.</p>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-100"
                >
                  Open in New Tab
                </a>
                <a
                  href={previewUrl}
                  download={`${previewTitle.replace(/\s+/g, '_')}.pdf`}
                  className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-100"
                >
                  Download PDF
                </a>
                <button
                  type="button"
                  onClick={closePreview}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-bold text-zinc-600 transition-colors hover:bg-zinc-100"
                >
                  Close
                </button>
              </div>
            </div>
            <iframe src={previewUrl} title={previewTitle} className="h-[calc(88vh-73px)] w-full bg-zinc-100" />
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex border-b border-zinc-100 bg-zinc-50/50 p-2">
          {['quotes', 'invoices', 'payments', 'receipts', 'statements'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as typeof activeTab)}
              className={`flex-1 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest transition-all ${
                activeTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          {activeTab === 'quotes' && (
            <>
              {/* Mobile cards */}
              <div className="space-y-3 sm:hidden p-3">
                {quotes.map(quote => (
                  <div key={quote.id} className="rounded-xl border border-zinc-100 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between mb-2">
                      <span className="font-mono text-xs font-bold text-blue-600">{quote.quote_number}</span>
                      <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-tighter text-blue-700">
                        {quote.status}
                      </span>
                    </div>
                    <div className="font-bold text-zinc-900 mb-1">{quote.client_name}</div>
                    <div className="font-black text-zinc-900 mb-2">{formatMoney(quote.amount_usd, quote.currency || 'USD')}</div>
                    <div className="text-xs text-zinc-400 mb-3">{new Date(quote.created_at).toLocaleDateString()}</div>
                    <div className="flex flex-wrap gap-2 pt-3 border-t border-zinc-50">
                      <button onClick={() => handlePreviewQuote(quote)} className="text-xs font-bold text-zinc-600 hover:text-zinc-900 px-2 py-1">
                        Preview
                      </button>
                      <button onClick={() => handleDownloadQuote(quote)} className="text-xs font-bold text-blue-600 hover:text-blue-700 px-2 py-1">
                        Download
                      </button>
                      <button onClick={() => openEditQuoteModal(quote)} className="text-xs font-bold text-amber-600 hover:text-amber-700 px-2 py-1">
                        Edit
                      </button>
                      <button onClick={() => handleConvertToInvoice(quote)} className="text-xs font-bold text-emerald-600 hover:text-emerald-700 px-2 py-1">
                        Convert
                      </button>
                      <button
                        onClick={() => handleDeleteQuote(quote)}
                        disabled={deletingKey === `quote:${quote.id}`}
                        className="text-xs font-bold text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50 px-2 py-1"
                      >
                        {deletingKey === `quote:${quote.id}` ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop table */}
              <table className="hidden sm:table w-full text-left text-sm">
                <thead className="border-b border-zinc-100 bg-zinc-50">
                  <tr>
                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Quote #</th>
                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Client</th>
                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Amount</th>
                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Status</th>
                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Created</th>
                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {quotes.map(quote => (
                    <tr key={quote.id} className="transition-colors hover:bg-zinc-50">
                      <td className="px-8 py-4 font-mono text-xs font-bold text-blue-600">{quote.quote_number}</td>
                      <td className="px-8 py-4 font-bold text-zinc-900">{quote.client_name}</td>
                      <td className="px-8 py-4 font-black text-zinc-900">{formatMoney(quote.amount_usd, quote.currency || 'USD')}</td>
                      <td className="px-8 py-4">
                        <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-tighter text-blue-700">
                          {quote.status}
                        </span>
                      </td>
                      <td className="px-8 py-4 text-xs text-zinc-400">{new Date(quote.created_at).toLocaleDateString()}</td>
                      <td className="px-8 py-4">
                        <div className="flex items-center gap-4">
                          <button onClick={() => handlePreviewQuote(quote)} className="text-xs font-bold text-zinc-600 hover:text-zinc-900">
                            Preview
                          </button>
                          <button onClick={() => handleDownloadQuote(quote)} className="text-xs font-bold text-blue-600 hover:text-blue-700">
                            Download
                          </button>
                          <button onClick={() => openEditQuoteModal(quote)} className="text-xs font-bold text-amber-600 hover:text-amber-700">
                            Edit
                          </button>
                          <button onClick={() => handleConvertToInvoice(quote)} className="text-xs font-bold text-emerald-600 hover:text-emerald-700">
                            Convert to Invoice
                          </button>
                          <button
                            onClick={() => handleDeleteQuote(quote)}
                            disabled={deletingKey === `quote:${quote.id}`}
                            className="text-xs font-bold text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {deletingKey === `quote:${quote.id}` ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {activeTab === 'invoices' && (
            <>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 border-b border-zinc-100 px-4 sm:px-8 py-3">
                <svg className="h-4 w-4 shrink-0 text-zinc-400 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 010 2H4a1 1 0 01-1-1zm3 4a1 1 0 011-1h10a1 1 0 010 2H7a1 1 0 01-1-1zm4 4a1 1 0 011-1h2a1 1 0 010 2h-2a1 1 0 01-1-1z" />
                </svg>
                <input
                  type="text"
                  placeholder="Filter by batch code…"
                  value={batchFilter}
                  onChange={e => setBatchFilter(e.target.value)}
                  className="w-full sm:w-52 rounded-lg border border-zinc-200 px-3 py-2 sm:py-1.5 text-sm outline-none focus:ring-2 focus:ring-green-400"
                />
                {batchFilter && (
                  <button onClick={() => setBatchFilter('')} className="text-xs font-bold text-zinc-400 hover:text-zinc-700">
                    Clear
                  </button>
                )}
                {batchFilter && (
                  <span className="text-xs text-zinc-400">
                    {invoices.filter(i => (i.batch || '').toLowerCase().includes(batchFilter.toLowerCase())).length} result(s)
                  </span>
                )}
              </div>
              {/* Mobile cards */}
              <div className="sm:hidden space-y-3 p-3">
                {invoices.filter(invoice => !batchFilter || (invoice.batch || '').toLowerCase().includes(batchFilter.toLowerCase())).map(invoice => (
                  <div key={invoice.id} className="rounded-xl border border-zinc-100 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-mono font-bold text-green-600">{invoice.invoice_number}</div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                          {invoice.invoice_kind || 'Standard'}
                        </div>
                      </div>
                      <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-tighter text-emerald-700">
                        {invoice.status}
                      </span>
                    </div>
                    <div className="font-bold text-zinc-900 mb-1">{invoice.client_name}</div>
                    <div className="font-black text-zinc-900 mb-2">{formatMoney(invoice.amount_usd, invoice.currency || 'USD')}</div>
                    <div className="flex items-center gap-2 mb-3">
                      {invoice.batch ? (
                        <span className="rounded-md bg-blue-50 px-2 py-0.5 font-mono text-[11px] font-bold text-blue-700">{invoice.batch}</span>
                      ) : null}
                      <span className="text-xs text-zinc-400">Due: {new Date(invoice.due_date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-3 border-t border-zinc-50">
                      <button onClick={() => handlePreviewInvoice(invoice)} className="text-xs font-bold text-zinc-600 hover:text-zinc-900 px-2 py-1">
                        Preview
                      </button>
                      <button onClick={() => openEditInvoiceModal(invoice)} className="text-xs font-bold text-amber-600 hover:text-amber-700 px-2 py-1">
                        Edit
                      </button>
                      <button onClick={() => handleDownloadInvoice(invoice)} className="text-xs font-bold text-green-600 hover:text-green-700 px-2 py-1">
                        Download
                      </button>
                      <button
                        onClick={() => handleDeleteInvoice(invoice)}
                        disabled={deletingKey === `invoice:${invoice.id}`}
                        className="text-xs font-bold text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50 px-2 py-1"
                      >
                        {deletingKey === `invoice:${invoice.id}` ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            <table className="hidden sm:table w-full text-left text-sm">
              <thead className="border-b border-zinc-100 bg-zinc-50">
                <tr>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Invoice #</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Client</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Batch</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Amount</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Status</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Due Date</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {invoices.filter(invoice => !batchFilter || (invoice.batch || '').toLowerCase().includes(batchFilter.toLowerCase())).map(invoice => (
                  <tr key={invoice.id} className="transition-colors hover:bg-zinc-50">
                    <td className="px-8 py-4">
                      <div className="font-mono font-bold text-green-600">{invoice.invoice_number}</div>
                      <div className="mt-1 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                        {invoice.invoice_kind || 'Standard'}
                      </div>
                    </td>
                    <td className="px-8 py-4 font-bold text-zinc-900">{invoice.client_name}</td>
                    <td className="px-8 py-4">
                      {invoice.batch ? (
                        <span className="rounded-md bg-blue-50 px-2 py-0.5 font-mono text-[11px] font-bold text-blue-700">{invoice.batch}</span>
                      ) : (
                        <span className="text-xs text-zinc-300">—</span>
                      )}
                    </td>
                    <td className="px-8 py-4 font-black text-zinc-900">{formatMoney(invoice.amount_usd, invoice.currency || 'USD')}</td>
                    <td className="px-8 py-4">
                      <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-tighter text-emerald-700">
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-8 py-4 text-xs text-zinc-400">{new Date(invoice.due_date).toLocaleDateString()}</td>
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-4">
                        <button onClick={() => handlePreviewInvoice(invoice)} className="text-xs font-bold text-zinc-600 hover:text-zinc-900">
                          Preview
                        </button>
                        <button onClick={() => openEditInvoiceModal(invoice)} className="text-xs font-bold text-amber-600 hover:text-amber-700">
                          Edit
                        </button>
                        <button onClick={() => handleDownloadInvoice(invoice)} className="text-xs font-bold text-green-600 hover:text-green-700">
                          Download
                        </button>
                        <button
                          onClick={() => handleDeleteInvoice(invoice)}
                          disabled={deletingKey === `invoice:${invoice.id}`}
                          className="text-xs font-bold text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingKey === `invoice:${invoice.id}` ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </>
          )}

          {activeTab === 'payments' && (
            <>
              {/* Mobile cards */}
              <div className="sm:hidden space-y-3 p-3">
                {payments.map(payment => (
                  <div key={payment.id} className="rounded-xl border border-zinc-100 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-bold text-zinc-900">{payment.client_name}</div>
                        <div className="text-xs font-mono text-zinc-500">{payment.reference_id}</div>
                      </div>
                      <span className="rounded-md bg-green-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-tighter text-green-700">
                        {payment.type}
                      </span>
                    </div>
                    <div className="font-black text-zinc-900 mb-2">
                      {formatMoney(payment.amount_usd, normalizeDocumentCurrency(payment.currency))}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-400 mb-3">
                      <span className="rounded bg-zinc-100 px-2 py-0.5">{payment.method}</span>
                      <span>{new Date(payment.date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-3 border-t border-zinc-50">
                      <button onClick={() => openEditPaymentModal(payment)} className="text-xs font-bold text-amber-600 hover:text-amber-700 px-2 py-1">
                        Edit
                      </button>
                      <button onClick={() => handleDeletePayment(payment)} disabled={deletingKey === `payment:${payment.id}`} className="text-xs font-bold text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50 px-2 py-1">
                        {deletingKey === `payment:${payment.id}` ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop table */}
            <table className="hidden sm:table w-full text-left text-sm">
              <thead className="border-b border-zinc-100 bg-zinc-50">
                <tr>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Client</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Reference</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Type</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Amount</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Currency</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Method</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Date</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {payments.map(payment => (
                  <tr key={payment.id}>
                    <td className="px-8 py-4 font-bold text-zinc-900">{getPaymentClientName(payment)}</td>
                    <td className="px-8 py-4">
                      <div className="font-mono text-xs font-bold text-zinc-600">{payment.reference_id}</div>
                      {getPaymentAllocationSummary(payment) ? (
                        <div className="mt-1 text-[11px] text-zinc-400">{getPaymentAllocationSummary(payment)}</div>
                      ) : null}
                    </td>
                    <td className="px-8 py-4">
                      <span className={`text-[10px] font-black uppercase ${payment.type === 'Inbound' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {payment.type}
                      </span>
                    </td>
                    <td className="px-8 py-4 font-black text-zinc-900">{formatMoney(payment.amount_usd, getPaymentCurrency(payment))}</td>
                    <td className="px-8 py-4 text-xs font-black uppercase tracking-widest text-zinc-500">{getPaymentCurrency(payment)}</td>
                    <td className="px-8 py-4 font-medium text-zinc-500">{payment.method}</td>
                    <td className="px-8 py-4 text-xs text-zinc-400">{new Date(payment.date).toLocaleDateString()}</td>
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => openEditPaymentModal(payment)}
                          className="text-xs font-bold text-amber-600 hover:text-amber-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeletePayment(payment)}
                          disabled={deletingKey === `payment:${payment.id}`}
                          className="text-xs font-bold text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingKey === `payment:${payment.id}` ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </>
          )}

          {activeTab === 'receipts' && (
            <div className="p-3 sm:p-8">
              {receipts.length === 0 ? (
                <div className="mx-auto max-w-lg rounded-2xl bg-green-50 p-6 sm:p-8 text-center">
                  <svg className="mx-auto mb-4 h-12 w-12 sm:h-16 sm:w-16 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <h3 className="mb-2 text-lg sm:text-xl font-black text-zinc-900">Receipts</h3>
                  <p className="mb-4 text-sm sm:text-base text-zinc-500">Record payments and generate receipts for clients.</p>
                  <button
                    onClick={openPaymentModal}
                    className="rounded-xl bg-green-600 px-6 py-3 font-bold text-white hover:bg-green-700 touch-manipulation"
                  >
                    Record Payment
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <h3 className="text-lg sm:text-xl font-black text-zinc-900">All Receipts</h3>
                    <button
                      onClick={openPaymentModal}
                      className="w-full sm:w-auto rounded-xl bg-green-600 px-6 py-3 font-bold text-white hover:bg-green-700 touch-manipulation"
                    >
                      Record Payment
                    </button>
                  </div>
                  {/* Mobile-first card layout */}
                  <div className="space-y-3 sm:hidden">
                    {receipts.map(receipt => (
                      <div key={receipt.id} className="rounded-xl border border-zinc-100 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between mb-2">
                          <span className="font-mono text-xs font-bold text-green-600">{receipt.receipt_number}</span>
                          <span className="text-xs text-zinc-400">{new Date(receipt.payment_date).toLocaleDateString()}</span>
                        </div>
                        <div className="font-bold text-zinc-900 mb-1">{receipt.client_name}</div>
                        <div className="font-black text-zinc-900 mb-3">{formatMoney(receipt.amount_received, receipt.currency)}</div>
                        {receipt.batch && (
                          <span className="inline-block rounded-md bg-blue-50 px-2 py-0.5 font-mono text-[11px] font-bold text-blue-700 mb-3">
                            {receipt.batch}
                          </span>
                        )}
                        <div className="flex gap-3 mt-2 pt-3 border-t border-zinc-50">
                          <button onClick={() => handleDownloadReceipt(receipt)} className="flex-1 text-center text-xs font-bold text-blue-600 hover:text-blue-800 py-2">
                            Preview PDF
                          </button>
                          <button onClick={() => handleReissueReceipt(receipt)} className="flex-1 text-center text-xs font-bold text-emerald-600 hover:text-emerald-800 py-2">
                            Reissue
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Desktop table */}
                  <table className="hidden sm:table w-full text-left text-sm">
                    <thead className="border-b border-zinc-100 bg-zinc-50">
                      <tr>
                        <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Receipt #</th>
                        <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Client</th>
                        <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Batch</th>
                        <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Amount</th>
                        <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Date</th>
                        <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {receipts.map(receipt => (
                        <tr key={receipt.id} className="transition-colors hover:bg-zinc-50">
                          <td className="px-8 py-4 font-mono text-xs font-bold text-green-600">{receipt.receipt_number}</td>
                          <td className="px-8 py-4 font-bold text-zinc-900">{receipt.client_name}</td>
                          <td className="px-8 py-4">
                            {receipt.batch ? (
                              <span className="rounded-md bg-blue-50 px-2 py-0.5 font-mono text-[11px] font-bold text-blue-700">{receipt.batch}</span>
                            ) : (
                              <span className="text-xs text-zinc-300">—</span>
                            )}
                          </td>
                          <td className="px-8 py-4 font-black text-zinc-900">{formatMoney(receipt.amount_received, receipt.currency)}</td>
                          <td className="px-8 py-4 text-xs text-zinc-400">{new Date(receipt.payment_date).toLocaleDateString()}</td>
                          <td className="px-8 py-4">
                            <div className="flex items-center gap-4">
                              <button onClick={() => handleDownloadReceipt(receipt)} className="text-xs font-bold text-blue-600 hover:text-blue-800">
                                Preview PDF
                              </button>
                              <button onClick={() => handleReissueReceipt(receipt)} className="text-xs font-bold text-emerald-600 hover:text-emerald-800">
                                Reissue
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          )}

          {activeTab === 'statements' && (
            <div className="p-8">
              <div className="mx-auto max-w-lg rounded-2xl bg-blue-50 p-8 text-center">
                <svg className="mx-auto mb-4 h-16 w-16 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <h3 className="mb-2 text-xl font-black text-zinc-900">Client Statements</h3>
                <p className="mb-4 text-zinc-500">Generate a branded statement for one client using only that client&apos;s invoices and matching payments, optionally filtered by statement period.</p>
                <div className="mb-3 grid gap-3 sm:grid-cols-2">
                  <div className="text-left">
                    <label className="mb-1 block text-xs font-black uppercase tracking-widest text-zinc-500">From</label>
                    <input
                      type="date"
                      value={statementDateFrom}
                      onChange={e => setStatementDateFrom(e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 px-4 py-3"
                    />
                  </div>
                  <div className="text-left">
                    <label className="mb-1 block text-xs font-black uppercase tracking-widest text-zinc-500">To</label>
                    <input
                      type="date"
                      value={statementDateTo}
                      onChange={e => setStatementDateTo(e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 px-4 py-3"
                    />
                  </div>
                </div>
                <div className="flex flex-col justify-center gap-3 sm:flex-row">
                  <select
                    value={selectedClient}
                    onChange={e => setSelectedClient(e.target.value)}
                    className="rounded-xl border border-zinc-200 px-4 py-3"
                  >
                    <option value="">Select Client</option>
                    {clientOptions.map(clientName => (
                      <option key={clientName} value={clientName}>
                        {clientName}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleGenerateStatement}
                    className="rounded-xl bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700"
                  >
                    Generate
                  </button>
                  <button
                    onClick={handleClearStatement}
                    disabled={!selectedClient}
                    className="rounded-xl border border-zinc-200 px-6 py-3 font-bold text-zinc-600 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
