import React, { useMemo } from 'react';
import type { Employee } from '../../types';
import { getMonthName } from '../../utils/formatters';
import CarbonFormModal from './FormModal';
import { Button } from '../ui';

export interface PayslipFormValue {
  employee_id: string;
  month: number;
  year: number;
  base_pay: string;
  overtime_hours: string;
  overtime_rate: string;
  bonus: string;
  allowances: string;
  commission: string;
  tax_deduction: string;
  pension_deduction: string;
  health_insurance: string;
  other_deductions: string;
  payment_date: string;
  payment_method: string;
  notes: string;
}

interface PayslipFormModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  form: PayslipFormValue;
  onChange: (updates: Partial<PayslipFormValue>) => void;
  employees: Employee[];
  submitLabel?: string;
}

export const createEmptyPayslipForm = (date = new Date()): PayslipFormValue => ({
  employee_id: '',
  month: date.getMonth() + 1,
  year: date.getFullYear(),
  base_pay: '',
  overtime_hours: '',
  overtime_rate: '',
  bonus: '',
  allowances: '',
  commission: '',
  tax_deduction: '',
  pension_deduction: '',
  health_insurance: '',
  other_deductions: '',
  payment_date: '',
  payment_method: 'Bank Transfer',
  notes: '',
});

const parseAmount = (value: string) => parseFloat(value) || 0;

export const PayslipFormModal: React.FC<PayslipFormModalProps> = ({
  isOpen,
  title,
  onClose,
  onSubmit,
  form,
  onChange,
  employees,
  submitLabel = 'Generate Payslip',
}) => {
  const totals = useMemo(() => {
    const basePay = parseAmount(form.base_pay);
    const overtimePay = parseAmount(form.overtime_hours) * parseAmount(form.overtime_rate);
    const bonus = parseAmount(form.bonus);
    const allowances = parseAmount(form.allowances);
    const commission = parseAmount(form.commission);
    const grossPay = basePay + overtimePay + bonus + allowances + commission;
    const totalDeductions =
      parseAmount(form.tax_deduction) +
      parseAmount(form.pension_deduction) +
      parseAmount(form.health_insurance) +
      parseAmount(form.other_deductions);

    return {
      grossPay,
      totalDeductions,
      netPay: grossPay - totalDeductions,
    };
  }, [form]);

  if (!isOpen) {
    return null;
  }

  const inputClasses = 'w-full px-4 py-3 border border-zinc-200 focus:ring-2 focus:ring-pink-500 outline-none';
  const earningsInputClasses = 'w-full px-3 py-2 border border-green-300 focus:ring-2 focus:ring-green-500 outline-none';
  const deductionsInputClasses = 'w-full px-3 py-2 border border-red-300 focus:ring-2 focus:ring-red-500 outline-none';

  return (
    <CarbonFormModal
      isOpen={isOpen}
      title={title}
      label="Payroll"
      size="lg"
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-3">
              <label className="text-sm font-semibold text-zinc-700 mb-2 block">Employee *</label>
              <select
                value={form.employee_id}
                onChange={(event) => {
                  const employeeId = event.target.value;
                  const employee = employees.find((entry) => entry.id === employeeId);
                  onChange({
                    employee_id: employeeId,
                    base_pay: employee ? employee.base_pay_usd.toString() : '',
                  });
                }}
                required
                className={inputClasses}
              >
                <option value="">Select Employee</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name} - {employee.position}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-zinc-700 mb-2 block">Month *</label>
              <select
                value={form.month}
                onChange={(event) => onChange({ month: parseInt(event.target.value, 10) })}
                required
                className={inputClasses}
              >
                {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                  <option key={month} value={month}>
                    {getMonthName(month)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-zinc-700 mb-2 block">Year *</label>
              <input
                type="number"
                value={form.year}
                onChange={(event) => onChange({ year: parseInt(event.target.value, 10) || new Date().getFullYear() })}
                required
                className={inputClasses}
              />
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 p-4">
            <h4 className="text-sm font-bold text-green-800 mb-3">Earnings</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-zinc-600 mb-1 block">Base Pay *</label>
                <input type="number" step="0.01" value={form.base_pay} onChange={(event) => onChange({ base_pay: event.target.value })} required className={earningsInputClasses} />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-600 mb-1 block">OT Hours</label>
                <input type="number" step="0.01" value={form.overtime_hours} onChange={(event) => onChange({ overtime_hours: event.target.value })} className={earningsInputClasses} />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-600 mb-1 block">OT Rate</label>
                <input type="number" step="0.01" value={form.overtime_rate} onChange={(event) => onChange({ overtime_rate: event.target.value })} className={earningsInputClasses} />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-600 mb-1 block">Bonus</label>
                <input type="number" step="0.01" value={form.bonus} onChange={(event) => onChange({ bonus: event.target.value })} className={earningsInputClasses} />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-600 mb-1 block">Allowances</label>
                <input type="number" step="0.01" value={form.allowances} onChange={(event) => onChange({ allowances: event.target.value })} className={earningsInputClasses} />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-600 mb-1 block">Commission</label>
                <input type="number" step="0.01" value={form.commission} onChange={(event) => onChange({ commission: event.target.value })} className={earningsInputClasses} />
              </div>
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 p-4">
            <h4 className="text-sm font-bold text-red-800 mb-3">Deductions</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-semibold text-zinc-600 mb-1 block">Tax</label>
                <input type="number" step="0.01" value={form.tax_deduction} onChange={(event) => onChange({ tax_deduction: event.target.value })} className={deductionsInputClasses} />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-600 mb-1 block">Pension</label>
                <input type="number" step="0.01" value={form.pension_deduction} onChange={(event) => onChange({ pension_deduction: event.target.value })} className={deductionsInputClasses} />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-600 mb-1 block">Health Insurance</label>
                <input type="number" step="0.01" value={form.health_insurance} onChange={(event) => onChange({ health_insurance: event.target.value })} className={deductionsInputClasses} />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-600 mb-1 block">Other</label>
                <input type="number" step="0.01" value={form.other_deductions} onChange={(event) => onChange({ other_deductions: event.target.value })} className={deductionsInputClasses} />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              <div>
                <p className="text-xs text-blue-200 mb-1 uppercase tracking-wide font-semibold">Gross Pay</p>
                <p className="text-2xl font-black">${totals.grossPay.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-blue-200 mb-1 uppercase tracking-wide font-semibold">Deductions</p>
                <p className="text-2xl font-black">-${totals.totalDeductions.toLocaleString()}</p>
              </div>
              <div className="md:border-l-2 md:border-white/30 md:pl-6">
                <p className="text-xs text-blue-200 mb-1 uppercase tracking-wide font-semibold">Net Pay</p>
                <p className="text-3xl font-black">${totals.netPay.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-zinc-700 mb-2 block">Payment Date</label>
              <input
                type="date"
                value={form.payment_date}
                onChange={(event) => onChange({ payment_date: event.target.value })}
                className={inputClasses}
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-zinc-700 mb-2 block">Payment Method</label>
              <select
                value={form.payment_method}
                onChange={(event) => onChange({ payment_method: event.target.value })}
                className={inputClasses}
              >
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cash">Cash</option>
                <option value="Cheque">Cheque</option>
                <option value="Mobile Money">Mobile Money</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-zinc-700 mb-2 block">Notes</label>
            <textarea
              value={form.notes}
              onChange={(event) => onChange({ notes: event.target.value })}
              rows={2}
              className="w-full px-4 py-3 border border-zinc-200 focus:ring-2 focus:ring-pink-500 outline-none resize-none"
            />
          </div>

          <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {submitLabel}
            </Button>
          </div>
      </form>
    </CarbonFormModal>
  );
};

export default PayslipFormModal;
