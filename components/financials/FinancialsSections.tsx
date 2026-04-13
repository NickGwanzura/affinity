import React from 'react';
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
  Tag,
  Tabs,
  Tab,
  TabList,
  TabPanels,
  TabPanel,
  TextInput,
  OverflowMenu,
  OverflowMenuItem,
  Tile,
  Grid,
  Column,
  Dropdown,
} from '@carbon/react';
import {
  Add,
  DocumentDownload,
  View,
  Edit,
  TrashCan,
  Receipt,
  DocumentAdd,
  Money,
  ChartBar,
} from '@carbon/icons-react';
import type { Invoice, Payment, Quote, Receipt as ReceiptType } from '../../types';

export type FinancialsTab = 'quotes' | 'invoices' | 'payments' | 'receipts' | 'statements';

// ============================================================================
// Helper Functions
// ============================================================================

const formatMoney = (amount: number, currency?: string): string => {
  const symbol = currency === 'GBP' ? '£' : '$';
  return `${symbol}${(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const getStatusTagType = (status: string): React.ComponentProps<typeof Tag>['type'] => {
  switch (status) {
    case 'Paid':
    case 'Accepted':
      return 'green';
    case 'Sent':
    case 'Active':
      return 'blue';
    case 'Draft':
    case 'Pending':
      return 'warm-gray';
    case 'Overdue':
      return 'red';
    case 'Rejected':
    case 'Cancelled':
      return 'high-contrast';
    default:
      return 'gray';
  }
};

const getPaymentStatusTag = (payment: Payment): React.ReactNode => {
  if (payment.status === 'unallocated' || payment.reference_id?.startsWith('UNALLOC-')) {
    return <Tag type="warm-gray" size="sm">Unallocated</Tag>;
  }
  if (payment.type === 'Inbound') {
    return <Tag type="green" size="sm">Inbound</Tag>;
  }
  return <Tag type="purple" size="sm">{payment.type}</Tag>;
};

// ============================================================================
// Tab Bar Component
// ============================================================================

interface FinancialsTabBarProps {
  activeTab: FinancialsTab;
  onChange: (tab: FinancialsTab) => void;
  counts: {
    quotes: number;
    invoices: number;
    payments: number;
    receipts: number;
  };
}

export const FinancialsTabBar: React.FC<FinancialsTabBarProps> = ({ activeTab, onChange, counts }) => {
  const tabs: { id: FinancialsTab; label: string; icon: React.ElementType }[] = [
    { id: 'quotes', label: 'Quotes', icon: DocumentAdd },
    { id: 'invoices', label: 'Invoices', icon: Receipt },
    { id: 'payments', label: 'Payments', icon: Money },
    { id: 'receipts', label: 'Receipts', icon: DocumentDownload },
    { id: 'statements', label: 'Statements', icon: ChartBar },
  ];

  const activeIndex = tabs.findIndex(t => t.id === activeTab);

  const getCount = (id: FinancialsTab): number | undefined => {
    if (id === 'quotes') return counts.quotes;
    if (id === 'invoices') return counts.invoices;
    if (id === 'payments') return counts.payments;
    if (id === 'receipts') return counts.receipts;
    return undefined;
  };

  return (
    <Tabs
      selectedIndex={activeIndex}
      onChange={({ selectedIndex }) => onChange(tabs[selectedIndex].id)}
    >
      <TabList aria-label="Financial sections">
        {tabs.map((tab) => {
          const count = getCount(tab.id);
          return (
            <Tab key={tab.id} renderIcon={tab.icon}>
              {tab.label}
              {typeof count === 'number' && (
                <span
                  style={{
                    marginLeft: 'var(--cds-spacing-02, 0.25rem)',
                    fontSize: 'var(--cds-caption-01-font-size, 0.75rem)',
                    opacity: 0.7,
                  }}
                >
                  ({count})
                </span>
              )}
            </Tab>
          );
        })}
      </TabList>
    </Tabs>
  );
};

// ============================================================================
// Quotes Section
// ============================================================================

interface QuotesSectionProps {
  quotes: Quote[];
  deletingKey: string | null;
  formatMoney: (amount: number, currency?: string) => string;
  onPreview: (quote: Quote) => void;
  onDownload: (quote: Quote) => void;
  onEdit: (quote: Quote) => void;
  onConvert: (quote: Quote) => void;
  onDelete: (quote: Quote) => void;
}

export const QuotesSection: React.FC<QuotesSectionProps> = ({
  quotes,
  onPreview,
  onDownload,
  onEdit,
  onConvert,
  onDelete,
}) => {
  const headers = [
    { key: 'quote_number', header: 'Quote #' },
    { key: 'client_name', header: 'Client' },
    { key: 'amount', header: 'Amount' },
    { key: 'status', header: 'Status' },
    { key: 'created', header: 'Created' },
    { key: 'actions', header: '' },
  ];

  const rows = quotes.map((quote) => ({
    id: quote.id,
    quote_number: (
      <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600 }}>
        {quote.quote_number}
      </span>
    ),
    client_name: quote.client_name,
    amount: (
      <span style={{ fontWeight: 600 }}>
        {formatMoney(quote.amount_usd, quote.currency)}
      </span>
    ),
    status: <Tag type={getStatusTagType(quote.status)} size="sm">{quote.status}</Tag>,
    created: new Date(quote.created_at).toLocaleDateString(),
    actions: (
      <OverflowMenu flipped ariaLabel="Quote actions">
        <OverflowMenuItem itemText="Preview" onClick={() => onPreview(quote)} />
        <OverflowMenuItem itemText="Download PDF" onClick={() => onDownload(quote)} />
        <OverflowMenuItem itemText="Edit" onClick={() => onEdit(quote)} />
        <OverflowMenuItem itemText="Convert to Invoice" onClick={() => onConvert(quote)} />
        <OverflowMenuItem itemText="Delete" isDelete onClick={() => onDelete(quote)} />
      </OverflowMenu>
    ),
  }));

  return (
    <DataTable rows={rows} headers={headers}>
      {({
        rows,
        headers,
        getHeaderProps,
        getRowProps,
        getToolbarProps,
        onInputChange,
      }: any) => (
        <TableContainer>
          <TableToolbar {...getToolbarProps()}>
            <TableToolbarContent>
              <TableToolbarSearch onChange={onInputChange} />
            </TableToolbarContent>
          </TableToolbar>
          <Table size="md">
            <TableHead>
              <TableRow>
                {headers.map((header: any) => (
                  <TableHeader {...getHeaderProps({ header })} key={header.key}>
                    {header.header}
                  </TableHeader>
                ))}
              </TableRow>
            </TableHead>
            <TableBody {...({} as any)}>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={headers.length} style={{ textAlign: 'center', padding: '3rem' }}>
                    <Tile>
                      <p style={{ color: 'var(--cds-text-secondary, #525252)' }}>
                        No quotes found
                      </p>
                    </Tile>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row: any) => (
                  <TableRow {...getRowProps({ row })} key={row.id}>
                    {row.cells.map((cell: any) => (
                      <TableCell key={cell.id}>{cell.value}</TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </DataTable>
  );
};

// ============================================================================
// Invoices Section
// ============================================================================

interface InvoicesSectionProps {
  invoices: Invoice[];
  batchFilter: string;
  onBatchFilterChange: (value: string) => void;
  onClearBatchFilter: () => void;
  deletingKey: string | null;
  formatMoney: (amount: number, currency?: string) => string;
  onPreview: (invoice: Invoice) => void;
  onEdit: (invoice: Invoice) => void;
  onDownload: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
}

export const InvoicesSection: React.FC<InvoicesSectionProps> = ({
  invoices,
  batchFilter,
  onBatchFilterChange,
  onClearBatchFilter,
  onPreview,
  onEdit,
  onDownload,
  onDelete,
}) => {
  const filteredInvoices = invoices.filter(
    (invoice) => !batchFilter || (invoice.batch || '').toLowerCase().includes(batchFilter.toLowerCase())
  );

  const headers = [
    { key: 'invoice_number', header: 'Invoice #' },
    { key: 'client_name', header: 'Client' },
    { key: 'batch', header: 'Batch' },
    { key: 'amount', header: 'Amount' },
    { key: 'status', header: 'Status' },
    { key: 'due_date', header: 'Due Date' },
    { key: 'actions', header: '' },
  ];

  const rows = filteredInvoices.map((invoice) => ({
    id: invoice.id,
    invoice_number: (
      <div>
        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600, display: 'block' }}>
          {invoice.invoice_number}
        </span>
        <Tag type="cool-gray" size="sm" style={{ marginTop: '2px' }}>
          {invoice.invoice_kind || 'Standard'}
        </Tag>
      </div>
    ),
    client_name: invoice.client_name,
    batch: invoice.batch ? (
      <Tag type="cyan" size="sm">{invoice.batch}</Tag>
    ) : (
      <span style={{ color: 'var(--cds-text-secondary, #525252)' }}>—</span>
    ),
    amount: (
      <span style={{ fontWeight: 600 }}>
        {formatMoney(invoice.amount_usd, invoice.currency)}
      </span>
    ),
    status: <Tag type={getStatusTagType(invoice.status)} size="sm">{invoice.status}</Tag>,
    due_date: invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '—',
    actions: (
      <OverflowMenu flipped ariaLabel="Invoice actions">
        <OverflowMenuItem itemText="Preview" onClick={() => onPreview(invoice)} />
        <OverflowMenuItem itemText="Download PDF" onClick={() => onDownload(invoice)} />
        <OverflowMenuItem itemText="Edit" onClick={() => onEdit(invoice)} />
        <OverflowMenuItem itemText="Delete" isDelete onClick={() => onDelete(invoice)} />
      </OverflowMenu>
    ),
  }));

  return (
    <div>
      {/* Batch Filter */}
      <div
        style={{
          padding: 'var(--cds-spacing-04, 0.75rem) var(--cds-spacing-05, 1rem)',
          backgroundColor: 'var(--cds-layer-02, #f4f4f4)',
          borderBottom: '1px solid var(--cds-border-subtle, #c6c6c6)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--cds-spacing-03, 0.5rem)' }}>
          <TextInput
            id="invoice-batch-filter"
            labelText="Filter by batch"
            value={batchFilter}
            onChange={(e) => onBatchFilterChange(e.target.value)}
            placeholder="Enter batch code..."
            size="sm"
          />
          {batchFilter && (
            <Button kind="ghost" size="sm" onClick={onClearBatchFilter}>
              Clear
            </Button>
          )}
          {batchFilter && (
            <span
              style={{
                fontSize: 'var(--cds-caption-01-font-size, 0.75rem)',
                color: 'var(--cds-text-secondary, #525252)',
                paddingBottom: 'var(--cds-spacing-03, 0.5rem)',
              }}
            >
              {filteredInvoices.length} result(s)
            </span>
          )}
        </div>
      </div>

      <DataTable rows={rows} headers={headers}>
        {({
          rows,
          headers,
          getHeaderProps,
          getRowProps,
          getToolbarProps,
          onInputChange,
        }: any) => (
          <TableContainer>
            <TableToolbar {...getToolbarProps()}>
              <TableToolbarContent>
                <TableToolbarSearch onChange={onInputChange} />
              </TableToolbarContent>
            </TableToolbar>
            <Table size="md">
              <TableHead>
                <TableRow>
                  {headers.map((header: any) => (
                    <TableHeader {...getHeaderProps({ header })} key={header.key}>
                      {header.header}
                    </TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody {...({} as any)}>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={headers.length} style={{ textAlign: 'center', padding: '3rem' }}>
                      <Tile>
                        <p style={{ color: 'var(--cds-text-secondary, #525252)' }}>
                          {batchFilter ? 'No invoices match the batch filter' : 'No invoices found'}
                        </p>
                      </Tile>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row: any) => (
                    <TableRow {...getRowProps({ row })} key={row.id}>
                      {row.cells.map((cell: any) => (
                        <TableCell key={cell.id}>{cell.value}</TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>
    </div>
  );
};

// ============================================================================
// Payments Section
// ============================================================================

interface PaymentsSectionProps {
  payments: Payment[];
  deletingKey: string | null;
  formatMoney: (amount: number, currency?: string) => string;
  getPaymentClientName: (payment: Payment) => string;
  getPaymentCurrency: (payment: Payment) => string;
  getPaymentAllocationSummary: (payment: Payment) => string | null;
  onEdit: (payment: Payment) => void;
  onDelete: (payment: Payment) => void;
}

export const PaymentsSection: React.FC<PaymentsSectionProps> = ({
  payments,
  getPaymentClientName,
  getPaymentCurrency,
  getPaymentAllocationSummary,
  onEdit,
  onDelete,
}) => {
  const headers = [
    { key: 'client', header: 'Client' },
    { key: 'reference', header: 'Reference' },
    { key: 'status', header: 'Status' },
    { key: 'amount', header: 'Amount' },
    { key: 'method', header: 'Method' },
    { key: 'date', header: 'Date' },
    { key: 'actions', header: '' },
  ];

  const rows = payments.map((payment) => ({
    id: payment.id,
    client: getPaymentClientName(payment),
    reference: (
      <div>
        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 'var(--cds-caption-01-font-size, 0.75rem)' }}>
          {payment.reference_id}
        </span>
        {getPaymentAllocationSummary(payment) && (
          <p
            style={{
              fontSize: 'var(--cds-caption-01-font-size, 0.75rem)',
              color: 'var(--cds-text-secondary, #525252)',
              marginTop: '2px',
            }}
          >
            {getPaymentAllocationSummary(payment)}
          </p>
        )}
      </div>
    ),
    status: getPaymentStatusTag(payment),
    amount: (
      <span style={{ fontWeight: 600, color: 'var(--cds-support-success, #24a148)' }}>
        {formatMoney(payment.amount_usd, getPaymentCurrency(payment))}
      </span>
    ),
    method: payment.method,
    date: payment.date ? new Date(payment.date).toLocaleDateString() : '—',
    actions: (
      <OverflowMenu flipped ariaLabel="Payment actions">
        <OverflowMenuItem itemText="Edit" onClick={() => onEdit(payment)} />
        <OverflowMenuItem itemText="Delete" isDelete onClick={() => onDelete(payment)} />
      </OverflowMenu>
    ),
  }));

  return (
    <DataTable rows={rows} headers={headers}>
      {({
        rows,
        headers,
        getHeaderProps,
        getRowProps,
        getToolbarProps,
        onInputChange,
      }: any) => (
        <TableContainer>
          <TableToolbar {...getToolbarProps()}>
            <TableToolbarContent>
              <TableToolbarSearch onChange={onInputChange} />
            </TableToolbarContent>
          </TableToolbar>
          <Table size="md">
            <TableHead>
              <TableRow>
                {headers.map((header: any) => (
                  <TableHeader {...getHeaderProps({ header })} key={header.key}>
                    {header.header}
                  </TableHeader>
                ))}
              </TableRow>
            </TableHead>
            <TableBody {...({} as any)}>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={headers.length} style={{ textAlign: 'center', padding: '3rem' }}>
                    <Tile>
                      <p style={{ color: 'var(--cds-text-secondary, #525252)' }}>
                        No payments recorded
                      </p>
                    </Tile>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row: any) => (
                  <TableRow {...getRowProps({ row })} key={row.id}>
                    {row.cells.map((cell: any) => (
                      <TableCell key={cell.id}>{cell.value}</TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </DataTable>
  );
};

// ============================================================================
// Receipts Section
// ============================================================================

interface ReceiptsSectionProps {
  receipts: ReceiptType[];
  deletingKey: string | null;
  formatMoney: (amount: number, currency?: string) => string;
  onRecordPayment: () => void;
  onPreview: (receipt: ReceiptType) => void;
  onReissue: (receipt: ReceiptType) => void;
  onDelete: (receipt: ReceiptType) => void;
}

export const ReceiptsSection: React.FC<ReceiptsSectionProps> = ({
  receipts,
  onRecordPayment,
  onPreview,
  onReissue,
  onDelete,
}) => {
  if (receipts.length === 0) {
    return (
      <div style={{ padding: 'var(--cds-spacing-07, 2rem)' }}>
        <Tile style={{ textAlign: 'center', padding: 'var(--cds-spacing-08, 2.5rem)' }}>
          <Receipt size={48} style={{ color: 'var(--cds-support-success, #24a148)', marginBottom: 'var(--cds-spacing-04, 0.75rem)' }} />
          <h3
            style={{
              fontSize: 'var(--cds-heading-02-font-size, 1rem)',
              fontWeight: 600,
              color: 'var(--cds-text-primary, #161616)',
              marginBottom: 'var(--cds-spacing-03, 0.5rem)',
            }}
          >
            Receipts
          </h3>
          <p
            style={{
              fontSize: 'var(--cds-body-01-font-size, 0.875rem)',
              color: 'var(--cds-text-secondary, #525252)',
              marginBottom: 'var(--cds-spacing-05, 1rem)',
            }}
          >
            Record payments and generate receipts for clients.
          </p>
          <Button renderIcon={Add} onClick={onRecordPayment}>
            Record Payment
          </Button>
        </Tile>
      </div>
    );
  }

  const headers = [
    { key: 'receipt_number', header: 'Receipt #' },
    { key: 'client_name', header: 'Client' },
    { key: 'batch', header: 'Batch' },
    { key: 'amount', header: 'Amount' },
    { key: 'date', header: 'Date' },
    { key: 'actions', header: '' },
  ];

  const rows = receipts.map((receipt) => ({
    id: receipt.id,
    receipt_number: (
      <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600, color: 'var(--cds-support-success, #24a148)' }}>
        {receipt.receipt_number}
      </span>
    ),
    client_name: receipt.client_name,
    batch: receipt.batch ? (
      <Tag type="cyan" size="sm">{receipt.batch}</Tag>
    ) : (
      <span style={{ color: 'var(--cds-text-secondary, #525252)' }}>—</span>
    ),
    amount: (
      <span style={{ fontWeight: 600 }}>
        {formatMoney(receipt.amount_received, receipt.currency)}
      </span>
    ),
    date: receipt.payment_date ? new Date(receipt.payment_date).toLocaleDateString() : '—',
    actions: (
      <OverflowMenu flipped ariaLabel="Receipt actions">
        <OverflowMenuItem itemText="Preview PDF" onClick={() => onPreview(receipt)} />
        <OverflowMenuItem itemText="Reissue" onClick={() => onReissue(receipt)} />
        <OverflowMenuItem itemText="Delete" isDelete onClick={() => onDelete(receipt)} />
      </OverflowMenu>
    ),
  }));

  return (
    <div style={{ padding: 'var(--cds-spacing-05, 1rem)' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--cds-spacing-05, 1rem)',
        }}
      >
        <h3
          style={{
            fontSize: 'var(--cds-heading-03-font-size, 1.25rem)',
            fontWeight: 600,
            color: 'var(--cds-text-primary, #161616)',
          }}
        >
          All Receipts
        </h3>
        <Button renderIcon={Add} onClick={onRecordPayment}>
          Record Payment
        </Button>
      </div>

      <DataTable rows={rows} headers={headers}>
        {({
          rows,
          headers,
          getHeaderProps,
          getRowProps,
          getToolbarProps,
          onInputChange,
        }: any) => (
          <TableContainer>
            <TableToolbar {...getToolbarProps()}>
              <TableToolbarContent>
                <TableToolbarSearch onChange={onInputChange} />
              </TableToolbarContent>
            </TableToolbar>
            <Table size="md">
              <TableHead>
                <TableRow>
                  {headers.map((header: any) => (
                    <TableHeader {...getHeaderProps({ header })} key={header.key}>
                      {header.header}
                    </TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody {...({} as any)}>
                {rows.map((row: any) => (
                  <TableRow {...getRowProps({ row })} key={row.id}>
                    {row.cells.map((cell: any) => (
                      <TableCell key={cell.id}>{cell.value}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>
    </div>
  );
};

// ============================================================================
// Statements Section
// ============================================================================

interface StatementsSectionProps {
  selectedClient: string;
  statementDateFrom: string;
  statementDateTo: string;
  clientOptions: { id: string; name: string }[];
  onClientChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onGenerate: () => void;
  onClear: () => void;
}

export const StatementsSection: React.FC<StatementsSectionProps> = ({
  selectedClient,
  statementDateFrom,
  statementDateTo,
  clientOptions,
  onClientChange,
  onDateFromChange,
  onDateToChange,
  onGenerate,
  onClear,
}) => {
  const clientDropdownItems = [
    { id: '', label: 'Select a client' },
    ...clientOptions.map(c => ({ id: c.id, label: c.name })),
  ];

  return (
    <div style={{ padding: 'var(--cds-spacing-07, 2rem)' }}>
      <Tile style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        <ChartBar size={48} style={{ color: 'var(--cds-interactive, #0f62fe)', marginBottom: 'var(--cds-spacing-04, 0.75rem)' }} />
        <h3
          style={{
            fontSize: 'var(--cds-heading-03-font-size, 1.25rem)',
            fontWeight: 600,
            color: 'var(--cds-text-primary, #161616)',
            marginBottom: 'var(--cds-spacing-03, 0.5rem)',
          }}
        >
          Client Statements
        </h3>
        <p
          style={{
            fontSize: 'var(--cds-body-01-font-size, 0.875rem)',
            color: 'var(--cds-text-secondary, #525252)',
            marginBottom: 'var(--cds-spacing-05, 1rem)',
          }}
        >
          Generate a branded statement for a client using their invoices and matching payments,
          optionally filtered by date range.
        </p>

        <Grid narrow>
          <Column sm={4} md={8} lg={16} style={{ marginBottom: 'var(--cds-spacing-05, 1rem)' }}>
            <Dropdown
              id="statement-client"
              titleText="Client"
              label="Select a client"
              items={clientDropdownItems}
              itemToString={(item) => item?.label || ''}
              selectedItem={clientDropdownItems.find(c => c.id === selectedClient) || clientDropdownItems[0]}
              onChange={({ selectedItem }) => onClientChange(selectedItem?.id || '')}
            />
          </Column>
          
          <Column sm={2} md={4} lg={8} style={{ marginBottom: 'var(--cds-spacing-05, 1rem)' }}>
            <div>
              <label
                htmlFor="statement-from"
                style={{
                  display: 'block',
                  fontSize: 'var(--cds-label-01-font-size, 0.75rem)',
                  fontWeight: 400,
                  color: 'var(--cds-text-secondary, #525252)',
                  marginBottom: 'var(--cds-spacing-03, 0.5rem)',
                }}
              >
                From Date
              </label>
              <input
                id="statement-from"
                type="date"
                value={statementDateFrom}
                onChange={(e) => onDateFromChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: 'var(--cds-spacing-03, 0.5rem) var(--cds-spacing-04, 0.75rem)',
                  border: '1px solid var(--cds-border-subtle, #c6c6c6)',
                  fontSize: 'var(--cds-body-01-font-size, 0.875rem)',
                }}
              />
            </div>
          </Column>
          
          <Column sm={2} md={4} lg={8} style={{ marginBottom: 'var(--cds-spacing-05, 1rem)' }}>
            <div>
              <label
                htmlFor="statement-to"
                style={{
                  display: 'block',
                  fontSize: 'var(--cds-label-01-font-size, 0.75rem)',
                  fontWeight: 400,
                  color: 'var(--cds-text-secondary, #525252)',
                  marginBottom: 'var(--cds-spacing-03, 0.5rem)',
                }}
              >
                To Date
              </label>
              <input
                id="statement-to"
                type="date"
                value={statementDateTo}
                onChange={(e) => onDateToChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: 'var(--cds-spacing-03, 0.5rem) var(--cds-spacing-04, 0.75rem)',
                  border: '1px solid var(--cds-border-subtle, #c6c6c6)',
                  fontSize: 'var(--cds-body-01-font-size, 0.875rem)',
                }}
              />
            </div>
          </Column>
        </Grid>

        <div style={{ display: 'flex', gap: 'var(--cds-spacing-03, 0.5rem)', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button onClick={onGenerate} disabled={!selectedClient}>
            Generate Statement
          </Button>
          <Button kind="ghost" onClick={onClear} disabled={!selectedClient}>
            Clear Selection
          </Button>
        </div>
      </Tile>
    </div>
  );
};
