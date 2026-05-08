import React, { useMemo } from 'react';
import type { Employee } from '../../types';
import { getMonthName } from '../../utils/formatters';
import FormModalShell from './FormModal';
import { Button, NumberInput, Select, SelectItem, TextArea, TextInput } from '../ui';

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
const formatMoney = (value: number) =>
  value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

  return (
    <FormModalShell
      isOpen={isOpen}
      title={title}
      label="Payroll"
      size="2xl"
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="payslip-form">
            {submitLabel}
          </Button>
        </div>
      }
    >
      <form id="payslip-form" onSubmit={onSubmit} className="space-y-8">
        <section className="space-y-5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Pay period
          </h4>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <div className="md:col-span-3">
              <Select
                id="payslip-employee"
                labelText="Employee"
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
              >
                <SelectItem value="" text="Select Employee" />
                {employees.map((employee) => (
                  <SelectItem
                    key={employee.id}
                    value={employee.id}
                    text={`${employee.name} — ${employee.position}`}
                  />
                ))}
              </Select>
            </div>
            <Select
              id="payslip-month"
              labelText="Month"
              value={String(form.month)}
              onChange={(event) => onChange({ month: parseInt(event.target.value, 10) })}
              required
            >
              {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                <SelectItem key={month} value={month} text={getMonthName(month)} />
              ))}
            </Select>
            <NumberInput
              id="payslip-year"
              labelText="Year"
              min={2000}
              max={2100}
              step={1}
              value={form.year}
              onChange={(event) =>
                onChange({ year: parseInt(event.target.value, 10) || new Date().getFullYear() })
              }
              required
            />
          </div>
        </section>

        <section className="space-y-5 rounded-md border border-stone-200 bg-stone-50/60 p-5">
          <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-800">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Earnings
          </h4>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <NumberInput
              id="payslip-base-pay"
              step={0.01}
              min={0}
              labelText="Base pay"
              value={form.base_pay}
              onChange={(event) => onChange({ base_pay: event.target.value })}
              required
            />
            <NumberInput
              id="payslip-ot-hours"
              step={0.01}
              min={0}
              labelText="OT hours"
              value={form.overtime_hours}
              onChange={(event) => onChange({ overtime_hours: event.target.value })}
            />
            <NumberInput
              id="payslip-ot-rate"
              step={0.01}
              min={0}
              labelText="OT rate"
              value={form.overtime_rate}
              onChange={(event) => onChange({ overtime_rate: event.target.value })}
            />
            <NumberInput
              id="payslip-bonus"
              step={0.01}
              min={0}
              labelText="Bonus"
              value={form.bonus}
              onChange={(event) => onChange({ bonus: event.target.value })}
            />
            <NumberInput
              id="payslip-allowances"
              step={0.01}
              min={0}
              labelText="Allowances"
              value={form.allowances}
              onChange={(event) => onChange({ allowances: event.target.value })}
            />
            <NumberInput
              id="payslip-commission"
              step={0.01}
              min={0}
              labelText="Commission"
              value={form.commission}
              onChange={(event) => onChange({ commission: event.target.value })}
            />
          </div>
        </section>

        <section className="space-y-5 rounded-md border border-stone-200 bg-stone-50/60 p-5">
          <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-red-700">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            Deductions
          </h4>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <NumberInput
              id="payslip-tax"
              step={0.01}
              min={0}
              labelText="Tax"
              value={form.tax_deduction}
              onChange={(event) => onChange({ tax_deduction: event.target.value })}
            />
            <NumberInput
              id="payslip-pension"
              step={0.01}
              min={0}
              labelText="Pension"
              value={form.pension_deduction}
              onChange={(event) => onChange({ pension_deduction: event.target.value })}
            />
            <NumberInput
              id="payslip-health"
              step={0.01}
              min={0}
              labelText="Health insurance"
              value={form.health_insurance}
              onChange={(event) => onChange({ health_insurance: event.target.value })}
            />
            <NumberInput
              id="payslip-other-deductions"
              step={0.01}
              min={0}
              labelText="Other"
              value={form.other_deductions}
              onChange={(event) => onChange({ other_deductions: event.target.value })}
            />
          </div>
        </section>

        <section className="rounded-lg border border-stone-200 bg-white p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Gross Pay
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">
                ${formatMoney(totals.grossPay)}
              </p>
            </div>
            <div className="sm:border-l sm:border-stone-200 sm:pl-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Deductions
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-red-700">
                −${formatMoney(totals.totalDeductions)}
              </p>
            </div>
            <div className="sm:border-l sm:border-stone-200 sm:pl-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Net Pay
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-[#D97706]">
                ${formatMoney(totals.netPay)}
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Payment
          </h4>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextInput
              id="payslip-payment-date"
              type="date"
              labelText="Payment Date"
              value={form.payment_date}
              onChange={(event) => onChange({ payment_date: event.target.value })}
            />
            <Select
              id="payslip-payment-method"
              labelText="Payment Method"
              value={form.payment_method}
              onChange={(event) => onChange({ payment_method: event.target.value })}
            >
              <SelectItem value="Bank Transfer" text="Bank Transfer" />
              <SelectItem value="Cash" text="Cash" />
              <SelectItem value="Cheque" text="Cheque" />
              <SelectItem value="Mobile Money" text="Mobile Money" />
            </Select>
          </div>
          <TextArea
            id="payslip-notes"
            labelText="Notes"
            rows={3}
            value={form.notes}
            onChange={(event) => onChange({ notes: event.target.value })}
          />
        </section>

      </form>
    </FormModalShell>
  );
};

export default PayslipFormModal;
