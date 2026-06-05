import { z } from 'zod';
import type { Currency, ExpenseCategory, UserRole, VehicleStatus } from '../types';

const OptionalUrlSchema = z.union([z.literal(''), z.string().trim().url('Enter a valid URL')]);

export const loginFormSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email or phone number'),
  password: z.string().min(1, 'Enter your password'),
});

export const forgotPasswordFormSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
});

export const passwordResetFormSchema = z.object({
  token: z.string().trim().min(1, 'Reset token is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .refine((value) => /[A-Z]/.test(value), 'Password needs one uppercase letter')
    .refine((value) => /[0-9]/.test(value), 'Password needs one number')
    .refine(
      (value) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(value),
      'Password needs one special character',
    ),
  confirmPassword: z.string(),
}).superRefine((value, ctx) => {
  if (value.newPassword !== value.confirmPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['confirmPassword'],
      message: 'Passwords do not match',
    });
  }
});

export const driverDrawdownSchema = z.object({
  amount: z
    .string()
    .trim()
    .min(1, 'Enter an amount')
    .refine((value) => !Number.isNaN(Number(value)), 'Enter a valid amount')
    .refine((value) => Number(value) > 0, 'Amount must be greater than zero'),
  description: z.string().trim().min(3, 'Describe what this drawdown is for'),
  currency: z.custom<Currency>(),
  category: z.custom<Exclude<ExpenseCategory, 'Driver Disbursement'>>(),
  location: z.custom<VehicleStatus>(),
});

export const tripPlannerFormSchema = z.object({
  title: z.string().trim().min(3, 'Enter a trip title'),
  status: z.enum(['Planned', 'Assigned', 'In Transit', 'Delayed', 'Completed', 'Cancelled']),
  assigned_driver_id: z.string().optional().nullable(),
  assigned_vehicle_id: z.string().optional().nullable(),
  route_origin: z.string().trim().min(2, 'Enter the origin'),
  route_destination: z.string().trim().min(2, 'Enter the destination'),
  departure_date: z.string().min(1, 'Select the departure date'),
  eta_date: z.string().min(1, 'Select the ETA'),
  notes: z.string().optional(),
}).superRefine((value, ctx) => {
  if (new Date(value.eta_date).getTime() < new Date(value.departure_date).getTime()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['eta_date'],
      message: 'ETA must be after the departure date',
    });
  }
});

export const companyDetailsFormSchema = z.object({
  name: z.string().trim().min(2, 'Enter the company name'),
  registration_no: z.string().trim().max(120, 'Registration number is too long').optional(),
  tax_id: z.string().trim().max(120, 'Tax ID is too long').optional(),
  address: z.string().trim().min(5, 'Enter the company address'),
  contact_email: z.string().trim().email('Enter a valid contact email'),
  phone: z.string().trim().min(5, 'Enter a valid phone number').optional().or(z.literal('')),
  website: OptionalUrlSchema.optional(),
  logo_url: OptionalUrlSchema.optional(),
});

export const userCreateFormSchema = z.object({
  name: z.string().trim().min(2, 'Enter the user name'),
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.custom<UserRole>(),
});

export const userEditFormSchema = z.object({
  name: z.string().trim().min(2, 'Enter the user name'),
  email: z.string().trim().email('Enter a valid email address'),
  role: z.custom<UserRole>(),
  status: z.enum(['Active', 'Inactive']),
});

export const inviteFormSchema = z.object({
  name: z.string().trim().min(2, 'Enter the invitee name'),
  email: z.string().trim().email('Enter a valid email address'),
  role: z.custom<UserRole>(),
});

export const setPasswordFormSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).superRefine((value, ctx) => {
  if (value.newPassword !== value.confirmPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['confirmPassword'],
      message: 'Passwords do not match',
    });
  }
});

export const getFirstValidationMessage = (error: z.ZodError): string =>
  error.issues[0]?.message || 'Please review the highlighted fields';
