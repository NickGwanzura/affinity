/**
 * Zod Validation Schemas
 *
 * Input validation for all API endpoints
 */

import { z } from 'zod';

const DateLikeSchema = z
  .string()
  .min(1)
  .refine(value => !Number.isNaN(Date.parse(value)), {
    message: 'Invalid date value',
  });

// Vehicle schemas
export const VehicleSchema = z.object({
  vin_number: z.string().min(1).max(100),
  reg_number: z.string().max(50).default(''),
  make_model: z.string().min(1).max(200),
  purchase_price_gbp: z.number().positive(),
  status: z.enum(['UK', 'Namibia', 'Zimbabwe', 'Botswana', 'Sold']).default('UK'),
  purpose: z.enum(['Resale', 'Client']).default('Resale'),
  client_id: z.string().uuid().optional().nullable(),
  cbca_applied: z.boolean().default(false),
  reg_book_url: z
    .union([z.string().url(), z.literal(''), z.null()])
    .optional()
    .transform(value => (value === '' ? null : value)),
});

export const VehicleUpdateSchema = VehicleSchema.partial();

// Shipment schemas
export const ShipmentSchema = z.object({
  client_id: z.string().uuid(),
  vehicle_id: z.string().uuid().optional().nullable(),
  description: z.string().min(1).max(500),
  origin: z.string().min(1).max(200),
  destination: z.string().min(1).max(200),
  status: z.enum(['Pending', 'In Transit', 'Delivered', 'Cancelled']).default('Pending'),
  shipping_date: DateLikeSchema.optional().nullable(),
  delivery_date: DateLikeSchema.optional().nullable(),
});

export const ShipmentUpdateSchema = ShipmentSchema.partial();

// Client schemas
export const ClientSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(50).optional(),
  address: z.string().optional(),
  company: z.string().max(200).optional(),
  notes: z.string().optional(),
  opening_balance: z.number().finite().optional(),
  opening_balance_currency: z.enum(['USD', 'GBP']).optional(),
  is_active: z.boolean().optional(),
});

export const ClientUpdateSchema = ClientSchema.partial();

// Line item schema
export const LineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unit_price: z.number().nonnegative(),
  discount_percentage: z.number().min(0).max(100).default(0),
  tax_rate: z.number().nonnegative().default(0),
  notes: z.string().optional(),
});

// Quote schemas
export const QuoteSchema = z.object({
  vehicle_id: z.string().uuid().optional(),
  client_id: z.string().uuid().optional(),
  client_name: z.string().min(1),
  client_email: z.string().email().optional().or(z.literal('')),
  client_address: z.string().optional(),
  currency: z.enum(['USD', 'GBP']).default('USD'),
  description: z.string().optional(),
  valid_until: DateLikeSchema.optional(),
  status: z.enum(['Draft', 'Sent', 'Accepted', 'Rejected']).default('Draft'),
  items: z.array(LineItemSchema).min(1, 'At least one line item required'),
});

export const QuoteUpdateSchema = QuoteSchema.partial().extend({
  items: z.array(LineItemSchema).optional(),
});

// Invoice schemas
export const InvoiceSchema = z.object({
  invoice_kind: z.enum(['Standard', 'Deposit', 'Final']).default('Standard'),
  quote_id: z.string().uuid().optional(),
  vehicle_id: z.string().uuid().optional(),
  client_id: z.string().uuid().optional(),
  client_name: z.string().min(1),
  client_email: z.string().email().optional().or(z.literal('')),
  client_address: z.string().optional(),
  currency: z.enum(['USD', 'GBP']).default('USD'),
  description: z.string().optional(),
  notes: z.string().optional(),
  terms_and_conditions: z.string().optional(),
  due_date: DateLikeSchema,
  status: z.enum(['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled']).default('Sent'),
  batch: z.string().optional(),
  items: z.array(LineItemSchema).min(1, 'At least one line item required'),
});

export const InvoiceUpdateSchema = InvoiceSchema.partial().extend({
  items: z.array(LineItemSchema).optional(),
});

// Payment schemas
export const PaymentAllocationSchema = z.object({
  invoice_id: z.string().uuid().optional().nullable(),
  amount_allocated: z.number().positive(),
  currency: z.enum(['USD', 'GBP']).default('USD'),
  status: z.enum(['allocated', 'unallocated', 'credit']).optional(),
});

export const PaymentSchema = z.object({
  reference_id: z.string().min(1).optional().or(z.literal('')),
  client_name: z.string().min(1),
  client_id: z.string().uuid().optional(),
  type: z.enum(['Inbound', 'Outbound']).default('Inbound'),
  amount_usd: z.number().positive(),
  currency: z.enum(['USD', 'GBP']).default('USD'),
  method: z.string().min(1),
  date: DateLikeSchema,
  status: z.enum(['allocated', 'unallocated', 'credit']).optional().default('allocated'),
  allocations: z.array(PaymentAllocationSchema).optional(),
});

export const PaymentUpdateSchema = PaymentSchema.partial();

export const ReceiptItemSchema = LineItemSchema.partial().extend({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unit_price: z.number().nonnegative(),
  amount: z.number().nonnegative().optional(),
  discount_amount: z.number().nonnegative().optional(),
  tax_amount: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  line_number: z.number().int().positive().optional(),
  invoice_id: z.string().uuid().optional(),
  invoice_number: z.string().optional(),
});

export const ReceiptSchema = z.object({
  invoice_id: z.string().uuid().optional(),
  payment_id: z.string().uuid().optional(),
  client_name: z.string().min(1),
  client_email: z.string().email().optional().or(z.literal('')),
  client_address: z.string().optional(),
  amount_received: z.number().positive(),
  currency: z.enum(['USD', 'GBP']).default('USD'),
  payment_method: z.string().min(1),
  payment_date: DateLikeSchema,
  reference_number: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(ReceiptItemSchema).optional(),
  batch: z.string().optional(),
});

export const ReceiptUpdateSchema = ReceiptSchema.partial();

// Expense schemas
export const ExpenseSchema = z.object({
  vehicle_id: z.string().uuid().optional(),
  description: z.string().min(1),
  amount: z.number().positive(),
  currency: z.enum(['USD', 'GBP', 'NAD', 'BWP', 'ZAR']).default('USD'),
  category: z.string().min(1),
  location: z.enum(['UK', 'Namibia', 'Zimbabwe', 'Botswana', 'Sold']).optional(),
  driver_name: z.string().optional(),
  trip_reference: z.string().optional(),
  receipt_url: z.string().url().optional().or(z.literal('')),
});

export const ExpenseUpdateSchema = ExpenseSchema.partial();

export const TripStatusSchema = z.enum([
  'Planned',
  'Assigned',
  'In Transit',
  'Delayed',
  'Completed',
  'Cancelled',
]);

const TripSchemaBase = z.object({
  title: z.string().min(1).max(200),
  status: TripStatusSchema.default('Planned'),
  assigned_driver_id: z.string().uuid().optional().nullable(),
  assigned_vehicle_id: z.string().uuid().optional().nullable(),
  route_origin: z.string().min(1).max(200),
  route_destination: z.string().min(1).max(200),
  route_waypoints: z.array(z.string().min(1).max(200)).optional().default([]),
  departure_date: DateLikeSchema,
  eta_date: DateLikeSchema,
  actual_departure_at: DateLikeSchema.optional().nullable(),
  actual_arrival_at: DateLikeSchema.optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
});

const withTripDateValidation = <T extends z.ZodTypeAny>(schema: T) =>
  schema.superRefine((value: z.infer<T>, ctx) => {
    const tripValue = value as {
      departure_date?: string;
      eta_date?: string;
    };

    if (!tripValue.departure_date || !tripValue.eta_date) {
      return;
    }

    if (new Date(tripValue.eta_date).getTime() < new Date(tripValue.departure_date).getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['eta_date'],
        message: 'ETA must be after the departure date',
      });
    }
  });

export const TripSchema = withTripDateValidation(TripSchemaBase);

export const TripUpdateSchema = withTripDateValidation(TripSchemaBase.partial());

// Auth schemas
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
  userId: z.string().uuid().optional(),
});

export const RegisterSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['Admin', 'Manager', 'Accountant', 'Driver']).default('Driver'),
});

export const RegistrationRequestSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['Driver', 'Accountant', 'Manager']).default('Driver'),
});

// Employee schemas
export const EmployeeSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  department: z.string().optional(),
  position: z.string().min(1),
  base_pay_usd: z.number().positive(),
  currency: z.enum(['USD', 'NAD', 'GBP', 'BWP']).default('USD'),
  employment_type: z.enum(['Full-time', 'Part-time', 'Contract', 'Intern']).default('Full-time'),
  date_hired: DateLikeSchema,
  status: z.enum(['Active', 'On Leave', 'Terminated']).default('Active'),
  national_id: z.string().optional(),
  bank_account: z.string().optional(),
  bank_name: z.string().optional(),
  tax_number: z.string().optional(),
});

export const EmployeeUpdateSchema = EmployeeSchema.partial();

export const CompanySchema = z.object({
  name: z.string().min(1),
  registration_no: z.string().optional().default(''),
  tax_id: z.string().optional().default(''),
  address: z.string().optional().default(''),
  contact_email: z.string().email(),
  logo_url: z.string().url().optional().or(z.literal('')),
  phone: z.string().optional().default(''),
  website: z.string().optional().default(''),
});

export const UserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['Admin', 'Manager', 'Accountant', 'Driver']),
  status: z.enum(['Active', 'Inactive', 'Pending']).default('Active'),
});

export const UserUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(['Admin', 'Manager', 'Accountant', 'Driver']).optional(),
  status: z.enum(['Active', 'Inactive', 'Pending']).optional(),
});

export const AdminSetPasswordSchema = z.object({
  id: z.string().uuid(),
  newPassword: z.string().min(8),
});

export const OperatingFundSchema = z.object({
  type: z.enum(['Received', 'Disbursed']),
  amount: z.number().positive(),
  currency: z.enum(['USD', 'GBP', 'NAD', 'BWP', 'ZAR']),
  description: z.string().min(1),
  reference: z.string().optional(),
  recipient: z.string().optional(),
  approved_by: z.string().optional(),
  date: DateLikeSchema,
});

export const OperatingFundUpdateSchema = OperatingFundSchema.partial();

// Asset schemas
export const AssetSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional().nullable(),
  category: z.string().min(1).max(100),
  serial_number: z.string().max(200).optional().nullable(),
  status: z.enum(['Available', 'Borrowed', 'Under Maintenance', 'Retired']).default('Available'),
  location: z.string().max(200).optional().nullable(),
  purchase_date: DateLikeSchema.optional().nullable(),
  purchase_value: z.number().nonnegative().optional().nullable(),
  condition: z.string().max(100).optional().nullable(),
});

export const AssetUpdateSchema = AssetSchema.partial();

export const AssetRequestSchema = z.object({
  asset_id: z.string().uuid(),
  requested_by: z.string().min(1).max(200),
  requester_email: z.string().email().optional().or(z.literal('')).nullable(),
  requester_department: z.string().max(200).optional().nullable(),
  requested_take_date: DateLikeSchema.optional().nullable(),
  approved_by: z.string().max(200).optional().nullable(),
  approval_date: DateLikeSchema.optional().nullable(),
  actual_take_date: DateLikeSchema.optional().nullable(),
  expected_return_date: DateLikeSchema.optional().nullable(),
  actual_return_date: DateLikeSchema.optional().nullable(),
  status: z.enum(['Pending', 'Approved', 'Rejected', 'Taken', 'Returned', 'Overdue']).default('Pending'),
  rejection_reason: z.string().optional().nullable(),
  purpose: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const AssetRequestUpdateSchema = AssetRequestSchema.partial();

export const PayslipSchema = z.object({
  employee_id: z.string().uuid(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000),
  base_pay: z.number().nonnegative(),
  overtime_hours: z.number().nonnegative().optional().default(0),
  overtime_rate: z.number().nonnegative().optional().default(0),
  bonus: z.number().nonnegative().optional().default(0),
  allowances: z.number().nonnegative().optional().default(0),
  commission: z.number().nonnegative().optional().default(0),
  tax_deduction: z.number().nonnegative().optional().default(0),
  pension_deduction: z.number().nonnegative().optional().default(0),
  health_insurance: z.number().nonnegative().optional().default(0),
  other_deductions: z.number().nonnegative().optional().default(0),
  payment_date: DateLikeSchema.optional(),
  payment_method: z.enum(['Bank Transfer', 'Cash', 'Cheque', 'Mobile Money']).optional(),
  notes: z.string().optional(),
});

// UUID parameter schema
export const UuidParamSchema = z.object({
  id: z.string().uuid(),
});

// Pagination schema
export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(5000).default(50),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

// Type inference helpers
export type VehicleInput = z.infer<typeof VehicleSchema>;
export type ClientInput = z.infer<typeof ClientSchema>;
export type QuoteInput = z.infer<typeof QuoteSchema>;
export type InvoiceInput = z.infer<typeof InvoiceSchema>;
export type PaymentInput = z.infer<typeof PaymentSchema>;
export type ReceiptInput = z.infer<typeof ReceiptSchema>;
export type ExpenseInput = z.infer<typeof ExpenseSchema>;
export type TripInput = z.infer<typeof TripSchema>;
export type EmployeeInput = z.infer<typeof EmployeeSchema>;
export type CompanyInput = z.infer<typeof CompanySchema>;
export type UserInput = z.infer<typeof UserSchema>;
export type OperatingFundInput = z.infer<typeof OperatingFundSchema>;
export type PayslipInput = z.infer<typeof PayslipSchema>;
export type AssetInput = z.infer<typeof AssetSchema>;
export type AssetRequestInput = z.infer<typeof AssetRequestSchema>;
