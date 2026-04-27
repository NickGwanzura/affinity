import React from 'react';
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
  national_id: employee.national_id || '',
  bank_account: employee.bank_account || '',
  bank_name: employee.bank_name || '',
  tax_number: employee.tax_number || '',
});

export const EmployeeFormModal: React.FC<EmployeeFormModalProps> = ({
  isOpen,
  title,
  onClose,
  onSubmit,
  form,
  onChange,
  submitLabel = 'Save Employee',
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <FormModalShell
      isOpen={isOpen}
      title={title}
      label="Employee record"
      size="2xl"
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="space-y-8">
        <section className="space-y-5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Personal &amp; contact
          </h4>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <TextInput
              id="employee-name"
              labelText="Full Name"
              value={form.name}
              onChange={(event) => onChange({ name: event.target.value })}
              required
            />
            <TextInput
              id="employee-email"
              type="email"
              labelText="Email"
              value={form.email}
              onChange={(event) => onChange({ email: event.target.value })}
              required
            />
            <TextInput
              id="employee-phone"
              type="tel"
              labelText="Phone"
              value={form.phone}
              onChange={(event) => onChange({ phone: event.target.value })}
            />
            <TextInput
              id="employee-department"
              labelText="Department"
              value={form.department}
              onChange={(event) => onChange({ department: event.target.value })}
            />
          </div>
        </section>

        <section className="space-y-5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Role &amp; compensation
          </h4>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <TextInput
              id="employee-position"
              labelText="Position"
              value={form.position}
              onChange={(event) => onChange({ position: event.target.value })}
              required
            />
            <TextInput
              id="employee-base-pay"
              type="number"
              step="0.01"
              labelText="Base Pay (USD)"
              value={form.base_pay_usd}
              onChange={(event) => onChange({ base_pay_usd: event.target.value })}
              required
            />
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
            </Select>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
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
            <TextInput
              id="employee-date-hired"
              type="date"
              labelText="Date Hired"
              value={form.date_hired}
              onChange={(event) => onChange({ date_hired: event.target.value })}
              required
            />
          </div>
        </section>

        <section className="space-y-5 rounded-lg border border-stone-200 bg-stone-50/60 p-5">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Banking &amp; tax
            </h4>
            <p className="mt-1 text-xs text-zinc-500">Optional — used on payslip PDFs.</p>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <TextInput
              id="employee-national-id"
              labelText="National ID"
              value={form.national_id}
              onChange={(event) => onChange({ national_id: event.target.value })}
            />
            <TextInput
              id="employee-tax-number"
              labelText="Tax Number"
              value={form.tax_number}
              onChange={(event) => onChange({ tax_number: event.target.value })}
            />
            <TextInput
              id="employee-bank-name"
              labelText="Bank Name"
              value={form.bank_name}
              onChange={(event) => onChange({ bank_name: event.target.value })}
            />
            <TextInput
              id="employee-bank-account"
              labelText="Bank Account"
              value={form.bank_account}
              onChange={(event) => onChange({ bank_account: event.target.value })}
            />
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
