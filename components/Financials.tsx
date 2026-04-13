import React, { useEffect, useMemo, useState } from 'react';
import { Client, CompanyDetails, Invoice, LineItem, Payment, Quote, Receipt, ReceiptItem, Vehicle } from '../types';
import { dataService } from '../services/dataService';
import {
 generateInvoicePDF,
 generateInvoicePDFAndDownload,
 generateQuotePDF,
 generateQuotePDFAndDownload,
 generateReceiptPDF,
 generateStatementPDF,
 type StatementData,
} from '../services/pdfService';
import { Button } from './ui';
import { useConfirm } from './ConfirmModal';
import { useToast } from './Toast';
import { ClientFormModal, type ClientFormValue } from './shared/ClientFormModal';
import { CarbonInvoiceModal } from './shared/CarbonInvoiceModal';
import { CarbonQuoteModal } from './shared/CarbonQuoteModal';
import {
 FinancialsTabBar,
 InvoicesSection,
 PaymentsSection,
 QuotesSection,
 ReceiptsSection,
 StatementsSection,
} from './financials/FinancialsSections';

type PaymentAllocationDraft = {
 invoice_id: string;
 amount: string;
};

type PaymentAllocationPayload = {
 invoice_id?: string;
 amount_allocated: number;
 currency: 'USD' | 'GBP';
 status?: 'allocated' | 'unallocated' | 'credit';
};

type ClientOption = {
 id: string;
 name: string;
 isRegistered: boolean;
};

const UNREGISTERED_CLIENT_PREFIX = 'unregistered:';

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
 const [showClientModal, setShowClientModal] = useState(false);
 const [previewUrl, setPreviewUrl] = useState<string | null>(null);
 const [previewTitle, setPreviewTitle] = useState('');
 const [selectedClient, setSelectedClient] = useState('');
 const [statementDateFrom, setStatementDateFrom] = useState('');
 const [statementDateTo, setStatementDateTo] = useState('');
 const [deletingKey, setDeletingKey] = useState<string | null>(null);
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
 notes: '',
 });
 const [paymentAllocationForm, setPaymentAllocationForm] = useState<PaymentAllocationDraft[]>([createEmptyPaymentAllocationDraft()]);

 const calculateTotal = (items: LineItem[]): number =>
 items.reduce((sum, item) => sum + calculateLineAmount(item), 0);

 const normalizeOptionalRelatedId = (value: string, availableIds: string[]): string | undefined => {
 const normalizedValue = value.trim();
 if (!normalizedValue) {
 return undefined;
 }

 return availableIds.includes(normalizedValue) ? normalizedValue : undefined;
 };

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
 
 // Ensure clients is always an array
 const safeClients = Array.isArray(nextClients) ? nextClients : [];
 if (!Array.isArray(nextClients)) {
 console.error('[Financials] getClients returned non-array:', nextClients);
 } else {
 console.log('[Financials] Loaded clients:', safeClients.length, safeClients);
 }
 setClients(safeClients);
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

 const openEditQuoteModal = (quote: Quote) => {
 const normalizedItems =
 quote.items && quote.items.length > 0
 ? quote.items.map(item => normalizeLineItemForForm(item))
 : [normalizeLineItemForForm({ ...createEmptyLineItem(), description: quote.description || '', unit_price: quote.amount_usd || 0 })];

 // Fallback: if client_id is missing, try to find client by name
 let clientId = quote.client_id || '';
 if (!clientId && quote.client_name?.trim()) {
 const matchedClient = clients.find(c => 
 c.name.trim().toLowerCase() === quote.client_name.trim().toLowerCase()
 );
 clientId = matchedClient?.id || '';
 }

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
 : [normalizeLineItemForForm({ ...createEmptyLineItem(), description: quote.description || '', unit_price: quote.amount_usd || 0 })];

 // Fallback: if client_id is missing, try to find client by name
 let clientId = quote.client_id || '';
 if (!clientId && quote.client_name?.trim()) {
 const matchedClient = clients.find(c => 
 c.name.trim().toLowerCase() === quote.client_name.trim().toLowerCase()
 );
 clientId = matchedClient?.id || '';
 }

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
 console.log('[DEBUG] Opening invoice:', invoice);
 console.log('[DEBUG] Available clients:', clients);
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

 // Fallback: if client_id is missing, try to find client by name
 let clientId = invoice.client_id || '';
 if (!clientId && invoice.client_name?.trim()) {
 const matchedClient = clients.find(c => 
 c.name.trim().toLowerCase() === invoice.client_name.trim().toLowerCase()
 );
 clientId = matchedClient?.id || '';
 console.log('[DEBUG] Matched client by name:', matchedClient);
 }
 console.log('[DEBUG] Final clientId:', clientId);

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
 invoice => invoice.invoice_number === payment.reference_id || invoice.id === payment.reference_id
 );
 const resolvedClientName = payment.client_name || linkedReceipt?.client_name || legacyInvoice?.client_name || '';
 const matchedClient = resolvedClientName
 ? clients.find(client => normalizeClientName(client.name) === normalizeClientName(resolvedClientName))
 : undefined;
 const resolvedClientId = payment.client_id || matchedClient?.id || (
 resolvedClientName ? `${UNREGISTERED_CLIENT_PREFIX}${normalizeClientName(resolvedClientName)}` : ''
 );
 const allocationDrafts =
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

 const openClientModal = (target: 'quote' | 'invoice') => {
 setClientModalTarget(target);
 const source = target === 'quote'
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
 const nextClients = [...clients, createdClient].sort((a, b) => a.name.localeCompare(b.name));
 setClients(nextClients);

 if (clientModalTarget === 'quote') {
 setQuoteForm((current) => ({
 ...current,
 client_id: createdClient.id,
 client_name: createdClient.name,
 client_email: createdClient.email || '',
 client_address: createdClient.address || '',
 }));
 } else {
 setInvoiceForm((current) => ({
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

 const buildReceiptItemsSnapshot = (
 allocatedInvoices: Invoice[],
 allocations: Array<{ invoice_id?: string; amount_allocated: number; currency: 'USD' | 'GBP' }>,
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
 const invoice = allocation.invoice_id
 ? allocatedInvoices.find(candidate => candidate.id === allocation.invoice_id)
 : undefined;
 return {
 ...normalizeLineItemForForm({
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
 vehicles.map((vehicle) => vehicle.id),
 );
 const clientId = normalizeOptionalRelatedId(
 formValue.client_id,
 clients.map((client) => client.id),
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
 showToast(editingQuote ? 'Quote updated successfully!' : 'Quote created successfully!', 'success');
 } catch (error: any) {
 console.error('[Financials] submitQuote failed:', error);
 showToast(error?.message || 'Failed to save quote', 'error');
 } finally {
 setIsSubmittingQuote(false);
 }
 };

 const handleCreateQuote = async (e: React.FormEvent) => {
 e.preventDefault();
 await submitQuote();
 };

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
 vehicles.map((vehicle) => vehicle.id),
 );
 const clientId = normalizeOptionalRelatedId(
 formValue.client_id,
 clients.map((client) => client.id),
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
 showToast(editingInvoice ? 'Invoice updated successfully!' : 'Invoice created successfully!', 'success');
 } catch (error: any) {
 console.error('[Financials] submitInvoice failed:', error);
 showToast(error?.message || `Failed to ${editingInvoice ? 'update' : 'create'} invoice`, 'error');
 } finally {
 setIsSubmittingInvoice(false);
 }
 };

 const handleSubmitInvoice = async (e: React.FormEvent) => {
 e.preventDefault();
 await submitInvoice();
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

 const clientId = clients.some((client) => client.id === paymentForm.client_id)
 ? paymentForm.client_id
 : '';
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
 
 // Parse allocations - now allowing unallocated (no invoice_id) payments
 const draftedAllocations = paymentAllocationForm
 .map(allocation => ({
 invoice_id: allocation.invoice_id,
 amount_allocated: parseFloat(allocation.amount) || 0,
 }))
 .filter(allocation => allocation.invoice_id || allocation.amount_allocated > 0);

 // Only validate amounts for allocations that have an invoice_id specified
 const invalidAllocation = draftedAllocations.find(
 allocation => allocation.invoice_id && allocation.amount_allocated <= 0
 );
 if (invalidAllocation) {
 showToast('Each allocated row needs a positive amount', 'warning');
 return;
 }

 // Build allocations array
 // If no valid allocations to invoices, create an unallocated entry
 const hasInvoiceAllocations = draftedAllocations.some(a => a.invoice_id && a.amount_allocated > 0);
 
 let mergedAllocations: PaymentAllocationPayload[] = [];
 
 if (hasInvoiceAllocations) {
 // Group allocations by invoice_id
 const allocationsByInvoice = draftedAllocations
 .filter(a => a.invoice_id)
 .reduce((acc, allocation) => {
 const existing = acc.get(allocation.invoice_id);
 if (existing) {
 existing.amount_allocated += allocation.amount_allocated;
 } else {
 acc.set(allocation.invoice_id, { 
 invoice_id: allocation.invoice_id, 
 amount_allocated: allocation.amount_allocated,
 currency: selectedCurrency,
 status: 'allocated'
 });
 }
 return acc;
 }, new Map<string, { invoice_id: string; amount_allocated: number; currency: 'USD' | 'GBP'; status: 'allocated' }>());
 
 mergedAllocations = Array.from(allocationsByInvoice.values());
 } else {
 // Unallocated payment - will be tracked as client credit
 mergedAllocations = [{
 amount_allocated: amount,
 currency: selectedCurrency,
 status: 'unallocated'
 }];
 }

 const totalAllocated = mergedAllocations.reduce((sum, allocation) => sum + allocation.amount_allocated, 0);
 if (totalAllocated - amount > 0.001) {
 showToast('Allocated total cannot exceed the payment amount', 'warning');
 return;
 }

 const allocatedInvoices = mergedAllocations
 .filter(a => a.invoice_id)
 .map(allocation => invoices.find(invoice => invoice.id === allocation.invoice_id))
 .filter(Boolean) as Invoice[];
 const primaryInvoice = allocatedInvoices[0];
 const isMultiInvoicePayment = allocatedInvoices.length > 1;
 const linkedReceipt = editingPayment
 ? receipts.find(receipt => receipt.payment_id === editingPayment.id)
 : undefined;
 // Generate a simple payment reference - never use fake UUIDs
 const referenceId =
 allocatedInvoices.length === 1
 ? primaryInvoice.invoice_number
 : `PAY-${Date.now()}`;

 setIsSubmittingPayment(true);
 
 const paymentPayload = editingPayment
 ? {
 reference_id: referenceId,
 client_id: clientId || undefined,
 client_name: primaryInvoice?.client_name || clientName,
 type: 'Inbound' as const,
 amount_usd: amount,
 currency: selectedCurrency,
 method,
 date: editingPayment.date,
 allocations: mergedAllocations,
 }
 : {
 reference_id: referenceId,
 client_id: clientId || undefined,
 client_name: primaryInvoice?.client_name || clientName,
 type: 'Inbound' as const,
 amount_usd: amount,
 currency: selectedCurrency,
 method,
 date: new Date().toISOString(),
 allocations: mergedAllocations,
 };
 
 console.log('[Financials] Payment payload:', JSON.stringify(paymentPayload, null, 2));
 
 try {
 const payment = editingPayment
 ? await dataService.updatePayment(editingPayment.id, paymentPayload)
 : await dataService.addPayment(paymentPayload);

 await dataService.replacePaymentAllocations(payment.id, mergedAllocations);

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
 ? await dataService.updateReceipt(linkedReceipt.id, receiptPayload)
 : await dataService.createReceipt(receiptPayload);

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
 console.error('[Financials] Error details:', error?.data || 'No details');
 console.error('[Financials] Error stack:', error?.stack || 'No stack');
 showToast(error?.message || 'Failed to record payment', 'error');
 } finally {
 setIsSubmittingPayment(false);
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
 normalizeClientName(invoice.client_name?.trim()) === normalizedClient &&
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
 .filter(receipt => normalizeClientName(receipt.client_name?.trim()) === normalizedClient && receipt.payment_id)
 .map(receipt => receipt.payment_id as string)
 );
 const receiptLinkedReferences = new Set(
 receipts
 .filter(receipt => normalizeClientName(receipt.client_name?.trim()) === normalizedClient)
 .map(receipt => receipt.reference_number)
 .filter(Boolean)
 );
 const clientPayments: Payment[] = Array.from(
 new Map<string, Payment>(
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
 const statementData: StatementData = {
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

 if (!approved) {
 return;
 }

 const key = `invoice:${invoice.id}`;
 setDeletingKey(key);
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

 if (!approved) {
 return;
 }

 const key = `payment:${payment.id}`;
 setDeletingKey(key);
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

 if (!approved) {
 return;
 }

 const key = `receipt:${receipt.id}`;
 setDeletingKey(key);
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

 // Build client options from actual clients list (with IDs) plus names from invoices/quotes
 const clientOptions = useMemo(() => {
   const clientMap = new Map<string, ClientOption>();
   
   // First add registered clients with IDs
   clients.forEach(client => {
     const key = normalizeClientName(client.name);
     clientMap.set(key, { id: client.id, name: client.name, isRegistered: true });
   });
   
   // Then add names from invoices/quotes/receipts (may not have IDs)
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
 const receiptByPaymentId = new Map<string, Receipt>(
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
 
 // Check if invoice can receive payments (not Cancelled)
 // Also include 'Paid' invoices that still have outstanding balance (data inconsistency fix)
 const canInvoiceReceivePayments = (invoice: Invoice): boolean => {
 if (invoice.status === 'Cancelled') return false;
 // For 'Paid' invoices, only show if they actually have outstanding balance
 if (invoice.status === 'Paid') {
 const outstanding = getInvoiceOutstandingAmount(invoice);
 return outstanding > 0;
 }
 return true; // Draft, Sent, Overdue are always eligible
 };
 
 const paymentAllocationCandidates = paymentForm.client_name
 ? invoices
 .filter(
 invoice =>
 normalizeClientName(invoice.client_name?.trim()) === normalizeClientName(paymentForm.client_name) &&
 normalizeDocumentCurrency(invoice.currency) === normalizeDocumentCurrency(paymentForm.currency) &&
 canInvoiceReceivePayments(invoice)
 )
 .map(invoice => ({
 invoice,
 outstandingAmount: getInvoiceOutstandingAmount(invoice),
 }))
 .filter(({ outstandingAmount }) => outstandingAmount > 0)
 .sort((a, b) => new Date(a.invoice.due_date).getTime() - new Date(b.invoice.due_date).getTime())
 : [];
 
 // Debug: Log when no candidates found but client has invoices
 if (paymentForm.client_name && showPaymentModal && paymentAllocationCandidates.length === 0) {
 const normalizedClient = normalizeClientName(paymentForm.client_name);
 const clientInvoices = invoices.filter(inv => normalizeClientName(inv.client_name) === normalizedClient);
 const eligibleInvoices = clientInvoices.filter(inv => canInvoiceReceivePayments(inv));
 const wrongCurrency = eligibleInvoices.filter(inv => normalizeDocumentCurrency(inv.currency) !== normalizeDocumentCurrency(paymentForm.currency));
 const fullyPaid = eligibleInvoices.filter(inv => normalizeDocumentCurrency(inv.currency) === normalizeDocumentCurrency(paymentForm.currency) && getInvoiceOutstandingAmount(inv) <= 0);
 
 if (clientInvoices.length > 0) {
 console.log('[DEBUG] No payment allocation candidates for client:', {
 clientName: paymentForm.client_name,
 currency: paymentForm.currency,
 totalInvoicesForClient: clientInvoices.length,
 eligibleByStatus: eligibleInvoices.length,
 wrongCurrencyCount: wrongCurrency.length,
 fullyPaidCount: fullyPaid.length,
 invoices: clientInvoices.map(inv => ({
 id: inv.id,
 number: inv.invoice_number,
 client_name: inv.client_name,
 normalized: normalizeClientName(inv.client_name),
 currency: inv.currency,
 amount: inv.amount_usd,
 outstanding: getInvoiceOutstandingAmount(inv),
 status: inv.status,
 canReceivePayment: canInvoiceReceivePayments(inv)
 }))
 });
 }
 }
 
 // Debug: Trace specific invoice (useful for troubleshooting)
 // To use: Open browser console and run: debugInvoice('INV-2026-9A0B9646')
 (window as any).debugInvoice = (invoiceNumber: string) => {
 const invoice = invoices.find(inv => inv.invoice_number === invoiceNumber);
 if (!invoice) {
 console.log(`[DEBUG] Invoice ${invoiceNumber} not found`);
 return;
 }
 
 const paidAmount = getInvoicePaidAmount(invoice);
 const outstanding = getInvoiceOutstandingAmount(invoice);
 const relatedPayments = payments.filter(p => {
 if (p.allocations?.some(a => a.invoice_id === invoice.id)) return true;
 return p.reference_id === invoice.invoice_number || p.reference_id === invoice.id;
 });
 const relatedReceipts = receipts.filter(r => r.invoice_id === invoice.id);
 
 console.log(`[DEBUG] Invoice Trace: ${invoiceNumber}`, {
 invoice: {
 id: invoice.id,
 number: invoice.invoice_number,
 client: invoice.client_name,
 amount: invoice.amount_usd,
 currency: invoice.currency,
 status: invoice.status,
 due_date: invoice.due_date,
 created_at: invoice.created_at,
 },
 calculations: {
 paidAmount,
 outstanding,
 isFullyPaid: outstanding <= 0,
 canReceivePayment: canInvoiceReceivePayments(invoice)
 },
 relatedPayments: relatedPayments.map(p => ({
 id: p.id,
 reference_id: p.reference_id,
 amount: p.amount_usd,
 currency: p.currency,
 date: p.date,
 allocations: p.allocations?.filter(a => a.invoice_id === invoice.id)
 })),
 relatedReceipts: relatedReceipts.map(r => ({
 id: r.id,
 receipt_number: r.receipt_number,
 amount: r.amount_received,
 payment_id: r.payment_id
 }))
 });
 };
 const selectedPaymentAllocationInvoiceIds = new Set(
 paymentAllocationForm.map(allocation => allocation.invoice_id).filter(Boolean)
 );
 const getPaymentAllocationSummary = (payment: Payment): string | null => {
 if (!payment.allocations || payment.allocations.length === 0) {
 return null;
 }

 // Check if all allocations are unallocated (no invoice_id)
 const hasUnallocatedOnly = payment.allocations.every(a => !a.invoice_id);
 if (hasUnallocatedOnly) {
 return 'Unallocated payment (client credit)';
 }

 return payment.allocations
 .map(allocation => {
 if (!allocation.invoice_id) {
 return `Unallocated ${formatMoney(allocation.amount_allocated, allocation.currency)}`;
 }
 const invoice = invoices.find(candidate => candidate.id === allocation.invoice_id);
 return `${invoice?.invoice_number || allocation.invoice_id.slice(0, 8)} ${formatMoney(allocation.amount_allocated, allocation.currency)}`;
 })
 .join(' | ');
 };
 const quoteTotals = calculateDocumentSummary(quoteLineItems);
 const invoiceTotals = calculateDocumentSummary(invoiceLineItems);

 // Calculate client balance for payment modal display using unified formula
 const getClientBalanceForPayment = (clientName: string, clientId?: string): { 
   balance: number; 
   credit: number; 
   currency: 'USD' | 'GBP';
   openingBalance: number;
   totalInvoiced: number;
   totalPaid: number;
 } | null => {
   if (!clientName) return null;
   
   // Find the client by ID first, then by name
   const client = clientId 
     ? clients.find(c => c.id === clientId)
     : clients.find(c => c.name.trim().toLowerCase() === clientName.trim().toLowerCase());
   
   if (client) {
     // Use unified calculation from dataService
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
   
   // Fallback: Calculate from invoices and payments only (no opening balance)
   const clientInvoices = invoices.filter(i => 
     i.client_name.trim().toLowerCase() === clientName.trim().toLowerCase() &&
     i.status !== 'Cancelled'
   );
   const clientPayments = payments.filter(p => 
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

 if (loading) {
 return <div className="animate-pulse flex h-64 items-center justify-center">Loading Financial Records...</div>;
 }

 return (
 <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
 <ToastContainer />
 <ConfirmDialog />

 <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
 <div>
 <h2 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: 'var(--cds-text-primary, #161616)' }}>Finance</h2>
 <p className="font-medium" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Quotes, Billing, Receipts, Statements</p>
 </div>
 <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
 <button
 onClick={openCreateInvoiceModal}
 className="flex-1 sm:flex-none items-center justify-center gap-2 px-6 py-4 sm:py-2.5 text-base sm:text-sm font-bold text-white transition-all active:scale-[0.98]" style={{ backgroundColor: 'var(--cds-support-success, #24a148)' }}
 >
 <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
 </svg>
 New Invoice
 </button>
 <button
 onClick={() => setShowQuoteModal(true)}
 className="flex-1 sm:flex-none items-center justify-center gap-2 px-6 py-4 sm:py-2.5 text-base sm:text-sm font-bold text-white transition-all" style={{ backgroundColor: 'var(--cds-interactive, #0f62fe)' }}
 >
 <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
 </svg>
 New Quote
 </button>
 </div>
 </div>


      <CarbonQuoteModal
        open={showQuoteModal}
        editingQuote={editingQuote}
        clients={clients}
        vehicles={vehicles}
        onClose={closeQuoteModal}
        onSubmit={async ({ form, lineItems }) => {
          const normalizedItems = lineItems.map((item) =>
            normalizeLineItemForForm({
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              discount_percentage: item.discount_percentage,
              tax_rate: item.tax_rate,
            }),
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
            normalizedItems,
          );
        }}
      />

      <CarbonInvoiceModal
        open={showInvoiceModal}
        editingInvoice={editingInvoice}
        clients={clients}
        vehicles={vehicles}
        onClose={closeInvoiceModal}
        onSubmit={async ({ form, lineItems }) => {
          const normalizedItems = lineItems.map((item) =>
            normalizeLineItemForForm({
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              discount_percentage: item.discount_percentage,
              tax_rate: item.tax_rate,
            }),
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
            normalizedItems,
          );
        }}
      />


 {showPaymentModal && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
 <div className="absolute inset-0 backdrop-blur-sm" onClick={closePaymentModal} style={{ backgroundColor: 'rgba(22, 22, 22, 0.4)' }} />
 <div className="relative max-h-[95vh] w-full max-w-xl overflow-y-auto p-4 sm:p-8" style={{ backgroundColor: 'var(--cds-layer-01, #ffffff)' }}>
 <div className="flex items-center justify-between mb-3 sm:mb-2">
 <h3 className="text-lg sm:text-2xl font-black" style={{ color: 'var(--cds-text-primary, #161616)' }}>{editingPayment ? 'Edit Payment' : 'Record Payment'}</h3>
 <button
 type="button"
 onClick={closePaymentModal}
 className="lg:hidden p-2 -mr-2" style={{ color: 'var(--cds-text-secondary, #525252)' }}
 aria-label="Close"
 >
 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>
 <p className="mb-4 sm:mb-6 text-xs sm:text-sm" style={{ color: 'var(--cds-text-secondary, #525252)' }}>
 {editingPayment
 ? 'Update the payment, reallocate it across invoices, and refresh the linked receipt.'
 : 'Record an inbound payment and immediately create a receipt.'}
 </p>
 
 {/* Client Balance Display - Shows unified balance */}
 {paymentForm.client_name && (() => {
   const balanceInfo = getClientBalanceForPayment(paymentForm.client_name, paymentForm.client_id);
   if (!balanceInfo) return null;
   
   return (
     <div className="mb-4 p-4" style={{ backgroundColor: 'var(--cds-layer-02, #f4f4f4)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--cds-border-subtle, #c6c6c6)' }}>
       <div className="flex items-center justify-between mb-2">
         <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Client Balance Summary</span>
         <span className="text-xs" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Formula: Opening + Invoiced - Paid</span>
       </div>
       <div className="grid grid-cols-4 gap-2 text-center">
         <div>
           <div className="text-xs" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Opening</div>
           <div className="font-bold">{formatMoney(balanceInfo.openingBalance, balanceInfo.currency)}</div>
         </div>
         <div>
           <div className="text-xs" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Invoiced</div>
           <div className="font-bold">{formatMoney(balanceInfo.totalInvoiced, balanceInfo.currency)}</div>
         </div>
         <div>
           <div className="text-xs" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Paid</div>
           <div className="font-bold" style={{ color: 'var(--cds-support-success, #24a148)' }}>{formatMoney(balanceInfo.totalPaid, balanceInfo.currency)}</div>
         </div>
         <div>
           <div className="text-xs" style={{ color: 'var(--cds-text-secondary, #525252)' }}>
             {balanceInfo.balance > 0 ? 'Due' : balanceInfo.credit > 0 ? 'Credit' : 'Balance'}
           </div>
           <div className="font-bold text-lg" style={{ 
             color: balanceInfo.balance > 0 ? 'var(--cds-support-error, #da1e28)' : 
                    balanceInfo.credit > 0 ? 'var(--cds-support-success, #24a148)' : 
                    'inherit'
           }}>
             {balanceInfo.balance > 0 
               ? formatMoney(balanceInfo.balance, balanceInfo.currency)
               : balanceInfo.credit > 0 
                 ? formatMoney(balanceInfo.credit, balanceInfo.currency)
                 : formatMoney(0, balanceInfo.currency)}
           </div>
         </div>
       </div>
       {balanceInfo.balance <= 0 && balanceInfo.credit === 0 && (
         <div className="mt-2 p-2 text-xs" style={{ backgroundColor: 'var(--cds-support-warning-light, #fcf4d6)', color: 'var(--cds-support-warning, #f1c21b)' }}>
           ⚠️ Client has no outstanding balance. Payment will be recorded as credit.
         </div>
       )}
     </div>
   );
 })()}
 
 <form onSubmit={handleRecordPayment} className="space-y-3 sm:space-y-4">
 <div>
 <label className="text-sm font-semibold" style={{ color: 'var(--cds-text-primary, #161616)' }}>Client *</label>
 <select
 required
 value={paymentForm.client_id}
 onChange={e => {
 const selectedClient = clientOptions.find(c => c.id === e.target.value);
 if (selectedClient) {
 setPaymentForm(current => ({
 ...current,
 client_id: selectedClient.id,
 client_name: selectedClient.name,
 }));
 } else {
 setPaymentForm(current => ({
 ...current,
 client_id: '',
 client_name: '',
 }));
 }
 setPaymentAllocationForm([createEmptyPaymentAllocationDraft()]);
 }}
 className="w-full px-3 py-3 sm:px-4 sm:py-3 text-sm sm:text-base outline-none focus:ring-2 focus:ring-green-500" style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--cds-border-subtle, #c6c6c6)' }}
 >
 <option value="">Select client</option>
 {clientOptions.map(client => (
 <option key={client.id} value={client.id}>
 {client.name}{!client.isRegistered ? ' (unregistered)' : ''}
 </option>
 ))}
 </select>
 </div>
 <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
 <div className="col-span-1">
 <label className="text-sm font-semibold" style={{ color: 'var(--cds-text-primary, #161616)' }}>Amount *</label>
 <input
 required
 value={paymentForm.amount}
 onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })}
 type="number"
 step="0.01"
 placeholder="0.00"
 className="w-full px-3 py-3 sm:px-4 sm:py-3 text-sm sm:text-base outline-none focus:ring-2 focus:ring-green-500" style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--cds-border-subtle, #c6c6c6)' }}
 />
 </div>
 <div className="col-span-1">
 <label className="text-sm font-semibold" style={{ color: 'var(--cds-text-primary, #161616)' }}>Currency</label>
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
 className="w-full px-3 py-3 sm:px-4 sm:py-3 text-sm sm:text-base outline-none focus:ring-2 focus:ring-green-500" style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--cds-border-subtle, #c6c6c6)' }}
 >
 <option value="USD">USD ($)</option>
 <option value="GBP">GBP (£)</option>
 </select>
 </div>
 <div className="col-span-2 sm:col-span-1">
 <label className="text-sm font-semibold" style={{ color: 'var(--cds-text-primary, #161616)' }}>Method</label>
 <select
 value={paymentForm.method}
 onChange={e => setPaymentForm({ ...paymentForm, method: e.target.value })}
 className="w-full px-3 py-3 sm:px-4 sm:py-3 text-sm sm:text-base outline-none focus:ring-2 focus:ring-green-500" style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--cds-border-subtle, #c6c6c6)' }}
 >
 <option value="Bank Transfer">Bank Transfer</option>
 <option value="Cash">Cash</option>
 <option value="Card">Card</option>
 <option value="Check">Check</option>
 <option value="Other">Other</option>
 </select>
 </div>
 </div>
 <div className="p-3 sm:p-4" style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--cds-border-subtle, #c6c6c6)', backgroundColor: 'var(--cds-layer-02, #f4f4f4)' }}>
 <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
 <div className="flex-1">
 <label className="text-sm font-semibold" style={{ color: 'var(--cds-text-primary, #161616)' }}>Allocations (Optional)</label>
 <p className="mt-1 text-xs" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Split this payment across open invoices.</p>
 </div>
 <button
 type="button"
 onClick={() => setPaymentAllocationForm(current => [...current, createEmptyPaymentAllocationDraft()])}
 disabled={!paymentForm.client_name}
 className="w-full sm:w-auto px-3 py-3 sm:py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation" style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--cds-support-success, #24a148)', color: 'var(--cds-support-success, #24a148)' }}
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
 <div key={`${allocation.invoice_id || 'new'}-${index}`} className="p-3 sm:p-4" style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--cds-border-subtle, #c6c6c6)', backgroundColor: 'var(--cds-layer-01, #ffffff)' }}>
 <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.6fr,0.9fr,auto]">
 <div>
 <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Invoice</label>
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
 className="w-full px-4 py-3 outline-none focus:ring-2 focus:ring-green-500" style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--cds-border-subtle, #c6c6c6)' }}
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
 <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Allocated Amount</label>
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
 className="w-full px-4 py-3 outline-none focus:ring-2 focus:ring-green-500" style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--cds-border-subtle, #c6c6c6)' }}
 />
 {selectedInvoice ? (
 <p className="mt-1 text-[11px]" style={{ color: 'var(--cds-text-secondary, #525252)' }}>
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
 className="px-3 py-3 sm:py-2 text-xs font-bold touch-manipulation" style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--cds-support-error, #da1e28)', color: 'var(--cds-support-error, #da1e28)' }}
 >
 Remove
 </button>
 </div>
 </div>
 </div>
 );
 })}
 {!paymentForm.client_name ? (
 <p className="text-xs" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Choose a client first to allocate this payment to invoices.</p>
 ) : paymentAllocationCandidates.length === 0 ? (
 <div className="p-3" style={{ backgroundColor: 'var(--cds-layer-01, #ffffff)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--cds-border-subtle, #c6c6c6)' }}>
 <p className="text-xs" style={{ color: 'var(--cds-text-secondary, #525252)' }}>
 No pending invoices found for this client in {paymentForm.currency}.
 </p>
 <p className="mt-2 text-xs font-semibold" style={{ color: 'var(--cds-support-warning, #f1c21b)' }}>
 This payment will be recorded as UNALLOCATED (client credit).
 </p>
 <p className="mt-1 text-xs" style={{ color: 'var(--cds-text-secondary, #525252)' }}>
 The payment will reduce the client&apos;s balance and can be allocated to invoices later.
 </p>
 </div>
 ) : null}
 <div className="flex items-center justify-between px-4 py-3 text-sm text-white" style={{ backgroundColor: 'var(--cds-text-primary, #161616)' }}>
 <span className="font-semibold" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Allocated Total</span>
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
 <label className="text-sm font-semibold" style={{ color: 'var(--cds-text-primary, #161616)' }}>Notes</label>
 <textarea
 rows={2}
 value={paymentForm.notes}
 onChange={e => setPaymentForm({ ...paymentForm, notes: e.target.value })}
 placeholder="Optional receipt notes..."
 className="w-full px-3 py-3 sm:px-4 sm:py-3 text-sm sm:text-base outline-none focus:ring-2 focus:ring-green-500" style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--cds-border-subtle, #c6c6c6)' }}
 />
 </div>
 <div className="sticky bottom-0 -mx-4 sm:mx-0 -mb-4 sm:mb-0 pt-4 sm:pt-4 mt-4 sm:mt-4" style={{ backgroundColor: 'var(--cds-layer-01, #ffffff)', borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: 'var(--cds-border-subtle, #c6c6c6)' }}>
 <div className="flex gap-3">
 <button
 type="button"
 onClick={closePaymentModal}
 className="flex-1 px-4 py-3 sm:py-3 text-sm font-bold touch-manipulation" style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--cds-border-subtle, #c6c6c6)', color: 'var(--cds-text-secondary, #525252)' }}
 >
 Cancel
 </button>
 <Button
 type="submit"
 variant="primary"
 isLoading={isSubmittingPayment}
 disabled={isSubmittingPayment}
 className="flex-1"
 >
 {editingPayment ? 'Save' : 'Record'}
 </Button>
 </div>
 </div>
 </form>
 </div>
 </div>
 )}

 <ClientFormModal
 isOpen={showClientModal}
 title={clientModalTarget === 'quote' ? 'Add Client for Quote' : 'Add Client for Invoice'}
 onClose={closeClientModal}
 onSubmit={handleSaveClient}
 form={clientForm}
 onChange={(updates) => setClientForm((current) => ({ ...current, ...updates }))}
 submitLabel="Create Client"
 />

 {previewUrl && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
 <div className="absolute inset-0 backdrop-blur-sm" onClick={closePreview} style={{ backgroundColor: 'rgba(22, 22, 22, 0.6)' }} />
 <div className="relative h-[88vh] w-full max-w-6xl overflow-hidden" style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--cds-border-subtle, #c6c6c6)', backgroundColor: 'var(--cds-layer-01, #ffffff)' }}>
 <div className="flex items-center justify-between gap-4 px-6 py-4" style={{ borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: 'var(--cds-border-subtle, #c6c6c6)', backgroundColor: 'var(--cds-layer-02, #f4f4f4)' }}>
 <div>
 <h3 className="text-lg font-black" style={{ color: 'var(--cds-text-primary, #161616)' }}>{previewTitle} Preview</h3>
 <p className="text-sm" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Review the PDF before downloading or sharing it.</p>
 </div>
 <div className="flex items-center gap-3">
 <a
 href={previewUrl}
 target="_blank"
 rel="noreferrer"
 className="px-4 py-2 text-sm font-bold transition-colors" style={{ backgroundColor: 'var(--cds-layer-02, #f4f4f4)', color: 'var(--cds-interactive, #0f62fe)' }}
 >
 Open in New Tab
 </a>
 <a
 href={previewUrl}
 download={`${previewTitle.replace(/\s+/g, '_')}.pdf`}
 className="px-4 py-2 text-sm font-bold transition-colors" style={{ backgroundColor: 'var(--cds-layer-02, #f4f4f4)', color: 'var(--cds-support-success, #24a148)' }}
 >
 Download PDF
 </a>
 <button
 type="button"
 onClick={closePreview}
 className="px-4 py-2 text-sm font-bold transition-colors" style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--cds-border-subtle, #c6c6c6)', color: 'var(--cds-text-secondary, #525252)' }}
 >
 Close
 </button>
 </div>
 </div>
 <iframe src={previewUrl} title={previewTitle} className="h-[calc(88vh-73px)] w-full" style={{ backgroundColor: 'var(--cds-layer-02, #f4f4f4)' }} />
 </div>
 </div>
 )}

 <div className="overflow-hidden" style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--cds-border-subtle, #c6c6c6)', backgroundColor: 'var(--cds-layer-01, #ffffff)' }}>
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
 deletingKey={deletingKey}
 formatMoney={formatMoney}
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
 deletingKey={deletingKey}
 formatMoney={formatMoney}
 onPreview={handlePreviewInvoice}
 onEdit={openEditInvoiceModal}
 onDownload={handleDownloadInvoice}
 onDelete={handleDeleteInvoice}
 />
 )}

 {activeTab === 'payments' && (
 <PaymentsSection
 payments={payments}
 deletingKey={deletingKey}
 formatMoney={formatMoney}
 getPaymentClientName={getPaymentClientName}
 getPaymentCurrency={getPaymentCurrency}
 getPaymentAllocationSummary={getPaymentAllocationSummary}
 onEdit={openEditPaymentModal}
 onDelete={handleDeletePayment}
 />
 )}

 {activeTab === 'receipts' && (
 <ReceiptsSection
 receipts={receipts}
 deletingKey={deletingKey}
 formatMoney={formatMoney}
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
