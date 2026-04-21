import React, { useEffect, useState, useMemo } from 'react';
import { Button } from '../ui/Button';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from '../ui/Tabs';
import { OverflowMenu, OverflowMenuItem } from '../ui/OverflowMenu';
import { Skeleton } from '../ui/Skeleton';
import {
  Plus,
  Download,
  Pencil,
  Trash2,
  DollarSign,
  FileText,
  ShoppingCart,
  Activity,
  Search,
} from 'lucide-react';
import type { Client, Invoice, Quote, Payment, CompanyDetails } from '../../types';
import { dataService } from '../../services/dataService';
import { useToast } from '../Toast';
import { useConfirm } from './CarbonConfirmModal';
import { generateStatementPDF } from '../../services/pdfService';

interface ClientStats {
  totalBilled: number;
  totalPaid: number;
  openingBalance: number;
  outstanding: number;
  invoiceCount: number;
  quoteCount: number;
  paymentCount: number;
}

interface LedgerEntry {
  date: Date;
  type: 'opening' | 'invoice' | 'payment';
  reference: string;
  description?: string;
  debit: number;
  credit: number;
  balance: number;
  id?: string;
}

const formatMoney = (amount: number, currency = 'USD') => {
  const symbol = currency === 'GBP' ? '£' : '$';
  return `${symbol}${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const getStatusTag = (type: string) => {
  const base = 'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded';
  switch (type) {
    case 'opening': return <span className={`${base} bg-gray-100 text-gray-700`}>Opening</span>;
    case 'invoice': return <span className={`${base} bg-blue-100 text-blue-700`}>Invoice</span>;
    case 'payment': return <span className={`${base} bg-green-100 text-green-700`}>Payment</span>;
    default: return <span className={`${base} bg-gray-100 text-gray-700`}>{type}</span>;
  }
};

export const CarbonClientDirectory: React.FC = () => {
  const { showToast, ToastContainer } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  // Data states
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [company, setCompany] = useState<CompanyDetails | null>(null);
  const [loading, setLoading] = useState(true);

  // Selection states
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  // Search state for client list
  const [searchQuery, setSearchQuery] = useState('');

  // Statement date range
  const [statementDateRange, setStatementDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [isGeneratingStatement, setIsGeneratingStatement] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [cli, inv, quo, pay, comp] = await Promise.all([
        dataService.getClients(),
        dataService.getInvoices(),
        dataService.getQuotes(),
        dataService.getPayments(),
        dataService.getCompanyDetails(),
      ]);
      setClients(cli);
      setInvoices(inv);
      setQuotes(quo);
      setPayments(pay);
      setCompany(comp);
    } catch (err: any) {
      showToast(err?.message || 'Failed to load client directory', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Calculate client statistics
  const getClientStats = (client: Client): ClientStats => {
    const clientInvoices = invoices.filter(
      i => i.client_id === client.id ||
        (!i.client_id && i.client_name.toLowerCase() === client.name.toLowerCase())
    );
    const clientPayments = payments.filter(
      p => p.client_id === client.id ||
        (!p.client_id && p.client_name?.toLowerCase() === client.name.toLowerCase())
    );
    const clientQuotes = quotes.filter(
      q => q.client_id === client.id ||
        (!q.client_id && q.client_name.toLowerCase() === client.name.toLowerCase())
    );

    const totalBilled = clientInvoices.reduce((sum, i) => sum + (Number(i.amount_usd) || 0), 0);
    const totalPaid = clientPayments.reduce((sum, p) => sum + (Number(p.amount_usd) || 0), 0);
    const openingBalance = Number(client.opening_balance) || 0;
    const outstanding = totalBilled - totalPaid + openingBalance;

    return {
      totalBilled,
      totalPaid,
      openingBalance,
      outstanding,
      invoiceCount: clientInvoices.length,
      quoteCount: clientQuotes.length,
      paymentCount: clientPayments.length,
    };
  };

  // Generate ledger for client
  const generateLedger = (client: Client): LedgerEntry[] => {
    const entries: LedgerEntry[] = [];
    const openingBalance = Number(client.opening_balance) || 0;

    if (openingBalance !== 0) {
      entries.push({
        date: new Date(client.created_at),
        type: 'opening',
        reference: 'Opening Balance',
        description: 'Starting balance',
        debit: openingBalance > 0 ? openingBalance : 0,
        credit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
        balance: openingBalance,
      });
    }

    invoices
      .filter(i =>
        i.client_id === client.id ||
        (!i.client_id && i.client_name.toLowerCase() === client.name.toLowerCase())
      )
      .forEach(inv => {
        entries.push({
          date: new Date(inv.created_at),
          type: 'invoice',
          reference: inv.invoice_number,
          description: inv.description || 'Invoice',
          debit: Number(inv.amount_usd) || 0,
          credit: 0,
          balance: 0,
          id: inv.id,
        });
      });

    payments
      .filter(p =>
        p.client_id === client.id ||
        (!p.client_id && p.client_name?.toLowerCase() === client.name.toLowerCase())
      )
      .forEach(pay => {
        entries.push({
          date: new Date(pay.date),
          type: 'payment',
          reference: pay.reference_id || 'Payment',
          description: `Payment via ${pay.method || 'Unknown'}`,
          debit: 0,
          credit: Number(pay.amount_usd) || 0,
          balance: 0,
          id: pay.id,
        });
      });

    entries.sort((a, b) => a.date.getTime() - b.date.getTime());

    let runningBalance = 0;
    return entries.map(entry => {
      runningBalance += entry.debit - entry.credit;
      return { ...entry, balance: runningBalance };
    });
  };

  // Filter ledger by date range
  const getFilteredLedger = (client: Client): LedgerEntry[] => {
    const ledger = generateLedger(client);
    const [startDate, endDate] = statementDateRange;

    if (!startDate && !endDate) return ledger;

    return ledger.filter(entry => {
      const entryDate = entry.date;
      if (startDate && entryDate < startDate) return false;
      if (endDate && entryDate > endDate) return false;
      return true;
    });
  };

  // Generate and download statement
  const handleDownloadStatement = async () => {
    if (!selectedClient || !company) return;

    setIsGeneratingStatement(true);
    try {
      const stats = getClientStats(selectedClient);
      const clientInvoices = invoices.filter(
        i => i.client_id === selectedClient.id ||
          (!i.client_id && i.client_name.toLowerCase() === selectedClient.name.toLowerCase())
      );
      const clientPayments = payments.filter(
        p => p.client_id === selectedClient.id ||
          (!p.client_id && p.client_name?.toLowerCase() === selectedClient.name.toLowerCase())
      );

      const [startDate, endDate] = statementDateRange;

      const filteredInvoices = clientInvoices.filter(inv => {
        if (!startDate && !endDate) return true;
        const invDate = new Date(inv.created_at);
        if (startDate && invDate < startDate) return false;
        if (endDate && invDate > endDate) return false;
        return true;
      });

      const filteredPayments = clientPayments.filter(pay => {
        if (!startDate && !endDate) return true;
        const payDate = new Date(pay.date);
        if (startDate && payDate < startDate) return false;
        if (endDate && payDate > endDate) return false;
        return true;
      });

      const paymentCurrencyMap: Record<string, 'USD' | 'GBP'> = {};
      filteredPayments.forEach(p => {
        if (p.id && p.currency) paymentCurrencyMap[p.id] = p.currency;
      });

      const statementData = {
        client_name: selectedClient.name,
        client_email: selectedClient.email,
        client_address: selectedClient.address,
        invoices: filteredInvoices,
        payments: filteredPayments,
        paymentCurrencyMap,
        startDate: startDate?.toISOString() || clientInvoices[0]?.created_at || new Date().toISOString(),
        endDate: endDate?.toISOString() || new Date().toISOString(),
      };

      const blob = await generateStatementPDF(statementData, company);
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
      showToast(err?.message || 'Failed to generate statement', 'error');
    } finally {
      setIsGeneratingStatement(false);
    }
  };

  // Table rows
  const rows = useMemo(() => {
    return clients.map(client => {
      const stats = getClientStats(client);
      return {
        id: client.id,
        name: client.name,
        company: client.company || '-',
        outstanding: {
          value: stats.outstanding,
          display: (
            <span style={{
              color: stats.outstanding > 0
                ? 'var(--cds-support-error, #da1e28)'
                : stats.outstanding < 0
                  ? 'var(--cds-support-success, #24a148)'
                  : 'var(--cds-text-primary, #161616)',
              fontWeight: 600,
            }}>
              {formatMoney(stats.outstanding)} {stats.outstanding > 0 ? 'DR' : stats.outstanding < 0 ? 'CR' : ''}
            </span>
          ),
        },
        invoices: stats.invoiceCount,
        payments: stats.paymentCount,
        client,
        stats,
      };
    });
  }, [clients, invoices, payments, quotes]);

  // Filtered rows for search
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.company.toLowerCase().includes(q)
    );
  }, [rows, searchQuery]);

  if (loading) {
    return (
      <div style={{ padding: 'var(--cds-spacing-05, 1rem)' }}>
        <div className="flex flex-col gap-5">
          <Skeleton variant="rectangular" width="100%" height="3rem" />
          <Skeleton variant="rectangular" width="100%" height="20rem" />
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--cds-layer-01, #ffffff)',
      padding: 'var(--cds-spacing-05, 1rem)'
    }}>
      <ToastContainer />
      <ConfirmDialog />

      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 'var(--cds-spacing-06, 1.5rem)'
      }}>
        <div>
          <h1 style={{
            fontSize: 'var(--cds-productive-heading-05-font-size, 2rem)',
            fontWeight: 600,
            color: 'var(--cds-text-primary, #161616)'
          }}>
            Client Directory
          </h1>
          <p style={{
            fontSize: 'var(--cds-body-01-font-size, 0.875rem)',
            color: 'var(--cds-text-secondary, #525252)',
            marginTop: 'var(--cds-spacing-02, 0.25rem)'
          }}>
            {clients.length} registered clients
          </p>
        </div>
        <Button leftIcon={<Plus size={14} />}>
          Add Client
        </Button>
      </div>

      {selectedClient ? (
        // Client Detail View
        <div className="flex flex-col gap-5">
          {/* Back button */}
          <Button variant="ghost" onClick={() => setSelectedClient(null)}>
            ← Back to Client List
          </Button>

          {/* Client Header */}
          <div>
            <div style={{ padding: 'var(--cds-spacing-06, 1.5rem)' }} className="bg-white border border-gray-200">
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 'var(--cds-spacing-05, 1rem)'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--cds-spacing-03, 0.5rem)' }}>
                    <h2 style={{
                      fontSize: 'var(--cds-productive-heading-04-font-size, 1.75rem)',
                      fontWeight: 600
                    }}>
                      {selectedClient.name}
                    </h2>
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-700">Active</span>
                  </div>
                  {selectedClient.company && (
                    <p style={{ color: 'var(--cds-text-secondary, #525252)', marginTop: 'var(--cds-spacing-02, 0.25rem)' }}>
                      {selectedClient.company}
                    </p>
                  )}
                  <div style={{
                    display: 'flex',
                    gap: 'var(--cds-spacing-05, 1rem)',
                    marginTop: 'var(--cds-spacing-03, 0.5rem)',
                    fontSize: 'var(--cds-body-01-font-size, 0.875rem)',
                    color: 'var(--cds-text-secondary, #525252)'
                  }}>
                    {selectedClient.email && <span>✉ {selectedClient.email}</span>}
                    {selectedClient.phone && <span>📞 {selectedClient.phone}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--cds-spacing-03, 0.5rem)' }}>
                  <Button variant="ghost" leftIcon={<Pencil size={14} />} aria-label="Edit client" />
                  <Button variant="danger" leftIcon={<Trash2 size={14} />} aria-label="Delete client" />
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12 sm:col-span-6 lg:col-span-3">
                  <div style={{ padding: 'var(--cds-spacing-05, 1rem)' }} className="bg-white border border-gray-200">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--cds-spacing-03, 0.5rem)', marginBottom: 'var(--cds-spacing-02, 0.25rem)' }}>
                      <Activity size={16} />
                      <span style={{ fontSize: 'var(--cds-label-01-font-size, 0.75rem)', fontWeight: 600 }}>OPENING BALANCE</span>
                    </div>
                    <p style={{ fontSize: 'var(--cds-productive-heading-03-font-size, 1.25rem)', fontWeight: 600 }}>
                      {formatMoney(getClientStats(selectedClient).openingBalance)}
                    </p>
                  </div>
                </div>
                <div className="col-span-12 sm:col-span-6 lg:col-span-3">
                  <div style={{ padding: 'var(--cds-spacing-05, 1rem)' }} className="bg-white border border-gray-200">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--cds-spacing-03, 0.5rem)', marginBottom: 'var(--cds-spacing-02, 0.25rem)' }}>
                      <FileText size={16} />
                      <span style={{ fontSize: 'var(--cds-label-01-font-size, 0.75rem)', fontWeight: 600 }}>TOTAL BILLED</span>
                    </div>
                    <p style={{ fontSize: 'var(--cds-productive-heading-03-font-size, 1.25rem)', fontWeight: 600 }}>
                      {formatMoney(getClientStats(selectedClient).totalBilled)}
                    </p>
                  </div>
                </div>
                <div className="col-span-12 sm:col-span-6 lg:col-span-3">
                  <div style={{ padding: 'var(--cds-spacing-05, 1rem)' }} className="bg-white border border-gray-200">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--cds-spacing-03, 0.5rem)', marginBottom: 'var(--cds-spacing-02, 0.25rem)' }}>
                      <DollarSign size={16} />
                      <span style={{ fontSize: 'var(--cds-label-01-font-size, 0.75rem)', fontWeight: 600 }}>TOTAL PAID</span>
                    </div>
                    <p style={{ fontSize: 'var(--cds-productive-heading-03-font-size, 1.25rem)', fontWeight: 600, color: 'var(--cds-support-success, #24a148)' }}>
                      {formatMoney(getClientStats(selectedClient).totalPaid)}
                    </p>
                  </div>
                </div>
                <div className="col-span-12 sm:col-span-6 lg:col-span-3">
                  <div
                    style={{
                      padding: 'var(--cds-spacing-05, 1rem)',
                      borderLeft: '3px solid var(--cds-interactive, #0f62fe)'
                    }}
                    className="bg-white border border-gray-200"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--cds-spacing-03, 0.5rem)', marginBottom: 'var(--cds-spacing-02, 0.25rem)' }}>
                      <ShoppingCart size={16} />
                      <span style={{ fontSize: 'var(--cds-label-01-font-size, 0.75rem)', fontWeight: 600 }}>OUTSTANDING</span>
                    </div>
                    <p style={{
                      fontSize: 'var(--cds-productive-heading-03-font-size, 1.25rem)',
                      fontWeight: 600,
                      color: getClientStats(selectedClient).outstanding > 0
                        ? 'var(--cds-support-error, #da1e28)'
                        : getClientStats(selectedClient).outstanding < 0
                          ? 'var(--cds-support-success, #24a148)'
                          : 'var(--cds-text-primary, #161616)'
                    }}>
                      {formatMoney(Math.abs(getClientStats(selectedClient).outstanding))}
                      {getClientStats(selectedClient).outstanding !== 0 && (
                        <span style={{ fontSize: 'var(--cds-body-01-font-size, 0.875rem)', marginLeft: 'var(--cds-spacing-02, 0.25rem)' }}>
                          {getClientStats(selectedClient).outstanding > 0 ? 'DR' : 'CR'}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs selectedIndex={activeTab} onChange={({ selectedIndex }) => setActiveTab(selectedIndex)}>
            <TabList>
              <Tab>{`Invoices (${invoices.filter(i => i.client_name.toLowerCase() === selectedClient.name.toLowerCase()).length})`}</Tab>
              <Tab>{`Payments (${payments.filter(p => p.client_name?.toLowerCase() === selectedClient.name.toLowerCase()).length})`}</Tab>
              <Tab>{`Quotes (${quotes.filter(q => q.client_name.toLowerCase() === selectedClient.name.toLowerCase()).length})`}</Tab>
              <Tab>Statement</Tab>
            </TabList>

            <TabPanels>
              {/* Invoices Tab */}
              <TabPanel>
                <div className="bg-white border border-gray-200">
                  {(() => {
                    const clientInvoices = invoices.filter(
                      i => i.client_name.toLowerCase() === selectedClient.name.toLowerCase()
                    );
                    if (clientInvoices.length === 0) {
                      return <p style={{ textAlign: 'center', padding: 'var(--cds-spacing-09, 3rem)', color: 'var(--cds-text-secondary, #525252)' }}>No invoices for this client</p>;
                    }
                    return (
                      <div className="bg-white border border-gray-200 overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Invoice #</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Date</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Due Date</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Status</th>
                              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {clientInvoices.map(inv => (
                              <tr key={inv.id}>
                                <td className="px-3 py-2 text-sm text-gray-800 border-t border-gray-100">{inv.invoice_number}</td>
                                <td className="px-3 py-2 text-sm text-gray-800 border-t border-gray-100">{new Date(inv.created_at).toLocaleDateString()}</td>
                                <td className="px-3 py-2 text-sm text-gray-800 border-t border-gray-100">{new Date(inv.due_date).toLocaleDateString()}</td>
                                <td className="px-3 py-2 text-sm text-gray-800 border-t border-gray-100">
                                  <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${
                                    inv.status === 'Paid' ? 'bg-green-100 text-green-700' :
                                    inv.status === 'Overdue' ? 'bg-red-100 text-red-700' :
                                    'bg-blue-100 text-blue-700'
                                  }`}>
                                    {inv.status}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-800 border-t border-gray-100 text-right font-semibold">
                                  {formatMoney(inv.amount_usd, inv.currency)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              </TabPanel>

              {/* Payments Tab */}
              <TabPanel>
                <div className="bg-white border border-gray-200">
                  {(() => {
                    const clientPayments = payments.filter(
                      p => p.client_name?.toLowerCase() === selectedClient.name.toLowerCase()
                    );
                    if (clientPayments.length === 0) {
                      return <p style={{ textAlign: 'center', padding: 'var(--cds-spacing-09, 3rem)', color: 'var(--cds-text-secondary, #525252)' }}>No payments for this client</p>;
                    }
                    return (
                      <div className="bg-white border border-gray-200 overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Reference</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Date</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Method</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Status</th>
                              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {clientPayments.map(pay => (
                              <tr key={pay.id}>
                                <td className="px-3 py-2 text-sm text-gray-800 border-t border-gray-100">{pay.reference_id || '-'}</td>
                                <td className="px-3 py-2 text-sm text-gray-800 border-t border-gray-100">{new Date(pay.date).toLocaleDateString()}</td>
                                <td className="px-3 py-2 text-sm text-gray-800 border-t border-gray-100">{pay.method}</td>
                                <td className="px-3 py-2 text-sm text-gray-800 border-t border-gray-100">
                                  <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${
                                    pay.status === 'unallocated' ? 'bg-gray-100 text-gray-700' : 'bg-green-100 text-green-700'
                                  }`}>
                                    {pay.status === 'unallocated' ? 'Unallocated' : 'Allocated'}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-sm border-t border-gray-100 text-right font-semibold" style={{ color: 'var(--cds-support-success, #24a148)' }}>
                                  {formatMoney(pay.amount_usd, pay.currency)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              </TabPanel>

              {/* Quotes Tab */}
              <TabPanel>
                <div className="bg-white border border-gray-200">
                  {(() => {
                    const clientQuotes = quotes.filter(
                      q => q.client_name.toLowerCase() === selectedClient.name.toLowerCase()
                    );
                    if (clientQuotes.length === 0) {
                      return <p style={{ textAlign: 'center', padding: 'var(--cds-spacing-09, 3rem)', color: 'var(--cds-text-secondary, #525252)' }}>No quotes for this client</p>;
                    }
                    return (
                      <div className="bg-white border border-gray-200 overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Quote #</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Date</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Valid Until</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Status</th>
                              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {clientQuotes.map(q => (
                              <tr key={q.id}>
                                <td className="px-3 py-2 text-sm text-gray-800 border-t border-gray-100">{q.quote_number}</td>
                                <td className="px-3 py-2 text-sm text-gray-800 border-t border-gray-100">{new Date(q.created_at).toLocaleDateString()}</td>
                                <td className="px-3 py-2 text-sm text-gray-800 border-t border-gray-100">{q.valid_until ? new Date(q.valid_until).toLocaleDateString() : '-'}</td>
                                <td className="px-3 py-2 text-sm text-gray-800 border-t border-gray-100">
                                  <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${
                                    q.status === 'Accepted' ? 'bg-green-100 text-green-700' :
                                    q.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                                    'bg-blue-100 text-blue-700'
                                  }`}>
                                    {q.status}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-800 border-t border-gray-100 text-right font-semibold">
                                  {formatMoney(q.amount_usd, q.currency)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              </TabPanel>

              {/* Statement Tab */}
              <TabPanel>
                <div className="flex flex-col gap-5">
                  {/* Statement Actions */}
                  <div className="bg-white border border-gray-200" style={{ padding: 'var(--cds-spacing-05, 1rem)' }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-end',
                      flexWrap: 'wrap',
                      gap: 'var(--cds-spacing-04, 0.75rem)'
                    }}>
                      <div style={{ display: 'flex', gap: 'var(--cds-spacing-04, 0.75rem)', alignItems: 'flex-end' }}>
                        <div className="flex flex-col gap-1">
                          <label htmlFor="date-from" className="text-xs font-medium text-gray-700">From</label>
                          <input
                            id="date-from"
                            type="date"
                            className="border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            onChange={e => {
                              const val = e.target.value ? new Date(e.target.value) : null;
                              setStatementDateRange([val, statementDateRange[1]]);
                            }}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label htmlFor="date-to" className="text-xs font-medium text-gray-700">To</label>
                          <input
                            id="date-to"
                            type="date"
                            className="border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            onChange={e => {
                              const val = e.target.value ? new Date(e.target.value) : null;
                              setStatementDateRange([statementDateRange[0], val]);
                            }}
                          />
                        </div>
                      </div>
                      <Button
                        leftIcon={isGeneratingStatement ? undefined : <Download size={14} />}
                        onClick={handleDownloadStatement}
                        disabled={isGeneratingStatement}
                        isLoading={isGeneratingStatement}
                      >
                        {isGeneratingStatement ? 'Generating...' : 'Download PDF Statement'}
                      </Button>
                    </div>
                  </div>

                  {/* Statement Ledger */}
                  <div className="bg-white border border-gray-200">
                    {(() => {
                      const ledger = getFilteredLedger(selectedClient);
                      if (ledger.length === 0) {
                        return <p style={{ textAlign: 'center', padding: 'var(--cds-spacing-09, 3rem)', color: 'var(--cds-text-secondary, #525252)' }}>No entries for the selected date range</p>;
                      }
                      return (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Date</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Type</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Reference</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Debit</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Credit</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Balance</th>
                              </tr>
                            </thead>
                            <tbody>
                              {ledger.map((entry, index) => (
                                <tr key={index}>
                                  <td className="px-3 py-2 text-sm text-gray-800 border-t border-gray-100">{entry.date.toLocaleDateString()}</td>
                                  <td className="px-3 py-2 text-sm text-gray-800 border-t border-gray-100">{getStatusTag(entry.type)}</td>
                                  <td className="px-3 py-2 text-sm text-gray-800 border-t border-gray-100">{entry.reference}</td>
                                  <td className="px-3 py-2 text-sm border-t border-gray-100 text-right" style={{ color: 'var(--cds-support-error, #da1e28)' }}>
                                    {entry.debit > 0 ? formatMoney(entry.debit) : '-'}
                                  </td>
                                  <td className="px-3 py-2 text-sm border-t border-gray-100 text-right" style={{ color: 'var(--cds-support-success, #24a148)' }}>
                                    {entry.credit > 0 ? formatMoney(entry.credit) : '-'}
                                  </td>
                                  <td className="px-3 py-2 text-sm border-t border-gray-100 text-right font-semibold" style={{
                                    color: entry.balance > 0
                                      ? 'var(--cds-support-error, #da1e28)'
                                      : entry.balance < 0
                                        ? 'var(--cds-support-success, #24a148)'
                                        : 'var(--cds-text-primary, #161616)'
                                  }}>
                                    {formatMoney(Math.abs(entry.balance))}
                                    {entry.balance !== 0 && (
                                      <span style={{ marginLeft: 'var(--cds-spacing-02, 0.25rem)' }}>
                                        {entry.balance > 0 ? 'DR' : 'CR'}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                              <tr style={{
                                backgroundColor: 'var(--cds-layer-02, #f4f4f4)',
                                borderTop: '2px solid var(--cds-border-strong, #8d8d8d)'
                              }}>
                                <td colSpan={5} className="px-3 py-2 text-sm text-gray-800">
                                  <span style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Current Balance
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-right" style={{
                                  fontWeight: 700,
                                  fontSize: 'var(--cds-productive-heading-03-font-size, 1.25rem)',
                                  color: getClientStats(selectedClient).outstanding > 0
                                    ? 'var(--cds-support-error, #da1e28)'
                                    : getClientStats(selectedClient).outstanding < 0
                                      ? 'var(--cds-support-success, #24a148)'
                                      : 'var(--cds-text-primary, #161616)'
                                }}>
                                  {formatMoney(Math.abs(getClientStats(selectedClient).outstanding))}
                                  {getClientStats(selectedClient).outstanding !== 0 && (
                                    <span style={{ marginLeft: 'var(--cds-spacing-02, 0.25rem)', fontSize: 'var(--cds-body-01-font-size, 0.875rem)' }}>
                                      {getClientStats(selectedClient).outstanding > 0 ? 'DR' : 'CR'}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </div>
      ) : (
        // Client List View
        <div className="bg-white border border-gray-200">
          {/* Toolbar */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
            <div className="flex-1">
              <h2 className="text-base font-semibold text-gray-900">Clients</h2>
              <p className="text-xs text-gray-500">Manage your client relationships and financial history</p>
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="search"
                placeholder="Search by name or company"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Client Name</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Company</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Balance</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Invoices</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Payments</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600"></th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map(row => {
                  const rowClient = clients.find(candidate => candidate.id === row.id);
                  if (!rowClient) return null;
                  return (
                    <tr key={row.id}>
                      <td className="px-3 py-2 text-sm text-gray-800 border-t border-gray-100" onClick={() => setSelectedClient(rowClient)} style={{ cursor: 'pointer' }}>
                        <div style={{ fontWeight: 600, color: 'var(--cds-interactive, #0f62fe)' }}>
                          {row.name}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-800 border-t border-gray-100" onClick={() => setSelectedClient(rowClient)} style={{ cursor: 'pointer' }}>
                        {row.company}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-800 border-t border-gray-100" onClick={() => setSelectedClient(rowClient)} style={{ cursor: 'pointer' }}>
                        {row.outstanding.display}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-800 border-t border-gray-100" onClick={() => setSelectedClient(rowClient)} style={{ cursor: 'pointer' }}>
                        {row.invoices}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-800 border-t border-gray-100" onClick={() => setSelectedClient(rowClient)} style={{ cursor: 'pointer' }}>
                        {row.payments}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-800 border-t border-gray-100">
                        <OverflowMenu flipped>
                          <OverflowMenuItem itemText="View Details" onClick={() => setSelectedClient(rowClient)} />
                          <OverflowMenuItem itemText="Edit Client" />
                          <OverflowMenuItem itemText="View Statement" onClick={() => { setSelectedClient(rowClient); setActiveTab(3); }} />
                          <OverflowMenuItem itemText="Delete" hasDivider isDelete />
                        </OverflowMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CarbonClientDirectory;
