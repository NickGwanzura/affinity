
export type Currency = 'GBP' | 'NAD' | 'USD' | 'BWP';
export type VehicleStatus = 'UK' | 'Namibia' | 'Zimbabwe' | 'Botswana' | 'Sold';
export type ExpenseCategory = 'Shipping' | 'Fuel' | 'Tolls' | 'Duty' | 'Food' | 'Repairs' | 'Driver Disbursement' | 'Other';
export type UserRole = 'Admin' | 'Driver' | 'Manager' | 'Accountant';
export type FinancialStatus = 'Draft' | 'Sent' | 'Paid' | 'Overdue' | 'Cancelled';

export interface Vehicle {
  id: string;
  vin_number: string;
  make_model: string;
  purchase_price_gbp: number;
  status: VehicleStatus;
  created_at: string;
}

export interface Expense {
  id: string;
  vehicle_id?: string;
  description: string;
  amount: number;
  currency: Currency;
  exchange_rate_to_usd: number;
  category: ExpenseCategory;
  location: VehicleStatus;
  receipt_url?: string;
  driver_name?: string; // For driver disbursements - e.g., "David", "Boulton"
  trip_reference?: string; // Optional trip reference for tracking
  created_at: string;
}

export interface LandedCostSummary {
  vehicle_id: string;
  vin_number: string;
  make_model: string;
  purchase_price_gbp: number;
  total_expenses_usd: number;
  total_landed_cost_usd: number;
  status: VehicleStatus;
}

export interface CompanyDetails {
  name: string;
  registration_no: string;
  tax_id: string;
  address: string;
  contact_email: string;
  logo_url?: string;
  phone?: string;
  website?: string;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'Active' | 'Inactive';
}

export interface AuthSession {
  user: AppUser;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  company?: string;
  notes?: string;
  created_at: string;
}

export interface LineItem {
  id?: string; // Optional for new items
  line_number?: number; // For ordering
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  tax_rate?: number;
  tax_amount?: number;
  notes?: string;
}

export interface QuoteItem extends LineItem {
  quote_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface InvoiceItem extends LineItem {
  invoice_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Quote {
  id: string;
  vehicle_id?: string;
  client_id?: string;
  client_name: string;
  client_email?: string;
  client_address?: string;
  amount_usd: number;
  currency?: 'USD' | 'GBP';
  status: FinancialStatus;
  quote_number: string;
  description?: string;
  valid_until?: string;
  items?: QuoteItem[]; // Line items from quote_items table
  created_at: string;
}

export interface Invoice {
  id: string;
  quote_id?: string;
  invoice_number: string;
  vehicle_id?: string;
  client_id?: string;
  client_name: string;
  client_email?: string;
  client_address?: string;
  amount_usd: number;
  currency?: 'USD' | 'GBP';
  status: FinancialStatus;
  description?: string;
  notes?: string;
  terms_and_conditions?: string;
  due_date: string;
  items?: InvoiceItem[]; // Line items from invoice_items table
  created_at: string;
}

export interface Payment {
  id: string;
  reference_id: string; // Linked to Invoice or Expense
  type: 'Inbound' | 'Outbound';
  amount_usd: number;
  method: string;
  date: string;
}

export interface Receipt {
  id: string;
  receipt_number: string;
  invoice_id?: string;
  payment_id?: string;
  client_name: string;
  client_email?: string;
  client_address?: string;
  amount_received: number;
  currency: 'USD' | 'GBP';
  payment_method: string;
  payment_date: string;
  reference_number?: string;
  notes?: string;
  created_at: string;
}

export interface UserInvite {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  status: 'Pending' | 'Accepted' | 'Expired';
  invitedBy: string;
  inviteToken: string;
  expiresAt: string;
  createdAt: string;
}

export interface RegistrationRequest {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'Pending' | 'Approved' | 'Rejected';
  requested_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConnected: boolean;
}

export interface Employee {
  id: string;
  employee_number: string;
  name: string;
  email: string;
  phone?: string;
  department?: string;
  position: string;
  base_pay_usd: number;
  currency: 'USD' | 'NAD' | 'GBP' | 'BWP';
  employment_type: 'Full-time' | 'Part-time' | 'Contract' | 'Intern';
  date_hired: string;
  status: 'Active' | 'On Leave' | 'Terminated';
  national_id?: string;
  bank_account?: string;
  bank_name?: string;
  tax_number?: string;
  created_at: string;
  updated_at?: string;
}

// Operating Funds - Track money received from office and disbursements
export type OperatingFundType = 'Received' | 'Disbursed';

export interface OperatingFund {
  id: string;
  type: OperatingFundType;
  amount: number;
  currency: Currency;
  description: string;
  reference?: string; // e.g., "Office Transfer #123" or "David - Harare Trip"
  recipient?: string; // For disbursements - driver name or purpose
  approved_by?: string;
  date: string;
  created_at: string;
}

export interface Payslip {
  id: string;
  payslip_number: string;
  employee_id: string;
  month: number;
  year: number;
  
  // Earnings
  base_pay: number;
  overtime_hours?: number;
  overtime_rate?: number;
  overtime_pay?: number;
  bonus?: number;
  allowances?: number;
  commission?: number;
  
  // Deductions
  tax_deduction?: number;
  pension_deduction?: number;
  health_insurance?: number;
  other_deductions?: number;
  
  // Totals
  gross_pay: number;
  total_deductions: number;
  net_pay: number;
  
  currency: 'USD' | 'NAD' | 'GBP' | 'BWP';
  payment_date?: string;
  payment_method?: 'Bank Transfer' | 'Cash' | 'Cheque' | 'Mobile Money';
  status: 'Generated' | 'Approved' | 'Paid' | 'Cancelled';
  notes?: string;
  
  generated_by?: string;
  created_at: string;
  updated_at?: string;
  
  // Populated fields
  employee?: Employee;
}
