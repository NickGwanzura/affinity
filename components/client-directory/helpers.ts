import type { Client, Invoice, Payment, Quote, CompanyDetails } from '../../types';
import { dataService } from '../../services/dataService';
import { generateStatementPDF } from '../../services/pdfService';
import type { ClientStats, EnrichedClient, LedgerRow } from './types';

export const sameName = (a?: string, b?: string): boolean =>
  (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

export function buildEnrichedClients(clients: Client[], invoices: Invoice[]): EnrichedClient[] {
  const map = new Map<string, EnrichedClient>();
  clients.forEach((c) => {
    map.set(c.name.trim().toLowerCase(), { ...c, isRegistered: true });
  });
  invoices.forEach((inv) => {
    const key = inv.client_name.trim().toLowerCase();
    if (!map.has(key)) {
      map.set(key, {
        id: `inv-${key}`,
        name: inv.client_name,
        email: inv.client_email || '',
        address: inv.client_address,
        opening_balance: 0,
        opening_balance_currency: 'USD',
        is_active: true,
        created_at: new Date().toISOString(),
        isRegistered: false,
      } as EnrichedClient);
    }
  });
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function computeClientStats(
  name: string,
  enrichedClients: EnrichedClient[],
  invoices: Invoice[],
  quotes: Quote[],
  payments: Payment[]
): ClientStats {
  const match = enrichedClients.find((c) => sameName(c.name, name));
  const clientInvoices = invoices.filter((i) => sameName(i.client_name, name));
  const clientQuotes = quotes.filter((q) => sameName(q.client_name, name));
  const clientPayments = payments.filter((p) => sameName(p.client_name, name));

  if (match && match.isRegistered) {
    const balance = dataService.calculateClientBalance(match, invoices, payments);
    return {
      totalBilled: balance.total_invoiced,
      totalPaid: balance.total_paid,
      openingBalance: balance.opening_balance,
      outstanding: balance.current_balance,
      creditBalance: balance.credit_balance,
      invoiceCount: clientInvoices.length,
      quoteCount: clientQuotes.length,
      paymentCount: clientPayments.length,
    };
  }
  const totalBilled = clientInvoices.reduce((s, i) => s + (Number(i.amount_usd) || 0), 0);
  const totalPaid = clientPayments.reduce((s, p) => s + (Number(p.amount_usd) || 0), 0);
  const outstanding = totalBilled - totalPaid;
  return {
    totalBilled,
    totalPaid,
    openingBalance: 0,
    outstanding: outstanding > 0 ? outstanding : 0,
    creditBalance: outstanding < 0 ? Math.abs(outstanding) : 0,
    invoiceCount: clientInvoices.length,
    quoteCount: clientQuotes.length,
    paymentCount: clientPayments.length,
  };
}

export function buildClientLedger(
  client: EnrichedClient,
  invoices: Invoice[],
  payments: Payment[]
): LedgerRow[] {
  const entries: LedgerRow[] = [];
  const opening = Number(client.opening_balance) || 0;
  if (opening !== 0) {
    entries.push({
      date: new Date(client.created_at),
      type: 'opening',
      reference: 'Opening Balance',
      debit: opening > 0 ? opening : 0,
      credit: opening < 0 ? Math.abs(opening) : 0,
      balance: 0,
    });
  }
  invoices
    .filter(
      (i) =>
        sameName(i.client_name, client.name) &&
        i.status !== 'Cancelled' &&
        !(i as unknown as { is_deleted?: boolean; deleted_at?: string | null }).is_deleted &&
        !(i as unknown as { is_deleted?: boolean; deleted_at?: string | null }).deleted_at
    )
    .forEach((i) =>
      entries.push({
        date: new Date(i.created_at),
        type: 'invoice',
        reference: i.invoice_number,
        debit: Number(i.amount_usd) || 0,
        credit: 0,
        balance: 0,
        id: i.id,
      })
    );
  payments
    .filter(
      (p) =>
        sameName(p.client_name, client.name) &&
        !p.is_deleted &&
        !p.deleted_at
    )
    .forEach((p) =>
      entries.push({
        date: new Date(p.date),
        type: 'payment',
        reference: p.reference_id || 'Payment',
        debit: 0,
        credit: Number(p.amount_usd) || 0,
        balance: 0,
        id: p.id,
      })
    );
  entries.sort((a, b) => a.date.getTime() - b.date.getTime());
  let running = 0;
  return entries.map((e) => {
    running += e.debit - e.credit;
    return { ...e, balance: running };
  });
}

export async function downloadClientStatementPdf(
  client: EnrichedClient,
  invoices: Invoice[],
  payments: Payment[],
  company: CompanyDetails,
  dateFrom: string,
  dateTo: string
): Promise<void> {
  const clientInvoices = invoices.filter((i) => sameName(i.client_name, client.name));
  const clientPayments = payments.filter((p) => sameName(p.client_name, client.name));
  const inRange = (iso: string) => {
    if (!dateFrom && !dateTo) return true;
    const d = new Date(iso).toISOString().split('T')[0];
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  };
  const filteredInvoices = clientInvoices.filter((inv) => inRange(inv.created_at));
  const filteredPayments = clientPayments.filter((pay) => inRange(pay.date));
  const paymentCurrencyMap: Record<string, 'USD' | 'GBP'> = {};
  filteredPayments.forEach((p) => {
    if (p.id && p.currency) paymentCurrencyMap[p.id] = p.currency;
  });
  const blob = await generateStatementPDF(
    {
      client_name: client.name,
      client_email: client.email,
      client_address: client.address,
      invoices: filteredInvoices,
      payments: filteredPayments,
      paymentCurrencyMap,
      startDate:
        dateFrom ||
        filteredInvoices[0]?.created_at ||
        filteredPayments[0]?.date ||
        new Date().toISOString(),
      endDate: dateTo || new Date().toISOString(),
    },
    company
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Statement_${client.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
