/**
 * Frontend API Client
 * 
 * Replaces direct database access with API calls
 * All requests include JWT token for authentication
 */

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
    public data?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

// Base request function
async function apiRequest<T>(
  endpoint: string,
  options: globalThis.RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>,
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
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new APIError(
        data.error || 'API request failed',
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
    throw new APIError(
      error instanceof Error ? error.message : 'Network error',
      0
    );
  }
}

// API Client object
export const api = {
  // Auth
  auth: {
    login: (email: string, password: string) =>
      apiRequest<{ token: string; user: any }>('/auth?action=login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),

    me: () =>
      apiRequest<{ id: string; email: string; role: string }>('/auth?action=me'),
    
    register: (name: string, email: string, password: string, role: string) =>
      apiRequest('/auth?action=register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, role }),
      }),
    
    changePassword: (userId: string, currentPassword: string, newPassword: string) =>
      apiRequest('/auth?action=change-password', {
        method: 'POST',
        body: JSON.stringify({ userId, currentPassword, newPassword }),
      }),
    
    forgotPassword: (email: string) =>
      apiRequest('/auth?action=forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    
    resetPassword: (token: string, newPassword: string) =>
      apiRequest('/auth?action=reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      }),
  },
  
  // Vehicles
  vehicles: {
    list: (params?: { page?: number; limit?: number; sortBy?: string; sortOrder?: string }) =>
      apiRequest<PaginatedResponse<any>>(`/vehicles?${new URLSearchParams(params as Record<string, string>).toString()}`),
    
    get: (id: string) =>
      apiRequest<any>(`/vehicles?id=${id}`),
    
    create: (data: any) =>
      apiRequest<any>('/vehicles', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    
    update: (id: string, data: any) =>
      apiRequest<any>(`/vehicles?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    
    delete: (id: string) =>
      apiRequest<void>(`/vehicles?id=${id}`, {
        method: 'DELETE',
      }),
  },
  
  // Clients
  clients: {
    list: (params?: { page?: number; limit?: number; sortBy?: string; sortOrder?: string }) =>
      apiRequest<PaginatedResponse<any>>(`/clients?${new URLSearchParams(params as Record<string, string>).toString()}`),
    
    get: (id: string) =>
      apiRequest<any>(`/clients?id=${id}`),
    
    create: (data: any) =>
      apiRequest<any>('/clients', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    
    update: (id: string, data: any) =>
      apiRequest<any>(`/clients?id=${id}`, {
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
    list: (params?: { page?: number; limit?: number; sortBy?: string; sortOrder?: string }) =>
      apiRequest<PaginatedResponse<any>>(`/quotes?${new URLSearchParams(params as Record<string, string>).toString()}`),
    
    get: (id: string) =>
      apiRequest<any>(`/quotes?id=${id}`),
    
    create: (data: any) =>
      apiRequest<any>('/quotes', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    
    update: (id: string, data: any) =>
      apiRequest<any>(`/quotes?id=${id}`, {
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
    list: (params?: { page?: number; limit?: number; sortBy?: string; sortOrder?: string }) =>
      apiRequest<PaginatedResponse<any>>(`/invoices?${new URLSearchParams(params as Record<string, string>).toString()}`),
    
    get: (id: string) =>
      apiRequest<any>(`/invoices?id=${id}`),
    
    create: (data: any) =>
      apiRequest<any>('/invoices', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    
    update: (id: string, data: any) =>
      apiRequest<any>(`/invoices?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    
    delete: (id: string) =>
      apiRequest<void>(`/invoices?id=${id}`, {
        method: 'DELETE',
      }),
  },

  payments: {
    list: () => apiRequest<any[]>('/payments'),
    create: (data: any) =>
      apiRequest<any>('/payments', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: any) =>
      apiRequest<any>(`/payments?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      apiRequest<void>(`/payments?id=${id}`, {
        method: 'DELETE',
      }),
    replaceAllocations: (id: string, allocations: any[]) =>
      apiRequest<any[]>(`/payments?action=allocations&id=${id}`, {
        method: 'POST',
        body: JSON.stringify(allocations),
      }),
  },

  receipts: {
    list: () => apiRequest<any[]>('/receipts'),
    create: (data: any) =>
      apiRequest<any>('/receipts', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: any) =>
      apiRequest<any>(`/receipts?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },

  expenses: {
    list: (params?: { page?: number; limit?: number; sortBy?: string; sortOrder?: string; driverName?: string; vehicleId?: string }) =>
      apiRequest<PaginatedResponse<any>>(`/expenses?${new URLSearchParams(params as Record<string, string>).toString()}`),

    create: (data: any) =>
      apiRequest<any>('/expenses', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (id: string, data: any) =>
      apiRequest<any>(`/expenses?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      apiRequest<void>(`/expenses?id=${id}`, {
        method: 'DELETE',
      }),
  },

  trips: {
    list: (params?: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: string;
      status?: string;
      assignedDriverId?: string;
      assignedVehicleId?: string;
      dateFrom?: string;
      dateTo?: string;
      upcomingOnly?: boolean;
    }) =>
      apiRequest<PaginatedResponse<any>>(`/trips?${new URLSearchParams(params as Record<string, string>).toString()}`),

    get: (id: string) =>
      apiRequest<any>(`/trips?id=${id}`),

    create: (data: any) =>
      apiRequest<any>('/trips', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (id: string, data: any) =>
      apiRequest<any>(`/trips?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      apiRequest<void>(`/trips?id=${id}`, {
        method: 'DELETE',
      }),
  },

  company: {
    get: () => apiRequest<any>('/company'),
    update: (data: any) =>
      apiRequest<void>('/company', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },

  users: {
    list: () => apiRequest<any[]>('/users'),
    create: (data: any) =>
      apiRequest<any>('/users', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: any) =>
      apiRequest<any>(`/users?id=${id}`, {
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
    list: () => apiRequest<any[]>('/invites'),
    create: (data: any) =>
      apiRequest<any>('/invites', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    verify: (token: string) =>
      apiRequest<any | null>(`/invites?action=verify&token=${encodeURIComponent(token)}`),
    accept: (token: string, password: string) =>
      apiRequest<{ token: string; user: any }>('/invites?action=accept', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      }),
    resend: (id: string) =>
      apiRequest<any>(`/invites?action=resend&id=${id}`, {
        method: 'POST',
      }),
    delete: (id: string) =>
      apiRequest<void>(`/invites?id=${id}`, {
        method: 'DELETE',
      }),
  },

  registrationRequests: {
    list: () => apiRequest<any[]>('/registration-requests'),
    create: (data: any) =>
      apiRequest<any>('/registration-requests', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    approve: (id: string) =>
      apiRequest<any>(`/registration-requests?action=approve&id=${id}`, {
        method: 'POST',
      }),
    reject: (id: string) =>
      apiRequest<any>(`/registration-requests?action=reject&id=${id}`, {
        method: 'POST',
      }),
  },

  employees: {
    list: () => apiRequest<any[]>('/employees'),
    create: (data: any) =>
      apiRequest<any>('/employees', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: any) =>
      apiRequest<any>(`/employees?id=${id}`, {
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
      apiRequest<any[]>(`/payslips?${new URLSearchParams(params as Record<string, string>).toString()}`),
    create: (data: any) =>
      apiRequest<any>('/payslips', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateStatus: (id: string, status: string) =>
      apiRequest<any>(`/payslips?id=${id}`, {
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
      apiRequest<any[]>(`/operating-funds?${new URLSearchParams(params as Record<string, string>).toString()}`),
    create: (data: any) =>
      apiRequest<any>('/operating-funds', {
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
      apiRequest<any[]>(`/audit-logs?${new URLSearchParams(params as Record<string, string>).toString()}`),
  },
  
  // Generic request for future endpoints
  request: apiRequest,
};

export default api;
