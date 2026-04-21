export type Currency = 'GBP' | 'NAD' | 'USD' | 'BWP' | 'ZAR';
export type VehicleStatus = 'UK' | 'Namibia' | 'Zimbabwe' | 'Botswana' | 'Sold';
export type VehiclePurpose = 'Resale' | 'Client';
export type ShipmentStatus = 'Pending' | 'In Transit' | 'Delivered' | 'Cancelled';
export type ExpenseCategory =
  | 'Shipping'
  | 'Fuel'
  | 'Tolls'
  | 'Duty'
  | 'Food'
  | 'Repairs'
  | 'Driver Disbursement'
  | 'Other';
export type UserRole = 'Admin' | 'Driver' | 'Manager' | 'Accountant';
export type AccessRole = 'super_admin' | 'admin' | 'user';
export type QuoteStatus = 'Draft' | 'Sent' | 'Accepted' | 'Rejected';
export type InvoiceStatus = 'Draft' | 'Sent' | 'Paid' | 'Overdue' | 'Cancelled';
export type TripStatus =
  | 'Planned'
  | 'Assigned'
  | 'In Transit'
  | 'Delayed'
  | 'Completed'
  | 'Cancelled';

export interface Vehicle {
  id: string;
  vin_number: string;
  reg_number: string;
  make_model: string;
  purchase_price_gbp: number;
  status: VehicleStatus;
  purpose: VehiclePurpose;
  client_id?: string;
  cbca_applied: boolean;
  created_at: string;
}

export interface Shipment {
  id: string;
  client_id: string;
  vehicle_id?: string;
  description: string;
  origin: string;
  destination: string;
  status: ShipmentStatus;
  shipping_date?: string;
  delivery_date?: string;
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
  accessRole?: AccessRole;
  status: 'Active' | 'Inactive' | 'Pending';
}

export interface AuthSession {
  user: AppUser;
  token?: string;
  forcePasswordChange?: boolean;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  company?: string;
  notes?: string;
  opening_balance?: number;
  opening_balance_currency?: 'USD' | 'GBP';
  is_active?: boolean;
  created_at: string;
  updated_at?: string;
  deleted_at?: string | null;
}

// Unified client balance - Single source of truth
export interface ClientBalance {
  current_balance: number;
  total_invoiced: number;
  total_paid: number;
  opening_balance: number;
  currency: 'USD' | 'GBP';
  credit_balance: number;
}

// Ledger entry for client transaction history
export interface LedgerEntry {
  date: string;
  type: 'opening_balance' | 'invoice' | 'payment' | 'adjustment';
  reference: string;
  document_id?: string;
  debit: number;
  credit: number;
  currency: 'USD' | 'GBP';
  balance: number; // Running balance after this entry
}

export interface LineItem {
  id?: string; // Optional for new items
  line_number?: number; // For ordering
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  discount_percentage?: number;
  discount_amount?: number;
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

export interface ReceiptItem extends LineItem {
  receipt_id?: string;
  invoice_id?: string;
  invoice_number?: string;
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
  status: QuoteStatus;
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
  invoice_kind?: 'Standard' | 'Deposit' | 'Final';
  vehicle_id?: string;
  client_id?: string;
  client_name: string;
  client_email?: string;
  client_address?: string;
  amount_usd: number;
  currency?: 'USD' | 'GBP';
  status: InvoiceStatus;
  description?: string;
  notes?: string;
  terms_and_conditions?: string;
  due_date: string;
  items?: InvoiceItem[]; // Line items from invoice_items table
  batch?: string;
  created_at: string;
}

export interface Payment {
  id: string;
  reference_id: string; // Linked to Invoice or Expense (auto-generated for unallocated)
  client_name?: string;
  client_id?: string; // Direct link to client record - PRIMARY KEY FOR JOINS
  type:
    | 'Inbound'
    | 'Outbound'
    | 'Invoice Payment'
    | 'Quote Payment'
    | 'Deposit'
    | 'Refund'
    | 'Other';
  amount_usd: number;
  currency?: 'USD' | 'GBP';
  method: string;
  date: string;
  notes?: string;
  status?: 'allocated' | 'unallocated' | 'credit';
  // Audit fields for soft delete and tracking
  is_deleted?: boolean;
  created_by?: string;
  updated_by?: string;
  deleted_by?: string;
  created_at: string;
  updated_at?: string;
  deleted_at?: string | null;
  allocations?: PaymentAllocation[];
}

export interface PaymentAllocation {
  id: string;
  payment_id: string;
  invoice_id?: string; // Optional for unallocated payments
  client_id?: string; // For client-level unallocated tracking
  amount_allocated: number;
  currency: 'USD' | 'GBP';
  status?: 'allocated' | 'unallocated' | 'credit';
  created_at: string;
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
  items?: ReceiptItem[];
  batch?: string;
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

export interface AuditLog {
  id: string;
  user_id?: string | null;
  user_name?: string | null;
  user_email?: string | null;
  action: string;
  table_name?: string | null;
  record_id?: string | null;
  old_data?: unknown;
  new_data?: unknown;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
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

export interface Trip {
  id: string;
  trip_number: string;
  title: string;
  status: TripStatus;
  assigned_driver_id?: string | null;
  assigned_driver_name?: string | null;
  assigned_vehicle_id?: string | null;
  assigned_vehicle_label?: string | null;
  route_origin: string;
  route_destination: string;
  route_waypoints?: string[];
  departure_date: string;
  eta_date: string;
  actual_departure_at?: string | null;
  actual_arrival_at?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at?: string;
}

// Asset Register Types

export type AssetStatus = 'Available' | 'Borrowed' | 'Under Maintenance' | 'Retired';
export type AssetCondition = 'Excellent' | 'Good' | 'Fair' | 'Poor';

export interface Asset {
  id: string;
  name: string;
  description?: string;
  category: string;
  serial_number?: string;
  status: AssetStatus;
  location?: string;
  purchase_date?: string;
  purchase_value?: number;
  condition: AssetCondition;
  created_at: string;
  updated_at: string;
}

export type AssetRequestStatus =
  | 'Pending'
  | 'Approved'
  | 'Rejected'
  | 'Taken'
  | 'Returned'
  | 'Overdue';

export interface AssetRequest {
  id: string;
  asset_id: string;
  requested_by: string;
  requester_email?: string;
  requester_department?: string;
  request_date: string;
  requested_take_date?: string;
  approved_by?: string;
  approval_date?: string;
  actual_take_date?: string;
  expected_return_date?: string;
  actual_return_date?: string;
  status: AssetRequestStatus;
  rejection_reason?: string;
  purpose?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  asset_name?: string;
  asset_category?: string;
  asset_serial?: string;
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
