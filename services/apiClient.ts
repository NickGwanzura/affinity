/**
 * Frontend API Client
 *
 * Replaces direct database access with API calls
 * All requests include JWT token for authentication
 *
 * GET requests are transparently cached (default 5 min TTL).
 * POST/PUT/DELETE requests automatically invalidate related cache entries.
 * Pass `cache: false` in options to skip caching for a specific request.
 */

import type {
  AppUser,
  Asset,
  AssetRequest,
  AuditLog,
  Client,
  CompanyDetails,
  Employee,
  Expense,
  Invoice,
  FundDisbursement,
  OperatingFund,
  Payment,
  PaymentAllocation,
  Payslip,
  Quote,
  Receipt,
  RegistrationRequest,
  Shipment,
  Trip,
  UserInvite,
  Vehicle,
} from '../types';
import { cacheGet, cacheSet, cacheRemove, cacheInvalidate, cacheTrackPending } from './cacheStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Token storage
const TOKEN_KEY = 'affinity_auth_token';

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// API Error class
export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'APIError';
  }
}

function toQueryString(
  params?: Record<string, string | number | boolean | null | undefined>
): string {
  if (!params) return '';
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

// Extra options beyond standard RequestInit
interface ApiRequestOptions extends Omit<globalThis.RequestInit, 'cache'> {
  cache?: boolean | number; // false to skip, or TTL in ms
}

// Base request function
async function apiRequest<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const method = (options.method || 'GET').toUpperCase();

  // ── Cache hit (GET only, unless explicitly opted out) ──────────────────
  const isGet = method === 'GET';
  const cacheOpt = options.cache;
  const useCache = isGet && cacheOpt !== false;

  if (useCache) {
    const ttl = typeof cacheOpt === 'number' ? cacheOpt : undefined;
    const cached = cacheGet<T>(url);
    if (cached !== null) return cached;

    // Deduplicate concurrent in-flight requests for the same URL
    const pending = cacheGet<Promise<T>>(`__pending__${url}`);
    if (pending) return pending;

    // We'll store the promise for dedup
  }

  // ── Build headers ──────────────────────────────────────────────────────
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // Add auth token
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Strip custom cache option from the config passed to fetch
  const { cache: _cache, ...fetchOptions } = options;
  const config: globalThis.RequestInit = {
    ...fetchOptions,
    headers,
  };

  try {
    // ── Dedup: store the pending promise ─────────────────────────────────
    let promise: Promise<T>;

    if (isGet) {
      const existingPending = cacheGet<Promise<T>>(`__pending__${url}`);
      if (existingPending) return existingPending;

      promise = doFetch<T>(url, config, useCache);
      cacheSet(`__pending__${url}`, promise);
      // Clean up pending marker when done
      promise.finally(() => cacheRemove(`__pending__${url}`));
    } else {
      promise = doFetch<T>(url, config, useCache);
    }

    const result = await promise;

    // ── Cache the result (GET only) ──────────────────────────────────────
    if (isGet && useCache) {
      const ttl = typeof cacheOpt === 'number' ? cacheOpt : undefined;
      cacheSet(url, result, ttl);
    }

    // ── Invalidate related caches on mutations ──────────────────────────
    if (!isGet) {
      const resourceSegment = endpoint.split('/').filter(Boolean)[0];
      cacheInvalidate(`${API_BASE_URL}/${resourceSegment}`);
    }

    return result;
  } catch (error) {
    if (error instanceof APIError) throw error;
    throw new APIError(error instanceof Error ? error.message : 'Network error', 0);
  }
}

async function doFetch<T>(url: string, config: globalThis.RequestInit, useCache: boolean): Promise<T> {
  const response = await fetch(url, config);

  // Handle 204 No Content
  if (response.status === 204) {
    return null as unknown as T;
  }

  // Get content type to determine how to parse response
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  // Parse response based on content type
  let data: unknown;
  if (isJson) {
    data = await response.json();
  } else {
    const text = await response.text();
    data = { error: text || 'Unknown error' };
  }

  if (!response.ok) {
    const errorPayload = (data ?? {}) as { error?: string };
    throw new APIError(
      errorPayload.error || `HTTP ${response.status}: ${response.statusText}`,
      response.status,
      data
    );
  }

  return data as T;
}

type ListParams = { page?: number; limit?: number; sortBy?: string; sortOrder?: string };

const buildQuery = (
  params?: Record<string, string | number | boolean | null | undefined>
): string => toQueryString(params);

// API Client object
export const api = {
  // Auth
  auth: {
    login: (email: string, password: string) =>
      apiRequest<{
        token: string;
        user: AppUser & { forcePasswordChange?: boolean };
      }>('/auth?action=login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),

    me: () =>
      apiRequest<{
        id: string;
        email: string;
        role: string;
        status?: string;
        accessRole?: 'super_admin' | 'admin' | 'user';
        forcePasswordChange?: boolean;
      }>('/auth?action=me'),

    register: (name: string, email: string, password: string, role: string) =>
      apiRequest<AppUser>('/auth?action=register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, role }),
      }),

    changePassword: (userId: string, currentPassword: string, newPassword: string) =>
      apiRequest<{ success: boolean }>('/auth?action=change-password', {
        method: 'POST',
        body: JSON.stringify({ userId, currentPassword, newPassword }),
      }),

    forgotPassword: (email: string) =>
      apiRequest<{ success: boolean }>('/auth?action=forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),

    resetPassword: (token: string, newPassword: string) =>
      apiRequest<{ success: boolean }>('/auth?action=reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      }),
  },

  // Vehicles
  vehicles: {
    list: (params?: ListParams): Promise<PaginatedResponse<Vehicle>> =>
      apiRequest<PaginatedResponse<Vehicle>>(`/vehicles${buildQuery(params)}`),

    get: (id: string) => apiRequest<Vehicle>(`/vehicles?id=${id}`),

    create: (data: Partial<Vehicle>) =>
      apiRequest<Vehicle>('/vehicles', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (id: string, data: Partial<Vehicle>) =>
      apiRequest<Vehicle>(`/vehicles?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      apiRequest<void>(`/vehicles?id=${id}`, {
        method: 'DELETE',
      }),
  },

  // Shipments
  shipments: {
    list: (params?: ListParams): Promise<PaginatedResponse<Shipment>> =>
      apiRequest<PaginatedResponse<Shipment>>(
        `/vehicles?type=shipment${params ? `&${new URLSearchParams(params as Record<string, string>).toString()}` : ''}`
      ),

    get: (id: string) => apiRequest<Shipment>(`/vehicles?type=shipment&id=${id}`),

    create: (data: Partial<Shipment>) =>
      apiRequest<Shipment>('/vehicles?type=shipment', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (id: string, data: Partial<Shipment>) =>
      apiRequest<Shipment>(`/vehicles?type=shipment&id=${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      apiRequest<void>(`/vehicles?type=shipment&id=${id}`, {
        method: 'DELETE',
      }),
  },

  // Clients
  clients: {
    list: (params?: ListParams): Promise<PaginatedResponse<Client>> =>
      apiRequest<PaginatedResponse<Client>>(`/clients${buildQuery(params)}`),

    get: (id: string) => apiRequest<Client>(`/clients?id=${id}`),

    create: (data: Partial<Client>) =>
      apiRequest<Client>('/clients', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (id: string, data: Partial<Client>) =>
      apiRequest<Client>(`/clients?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      apiRequest<void>(`/clients?id=${id}`, {
        method: 'DELETE',
      }),
  },

  // Quotes
  quotes: {
    list: (params?: ListParams): Promise<PaginatedResponse<Quote>> =>
      apiRequest<PaginatedResponse<Quote>>(`/quotes${buildQuery(params)}`),

    get: (id: string) => apiRequest<Quote>(`/quotes?id=${id}`),

    create: (data: Partial<Quote>) =>
      apiRequest<Quote>('/quotes', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (id: string, data: Partial<Quote>) =>
      apiRequest<Quote>(`/quotes?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      apiRequest<void>(`/quotes?id=${id}`, {
        method: 'DELETE',
      }),
  },

  // Invoices
  invoices: {
    list: (params?: ListParams): Promise<PaginatedResponse<Invoice>> =>
      apiRequest<PaginatedResponse<Invoice>>(`/invoices${buildQuery(params)}`),

    get: (id: string) => apiRequest<Invoice>(`/invoices?id=${id}`),

    create: (data: Partial<Invoice>) =>
      apiRequest<Invoice>('/invoices', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (id: string, data: Partial<Invoice>) =>
      apiRequest<Invoice>(`/invoices?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      apiRequest<void>(`/invoices?id=${id}`, {
        method: 'DELETE',
      }),
  },

  payments: {
    list: (params?: ListParams): Promise<PaginatedResponse<Payment>> =>
      apiRequest<PaginatedResponse<Payment>>(`/payments${buildQuery(params)}`),
    create: (
      data: Omit<Partial<Payment>, 'allocations'> & {
        allocations?: Array<{
          invoice_id?: string;
          amount_allocated: number;
          currency: 'USD' | 'GBP';
          status?: 'allocated' | 'unallocated' | 'credit';
        }>;
      }
    ) =>
      apiRequest<Payment>('/payments', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (
      id: string,
      data: Omit<Partial<Payment>, 'allocations'> & {
        allocations?: Array<{
          invoice_id?: string;
          amount_allocated: number;
          currency: 'USD' | 'GBP';
          status?: 'allocated' | 'unallocated' | 'credit';
        }>;
      }
    ) =>
      apiRequest<Payment>(`/payments?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      apiRequest<void>(`/payments?id=${id}`, {
        method: 'DELETE',
      }),
    replaceAllocations: (
      id: string,
      allocations: Array<{
        invoice_id?: string;
        amount_allocated: number;
        currency: 'USD' | 'GBP';
        status?: string;
      }>
    ) =>
      apiRequest<PaymentAllocation[]>(`/payments?action=allocations&id=${id}`, {
        method: 'POST',
        body: JSON.stringify(allocations),
      }),
  },

  receipts: {
    list: (params?: ListParams): Promise<PaginatedResponse<Receipt>> =>
      apiRequest<PaginatedResponse<Receipt>>(`/receipts${buildQuery(params)}`),
    create: (data: Partial<Receipt>) =>
      apiRequest<Receipt>('/receipts', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Receipt>) =>
      apiRequest<Receipt>(`/receipts?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      apiRequest<void>(`/receipts?id=${id}`, {
        method: 'DELETE',
      }),
  },

  expenses: {
    list: (params?: ListParams & { driverName?: string; vehicleId?: string }): Promise<
      PaginatedResponse<Expense>
    > => apiRequest<PaginatedResponse<Expense>>(`/expenses${buildQuery(params)}`),

    create: (data: Partial<Expense>) =>
      apiRequest<Expense>('/expenses', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (id: string, data: Partial<Expense>) =>
      apiRequest<Expense>(`/expenses?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      apiRequest<void>(`/expenses?id=${id}`, {
        method: 'DELETE',
      }),
  },

  trips: {
    list: (
      params?: ListParams & {
        status?: string;
        assignedDriverId?: string;
        assignedVehicleId?: string;
        dateFrom?: string;
        dateTo?: string;
        upcomingOnly?: boolean;
      }
    ): Promise<PaginatedResponse<Trip>> =>
      apiRequest<PaginatedResponse<Trip>>(`/trips${buildQuery(params)}`),

    get: (id: string) => apiRequest<Trip>(`/trips?id=${id}`),

    create: (data: Partial<Trip>) =>
      apiRequest<Trip>('/trips', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (id: string, data: Partial<Trip>) =>
      apiRequest<Trip>(`/trips?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      apiRequest<void>(`/trips?id=${id}`, {
        method: 'DELETE',
      }),
  },

  company: {
    get: () => apiRequest<CompanyDetails | null>('/company'),
    update: (data: CompanyDetails) =>
      apiRequest<void>('/company', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },

  users: {
    list: () => apiRequest<AppUser[]>('/users'),
    create: (data: {
      name: string;
      email: string;
      password?: string;
      role?: AppUser['role'] | string;
      status?: AppUser['status'];
    }) =>
      apiRequest<AppUser>('/users', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<AppUser>) =>
      apiRequest<AppUser>(`/users?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      apiRequest<void>(`/users?id=${id}`, {
        method: 'DELETE',
      }),
    setPassword: (id: string, newPassword: string) =>
      apiRequest<void>('/users?action=set-password', {
        method: 'POST',
        body: JSON.stringify({ id, newPassword }),
      }),
  },

  invites: {
    list: () => apiRequest<UserInvite[]>('/invites'),
    create: (data: { email: string; role: AppUser['role']; name: string; invitedBy?: string }) =>
      apiRequest<UserInvite>('/invites', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    verify: (token: string) =>
      apiRequest<UserInvite | null>(`/invites?action=verify&token=${encodeURIComponent(token)}`),
    accept: (token: string, password: string) =>
      apiRequest<{ token: string; user: AppUser }>('/invites?action=accept', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      }),
    resend: (id: string) =>
      apiRequest<UserInvite>(`/invites?action=resend&id=${id}`, {
        method: 'POST',
      }),
    delete: (id: string) =>
      apiRequest<void>(`/invites?id=${id}`, {
        method: 'DELETE',
      }),
  },

  registrationRequests: {
    list: () => apiRequest<RegistrationRequest[]>('/registration-requests'),
    create: (data: { name: string; email: string; role: RegistrationRequest['role'] }) =>
      apiRequest<RegistrationRequest>('/registration-requests', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    approve: (id: string) =>
      apiRequest<RegistrationRequest>(`/registration-requests?action=approve&id=${id}`, {
        method: 'POST',
      }),
    reject: (id: string) =>
      apiRequest<RegistrationRequest>(`/registration-requests?action=reject&id=${id}`, {
        method: 'POST',
      }),
  },

  admin: {
    metrics: () => apiRequest<Record<string, unknown>>('/admin/metrics'),
    system: () => apiRequest<Record<string, unknown>>('/admin/system'),
    logs: (params?: { limit?: number; action?: string }) =>
      apiRequest<AuditLog[]>(`/admin/logs${toQueryString(params)}`),
    users: {
      list: (params?: { status?: string }) =>
        apiRequest<AppUser[]>(`/admin/users${toQueryString(params)}`),
      update: (id: string, data: Partial<AppUser>) =>
        apiRequest<AppUser>(`/admin/users?id=${id}`, {
          method: 'PATCH',
          body: JSON.stringify(data),
        }),
    },
    approvals: {
      list: () => apiRequest<unknown>('/admin/approvals'),
      approve: (id: string) =>
        apiRequest<AppUser>(`/admin/approvals?id=${id}&action=approve`, {
          method: 'PATCH',
        }),
      reject: (id: string) =>
        apiRequest<AppUser>(`/admin/approvals?id=${id}&action=reject`, {
          method: 'PATCH',
        }),
    },
    submissions: {
      list: (params?: {
        status?: string;
        type?: 'all' | 'registration_request' | 'questionnaire_submission';
      }) => apiRequest<unknown>(`/admin/submissions${toQueryString(params)}`),
    },
  },

  employees: {
    list: (params?: ListParams): Promise<PaginatedResponse<Employee>> =>
      apiRequest<PaginatedResponse<Employee>>(`/employees${buildQuery(params)}`),
    create: (data: Partial<Employee>) =>
      apiRequest<Employee>('/employees', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Employee>) =>
      apiRequest<Employee>(`/employees?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      apiRequest<void>(`/employees?id=${id}`, {
        method: 'DELETE',
      }),
  },

  payslips: {
    list: (params?: { employeeId?: string; year?: number; month?: number }) =>
      apiRequest<Payslip[]>(`/payslips${toQueryString(params)}`),
    create: (data: unknown) =>
      apiRequest<Payslip>('/payslips', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateStatus: (id: string, status: string) =>
      apiRequest<Payslip>(`/payslips?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }),
    delete: (id: string) =>
      apiRequest<void>(`/payslips?id=${id}`, {
        method: 'DELETE',
      }),
  },

  operatingFunds: {
    list: (params?: { recipient?: string }) =>
      apiRequest<OperatingFund[]>(`/operating-funds${toQueryString(params)}`),
    create: (data: Partial<OperatingFund>) =>
      apiRequest<OperatingFund>('/operating-funds', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      apiRequest<void>(`/operating-funds?id=${id}`, {
        method: 'DELETE',
      }),
  },

  auditLogs: {
    list: (params?: { limit?: number }) =>
      apiRequest<AuditLog[]>(`/audit-logs${toQueryString(params)}`),
  },

  // Client Financials - Unified Balance & Ledger
  clientFinancials: {
    getBalance: (clientId: string) =>
      apiRequest<{
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
      }>(`/client-financials?resource=balance&clientId=${clientId}`),

    getLedger: (clientId: string, params?: { from?: string; to?: string }) =>
      apiRequest<{
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
      }>(
        `/client-financials?resource=ledger&clientId=${clientId}${
          params ? `&${new URLSearchParams(params as Record<string, string>).toString()}` : ''
        }`
      ),

    getAllBalances: (params?: { hasOutstanding?: boolean; minBalance?: number; search?: string }) =>
      apiRequest<{
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
      }>(`/client-financials?resource=all-balances${params ? `&${new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([,v]) => v != null && v !== '').map(([k,v]) => [k, String(v)]))).toString()}` : ''}`),

    recalculateBalance: (clientId: string) =>
      apiRequest<{
        message: string;
        client_id: string;
        balance: {
          opening_balance: number;
          total_invoiced: number;
          total_paid: number;
          current_balance: number;
          credit_balance: number;
          currency: 'USD' | 'GBP';
        };
        formula_applied: string;
        timestamp: string;
      }>(`/client-financials?resource=recalculate&clientId=${clientId}`, {
        method: 'POST',
      }),
  },

  // Assets
  assets: {
    list: () => apiRequest<Asset[]>('/assets'),
    get: (id: string) => apiRequest<Asset>(`/assets?id=${id}`),
    create: (data: Partial<Asset>) =>
      apiRequest<Asset>('/assets', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Asset>) =>
      apiRequest<Asset>(`/assets?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      apiRequest<void>(`/assets?id=${id}`, {
        method: 'DELETE',
      }),
    requests: {
      list: () => apiRequest<AssetRequest[]>('/assets/requests'),
      create: (data: Partial<AssetRequest>) =>
        apiRequest<AssetRequest>('/assets/requests', {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      update: (id: string, data: Partial<AssetRequest>) =>
        apiRequest<AssetRequest>(`/assets/requests?id=${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        }),
      delete: (id: string) =>
        apiRequest<void>(`/assets/requests?id=${id}`, {
          method: 'DELETE',
        }),
    },
  },

  // Generic request for future endpoints
  request: apiRequest,

  // ── Secondary business modules (resource-based) ────────────────────────

  carHire: {
    stats:       () => apiRequest<Record<string, unknown>>('/car-hire?resource=stats'),
    vehicles:    () => apiRequest<unknown[]>('/car-hire?resource=vehicles'),
    bookings:    () => apiRequest<unknown[]>('/car-hire?resource=bookings'),
    expenses:    () => apiRequest<unknown[]>('/car-hire?resource=expenses'),
    monthly:     () => apiRequest<unknown[]>('/car-hire?resource=monthly'),
    createBooking:  (data: unknown) => apiRequest<unknown>('/car-hire?resource=bookings', { method: 'POST', body: JSON.stringify(data) }),
    createVehicle:  (data: unknown) => apiRequest<unknown>('/car-hire?resource=vehicles', { method: 'POST', body: JSON.stringify(data) }),
    updateBooking:  (id: string, data: unknown) => apiRequest<unknown>(`/car-hire?resource=bookings&id=${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteBooking:  (id: string) => apiRequest<void>(`/car-hire?resource=bookings&id=${id}`, { method: 'DELETE' }),
    deleteVehicle:  (id: string) => apiRequest<void>(`/car-hire?resource=vehicles&id=${id}`, { method: 'DELETE' }),
  },

  freezit: {
    stock:     () => apiRequest<unknown[]>('/freezit?resource=stock'),
    sales:     () => apiRequest<unknown[]>('/freezit?resource=sales'),
    stats:     () => apiRequest<Record<string, unknown>>('/freezit?resource=stats'),
    createSale:   (data: unknown) => apiRequest<unknown>('/freezit?resource=sales', { method: 'POST', body: JSON.stringify(data) }),
    createStock:  (data: unknown) => apiRequest<unknown>('/freezit?resource=stock', { method: 'POST', body: JSON.stringify(data) }),
  },

  wifiTokens: {
    sales:  () => apiRequest<unknown[]>('/wifi-tokens?resource=sales'),
    costs:  () => apiRequest<unknown[]>('/wifi-tokens?resource=costs'),
    stats:  () => apiRequest<Record<string, unknown>>('/wifi-tokens?resource=stats'),
    createSale: (data: unknown) => apiRequest<unknown>('/wifi-tokens?resource=sales', { method: 'POST', body: JSON.stringify(data) }),
    createCost: (data: unknown) => apiRequest<unknown>('/wifi-tokens?resource=costs', { method: 'POST', body: JSON.stringify(data) }),
  },

  iceSales: {
    sales: () => apiRequest<unknown[]>('/ice-sales?resource=sales'),
    stats: () => apiRequest<Record<string, unknown>>('/ice-sales?resource=stats'),
    createSale: (data: unknown) => apiRequest<unknown>('/ice-sales?resource=sales', { method: 'POST', body: JSON.stringify(data) }),
  },

  lodgers: {
    list:     () => apiRequest<unknown[]>('/lodgers?resource=lodgers'),
    payments: () => apiRequest<unknown[]>('/lodgers?resource=payments'),
    stats:    () => apiRequest<Record<string, unknown>>('/lodgers?resource=stats'),
    createLodger: (data: unknown) => apiRequest<unknown>('/lodgers?resource=lodgers', { method: 'POST', body: JSON.stringify(data) }),
    createPayment: (data: unknown) => apiRequest<unknown>('/lodgers?resource=payments', { method: 'POST', body: JSON.stringify(data) }),
    update:     (id: string, data: unknown) => apiRequest<unknown>(`/lodgers?resource=lodgers&id=${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deletePayment: (id: string) => apiRequest<void>(`/lodgers?resource=payments&id=${id}`, { method: 'DELETE' }),
  },

  rentals: {
    units:    () => apiRequest<unknown[]>('/rentals?resource=units'),
    tenants:  () => apiRequest<unknown[]>('/rentals?resource=tenants'),
    payments: () => apiRequest<unknown[]>('/rentals?resource=payments'),
    stats:    () => apiRequest<Record<string, unknown>>('/rentals?resource=stats'),
    createUnit:    (data: unknown) => apiRequest<unknown>('/rentals?resource=units', { method: 'POST', body: JSON.stringify(data) }),
    createTenant:  (data: unknown) => apiRequest<unknown>('/rentals?resource=tenants', { method: 'POST', body: JSON.stringify(data) }),
    createPayment: (data: unknown) => apiRequest<unknown>('/rentals?resource=payments', { method: 'POST', body: JSON.stringify(data) }),
  },

  debtorsCreditors: {
    stats:      () => apiRequest<Record<string, unknown>>('/debtors-creditors?resource=stats'),
    debtors:    () => apiRequest<unknown[]>('/debtors-creditors?resource=debtors'),
    creditors:  () => apiRequest<unknown[]>('/debtors-creditors?resource=creditors'),
    createDebtor:  (data: unknown) => apiRequest<unknown>('/debtors-creditors?resource=debtors', { method: 'POST', body: JSON.stringify(data) }),
    createCreditor:(data: unknown) => apiRequest<unknown>('/debtors-creditors?resource=creditors', { method: 'POST', body: JSON.stringify(data) }),
    createDebtorPayment: (data: unknown) => apiRequest<unknown>('/debtors-creditors?resource=debtor-payment', { method: 'POST', body: JSON.stringify(data) }),
    createCreditorPayment: (data: unknown) => apiRequest<unknown>('/debtors-creditors?resource=creditor-payment', { method: 'POST', body: JSON.stringify(data) }),
  },

  director: {
    transactions: () => apiRequest<unknown[]>('/director?resource=transactions'),
    sales:        () => apiRequest<unknown[]>('/director?resource=sales'),
    stats:        () => apiRequest<Record<string, unknown>>('/director?resource=stats'),
    createTransaction: (data: unknown) => apiRequest<unknown>('/director?resource=transactions', { method: 'POST', body: JSON.stringify(data) }),
  },

  cashHandovers: {
    my:      () => apiRequest<unknown[]>('/cash-handovers?resource=my'),
    pending: () => apiRequest<unknown[]>('/cash-handovers?resource=pending'),
    all:     () => apiRequest<unknown[]>('/cash-handovers?resource=all'),
    create:  (data: unknown) => apiRequest<unknown>('/cash-handovers?resource=my', { method: 'POST', body: JSON.stringify(data) }),
    confirm: (id: string) => apiRequest<unknown>(`/cash-handovers?resource=pending&id=${id}`, { method: 'POST' }),
  },

  fundDisbursements: {
    overview: () => apiRequest<Record<string, unknown>>('/fund-disbursements?resource=overview'),
    all:      () => apiRequest<FundDisbursement[]>('/fund-disbursements?resource=all'),
    users:    () => apiRequest<unknown[]>('/fund-disbursements?resource=users'),
    disburse: (data: unknown) => apiRequest<unknown>('/fund-disbursements?resource=disburse', { method: 'POST', body: JSON.stringify(data) }),
    usageLog: (data: unknown) => apiRequest<unknown>('/fund-disbursements?resource=usage', { method: 'POST', body: JSON.stringify(data) }),
  },

  goodsPickup: {
    requests: (params?: { status?: string; dateFrom?: string; dateTo?: string }) =>
      apiRequest<unknown[]>(`/goods-pickup?resource=requests${params ? '&' + new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([,v]) => v != null).map(([k,v]) => [k, String(v)]))).toString() : ''}`),
    stats: () => apiRequest<unknown>('/goods-pickup?resource=stats'),
    createRequest: (data: unknown) =>
      apiRequest<unknown>('/goods-pickup?resource=requests', { method: 'POST', body: JSON.stringify(data) }),
    updateRequest: (id: string, data: unknown) =>
      apiRequest<unknown>(`/goods-pickup?resource=requests&id=${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteRequest: (id: string) =>
      apiRequest<void>(`/goods-pickup?resource=requests&id=${id}`, { method: 'DELETE' }),
    items: (requestId: string) =>
      apiRequest<unknown[]>(`/goods-pickup?resource=items&requestId=${requestId}`),
    createItem: (requestId: string, data: unknown) =>
      apiRequest<unknown>(`/goods-pickup?resource=items&requestId=${requestId}`, { method: 'POST', body: JSON.stringify(data) }),
    deleteItem: (id: string) =>
      apiRequest<void>(`/goods-pickup?resource=items&id=${id}`, { method: 'DELETE' }),
  },
};

export default api;
