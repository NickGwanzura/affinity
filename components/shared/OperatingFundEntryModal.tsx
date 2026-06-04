import React from 'react';
import type { AppUser, Currency, OperatingFundType } from '../../types';
import FormModalShell from './FormModal';
import { Button, NumberInput, Select, SelectItem, TextInput } from '../ui';

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
    <FormModalShell
      isOpen={isOpen}
      title={title}
      label="Operating funds"
      size="md"
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="opfund-form">
            {resolvedSubmitLabel}
          </Button>
        </div>
      }
    >
      <form id="opfund-form" onSubmit={onSubmit} className="space-y-4">
          {typeSelectorVariant === 'cards' ? (
            <div>
              <label className="text-sm font-semibold text-zinc-700 mb-2 block">Transaction Type *</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  aria-pressed={form.type === 'Received'}
                  onClick={() => onChange({ type: 'Received' })}
                  className={`rounded-xl p-5 border-2 transition-all ${
                    form.type === 'Received' ? receivedActiveClasses : `${baseBorder} hover:border-zinc-300`
                  }`}
                >
                  <svg aria-hidden="true" className="w-6 h-6 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                  <span className="font-bold">Received</span>
                  <p className="text-xs text-zinc-500 mt-1">Money from office</p>
                </button>
                <button
                  type="button"
                  aria-pressed={form.type === 'Disbursed'}
                  onClick={() => onChange({ type: 'Disbursed' })}
                  className={`rounded-xl p-5 border-2 transition-all ${
                    form.type === 'Disbursed' ? disbursedActiveClasses : `${baseBorder} hover:border-zinc-300`
                  }`}
                >
                  <svg aria-hidden="true" className="w-6 h-6 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                  <span className="font-bold">Disbursed</span>
                  <p className="text-xs text-zinc-500 mt-1">Paid out to driver</p>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                id="opfund-type"
                labelText="Type *"
                value={form.type}
                onChange={(event) => onChange({ type: event.target.value as OperatingFundType })}
              >
                <SelectItem value="Received" text="Received" />
                <SelectItem value="Disbursed" text="Disbursed" />
              </Select>
              <Select
                id="opfund-currency"
                labelText="Currency"
                value={form.currency}
                onChange={(event) => onChange({ currency: event.target.value as Currency })}
              >
                {currencyOptions.map((currency) => (
                  <SelectItem key={currency} value={currency} text={CURRENCY_LABELS[currency]} />
                ))}
              </Select>
            </div>
          )}

          {typeSelectorVariant === 'cards' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <NumberInput
                id="opfund-amount-cards"
                labelText="Amount *"
                step={0.01}
                min={0.01}
                required
                value={form.amount}
                onChange={(event) => onChange({ amount: event.target.value })}
                placeholder="0.00"
              />
              <Select
                id="opfund-currency-cards"
                labelText="Currency"
                value={form.currency}
                onChange={(event) => onChange({ currency: event.target.value as Currency })}
              >
                {currencyOptions.map((currency) => (
                  <SelectItem key={currency} value={currency} text={CURRENCY_LABELS[currency]} />
                ))}
              </Select>
            </div>
          )}

          {typeSelectorVariant === 'select' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <NumberInput
                id="opfund-amount"
                labelText="Amount *"
                step={0.01}
                min={0.01}
                required
                value={form.amount}
                onChange={(event) => onChange({ amount: event.target.value })}
              />
              <TextInput
                id="opfund-date"
                type="date"
                labelText="Date *"
                required
                value={form.date}
                onChange={(event) => onChange({ date: event.target.value })}
              />
            </div>
          )}

          {typeSelectorVariant === 'cards' && (
            <TextInput
              id="opfund-description-cards"
              labelText="Description *"
              required
              value={form.description}
              onChange={(event) => onChange({ description: event.target.value })}
              placeholder={form.type === 'Received' ? receivedDescriptionPlaceholder : disbursedDescriptionPlaceholder}
            />
          )}

          {typeSelectorVariant === 'cards' && form.type === 'Disbursed' && (
            <Select
              id="opfund-recipient-cards"
              labelText="Recipient (Driver) *"
              value={form.recipient}
              onChange={(event) => onChange({ recipient: event.target.value })}
              required
            >
              <SelectItem value="" text="-- Select Driver --" />
              {drivers.map((driver) => (
                <SelectItem key={driver.id} value={driver.name} text={driver.name} />
              ))}
            </Select>
          )}

          {typeSelectorVariant === 'cards' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TextInput
                id="opfund-reference-cards"
                labelText="Reference"
                value={form.reference}
                onChange={(event) => onChange({ reference: event.target.value })}
                placeholder="e.g., TRF-001"
              />
              <TextInput
                id="opfund-date-cards"
                type="date"
                labelText="Date *"
                required
                value={form.date}
                onChange={(event) => onChange({ date: event.target.value })}
              />
            </div>
          )}

          {typeSelectorVariant === 'select' && (
            <TextInput
              id="opfund-description"
              labelText="Description *"
              required
              value={form.description}
              onChange={(event) => onChange({ description: event.target.value })}
              placeholder={form.type === 'Received' ? receivedDescriptionPlaceholder : disbursedDescriptionPlaceholder}
            />
          )}

          {typeSelectorVariant === 'select' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TextInput
                id="opfund-reference"
                labelText="Reference"
                value={form.reference}
                onChange={(event) => onChange({ reference: event.target.value })}
                placeholder="Transfer ref, trip name..."
              />
              {form.type === 'Disbursed' ? (
                <Select
                  id="opfund-recipient"
                  labelText="Recipient"
                  value={form.recipient}
                  onChange={(event) => onChange({ recipient: event.target.value })}
                  required
                >
                  <SelectItem value="" text="-- Select Driver --" />
                  {drivers.map((driver) => (
                    <SelectItem key={driver.id} value={driver.name} text={driver.name} />
                  ))}
                </Select>
              ) : showRecipientForReceived ? (
                <TextInput
                  id="opfund-recipient-received"
                  labelText={recipientReceivedLabel}
                  value={form.recipient}
                  onChange={(event) => onChange({ recipient: event.target.value })}
                  placeholder="Office, branch, cash float..."
                />
              ) : (
                <div />
              )}
            </div>
          )}

          {showApprovedBy && (
            <TextInput
              id="opfund-approved-by"
              labelText="Approved By"
              value={form.approved_by || ''}
              onChange={(event) => onChange({ approved_by: event.target.value })}
              placeholder="Manager name"
            />
          )}
      </form>
    </FormModalShell>
  );
};

export default OperatingFundEntryModal;
