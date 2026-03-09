// ============================================
// Affinity Logistics CRM - Constants
// ============================================

// User Roles
export const USER_ROLES = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  DRIVER: 'Driver',
  ACCOUNTANT: 'Accountant',
} as const;

export type UserRoleValue = typeof USER_ROLES[keyof typeof USER_ROLES];

// User Status
export const USER_STATUS = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
} as const;

// Vehicle Status
export const VEHICLE_STATUS = {
  UK: 'UK',
  NAMIBIA: 'Namibia',
  ZIMBABWE: 'Zimbabwe',
  BOTSWANA: 'Botswana',
  SOLD: 'Sold',
} as const;

export type VehicleStatusValue = typeof VEHICLE_STATUS[keyof typeof VEHICLE_STATUS];

// Expense Categories
export const EXPENSE_CATEGORIES = {
  SHIPPING: 'Shipping',
  FUEL: 'Fuel',
  TOLLS: 'Tolls',
  DUTY: 'Duty',
  FOOD: 'Food',
  REPAIRS: 'Repairs',
  DRIVER_DISBURSEMENT: 'Driver Disbursement',
  OTHER: 'Other',
} as const;

export type ExpenseCategoryValue = typeof EXPENSE_CATEGORIES[keyof typeof EXPENSE_CATEGORIES];

// Currencies
export const CURRENCIES = {
  GBP: 'GBP',
  NAD: 'NAD',
  USD: 'USD',
} as const;

export type CurrencyValue = typeof CURRENCIES[keyof typeof CURRENCIES];

// Financial Status
export const FINANCIAL_STATUS = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
  CANCELLED: 'Cancelled',
} as const;

export type FinancialStatusValue = typeof FINANCIAL_STATUS[keyof typeof FINANCIAL_STATUS];

// Invite Status
export const INVITE_STATUS = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  EXPIRED: 'Expired',
} as const;

// Registration Request Status
export const REGISTRATION_STATUS = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
} as const;

// Employment Types
export const EMPLOYMENT_TYPES = {
  FULL_TIME: 'Full-time',
  PART_TIME: 'Part-time',
  CONTRACT: 'Contract',
  INTERN: 'Intern',
} as const;

// Employee Status
export const EMPLOYEE_STATUS = {
  ACTIVE: 'Active',
  ON_LEAVE: 'On Leave',
  TERMINATED: 'Terminated',
} as const;

// Operating Fund Types
export const OPERATING_FUND_TYPES = {
  RECEIVED: 'Received',
  DISBURSED: 'Disbursed',
} as const;

// Payment Methods
export const PAYMENT_METHODS = {
  BANK_TRANSFER: 'Bank Transfer',
  CASH: 'Cash',
  CHEQUE: 'Cheque',
  MOBILE_MONEY: 'Mobile Money',
} as const;

// Payslip Status
export const PAYSLIP_STATUS = {
  GENERATED: 'Generated',
  APPROVED: 'Approved',
  PAID: 'Paid',
  CANCELLED: 'Cancelled',
} as const;

// Payment Types
export const PAYMENT_TYPES = {
  INBOUND: 'Inbound',
  OUTBOUND: 'Outbound',
} as const;

// Exchange Rates
export const EXCHANGE_RATES = {
  GBP: 1.27, // 1 GBP = 1.27 USD
  NAD: 0.055, // 1 NAD = 0.055 USD
  USD: 1.0,
} as const;

// App Views
export const APP_VIEWS = {
  ADMIN: 'admin',
  DRIVER: 'driver',
  ACCOUNTANT: 'accountant',
  SETTINGS: 'settings',
  FINANCIALS: 'financials',
  DOCUMENTS: 'documents',
} as const;

export type AppViewValue = typeof APP_VIEWS[keyof typeof APP_VIEWS];

// Validation Constants
export const VALIDATION = {
  MIN_PASSWORD_LENGTH: 8,
  MAX_FILE_SIZE_MB: 5,
  INVITE_EXPIRY_DAYS: 7,
  DEFAULT_PAGE_SIZE: 20,
} as const;

// API Error Messages
export const ERROR_MESSAGES = {
  INVALID_EMAIL: 'Invalid email format',
  INVALID_PASSWORD: 'Password must be at least 8 characters',
  REQUIRED_FIELD: (field: string) => `${field} is required`,
  UNAUTHORIZED: 'Unauthorized access',
  NOT_FOUND: (resource: string) => `${resource} not found`,
  SERVER_ERROR: 'An unexpected error occurred. Please try again.',
} as const;

// Table Names (for database operations)
export const TABLES = {
  COMPANY_DETAILS: 'company_details',
  VEHICLES: 'vehicles',
  EXPENSES: 'expenses',
  USERS: 'users',
  INVITES: 'invites',
  REGISTRATION_REQUESTS: 'registration_requests',
  QUOTES: 'quotes',
  QUOTE_ITEMS: 'quote_items',
  INVOICES: 'invoices',
  INVOICE_ITEMS: 'invoice_items',
  CLIENTS: 'clients',
  PAYMENTS: 'payments',
  EMPLOYEES: 'employees',
  PAYSLIPS: 'payslips',
  OPERATING_FUNDS: 'operating_funds',
} as const;
