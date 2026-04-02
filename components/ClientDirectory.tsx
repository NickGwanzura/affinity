import React, { useEffect, useState, useMemo } from 'react';
import { Client, Invoice, Quote, Payment } from '../types';
import { dataService } from '../services/dataService';
import { useToast } from './Toast';

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

export const ClientDirectory: React.FC = () => {
  const { showToast, ToastContainer } = useToast();

  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [detailTab, setDetailTab] = useState<'invoices' | 'quotes' | 'payments'>('invoices');
  const showMobileDetail = Boolean(selectedClient);

  useEffect(() => {
    const load = async () => {
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
    load();
  }, []);

  // Build enriched client list by collecting all unique names from financial records
  const enrichedClients = useMemo(() => {
    const clientMap = new Map<string, { id: string; name: string; email: string; company?: string; phone?: string; address?: string; isRegistered: boolean }>();

    // First add registered clients
    for (const c of clients) {
      const key = c.name.trim().toLowerCase();
      clientMap.set(key, { id: c.id, name: c.name, email: c.email, company: c.company, phone: c.phone, address: c.address, isRegistered: true });
    }

    // Add clients from invoices not in registry
    for (const inv of invoices) {
      const key = inv.client_name.trim().toLowerCase();
      if (!clientMap.has(key)) {
        clientMap.set(key, { id: `inv-${key}`, name: inv.client_name, email: inv.client_email || '', company: undefined, phone: undefined, address: inv.client_address, isRegistered: false });
      }
    }
    for (const q of quotes) {
      const key = q.client_name.trim().toLowerCase();
      if (!clientMap.has(key)) {
        clientMap.set(key, { id: `qt-${key}`, name: q.client_name, email: q.client_email || '', company: undefined, phone: undefined, address: q.client_address, isRegistered: false });
      }
    }

    return Array.from(clientMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [clients, invoices, quotes]);

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

  const clientStats = (name: string) => {
    const inv = getClientInvoices(name);
    const totalBilled = inv.reduce((s, i) => s + i.amount_usd, 0);
    const totalPaid = inv.filter(i => i.status === 'Paid').reduce((s, i) => s + i.amount_usd, 0);
    const outstanding = totalBilled - totalPaid;
    return { totalBilled, totalPaid, outstanding, invoiceCount: inv.length, quoteCount: getClientQuotes(name).length };
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

      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-black text-[var(--cds-text-primary,#161616)]">Client Directory</h1>
        <p className="mt-1 text-[var(--cds-text-secondary,#525252)] text-sm">{enrichedClients.length} clients · search across invoices, quotes & payments</p>
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
                      onClick={() => { setSelectedClient(client as any); setDetailTab('invoices'); }}
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
                          {stats.outstanding > 0 && (
                            <p className="text-xs text-[var(--cds-support-error,#da1e28)] font-semibold">{formatMoney(stats.outstanding)} due</p>
                          )}
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
            const c = selectedClient as any;
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
                      <h2 className="text-2xl font-black text-[var(--cds-text-primary,#161616)]">{c.name}</h2>
                      {c.company && <p className="text-[var(--cds-text-secondary,#525252)] text-sm mt-0.5">{c.company}</p>}
                      <div className="flex flex-wrap gap-4 mt-3 text-sm text-[var(--cds-text-secondary,#525252)]">
                        {c.email && <span>✉ {c.email}</span>}
                        {c.phone && <span>📞 {c.phone}</span>}
                        {c.address && <span>📍 {c.address}</span>}
                      </div>
                    </div>
                    {c.isRegistered && (
                      <span className="text-xs font-bold px-2 py-1 bg-[var(--cds-support-success,#24a148)] text-white">Registered</span>
                    )}
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-4 border-t border-[var(--cds-border-subtle,#c6c6c6)]">
                    <div>
                      <p className="text-xs text-[var(--cds-text-secondary,#525252)] uppercase font-bold tracking-wider">Total Billed</p>
                      <p className="text-xl font-black text-[var(--cds-text-primary,#161616)] mt-1">{formatMoney(stats.totalBilled)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--cds-text-secondary,#525252)] uppercase font-bold tracking-wider">Total Paid</p>
                      <p className="text-xl font-black text-[var(--cds-support-success,#24a148)] mt-1">{formatMoney(stats.totalPaid)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--cds-text-secondary,#525252)] uppercase font-bold tracking-wider">Outstanding</p>
                      <p className={`text-xl font-black mt-1 ${stats.outstanding > 0 ? 'text-[var(--cds-support-error,#da1e28)]' : 'text-[var(--cds-text-secondary,#525252)]'}`}>{formatMoney(stats.outstanding)}</p>
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
                      onChange={(event) => setDetailTab(event.target.value as 'invoices' | 'quotes' | 'payments')}
                      className="w-full border border-[var(--cds-border-subtle,#c6c6c6)] bg-[var(--cds-field-01,#ffffff)] px-4 py-3 text-sm font-semibold text-[var(--cds-text-primary,#161616)] outline-none focus:border-[var(--cds-interactive,#0f62fe)] focus:ring-2 focus:ring-[var(--cds-interactive,#0f62fe)]/20"
                    >
                      <option value="invoices">Invoices ({clientInvoices.length})</option>
                      <option value="quotes">Quotes ({clientQuotes.length})</option>
                      <option value="payments">Payments ({clientPayments.length})</option>
                    </select>
                  </div>
                  <div className="hidden gap-1 p-2 border-b border-[var(--cds-border-subtle,#c6c6c6)] bg-[var(--cds-layer-02,#f4f4f4)] overflow-x-auto sm:flex">
                    {(['invoices', 'quotes', 'payments'] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setDetailTab(tab)}
                        className={`px-5 py-2.5 text-sm font-bold capitalize transition-all ${detailTab === tab ? 'bg-[var(--cds-layer-01,#ffffff)] text-[var(--cds-interactive,#0f62fe)]' : 'text-[var(--cds-text-secondary,#525252)] hover:text-[var(--cds-text-primary,#161616)]'}`}
                      >
                        {tab}
                        <span className="ml-1.5 text-xs font-normal opacity-60">
                          ({tab === 'invoices' ? clientInvoices.length : tab === 'quotes' ? clientQuotes.length : clientPayments.length})
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="p-4">
                    {detailTab === 'invoices' && (
                      clientInvoices.length === 0 ? (
                        <p className="text-center py-10 text-[var(--cds-text-secondary,#525252)] text-sm">No invoices for this client</p>
                      ) : (
                        <>
                        <div className="space-y-3 sm:hidden">
                          {clientInvoices.map(inv => (
                            <div key={inv.id} className="border border-[var(--cds-border-subtle,#c6c6c6)] bg-[var(--cds-layer-02,#f4f4f4)] p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-mono text-xs font-bold text-[var(--cds-interactive,#0f62fe)]">{inv.invoice_number}</p>
                                  <p className="mt-2 text-base font-bold text-[var(--cds-text-primary,#161616)]">{formatMoney(inv.amount_usd, inv.currency || 'USD')}</p>
                                </div>
                                <span className={`px-2 py-1 text-xs font-black uppercase tracking-tighter ${statusColor[inv.status] || 'bg-[var(--cds-layer-02,#f4f4f4)] text-[var(--cds-text-secondary,#525252)]'}`}>{inv.status}</span>
                              </div>
                              <div className="mt-3 space-y-1 text-sm text-[var(--cds-text-secondary,#525252)]">
                                <p><span className="font-semibold text-[var(--cds-text-primary,#161616)]">Due:</span> {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}</p>
                                <p><span className="font-semibold text-[var(--cds-text-primary,#161616)]">Description:</span> {inv.description || '—'}</p>
                              </div>
                            </div>
                          ))}
                        </div>
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
                        </>
                      )
                    )}

                    {detailTab === 'quotes' && (
                      clientQuotes.length === 0 ? (
                        <p className="text-center py-10 text-[var(--cds-text-secondary,#525252)] text-sm">No quotes for this client</p>
                      ) : (
                        <>
                        <div className="space-y-3 sm:hidden">
                          {clientQuotes.map(q => (
                            <div key={q.id} className="border border-[var(--cds-border-subtle,#c6c6c6)] bg-[var(--cds-layer-02,#f4f4f4)] p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-mono text-xs font-bold text-[var(--cds-interactive,#0f62fe)]">{q.quote_number}</p>
                                  <p className="mt-2 text-base font-bold text-[var(--cds-text-primary,#161616)]">{formatMoney(q.amount_usd, q.currency || 'USD')}</p>
                                </div>
                                <span className={`px-2 py-1 text-xs font-black uppercase tracking-tighter ${statusColor[q.status] || 'bg-[var(--cds-layer-02,#f4f4f4)] text-[var(--cds-text-secondary,#525252)]'}`}>{q.status}</span>
                              </div>
                              <div className="mt-3 space-y-1 text-sm text-[var(--cds-text-secondary,#525252)]">
                                <p><span className="font-semibold text-[var(--cds-text-primary,#161616)]">Valid until:</span> {q.valid_until ? new Date(q.valid_until).toLocaleDateString() : '—'}</p>
                                <p><span className="font-semibold text-[var(--cds-text-primary,#161616)]">Description:</span> {q.description || '—'}</p>
                              </div>
                            </div>
                          ))}
                        </div>
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
                        </>
                      )
                    )}

                    {detailTab === 'payments' && (
                      clientPayments.length === 0 ? (
                        <p className="text-center py-10 text-[var(--cds-text-secondary,#525252)] text-sm">No payments recorded for this client</p>
                      ) : (
                        <>
                        <div className="space-y-3 sm:hidden">
                          {clientPayments.map(p => (
                            <div key={p.id} className="border border-[var(--cds-border-subtle,#c6c6c6)] bg-[var(--cds-layer-02,#f4f4f4)] p-4">
                              <p className="font-mono text-xs font-bold text-[var(--cds-text-secondary,#525252)]">{p.reference_id || '—'}</p>
                              <p className="mt-2 text-base font-bold text-[var(--cds-support-success,#24a148)]">{formatMoney(p.amount_usd, p.currency || 'USD')}</p>
                              <div className="mt-3 space-y-1 text-sm text-[var(--cds-text-secondary,#525252)]">
                                <p><span className="font-semibold text-[var(--cds-text-primary,#161616)]">Method:</span> {p.method || '—'}</p>
                                <p><span className="font-semibold text-[var(--cds-text-primary,#161616)]">Date:</span> {p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-sm min-w-[32rem]">
                          <thead>
                            <tr className="border-b border-[var(--cds-border-subtle,#c6c6c6)]">
                              <th className="py-3 text-left text-xs font-black uppercase tracking-widest text-[var(--cds-text-secondary,#525252)]">Ref</th>
                              <th className="py-3 text-left text-xs font-black uppercase tracking-widest text-[var(--cds-text-secondary,#525252)]">Amount</th>
                              <th className="py-3 text-left text-xs font-black uppercase tracking-widest text-[var(--cds-text-secondary,#525252)]">Method</th>
                              <th className="py-3 text-left text-xs font-black uppercase tracking-widest text-[var(--cds-text-secondary,#525252)]">Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {clientPayments.map(p => (
                              <tr key={p.id} className="border-b border-[var(--cds-border-subtle,#c6c6c6)] hover:bg-[var(--cds-layer-hover,#e8e8e8)]">
                                <td className="py-3 font-mono text-xs font-bold text-[var(--cds-text-secondary,#525252)]">{p.reference_id || '—'}</td>
                                <td className="py-3 font-bold text-[var(--cds-support-success,#24a148)]">{formatMoney(p.amount_usd, p.currency || 'USD')}</td>
                                <td className="py-3 text-[var(--cds-text-secondary,#525252)] text-xs">{p.method || '—'}</td>
                                <td className="py-3 text-[var(--cds-text-secondary,#525252)] text-xs">{p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        </div>
                        </>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};
