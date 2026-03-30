import React from 'react';
import type { AppUser, Currency, ExpenseCategory, Vehicle, VehicleStatus } from '../../types';
import CarbonFormModal from './CarbonFormModal';
import { Button } from '../ui';

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
  accent?: 'green' | 'blue';
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
  accent = 'green',
  categoryOptions = DEFAULT_CATEGORY_OPTIONS,
}) => {
  if (!isOpen) {
    return null;
  }

  const focusTone = accent === 'blue' ? 'focus:ring-blue-500' : 'focus:ring-green-500';
  const accentBorder = accent === 'blue' ? 'border-blue-300 bg-blue-50' : 'border-zinc-200 bg-white';
  const showDriverDisbursement = categoryOptions.includes('Driver Disbursement');
  const showDriverSelector = showDriverDisbursement && form.category === 'Driver Disbursement';

  return (
    <CarbonFormModal
      isOpen={isOpen}
      title={title}
      label="Expense entry"
      size="lg"
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="text-sm font-semibold text-zinc-700 mb-2 block">
              Vehicle Selection <span className="text-zinc-400 text-xs">(Optional)</span>
            </label>
            <select
              value={form.vehicleId}
              onChange={(event) => onChange({ vehicleId: event.target.value })}
              className={`w-full px-4 py-3 text-base rounded-xl border ${accentBorder} ${focusTone} focus:border-transparent transition-all outline-none`}
            >
              <option value="">None (General expense)</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.make_model} ({vehicle.vin_number})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-zinc-700 mb-2 block">Amount</label>
              <input
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(event) => onChange({ amount: event.target.value })}
                required
                placeholder="0.00"
                className={`w-full px-4 py-3 text-base rounded-xl border ${accentBorder} ${focusTone} focus:border-transparent outline-none`}
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-zinc-700 mb-2 block">Currency</label>
              <select
                value={form.currency}
                onChange={(event) => onChange({ currency: event.target.value as Currency })}
                className={`w-full px-4 py-3 text-base rounded-xl border ${accentBorder} ${focusTone} focus:border-transparent outline-none`}
              >
                {CURRENCY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-zinc-700 mb-2 block">Category</label>
              <select
                value={form.category}
                onChange={(event) => {
                  const nextCategory = event.target.value as ExpenseCategory;
                  onChange({
                    category: nextCategory,
                    driverName: nextCategory === 'Driver Disbursement' ? form.driverName : '',
                  });
                }}
                className={`w-full px-4 py-3 text-base rounded-xl border ${accentBorder} ${focusTone} focus:border-transparent outline-none`}
              >
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-zinc-700 mb-2 block">Location</label>
              <select
                value={form.location}
                onChange={(event) => onChange({ location: event.target.value as VehicleStatus })}
                className={`w-full px-4 py-3 text-base rounded-xl border ${accentBorder} ${focusTone} focus:border-transparent outline-none`}
              >
                <option value="UK">UK</option>
                <option value="Namibia">Namibia</option>
                <option value="Zimbabwe">Zimbabwe</option>
                <option value="Botswana">Botswana</option>
              </select>
            </div>
          </div>

          {showDriverSelector && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <label className="text-sm font-semibold text-amber-800 mb-2 block">
                Select Driver <span className="text-red-500">*</span>
              </label>
              <select
                value={form.driverName}
                onChange={(event) => onChange({ driverName: event.target.value })}
                required
                className="w-full px-4 py-3 text-base rounded-xl border border-amber-300 bg-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
              >
                <option value="">-- Select Driver --</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.name}>
                    {driver.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                Money disbursed to this driver for trip expenses
              </p>
            </div>
          )}

          <div>
            <label className="text-sm font-semibold text-zinc-700 mb-2 block">
              Description {form.category === 'Other' && <span className="text-red-500">*</span>}
            </label>
            <textarea
              value={form.description}
              onChange={(event) => onChange({ description: event.target.value })}
              placeholder={form.category === 'Other' ? 'Please specify the type of expense' : 'E.g. Full tank at Engen Windhoek'}
              rows={3}
              required={form.category === 'Other'}
              className={`w-full px-4 py-3 text-base rounded-xl border ${accentBorder} ${focusTone} focus:border-transparent outline-none resize-none`}
            />
            {form.category === 'Other' && (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                Required: Please describe what this expense is for
              </p>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 sm:justify-end">
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

export default ExpenseEntryModal;
