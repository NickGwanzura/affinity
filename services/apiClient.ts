/**
 * Frontend API Client
 *
 * Replaces direct database access with API calls
 * All requests include JWT token for authentication
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

// Base request function
async function apiRequest<T>(endpoint: string, options: globalThis.RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // Add auth token
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config: globalThis.RequestInit = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, config);

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
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
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }

    // Network or other errors
    throw new APIError(error instanceof Error ? error.message : 'Network error', 0);
  }
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
    list: () => apiRequest<Payment[]>('/payments'),
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
    list: () => apiRequest<Receipt[]>('/receipts'),
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
    list: () => apiRequest<Employee[]>('/employees'),
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
      }>(`/client-financials?action=balance&clientId=${clientId}`),

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
        `/client-financials?action=ledger&clientId=${clientId}${
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
      }>(`/client-financials?action=all-balances${toQueryString(params)}`),

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
      }>(`/client-financials?action=recalculate&clientId=${clientId}`, {
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
};

export default api;
