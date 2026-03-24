/**
 * Data Service — thin facade over databaseService + authService.
 *
 * Previously a 1,826-line wrapper with no-op logging and redundant try/catch.
 * Now a minimal object that calls the real implementations directly.
 *
 * All components import { supabase } from this file — the name is kept
 * intentionally so no component imports need to change.
 */

import * as db from './databaseService';
import { authService } from './authService';
import { isNeonConnected } from './neonClient';
import { EXCHANGE_RATES } from '../constants';
import {
  Vehicle, Expense, LandedCostSummary, CompanyDetails, AppUser,
  Quote, Invoice, Payment, PaymentAllocation, Receipt,
  AuthSession, SupabaseConfig, UserInvite, UserRole, Client,
  RegistrationRequest, Employee, Payslip, OperatingFund,
} from '../types';

// ─── Facade ──────────────────────────────────────────────────────────────────

class DataService {
  private config: SupabaseConfig = {
    url: import.meta.env.VITE_SUPABASE_URL || '',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    isConnected: isNeonConnected(),
  };

  // ── Auth ────────────────────────────────────────────────────────────────────

  async signUp(email: string, password: string, metadata?: { name: string; role: string }) {
    return authService.createUser({
      email: email.toLowerCase().trim(),
      password,
      name: metadata?.name || email.split('@')[0],
      role: (metadata?.role as UserRole) || 'Driver',
    });
  }

  login(email: string, password: string): Promise<AuthSession> {
    return authService.login(email, password);
  }

  logout(): Promise<void> {
    return authService.logout();
  }

  getSession(): Promise<AuthSession | null> {
    return authService.getSession();
  }

  async syncCurrentUser(): Promise<AppUser | null> {
    const session = await authService.getSession();
    return session?.user ?? null;
  }

  resetPassword(email: string): Promise<void> {
    return authService.resetPassword(email);
  }

  async updatePassword(newPassword: string): Promise<void> {
    const token = localStorage.getItem('pending_reset_token');
    if (!token) throw new Error('No pending password reset. Please request a reset first.');
    return authService.updatePassword(token, newPassword);
  }

  changePassword(userId: string, current: string, next: string): Promise<void> {
    return authService.changePassword(userId, current, next);
  }

  // ── Registration requests ────────────────────────────────────────────────

  createRegistrationRequest(data: { name: string; email: string; role: UserRole }): Promise<void> {
    return db.createRegistrationRequest(data);
  }

  getRegistrationRequests(): Promise<RegistrationRequest[]> {
    return db.getRegistrationRequests();
  }

  async approveRegistrationRequest(requestId: string, adminId: string): Promise<void> {
    const request = await db.getRegistrationRequestById(requestId);
    if (!request) throw new Error('Registration request not found');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await db.createInvite({
      email: request.email,
      role: request.role,
      name: request.name,
      invitedBy: adminId,
      inviteToken: crypto.randomUUID(),
      expiresAt: expiresAt.toISOString(),
    });

    await db.updateRegistrationRequestStatus(requestId, 'Approved', adminId);
  }

  rejectRegistrationRequest(requestId: string, adminId: string): Promise<void> {
    return db.updateRegistrationRequestStatus(requestId, 'Rejected', adminId);
  }

  // ── Vehicles ─────────────────────────────────────────────────────────────

  getVehicles(): Promise<Vehicle[]> {
    return db.getVehicles();
  }

  addVehicle(vehicle: Omit<Vehicle, 'id' | 'created_at'>): Promise<Vehicle> {
    return db.addVehicle(vehicle);
  }

  updateVehicle(vehicleId: string, vehicle: Partial<Omit<Vehicle, 'id' | 'created_at'>>): Promise<Vehicle> {
    return db.updateVehicle(vehicleId, vehicle);
  }

  deleteVehicle(vehicleId: string): Promise<void> {
    return db.deleteVehicle(vehicleId);
  }

  // ── Expenses ──────────────────────────────────────────────────────────────

  getExpenses(): Promise<Expense[]> {
    return db.getExpenses();
  }

  getExpensesByVehicle(vehicleId: string): Promise<Expense[]> {
    return db.getExpensesByVehicle(vehicleId);
  }

  getExpensesByDriver(driverName: string): Promise<Expense[]> {
    return db.getExpensesByDriver(driverName);
  }

  addExpense(expense: Omit<Expense, 'id' | 'created_at' | 'exchange_rate_to_usd'>): Promise<Expense> {
    return db.addExpense(expense);
  }

  updateExpense(expenseId: string, updates: Partial<Omit<Expense, 'id' | 'created_at' | 'exchange_rate_to_usd'>>): Promise<Expense> {
    return db.updateExpense(expenseId, updates);
  }

  deleteExpense(expenseId: string): Promise<void> {
    return db.deleteExpense(expenseId);
  }

  // ── Landed cost summaries (computed client-side) ─────────────────────────

  async getLandedCostSummaries(): Promise<LandedCostSummary[]> {
    const [vehicles, expenses] = await Promise.all([db.getVehicles(), db.getExpenses()]);
    return vehicles.map(v => {
      const vehicleExpenses = expenses.filter(e => e.vehicle_id === v.id);
      const expensesUsd = vehicleExpenses.reduce(
        (sum, e) => sum + (e.amount || 0) * (e.exchange_rate_to_usd || 1),
        0,
      );
      const purchaseUsd = v.purchase_price_gbp * EXCHANGE_RATES['GBP'];
      return {
        vehicle_id: v.id,
        vin_number: v.vin_number,
        make_model: v.make_model,
        purchase_price_gbp: v.purchase_price_gbp,
        total_expenses_usd: expensesUsd,
        total_landed_cost_usd: purchaseUsd + expensesUsd,
        status: v.status,
      };
    });
  }

  // ── Quotes ────────────────────────────────────────────────────────────────

  getQuotes(): Promise<Quote[]> { return db.getQuotes(); }
  createQuote(data: Omit<Quote, 'id' | 'created_at' | 'quote_number'>): Promise<Quote> { return db.createQuote(data); }
  updateQuote(id: string, updates: Partial<Omit<Quote, 'id' | 'created_at' | 'quote_number'>>): Promise<Quote> { return db.updateQuote(id, updates); }
  deleteQuote(id: string): Promise<void> { return db.deleteQuote(id); }
  updateQuoteStatus(id: string, status: string): Promise<Quote> { return db.updateQuoteStatus(id, status); }

  // ── Invoices ──────────────────────────────────────────────────────────────

  getInvoices(): Promise<Invoice[]> { return db.getInvoices(); }
  createInvoice(data: Omit<Invoice, 'id' | 'created_at' | 'invoice_number'>): Promise<Invoice> { return db.createInvoice(data); }
  updateInvoice(id: string, updates: Partial<Omit<Invoice, 'id' | 'created_at' | 'invoice_number'>>): Promise<Invoice> { return db.updateInvoice(id, updates); }
  deleteInvoice(id: string): Promise<void> { return db.deleteInvoice(id); }
  updateInvoiceStatus(id: string, status: Parameters<typeof db.updateInvoiceStatus>[1]): Promise<Invoice> { return db.updateInvoiceStatus(id, status); }

  // ── Payments & Receipts ───────────────────────────────────────────────────

  getPayments(): Promise<Payment[]> { return db.getPayments(); }
  getPaymentAllocations(): Promise<PaymentAllocation[]> { return db.getPaymentAllocations(); }
  createPayment(data: Parameters<typeof db.createPayment>[0]): Promise<Payment> { return db.createPayment(data); }
  addPayment(payment: Omit<Payment, 'id'>): Promise<Payment> { return db.addPayment(payment); }
  updatePayment(id: string, updates: Partial<Omit<Payment, 'id'>>): Promise<Payment> { return db.updatePayment(id, updates); }
  deletePayment(id: string): Promise<void> { return db.deletePayment(id); }
  replacePaymentAllocations(paymentId: string, allocations: Parameters<typeof db.replacePaymentAllocations>[1]): Promise<void> {
    return db.replacePaymentAllocations(paymentId, allocations);
  }

  getReceipts(): Promise<Receipt[]> { return db.getReceipts(); }
  createReceipt(data: Omit<Receipt, 'id' | 'created_at' | 'receipt_number'>): Promise<Receipt> { return db.createReceipt(data); }
  updateReceipt(id: string, updates: Parameters<typeof db.updateReceipt>[1]): Promise<Receipt> { return db.updateReceipt(id, updates); }

  // ── Company ───────────────────────────────────────────────────────────────

  getCompanyDetails(): Promise<CompanyDetails | null> { return db.getCompanyDetails(); }
  updateCompanyDetails(details: CompanyDetails): Promise<void> { return db.updateCompanyDetails(details); }

  // ── Users ─────────────────────────────────────────────────────────────────

  getUsers(): Promise<AppUser[]> { return db.getUserProfiles(); }

  async createUser(userData: Omit<AppUser, 'id'>): Promise<AppUser> {
    // Upsert: if email already exists update profile, otherwise create new auth user
    const existing = await db.getUserProfileByEmail(userData.email);
    if (existing) {
      return db.updateUserProfile(existing.id, {
        name: userData.name,
        role: userData.role,
        status: userData.status || 'Active',
      });
    }
    const tempPassword = Math.random().toString(36).slice(-12) + 'Aa1!';
    return authService.createUser({
      email: userData.email.toLowerCase().trim(),
      password: tempPassword,
      name: userData.name,
      role: userData.role,
    });
  }

  async deleteUser(userId: string): Promise<void> {
    const user = await db.getUserProfileById(userId);
    if (!user) throw new Error('User not found');
    if (user.role === 'Admin') {
      const adminCount = await db.countAdminUsers();
      if (adminCount === 1) throw new Error('Cannot delete the last admin user');
    }
    return db.deleteUserProfile(userId);
  }

  async updateUser(userId: string, updates: Partial<Omit<AppUser, 'id'>>): Promise<AppUser> {
    if (updates.role) {
      const current = await db.getUserProfileById(userId);
      if (current?.role === 'Admin' && updates.role !== 'Admin') {
        const adminCount = await db.countAdminUsers();
        if (adminCount === 1) throw new Error('Cannot change role of the last admin');
      }
    }
    return db.updateUserProfile(userId, updates);
  }

  resetUserPassword(email: string): Promise<void> {
    return authService.resetPassword(email);
  }

  adminSetUserPassword(userId: string, newPassword: string): Promise<void> {
    return authService.adminSetUserPassword(userId, newPassword);
  }

  // ── Clients ───────────────────────────────────────────────────────────────

  getClients(): Promise<Client[]> { return db.getClients(); }
  createClient(data: Omit<Client, 'id' | 'created_at'>): Promise<Client> { return db.createClient(data); }
  updateClient(id: string, updates: Partial<Omit<Client, 'id' | 'created_at'>>): Promise<Client> { return db.updateClient(id, updates); }
  deleteClient(id: string): Promise<void> { return db.deleteClient(id); }

  // ── Employees & Payslips ──────────────────────────────────────────────────

  getEmployees(): Promise<Employee[]> { return db.getEmployees(); }
  createEmployee(data: Omit<Employee, 'id' | 'employee_number' | 'created_at' | 'updated_at'>): Promise<Employee> { return db.createEmployee(data); }
  updateEmployee(id: string, updates: Partial<Omit<Employee, 'id' | 'employee_number' | 'created_at'>>): Promise<Employee> { return db.updateEmployee(id, updates); }
  deleteEmployee(id: string): Promise<void> { return db.deleteEmployee(id); }

  getPayslips(filters?: { employeeId?: string; year?: number; month?: number }): Promise<Payslip[]> {
    return db.getPayslips(filters);
  }
  generatePayslip(data: Parameters<typeof db.generatePayslip>[0]): Promise<Payslip> { return db.generatePayslip(data); }
  updatePayslipStatus(id: string, status: Parameters<typeof db.updatePayslipStatus>[1]): Promise<Payslip> { return db.updatePayslipStatus(id, status); }
  deletePayslip(id: string): Promise<void> { return db.deletePayslip(id); }

  // ── Invites ───────────────────────────────────────────────────────────────

  getInvites(): Promise<UserInvite[]> { return db.getInvites(); }
  createInvite(data: Parameters<typeof db.createInvite>[0]): Promise<UserInvite> { return db.createInvite(data); }
  getInviteByToken(token: string): Promise<UserInvite | null> { return db.getInviteByToken(token); }
  deleteInvite(inviteId: string): Promise<void> { return db.updateInviteStatus(inviteId, 'Cancelled'); }

  resendInvite(inviteId: string): Promise<UserInvite> {
    const newExpiry = new Date();
    newExpiry.setDate(newExpiry.getDate() + 7);
    return db.updateInviteExpiry(inviteId, newExpiry.toISOString());
  }

  async acceptInvite(token: string, password: string): Promise<AuthSession> {
    const invite = await db.getInviteByToken(token);
    if (!invite) throw new Error('Invalid or expired invite token');
    await authService.createUser({ email: invite.email, password, name: invite.name, role: invite.role });
    await db.updateInviteStatus(invite.id, 'Accepted');
    return authService.login(invite.email, password);
  }

  // ── Operating Funds ───────────────────────────────────────────────────────

  getOperatingFunds(): Promise<OperatingFund[]> { return db.getOperatingFunds(); }
  getOperatingFundsByRecipient(recipient: string): Promise<OperatingFund[]> { return db.getOperatingFundsByRecipient(recipient); }
  addOperatingFund(fund: Omit<OperatingFund, 'id' | 'created_at'>): Promise<OperatingFund> { return db.addOperatingFund(fund); }
  updateOperatingFund(id: string, updates: Partial<Omit<OperatingFund, 'id' | 'created_at'>>): Promise<OperatingFund> { return db.updateOperatingFund(id, updates); }
  deleteOperatingFund(id: string): Promise<void> { return db.deleteOperatingFund(id); }
  getOperatingFundsBalance(): Promise<{ received: number; disbursed: number; balance: number }> { return db.getOperatingFundsBalance(); }

  // ── Config (legacy) ───────────────────────────────────────────────────────

  async getSupabaseConfig(): Promise<SupabaseConfig> {
    return { ...this.config, isConnected: isNeonConnected() };
  }

  async updateSupabaseConfig(config: SupabaseConfig): Promise<void> {
    this.config = { ...config, isConnected: isNeonConnected() };
  }
}

export const supabase = new DataService();
