import React, { useRef, useEffect } from 'react';
import type { Employee } from '../../types';
import FormModalShell from './FormModal';
import { Button, Select, SelectItem, TextInput } from '../ui';

export interface EmployeeFormValue {
  name: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  base_pay_usd: string;
  currency: Employee['currency'];
  employment_type: Employee['employment_type'];
  date_hired: string;
  status: Employee['status'];
  national_id: string;
  bank_account: string;
  bank_name: string;
  tax_number: string;
}

interface EmployeeFormModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  form: EmployeeFormValue;
  onChange: (updates: Partial<EmployeeFormValue>) => void;
  submitLabel?: string;
  isNewEmployee?: boolean;
  existingEmployees?: Employee[];
  isDirty?: boolean;
}

export const createEmptyEmployeeForm = (): EmployeeFormValue => ({
  name: '',
  email: '',
  phone: '',
  department: '',
  position: '',
  base_pay_usd: '',
  currency: 'USD',
  employment_type: 'Full-time',
  date_hired: '',
  status: 'Active',
  national_id: '',
  bank_account: '',
  bank_name: '',
  tax_number: '',
});

export const toEmployeeFormValue = (employee: Employee): EmployeeFormValue => ({
  name: employee.name,
  email: employee.email || '',
  phone: employee.phone || '',
  department: employee.department || '',
  position: employee.position,
  base_pay_usd: employee.base_pay_usd.toString(),
  currency: employee.currency,
  employment_type: employee.employment_type,
  date_hired: employee.date_hired,
  status: employee.status,
  national_id: employee.national_id || '',
  bank_account: employee.bank_account || '',
  bank_name: employee.bank_name || '',
  tax_number: employee.tax_number || '',
});

/** Asterisk to mark required fields */
const Req: React.FC = () => (
  <span className="text-rose-600 ml-0.5" aria-hidden="true">*</span>
);

export const EmployeeFormModal: React.FC<EmployeeFormModalProps> = ({
  isOpen,
  title,
  onClose,
  onSubmit,
  form,
  onChange,
  submitLabel = 'Save Employee',
  isNewEmployee = false,
  existingEmployees = [],
}) => {
  const nameRef = useRef<HTMLInputElement>(null);

  // Auto-focus Full Name only when opening for a new employee
  useEffect(() => {
    if (isOpen && isNewEmployee) {
      const timer = setTimeout(() => nameRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isNewEmployee]);

  if (!isOpen) {
    return null;
  }

  // Build datalist values from existing employees
  const departmentOptions = Array.from(
    new Set(existingEmployees.map((e) => e.department).filter(Boolean))
  ) as string[];
  const positionOptions = Array.from(
    new Set(existingEmployees.map((e) => e.position).filter(Boolean))
  ) as string[];

  const sectionHeader = 'text-xs font-semibold uppercase tracking-wider text-zinc-500';

  return (
    <FormModalShell
      isOpen={isOpen}
      title={title}
      label="Employee record"
      size="2xl"
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="space-y-8">
        {/* Personal & contact */}
        <section className="space-y-5">
          <h4 className={sectionHeader}>Personal &amp; contact</h4>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label htmlFor="employee-name" className="block text-xs font-medium text-zinc-700 mb-1.5">
                Full Name <Req />
              </label>
              <input
                ref={nameRef}
                id="employee-name"
                name="name"
                autoComplete="name"
                required
                value={form.name}
                onChange={(e) => onChange({ name: e.target.value })}
                className="block w-full bg-white text-zinc-900 text-sm placeholder-zinc-400 border border-stone-300 rounded-md px-3 py-2 min-h-[2.5rem] shadow-sm transition-[border-color,box-shadow] duration-150 hover:border-stone-400 focus:outline-none focus-visible:border-[#D97706] focus-visible:ring-2 focus-visible:ring-[#D97706]/30"
              />
            </div>
            <div>
              <label htmlFor="employee-email" className="block text-xs font-medium text-zinc-700 mb-1.5">
                Email <Req />
              </label>
              <input
                id="employee-email"
                type="email"
                name="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={(e) => onChange({ email: e.target.value })}
                className="block w-full bg-white text-zinc-900 text-sm placeholder-zinc-400 border border-stone-300 rounded-md px-3 py-2 min-h-[2.5rem] shadow-sm transition-[border-color,box-shadow] duration-150 hover:border-stone-400 focus:outline-none focus-visible:border-[#D97706] focus-visible:ring-2 focus-visible:ring-[#D97706]/30"
              />
            </div>
            <div>
              <label htmlFor="employee-phone" className="block text-xs font-medium text-zinc-700 mb-1.5">
                Phone
              </label>
              <input
                id="employee-phone"
                type="tel"
                name="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={(e) => onChange({ phone: e.target.value })}
                className="block w-full bg-white text-zinc-900 text-sm placeholder-zinc-400 border border-stone-300 rounded-md px-3 py-2 min-h-[2.5rem] shadow-sm transition-[border-color,box-shadow] duration-150 hover:border-stone-400 focus:outline-none focus-visible:border-[#D97706] focus-visible:ring-2 focus-visible:ring-[#D97706]/30"
              />
            </div>
            <div>
              <label htmlFor="employee-department" className="block text-xs font-medium text-zinc-700 mb-1.5">
                Department
              </label>
              <input
                id="employee-department"
                list="department-list"
                autoComplete="off"
                value={form.department}
                onChange={(e) => onChange({ department: e.target.value })}
                className="block w-full bg-white text-zinc-900 text-sm placeholder-zinc-400 border border-stone-300 rounded-md px-3 py-2 min-h-[2.5rem] shadow-sm transition-[border-color,box-shadow] duration-150 hover:border-stone-400 focus:outline-none focus-visible:border-[#D97706] focus-visible:ring-2 focus-visible:ring-[#D97706]/30"
              />
              <datalist id="department-list">
                {departmentOptions.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>
          </div>
        </section>

        {/* Role & compensation */}
        <section className="space-y-5">
          <h4 className={sectionHeader}>Role &amp; compensation</h4>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <div>
              <label htmlFor="employee-position" className="block text-xs font-medium text-zinc-700 mb-1.5">
                Position <Req />
              </label>
              <input
                id="employee-position"
                list="position-list"
                autoComplete="off"
                required
                value={form.position}
                onChange={(e) => onChange({ position: e.target.value })}
                className="block w-full bg-white text-zinc-900 text-sm placeholder-zinc-400 border border-stone-300 rounded-md px-3 py-2 min-h-[2.5rem] shadow-sm transition-[border-color,box-shadow] duration-150 hover:border-stone-400 focus:outline-none focus-visible:border-[#D97706] focus-visible:ring-2 focus-visible:ring-[#D97706]/30"
              />
              <datalist id="position-list">
                {positionOptions.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
            <div>
              <label htmlFor="employee-base-pay" className="block text-xs font-medium text-zinc-700 mb-1.5">
                Base Pay <Req />
              </label>
              <input
                id="employee-base-pay"
                type="number"
                step="0.01"
                min="0"
                autoComplete="off"
                required
                value={form.base_pay_usd}
                onChange={(e) => onChange({ base_pay_usd: e.target.value })}
                className="block w-full bg-white text-zinc-900 text-sm placeholder-zinc-400 border border-stone-300 rounded-md px-3 py-2 min-h-[2.5rem] shadow-sm transition-[border-color,box-shadow] duration-150 hover:border-stone-400 focus:outline-none focus-visible:border-[#D97706] focus-visible:ring-2 focus-visible:ring-[#D97706]/30"
              />
            </div>
            <Select
              id="employee-currency"
              labelText="Currency"
              value={form.currency}
              onChange={(event) => onChange({ currency: event.target.value as Employee['currency'] })}
            >
              <SelectItem value="USD" text="USD" />
              <SelectItem value="NAD" text="NAD" />
              <SelectItem value="GBP" text="GBP" />
              <SelectItem value="BWP" text="BWP" />
              <SelectItem value="ZAR" text="ZAR" />
            </Select>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <Select
              id="employee-employment-type"
              labelText="Employment Type"
              value={form.employment_type}
              onChange={(event) => onChange({ employment_type: event.target.value as Employee['employment_type'] })}
            >
              <SelectItem value="Full-time" text="Full-time" />
              <SelectItem value="Part-time" text="Part-time" />
              <SelectItem value="Contract" text="Contract" />
              <SelectItem value="Intern" text="Intern" />
            </Select>
            <div>
              <label htmlFor="employee-date-hired" className="block text-xs font-medium text-zinc-700 mb-1.5">
                Date Hired <Req />
              </label>
              <input
                id="employee-date-hired"
                type="date"
                autoComplete="off"
                required
                value={form.date_hired}
                onChange={(e) => onChange({ date_hired: e.target.value })}
                className="block w-full bg-white text-zinc-900 text-sm placeholder-zinc-400 border border-stone-300 rounded-md px-3 py-2 min-h-[2.5rem] shadow-sm transition-[border-color,box-shadow] duration-150 hover:border-stone-400 focus:outline-none focus-visible:border-[#D97706] focus-visible:ring-2 focus-visible:ring-[#D97706]/30"
              />
            </div>
            <Select
              id="employee-status"
              labelText="Status"
              value={form.status}
              onChange={(event) => onChange({ status: event.target.value as Employee['status'] })}
            >
              <SelectItem value="Active" text="Active" />
              <SelectItem value="On Leave" text="On Leave" />
              <SelectItem value="Terminated" text="Terminated" />
            </Select>
          </div>
        </section>

        {/* Banking & tax */}
        <section className="space-y-5">
          <div>
            <h4 className={sectionHeader}>Banking &amp; tax</h4>
            <p className="mt-1 text-xs text-zinc-500">Optional — used on payslip PDFs.</p>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label htmlFor="employee-national-id" className="block text-xs font-medium text-zinc-700 mb-1.5">
                National ID
              </label>
              <input
                id="employee-national-id"
                autoComplete="off"
                value={form.national_id}
                onChange={(e) => onChange({ national_id: e.target.value })}
                className="block w-full bg-white text-zinc-900 text-sm placeholder-zinc-400 border border-stone-300 rounded-md px-3 py-2 min-h-[2.5rem] shadow-sm transition-[border-color,box-shadow] duration-150 hover:border-stone-400 focus:outline-none focus-visible:border-[#D97706] focus-visible:ring-2 focus-visible:ring-[#D97706]/30"
              />
            </div>
            <div>
              <label htmlFor="employee-tax-number" className="block text-xs font-medium text-zinc-700 mb-1.5">
                Tax Number
              </label>
              <input
                id="employee-tax-number"
                autoComplete="off"
                value={form.tax_number}
                onChange={(e) => onChange({ tax_number: e.target.value })}
                className="block w-full bg-white text-zinc-900 text-sm placeholder-zinc-400 border border-stone-300 rounded-md px-3 py-2 min-h-[2.5rem] shadow-sm transition-[border-color,box-shadow] duration-150 hover:border-stone-400 focus:outline-none focus-visible:border-[#D97706] focus-visible:ring-2 focus-visible:ring-[#D97706]/30"
              />
            </div>
            <div>
              <label htmlFor="employee-bank-name" className="block text-xs font-medium text-zinc-700 mb-1.5">
                Bank Name
              </label>
              <input
                id="employee-bank-name"
                autoComplete="off"
                value={form.bank_name}
                onChange={(e) => onChange({ bank_name: e.target.value })}
                className="block w-full bg-white text-zinc-900 text-sm placeholder-zinc-400 border border-stone-300 rounded-md px-3 py-2 min-h-[2.5rem] shadow-sm transition-[border-color,box-shadow] duration-150 hover:border-stone-400 focus:outline-none focus-visible:border-[#D97706] focus-visible:ring-2 focus-visible:ring-[#D97706]/30"
              />
            </div>
            <div>
              <label htmlFor="employee-bank-account" className="block text-xs font-medium text-zinc-700 mb-1.5">
                Bank Account
              </label>
              <input
                id="employee-bank-account"
                autoComplete="off"
                value={form.bank_account}
                onChange={(e) => onChange({ bank_account: e.target.value })}
                className="block w-full bg-white text-zinc-900 text-sm placeholder-zinc-400 border border-stone-300 rounded-md px-3 py-2 min-h-[2.5rem] shadow-sm transition-[border-color,box-shadow] duration-150 hover:border-stone-400 focus:outline-none focus-visible:border-[#D97706] focus-visible:ring-2 focus-visible:ring-[#D97706]/30"
              />
            </div>
          </div>
        </section>

        <div className="flex flex-col-reverse gap-3 border-t border-stone-200 pt-5 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">{submitLabel}</Button>
        </div>
      </form>
    </FormModalShell>
  );
};

export default EmployeeFormModal;
