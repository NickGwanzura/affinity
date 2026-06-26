/**
 * @deprecated Use `api` from `./apiClient` directly instead.
 *
 * This service is a legacy facade. All new code should call
 * `api.vehicles.list()`, `api.clients.get(id)`, etc. directly.
 * The client-side balance calculation methods are fallbacks
 * — prefer server-side `api.clientFinancials.getBalance(clientId)`.
 */

import { api, setToken } from './apiClient';
import { authService } from './authService';
import type {
  AppUser,
  AuditLog,
  AuthSession,
  Client,
  CompanyDetails,
  Currency,
  Employee,
  Expense,
  Invoice,
  OperatingFund,
  Payslip,
  Payment,
  PaymentAllocation,
  Quote,
  Receipt,
  RegistrationRequest,
  Trip,
  UserInvite,
  Vehicle,
  LandedCostSummary,
} from '../types';

type ExpenseInput = Omit<Expense, 'id' | 'created_at' | 'exchange_rate_to_usd'> & {
  exchange_rate_to_usd?: number;
};

type PaymentAllocationInput = {
  invoice_id?: string;
  amount_allocated: number;
  currency: 'USD' | 'GBP';
  status?: 'allocated' | 'unallocated' | 'credit';
};

type PaymentInput = Omit<
  Payment,
  | 'id'
  | 'created_at'
  | 'updated_at'
  | 'deleted_at'
  | 'created_by'
  | 'updated_by'
  | 'deleted_by'
  | 'is_deleted'
  | 'allocations'
> & {
  allocations?: PaymentAllocationInput[];
};

type PaymentUpdateInput = Partial<PaymentInput>;

const notImplemented = (feature: string): never => {
  throw new Error(`${feature} not implemented`);
};

/** Coerce an unknown value to a finite number, defaulting to 0 for NaN/null/undefined. */
const safeNumeric = (val: unknown): number => {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
};

class DataService {
  async login(email: string, password: string): Promise<AuthSession> {
    return authService.login(email, password);
  }

  async logout(): Promise<void> {
    return authService.logout();
  }

  async getSession(): Promise<AuthSession | null> {
    return authService.getSession();
  }

  async getVehicles(): Promise<Vehicle[]> {
    const response = await api.vehicles.list({ limit: 1000 });
    return response.data ?? [];
  }

  async addVehicle(vehicle: Omit<Vehicle, 'id' | 'created_at'>): Promise<Vehicle> {
    return api.vehicles.create(vehicle);
  }

  async updateVehicle(vehicleId: string, vehicle: Partial<Vehicle>): Promise<Vehicle> {
    return api.vehicles.update(vehicleId, vehicle);
  }

  async deleteVehicle(vehicleId: string): Promise<void> {
    return api.vehicles.delete(vehicleId);
  }

  // Shipments
  async getShipments(): Promise<any[]> {
    const response = await api.shipments.list({ limit: 1000 });
    return response.data ?? [];
  }

  async addShipment(shipment: any): Promise<any> {
    return api.shipments.create(shipment);
  }

  async updateShipment(shipmentId: string, shipment: any): Promise<any> {
    return api.shipments.update(shipmentId, shipment);
  }

  async deleteShipment(shipmentId: string): Promise<void> {
    return api.shipments.delete(shipmentId);
  }

  async getClients(): Promise<Client[]> {
    const response = await api.clients.list({ limit: 1000, sortBy: 'name', sortOrder: 'asc' });
    return response.data ?? [];
  }

  async createClient(clientData: Omit<Client, 'id' | 'created_at'>): Promise<Client> {
    return api.clients.create(clientData);
  }

  async updateClient(clientId: string, updates: Partial<Client>): Promise<Client> {
    return api.clients.update(clientId, updates);
  }

  async deleteClient(clientId: string): Promise<void> {
    return api.clients.delete(clientId);
  }

  async getQuotes(): Promise<Quote[]> {
    const response = await api.quotes.list({ limit: 1000 });
    return (response.data ?? []).map(q => ({ ...q, amount_usd: Number(q.amount_usd) }));
  }

  async createQuote(data: Omit<Quote, 'id' | 'created_at' | 'quote_number'>): Promise<Quote> {
    return api.quotes.create(data);
  }

  async updateQuote(id: string, updates: Partial<Quote>): Promise<Quote> {
    return api.quotes.update(id, updates);
  }

  async deleteQuote(id: string): Promise<void> {
    return api.quotes.delete(id);
  }

  async getInvoices(): Promise<Invoice[]> {
    const response = await api.invoices.list({ limit: 1000 });
    return (response.data ?? []).map(i => ({ ...i, amount_usd: Number(i.amount_usd) }));
  }

  async createInvoice(
    data: Omit<Invoice, 'id' | 'created_at' | 'invoice_number'>
  ): Promise<Invoice> {
    return api.invoices.create(data);
  }

  async updateInvoice(id: string, updates: Partial<Invoice>): Promise<Invoice> {
    return api.invoices.update(id, updates);
  }

  async deleteInvoice(id: string): Promise<void> {
    return api.invoices.delete(id);
  }

  async getPayments(): Promise<Payment[]> {
    const response = await api.payments.list({ limit: 1000 });
    return (response.data ?? []).map(p => ({ ...p, amount_usd: Number(p.amount_usd) }));
  }

  async getReceipts(): Promise<Receipt[]> {
    const response = await api.receipts.list({ limit: 1000 });
    return (response.data ?? []).map(r => ({ ...r, amount_received: Number(r.amount_received) }));
  }

  async addPayment(payment: PaymentInput): Promise<Payment> {
    return api.payments.create(payment);
  }

  async updatePayment(id: string, updates: PaymentUpdateInput): Promise<Payment> {
    return api.payments.update(id, updates);
  }

  async deletePayment(id: string): Promise<void> {
    return api.payments.delete(id);
  }

  async createReceipt(
    data: Omit<Receipt, 'id' | 'created_at' | 'receipt_number'>
  ): Promise<Receipt> {
    return api.receipts.create(data);
  }

  async updateReceipt(id: string, updates: Partial<Receipt>): Promise<Receipt> {
    return api.receipts.update(id, updates);
  }

  async deleteReceipt(id: string): Promise<void> {
    return api.receipts.delete(id);
  }

  async replacePaymentAllocations(
    paymentId: string,
    allocations: Array<{
      invoice_id?: string;
      amount_allocated: number;
      currency: 'USD' | 'GBP';
      status?: string;
    }>
  ): Promise<void> {
    await api.payments.replaceAllocations(paymentId, allocations);
  }

  async getExpenses(): Promise<Expense[]> {
    const response = await api.expenses.list({ limit: 1000 });
    return response.data ?? [];
  }

  async getExpensesByDriver(driverName: string): Promise<Expense[]> {
    const response = await api.expenses.list({ limit: 1000, driverName });
    return response.data ?? [];
  }

  async addExpense(expense: ExpenseInput): Promise<Expense> {
    return api.expenses.create(expense);
  }

  async getTrips(filters?: {
    status?: string;
    assignedDriverId?: string;
    assignedVehicleId?: string;
    dateFrom?: string;
    dateTo?: string;
    upcomingOnly?: boolean;
  }): Promise<Trip[]> {
    const response = await api.trips.list({ limit: 1000, ...filters });
    return response.data ?? [];
  }

  async createTrip(
    data: Omit<Trip, 'id' | 'trip_number' | 'created_at' | 'updated_at'>
  ): Promise<Trip> {
    return api.trips.create(data);
  }

  async updateTrip(id: string, updates: Partial<Trip>): Promise<Trip> {
    return api.trips.update(id, updates);
  }

  async deleteTrip(id: string): Promise<void> {
    return api.trips.delete(id);
  }

  async updateExpense(expenseId: string, updates: Partial<Expense>): Promise<Expense> {
    return api.expenses.update(expenseId, updates);
  }

  async deleteExpense(expenseId: string): Promise<void> {
    return api.expenses.delete(expenseId);
  }

  async getCompanyDetails(): Promise<CompanyDetails | null> {
    return api.company.get();
  }

  async updateCompanyDetails(details: CompanyDetails): Promise<void> {
    return api.company.update(details);
  }

  async getUsers(): Promise<AppUser[]> {
    return api.users.list();
  }

  async createUser(userData: Omit<AppUser, 'id'> & { password?: string }): Promise<AppUser> {
    if (!userData.password) {
      return notImplemented('User provisioning');
    }
    return api.users.create(userData);
  }

  async deleteUser(userId: string): Promise<void> {
    return api.users.delete(userId);
  }

  async updateUser(userId: string, updates: Partial<AppUser>): Promise<AppUser> {
    return api.users.update(userId, updates);
  }

  async syncCurrentUser(): Promise<AppUser | null> {
    const session = await this.getSession();
    return session?.user ?? null;
  }

  async getEmployees(): Promise<Employee[]> {
    return api.employees.list();
  }

  async createEmployee(
    data: Omit<Employee, 'id' | 'employee_number' | 'created_at'>
  ): Promise<Employee> {
    return api.employees.create(data);
  }

  async updateEmployee(id: string, updates: Partial<Employee>): Promise<Employee> {
    return api.employees.update(id, updates);
  }

  async deleteEmployee(id: string): Promise<void> {
    return api.employees.delete(id);
  }

  async getPayslips(filters?: {
    employeeId?: string;
    year?: number;
    month?: number;
  }): Promise<Payslip[]> {
    return api.payslips.list(filters);
  }

  async generatePayslip(data: unknown): Promise<Payslip> {
    return api.payslips.create(data);
  }

  async updatePayslipStatus(id: string, status: Payslip['status']): Promise<void> {
    await api.payslips.updateStatus(id, status);
  }

  async deletePayslip(id: string): Promise<void> {
    return api.payslips.delete(id);
  }

  async getInvites(): Promise<UserInvite[]> {
    return api.invites.list();
  }

  async createInvite(
    emailOrData:
      | string
      | { email: string; role: AppUser['role']; name: string; invitedBy?: string },
    role?: AppUser['role'],
    name?: string,
    invitedBy?: string
  ): Promise<UserInvite> {
    const payload =
      typeof emailOrData === 'string'
        ? { email: emailOrData, role: role!, name: name!, invitedBy }
        : emailOrData;
    return api.invites.create(payload);
  }

  async getInviteByToken(token: string): Promise<UserInvite | null> {
    return api.invites.verify(token);
  }

  async acceptInvite(token: string, password: string): Promise<AuthSession> {
    const session = await api.invites.accept(token, password);
    setToken(session.token);
    return {
      user: session.user as AppUser,
      token: session.token,
    };
  }

  async deleteInvite(inviteId: string): Promise<void> {
    return api.invites.delete(inviteId);
  }

  async resendInvite(inviteId: string): Promise<UserInvite> {
    return api.invites.resend(inviteId);
  }

  async getRegistrationRequests(): Promise<RegistrationRequest[]> {
    return api.registrationRequests.list();
  }

  async createRegistrationRequest(data: {
    name: string;
    email: string;
    role: RegistrationRequest['role'];
  }): Promise<void> {
    await api.registrationRequests.create(data);
  }

  async approveRegistrationRequest(requestId: string, _adminId: string): Promise<void> {
    await api.registrationRequests.approve(requestId);
  }

  async rejectRegistrationRequest(requestId: string, _adminId: string): Promise<void> {
    await api.registrationRequests.reject(requestId);
  }

  async resetUserPassword(userEmail: string): Promise<void> {
    return authService.resetPassword(userEmail);
  }

  async getOperatingFunds(): Promise<OperatingFund[]> {
    return api.operatingFunds.list();
  }

  async getAuditLogs(limit: number = 150): Promise<AuditLog[]> {
    return api.auditLogs.list({ limit });
  }

  async getOperatingFundsByRecipient(recipient: string): Promise<OperatingFund[]> {
    return api.operatingFunds.list({ recipient });
  }

  async getOperatingFundsBalance(): Promise<{
    received: number;
    disbursed: number;
    balance: number;
  }> {
    const funds = await this.getOperatingFunds();
    const totals = funds.reduce(
      (accumulator, fund) => {
        const rate = this.getCurrencyRate(fund.currency);
        const value = safeNumeric(fund.amount) * rate;
        if (fund.type === 'Received') accumulator.received += value;
        if (fund.type === 'Disbursed') accumulator.disbursed += value;
        return accumulator;
      },
      { received: 0, disbursed: 0, balance: 0 }
    );

    totals.received = Math.round(totals.received * 100) / 100;
    totals.disbursed = Math.round(totals.disbursed * 100) / 100;
    totals.balance = Math.round((totals.received - totals.disbursed) * 100) / 100;
    return totals;
  }

  async addOperatingFund(fund: Omit<OperatingFund, 'id' | 'created_at'>): Promise<OperatingFund> {
    return api.operatingFunds.create(fund);
  }

  async deleteOperatingFund(id: string): Promise<void> {
    return api.operatingFunds.delete(id);
  }

  async getLandedCostSummaries(): Promise<LandedCostSummary[]> {
    const [vehicles, expenses] = await Promise.all([this.getVehicles(), this.getExpenses()]);

    return vehicles.map(vehicle => {
      const vehicleExpenses = expenses.filter(expense => expense.vehicle_id === vehicle.id);
      const totalExpensesUsd = vehicleExpenses.reduce(
        (sum, expense) =>
          sum +
          safeNumeric(expense.amount) *
            (safeNumeric(expense.exchange_rate_to_usd) || this.getCurrencyRate(expense.currency)),
        0
      );

      return {
        vehicle_id: vehicle.id,
        vin_number: vehicle.vin_number,
        make_model: vehicle.make_model,
        purchase_price_gbp: safeNumeric(vehicle.purchase_price_gbp),
        total_expenses_usd: Math.round(totalExpensesUsd * 100) / 100,
        total_landed_cost_usd: Math.round(
          (totalExpensesUsd + safeNumeric(vehicle.purchase_price_gbp) * this.getCurrencyRate('GBP')) * 100
        ) / 100,
        status: vehicle.status,
      };
    });
  }

  private getCurrencyRate(currency: Currency): number {
    switch (currency) {
      case 'GBP':
        return 1.25;
      case 'NAD':
      case 'ZAR':
        return 0.055;
      case 'BWP':
        return 0.073;
      case 'USD':
      default:
        return 1;
    }
  }

  // ===========================================================================
  // CLIENT FINANCIALS - Unified Balance & Ledger System
  // Single source of truth for all client balance calculations
  // ===========================================================================

  /**
   * Get unified balance for a client using the formula:
   * current_balance = opening_balance + total_invoiced - total_paid
   */
  async getClientBalance(clientId: string): Promise<{
    client: Client;
    balance: {
      current_balance: number;
      total_invoiced: number;
      total_paid: number;
      opening_balance: number;
      currency: 'USD' | 'GBP';
      credit_balance: number;
    };
    formula_applied: string;
  }> {
    return api.clientFinancials.getBalance(clientId);
  }

  /**
   * Get the ledger (transaction history) for a client with running balance
   */
  async getClientLedger(
    clientId: string,
    params?: { from?: string; to?: string }
  ): Promise<{
    client: Client;
    date_range: { from: string | null; to: string | null };
    entries: Array<{
      date: string;
      type: 'opening_balance' | 'invoice' | 'payment' | 'adjustment';
      reference: string;
      document_id?: string;
      debit: number;
      credit: number;
      currency: 'USD' | 'GBP';
      balance: number;
    }>;
    summary: {
      total_debits: number;
      total_credits: number;
      opening_balance: number;
      closing_balance: number;
    };
  }> {
    return api.clientFinancials.getLedger(clientId, params);
  }

  /**
   * Get balances for all clients, optionally filtered
   */
  async getAllClientBalances(params?: {
    hasOutstanding?: boolean;
    minBalance?: number;
    search?: string;
  }): Promise<{
    count: number;
    clients: Array<{
      id: string;
      name: string;
      email: string;
      company: string;
      balance: {
        opening_balance: number;
        total_invoiced: number;
        total_paid: number;
        current_balance: number;
        credit_balance: number;
        currency: 'USD' | 'GBP';
        usd_balance: number;
        gbp_balance: number;
      };
      is_active: boolean;
      created_at: string;
    }>;
  }> {
    return api.clientFinancials.getAllBalances(params);
  }

  /**
   * Force recalculation of a client's balance (admin only)
   */
  async recalculateClientBalance(clientId: string): Promise<{
    message: string;
    client_id: string;
    balance: any;
    formula_applied: string;
    timestamp: string;
  }> {
    return api.clientFinancials.recalculateBalance(clientId);
  }

  /**
   * Calculate client balance locally (for when API is unavailable).
   *
   * Matching: prefer `client_id` when both sides have it; fall back to
   * lowercase name only for legacy rows without `client_id`.
   *
   * Currency: USD and GBP are computed independently. A client with a
   * GBP opening balance no longer has that number silently summed into
   * a "USD" total. Callers that need a single scalar can combine
   * `usd_balance` and `gbp_balance` with an explicit FX rate.
   */
  calculateClientBalance(
    client: Client,
    invoices: Invoice[],
    payments: Payment[]
  ): {
    current_balance: number;
    total_invoiced: number;
    total_paid: number;
    opening_balance: number;
    credit_balance: number;
    usd_balance: number;
    gbp_balance: number;
  } {
    const openingBalance = client.opening_balance || 0;
    const openingCurrency: 'USD' | 'GBP' = client.opening_balance_currency || 'USD';

    const matches = (row: { client_id?: string | null; client_name?: string | null }) => {
      if (row.client_id && client.id) return row.client_id === client.id;
      return (row.client_name || '').trim().toLowerCase() ===
        (client.name || '').trim().toLowerCase();
    };

    const clientInvoices = invoices.filter(
      inv => matches(inv) && inv.status !== 'Cancelled'
    );
    const clientPayments = payments.filter(
      pay => matches(pay) && pay.type === 'Inbound' && !pay.is_deleted
    );

    // Per-currency totals: USD and GBP never mix.
    let usdInvoiced = 0;
    let gbpInvoiced = 0;
    clientInvoices.forEach(inv => {
      const amount = safeNumeric(inv.amount_usd);
      if ((inv.currency || 'USD') === 'GBP') gbpInvoiced += amount;
      else usdInvoiced += amount;
    });

    let usdPaid = 0;
    let gbpPaid = 0;
    clientPayments.forEach(pay => {
      const amount = safeNumeric(pay.amount_usd);
      if ((pay.currency || 'USD') === 'GBP') gbpPaid += amount;
      else usdPaid += amount;
    });

    // Opening balance is currency-scoped: a GBP opening belongs to the GBP
    // ledger, NOT the USD one. This was the real-money bug.
    const usdOpening = openingCurrency === 'USD' ? openingBalance : 0;
    const gbpOpening = openingCurrency === 'GBP' ? openingBalance : 0;

    const usdBalance = usdOpening + usdInvoiced - usdPaid;
    const gbpBalance = gbpOpening + gbpInvoiced - gbpPaid;

    // Legacy aggregate (kept for callers that still want a single scalar).
    // We keep the old "single currency" shape semantically — total_invoiced
    // and total_paid sum both currencies' amount_usd because that's what
    // the pre-existing callers (FinancialsShell, etc.) rely on — but the
    // real per-currency numbers are in usd_balance / gbp_balance.
    const totalInvoiced = usdInvoiced + gbpInvoiced;
    const totalPaid = usdPaid + gbpPaid;
    const rawBalance = openingBalance + totalInvoiced - totalPaid;

    let currentBalance = rawBalance;
    let creditBalance = 0;
    if (rawBalance < 0) {
      creditBalance = Math.abs(rawBalance);
      currentBalance = 0;
    }

    return {
      current_balance: currentBalance,
      total_invoiced: totalInvoiced,
      total_paid: totalPaid,
      opening_balance: openingBalance,
      credit_balance: creditBalance,
      usd_balance: usdBalance,
      gbp_balance: gbpBalance,
    };
  }

  /**
   * Generate ledger entries locally
   */
  generateClientLedger(
    client: Client,
    invoices: Invoice[],
    payments: Payment[]
  ): Array<{
    date: string;
    type: 'opening_balance' | 'invoice' | 'payment' | 'adjustment';
    reference: string;
    document_id?: string;
    debit: number;
    credit: number;
    currency: 'USD' | 'GBP';
    balance: number;
  }> {
    const entries: Array<{
      date: string;
      type: 'opening_balance' | 'invoice' | 'payment' | 'adjustment';
      reference: string;
      document_id?: string;
      debit: number;
      credit: number;
      currency: 'USD' | 'GBP';
    }> = [];

    const currency = client.opening_balance_currency || 'USD';

    const matches = (row: { client_id?: string | null; client_name?: string | null }) => {
      if (row.client_id && client.id) return row.client_id === client.id;
      return (row.client_name || '').trim().toLowerCase() ===
        (client.name || '').trim().toLowerCase();
    };

    // Opening balance entry
    if (client.opening_balance && client.opening_balance !== 0) {
      entries.push({
        date: client.created_at,
        type: 'opening_balance',
        reference: 'Opening Balance',
        debit: client.opening_balance > 0 ? client.opening_balance : 0,
        credit: client.opening_balance < 0 ? Math.abs(client.opening_balance) : 0,
        currency,
      });
    }

    // Invoice entries
    invoices
      .filter(inv => matches(inv) && inv.status !== 'Cancelled')
      .forEach(inv => {
        entries.push({
          date: inv.created_at,
          type: 'invoice',
          reference: inv.invoice_number,
          document_id: inv.id,
          debit: Number(inv.amount_usd) || 0,
          credit: 0,
          currency: inv.currency || currency,
        });
      });

    // Payment entries
    payments
      .filter(pay => matches(pay) && pay.type === 'Inbound' && !pay.is_deleted)
      .forEach(pay => {
        entries.push({
          date: pay.date,
          type: 'payment',
          reference: pay.reference_id || 'Payment',
          document_id: pay.id,
          debit: 0,
          credit: Number(pay.amount_usd) || 0,
          currency: pay.currency || currency,
        });
      });

    // Sort by date
    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate running balance
    let runningBalance = 0;
    return entries.map(entry => {
      runningBalance += entry.debit - entry.credit;
      return {
        ...entry,
        balance: runningBalance,
      };
    });
  }
}

export const dataService = new DataService();

export default dataService;
