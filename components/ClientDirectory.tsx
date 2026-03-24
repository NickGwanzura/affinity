import React, { useEffect, useState, useMemo } from 'react';
import { Client, Invoice, Quote, Payment } from '../types';
import { supabase } from '../services/supabaseService';
import { useToast } from './Toast';

const formatMoney = (amount: number, currency = 'USD') => {
  const symbol = currency === 'GBP' ? '£' : '$';
  return `${symbol}${(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const statusColor: Record<string, string> = {
  Paid:     'bg-emerald-100 text-emerald-700',
  Sent:     'bg-blue-100 text-blue-700',
  Overdue:  'bg-red-100 text-red-700',
  Draft:    'bg-zinc-100 text-zinc-500',
  Accepted: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
  Approved: 'bg-yellow-100 text-yellow-700',
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
          supabase.getClients(),
          supabase.getInvoices(),
          supabase.getQuotes(),
          supabase.getPayments(),
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
        <div className="flex items-center gap-3 text-zinc-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <span className="text-sm font-bold uppercase tracking-widest">Loading clients…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-4 sm:p-6">
      <ToastContainer />

      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-black text-zinc-900">Client Directory</h1>
        <p className="mt-1 text-zinc-500 text-sm">{enrichedClients.length} clients · search across invoices, quotes & payments</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar list */}
        <div className={`w-full lg:w-80 flex-shrink-0 ${showMobileDetail ? 'hidden lg:block' : ''}`}>
          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
            <div className="p-4 border-b border-zinc-100">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search clients…"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-zinc-200 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="overflow-y-auto max-h-none lg:max-h-[calc(100vh-280px)]">
              {filtered.length === 0 ? (
                <p className="text-center py-12 text-zinc-400 text-sm">No clients found</p>
              ) : (
                filtered.map(client => {
                  const stats = clientStats(client.name);
                  return (
                    <button
                      key={client.id}
                      onClick={() => { setSelectedClient(client as any); setDetailTab('invoices'); }}
                      className={`w-full text-left px-4 py-4 border-b border-zinc-100 transition-colors hover:bg-zinc-50 ${selectedClient?.name === client.name ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-zinc-900 text-sm">{client.name}</p>
                          {client.company && <p className="text-xs text-zinc-500 mt-0.5">{client.company}</p>}
                          {!client.company && client.email && <p className="text-xs text-zinc-400 mt-0.5">{client.email}</p>}
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-zinc-700">{stats.invoiceCount} inv</p>
                          {stats.outstanding > 0 && (
                            <p className="text-xs text-red-500 font-semibold">{formatMoney(stats.outstanding)} due</p>
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
            <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <svg className="mx-auto h-12 w-12 text-zinc-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-zinc-400 font-semibold">Select a client to view details</p>
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
                <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6">
                  <div className="mb-4 lg:hidden">
                    <button
                      type="button"
                      onClick={() => setSelectedClient(null)}
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                    >
                      <span aria-hidden="true">←</span>
                      Back to clients
                    </button>
                  </div>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-2xl font-black text-zinc-900">{c.name}</h2>
                      {c.company && <p className="text-zinc-500 text-sm mt-0.5">{c.company}</p>}
                      <div className="flex flex-wrap gap-4 mt-3 text-sm text-zinc-500">
                        {c.email && <span>✉ {c.email}</span>}
                        {c.phone && <span>📞 {c.phone}</span>}
                        {c.address && <span>📍 {c.address}</span>}
                      </div>
                    </div>
                    {c.isRegistered && (
                      <span className="text-xs font-bold px-2 py-1 rounded-md bg-emerald-100 text-emerald-700">Registered</span>
                    )}
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-4 border-t border-zinc-100">
                    <div>
                      <p className="text-xs text-zinc-400 uppercase font-bold tracking-wider">Total Billed</p>
                      <p className="text-xl font-black text-zinc-900 mt-1">{formatMoney(stats.totalBilled)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400 uppercase font-bold tracking-wider">Total Paid</p>
                      <p className="text-xl font-black text-emerald-600 mt-1">{formatMoney(stats.totalPaid)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400 uppercase font-bold tracking-wider">Outstanding</p>
                      <p className={`text-xl font-black mt-1 ${stats.outstanding > 0 ? 'text-red-500' : 'text-zinc-400'}`}>{formatMoney(stats.outstanding)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400 uppercase font-bold tracking-wider">Quotes</p>
                      <p className="text-xl font-black text-blue-600 mt-1">{stats.quoteCount}</p>
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
                  <div className="border-b border-zinc-100 bg-zinc-50 p-3 sm:hidden">
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">Records</label>
                    <select
                      value={detailTab}
                      onChange={(event) => setDetailTab(event.target.value as 'invoices' | 'quotes' | 'payments')}
                      className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="invoices">Invoices ({clientInvoices.length})</option>
                      <option value="quotes">Quotes ({clientQuotes.length})</option>
                      <option value="payments">Payments ({clientPayments.length})</option>
                    </select>
                  </div>
                  <div className="hidden gap-1 p-2 border-b border-zinc-100 bg-zinc-50 overflow-x-auto sm:flex">
                    {(['invoices', 'quotes', 'payments'] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setDetailTab(tab)}
                        className={`px-5 py-2.5 rounded-xl text-sm font-bold capitalize transition-all ${detailTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}
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
                        <p className="text-center py-10 text-zinc-400 text-sm">No invoices for this client</p>
                      ) : (
                        <>
                        <div className="space-y-3 sm:hidden">
                          {clientInvoices.map(inv => (
                            <div key={inv.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-mono text-xs font-bold text-blue-600">{inv.invoice_number}</p>
                                  <p className="mt-2 text-base font-bold text-zinc-900">{formatMoney(inv.amount_usd, inv.currency || 'USD')}</p>
                                </div>
                                <span className={`px-2 py-1 rounded-md text-xs font-black uppercase tracking-tighter ${statusColor[inv.status] || 'bg-zinc-100 text-zinc-500'}`}>{inv.status}</span>
                              </div>
                              <div className="mt-3 space-y-1 text-sm text-zinc-600">
                                <p><span className="font-semibold text-zinc-900">Due:</span> {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}</p>
                                <p><span className="font-semibold text-zinc-900">Description:</span> {inv.description || '—'}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-sm min-w-[40rem]">
                          <thead>
                            <tr className="border-b border-zinc-100">
                              <th className="py-3 text-left text-xs font-black uppercase tracking-widest text-zinc-400">Invoice #</th>
                              <th className="py-3 text-left text-xs font-black uppercase tracking-widest text-zinc-400">Amount</th>
                              <th className="py-3 text-left text-xs font-black uppercase tracking-widest text-zinc-400">Status</th>
                              <th className="py-3 text-left text-xs font-black uppercase tracking-widest text-zinc-400">Due Date</th>
                              <th className="py-3 text-left text-xs font-black uppercase tracking-widest text-zinc-400">Description</th>
                            </tr>
                          </thead>
                          <tbody>
                            {clientInvoices.map(inv => (
                              <tr key={inv.id} className="border-b border-zinc-50 hover:bg-zinc-50">
                                <td className="py-3 font-mono text-xs font-bold text-blue-600">{inv.invoice_number}</td>
                                <td className="py-3 font-bold text-zinc-900">{formatMoney(inv.amount_usd, inv.currency || 'USD')}</td>
                                <td className="py-3">
                                  <span className={`px-2 py-0.5 rounded-md text-xs font-black uppercase tracking-tighter ${statusColor[inv.status] || 'bg-zinc-100 text-zinc-500'}`}>{inv.status}</span>
                                </td>
                                <td className="py-3 text-zinc-500 text-xs">{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}</td>
                                <td className="py-3 text-zinc-500 text-xs truncate max-w-[200px]">{inv.description || '—'}</td>
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
                        <p className="text-center py-10 text-zinc-400 text-sm">No quotes for this client</p>
                      ) : (
                        <>
                        <div className="space-y-3 sm:hidden">
                          {clientQuotes.map(q => (
                            <div key={q.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-mono text-xs font-bold text-blue-600">{q.quote_number}</p>
                                  <p className="mt-2 text-base font-bold text-zinc-900">{formatMoney(q.amount_usd, q.currency || 'USD')}</p>
                                </div>
                                <span className={`px-2 py-1 rounded-md text-xs font-black uppercase tracking-tighter ${statusColor[q.status] || 'bg-zinc-100 text-zinc-500'}`}>{q.status}</span>
                              </div>
                              <div className="mt-3 space-y-1 text-sm text-zinc-600">
                                <p><span className="font-semibold text-zinc-900">Valid until:</span> {q.valid_until ? new Date(q.valid_until).toLocaleDateString() : '—'}</p>
                                <p><span className="font-semibold text-zinc-900">Description:</span> {q.description || '—'}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-sm min-w-[40rem]">
                          <thead>
                            <tr className="border-b border-zinc-100">
                              <th className="py-3 text-left text-xs font-black uppercase tracking-widest text-zinc-400">Quote #</th>
                              <th className="py-3 text-left text-xs font-black uppercase tracking-widest text-zinc-400">Amount</th>
                              <th className="py-3 text-left text-xs font-black uppercase tracking-widest text-zinc-400">Status</th>
                              <th className="py-3 text-left text-xs font-black uppercase tracking-widest text-zinc-400">Valid Until</th>
                              <th className="py-3 text-left text-xs font-black uppercase tracking-widest text-zinc-400">Description</th>
                            </tr>
                          </thead>
                          <tbody>
                            {clientQuotes.map(q => (
                              <tr key={q.id} className="border-b border-zinc-50 hover:bg-zinc-50">
                                <td className="py-3 font-mono text-xs font-bold text-blue-600">{q.quote_number}</td>
                                <td className="py-3 font-bold text-zinc-900">{formatMoney(q.amount_usd, q.currency || 'USD')}</td>
                                <td className="py-3">
                                  <span className={`px-2 py-0.5 rounded-md text-xs font-black uppercase tracking-tighter ${statusColor[q.status] || 'bg-zinc-100 text-zinc-500'}`}>{q.status}</span>
                                </td>
                                <td className="py-3 text-zinc-500 text-xs">{q.valid_until ? new Date(q.valid_until).toLocaleDateString() : '—'}</td>
                                <td className="py-3 text-zinc-500 text-xs truncate max-w-[200px]">{q.description || '—'}</td>
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
                        <p className="text-center py-10 text-zinc-400 text-sm">No payments recorded for this client</p>
                      ) : (
                        <>
                        <div className="space-y-3 sm:hidden">
                          {clientPayments.map(p => (
                            <div key={p.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                              <p className="font-mono text-xs font-bold text-zinc-600">{p.reference_id || '—'}</p>
                              <p className="mt-2 text-base font-bold text-emerald-600">{formatMoney(p.amount_usd, p.currency || 'USD')}</p>
                              <div className="mt-3 space-y-1 text-sm text-zinc-600">
                                <p><span className="font-semibold text-zinc-900">Method:</span> {p.method || '—'}</p>
                                <p><span className="font-semibold text-zinc-900">Date:</span> {p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-sm min-w-[32rem]">
                          <thead>
                            <tr className="border-b border-zinc-100">
                              <th className="py-3 text-left text-xs font-black uppercase tracking-widest text-zinc-400">Ref</th>
                              <th className="py-3 text-left text-xs font-black uppercase tracking-widest text-zinc-400">Amount</th>
                              <th className="py-3 text-left text-xs font-black uppercase tracking-widest text-zinc-400">Method</th>
                              <th className="py-3 text-left text-xs font-black uppercase tracking-widest text-zinc-400">Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {clientPayments.map(p => (
                              <tr key={p.id} className="border-b border-zinc-50 hover:bg-zinc-50">
                                <td className="py-3 font-mono text-xs font-bold text-zinc-600">{p.reference_id || '—'}</td>
                                <td className="py-3 font-bold text-emerald-600">{formatMoney(p.amount_usd, p.currency || 'USD')}</td>
                                <td className="py-3 text-zinc-500 text-xs">{p.method || '—'}</td>
                                <td className="py-3 text-zinc-500 text-xs">{p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}</td>
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
