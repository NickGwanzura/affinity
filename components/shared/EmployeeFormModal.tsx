import React from 'react';
import type { Employee } from '../../types';
import FormModalShell from './FormModal';
import { Button, NumberInput, Select, SelectItem, TextInput } from '../ui';

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

export const EmployeeFormModal: React.FC<EmployeeFormModalProps> = ({
  isOpen,
  title,
  onClose,
  onSubmit,
  form,
  onChange,
  submitLabel = 'Save Employee',
  isNewEmployee: _isNewEmployee = false,
  existingEmployees = [],
}) => {
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

  const sectionHeader = 'text-xs font-semibold uppercase tracking-[0.08em] text-zinc-400';

  return (
    <FormModalShell
      isOpen={isOpen}
      title={title}
      label="Employee record"
      size="2xl"
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="employee-form">
            {submitLabel}
          </Button>
        </div>
      }
    >
      <form id="employee-form" onSubmit={onSubmit} className="space-y-8">
        {/* Personal & contact */}
        <section className="space-y-4">
          <h4 className={sectionHeader}>Personal &amp; contact</h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextInput
              id="employee-name"
              name="name"
              labelText="Full Name *"
              autoComplete="name"
              required
              value={form.name}
              onChange={(e) => onChange({ name: e.target.value })}
            />
            <TextInput
              id="employee-email"
              type="email"
              name="email"
              labelText="Email *"
              autoComplete="email"
              required
              value={form.email}
              onChange={(e) => onChange({ email: e.target.value })}
            />
            <TextInput
              id="employee-phone"
              type="tel"
              name="tel"
              labelText="Phone"
              autoComplete="tel"
              value={form.phone}
              onChange={(e) => onChange({ phone: e.target.value })}
            />
            <div>
              <TextInput
                id="employee-department"
                labelText="Department"
                list="department-list"
                autoComplete="off"
                value={form.department}
                onChange={(e) => onChange({ department: e.target.value })}
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
        <section className="space-y-4">
          <h4 className={sectionHeader}>Role &amp; compensation</h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <TextInput
                id="employee-position"
                labelText="Position *"
                list="position-list"
                autoComplete="off"
                required
                value={form.position}
                onChange={(e) => onChange({ position: e.target.value })}
              />
              <datalist id="position-list">
                {positionOptions.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
            <NumberInput
              id="employee-base-pay"
              labelText="Base pay *"
              step={0.01}
              min={0}
              autoComplete="off"
              required
              value={form.base_pay_usd}
              onChange={(event) => onChange({ base_pay_usd: event.target.value })}
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
              <SelectItem value="ZAR" text="ZAR" />
            </Select>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
              labelText="Date Hired *"
              autoComplete="off"
              required
              value={form.date_hired}
              onChange={(e) => onChange({ date_hired: e.target.value })}
            />
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
        <section className="space-y-4">
          <div>
            <h4 className={sectionHeader}>Banking &amp; tax</h4>
            <p className="mt-1 text-xs text-zinc-500">Optional — used on payslip PDFs.</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextInput
              id="employee-national-id"
              labelText="National ID"
              autoComplete="off"
              value={form.national_id}
              onChange={(e) => onChange({ national_id: e.target.value })}
            />
            <TextInput
              id="employee-tax-number"
              labelText="Tax Number"
              autoComplete="off"
              value={form.tax_number}
              onChange={(e) => onChange({ tax_number: e.target.value })}
            />
            <TextInput
              id="employee-bank-name"
              labelText="Bank Name"
              autoComplete="off"
              value={form.bank_name}
              onChange={(e) => onChange({ bank_name: e.target.value })}
            />
            <TextInput
              id="employee-bank-account"
              labelText="Bank Account"
              autoComplete="off"
              value={form.bank_account}
              onChange={(e) => onChange({ bank_account: e.target.value })}
            />
          </div>
        </section>
      </form>
    </FormModalShell>
  );
};

export default EmployeeFormModal;
