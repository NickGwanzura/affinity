import React from 'react';
import type { Employee } from '../../types';
import { Button } from '../ui';

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

  const inputClasses = 'w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-orange-500 outline-none';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm cursor-pointer" onClick={onClose} />
      <div className="relative bg-white rounded-3xl p-8 max-w-3xl w-full shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <h3 className="text-2xl font-bold text-zinc-900 mb-6">{title}</h3>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-zinc-700 mb-2 block">Full Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(event) => onChange({ name: event.target.value })}
                required
                className={inputClasses}
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-zinc-700 mb-2 block">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={(event) => onChange({ email: event.target.value })}
                required
                className={inputClasses}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-zinc-700 mb-2 block">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(event) => onChange({ phone: event.target.value })}
                className={inputClasses}
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-zinc-700 mb-2 block">Department</label>
              <input
                type="text"
                value={form.department}
                onChange={(event) => onChange({ department: event.target.value })}
                className={inputClasses}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-semibold text-zinc-700 mb-2 block">Position *</label>
              <input
                type="text"
                value={form.position}
                onChange={(event) => onChange({ position: event.target.value })}
                required
                className={inputClasses}
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-zinc-700 mb-2 block">Base Pay (USD) *</label>
              <input
                type="number"
                step="0.01"
                value={form.base_pay_usd}
                onChange={(event) => onChange({ base_pay_usd: event.target.value })}
                required
                className={inputClasses}
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-zinc-700 mb-2 block">Currency</label>
              <select
                value={form.currency}
                onChange={(event) => onChange({ currency: event.target.value as Employee['currency'] })}
                className={inputClasses}
              >
                <option value="USD">USD</option>
                <option value="NAD">NAD</option>
                <option value="GBP">GBP</option>
                <option value="BWP">BWP</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-zinc-700 mb-2 block">Employment Type</label>
              <select
                value={form.employment_type}
                onChange={(event) => onChange({ employment_type: event.target.value as Employee['employment_type'] })}
                className={inputClasses}
              >
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Contract">Contract</option>
                <option value="Intern">Intern</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-zinc-700 mb-2 block">Date Hired *</label>
              <input
                type="date"
                value={form.date_hired}
                onChange={(event) => onChange({ date_hired: event.target.value })}
                required
                className={inputClasses}
              />
            </div>
          </div>

          <div className="border-t border-zinc-200 pt-4 mt-4">
            <h4 className="text-sm font-bold text-zinc-700 mb-3">Optional Banking &amp; Tax Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-zinc-700 mb-2 block">National ID</label>
                <input
                  type="text"
                  value={form.national_id}
                  onChange={(event) => onChange({ national_id: event.target.value })}
                  className={inputClasses}
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-zinc-700 mb-2 block">Tax Number</label>
                <input
                  type="text"
                  value={form.tax_number}
                  onChange={(event) => onChange({ tax_number: event.target.value })}
                  className={inputClasses}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="text-sm font-semibold text-zinc-700 mb-2 block">Bank Name</label>
                <input
                  type="text"
                  value={form.bank_name}
                  onChange={(event) => onChange({ bank_name: event.target.value })}
                  className={inputClasses}
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-zinc-700 mb-2 block">Bank Account</label>
                <input
                  type="text"
                  value={form.bank_account}
                  onChange={(event) => onChange({ bank_account: event.target.value })}
                  className={inputClasses}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" fullWidth onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" fullWidth>
              {submitLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmployeeFormModal;
