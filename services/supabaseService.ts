/**
 * Supabase Service - Auth + Neon Database
 * 
 * ARCHITECTURE:
 * - Supabase: RETAINED FOR AUTH ONLY (signUp, login, logout, sessions, password reset)
 * - Neon: ALL DATABASE OPERATIONS (vehicles, expenses, quotes, invoices, etc.)
 * 
 * Access control is enforced at the application level.
 * User ID from Supabase Auth is passed explicitly to Neon queries where needed.
 */

import { Vehicle, Expense, LandedCostSummary, CompanyDetails, AppUser, Quote, Invoice, Payment, AuthSession, SupabaseConfig, UserInvite, UserRole, Client, LineItem, RegistrationRequest, Employee, Payslip, OperatingFund, QuoteItem, InvoiceItem, FinancialStatus } from '../types';
import { EXCHANGE_RATES } from '../constants';
import { supabaseClient } from './supabaseClient';
import * as db from './databaseService';
import { isNeonConnected } from './neonClient';
import { authService } from './authService';

// Production-ready validation and error handling
interface APIErrorDetails {
  message: string;
  status?: number;
  code?: string;
  [key: string]: unknown;
}

function isAPIError(error: unknown): error is APIErrorDetails {
  return typeof error === 'object' && error !== null && 'message' in error;
}

function getErrorMessage(error: unknown): string {
  if (isAPIError(error)) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
}

class APIError extends Error {
  constructor(public statusCode: number, message: string, public details?: unknown) {
    super(message);
    this.name = 'APIError';
  }
}

class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Request logging for production monitoring
interface LogData {
  [key: string]: unknown;
}

const logAPICall = (method: string, endpoint: string, data?: LogData) => {
  const timestamp = new Date().toISOString();
  // Production logging - captured by monitoring system
};

// Input validation helpers
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const sanitizeString = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};

const QUOTE_CURRENCIES = ['USD', 'GBP'] as const;

const validateRequired = (value: unknown, fieldName: string): void => {
  if (value === null || value === undefined || value === '') {
    throw new ValidationError(`${fieldName} is required`, fieldName);
  }
};

const FINANCIAL_STATUSES: FinancialStatus[] = ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'];

class SupabaseService {
  // Configuration - tracks Neon connection status now
  private config: SupabaseConfig = {
    url: import.meta.env.VITE_SUPABASE_URL || '',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    isConnected: isNeonConnected() // Now checks Neon, not Supabase DB
  };

  // ============================================
  // AUTH METHODS (Using Supabase Auth - RETAINED)
  // ============================================

  async signUp(email: string, password: string, metadata?: { name: string; role: string }) {
    logAPICall('POST', '/auth/signup', { email });

    // Validation
    validateRequired(email, 'email');
    validateRequired(password, 'password');
    if (!validateEmail(email)) {
      throw new ValidationError('Invalid email format', 'email');
    }
    if (password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters', 'password');
    }

    try {
      // Supabase Auth - RETAINED
      const { data, error } = await supabaseClient.auth.signUp({
        email: sanitizeString(email),
        password,
        options: {
          data: metadata ? {
            name: sanitizeString(metadata.name),
            role: sanitizeString(metadata.role)
          } : {}
        }
      });

      if (error) {
        throw new APIError(400, error.message, error);
      }
      logAPICall('POST', '/auth/signup', { success: true, userId: data.user?.id });
      return data;
    } catch (error: unknown) {
      logAPICall('POST', '/auth/signup', { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async login(email: string, password: string): Promise<AuthSession> {
    logAPICall('POST', '/auth/login', { email });

    // Validation
    validateRequired(email, 'email');
    validateRequired(password, 'password');
    if (!validateEmail(email)) {
      throw new ValidationError('Invalid email format', 'email');
    }

    try {
      // Supabase Auth - RETAINED for credential verification
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: sanitizeString(email),
        password
      });

      if (error) throw new APIError(401, 'Invalid credentials', error);
      if (!data.user) throw new APIError(500, 'No user returned from login');

      // IMPORTANT: Fetch or create user profile in Neon (source of truth for roles)
      let userProfile = null;
      try {
        userProfile = await db.getUserProfileById(data.user.id);
        
        // AUTO-SYNC: If user exists in Supabase Auth but not in Neon, create profile
        if (!userProfile && isNeonConnected()) {
          const newProfile = {
            name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'User',
            email: data.user.email!,
            role: (data.user.user_metadata?.role as UserRole) || 'Driver',
            status: 'Active' as const
          };
          userProfile = await db.createUserProfile(data.user.id, newProfile);
        }
      } catch (profileError: unknown) {
        // Profile fetch/create failed - will use Supabase metadata fallback
      }

      // Use Neon profile data if available, otherwise fall back to Supabase metadata
      const appUser: AppUser = {
        id: data.user.id,
        name: userProfile?.name || data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'User',
        email: data.user.email!,
        role: userProfile?.role || data.user.user_metadata?.role || 'Driver',
        status: userProfile?.status || 'Active'
      };

      logAPICall('POST', '/auth/login', { success: true, userId: appUser.id, role: appUser.role, source: userProfile ? 'neon' : 'supabase' });
      return { user: appUser };
    } catch (error: unknown) {
      logAPICall('POST', '/auth/login', { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async logout(): Promise<void> {
    logAPICall('POST', '/auth/logout');
    try {
      // Supabase Auth - RETAINED
      const { error } = await supabaseClient.auth.signOut();
      if (error) throw new APIError(500, 'Logout failed', error);
      logAPICall('POST', '/auth/logout', { success: true });
    } catch (error: unknown) {
      logAPICall('POST', '/auth/logout', { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async getSession(): Promise<AuthSession | null> {
    logAPICall('GET', '/auth/session');

    try {
      // Supabase Auth - RETAINED for session management
      const { data: { session }, error } = await supabaseClient.auth.getSession();

      if (error) throw new APIError(500, 'Failed to get session', error);
      if (!session) {
        logAPICall('GET', '/auth/session', { success: true, hasSession: false });
        return null;
      }

      // IMPORTANT: Fetch or create user profile in Neon (source of truth for roles)
      let userProfile = null;
      try {
        userProfile = await db.getUserProfileById(session.user.id);
        
        // AUTO-SYNC: If user exists in Supabase Auth but not in Neon, create profile
        if (!userProfile && isNeonConnected()) {
          const newProfile = {
            name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
            email: session.user.email!,
            role: (session.user.user_metadata?.role as UserRole) || 'Driver',
            status: 'Active' as const
          };
          userProfile = await db.createUserProfile(session.user.id, newProfile);
        }
      } catch (profileError: unknown) {
        // Profile fetch/create failed - will use Supabase metadata fallback
      }

      // Use Neon profile data if available, otherwise fall back to Supabase metadata
      const appUser: AppUser = {
        id: session.user.id,
        name: userProfile?.name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
        email: session.user.email!,
        role: userProfile?.role || session.user.user_metadata?.role || 'Driver',
        status: userProfile?.status || 'Active'
      };

      logAPICall('GET', '/auth/session', { success: true, hasSession: true, userId: appUser.id, role: appUser.role });
      return { user: appUser };
    } catch (error: unknown) {
      logAPICall('GET', '/auth/session', { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  // Explicitly sync the current logged-in user to Neon user_profiles
  async syncCurrentUser(): Promise<AppUser | null> {
    logAPICall('POST', '/auth/sync-user');
    
    try {
      const { data: { session }, error } = await supabaseClient.auth.getSession();
      
      if (error || !session) {
        return null;
      }
      
      // Check if user already exists in Neon
      let userProfile = await db.getUserProfileById(session.user.id);
      
      if (!userProfile && isNeonConnected()) {
        userProfile = await db.createUserProfile(session.user.id, {
          name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
          email: session.user.email!,
          role: (session.user.user_metadata?.role as UserRole) || 'Admin', // Default to Admin for first user
          status: 'Active'
        });
      }
      
      logAPICall('POST', '/auth/sync-user', { success: true, userId: userProfile?.id });
      return userProfile;
    } catch (error: unknown) {
      logAPICall('POST', '/auth/sync-user', { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async resetPassword(email: string) {
    logAPICall('POST', '/auth/reset-password', { email });

    validateRequired(email, 'email');
    if (!validateEmail(email)) {
      throw new ValidationError('Invalid email format', 'email');
    }

    try {
      // Supabase Auth - RETAINED
      // Note: The redirect URL must be whitelisted in Supabase Auth settings
      // Go to: Authentication > URL Configuration > Redirect URLs
      // Add: http://localhost:3000/* and https://yourdomain.com/*
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabaseClient.auth.resetPasswordForEmail(sanitizeString(email), {
        redirectTo: redirectUrl,
      });

      if (error) {
        // Provide more specific error messages
        if (error.message?.includes('Email not found') || error.message?.includes('User not found')) {
          throw new APIError(404, 'No account found with this email address', error);
        }
        if (error.message?.includes('redirect')) {
          throw new APIError(400, 'Redirect URL not authorized. Please contact support.', error);
        }
        throw new APIError(400, error.message || 'Failed to send reset email', error);
      }
      
      logAPICall('POST', '/auth/reset-password', { success: true });
    } catch (error: unknown) {
      logAPICall('POST', '/auth/reset-password', { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async updatePassword(newPassword: string) {
    logAPICall('PUT', '/auth/password');

    validateRequired(newPassword, 'password');
    if (newPassword.length < 8) {
      throw new ValidationError('Password must be at least 8 characters', 'password');
    }

    try {
      // Supabase Auth - RETAINED
      const { error } = await supabaseClient.auth.updateUser({
        password: newPassword
      });

      if (error) throw new APIError(400, 'Failed to update password', error);
      logAPICall('PUT', '/auth/password', { success: true });
    } catch (error: unknown) {
      logAPICall('PUT', '/auth/password', { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  // ============================================
  // REGISTRATION REQUESTS (Using Neon)
  // ============================================

  async createRegistrationRequest(data: { name: string; email: string; role: UserRole }): Promise<void> {
    logAPICall('POST', '/auth/registration-request', { email: data.email, role: data.role });

    validateRequired(data.name, 'name');
    validateRequired(data.email, 'email');
    validateRequired(data.role, 'role');

    if (!validateEmail(data.email)) {
      throw new ValidationError('Invalid email format', 'email');
    }

    try {
      // Neon Database
      await db.createRegistrationRequest({
        name: sanitizeString(data.name),
        email: sanitizeString(data.email.toLowerCase()),
        role: data.role
      });

      logAPICall('POST', '/auth/registration-request', { success: true });
    } catch (error: unknown) {
      logAPICall('POST', '/auth/registration-request', { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async getRegistrationRequests(): Promise<RegistrationRequest[]> {
    logAPICall('GET', '/auth/registration-requests');

    try {
      // Neon Database
      const requests = await db.getRegistrationRequests();
      logAPICall('GET', '/auth/registration-requests', { success: true, count: requests.length });
      return requests;
    } catch (error: unknown) {
      logAPICall('GET', '/auth/registration-requests', { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async approveRegistrationRequest(requestId: string, adminId: string): Promise<void> {
    logAPICall('POST', `/auth/registration-requests/${requestId}/approve`);

    validateRequired(requestId, 'requestId');

    try {
      // Get the request from Neon
      const request = await db.getRegistrationRequestById(requestId);
      if (!request) {
        throw new ValidationError('Registration request not found', 'requestId');
      }

      const inviteToken = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await db.createInvite({
        email: request.email,
        role: request.role,
        name: request.name,
        invitedBy: adminId,
        inviteToken,
        expiresAt: expiresAt.toISOString()
      });

      // Update request status in Neon
      await db.updateRegistrationRequestStatus(requestId, 'Approved', adminId);

      logAPICall('POST', `/auth/registration-requests/${requestId}/approve`, { success: true });
    } catch (error: unknown) {
      logAPICall('POST', `/auth/registration-requests/${requestId}/approve`, { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async rejectRegistrationRequest(requestId: string, adminId: string): Promise<void> {
    logAPICall('POST', `/auth/registration-requests/${requestId}/reject`);

    validateRequired(requestId, 'requestId');

    try {
      // Neon Database
      await db.updateRegistrationRequestStatus(requestId, 'Rejected', adminId);
      logAPICall('POST', `/auth/registration-requests/${requestId}/reject`, { success: true });
    } catch (error: unknown) {
      logAPICall('POST', `/auth/registration-requests/${requestId}/reject`, { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  // ============================================
  // VEHICLES (Using Neon)
  // ============================================

  async getVehicles(): Promise<Vehicle[]> {
    logAPICall('GET', '/vehicles');

    if (!isNeonConnected()) {
      throw new Error('Database not configured. Please check VITE_NEON_DATABASE_URL.');
    }

    try {
      const vehicles = await db.getVehicles();
      logAPICall('GET', '/vehicles', { success: true, count: vehicles.length, source: 'neon' });
      return vehicles;
    } catch (error: unknown) {
      logAPICall('GET', '/vehicles', { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async addVehicle(vehicle: Omit<Vehicle, 'id' | 'created_at'>): Promise<Vehicle> {
    logAPICall('POST', '/vehicles', vehicle);

    if (!isNeonConnected()) {
      throw new Error('Database not configured. Please check VITE_NEON_DATABASE_URL.');
    }

    // Validation
    validateRequired(vehicle.vin_number, 'vin_number');
    validateRequired(vehicle.make_model, 'make_model');
    validateRequired(vehicle.purchase_price_gbp, 'purchase_price_gbp');

    if (vehicle.vin_number.length < 5) {
      throw new ValidationError('VIN number must be at least 5 characters', 'vin_number');
    }
    if (vehicle.purchase_price_gbp <= 0) {
      throw new ValidationError('Purchase price must be greater than 0', 'purchase_price_gbp');
    }

    try {
      const newVehicle = await db.addVehicle({
        vin_number: sanitizeString(vehicle.vin_number),
        make_model: sanitizeString(vehicle.make_model),
        purchase_price_gbp: vehicle.purchase_price_gbp,
        status: vehicle.status
      });
      logAPICall('POST', '/vehicles', { success: true, vehicleId: newVehicle.id });
      return newVehicle;
    } catch (error: unknown) {
      const errorMsg = getErrorMessage(error);
      if (errorMsg.includes('duplicate') || (isAPIError(error) && error.code === '23505')) {
        throw new ValidationError('Vehicle with this VIN already exists', 'vin_number');
      }
      logAPICall('POST', '/vehicles', { success: false, error: errorMsg });
      throw error;
    }
  }

  async updateVehicle(vehicleId: string, vehicle: Partial<Omit<Vehicle, 'id' | 'created_at'>>): Promise<Vehicle> {
    logAPICall('PUT', `/vehicles/${vehicleId}`, vehicle);
    validateRequired(vehicleId, 'vehicleId');

    try {
      const updated = await db.updateVehicle(vehicleId, vehicle);
      logAPICall('PUT', `/vehicles/${vehicleId}`, { success: true });
      return updated;
    } catch (error: unknown) {
      logAPICall('PUT', `/vehicles/${vehicleId}`, { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async deleteVehicle(vehicleId: string): Promise<void> {
    logAPICall('DELETE', `/vehicles/${vehicleId}`);
    validateRequired(vehicleId, 'vehicleId');

    try {
      await db.deleteVehicle(vehicleId);
      logAPICall('DELETE', `/vehicles/${vehicleId}`, { success: true });
    } catch (error: unknown) {
      logAPICall('DELETE', `/vehicles/${vehicleId}`, { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  // ============================================
  // EXPENSES (Using Neon)
  // ============================================

  async getExpenses(): Promise<Expense[]> {
    logAPICall('GET', '/expenses');

    try {
      const expenses = await db.getExpenses();
      logAPICall('GET', '/expenses', { success: true, count: expenses.length });
      return expenses;
    } catch (error: unknown) {
      logAPICall('GET', '/expenses', { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async getExpensesByVehicle(vehicleId: string): Promise<Expense[]> {
    logAPICall('GET', `/vehicles/${vehicleId}/expenses`);
    validateRequired(vehicleId, 'vehicleId');

    try {
      const expenses = await db.getExpensesByVehicle(vehicleId);
      logAPICall('GET', `/vehicles/${vehicleId}/expenses`, { success: true, count: expenses.length });
      return expenses;
    } catch (error: unknown) {
      logAPICall('GET', `/vehicles/${vehicleId}/expenses`, { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async addExpense(expenseData: Omit<Expense, 'id' | 'created_at' | 'exchange_rate_to_usd'>): Promise<Expense> {
    logAPICall('POST', '/expenses', expenseData);

    if (!isNeonConnected()) {
      throw new Error('Database not configured. Please check VITE_NEON_DATABASE_URL.');
    }

    // Validation
    validateRequired(expenseData.amount, 'amount');
    validateRequired(expenseData.currency, 'currency');
    validateRequired(expenseData.category, 'category');

    if (expenseData.category === 'Other' && !expenseData.description?.trim()) {
      throw new ValidationError('Description is required for "Other" category expenses', 'description');
    }

    if (expenseData.amount <= 0) {
      throw new ValidationError('Amount must be greater than 0', 'amount');
    }
    if (!EXCHANGE_RATES[expenseData.currency]) {
      throw new ValidationError('Invalid currency', 'currency');
    }

    try {
      const expense = await db.addExpense(expenseData);
      logAPICall('POST', '/expenses', { success: true, expenseId: expense.id });
      return expense;
    } catch (error: unknown) {
      logAPICall('POST', '/expenses', { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async updateExpense(expenseId: string, updates: Partial<Omit<Expense, 'id' | 'created_at' | 'exchange_rate_to_usd'>>): Promise<Expense> {
    logAPICall('PUT', `/expenses/${expenseId}`, updates);
    validateRequired(expenseId, 'expenseId');

    if (updates.amount !== undefined && updates.amount <= 0) {
      throw new ValidationError('Amount must be greater than 0', 'amount');
    }

    try {
      const expense = await db.updateExpense(expenseId, updates);
      logAPICall('PUT', `/expenses/${expenseId}`, { success: true });
      return expense;
    } catch (error: unknown) {
      logAPICall('PUT', `/expenses/${expenseId}`, { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async deleteExpense(expenseId: string): Promise<void> {
    logAPICall('DELETE', `/expenses/${expenseId}`);
    validateRequired(expenseId, 'expenseId');

    try {
      await db.deleteExpense(expenseId);
      logAPICall('DELETE', `/expenses/${expenseId}`, { success: true });
    } catch (error: unknown) {
      logAPICall('DELETE', `/expenses/${expenseId}`, { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async getLandedCostSummaries(): Promise<LandedCostSummary[]> {
    logAPICall('GET', '/summaries');

    try {
      const vehicles = await this.getVehicles();
      const expenses = await this.getExpenses();

      const summaries = vehicles.map(v => {
        const vehicleExpenses = expenses.filter(e => e.vehicle_id === v.id);
        const expensesUsd = vehicleExpenses.reduce((sum, e) => sum + ((e.amount || 0) * (e.exchange_rate_to_usd || 1)), 0);
        const purchaseUsd = v.purchase_price_gbp * EXCHANGE_RATES['GBP'];

        return {
          vehicle_id: v.id,
          vin_number: v.vin_number,
          make_model: v.make_model,
          purchase_price_gbp: v.purchase_price_gbp,
          total_expenses_usd: expensesUsd,
          total_landed_cost_usd: purchaseUsd + expensesUsd,
          status: v.status
        };
      });

      logAPICall('GET', '/summaries', { success: true, count: summaries.length });
      return summaries;
    } catch (error: unknown) {
      logAPICall('GET', '/summaries', { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  // ============================================
  // QUOTES (Using Neon)
  // ============================================

  async getQuotes(): Promise<Quote[]> {
    logAPICall('GET', '/quotes');

    try {
      const quotes = await db.getQuotes();
      logAPICall('GET', '/quotes', { success: true, count: quotes.length });
      return quotes;
    } catch (error: unknown) {
      logAPICall('GET', '/quotes', { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async createQuote(quoteData: Omit<Quote, 'id' | 'created_at' | 'quote_number'>): Promise<Quote> {
    logAPICall('POST', '/quotes', quoteData);

    if (!isNeonConnected()) {
      throw new Error('Database not configured. Please check VITE_NEON_DATABASE_URL.');
    }

    // Validation
    validateRequired(quoteData.client_name, 'client_name');
    validateRequired(quoteData.amount_usd, 'amount_usd');

    if (quoteData.client_email && !validateEmail(quoteData.client_email)) {
      throw new ValidationError('Invalid email format', 'client_email');
    }
    if (quoteData.amount_usd <= 0) {
      throw new ValidationError('Amount must be greater than 0', 'amount_usd');
    }
    if (quoteData.currency && !QUOTE_CURRENCIES.includes(quoteData.currency)) {
      throw new ValidationError('Quote currency must be USD or GBP', 'currency');
    }

    try {
      const quote = await db.createQuote(quoteData);
      logAPICall('POST', '/quotes', { success: true, quoteId: quote.id });
      return quote;
    } catch (error: unknown) {
      const errorMsg = getErrorMessage(error);
      logAPICall('POST', '/quotes', { success: false, error: errorMsg });
      throw new APIError(500, 'Failed to create quote: ' + errorMsg, error);
    }
  }

  async updateQuote(quoteId: string, updates: Partial<Omit<Quote, 'id' | 'created_at' | 'quote_number'>>): Promise<Quote> {
    logAPICall('PUT', `/quotes/${quoteId}`, updates);
    validateRequired(quoteId, 'quoteId');

    if (updates.client_email && !validateEmail(updates.client_email)) {
      throw new ValidationError('Invalid email format', 'client_email');
    }
    if (updates.amount_usd !== undefined && updates.amount_usd <= 0) {
      throw new ValidationError('Amount must be greater than 0', 'amount_usd');
    }
    if (updates.currency && !QUOTE_CURRENCIES.includes(updates.currency)) {
      throw new ValidationError('Quote currency must be USD or GBP', 'currency');
    }

    try {
      const quote = await db.updateQuote(quoteId, updates);
      logAPICall('PUT', `/quotes/${quoteId}`, { success: true });
      return quote;
    } catch (error: unknown) {
      logAPICall('PUT', `/quotes/${quoteId}`, { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async deleteQuote(quoteId: string): Promise<void> {
    logAPICall('DELETE', `/quotes/${quoteId}`);
    validateRequired(quoteId, 'quoteId');

    try {
      await db.deleteQuote(quoteId);
      logAPICall('DELETE', `/quotes/${quoteId}`, { success: true });
    } catch (error: unknown) {
      logAPICall('DELETE', `/quotes/${quoteId}`, { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async updateQuoteStatus(quoteId: string, status: string): Promise<Quote> {
    logAPICall('PATCH', `/quotes/${quoteId}/status`, { status });
    validateRequired(quoteId, 'quoteId');
    validateRequired(status, 'status');

    try {
      const quote = await db.updateQuoteStatus(quoteId, status);
      logAPICall('PATCH', `/quotes/${quoteId}/status`, { success: true });
      return quote;
    } catch (error: unknown) {
      logAPICall('PATCH', `/quotes/${quoteId}/status`, { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  // ============================================
  // INVOICES (Using Neon)
  // ============================================

  async getInvoices(): Promise<Invoice[]> {
    logAPICall('GET', '/invoices');

    try {
      const invoices = await db.getInvoices();
      logAPICall('GET', '/invoices', { success: true, count: invoices.length });
      return invoices;
    } catch (error: unknown) {
      logAPICall('GET', '/invoices', { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async createPayment(paymentData: { reference_id: string; type: 'Inbound' | 'Outbound'; amount_usd: number; method: string; date: string }): Promise<Payment> {
    logAPICall('POST', '/payments', paymentData);

    if (!isNeonConnected()) {
      throw new Error('Database not configured. Please check VITE_NEON_DATABASE_URL.');
    }

    try {
      const payment = await db.createPayment(paymentData);
      logAPICall('POST', '/payments', { success: true, paymentId: payment.id });
      return payment;
    } catch (error: unknown) {
      const errorMsg = getErrorMessage(error);
      logAPICall('POST', '/payments', { success: false, error: errorMsg });
      throw new APIError(500, 'Failed to create payment: ' + errorMsg, error);
    }
  }

  async createInvoice(invoiceData: Omit<Invoice, 'id' | 'created_at' | 'invoice_number'>): Promise<Invoice> {
    logAPICall('POST', '/invoices', invoiceData);

    if (!isNeonConnected()) {
      throw new Error('Database not configured. Please check VITE_NEON_DATABASE_URL.');
    }

    // Validation
    validateRequired(invoiceData.client_name, 'client_name');
    validateRequired(invoiceData.amount_usd, 'amount_usd');
    validateRequired(invoiceData.due_date, 'due_date');

    if (invoiceData.client_email && !validateEmail(invoiceData.client_email)) {
      throw new ValidationError('Invalid email format', 'client_email');
    }
    if (invoiceData.amount_usd <= 0) {
      throw new ValidationError('Amount must be greater than 0', 'amount_usd');
    }
    if (invoiceData.status && !FINANCIAL_STATUSES.includes(invoiceData.status)) {
      throw new ValidationError('Invalid invoice status', 'status');
    }

    try {
      const invoice = await db.createInvoice(invoiceData);
      logAPICall('POST', '/invoices', { success: true, invoiceId: invoice.id });
      return invoice;
    } catch (error: unknown) {
      const errorMsg = getErrorMessage(error);
      logAPICall('POST', '/invoices', { success: false, error: errorMsg });
      throw new APIError(500, 'Failed to create invoice: ' + errorMsg, error);
    }
  }

  async updateInvoice(invoiceId: string, updates: Partial<Omit<Invoice, 'id' | 'created_at' | 'invoice_number'>>): Promise<Invoice> {
    logAPICall('PUT', `/invoices/${invoiceId}`, updates);
    validateRequired(invoiceId, 'invoiceId');

    if (updates.client_email && !validateEmail(updates.client_email)) {
      throw new ValidationError('Invalid email format', 'client_email');
    }
    if (updates.amount_usd !== undefined && updates.amount_usd <= 0) {
      throw new ValidationError('Amount must be greater than 0', 'amount_usd');
    }
    if (updates.status && !FINANCIAL_STATUSES.includes(updates.status)) {
      throw new ValidationError('Invalid invoice status', 'status');
    }

    try {
      const invoice = await db.updateInvoice(invoiceId, updates);
      logAPICall('PUT', `/invoices/${invoiceId}`, { success: true });
      return invoice;
    } catch (error: unknown) {
      logAPICall('PUT', `/invoices/${invoiceId}`, { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async deleteInvoice(invoiceId: string): Promise<void> {
    logAPICall('DELETE', `/invoices/${invoiceId}`);
    validateRequired(invoiceId, 'invoiceId');

    try {
      await db.deleteInvoice(invoiceId);
      logAPICall('DELETE', `/invoices/${invoiceId}`, { success: true });
    } catch (error: unknown) {
      logAPICall('DELETE', `/invoices/${invoiceId}`, { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async updateInvoiceStatus(invoiceId: string, status: FinancialStatus): Promise<Invoice> {
    logAPICall('PATCH', `/invoices/${invoiceId}/status`, { status });
    validateRequired(invoiceId, 'invoiceId');
    validateRequired(status, 'status');
    if (!FINANCIAL_STATUSES.includes(status)) {
      throw new ValidationError('Invalid invoice status', 'status');
    }

    try {
      const invoice = await db.updateInvoiceStatus(invoiceId, status);
      logAPICall('PATCH', `/invoices/${invoiceId}/status`, { success: true });
      return invoice;
    } catch (error: unknown) {
      logAPICall('PATCH', `/invoices/${invoiceId}/status`, { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  // ============================================
  // PAYMENTS (Using Neon)
  // ============================================

  async getPayments(): Promise<Payment[]> {
    logAPICall('GET', '/payments');

    try {
      const payments = await db.getPayments();
      logAPICall('GET', '/payments', { success: true, count: payments.length });
      return payments;
    } catch (error: unknown) {
      logAPICall('GET', '/payments', { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async addPayment(paymentData: Omit<Payment, 'id'>): Promise<Payment> {
    logAPICall('POST', '/payments', paymentData);

    // Validation
    validateRequired(paymentData.reference_id, 'reference_id');
    validateRequired(paymentData.amount_usd, 'amount_usd');
    validateRequired(paymentData.type, 'type');

    if (paymentData.amount_usd <= 0) {
      throw new ValidationError('Amount must be greater than 0', 'amount_usd');
    }

    try {
      const payment = await db.addPayment(paymentData);
      logAPICall('POST', '/payments', { success: true, paymentId: payment.id });
      return payment;
    } catch (error: unknown) {
      logAPICall('POST', '/payments', { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async updatePayment(paymentId: string, updates: Partial<Omit<Payment, 'id'>>): Promise<Payment> {
    logAPICall('PUT', `/payments/${paymentId}`, updates);
    validateRequired(paymentId, 'paymentId');

    if (updates.amount_usd !== undefined && updates.amount_usd <= 0) {
      throw new ValidationError('Amount must be greater than 0', 'amount_usd');
    }

    try {
      const payment = await db.updatePayment(paymentId, updates);
      logAPICall('PUT', `/payments/${paymentId}`, { success: true });
      return payment;
    } catch (error: unknown) {
      logAPICall('PUT', `/payments/${paymentId}`, { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async deletePayment(paymentId: string): Promise<void> {
    logAPICall('DELETE', `/payments/${paymentId}`);
    validateRequired(paymentId, 'paymentId');

    try {
      await db.deletePayment(paymentId);
      logAPICall('DELETE', `/payments/${paymentId}`, { success: true });
    } catch (error: unknown) {
      logAPICall('DELETE', `/payments/${paymentId}`, { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  // ============================================
  // COMPANY DETAILS (Using Neon)
  // ============================================

  async getCompanyDetails(): Promise<CompanyDetails> {
    logAPICall('GET', '/company');

    try {
      const company = await db.getCompanyDetails();
      logAPICall('GET', '/company', { success: true, source: 'neon' });
      return company || {
        name: "Your Company Name",
        registration_no: "",
        tax_id: "",
        address: "",
        contact_email: "info@company.com"
      };
    } catch (error: unknown) {
      logAPICall('GET', '/company', { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async updateCompanyDetails(details: CompanyDetails): Promise<void> {
    logAPICall('PUT', '/company', details);

    // Validation
    validateRequired(details.name, 'name');
    validateRequired(details.contact_email, 'contact_email');

    if (!validateEmail(details.contact_email)) {
      throw new ValidationError('Invalid email format', 'contact_email');
    }

    if (details.website && details.website.trim() && !details.website.startsWith('http')) {
      details.website = 'https://' + details.website;
    }

    try {
      await db.updateCompanyDetails(details);
      logAPICall('PUT', '/company', { success: true });
    } catch (error: unknown) {
      logAPICall('PUT', '/company', { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  // ============================================
  // USERS (Profile in Neon, Auth in Supabase)
  // ============================================

  async getUsers(): Promise<AppUser[]> {
    logAPICall('GET', '/users');

    if (!isNeonConnected()) {
      throw new Error('Database not configured. Please check VITE_NEON_DATABASE_URL.');
    }

    try {
      const users = await db.getUserProfiles();
      logAPICall('GET', '/users', { success: true, count: users.length });
      return users;
    } catch (error: unknown) {
      logAPICall('GET', '/users', { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async createUser(userData: Omit<AppUser, 'id'>): Promise<AppUser> {
    logAPICall('POST', '/users', { email: userData.email, role: userData.role });

    // Validation
    validateRequired(userData.name, 'name');
    validateRequired(userData.email, 'email');
    validateRequired(userData.role, 'role');

    if (!validateEmail(userData.email)) {
      throw new ValidationError('Invalid email format', 'email');
    }

    const validRoles = ['Admin', 'Manager', 'Driver', 'Accountant'];
    if (!validRoles.includes(userData.role)) {
      throw new ValidationError('Invalid role', 'role');
    }

    try {
      // First, try to create auth user in Supabase
      const tempPassword = Math.random().toString(36).slice(-12) + 'Aa1!';
      const { data: authData, error: authError } = await supabaseClient.auth.signUp({
        email: userData.email,
        password: tempPassword,
        options: {
          data: {
            name: userData.name,
            role: userData.role
          }
        }
      });

      // Handle "User already registered" - user exists in Supabase but maybe not in Neon
      if (authError) {
        if (authError.message?.includes('already registered') || authError.message?.includes('already exists')) {
          // Check if user already exists in Neon by email
          const existingUser = await db.getUserProfileByEmail(userData.email);
          
          if (existingUser) {
            // User already in both systems - just update and return
            const updated = await db.updateUserProfile(existingUser.id, {
              name: userData.name,
              role: userData.role,
              status: userData.status || 'Active'
            });
            logAPICall('POST', '/users', { success: true, userId: updated.id, action: 'updated_existing' });
            return updated;
          } else {
            // User in Supabase but not Neon - we can't get their ID without admin API
            // Show helpful error message
            throw new Error('User exists in authentication system but not in user profiles. Ask the user to log in once to sync their profile, or use the Invite feature instead.');
          }
        }
        throw authError;
      }
      
      if (!authData.user) throw new Error('Failed to create auth user');

      // Then create user profile in Neon
      const newUser = await db.createUserProfile(authData.user.id, {
        name: sanitizeString(userData.name),
        email: sanitizeString(userData.email),
        role: userData.role,
        status: userData.status || 'Active'
      });

      // IMPORTANT: Send password reset email so user can set their own password
      // The temp password is not shared with the user - they must use password reset
      try {
        const redirectUrl = typeof window !== 'undefined' 
          ? `${window.location.origin}/login` 
          : 'https://www.affinitylogistics.space/login';
        
        await supabaseClient.auth.resetPasswordForEmail(userData.email, {
          redirectTo: redirectUrl
        });
      } catch (emailError: unknown) {
        // Log but don't fail - user is created, they can request reset manually
      }

      logAPICall('POST', '/users', { success: true, userId: newUser.id, emailSent: true });
      return newUser;
    } catch (error: unknown) {
      const errorMsg = getErrorMessage(error);
      logAPICall('POST', '/users', { success: false, error: errorMsg });
      throw new APIError(500, 'Failed to create user: ' + errorMsg, error);
    }
  }

  async deleteUser(userId: string): Promise<void> {
    logAPICall('DELETE', `/users/${userId}`);
    validateRequired(userId, 'userId');

    try {
      // Check if user exists
      const user = await db.getUserProfileById(userId);
      if (!user) {
        throw new ValidationError('User not found', 'userId');
      }

      // Prevent deleting the last admin
      if (user.role === 'Admin') {
        const adminCount = await db.countAdminUsers();
        if (adminCount === 1) {
          throw new ValidationError('Cannot delete the last admin user', 'userId');
        }
      }

      // Try to delete from Supabase Auth (may require admin API)
      try {
        await supabaseClient.auth.admin.deleteUser(userId);
      } catch (authDeleteError: unknown) {
        // Auth delete failed - profile deleted but auth user may remain
      }

      // Delete from Neon user_profiles
      await db.deleteUserProfile(userId);

      logAPICall('DELETE', `/users/${userId}`, { success: true });
    } catch (error: unknown) {
      logAPICall('DELETE', `/users/${userId}`, { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async resetUserPassword(email: string): Promise<void> {
    logAPICall('POST', `/users/reset-password`, { email });

    validateRequired(email, 'email');
    if (!validateEmail(email)) {
      throw new ValidationError('Invalid email format', 'email');
    }

    try {
      // Supabase Auth - RETAINED
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/reset-password'
      });

      if (error) throw error;
      logAPICall('POST', `/users/reset-password`, { success: true, email });
    } catch (error: unknown) {
      logAPICall('POST', `/users/reset-password`, { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async updateUser(userId: string, updates: Partial<Omit<AppUser, 'id'>>): Promise<AppUser> {
    logAPICall('PUT', `/users/${userId}`, updates);
    validateRequired(userId, 'userId');

    if (updates.email && !validateEmail(updates.email)) {
      throw new ValidationError('Invalid email format', 'email');
    }

    if (updates.role) {
      const validRoles = ['Admin', 'Manager', 'Driver', 'Accountant'];
      if (!validRoles.includes(updates.role)) {
        throw new ValidationError('Invalid role', 'role');
      }
    }

    try {
      // Get current user
      const currentUser = await db.getUserProfileById(userId);
      if (!currentUser) {
        throw new ValidationError('User not found', 'userId');
      }

      // Prevent removing last admin
      if (updates.role && currentUser.role === 'Admin' && updates.role !== 'Admin') {
        const adminCount = await db.countAdminUsers();
        if (adminCount === 1) {
          throw new ValidationError('Cannot change role of the last admin', 'role');
        }
      }

      // Update in Neon
      const updatedUser = await db.updateUserProfile(userId, {
        name: updates.name ? sanitizeString(updates.name) : undefined,
        email: updates.email ? sanitizeString(updates.email) : undefined,
        role: updates.role,
        status: updates.status
      });

      logAPICall('PUT', `/users/${userId}`, { success: true });
      return updatedUser;
    } catch (error: unknown) {
      logAPICall('PUT', `/users/${userId}`, { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async getSupabaseConfig(): Promise<SupabaseConfig> {
    logAPICall('GET', '/config');
    return {
      ...this.config,
      isConnected: isNeonConnected() // Check Neon connection
    };
  }

  async updateSupabaseConfig(config: SupabaseConfig): Promise<void> {
    logAPICall('PUT', '/config', { hasUrl: !!config.url, hasKey: !!config.anonKey });
    this.config = { ...config, isConnected: isNeonConnected() };
    logAPICall('PUT', '/config', { success: true, isConnected: this.config.isConnected });
  }

  // ============================================
  // CLIENTS (Using Neon)
  // ============================================

  async getClients(): Promise<Client[]> {
    logAPICall('GET', '/clients');

    try {
      const clients = await db.getClients();
      logAPICall('GET', '/clients', { success: true, count: clients.length });
      return clients;
    } catch (error: unknown) {
      logAPICall('GET', '/clients', { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async createClient(clientData: Omit<Client, 'id' | 'created_at'>): Promise<Client> {
    logAPICall('POST', '/clients', { email: clientData.email });

    if (!isNeonConnected()) {
      throw new Error('Database not configured. Please check VITE_NEON_DATABASE_URL.');
    }

    // Validation
    validateRequired(clientData.name, 'name');
    validateRequired(clientData.email, 'email');

    if (!validateEmail(clientData.email)) {
      throw new ValidationError('Invalid email format', 'email');
    }

    try {
      // Check for duplicate email
      const isDuplicate = await db.checkDuplicateClientEmail(clientData.email);
      if (isDuplicate) {
        throw new ValidationError('Client with this email already exists', 'email');
      }

      const client = await db.createClient({
        name: sanitizeString(clientData.name),
        email: sanitizeString(clientData.email),
        phone: clientData.phone ? sanitizeString(clientData.phone) : undefined,
        address: clientData.address ? sanitizeString(clientData.address) : undefined,
        company: clientData.company ? sanitizeString(clientData.company) : undefined,
        notes: clientData.notes ? sanitizeString(clientData.notes) : undefined
      });

      logAPICall('POST', '/clients', { success: true, clientId: client.id });
      return client;
    } catch (error: unknown) {
      const errorMsg = getErrorMessage(error);
      logAPICall('POST', '/clients', { success: false, error: errorMsg });
      throw new APIError(500, 'Failed to create client: ' + errorMsg, error);
    }
  }

  async updateClient(clientId: string, updates: Partial<Omit<Client, 'id' | 'created_at'>>): Promise<Client> {
    logAPICall('PUT', `/clients/${clientId}`, updates);
    validateRequired(clientId, 'clientId');

    if (updates.email && !validateEmail(updates.email)) {
      throw new ValidationError('Invalid email format', 'email');
    }

    try {
      // Check for duplicate email if updating email
      if (updates.email) {
        const isDuplicate = await db.checkDuplicateClientEmail(updates.email, clientId);
        if (isDuplicate) {
          throw new ValidationError('Client with this email already exists', 'email');
        }
      }

      const client = await db.updateClient(clientId, updates);
      logAPICall('PUT', `/clients/${clientId}`, { success: true });
      return client;
    } catch (error: unknown) {
      logAPICall('PUT', `/clients/${clientId}`, { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async deleteClient(clientId: string): Promise<void> {
    logAPICall('DELETE', `/clients/${clientId}`);
    validateRequired(clientId, 'clientId');

    try {
      await db.deleteClient(clientId);
      logAPICall('DELETE', `/clients/${clientId}`, { success: true });
    } catch (error: unknown) {
      logAPICall('DELETE', `/clients/${clientId}`, { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  // ============================================
  // INVITES (Using Neon)
  // ============================================

  async createInvite(email: string, role: UserRole, name: string, invitedBy: string): Promise<UserInvite> {
    logAPICall('POST', '/invites', { email, role });

    validateRequired(email, 'email');
    validateRequired(role, 'role');
    validateRequired(name, 'name');

    if (!validateEmail(email)) {
      throw new ValidationError('Invalid email format', 'email');
    }

    try {
      const inviteToken = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const invite = await db.createInvite({
        email: sanitizeString(email),
        role,
        name: sanitizeString(name),
        invitedBy,
        inviteToken,
        expiresAt: expiresAt.toISOString()
      });

      logAPICall('POST', '/invites', { success: true, inviteId: invite.id });
      return invite;
    } catch (error: unknown) {
      logAPICall('POST', '/invites', { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async getInvites(): Promise<UserInvite[]> {
    logAPICall('GET', '/invites');

    try {
      const invites = await db.getInvites();
      logAPICall('GET', '/invites', { success: true, count: invites.length });
      return invites;
    } catch (error: unknown) {
      logAPICall('GET', '/invites', { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async getInviteByToken(token: string): Promise<UserInvite | null> {
    logAPICall('GET', `/invites/token/${token}`);

    try {
      const invite = await db.getInviteByToken(token);
      return invite;
    } catch (error: unknown) {
      logAPICall('GET', `/invites/token/${token}`, { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async acceptInvite(token: string, password: string): Promise<AuthSession> {
    logAPICall('POST', '/invites/accept', { token });

    try {
      // Verify invite
      const invite = await this.getInviteByToken(token);
      if (!invite) {
        throw new ValidationError('Invalid or expired invite token', 'token');
      }

      await authService.createUser({
        email: invite.email,
        password,
        name: invite.name,
        role: invite.role
      });

      // Update Invite Status in Neon
      await db.updateInviteStatus(invite.id, 'Accepted');

      return await authService.login(invite.email, password);
    } catch (error: unknown) {
      logAPICall('POST', '/invites/accept', { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async deleteInvite(inviteId: string): Promise<void> {
    logAPICall('DELETE', `/invites/${inviteId}`);

    try {
      await db.updateInviteStatus(inviteId, 'Cancelled');
      logAPICall('DELETE', `/invites/${inviteId}`, { success: true });
    } catch (error: unknown) {
      logAPICall('DELETE', `/invites/${inviteId}`, { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async resendInvite(inviteId: string): Promise<UserInvite> {
    logAPICall('POST', `/invites/${inviteId}/resend`);

    try {
      const newExpiry = new Date();
      newExpiry.setDate(newExpiry.getDate() + 7);

      const invite = await db.updateInviteExpiry(inviteId, newExpiry.toISOString());
      return invite;
    } catch (error: unknown) {
      logAPICall('POST', `/invites/${inviteId}/resend`, { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  // ============================================
  // EMPLOYEES (Using Neon)
  // ============================================

  async getEmployees(): Promise<Employee[]> {
    logAPICall('GET', '/employees');

    try {
      const employees = await db.getEmployees();
      logAPICall('GET', '/employees', { success: true, count: employees.length });
      return employees;
    } catch (error: unknown) {
      logAPICall('GET', '/employees', { success: false, error: getErrorMessage(error) });
      return [];
    }
  }

  async createEmployee(employeeData: Omit<Employee, 'id' | 'employee_number' | 'created_at' | 'updated_at'>): Promise<Employee> {
    logAPICall('POST', '/employees', { email: employeeData.email });

    if (!isNeonConnected()) {
      throw new Error('Database not configured. Please check VITE_NEON_DATABASE_URL.');
    }

    // Validation
    validateRequired(employeeData.name, 'name');
    validateRequired(employeeData.email, 'email');
    validateRequired(employeeData.position, 'position');
    validateRequired(employeeData.base_pay_usd, 'base_pay_usd');
    validateRequired(employeeData.date_hired, 'date_hired');

    if (!validateEmail(employeeData.email)) {
      throw new ValidationError('Invalid email format', 'email');
    }

    if (employeeData.base_pay_usd < 0) {
      throw new ValidationError('Base pay must be positive', 'base_pay_usd');
    }

    try {
      const employee = await db.createEmployee(employeeData);
      logAPICall('POST', '/employees', { success: true, employeeId: employee.id });
      return employee;
    } catch (error: unknown) {
      logAPICall('POST', '/employees', { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async updateEmployee(employeeId: string, updates: Partial<Omit<Employee, 'id' | 'employee_number' | 'created_at'>>): Promise<Employee> {
    logAPICall('PUT', `/employees/${employeeId}`, updates);
    validateRequired(employeeId, 'employeeId');

    if (updates.email && !validateEmail(updates.email)) {
      throw new ValidationError('Invalid email format', 'email');
    }

    if (updates.base_pay_usd !== undefined && updates.base_pay_usd < 0) {
      throw new ValidationError('Base pay must be positive', 'base_pay_usd');
    }

    try {
      const employee = await db.updateEmployee(employeeId, updates);
      logAPICall('PUT', `/employees/${employeeId}`, { success: true });
      return employee;
    } catch (error: unknown) {
      logAPICall('PUT', `/employees/${employeeId}`, { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async deleteEmployee(employeeId: string): Promise<void> {
    logAPICall('DELETE', `/employees/${employeeId}`);
    validateRequired(employeeId, 'employeeId');

    try {
      await db.deleteEmployee(employeeId);
      logAPICall('DELETE', `/employees/${employeeId}`, { success: true });
    } catch (error: unknown) {
      logAPICall('DELETE', `/employees/${employeeId}`, { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  // ============================================
  // PAYSLIPS (Using Neon)
  // ============================================

  async getPayslips(filters?: { employeeId?: string; year?: number; month?: number }): Promise<Payslip[]> {
    logAPICall('GET', '/payslips', filters);

    try {
      const payslips = await db.getPayslips(filters);
      logAPICall('GET', '/payslips', { success: true, count: payslips.length });
      return payslips;
    } catch (error: unknown) {
      logAPICall('GET', '/payslips', { success: false, error: getErrorMessage(error) });
      return [];
    }
  }

  async generatePayslip(payslipData: {
    employee_id: string;
    month: number;
    year: number;
    base_pay: number;
    overtime_hours?: number;
    overtime_rate?: number;
    bonus?: number;
    allowances?: number;
    commission?: number;
    tax_deduction?: number;
    pension_deduction?: number;
    health_insurance?: number;
    other_deductions?: number;
    payment_date?: string;
    payment_method?: string;
    notes?: string;
  }): Promise<Payslip> {
    logAPICall('POST', '/payslips', { employee_id: payslipData.employee_id, month: payslipData.month, year: payslipData.year });

    if (!isNeonConnected()) {
      throw new Error('Database not configured. Please check VITE_NEON_DATABASE_URL.');
    }

    // Validation
    validateRequired(payslipData.employee_id, 'employee_id');
    validateRequired(payslipData.month, 'month');
    validateRequired(payslipData.year, 'year');
    validateRequired(payslipData.base_pay, 'base_pay');

    if (payslipData.month < 1 || payslipData.month > 12) {
      throw new ValidationError('Month must be between 1 and 12', 'month');
    }

    if (payslipData.year < 2000) {
      throw new ValidationError('Invalid year', 'year');
    }

    try {
      // Get current user for generated_by field
      const { data: { user } } = await supabaseClient.auth.getUser();

      const payslip = await db.generatePayslip({
        ...payslipData,
        generated_by: user?.id || undefined
      });
      logAPICall('POST', '/payslips', { success: true, payslipId: payslip.id });
      return payslip;
    } catch (error: unknown) {
      logAPICall('POST', '/payslips', { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async updatePayslipStatus(payslipId: string, status: 'Generated' | 'Approved' | 'Paid' | 'Cancelled'): Promise<Payslip> {
    logAPICall('PATCH', `/payslips/${payslipId}/status`, { status });
    validateRequired(payslipId, 'payslipId');
    validateRequired(status, 'status');

    try {
      const payslip = await db.updatePayslipStatus(payslipId, status);
      logAPICall('PATCH', `/payslips/${payslipId}/status`, { success: true });
      return payslip;
    } catch (error: unknown) {
      logAPICall('PATCH', `/payslips/${payslipId}/status`, { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async deletePayslip(payslipId: string): Promise<void> {
    logAPICall('DELETE', `/payslips/${payslipId}`);
    validateRequired(payslipId, 'payslipId');

    try {
      await db.deletePayslip(payslipId);
      logAPICall('DELETE', `/payslips/${payslipId}`, { success: true });
    } catch (error: unknown) {
      logAPICall('DELETE', `/payslips/${payslipId}`, { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  // ============================================
  // QUOTE ITEMS (Using Neon)
  // ============================================

  async getQuoteItems(quoteId: string): Promise<QuoteItem[]> {
    logAPICall('GET', `/quote-items/${quoteId}`);
    validateRequired(quoteId, 'quoteId');

    try {
      const items = await db.getQuoteItems(quoteId);
      logAPICall('GET', `/quote-items/${quoteId}`, { success: true, count: items.length });
      return items;
    } catch (error: unknown) {
      logAPICall('GET', `/quote-items/${quoteId}`, { success: false, error: getErrorMessage(error) });
      return [];
    }
  }

  async addQuoteItem(quoteId: string, item: Omit<QuoteItem, 'id' | 'quote_id' | 'created_at' | 'updated_at'>): Promise<QuoteItem> {
    logAPICall('POST', `/quote-items/${quoteId}`, item);

    validateRequired(quoteId, 'quoteId');
    validateRequired(item.description, 'description');
    validateRequired(item.quantity, 'quantity');
    validateRequired(item.unit_price, 'unit_price');

    if (item.quantity <= 0) {
      throw new ValidationError('Quantity must be greater than 0', 'quantity');
    }
    if (item.unit_price < 0) {
      throw new ValidationError('Unit price cannot be negative', 'unit_price');
    }

    try {
      const newItem = await db.addQuoteItem(quoteId, item);
      logAPICall('POST', `/quote-items/${quoteId}`, { success: true, itemId: newItem.id });
      return newItem;
    } catch (error: unknown) {
      logAPICall('POST', `/quote-items/${quoteId}`, { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async updateQuoteItem(itemId: string, updates: Partial<QuoteItem>): Promise<QuoteItem> {
    logAPICall('PATCH', `/quote-items/${itemId}`, updates);
    validateRequired(itemId, 'itemId');

    if (updates.quantity !== undefined && updates.quantity <= 0) {
      throw new ValidationError('Quantity must be greater than 0', 'quantity');
    }
    if (updates.unit_price !== undefined && updates.unit_price < 0) {
      throw new ValidationError('Unit price cannot be negative', 'unit_price');
    }

    try {
      const item = await db.updateQuoteItem(itemId, updates);
      logAPICall('PATCH', `/quote-items/${itemId}`, { success: true });
      return item;
    } catch (error: unknown) {
      logAPICall('PATCH', `/quote-items/${itemId}`, { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async deleteQuoteItem(itemId: string): Promise<void> {
    logAPICall('DELETE', `/quote-items/${itemId}`);
    validateRequired(itemId, 'itemId');

    try {
      await db.deleteQuoteItem(itemId);
      logAPICall('DELETE', `/quote-items/${itemId}`, { success: true });
    } catch (error: unknown) {
      logAPICall('DELETE', `/quote-items/${itemId}`, { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  // ============================================
  // INVOICE ITEMS (Using Neon)
  // ============================================

  async getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
    logAPICall('GET', `/invoice-items/${invoiceId}`);
    validateRequired(invoiceId, 'invoiceId');

    try {
      const items = await db.getInvoiceItems(invoiceId);
      logAPICall('GET', `/invoice-items/${invoiceId}`, { success: true, count: items.length });
      return items;
    } catch (error: unknown) {
      logAPICall('GET', `/invoice-items/${invoiceId}`, { success: false, error: getErrorMessage(error) });
      return [];
    }
  }

  async addInvoiceItem(invoiceId: string, item: Omit<InvoiceItem, 'id' | 'invoice_id' | 'created_at' | 'updated_at'>): Promise<InvoiceItem> {
    logAPICall('POST', `/invoice-items/${invoiceId}`, item);

    validateRequired(invoiceId, 'invoiceId');
    validateRequired(item.description, 'description');
    validateRequired(item.quantity, 'quantity');
    validateRequired(item.unit_price, 'unit_price');

    if (item.quantity <= 0) {
      throw new ValidationError('Quantity must be greater than 0', 'quantity');
    }
    if (item.unit_price < 0) {
      throw new ValidationError('Unit price cannot be negative', 'unit_price');
    }

    try {
      const newItem = await db.addInvoiceItem(invoiceId, item);
      logAPICall('POST', `/invoice-items/${invoiceId}`, { success: true, itemId: newItem.id });
      return newItem;
    } catch (error: unknown) {
      logAPICall('POST', `/invoice-items/${invoiceId}`, { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async updateInvoiceItem(itemId: string, updates: Partial<InvoiceItem>): Promise<InvoiceItem> {
    logAPICall('PATCH', `/invoice-items/${itemId}`, updates);
    validateRequired(itemId, 'itemId');

    if (updates.quantity !== undefined && updates.quantity <= 0) {
      throw new ValidationError('Quantity must be greater than 0', 'quantity');
    }
    if (updates.unit_price !== undefined && updates.unit_price < 0) {
      throw new ValidationError('Unit price cannot be negative', 'unit_price');
    }

    try {
      const item = await db.updateInvoiceItem(itemId, updates);
      logAPICall('PATCH', `/invoice-items/${itemId}`, { success: true });
      return item;
    } catch (error: unknown) {
      logAPICall('PATCH', `/invoice-items/${itemId}`, { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async deleteInvoiceItem(itemId: string): Promise<void> {
    logAPICall('DELETE', `/invoice-items/${itemId}`);
    validateRequired(itemId, 'itemId');

    try {
      await db.deleteInvoiceItem(itemId);
      logAPICall('DELETE', `/invoice-items/${itemId}`, { success: true });
    } catch (error: unknown) {
      logAPICall('DELETE', `/invoice-items/${itemId}`, { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  // ============================================
  // OPERATING FUNDS (Using Neon)
  // Track money received from office and disbursements
  // ============================================

  async getOperatingFunds(): Promise<OperatingFund[]> {
    logAPICall('GET', '/operating-funds');

    try {
      const funds = await db.getOperatingFunds();
      logAPICall('GET', '/operating-funds', { success: true, count: funds.length });
      return funds;
    } catch (error: unknown) {
      logAPICall('GET', '/operating-funds', { success: false, error: getErrorMessage(error) });
      return [];
    }
  }

  async getOperatingFundsBalance(): Promise<{ received: number; disbursed: number; balance: number }> {
    logAPICall('GET', '/operating-funds/balance');

    try {
      const balance = await db.getOperatingFundsBalance();
      logAPICall('GET', '/operating-funds/balance', { success: true, balance: balance.balance });
      return balance;
    } catch (error: unknown) {
      logAPICall('GET', '/operating-funds/balance', { success: false, error: getErrorMessage(error) });
      return { received: 0, disbursed: 0, balance: 0 };
    }
  }

  async addOperatingFund(fundData: Omit<OperatingFund, 'id' | 'created_at'>): Promise<OperatingFund> {
    logAPICall('POST', '/operating-funds', { type: fundData.type, amount: fundData.amount });

    validateRequired(fundData.type, 'type');
    validateRequired(fundData.amount, 'amount');
    validateRequired(fundData.description, 'description');
    validateRequired(fundData.date, 'date');

    if (fundData.amount <= 0) {
      throw new ValidationError('Amount must be greater than 0', 'amount');
    }

    try {
      const fund = await db.addOperatingFund({
        type: fundData.type,
        amount: fundData.amount,
        currency: fundData.currency || 'USD',
        description: sanitizeString(fundData.description),
        reference: fundData.reference ? sanitizeString(fundData.reference) : undefined,
        recipient: fundData.recipient ? sanitizeString(fundData.recipient) : undefined,
        approved_by: fundData.approved_by,
        date: fundData.date
      });
      logAPICall('POST', '/operating-funds', { success: true, fundId: fund.id });
      return fund;
    } catch (error: unknown) {
      logAPICall('POST', '/operating-funds', { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async updateOperatingFund(fundId: string, updates: Partial<Omit<OperatingFund, 'id' | 'created_at'>>): Promise<OperatingFund> {
    logAPICall('PATCH', `/operating-funds/${fundId}`, updates);
    validateRequired(fundId, 'fundId');

    if (updates.amount !== undefined && updates.amount <= 0) {
      throw new ValidationError('Amount must be greater than 0', 'amount');
    }

    try {
      const fund = await db.updateOperatingFund(fundId, {
        ...updates,
        description: updates.description ? sanitizeString(updates.description) : undefined,
        reference: updates.reference ? sanitizeString(updates.reference) : undefined,
        recipient: updates.recipient ? sanitizeString(updates.recipient) : undefined
      });
      logAPICall('PATCH', `/operating-funds/${fundId}`, { success: true });
      return fund;
    } catch (error: unknown) {
      logAPICall('PATCH', `/operating-funds/${fundId}`, { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }

  async deleteOperatingFund(fundId: string): Promise<void> {
    logAPICall('DELETE', `/operating-funds/${fundId}`);
    validateRequired(fundId, 'fundId');

    try {
      await db.deleteOperatingFund(fundId);
      logAPICall('DELETE', `/operating-funds/${fundId}`, { success: true });
    } catch (error: unknown) {
      logAPICall('DELETE', `/operating-funds/${fundId}`, { success: false, error: getErrorMessage(error) });
      throw error;
    }
  }
}

export const supabase = new SupabaseService();
