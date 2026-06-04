import React from 'react';
import type { AppUser, Currency, ExpenseCategory, Vehicle, VehicleStatus } from '../../types';
import FormModalShell from './FormModal';
import { Button, Select, SelectItem, NumberInput, TextArea, InlineNotification } from '../ui';

export interface ExpenseEntryFormValue {
  vehicleId: string;
  amount: string;
  currency: Currency;
  category: ExpenseCategory;
  location: VehicleStatus;
  description: string;
  driverName: string;
}

interface ExpenseEntryModalProps {
  isOpen: boolean;
  title: string;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  vehicles: Vehicle[];
  drivers: AppUser[];
  form: ExpenseEntryFormValue;
  onChange: (updates: Partial<ExpenseEntryFormValue>) => void;
  isSubmitting?: boolean;
  accent?: 'green' | 'blue' | 'emerald' | 'indigo';
  categoryOptions?: ExpenseCategory[];
}

const DEFAULT_CATEGORY_OPTIONS: ExpenseCategory[] = [
  'Fuel',
  'Tolls',
  'Food',
  'Repairs',
  'Duty',
  'Shipping',
  'Driver Disbursement',
  'Other',
];

const CURRENCY_OPTIONS: Array<{ value: Currency; label: string }> = [
  { value: 'NAD', label: 'Namibian Dollars (NAD)' },
  { value: 'ZAR', label: 'Rands (ZAR)' },
  { value: 'BWP', label: 'Pulas (BWP)' },
  { value: 'USD', label: 'US Dollars (USD)' },
  { value: 'GBP', label: 'British Pounds (GBP)' },
];

export const ExpenseEntryModal: React.FC<ExpenseEntryModalProps> = ({
  isOpen,
  title,
  submitLabel,
  onClose,
  onSubmit,
  vehicles,
  drivers,
  form,
  onChange,
  isSubmitting = false,
  // accent kept for API compat — design-system primitives use a single brand-amber focus ring
  accent: _accent,
  categoryOptions = DEFAULT_CATEGORY_OPTIONS,
}) => {
  if (!isOpen) {
    return null;
  }

  const showDriverDisbursement = categoryOptions.includes('Driver Disbursement');
  const showDriverSelector = showDriverDisbursement && form.category === 'Driver Disbursement';

  return (
    <FormModalShell
      isOpen={isOpen}
      title={title}
      label="Expense entry"
      size="md"
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="expense-entry-form" isLoading={isSubmitting}>
            {submitLabel}
          </Button>
        </div>
      }
    >
      <form id="expense-entry-form" onSubmit={onSubmit} className="flex flex-col gap-3">
        {/* Vehicle selector */}
        <Select
          id="expense-vehicle"
          labelText="Vehicle"
          helperText="Optional — leave blank for general expense"
          value={form.vehicleId}
          onChange={(e) => onChange({ vehicleId: e.target.value })}
        >
          <SelectItem value="" text="None (General expense)" />
          {vehicles.map((v) => (
            <SelectItem key={v.id} value={v.id} text={`${v.make_model} (${v.vin_number})`} />
          ))}
        </Select>

        {/* Amount + Currency row */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <NumberInput
            id="expense-amount"
            labelText="Amount *"
            placeholder="0.00"
            step={0.01}
            min={0}
            value={form.amount}
            onChange={(_e, { value }) => onChange({ amount: String(value) })}
          />
          <Select
            id="expense-currency"
            labelText="Currency"
            value={form.currency}
            onChange={(e) => onChange({ currency: e.target.value as Currency })}
          >
            {CURRENCY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} text={opt.label} />
            ))}
          </Select>
        </div>

        {/* Category + Location row */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            id="expense-category"
            labelText="Category"
            value={form.category}
            onChange={(e) => {
              const nextCategory = e.target.value as ExpenseCategory;
              onChange({
                category: nextCategory,
                driverName: nextCategory === 'Driver Disbursement' ? form.driverName : '',
              });
            }}
          >
            {categoryOptions.map((cat) => (
              <SelectItem key={cat} value={cat} text={cat} />
            ))}
          </Select>
          <Select
            id="expense-location"
            labelText="Location"
            value={form.location}
            onChange={(e) => onChange({ location: e.target.value as VehicleStatus })}
          >
            <SelectItem value="UK" text="UK" />
            <SelectItem value="Namibia" text="Namibia" />
            <SelectItem value="Zimbabwe" text="Zimbabwe" />
            <SelectItem value="Botswana" text="Botswana" />
          </Select>
        </div>

        {/* Driver disbursement selector — conditional */}
        {showDriverSelector && (
          <>
            <InlineNotification
              kind="warning"
              title="Driver disbursement"
              subtitle="Money will be recorded as disbursed to the selected driver for trip expenses."
              hideCloseButton
            />
            <Select
              id="expense-driver"
              labelText="Driver *"
              helperText="Money disbursed to this driver for trip expenses"
              value={form.driverName}
              onChange={(e) => onChange({ driverName: e.target.value })}
              required
            >
              <SelectItem value="" text="-- Select Driver --" />
              {drivers.map((driver) => (
                <SelectItem key={driver.id} value={driver.name} text={driver.name} />
              ))}
            </Select>
          </>
        )}

        {/* Description */}
        <TextArea
          id="expense-description"
          labelText={form.category === 'Other' ? 'Description *' : 'Description'}
          helperText={
            form.category === 'Other'
              ? 'Please describe what this expense is for'
              : undefined
          }
          placeholder={
            form.category === 'Other'
              ? 'Please specify the type of expense'
              : 'E.g. Full tank at Engen Windhoek'
          }
          rows={3}
          required={form.category === 'Other'}
          value={form.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </form>
    </FormModalShell>
  );
};

export default ExpenseEntryModal;
