import React from 'react';
import type { AppUser, Currency, OperatingFundType } from '../../types';
import CarbonFormModal from './CarbonFormModal';
import { Button } from '../ui';

const CURRENCY_LABELS: Record<Currency, string> = {
  NAD: 'Namibian Dollars (NAD)',
  ZAR: 'Rands (ZAR)',
  BWP: 'Pulas (BWP)',
  USD: 'US Dollars (USD)',
  GBP: 'British Pounds (GBP)',
};

export interface OperatingFundFormValue {
  type: OperatingFundType;
  amount: string;
  currency: Currency;
  description: string;
  reference: string;
  recipient: string;
  approved_by?: string;
  date: string;
}

interface OperatingFundEntryModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  form: OperatingFundFormValue;
  onChange: (updates: Partial<OperatingFundFormValue>) => void;
  drivers: AppUser[];
  currencyOptions: Currency[];
  accent?: 'emerald' | 'indigo';
  typeSelectorVariant?: 'cards' | 'select';
  showApprovedBy?: boolean;
  showRecipientForReceived?: boolean;
  recipientReceivedLabel?: string;
  submitLabel?: string | ((type: OperatingFundType) => string);
  receivedDescriptionPlaceholder?: string;
  disbursedDescriptionPlaceholder?: string;
}

export const OperatingFundEntryModal: React.FC<OperatingFundEntryModalProps> = ({
  isOpen,
  title,
  onClose,
  onSubmit,
  form,
  onChange,
  drivers,
  currencyOptions,
  accent = 'emerald',
  typeSelectorVariant = 'select',
  showApprovedBy = false,
  showRecipientForReceived = false,
  recipientReceivedLabel = 'Source',
  submitLabel,
  receivedDescriptionPlaceholder = 'e.g. Operating funds from HQ',
  disbursedDescriptionPlaceholder = 'e.g. Trip expenses - Harare',
}) => {
  if (!isOpen) {
    return null;
  }

  const focusTone = accent === 'indigo' ? 'focus:ring-indigo-500' : 'focus:ring-emerald-500';
  const baseBorder = 'border-zinc-200';
  const receivedActiveClasses =
    accent === 'indigo'
      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
      : 'border-emerald-500 bg-emerald-50 text-emerald-700';
  const disbursedActiveClasses =
    accent === 'indigo'
      ? 'border-orange-500 bg-orange-50 text-orange-700'
      : 'border-orange-500 bg-orange-50 text-orange-700';
  const resolvedSubmitLabelSource = submitLabel ?? 'Save Entry';
  const resolvedSubmitLabel =
    typeof resolvedSubmitLabelSource === 'string'
      ? resolvedSubmitLabelSource
      : resolvedSubmitLabelSource(form.type);

  return (
    <CarbonFormModal
      isOpen={isOpen}
      title={title}
      label="Operating funds"
      size="md"
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="space-y-5">
          {typeSelectorVariant === 'cards' ? (
            <div>
              <label className="text-sm font-semibold text-zinc-700 mb-2 block">Transaction Type *</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => onChange({ type: 'Received' })}
                  className={`p-4 border-2 transition-all ${
                    form.type === 'Received' ? receivedActiveClasses : `${baseBorder} hover:border-zinc-300`
                  }`}
                >
                  <svg className="w-6 h-6 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                  <span className="font-bold">Received</span>
                  <p className="text-xs text-zinc-500 mt-1">Money from office</p>
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ type: 'Disbursed' })}
                  className={`p-4 border-2 transition-all ${
                    form.type === 'Disbursed' ? disbursedActiveClasses : `${baseBorder} hover:border-zinc-300`
                  }`}
                >
                  <svg className="w-6 h-6 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                  <span className="font-bold">Disbursed</span>
                  <p className="text-xs text-zinc-500 mt-1">Paid out to driver</p>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-zinc-700 mb-2 block">Type *</label>
                <select
                  value={form.type}
                  onChange={(event) => onChange({ type: event.target.value as OperatingFundType })}
                  className={`w-full px-4 py-3 text-base border ${baseBorder} ${focusTone} outline-none`}
                >
                  <option value="Received">Received</option>
                  <option value="Disbursed">Disbursed</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-zinc-700 mb-2 block">Currency</label>
                <select
                  value={form.currency}
                  onChange={(event) => onChange({ currency: event.target.value as Currency })}
                  className={`w-full px-4 py-3 text-base border ${baseBorder} ${focusTone} outline-none`}
                >
                  {currencyOptions.map((currency) => (
                    <option key={currency} value={currency}>
                      {CURRENCY_LABELS[currency]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {typeSelectorVariant === 'cards' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-zinc-700 mb-2 block">Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={form.amount}
                  onChange={(event) => onChange({ amount: event.target.value })}
                  placeholder="0.00"
                  className={`w-full px-4 py-3 text-base border ${baseBorder} ${focusTone} outline-none`}
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-zinc-700 mb-2 block">Currency</label>
                <select
                  value={form.currency}
                  onChange={(event) => onChange({ currency: event.target.value as Currency })}
                  className={`w-full px-4 py-3 text-base border ${baseBorder} ${focusTone} outline-none`}
                >
                  {currencyOptions.map((currency) => (
                    <option key={currency} value={currency}>
                      {CURRENCY_LABELS[currency]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {typeSelectorVariant === 'select' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-zinc-700 mb-2 block">Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={form.amount}
                  onChange={(event) => onChange({ amount: event.target.value })}
                  className={`w-full px-4 py-3 text-base border ${baseBorder} ${focusTone} outline-none`}
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-zinc-700 mb-2 block">Date *</label>
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={(event) => onChange({ date: event.target.value })}
                  className={`w-full px-4 py-3 text-base border ${baseBorder} ${focusTone} outline-none`}
                />
              </div>
            </div>
          )}

          {typeSelectorVariant === 'cards' && (
            <div>
              <label className="text-sm font-semibold text-zinc-700 mb-2 block">Description *</label>
              <input
                type="text"
                value={form.description}
                onChange={(event) => onChange({ description: event.target.value })}
                required
                placeholder={form.type === 'Received' ? receivedDescriptionPlaceholder : disbursedDescriptionPlaceholder}
                className={`w-full px-4 py-3 text-base border ${baseBorder} ${focusTone} outline-none`}
              />
            </div>
          )}

          {typeSelectorVariant === 'cards' && form.type === 'Disbursed' && (
            <div>
              <label className="text-sm font-semibold text-zinc-700 mb-2 block">Recipient (Driver) *</label>
              <select
                value={form.recipient}
                onChange={(event) => onChange({ recipient: event.target.value })}
                required
                className={`w-full px-4 py-3 text-base border ${baseBorder} ${focusTone} outline-none`}
              >
                <option value="">-- Select Driver --</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.name}>
                    {driver.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {typeSelectorVariant === 'cards' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-zinc-700 mb-2 block">Reference</label>
                <input
                  type="text"
                  value={form.reference}
                  onChange={(event) => onChange({ reference: event.target.value })}
                  placeholder="e.g., TRF-001"
                  className={`w-full px-4 py-3 text-base border ${baseBorder} ${focusTone} outline-none`}
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-zinc-700 mb-2 block">Date *</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(event) => onChange({ date: event.target.value })}
                  required
                  className={`w-full px-4 py-3 border ${baseBorder} ${focusTone} outline-none`}
                />
              </div>
            </div>
          )}

          {typeSelectorVariant === 'select' && (
            <div>
              <label className="text-sm font-semibold text-zinc-700 mb-2 block">Description *</label>
              <input
                required
                value={form.description}
                onChange={(event) => onChange({ description: event.target.value })}
                placeholder={form.type === 'Received' ? receivedDescriptionPlaceholder : disbursedDescriptionPlaceholder}
                className={`w-full px-4 py-3 border ${baseBorder} ${focusTone} outline-none`}
              />
            </div>
          )}

          {typeSelectorVariant === 'select' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-zinc-700 mb-2 block">Reference</label>
                <input
                  value={form.reference}
                  onChange={(event) => onChange({ reference: event.target.value })}
                  placeholder="Transfer ref, trip name..."
                  className={`w-full px-4 py-3 border ${baseBorder} ${focusTone} outline-none`}
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-zinc-700 mb-2 block">
                  {form.type === 'Disbursed' ? 'Recipient' : recipientReceivedLabel}
                </label>
                {form.type === 'Disbursed' ? (
                  <select
                    value={form.recipient}
                    onChange={(event) => onChange({ recipient: event.target.value })}
                    required
                    className={`w-full px-4 py-3 text-base border ${baseBorder} ${focusTone} outline-none`}
                  >
                    <option value="">-- Select Driver --</option>
                    {drivers.map((driver) => (
                      <option key={driver.id} value={driver.name}>
                        {driver.name}
                      </option>
                    ))}
                  </select>
                ) : showRecipientForReceived ? (
                  <input
                    value={form.recipient}
                    onChange={(event) => onChange({ recipient: event.target.value })}
                    placeholder="Office, branch, cash float..."
                    className={`w-full px-4 py-3 text-base border ${baseBorder} ${focusTone} outline-none`}
                  />
                ) : null}
              </div>
            </div>
          )}

          {showApprovedBy && (
            <div>
              <label className="text-sm font-semibold text-zinc-700 mb-2 block">Approved By</label>
              <input
                value={form.approved_by || ''}
                onChange={(event) => onChange({ approved_by: event.target.value })}
                placeholder="Manager name"
                className={`w-full px-4 py-3 text-base border ${baseBorder} ${focusTone} outline-none`}
              />
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 sm:justify-end">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {resolvedSubmitLabel}
            </Button>
          </div>
      </form>
    </CarbonFormModal>
  );
};

export default OperatingFundEntryModal;
