import type { Client, Invoice, Payment, Quote, CompanyDetails } from '../../types';
import { dataService } from '../../services/dataService';
import { generateStatementPDF } from '../../services/pdfService';
import type { ClientStats, EnrichedClient, LedgerRow } from './types';

/**
 * Approximate GBP->USD rate used ONLY for sort ordering and the sidebar
 * "quick scan" combined total. This is not for financial reporting —
 * ledger, PDF, and detail-header math always keeps USD and GBP split.
 */
export const GBP_USD_APPROX = 1.27;

export const sameName = (a?: string, b?: string): boolean =>
  (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

/**
 * True when `record` belongs to `client`. Prefers id-based matching
 * (correct even when names get retyped / duplicated) and falls back to
 * case-insensitive name matching only for legacy rows whose client_id
 * was never populated.
 */
export const matchesClient = (
  record: { client_id?: string | null; client_name?: string | null },
  client: Pick<Client, 'id' | 'name'>
): boolean => {
  const rid = record.client_id;
  if (rid && client.id) {
    // Both sides have an id — only the id decides. Prevents a same-named
    // second client from being credited with another client's invoices.
    return rid === client.id;
  }
  // Legacy row with no client_id → fall back to name.
  return sameName(record.client_name ?? undefined, client.name);
};

export function buildEnrichedClients(clients: Client[], invoices: Invoice[]): EnrichedClient[] {
  const map = new Map<string, EnrichedClient>();
  // Seed with registered clients keyed by id so duplicate names stay distinct.
  clients.forEach((c) => {
    map.set(`id:${c.id}`, { ...c, isRegistered: true });
  });
  // Fold in unregistered clients (invoices whose client_id does not resolve
  // to a registered client). These are name-only by definition.
  const registeredById = new Map(clients.map((c) => [c.id, c]));
  const unregisteredByName = new Map<string, EnrichedClient>();
  invoices.forEach((inv) => {
    if (inv.client_id && registeredById.has(inv.client_id)) return;
    const nameKey = (inv.client_name || '').trim().toLowerCase();
    if (!nameKey) return;
    // If a registered client already matches this name, don't fabricate a ghost.
    const nameMatchesRegistered = clients.some((c) => sameName(c.name, inv.client_name));
    if (nameMatchesRegistered) return;
    if (unregisteredByName.has(nameKey)) return;
    unregisteredByName.set(nameKey, {
      id: `inv-${nameKey}`,
      name: inv.client_name,
      email: inv.client_email || '',
      address: inv.client_address,
      opening_balance: 0,
      opening_balance_currency: 'USD',
      is_active: true,
      created_at: new Date().toISOString(),
      isRegistered: false,
    } as EnrichedClient);
  });
  unregisteredByName.forEach((v, k) => map.set(`name:${k}`, v));
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

  if (match && match.isRegistered) {
    const client = match as Client;
    const clientInvoices = invoices.filter((i) => matchesClient(i, client));
    const clientQuotes = quotes.filter((q) => matchesClient(q, client));
    const clientPayments = payments.filter((p) => matchesClient(p, client));
    const balance = dataService.calculateClientBalance(client, invoices, payments);
    return {
      totalBilled: balance.total_invoiced,
      totalPaid: balance.total_paid,
      openingBalance: balance.opening_balance,
      outstanding: balance.current_balance,
      creditBalance: balance.credit_balance,
      invoiceCount: clientInvoices.length,
      quoteCount: clientQuotes.length,
      paymentCount: clientPayments.length,
      usdBalance: balance.usd_balance,
      gbpBalance: balance.gbp_balance,
    };
  }

  // Unregistered client — name-only matching is correct here by definition.
  const clientInvoices = invoices.filter((i) => sameName(i.client_name, name));
  const clientQuotes = quotes.filter((q) => sameName(q.client_name, name));
  const clientPayments = payments.filter((p) => sameName(p.client_name, name));
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
    usdBalance: outstanding,
    gbpBalance: 0,
  };
}

export function buildClientLedger(
  client: EnrichedClient,
  invoices: Invoice[],
  payments: Payment[]
): LedgerRow[] {
  const entries: LedgerRow[] = [];
  const opening = Number(client.opening_balance) || 0;
  const openingCurrency: 'USD' | 'GBP' = client.opening_balance_currency || 'USD';
  if (opening !== 0) {
    entries.push({
      date: new Date(client.created_at),
      type: 'opening',
      reference: 'Opening Balance',
      debit: opening > 0 ? opening : 0,
      credit: opening < 0 ? Math.abs(opening) : 0,
      balance: 0,
      currency: openingCurrency,
    });
  }
  invoices
    .filter(
      (i) =>
        matchesClient(i, client) &&
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
        currency: (i.currency || 'USD') as 'USD' | 'GBP',
      })
    );
  payments
    .filter(
      (p) =>
        matchesClient(p, client) &&
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
        currency: (p.currency || 'USD') as 'USD' | 'GBP',
      })
    );
  entries.sort((a, b) => a.date.getTime() - b.date.getTime());
  // Running balance is currency-aware: each row's `balance` reflects the
  // running total for its own currency, so USD and GBP ledgers can be
  // separated cleanly downstream.
  const running: Record<'USD' | 'GBP', number> = { USD: 0, GBP: 0 };
  return entries.map((e) => {
    const cur = e.currency || 'USD';
    running[cur] += e.debit - e.credit;
    return { ...e, balance: running[cur] };
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
  const clientInvoices = invoices.filter((i) => matchesClient(i, client));
  const clientPayments = payments.filter((p) => matchesClient(p, client));
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
