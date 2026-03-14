
import React, { useState, useEffect } from 'react';
import { Quote, Invoice, Payment, Vehicle, CompanyDetails, LineItem } from '../types';
import { supabase } from '../services/supabaseService';
import { generateQuotePDF, generateInvoicePDF, generateQuotePDFAndDownload, generateInvoicePDFAndDownload } from '../services/pdfService';
import { useToast } from './Toast';

// Default empty line item
const createEmptyLineItem = (): LineItem => ({
  description: '',
  quantity: 1,
  unit_price: 0,
  amount: 0,
  tax_rate: 0,
  tax_amount: 0
});

const formatMoney = (amount: number, currency: 'USD' | 'GBP' = 'USD') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

export const Financials: React.FC = () => {
  const { showToast, ToastContainer } = useToast();
  const [activeTab, setActiveTab] = useState<'quotes' | 'invoices' | 'payments'>('quotes');
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [company, setCompany] = useState<CompanyDetails | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');
  
  // Form states for Quote
  const [quoteForm, setQuoteForm] = useState({
    vehicle_id: '',
    client_name: '',
    client_email: '',
    client_address: '',
    currency: 'USD' as 'USD' | 'GBP',
    description: '',
    valid_until: '',
    status: 'Draft' as const
  });
  
  // Quote line items
  const [quoteLineItems, setQuoteLineItems] = useState<LineItem[]>([createEmptyLineItem()]);
  
  // Form states for Invoice
  const [invoiceForm, setInvoiceForm] = useState({
    vehicle_id: '',
    client_name: '',
    client_email: '',
    client_address: '',
    currency: 'USD' as 'USD' | 'GBP',
    description: '',
    notes: '',
    terms_and_conditions: 'Payment is due by the date specified above. Please include the invoice number with your payment.',
    due_date: '',
    status: 'Draft' as const
  });
  
  // Invoice line items
  const [invoiceLineItems, setInvoiceLineItems] = useState<LineItem[]>([createEmptyLineItem()]);
  
  // Calculate line item amount
  const calculateLineAmount = (item: LineItem): number => {
    const subtotal = item.quantity * item.unit_price;
    const tax = (item.tax_rate || 0) * subtotal / 100;
    return subtotal + tax;
  };
  
  // Calculate total from line items
  const calculateTotal = (items: LineItem[]): number => {
    return items.reduce((sum, item) => sum + calculateLineAmount(item), 0);
  };
  
  // Update quote line item
  const updateQuoteLineItem = (index: number, field: keyof LineItem, value: any) => {
    const updated = [...quoteLineItems];
    updated[index] = { ...updated[index], [field]: value };
    // Recalculate amount
    updated[index].amount = updated[index].quantity * updated[index].unit_price;
    updated[index].tax_amount = (updated[index].tax_rate || 0) * updated[index].amount / 100;
    setQuoteLineItems(updated);
  };
  
  // Update invoice line item
  const updateInvoiceLineItem = (index: number, field: keyof LineItem, value: any) => {
    const updated = [...invoiceLineItems];
    updated[index] = { ...updated[index], [field]: value };
    // Recalculate amount
    updated[index].amount = updated[index].quantity * updated[index].unit_price;
    updated[index].tax_amount = (updated[index].tax_rate || 0) * updated[index].amount / 100;
    setInvoiceLineItems(updated);
  };
  
  // Add/remove line items
  const addQuoteLineItem = () => setQuoteLineItems([...quoteLineItems, createEmptyLineItem()]);
  const removeQuoteLineItem = (index: number) => {
    if (quoteLineItems.length > 1) {
      setQuoteLineItems(quoteLineItems.filter((_, i) => i !== index));
    }
  };
  
  const addInvoiceLineItem = () => setInvoiceLineItems([...invoiceLineItems, createEmptyLineItem()]);
  const removeInvoiceLineItem = (index: number) => {
    if (invoiceLineItems.length > 1) {
      setInvoiceLineItems(invoiceLineItems.filter((_, i) => i !== index));
    }
  };

  // FIX: Centralized data loading function for consistent refresh
  const loadData = async (throwOnError = false) => {
    try {
      console.log('[Financials] loadData: Fetching financial data...');
      const [q, i, p, v, c] = await Promise.all([
        supabase.getQuotes(),
        supabase.getInvoices(),
        supabase.getPayments(),
        supabase.getVehicles(),
        supabase.getCompanyDetails()
      ]);
      console.log('[Financials] loadData: Successfully fetched', { quotes: q?.length, invoices: i?.length });
      setQuotes(q);
      setInvoices(i);
      setPayments(p);
      setVehicles(v);
      setCompany(c);
      setLoading(false);
    } catch (error: any) {
      console.error('[Financials] loadData: Error loading financial data:', error);
      setLoading(false);
      if (throwOnError) throw error;
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

  const handleCreateQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Validate line items
      const validItems = quoteLineItems.filter(item => item.description.trim() && item.quantity > 0);
      if (validItems.length === 0) {
        showToast('Please add at least one line item with a description', 'warning');
        return;
      }
      
      const totalAmount = calculateTotal(validItems);
      
      console.log('[Financials] handleCreateQuote: Creating quote with', validItems.length, 'line items, total:', totalAmount);
      const newQuote = await supabase.createQuote({
        vehicle_id: quoteForm.vehicle_id || undefined,
        client_name: quoteForm.client_name,
        client_email: quoteForm.client_email,
        client_address: quoteForm.client_address,
        currency: quoteForm.currency,
        amount_usd: totalAmount,
        description: quoteForm.description,
        valid_until: quoteForm.valid_until,
        status: quoteForm.status,
        items: validItems.map((item, idx) => ({ ...item, line_number: idx + 1 }))
      });
      console.log('[Financials] handleCreateQuote: Quote created successfully:', newQuote?.id);
      
      setShowQuoteModal(false);
      resetQuoteForm();
      
      // FIX: Refetch from database instead of local state update to ensure data consistency
      try {
        await loadData(true);
        showToast('Quote created successfully!', 'success');
      } catch (refreshError) {
        console.error('[Financials] handleCreateQuote: Quote saved but refresh failed:', refreshError);
        showToast('Quote created, but the list did not refresh. Please refresh the page.', 'warning');
      }
    } catch (error: any) {
      console.error('[Financials] handleCreateQuote: Error creating quote:', error);
      showToast(error?.message || 'Failed to create quote', 'error');
    }
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Validate line items
      const validItems = invoiceLineItems.filter(item => item.description.trim() && item.quantity > 0);
      if (validItems.length === 0) {
        showToast('Please add at least one line item with a description', 'warning');
        return;
      }
      
      const totalAmount = calculateTotal(validItems);
      
      console.log('[Financials] handleCreateInvoice: Creating invoice with', validItems.length, 'line items, total:', totalAmount);
      const newInvoice = await supabase.createInvoice({
        vehicle_id: invoiceForm.vehicle_id || undefined,
        client_name: invoiceForm.client_name,
        client_email: invoiceForm.client_email,
        client_address: invoiceForm.client_address,
        amount_usd: totalAmount,
        currency: invoiceForm.currency,
        description: invoiceForm.description,
        notes: invoiceForm.notes,
        terms_and_conditions: invoiceForm.terms_and_conditions,
        due_date: invoiceForm.due_date,
        status: invoiceForm.status,
        items: validItems.map((item, idx) => ({ ...item, line_number: idx + 1 }))
      });
      console.log('[Financials] handleCreateInvoice: Invoice created successfully:', newInvoice?.id);
      
      setShowInvoiceModal(false);
      resetInvoiceForm();
      
      // FIX: Refetch from database instead of local state update to ensure data consistency
      try {
        await loadData(true);
        showToast('Invoice created successfully!', 'success');
      } catch (refreshError) {
        console.error('[Financials] handleCreateInvoice: Invoice saved but refresh failed:', refreshError);
        showToast('Invoice created, but the list did not refresh. Please refresh the page.', 'warning');
      }
    } catch (error: any) {
      console.error('[Financials] handleCreateInvoice: Error creating invoice:', error);
      showToast(error?.message || 'Failed to create invoice', 'error');
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

  const openPreview = (blob: Blob, title: string) => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    setPreviewTitle(title);
  };

  const closePreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setPreviewTitle('');
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

  const resetQuoteForm = () => {
    setQuoteForm({
      vehicle_id: '',
      client_name: '',
      client_email: '',
      client_address: '',
      currency: 'USD',
      description: '',
      valid_until: '',
      status: 'Draft'
    });
    setQuoteLineItems([createEmptyLineItem()]);
  };

  const resetInvoiceForm = () => {
    setInvoiceForm({
      vehicle_id: '',
      client_name: '',
      client_email: '',
      client_address: '',
      currency: 'USD',
      description: '',
      notes: '',
      terms_and_conditions: 'Payment is due by the date specified above. Please include the invoice number with your payment.',
      due_date: '',
      status: 'Draft'
    });
    setInvoiceLineItems([createEmptyLineItem()]);
  };

  if (loading) return <div className="animate-pulse flex h-64 items-center justify-center">Loading Financial Records...</div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <ToastContainer />
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Finance Management</h2>
          <p className="text-zinc-500 font-medium">Quotes, Billing, and Transaction Ledger</p>
        </div>
        <div className="flex gap-2">
           <button 
             onClick={() => setShowQuoteModal(true)}
             className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-2"
           >
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
             New Quote
           </button>
           <button 
             onClick={() => setShowInvoiceModal(true)}
             className="bg-green-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-xl shadow-green-100 hover:bg-green-700 transition-all flex items-center gap-2"
           >
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
             New Invoice
           </button>
        </div>
      </div>

      {/* Quote Modal */}
      {showQuoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={() => setShowQuoteModal(false)}></div>
          <div className="relative bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-black text-zinc-900 mb-6">Create New Quote</h3>
            <form onSubmit={handleCreateQuote} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-sm font-semibold text-zinc-700">Vehicle (Optional)</label>
                  <select
                    value={quoteForm.vehicle_id}
                    onChange={(e) => setQuoteForm({...quoteForm, vehicle_id: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">No Vehicle (Custom Quote)</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.make_model} ({v.vin_number})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-zinc-700">Client Name</label>
                  <input
                    required
                    value={quoteForm.client_name}
                    onChange={(e) => setQuoteForm({...quoteForm, client_name: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-zinc-700">Client Email</label>
                  <input
                    type="email"
                    value={quoteForm.client_email}
                    onChange={(e) => setQuoteForm({...quoteForm, client_email: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-semibold text-zinc-700">Client Address</label>
                  <textarea
                    value={quoteForm.client_address}
                    onChange={(e) => setQuoteForm({...quoteForm, client_address: e.target.value})}
                    rows={2}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-zinc-700">Valid Until</label>
                  <input
                    type="date"
                    value={quoteForm.valid_until}
                    onChange={(e) => setQuoteForm({...quoteForm, valid_until: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-zinc-700">Currency</label>
                  <select
                    value={quoteForm.currency}
                    onChange={(e) => setQuoteForm({ ...quoteForm, currency: e.target.value as 'USD' | 'GBP' })}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="USD">US Dollar (USD)</option>
                    <option value="GBP">British Pound (GBP)</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-zinc-700">Notes</label>
                  <input
                    value={quoteForm.description}
                    onChange={(e) => setQuoteForm({...quoteForm, description: e.target.value})}
                    placeholder="Additional notes..."
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                
                {/* Line Items Section */}
                <div className="col-span-2 border-t pt-4 mt-2">
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-sm font-bold text-zinc-800">Line Items</label>
                    <button
                      type="button"
                      onClick={addQuoteLineItem}
                      className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg font-bold hover:bg-blue-200"
                    >
                      + Add Line
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {quoteLineItems.map((item, index) => (
                      <div key={index} className="bg-zinc-50 rounded-xl p-3 border border-zinc-200">
                        <div className="grid grid-cols-12 gap-2 items-end">
                          <div className="col-span-5">
                            <label className="text-xs text-zinc-500">Description</label>
                            <input
                              required
                              value={item.description}
                              onChange={(e) => updateQuoteLineItem(index, 'description', e.target.value)}
                              placeholder="Item description..."
                              className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-xs text-zinc-500">Qty</label>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateQuoteLineItem(index, 'quantity', parseFloat(e.target.value) || 1)}
                              className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-xs text-zinc-500">Unit Price ({quoteForm.currency})</label>
                            <input
                              type="number"
                              step="0.01"
                              value={item.unit_price}
                              onChange={(e) => updateQuoteLineItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                              className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-xs text-zinc-500">Amount</label>
                            <div className="px-3 py-2 bg-zinc-100 rounded-lg text-sm font-semibold text-zinc-700">
                              {formatMoney(calculateLineAmount(item), quoteForm.currency)}
                            </div>
                          </div>
                          <div className="col-span-1">
                            {quoteLineItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeQuoteLineItem(index)}
                                className="w-full p-2 text-red-500 hover:bg-red-50 rounded-lg"
                              >
                                <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Total */}
                  <div className="flex justify-end mt-4 pt-3 border-t">
                    <div className="text-right">
                      <span className="text-sm text-zinc-500">Total:</span>
                      <span className="ml-3 text-2xl font-black text-zinc-900">{formatMoney(calculateTotal(quoteLineItems), quoteForm.currency)}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowQuoteModal(false)} className="flex-1 px-4 py-3 rounded-xl font-bold text-sm text-zinc-500 border border-zinc-200 hover:bg-zinc-50">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-3 rounded-xl font-bold text-sm bg-blue-600 text-white hover:bg-blue-700">Create Quote</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Modal */}
      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={() => setShowInvoiceModal(false)}></div>
          <div className="relative bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-black text-zinc-900 mb-2">Create New Invoice</h3>
            <p className="text-sm text-zinc-500 mb-6">Build a polished customer invoice with itemized charges, tailored notes, and clear payment terms.</p>
            <form onSubmit={handleCreateInvoice} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-sm font-semibold text-zinc-700">Vehicle (Optional)</label>
                  <select
                    value={invoiceForm.vehicle_id}
                    onChange={(e) => setInvoiceForm({...invoiceForm, vehicle_id: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-green-500 outline-none"
                  >
                    <option value="">No Vehicle (Custom Invoice)</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.make_model} ({v.vin_number})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-zinc-700">Client Name</label>
                  <input
                    required
                    value={invoiceForm.client_name}
                    onChange={(e) => setInvoiceForm({...invoiceForm, client_name: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-green-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-zinc-700">Client Email</label>
                  <input
                    type="email"
                    value={invoiceForm.client_email}
                    onChange={(e) => setInvoiceForm({...invoiceForm, client_email: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-green-500 outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-semibold text-zinc-700">Client Address</label>
                  <textarea
                    value={invoiceForm.client_address}
                    onChange={(e) => setInvoiceForm({...invoiceForm, client_address: e.target.value})}
                    rows={2}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-green-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-zinc-700">Currency</label>
                  <select
                    value={invoiceForm.currency}
                    onChange={(e) => setInvoiceForm({...invoiceForm, currency: e.target.value as 'USD' | 'GBP'})}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-green-500 outline-none"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-zinc-700">Due Date</label>
                  <input
                    required
                    type="date"
                    value={invoiceForm.due_date}
                    onChange={(e) => setInvoiceForm({...invoiceForm, due_date: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-green-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-zinc-700">Summary</label>
                  <input
                    value={invoiceForm.description}
                    onChange={(e) => setInvoiceForm({...invoiceForm, description: e.target.value})}
                    placeholder="Short invoice summary..."
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-green-500 outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-semibold text-zinc-700">Notes</label>
                  <textarea
                    value={invoiceForm.notes}
                    onChange={(e) => setInvoiceForm({...invoiceForm, notes: e.target.value})}
                    rows={3}
                    placeholder="Optional notes to appear on the invoice..."
                    className="w-full px-4 py-3 rounded-2xl border border-zinc-200 bg-zinc-50/70 focus:bg-white focus:ring-2 focus:ring-green-500 outline-none resize-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-semibold text-zinc-700">Terms & Conditions</label>
                  <textarea
                    value={invoiceForm.terms_and_conditions}
                    onChange={(e) => setInvoiceForm({...invoiceForm, terms_and_conditions: e.target.value})}
                    rows={4}
                    placeholder="Payment terms, late fees, banking instructions, delivery terms..."
                    className="w-full px-4 py-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 focus:bg-white focus:ring-2 focus:ring-green-500 outline-none resize-none"
                  />
                  <p className="mt-2 text-xs text-zinc-500">These terms will be printed in the invoice PDF.</p>
                </div>
                
                {/* Line Items Section */}
                <div className="col-span-2 border-t pt-4 mt-2">
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-sm font-bold text-zinc-800">Line Items</label>
                    <button
                      type="button"
                      onClick={addInvoiceLineItem}
                      className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-lg font-bold hover:bg-green-200"
                    >
                      + Add Line
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {invoiceLineItems.map((item, index) => (
                      <div key={index} className="bg-zinc-50 rounded-xl p-3 border border-zinc-200">
                        <div className="grid grid-cols-12 gap-2 items-end">
                          <div className="col-span-5">
                            <label className="text-xs text-zinc-500">Description</label>
                            <input
                              required
                              value={item.description}
                              onChange={(e) => updateInvoiceLineItem(index, 'description', e.target.value)}
                              placeholder="Item description..."
                              className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-xs text-zinc-500">Qty</label>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateInvoiceLineItem(index, 'quantity', parseFloat(e.target.value) || 1)}
                              className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-xs text-zinc-500">Unit Price</label>
                            <input
                              type="number"
                              step="0.01"
                              value={item.unit_price}
                              onChange={(e) => updateInvoiceLineItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                              className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-xs text-zinc-500">Amount</label>
                            <div className="px-3 py-2 bg-zinc-100 rounded-lg text-sm font-semibold text-zinc-700">
                              ${calculateLineAmount(item).toFixed(2)}
                            </div>
                          </div>
                          <div className="col-span-1">
                            {invoiceLineItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeInvoiceLineItem(index)}
                                className="w-full p-2 text-red-500 hover:bg-red-50 rounded-lg"
                              >
                                <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Total */}
                  <div className="flex justify-end mt-4 pt-3 border-t">
                    <div className="text-right">
                      <span className="text-sm text-zinc-500">Total:</span>
                      <span className="ml-3 text-2xl font-black text-zinc-900">{formatMoney(calculateTotal(invoiceLineItems), invoiceForm.currency)}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowInvoiceModal(false)} className="flex-1 px-4 py-3 rounded-xl font-bold text-sm text-zinc-500 border border-zinc-200 hover:bg-zinc-50">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-3 rounded-xl font-bold text-sm bg-green-600 text-white hover:bg-green-700">Create Invoice</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" onClick={closePreview}></div>
          <div className="relative w-full max-w-6xl h-[88vh] bg-white rounded-3xl shadow-2xl overflow-hidden border border-zinc-200">
            <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-zinc-200 bg-zinc-50">
              <div>
                <h3 className="text-lg font-black text-zinc-900">{previewTitle} Preview</h3>
                <p className="text-sm text-zinc-500">Review the PDF before downloading or sharing it.</p>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-xl text-sm font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                >
                  Open in New Tab
                </a>
                <button
                  type="button"
                  onClick={closePreview}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-zinc-600 border border-zinc-200 hover:bg-zinc-100 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
            <iframe
              src={previewUrl}
              title={previewTitle}
              className="w-full h-[calc(88vh-73px)] bg-zinc-100"
            />
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-zinc-100 bg-zinc-50/50 p-2">
          {['quotes', 'invoices', 'payments'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                activeTab === tab 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-zinc-400 hover:text-zinc-600'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          {activeTab === 'quotes' && (
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-100">
                <tr>
                  <th className="px-8 py-4 font-black text-zinc-400 uppercase tracking-widest text-[10px]">Quote #</th>
                  <th className="px-8 py-4 font-black text-zinc-400 uppercase tracking-widest text-[10px]">Client</th>
                  <th className="px-8 py-4 font-black text-zinc-400 uppercase tracking-widest text-[10px]">Amount</th>
                  <th className="px-8 py-4 font-black text-zinc-400 uppercase tracking-widest text-[10px]">Status</th>
                  <th className="px-8 py-4 font-black text-zinc-400 uppercase tracking-widest text-[10px]">Created</th>
                  <th className="px-8 py-4 font-black text-zinc-400 uppercase tracking-widest text-[10px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {quotes.map(q => (
                  <tr key={q.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-8 py-4 font-mono text-xs font-bold text-blue-600">{q.quote_number}</td>
                    <td className="px-8 py-4 font-bold text-zinc-900">{q.client_name}</td>
                    <td className="px-8 py-4 font-black text-zinc-900">{formatMoney(q.amount_usd, q.currency || 'USD')}</td>
                    <td className="px-8 py-4">
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md text-[10px] font-black uppercase tracking-tighter">{q.status}</span>
                    </td>
                    <td className="px-8 py-4 text-zinc-400 text-xs">{new Date(q.created_at).toLocaleDateString()}</td>
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => handlePreviewQuote(q)}
                          className="text-zinc-600 hover:text-zinc-900 font-bold text-xs flex items-center gap-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          Preview
                        </button>
                        <button 
                          onClick={() => handleDownloadQuote(q)}
                          className="text-blue-600 hover:text-blue-700 font-bold text-xs flex items-center gap-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          Download
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'invoices' && (
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-100">
                <tr>
                  <th className="px-8 py-4 font-black text-zinc-400 uppercase tracking-widest text-[10px]">Invoice #</th>
                  <th className="px-8 py-4 font-black text-zinc-400 uppercase tracking-widest text-[10px]">Client</th>
                  <th className="px-8 py-4 font-black text-zinc-400 uppercase tracking-widest text-[10px]">Amount</th>
                  <th className="px-8 py-4 font-black text-zinc-400 uppercase tracking-widest text-[10px]">Status</th>
                  <th className="px-8 py-4 font-black text-zinc-400 uppercase tracking-widest text-[10px]">Due Date</th>
                  <th className="px-8 py-4 font-black text-zinc-400 uppercase tracking-widest text-[10px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {invoices.map(i => (
                  <tr key={i.id} className="hover:bg-zinc-50">
                    <td className="px-8 py-4 font-mono font-bold text-green-600">{i.invoice_number}</td>
                    <td className="px-8 py-4 font-bold text-zinc-900">{i.client_name}</td>
                    <td className="px-8 py-4 font-black text-zinc-900">${i.amount_usd.toLocaleString()}</td>
                    <td className="px-8 py-4">
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-md text-[10px] font-black uppercase tracking-tighter">{i.status}</span>
                    </td>
                    <td className="px-8 py-4 text-zinc-400 text-xs">{new Date(i.due_date).toLocaleDateString()}</td>
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => handlePreviewInvoice(i)}
                          className="text-zinc-600 hover:text-zinc-900 font-bold text-xs flex items-center gap-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          Preview
                        </button>
                        <button 
                          onClick={() => handleDownloadInvoice(i)}
                          className="text-green-600 hover:text-green-700 font-bold text-xs flex items-center gap-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          Download
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'payments' && (
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-100">
                <tr>
                  <th className="px-8 py-4 font-black text-zinc-400 uppercase tracking-widest text-[10px]">Type</th>
                  <th className="px-8 py-4 font-black text-zinc-400 uppercase tracking-widest text-[10px]">Amount</th>
                  <th className="px-8 py-4 font-black text-zinc-400 uppercase tracking-widest text-[10px]">Method</th>
                  <th className="px-8 py-4 font-black text-zinc-400 uppercase tracking-widest text-[10px]">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {payments.map(p => (
                  <tr key={p.id}>
                    <td className="px-8 py-4">
                      <span className={`font-black text-[10px] uppercase ${p.type === 'Inbound' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {p.type}
                      </span>
                    </td>
                    <td className="px-8 py-4 font-black text-zinc-900">${p.amount_usd.toLocaleString()}</td>
                    <td className="px-8 py-4 font-medium text-zinc-500">{p.method}</td>
                    <td className="px-8 py-4 text-zinc-400 text-xs">{new Date(p.date).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
