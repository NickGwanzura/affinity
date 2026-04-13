import React, { useEffect, useState, useMemo } from 'react';
import { Client, Invoice, Quote, Payment } from '../types';
import { dataService } from '../services/dataService';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmModal';
import { Modal, TextInput, Button, Form, Stack, Tag } from '@carbon/react';
import { Add, Edit, TrashCan, DocumentDownload } from '@carbon/icons-react';
import { generateStatementPDF } from '../services/pdfService';

const formatMoney = (amount: number, currency = 'USD') => {
  const symbol = currency === 'GBP' ? '£' : '$';
  return `${symbol}${(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const statusColor: Record<string, string> = {
  Paid:     'bg-[var(--cds-support-success,#24a148)] text-white',
  Sent:     'bg-[var(--cds-interactive,#0f62fe)] text-white',
  Overdue:  'bg-[var(--cds-support-error,#da1e28)] text-white',
  Draft:    'bg-[var(--cds-layer-02,#f4f4f4)] text-[var(--cds-text-secondary,#525252)]',
  Accepted: 'bg-[var(--cds-support-success,#24a148)] text-white',
  Rejected: 'bg-[var(--cds-support-error,#da1e28)] text-white',
  Approved: 'bg-[var(--cds-support-warning,#f1c21b)] text-[var(--cds-text-primary,#161616)]',
};

interface ClientFormData {
  name: string;
  email: string;
  phone: string;
  company: string;
  address: string;
  notes: string;
  opening_balance: string;
  opening_balance_currency: 'USD' | 'GBP';
}

const emptyForm: ClientFormData = {
  name: '',
  email: '',
  phone: '',
  company: '',
  address: '',
  notes: '',
  opening_balance: '0',
  opening_balance_currency: 'USD',
};

export const ClientDirectory: React.FC = () => {
  const { showToast, ToastContainer } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [detailTab, setDetailTab] = useState<'invoices' | 'quotes' | 'payments' | 'statement'>('invoices');
  const showMobileDetail = Boolean(selectedClient);

  // Modal states
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState<ClientFormData>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Statement date range
  const [statementDateFrom, setStatementDateFrom] = useState('');
  const [statementDateTo, setStatementDateTo] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [cli, inv, quo, pay] = await Promise.all([
        dataService.getClients(),
        dataService.getInvoices(),
        dataService.getQuotes(),
        dataService.getPayments(),
      ]);
      setClients(cli);
      setInvoices(inv);
      setQuotes(quo);
      setPayments(pay);
    } catch (err: any) {
      showToast(err?.message || 'Failed to load client directory', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Build enriched client list
  const enrichedClients = useMemo(() => {
    const clientMap = new Map<string, Client & { isRegistered: boolean }>();

    // First add registered clients
    for (const c of clients) {
      const key = c.name.trim().toLowerCase();
      clientMap.set(key, { ...c, isRegistered: true });
    }

    // Add clients from invoices not in registry
    for (const inv of invoices) {
      const key = inv.client_name.trim().toLowerCase();
      if (!clientMap.has(key)) {
        clientMap.set(key, {
          id: `inv-${key}`,
          name: inv.client_name,
          email: inv.client_email || '',
          company: undefined,
          phone: undefined,
          address: inv.client_address,
          notes: '',
          opening_balance: 0,
          opening_balance_currency: 'USD',
          is_active: true,
          created_at: new Date().toISOString(),
          isRegistered: false,
        } as any);
      }
    }

    return Array.from(clientMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [clients, invoices]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return enrichedClients;
    return enrichedClients.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.company || '').toLowerCase().includes(q)
    );
  }, [enrichedClients, search]);

  const getClientInvoices = (name: string) =>
    invoices.filter(i => i.client_name.trim().toLowerCase() === name.trim().toLowerCase());

  const getClientQuotes = (name: string) =>
    quotes.filter(q => q.client_name.trim().toLowerCase() === name.trim().toLowerCase());

  const getClientPayments = (name: string) =>
    payments.filter(p => (p.client_name || '').trim().toLowerCase() === name.trim().toLowerCase());

  // Calculate true client balance using unified formula:
  // current_balance = opening_balance + total_invoiced - total_paid
  const clientStats = (name: string) => {
    const client = enrichedClients.find(c => c.name.toLowerCase() === name.toLowerCase());
    const inv = getClientInvoices(name);
    const clientPayments = getClientPayments(name);
    
    // Use the unified calculation from dataService if available
    if (client) {
      const balance = dataService.calculateClientBalance(client, invoices, payments);
      return {
        totalBilled: balance.total_invoiced,
        totalPaid: balance.total_paid,
        openingBalance: balance.opening_balance,
        outstanding: balance.current_balance,
        creditBalance: balance.credit_balance,
        invoiceCount: inv.length,
        quoteCount: getClientQuotes(name).length
      };
    }
    
    // Fallback calculation
    const totalBilled = inv.reduce((s, i) => s + (Number(i.amount_usd) || 0), 0);
    const actualPayments = clientPayments.reduce((s, p) => s + (Number(p.amount_usd) || 0), 0);
    const openingBalance = 0;
    const outstanding = totalBilled - actualPayments + openingBalance;
    
    return { 
      totalBilled, 
      totalPaid: actualPayments, 
      openingBalance,
      outstanding,
      creditBalance: 0,
      invoiceCount: inv.length, 
      quoteCount: getClientQuotes(name).length 
    };
  };

  // Generate ledger entries with running balance
  const generateLedger = (clientName: string) => {
    const client = enrichedClients.find(c => c.name.toLowerCase() === clientName.toLowerCase());
    if (!client) return [];

    const openingBalance = Number(client.opening_balance) || 0;
    
    // Build entries array
    const entries: Array<{
      date: Date;
      type: 'opening' | 'invoice' | 'payment';
      reference: string;
      debit: number;
      credit: number;
      id?: string;
    }> = [];

    // Add opening balance if exists
    if (openingBalance !== 0) {
      entries.push({
        date: new Date(client.created_at),
        type: 'opening',
        reference: 'Opening Balance',
        debit: openingBalance > 0 ? openingBalance : 0,
        credit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
      });
    }

    // Add invoices (debits)
    getClientInvoices(clientName).forEach(inv => {
      entries.push({
        date: new Date(inv.created_at),
        type: 'invoice',
        reference: inv.invoice_number,
        debit: Number(inv.amount_usd) || 0,
        credit: 0,
        id: inv.id,
      });
    });

    // Add payments (credits)
    getClientPayments(clientName).forEach(pay => {
      entries.push({
        date: new Date(pay.date),
        type: 'payment',
        reference: pay.reference_id || 'Payment',
        debit: 0,
        credit: Number(pay.amount_usd) || 0,
        id: pay.id,
      });
    });

    // Sort by date
    entries.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Calculate running balance
    let runningBalance = 0;
    return entries.map(entry => {
      runningBalance += entry.debit - entry.credit;
      return {
        ...entry,
        balance: runningBalance,
      };
    });
  };

  // CRUD Operations
  const openAddClient = () => {
    setEditingClient(null);
    setFormData(emptyForm);
    setIsClientModalOpen(true);
  };

  const openEditClient = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      email: client.email || '',
      phone: client.phone || '',
      company: client.company || '',
      address: client.address || '',
      notes: client.notes || '',
      opening_balance: String(client.opening_balance || 0),
      opening_balance_currency: client.opening_balance_currency || 'USD',
    });
    setIsClientModalOpen(true);
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        company: formData.company.trim(),
        address: formData.address.trim(),
        notes: formData.notes.trim(),
        opening_balance: parseFloat(formData.opening_balance) || 0,
        opening_balance_currency: formData.opening_balance_currency,
      };

      if (editingClient) {
        await dataService.updateClient(editingClient.id, payload);
        showToast('Client updated successfully', 'success');
      } else {
        await dataService.createClient(payload as any);
        showToast('Client created successfully', 'success');
      }

      setIsClientModalOpen(false);
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Failed to save client', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClient = async (client: Client) => {
    const confirmed = await confirm({
      title: 'Delete Client?',
      message: `This will soft-delete "${client.name}". Financial history will be preserved.`,
      confirmLabel: 'Delete',
      confirmVariant: 'danger',
    });

    if (!confirmed) return;

    try {
      await dataService.deleteClient(client.id);
      showToast('Client deleted successfully', 'success');
      if (selectedClient?.id === client.id) {
        setSelectedClient(null);
      }
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete client', 'error');
    }
  };

  // Generate client statement PDF
  const generateStatement = async () => {
    if (!selectedClient) return;
    
    try {
      const company = await dataService.getCompanyDetails();
      if (!company) {
        showToast('Company details not found', 'error');
        return;
      }

      const clientInvoices = getClientInvoices(selectedClient.name);
      const clientPayments = getClientPayments(selectedClient.name);

      // Filter by date range if specified
      const filteredInvoices = clientInvoices.filter(inv => {
        if (!statementDateFrom && !statementDateTo) return true;
        const invDate = new Date(inv.created_at).toISOString().split('T')[0];
        if (statementDateFrom && invDate < statementDateFrom) return false;
        if (statementDateTo && invDate > statementDateTo) return false;
        return true;
      });

      const filteredPayments = clientPayments.filter(pay => {
        if (!statementDateFrom && !statementDateTo) return true;
        const payDate = new Date(pay.date).toISOString().split('T')[0];
        if (statementDateFrom && payDate < statementDateFrom) return false;
        if (statementDateTo && payDate > statementDateTo) return false;
        return true;
      });

      // Build payment currency map
      const paymentCurrencyMap: Record<string, 'USD' | 'GBP'> = {};
      filteredPayments.forEach(p => {
        if (p.id && p.currency) {
          paymentCurrencyMap[p.id] = p.currency;
        }
      });

      const statementData = {
        client_name: selectedClient.name,
        client_email: selectedClient.email,
        client_address: selectedClient.address,
        invoices: filteredInvoices,
        payments: filteredPayments,
        paymentCurrencyMap,
        startDate: statementDateFrom || filteredInvoices[0]?.created_at || filteredPayments[0]?.date || new Date().toISOString(),
        endDate: statementDateTo || new Date().toISOString(),
      };

      const blob = await generateStatementPDF(statementData, company);
      
      // Download the PDF
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Statement_${selectedClient.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast('Statement downloaded successfully', 'success');
    } catch (err: any) {
      console.error('Failed to generate statement:', err);
      showToast(err?.message || 'Failed to generate statement', 'error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="flex items-center gap-3 text-[var(--cds-text-secondary,#525252)]">
          <div className="animate-spin h-8 w-8 border-b-2 border-[var(--cds-interactive,#0f62fe)]" />
          <span className="text-sm font-bold uppercase tracking-widest">Loading clients…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--cds-layer-02,#f4f4f4)] p-4 sm:p-6">
      <ToastContainer />
      <ConfirmDialog />

      {/* Header */}
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[var(--cds-text-primary,#161616)]">Client Directory</h1>
          <p className="mt-1 text-[var(--cds-text-secondary,#525252)] text-sm">{enrichedClients.length} clients · search across invoices, quotes & payments</p>
        </div>
        <Button
          renderIcon={Add}
          onClick={openAddClient}
          className="w-full sm:w-auto"
        >
          Add Client
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar list */}
        <div className={`w-full lg:w-80 flex-shrink-0 ${showMobileDetail ? 'hidden lg:block' : ''}`}>
          <div className="bg-[var(--cds-layer-01,#ffffff)] border border-[var(--cds-border-subtle,#c6c6c6)] overflow-hidden">
            <div className="p-4 border-b border-[var(--cds-border-subtle,#c6c6c6)]">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--cds-text-secondary,#525252)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search clients…"
                  className="w-full pl-9 pr-4 py-2.5 border border-[var(--cds-border-subtle,#c6c6c6)] text-sm outline-none focus:ring-2 focus:ring-[var(--cds-interactive,#0f62fe)] bg-[var(--cds-field-01,#ffffff)] text-[var(--cds-text-primary,#161616)]"
                />
              </div>
            </div>
            <div className="overflow-y-auto max-h-none lg:max-h-[calc(100vh-280px)]">
              {filtered.length === 0 ? (
                <p className="text-center py-12 text-[var(--cds-text-secondary,#525252)] text-sm">No clients found</p>
              ) : (
                filtered.map(client => {
                  const stats = clientStats(client.name);
                  return (
                    <button
                      key={client.id}
                      onClick={() => { setSelectedClient(client); setDetailTab('invoices'); }}
                      className={`w-full text-left px-4 py-4 border-b border-[var(--cds-border-subtle,#c6c6c6)] transition-colors hover:bg-[var(--cds-layer-hover,#e8e8e8)] ${selectedClient?.name === client.name ? 'bg-[var(--cds-layer-selected,#e0e0e0)] border-l-4 border-l-[var(--cds-interactive,#0f62fe)]' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-[var(--cds-text-primary,#161616)] text-sm">{client.name}</p>
                          {client.company && <p className="text-xs text-[var(--cds-text-secondary,#525252)] mt-0.5">{client.company}</p>}
                          {!client.company && client.email && <p className="text-xs text-[var(--cds-text-secondary,#525252)] mt-0.5">{client.email}</p>}
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-[var(--cds-text-primary,#161616)]">{stats.invoiceCount} inv</p>
                          {stats.outstanding > 0 ? (
                            <p className="text-xs font-semibold text-[var(--cds-support-error,#da1e28)]">
                              {formatMoney(stats.outstanding)} due
                            </p>
                          ) : stats.creditBalance > 0 ? (
                            <p className="text-xs font-semibold text-[var(--cds-support-success,#24a148)]">
                              {formatMoney(stats.creditBalance)} cr
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Detail panel */}
        <div className={`flex-1 min-w-0 ${!showMobileDetail ? 'hidden lg:block' : ''}`}>
          {!selectedClient ? (
            <div className="bg-[var(--cds-layer-01,#ffffff)] border border-[var(--cds-border-subtle,#c6c6c6)] flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <svg className="mx-auto h-12 w-12 text-[var(--cds-text-secondary,#525252)] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-[var(--cds-text-secondary,#525252)] font-semibold">Select a client to view details</p>
              </div>
            </div>
          ) : (() => {
            const c = selectedClient;
            const stats = clientStats(c.name);
            const clientInvoices = getClientInvoices(c.name);
            const clientQuotes = getClientQuotes(c.name);
            const clientPayments = getClientPayments(c.name);

            return (
              <div className="space-y-4">
                {/* Client header card */}
                <div className="bg-[var(--cds-layer-01,#ffffff)] border border-[var(--cds-border-subtle,#c6c6c6)] p-6">
                  <div className="mb-4 lg:hidden">
                    <button
                      type="button"
                      onClick={() => setSelectedClient(null)}
                      className="inline-flex min-h-[44px] items-center gap-2 border border-[var(--cds-border-subtle,#c6c6c6)] px-3 py-2 text-sm font-semibold text-[var(--cds-text-primary,#161616)] hover:bg-[var(--cds-layer-hover,#e8e8e8)]"
                    >
                      <span aria-hidden="true">←</span>
                      Back to clients
                    </button>
                  </div>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-black text-[var(--cds-text-primary,#161616)]">{c.name}</h2>
                        {(c as any).isRegistered && (
                          <>
                            <Button
                              kind="ghost"
                              size="sm"
                              renderIcon={Edit}
                              iconDescription="Edit client"
                              hasIconOnly
                              onClick={() => openEditClient(c)}
                            />
                            <Button
                              kind="danger--ghost"
                              size="sm"
                              renderIcon={TrashCan}
                              iconDescription="Delete client"
                              hasIconOnly
                              onClick={() => handleDeleteClient(c)}
                            />
                          </>
                        )}
                      </div>
                      {c.company && <p className="text-[var(--cds-text-secondary,#525252)] text-sm mt-0.5">{c.company}</p>}
                      <div className="flex flex-wrap gap-4 mt-3 text-sm text-[var(--cds-text-secondary,#525252)]">
                        {c.email && <span>✉ {c.email}</span>}
                        {c.phone && <span>📞 {c.phone}</span>}
                        {c.address && <span>📍 {c.address}</span>}
                      </div>
                    </div>
                    {(c as any).isRegistered ? (
                      <Tag type="green">Registered</Tag>
                    ) : (
                      <Tag type="warm-gray">Unregistered</Tag>
                    )}
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mt-6 pt-4 border-t border-[var(--cds-border-subtle,#c6c6c6)]">
                    <div>
                      <p className="text-xs text-[var(--cds-text-secondary,#525252)] uppercase font-bold tracking-wider">Opening Bal</p>
                      <p className="text-xl font-black text-[var(--cds-text-primary,#161616)] mt-1">{formatMoney(stats.openingBalance)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--cds-text-secondary,#525252)] uppercase font-bold tracking-wider">Total Billed</p>
                      <p className="text-xl font-black text-[var(--cds-text-primary,#161616)] mt-1">{formatMoney(stats.totalBilled)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--cds-text-secondary,#525252)] uppercase font-bold tracking-wider">Total Paid</p>
                      <p className="text-xl font-black text-[var(--cds-support-success,#24a148)] mt-1">{formatMoney(stats.totalPaid)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--cds-text-secondary,#525252)] uppercase font-bold tracking-wider">
                        {stats.outstanding > 0 ? 'Balance Due' : stats.creditBalance > 0 ? 'Credit' : 'Balance'}
                      </p>
                      <p className={`text-xl font-black mt-1 ${stats.outstanding > 0 ? 'text-[var(--cds-support-error,#da1e28)]' : stats.creditBalance > 0 ? 'text-[var(--cds-support-success,#24a148)]' : 'text-[var(--cds-text-primary,#161616)]'}`}>
                        {stats.outstanding > 0 ? formatMoney(stats.outstanding) : 
                         stats.creditBalance > 0 ? formatMoney(stats.creditBalance) : 
                         formatMoney(0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--cds-text-secondary,#525252)] uppercase font-bold tracking-wider">Quotes</p>
                      <p className="text-xl font-black text-[var(--cds-interactive,#0f62fe)] mt-1">{stats.quoteCount}</p>
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="bg-[var(--cds-layer-01,#ffffff)] border border-[var(--cds-border-subtle,#c6c6c6)] overflow-hidden">
                  <div className="border-b border-[var(--cds-border-subtle,#c6c6c6)] bg-[var(--cds-layer-02,#f4f4f4)] p-3 sm:hidden">
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-[var(--cds-text-secondary,#525252)]">Records</label>
                    <select
                      value={detailTab}
                      onChange={(event) => setDetailTab(event.target.value as any)}
                      className="w-full border border-[var(--cds-border-subtle,#c6c6c6)] bg-[var(--cds-field-01,#ffffff)] px-4 py-3 text-sm font-semibold text-[var(--cds-text-primary,#161616)] outline-none focus:border-[var(--cds-interactive,#0f62fe)] focus:ring-2 focus:ring-[var(--cds-interactive,#0f62fe)]/20"
                    >
                      <option value="invoices">Invoices ({clientInvoices.length})</option>
                      <option value="quotes">Quotes ({clientQuotes.length})</option>
                      <option value="payments">Payments ({clientPayments.length})</option>
                      <option value="statement">Statement</option>
                    </select>
                  </div>
                  <div className="hidden gap-1 p-2 border-b border-[var(--cds-border-subtle,#c6c6c6)] bg-[var(--cds-layer-02,#f4f4f4)] overflow-x-auto sm:flex">
                    {(['invoices', 'quotes', 'payments', 'statement'] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setDetailTab(tab)}
                        className={`px-5 py-2.5 text-sm font-bold capitalize transition-all ${detailTab === tab ? 'bg-[var(--cds-layer-01,#ffffff)] text-[var(--cds-interactive,#0f62fe)]' : 'text-[var(--cds-text-secondary,#525252)] hover:text-[var(--cds-text-primary,#161616)]'}`}
                      >
                        {tab}
                        {tab !== 'statement' && (
                          <span className="ml-1.5 text-xs font-normal opacity-60">
                            ({tab === 'invoices' ? clientInvoices.length : tab === 'quotes' ? clientQuotes.length : clientPayments.length})
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="p-4">
                    {detailTab === 'invoices' && (
                      clientInvoices.length === 0 ? (
                        <p className="text-center py-10 text-[var(--cds-text-secondary,#525252)] text-sm">No invoices for this client</p>
                      ) : (
                        <div className="hidden sm:block overflow-x-auto">
                          <table className="w-full text-sm min-w-[40rem]">
                            <thead>
                              <tr className="border-b border-[var(--cds-border-subtle,#c6c6c6)]">
                                <th className="py-3 text-left text-xs font-black uppercase tracking-widest text-[var(--cds-text-secondary,#525252)]">Invoice #</th>
                                <th className="py-3 text-left text-xs font-black uppercase tracking-widest text-[var(--cds-text-secondary,#525252)]">Amount</th>
                                <th className="py-3 text-left text-xs font-black uppercase tracking-widest text-[var(--cds-text-secondary,#525252)]">Status</th>
                                <th className="py-3 text-left text-xs font-black uppercase tracking-widest text-[var(--cds-text-secondary,#525252)]">Due Date</th>
                                <th className="py-3 text-left text-xs font-black uppercase tracking-widest text-[var(--cds-text-secondary,#525252)]">Description</th>
                              </tr>
                            </thead>
                            <tbody>
                              {clientInvoices.map(inv => (
                                <tr key={inv.id} className="border-b border-[var(--cds-border-subtle,#c6c6c6)] hover:bg-[var(--cds-layer-hover,#e8e8e8)]">
                                  <td className="py-3 font-mono text-xs font-bold text-[var(--cds-interactive,#0f62fe)]">{inv.invoice_number}</td>
                                  <td className="py-3 font-bold text-[var(--cds-text-primary,#161616)]">{formatMoney(inv.amount_usd, inv.currency || 'USD')}</td>
                                  <td className="py-3">
                                    <span className={`px-2 py-0.5 text-xs font-black uppercase tracking-tighter ${statusColor[inv.status] || 'bg-[var(--cds-layer-02,#f4f4f4)] text-[var(--cds-text-secondary,#525252)]'}`}>{inv.status}</span>
                                  </td>
                                  <td className="py-3 text-[var(--cds-text-secondary,#525252)] text-xs">{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}</td>
                                  <td className="py-3 text-[var(--cds-text-secondary,#525252)] text-xs truncate max-w-[200px]">{inv.description || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    )}

                    {detailTab === 'quotes' && (
                      clientQuotes.length === 0 ? (
                        <p className="text-center py-10 text-[var(--cds-text-secondary,#525252)] text-sm">No quotes for this client</p>
                      ) : (
                        <div className="hidden sm:block overflow-x-auto">
                          <table className="w-full text-sm min-w-[40rem]">
                            <thead>
                              <tr className="border-b border-[var(--cds-border-subtle,#c6c6c6)]">
                                <th className="py-3 text-left text-xs font-black uppercase tracking-widest text-[var(--cds-text-secondary,#525252)]">Quote #</th>
                                <th className="py-3 text-left text-xs font-black uppercase tracking-widest text-[var(--cds-text-secondary,#525252)]">Amount</th>
                                <th className="py-3 text-left text-xs font-black uppercase tracking-widest text-[var(--cds-text-secondary,#525252)]">Status</th>
                                <th className="py-3 text-left text-xs font-black uppercase tracking-widest text-[var(--cds-text-secondary,#525252)]">Valid Until</th>
                                <th className="py-3 text-left text-xs font-black uppercase tracking-widest text-[var(--cds-text-secondary,#525252)]">Description</th>
                              </tr>
                            </thead>
                            <tbody>
                              {clientQuotes.map(q => (
                                <tr key={q.id} className="border-b border-[var(--cds-border-subtle,#c6c6c6)] hover:bg-[var(--cds-layer-hover,#e8e8e8)]">
                                  <td className="py-3 font-mono text-xs font-bold text-[var(--cds-interactive,#0f62fe)]">{q.quote_number}</td>
                                  <td className="py-3 font-bold text-[var(--cds-text-primary,#161616)]">{formatMoney(q.amount_usd, q.currency || 'USD')}</td>
                                  <td className="py-3">
                                    <span className={`px-2 py-0.5 text-xs font-black uppercase tracking-tighter ${statusColor[q.status] || 'bg-[var(--cds-layer-02,#f4f4f4)] text-[var(--cds-text-secondary,#525252)]'}`}>{q.status}</span>
                                  </td>
                                  <td className="py-3 text-[var(--cds-text-secondary,#525252)] text-xs">{q.valid_until ? new Date(q.valid_until).toLocaleDateString() : '—'}</td>
                                  <td className="py-3 text-[var(--cds-text-secondary,#525252)] text-xs truncate max-w-[200px]">{q.description || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    )}

                    {detailTab === 'payments' && (
                      clientPayments.length === 0 ? (
                        <p className="text-center py-10 text-[var(--cds-text-secondary,#525252)] text-sm">No payments recorded for this client</p>
                      ) : (
                        <div className="hidden sm:block overflow-x-auto">
                          <table className="w-full text-sm min-w-[32rem]">
                            <thead>
                              <tr className="border-b border-[var(--cds-border-subtle,#c6c6c6)]">
                                <th className="py-3 text-left text-xs font-black uppercase tracking-widest text-[var(--cds-text-secondary,#525252)]">Ref</th>
                                <th className="py-3 text-left text-xs font-black uppercase tracking-widest text-[var(--cds-text-secondary,#525252)]">Amount</th>
                                <th className="py-3 text-left text-xs font-black uppercase tracking-widest text-[var(--cds-text-secondary,#525252)]">Status</th>
                                <th className="py-3 text-left text-xs font-black uppercase tracking-widest text-[var(--cds-text-secondary,#525252)]">Method</th>
                                <th className="py-3 text-left text-xs font-black uppercase tracking-widest text-[var(--cds-text-secondary,#525252)]">Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              {clientPayments.map(p => (
                                <tr key={p.id} className="border-b border-[var(--cds-border-subtle,#c6c6c6)] hover:bg-[var(--cds-layer-hover,#e8e8e8)]">
                                  <td className="py-3 font-mono text-xs font-bold text-[var(--cds-text-secondary,#525252)]">{p.reference_id || '—'}</td>
                                  <td className="py-3 font-bold text-[var(--cds-support-success,#24a148)]">{formatMoney(p.amount_usd, p.currency || 'USD')}</td>
                                  <td className="py-3">
                                    {p.status === 'unallocated' ? (
                                      <Tag type="warm-gray" size="sm">Unallocated</Tag>
                                    ) : (
                                      <Tag type="green" size="sm">Allocated</Tag>
                                    )}
                                  </td>
                                  <td className="py-3 text-[var(--cds-text-secondary,#525252)] text-xs">{p.method || '—'}</td>
                                  <td className="py-3 text-[var(--cds-text-secondary,#525252)] text-xs">{p.date ? new Date(p.date).toLocaleDateString() : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    )}

                    {detailTab === 'statement' && (() => {
                      const ledger = generateLedger(c.name);
                      const filteredLedger = ledger.filter(entry => {
                        if (!statementDateFrom && !statementDateTo) return true;
                        const entryDate = entry.date.toISOString().split('T')[0];
                        if (statementDateFrom && entryDate < statementDateFrom) return false;
                        if (statementDateTo && entryDate > statementDateTo) return false;
                        return true;
                      });
                      
                      return (
                      <div className="p-4">
                        <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-end justify-between">
                          <div className="flex gap-4">
                            <div>
                              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--cds-text-secondary,#525252)] mb-1">From</label>
                              <input
                                type="date"
                                value={statementDateFrom}
                                onChange={(e) => setStatementDateFrom(e.target.value)}
                                className="border border-[var(--cds-border-subtle,#c6c6c6)] px-3 py-2 text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--cds-text-secondary,#525252)] mb-1">To</label>
                              <input
                                type="date"
                                value={statementDateTo}
                                onChange={(e) => setStatementDateTo(e.target.value)}
                                className="border border-[var(--cds-border-subtle,#c6c6c6)] px-3 py-2 text-sm"
                              />
                            </div>
                          </div>
                          <Button
                            renderIcon={DocumentDownload}
                            onClick={generateStatement}
                          >
                            Download PDF Statement
                          </Button>
                        </div>
                        
                        {/* Ledger display with running balance */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b-2 border-[var(--cds-text-primary,#161616)]">
                                <th className="py-3 text-left text-xs font-black uppercase tracking-widest text-[var(--cds-text-secondary,#525252)]">Date</th>
                                <th className="py-3 text-left text-xs font-black uppercase tracking-widest text-[var(--cds-text-secondary,#525252)]">Type</th>
                                <th className="py-3 text-left text-xs font-black uppercase tracking-widest text-[var(--cds-text-secondary,#525252)]">Reference</th>
                                <th className="py-3 text-right text-xs font-black uppercase tracking-widest text-[var(--cds-text-secondary,#525252)]">Debit</th>
                                <th className="py-3 text-right text-xs font-black uppercase tracking-widest text-[var(--cds-text-secondary,#525252)]">Credit</th>
                                <th className="py-3 text-right text-xs font-black uppercase tracking-widest text-[var(--cds-text-secondary,#525252)]">Balance</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredLedger.length === 0 ? (
                                <tr>
                                  <td colSpan={6} className="py-10 text-center text-[var(--cds-text-secondary,#525252)]">
                                    No entries for the selected date range
                                  </td>
                                </tr>
                              ) : (
                                <>
                                  {filteredLedger.map((entry, index) => (
                                    <tr key={index} className="border-b border-[var(--cds-border-subtle,#c6c6c6)] hover:bg-[var(--cds-layer-hover,#e8e8e8)]">
                                      <td className="py-3 text-xs">{entry.date.toLocaleDateString()}</td>
                                      <td className="py-3">
                                        {entry.type === 'opening' && <Tag size="sm">Opening</Tag>}
                                        {entry.type === 'invoice' && <Tag type="blue" size="sm">Invoice</Tag>}
                                        {entry.type === 'payment' && <Tag type="green" size="sm">Payment</Tag>}
                                      </td>
                                      <td className="py-3 font-mono text-xs">{entry.reference}</td>
                                      <td className="py-3 text-right font-bold text-[var(--cds-support-error,#da1e28)]">
                                        {entry.debit > 0 ? formatMoney(entry.debit) : '-'}
                                      </td>
                                      <td className="py-3 text-right font-bold text-[var(--cds-support-success,#24a148)]">
                                        {entry.credit > 0 ? formatMoney(entry.credit) : '-'}
                                      </td>
                                      <td className={`py-3 text-right font-black ${entry.balance > 0 ? 'text-[var(--cds-support-error,#da1e28)]' : entry.balance < 0 ? 'text-[var(--cds-support-success,#24a148)]' : ''}`}>
                                        {formatMoney(Math.abs(entry.balance))} {entry.balance > 0 ? 'DR' : entry.balance < 0 ? 'CR' : ''}
                                      </td>
                                    </tr>
                                  ))}
                                  
                                  {/* Total Row */}
                                  <tr className="border-t-2 border-[var(--cds-text-primary,#161616)] bg-[var(--cds-layer-02,#f4f4f4)]">
                                    <td className="py-4" colSpan={3}>
                                      <span className="font-black uppercase tracking-wider">Current Balance</span>
                                    </td>
                                    <td className="py-4"></td>
                                    <td className="py-4"></td>
                                    <td className={`py-4 text-right font-black text-xl ${stats.outstanding > 0 ? 'text-[var(--cds-support-error,#da1e28)]' : stats.creditBalance > 0 ? 'text-[var(--cds-support-success,#24a148)]' : ''}`}>
                                      {stats.outstanding > 0 
                                        ? formatMoney(stats.outstanding) + ' DR'
                                        : stats.creditBalance > 0 
                                          ? formatMoney(stats.creditBalance) + ' CR'
                                          : formatMoney(0)}
                                    </td>
                                  </tr>
                                </>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );})()}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Client Add/Edit Modal */}
      <Modal
        open={isClientModalOpen}
        onRequestClose={() => setIsClientModalOpen(false)}
        modalHeading={editingClient ? 'Edit Client' : 'Add New Client'}
        primaryButtonText={isSubmitting ? 'Saving...' : (editingClient ? 'Save Changes' : 'Create Client')}
        secondaryButtonText="Cancel"
        onRequestSubmit={handleSaveClient}
        primaryButtonDisabled={isSubmitting || !formData.name.trim()}
      >
        <Form onSubmit={handleSaveClient}>
          <Stack gap={5}>
            <TextInput
              id="client-name"
              labelText="Client Name *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <TextInput
              id="client-email"
              labelText="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            <TextInput
              id="client-phone"
              labelText="Phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
            <TextInput
              id="client-company"
              labelText="Company"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
            />
            <TextInput
              id="client-address"
              labelText="Address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
            <div className="flex gap-4">
              <div className="flex-1">
                <TextInput
                  id="opening-balance"
                  labelText="Opening Balance"
                  type="number"
                  step="0.01"
                  value={formData.opening_balance}
                  onChange={(e) => setFormData({ ...formData, opening_balance: e.target.value })}
                />
              </div>
              <div className="w-32">
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--cds-text-secondary,#525252)] mb-1">
                  Currency
                </label>
                <select
                  value={formData.opening_balance_currency}
                  onChange={(e) => setFormData({ ...formData, opening_balance_currency: e.target.value as 'USD' | 'GBP' })}
                  className="w-full border border-[var(--cds-border-subtle,#c6c6c6)] px-3 py-2 text-sm"
                  style={{ background: 'var(--cds-background, #ffffff)' }}
                >
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
            </div>
            <TextInput
              id="client-notes"
              labelText="Notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </Stack>
        </Form>
      </Modal>
    </div>
  );
};

export default ClientDirectory;
