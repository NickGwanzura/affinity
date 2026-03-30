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

const notImplemented = (feature: string): never => {
  throw new Error(`${feature} not implemented`);
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
    return response.data ?? [];
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
    return response.data ?? [];
  }

  async createInvoice(data: Omit<Invoice, 'id' | 'created_at' | 'invoice_number'>): Promise<Invoice> {
    return api.invoices.create(data);
  }

  async updateInvoice(id: string, updates: Partial<Invoice>): Promise<Invoice> {
    return api.invoices.update(id, updates);
  }

  async deleteInvoice(id: string): Promise<void> {
    return api.invoices.delete(id);
  }

  async getPayments(): Promise<Payment[]> {
    return api.payments.list();
  }

  async getReceipts(): Promise<Receipt[]> {
    return api.receipts.list();
  }

  async addPayment(payment: Omit<Payment, 'id'>): Promise<Payment> {
    return api.payments.create(payment);
  }

  async updatePayment(id: string, updates: Partial<Payment>): Promise<Payment> {
    return api.payments.update(id, updates);
  }

  async deletePayment(id: string): Promise<void> {
    return api.payments.delete(id);
  }

  async createReceipt(data: Omit<Receipt, 'id' | 'created_at' | 'receipt_number'>): Promise<Receipt> {
    return api.receipts.create(data);
  }

  async updateReceipt(id: string, updates: Partial<Receipt>): Promise<Receipt> {
    return api.receipts.update(id, updates);
  }

  async replacePaymentAllocations(
    paymentId: string,
    allocations: Array<{ invoice_id: string; amount_allocated: number; currency: 'USD' | 'GBP' }>,
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

  async createTrip(data: Omit<Trip, 'id' | 'trip_number' | 'created_at' | 'updated_at'>): Promise<Trip> {
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

  async createEmployee(data: Omit<Employee, 'id' | 'employee_number' | 'created_at'>): Promise<Employee> {
    return api.employees.create(data);
  }

  async updateEmployee(id: string, updates: Partial<Employee>): Promise<Employee> {
    return api.employees.update(id, updates);
  }

  async deleteEmployee(id: string): Promise<void> {
    return api.employees.delete(id);
  }

  async getPayslips(filters?: { employeeId?: string; year?: number; month?: number }): Promise<Payslip[]> {
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
    emailOrData: string | { email: string; role: AppUser['role']; name: string; invitedBy?: string },
    role?: AppUser['role'],
    name?: string,
    invitedBy?: string,
  ): Promise<UserInvite> {
    const payload = typeof emailOrData === 'string'
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

  async createRegistrationRequest(data: { name: string; email: string; role: RegistrationRequest['role'] }): Promise<void> {
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

  async getOperatingFundsBalance(): Promise<{ received: number; disbursed: number; balance: number }> {
    const funds = await this.getOperatingFunds();
    const totals = funds.reduce(
      (accumulator, fund) => {
        const rate = this.getCurrencyRate(fund.currency);
        const value = fund.amount * rate;
        if (fund.type === 'Received') accumulator.received += value;
        if (fund.type === 'Disbursed') accumulator.disbursed += value;
        return accumulator;
      },
      { received: 0, disbursed: 0, balance: 0 },
    );

    totals.balance = totals.received - totals.disbursed;
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

    return vehicles.map((vehicle) => {
      const vehicleExpenses = expenses.filter((expense) => expense.vehicle_id === vehicle.id);
      const totalExpensesUsd = vehicleExpenses.reduce(
        (sum, expense) => sum + expense.amount * (expense.exchange_rate_to_usd || this.getCurrencyRate(expense.currency)),
        0,
      );

      return {
        vehicle_id: vehicle.id,
        vin_number: vehicle.vin_number,
        make_model: vehicle.make_model,
        purchase_price_gbp: vehicle.purchase_price_gbp,
        total_expenses_usd: totalExpensesUsd,
        total_landed_cost_usd: totalExpensesUsd + vehicle.purchase_price_gbp * this.getCurrencyRate('GBP'),
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
}

export const dataService = new DataService();

export default dataService;
