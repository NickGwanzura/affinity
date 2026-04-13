import React, { useEffect, useState, useMemo } from 'react';
import {
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableContainer,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  Button,
  Tabs,
  Tab,
  TabPanels,
  TabPanel,
  Tile,
  Grid,
  Column,
  Tag,
  OverflowMenu,
  OverflowMenuItem,
  DatePicker,
  DatePickerInput,
  Stack,
  Layer,
  SkeletonPlaceholder,
  InlineLoading,
} from '@carbon/react';
import { Add, DocumentDownload, Edit, TrashCan, Money, Document, ShoppingCart, Activity } from '@carbon/icons-react';
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
  switch (type) {
    case 'opening': return <Tag type="gray" size="sm">Opening</Tag>;
    case 'invoice': return <Tag type="blue" size="sm">Invoice</Tag>;
    case 'payment': return <Tag type="green" size="sm">Payment</Tag>;
    default: return <Tag size="sm">{type}</Tag>;
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

  // Table headers
  const headers = [
    { key: 'name', header: 'Client Name' },
    { key: 'company', header: 'Company' },
    { key: 'outstanding', header: 'Balance' },
    { key: 'invoices', header: 'Invoices' },
    { key: 'payments', header: 'Payments' },
    { key: 'actions', header: '' },
  ];

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

  if (loading) {
    return (
      <div style={{ padding: 'var(--cds-spacing-05, 1rem)' }}>
        <Stack gap={5}>
          <div style={{ height: '3rem', width: '100%' }}>
            <SkeletonPlaceholder />
          </div>
          <div style={{ height: '20rem', width: '100%' }}>
            <SkeletonPlaceholder />
          </div>
        </Stack>
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
        <Button renderIcon={Add}>
          Add Client
        </Button>
      </div>

      {selectedClient ? (
        // Client Detail View
        <Stack gap={5}>
          {/* Back button */}
          <Button kind="ghost" onClick={() => setSelectedClient(null)}>
            ← Back to Client List
          </Button>

          {/* Client Header */}
          <Layer>
            <Tile style={{ padding: 'var(--cds-spacing-06, 1.5rem)' }}>
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
                    <Tag type="green" size="sm">Active</Tag>
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
                  <Button kind="ghost" renderIcon={Edit} iconDescription="Edit client" hasIconOnly />
                  <Button kind="danger--ghost" renderIcon={TrashCan} iconDescription="Delete client" hasIconOnly />
                </div>
              </div>

              {/* Stats Grid */}
              <Grid narrow>
                <Column sm={4} md={4} lg={3}>
                  <Tile light style={{ padding: 'var(--cds-spacing-05, 1rem)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--cds-spacing-03, 0.5rem)', marginBottom: 'var(--cds-spacing-02, 0.25rem)' }}>
                      <Activity size={16} />
                      <span style={{ fontSize: 'var(--cds-label-01-font-size, 0.75rem)', fontWeight: 600 }}>OPENING BALANCE</span>
                    </div>
                    <p style={{ fontSize: 'var(--cds-productive-heading-03-font-size, 1.25rem)', fontWeight: 600 }}>
                      {formatMoney(getClientStats(selectedClient).openingBalance)}
                    </p>
                  </Tile>
                </Column>
                <Column sm={4} md={4} lg={3}>
                  <Tile light style={{ padding: 'var(--cds-spacing-05, 1rem)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--cds-spacing-03, 0.5rem)', marginBottom: 'var(--cds-spacing-02, 0.25rem)' }}>
                      <Document size={16} />
                      <span style={{ fontSize: 'var(--cds-label-01-font-size, 0.75rem)', fontWeight: 600 }}>TOTAL BILLED</span>
                    </div>
                    <p style={{ fontSize: 'var(--cds-productive-heading-03-font-size, 1.25rem)', fontWeight: 600 }}>
                      {formatMoney(getClientStats(selectedClient).totalBilled)}
                    </p>
                  </Tile>
                </Column>
                <Column sm={4} md={4} lg={3}>
                  <Tile light style={{ padding: 'var(--cds-spacing-05, 1rem)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--cds-spacing-03, 0.5rem)', marginBottom: 'var(--cds-spacing-02, 0.25rem)' }}>
                      <Money size={16} />
                      <span style={{ fontSize: 'var(--cds-label-01-font-size, 0.75rem)', fontWeight: 600 }}>TOTAL PAID</span>
                    </div>
                    <p style={{ fontSize: 'var(--cds-productive-heading-03-font-size, 1.25rem)', fontWeight: 600, color: 'var(--cds-support-success, #24a148)' }}>
                      {formatMoney(getClientStats(selectedClient).totalPaid)}
                    </p>
                  </Tile>
                </Column>
                <Column sm={4} md={4} lg={3}>
                  <Tile 
                    light 
                    style={{ 
                      padding: 'var(--cds-spacing-05, 1rem)',
                      borderLeft: '3px solid var(--cds-interactive, #0f62fe)'
                    }}
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
                  </Tile>
                </Column>
              </Grid>
            </Tile>
          </Layer>

          {/* Tabs */}
          <Tabs selectedIndex={activeTab} onChange={({ selectedIndex }) => setActiveTab(selectedIndex)}>
            <Tab label={`Invoices (${invoices.filter(i => i.client_name.toLowerCase() === selectedClient.name.toLowerCase()).length})`} />
            <Tab label={`Payments (${payments.filter(p => p.client_name?.toLowerCase() === selectedClient.name.toLowerCase()).length})`} />
            <Tab label={`Quotes (${quotes.filter(q => q.client_name.toLowerCase() === selectedClient.name.toLowerCase()).length})`} />
            <Tab label="Statement" />
          </Tabs>

          <TabPanels>
            {/* Invoices Tab */}
            <TabPanel>
              <Layer>
                <Tile>
                  {(() => {
                    const clientInvoices = invoices.filter(
                      i => i.client_name.toLowerCase() === selectedClient.name.toLowerCase()
                    );
                    if (clientInvoices.length === 0) {
                      return <p style={{ textAlign: 'center', padding: 'var(--cds-spacing-09, 3rem)', color: 'var(--cds-text-secondary, #525252)' }}>No invoices for this client</p>;
                    }
                    return (
                      <Table size="lg">
                        <TableHead>
                          <TableRow>
                            <TableHeader>Invoice #</TableHeader>
                            <TableHeader>Date</TableHeader>
                            <TableHeader>Due Date</TableHeader>
                            <TableHeader>Status</TableHeader>
                            <TableHeader style={{ textAlign: 'right' }}>Amount</TableHeader>
                          </TableRow>
                        </TableHead>
                        <TableBody {...({} as any)}>
                          {clientInvoices.map(inv => (
                            <TableRow key={inv.id}>
                              <TableCell>{inv.invoice_number}</TableCell>
                              <TableCell>{new Date(inv.created_at).toLocaleDateString()}</TableCell>
                              <TableCell>{new Date(inv.due_date).toLocaleDateString()}</TableCell>
                              <TableCell>
                                <Tag 
                                  type={inv.status === 'Paid' ? 'green' : inv.status === 'Overdue' ? 'red' : 'blue'} 
                                  size="sm"
                                >
                                  {inv.status}
                                </Tag>
                              </TableCell>
                              <TableCell style={{ textAlign: 'right', fontWeight: 600 }}>
                                {formatMoney(inv.amount_usd, inv.currency)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    );
                  })()}
                </Tile>
              </Layer>
            </TabPanel>

            {/* Payments Tab */}
            <TabPanel>
              <Layer>
                <Tile>
                  {(() => {
                    const clientPayments = payments.filter(
                      p => p.client_name?.toLowerCase() === selectedClient.name.toLowerCase()
                    );
                    if (clientPayments.length === 0) {
                      return <p style={{ textAlign: 'center', padding: 'var(--cds-spacing-09, 3rem)', color: 'var(--cds-text-secondary, #525252)' }}>No payments for this client</p>;
                    }
                    return (
                      <Table size="lg">
                        <TableHead>
                          <TableRow>
                            <TableHeader>Reference</TableHeader>
                            <TableHeader>Date</TableHeader>
                            <TableHeader>Method</TableHeader>
                            <TableHeader>Status</TableHeader>
                            <TableHeader style={{ textAlign: 'right' }}>Amount</TableHeader>
                          </TableRow>
                        </TableHead>
                        <TableBody {...({} as any)}>
                          {clientPayments.map(pay => (
                            <TableRow key={pay.id}>
                              <TableCell>{pay.reference_id || '-'}</TableCell>
                              <TableCell>{new Date(pay.date).toLocaleDateString()}</TableCell>
                              <TableCell>{pay.method}</TableCell>
                              <TableCell>
                                <Tag 
                                  type={pay.status === 'unallocated' ? 'warm-gray' : 'green'} 
                                  size="sm"
                                >
                                  {pay.status === 'unallocated' ? 'Unallocated' : 'Allocated'}
                                </Tag>
                              </TableCell>
                              <TableCell style={{ textAlign: 'right', fontWeight: 600, color: 'var(--cds-support-success, #24a148)' }}>
                                {formatMoney(pay.amount_usd, pay.currency)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    );
                  })()}
                </Tile>
              </Layer>
            </TabPanel>

            {/* Quotes Tab */}
            <TabPanel>
              <Layer>
                <Tile>
                  {(() => {
                    const clientQuotes = quotes.filter(
                      q => q.client_name.toLowerCase() === selectedClient.name.toLowerCase()
                    );
                    if (clientQuotes.length === 0) {
                      return <p style={{ textAlign: 'center', padding: 'var(--cds-spacing-09, 3rem)', color: 'var(--cds-text-secondary, #525252)' }}>No quotes for this client</p>;
                    }
                    return (
                      <Table size="lg">
                        <TableHead>
                          <TableRow>
                            <TableHeader>Quote #</TableHeader>
                            <TableHeader>Date</TableHeader>
                            <TableHeader>Valid Until</TableHeader>
                            <TableHeader>Status</TableHeader>
                            <TableHeader style={{ textAlign: 'right' }}>Amount</TableHeader>
                          </TableRow>
                        </TableHead>
                        <TableBody {...({} as any)}>
                          {clientQuotes.map(q => (
                            <TableRow key={q.id}>
                              <TableCell>{q.quote_number}</TableCell>
                              <TableCell>{new Date(q.created_at).toLocaleDateString()}</TableCell>
                              <TableCell>{q.valid_until ? new Date(q.valid_until).toLocaleDateString() : '-'}</TableCell>
                              <TableCell>
                                <Tag 
                                  type={q.status === 'Accepted' ? 'green' : q.status === 'Rejected' ? 'red' : 'blue'} 
                                  size="sm"
                                >
                                  {q.status}
                                </Tag>
                              </TableCell>
                              <TableCell style={{ textAlign: 'right', fontWeight: 600 }}>
                                {formatMoney(q.amount_usd, q.currency)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    );
                  })()}
                </Tile>
              </Layer>
            </TabPanel>

            {/* Statement Tab */}
            <TabPanel>
              <Stack gap={5}>
                {/* Statement Actions */}
                <Layer>
                  <Tile style={{ padding: 'var(--cds-spacing-05, 1rem)' }}>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'flex-end',
                      flexWrap: 'wrap',
                      gap: 'var(--cds-spacing-04, 0.75rem)'
                    }}>
                      <div style={{ display: 'flex', gap: 'var(--cds-spacing-04, 0.75rem)', alignItems: 'flex-end' }}>
                        <DatePicker
                          datePickerType="range"
                          value={statementDateRange}
                          onChange={(range: [Date | null, Date | null]) => setStatementDateRange(range)}
                        >
                          <DatePickerInput
                            id="date-from"
                            labelText="From"
                            placeholder="dd/mm/yyyy"
                          />
                          <DatePickerInput
                            id="date-to"
                            labelText="To"
                            placeholder="dd/mm/yyyy"
                          />
                        </DatePicker>
                      </div>
                      <Button
                        renderIcon={isGeneratingStatement ? undefined : DocumentDownload}
                        onClick={handleDownloadStatement}
                        disabled={isGeneratingStatement}
                      >
                        {isGeneratingStatement ? (
                          <InlineLoading description="Generating..." />
                        ) : (
                          'Download PDF Statement'
                        )}
                      </Button>
                    </div>
                  </Tile>
                </Layer>

                {/* Statement Ledger */}
                <Layer>
                  <Tile>
                    {(() => {
                      const ledger = getFilteredLedger(selectedClient);
                      if (ledger.length === 0) {
                        return <p style={{ textAlign: 'center', padding: 'var(--cds-spacing-09, 3rem)', color: 'var(--cds-text-secondary, #525252)' }}>No entries for the selected date range</p>;
                      }
                      return (
                        <Table size="lg">
                          <TableHead>
                            <TableRow>
                              <TableHeader>Date</TableHeader>
                              <TableHeader>Type</TableHeader>
                              <TableHeader>Reference</TableHeader>
                              <TableHeader style={{ textAlign: 'right' }}>Debit</TableHeader>
                              <TableHeader style={{ textAlign: 'right' }}>Credit</TableHeader>
                              <TableHeader style={{ textAlign: 'right' }}>Balance</TableHeader>
                            </TableRow>
                          </TableHead>
                          <TableBody {...({} as any)}>
                            {ledger.map((entry, index) => (
                              <TableRow key={index}>
                                <TableCell>{entry.date.toLocaleDateString()}</TableCell>
                                <TableCell>{getStatusTag(entry.type)}</TableCell>
                                <TableCell>{entry.reference}</TableCell>
                                <TableCell style={{ textAlign: 'right', color: 'var(--cds-support-error, #da1e28)' }}>
                                  {entry.debit > 0 ? formatMoney(entry.debit) : '-'}
                                </TableCell>
                                <TableCell style={{ textAlign: 'right', color: 'var(--cds-support-success, #24a148)' }}>
                                  {entry.credit > 0 ? formatMoney(entry.credit) : '-'}
                                </TableCell>
                                <TableCell style={{ 
                                  textAlign: 'right', 
                                  fontWeight: 600,
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
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow style={{ 
                              backgroundColor: 'var(--cds-layer-02, #f4f4f4)',
                              borderTop: '2px solid var(--cds-border-strong, #8d8d8d)'
                            }}>
                              <TableCell colSpan={5}>
                                <span style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                  Current Balance
                                </span>
                              </TableCell>
                              <TableCell style={{ 
                                textAlign: 'right', 
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
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      );
                    })()}
                  </Tile>
                </Layer>
              </Stack>
            </TabPanel>
          </TabPanels>
        </Stack>
      ) : (
        // Client List View
        <DataTable rows={rows} headers={headers}>
          {({
            rows,
            headers,
            getHeaderProps,
            getRowProps,
            getTableProps,
            onInputChange,
          }) => (
            <TableContainer title="Clients" description="Manage your client relationships and financial history">
              <TableToolbar>
                <TableToolbarContent>
                  <TableToolbarSearch onChange={onInputChange} placeholder="Search by name or company" />
                </TableToolbarContent>
              </TableToolbar>
              <Table {...getTableProps()}>
                <TableHead>
                  <TableRow>
                    {headers.map(header => (
                      <TableHeader {...getHeaderProps({ header })} key={header.key}>
                        {header.header}
                      </TableHeader>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody {...({} as any)}>
                  {rows.map(row => (
                    (() => {
                      const rowClient = clients.find((candidate) => candidate.id === row.id);
                      if (!rowClient) return null;
                      return (
                    <TableRow {...getRowProps({ row })} key={row.id}>
                      <TableCell onClick={() => setSelectedClient(rowClient)} style={{ cursor: 'pointer' }}>
                        <div style={{ fontWeight: 600, color: 'var(--cds-interactive, #0f62fe)' }}>
                          {row.cells[0].value}
                        </div>
                      </TableCell>
                      <TableCell onClick={() => setSelectedClient(rowClient)} style={{ cursor: 'pointer' }}>
                        {row.cells[1].value}
                      </TableCell>
                      <TableCell onClick={() => setSelectedClient(rowClient)} style={{ cursor: 'pointer' }}>
                        {row.cells[2].value.display}
                      </TableCell>
                      <TableCell onClick={() => setSelectedClient(rowClient)} style={{ cursor: 'pointer' }}>
                        {row.cells[3].value}
                      </TableCell>
                      <TableCell onClick={() => setSelectedClient(rowClient)} style={{ cursor: 'pointer' }}>
                        {row.cells[4].value}
                      </TableCell>
                      <TableCell>
                        <OverflowMenu flipped>
                          <OverflowMenuItem itemText="View Details" onClick={() => setSelectedClient(rowClient)} />
                          <OverflowMenuItem itemText="Edit Client" />
                          <OverflowMenuItem itemText="View Statement" onClick={() => { setSelectedClient(rowClient); setActiveTab(3); }} />
                          <OverflowMenuItem itemText="Delete" hasDivider isDelete />
                        </OverflowMenu>
                      </TableCell>
                    </TableRow>
                      );
                    })()
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DataTable>
      )}
    </div>
  );
};

export default CarbonClientDirectory;
