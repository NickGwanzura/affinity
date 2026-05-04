import React, { useState } from 'react';
import FormModalShell from '../shared/FormModal';
import {
  Button,
  Stack,
  TextArea,
  TextInput,
  Select,
  SelectItem,
} from '../ui';

export interface ClientWithBalanceFormValue {
  name: string;
  email: string;
  phone: string;
  address: string;
  company: string;
  notes: string;
  opening_balance: string;
  opening_balance_currency: 'USD' | 'GBP';
}

export const emptyClientWithBalanceForm: ClientWithBalanceFormValue = {
  name: '',
  email: '',
  phone: '',
  address: '',
  company: '',
  notes: '',
  opening_balance: '0',
  opening_balance_currency: 'USD',
};

interface Props {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  form: ClientWithBalanceFormValue;
  onChange: (updates: Partial<ClientWithBalanceFormValue>) => void;
  submitLabel?: string;
  isSubmitting?: boolean;
}

export const ClientFormModalWithBalance: React.FC<Props> = ({
  isOpen,
  title,
  onClose,
  onSubmit,
  form,
  onChange,
  submitLabel = 'Save Client',
  isSubmitting = false,
}) => {
  const [nameError, setNameError] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!form.name.trim()) {
      e.preventDefault();
      setNameError(true);
      return;
    }
    onSubmit(e);
  };

  return (
    <FormModalShell
      isOpen={isOpen}
      title={title}
      label="Client details"
      size="md"
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <Stack gap={5}>
          <TextInput
            id="client-name"
            labelText="Name *"
            value={form.name}
            onChange={(e) => {
              setNameError(false);
              onChange({ name: e.target.value });
            }}
            required
            autoComplete="name"
            invalid={nameError}
            invalidText="Name is required"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextInput
              id="client-email"
              type="email"
              labelText="Email"
              value={form.email}
              onChange={(e) => onChange({ email: e.target.value })}
              autoComplete="email"
              inputMode="email"
            />
            <TextInput
              id="client-phone"
              type="tel"
              labelText="Phone"
              value={form.phone}
              onChange={(e) => onChange({ phone: e.target.value })}
              autoComplete="tel"
              inputMode="tel"
            />
          </div>
          <TextInput
            id="client-company"
            labelText="Company"
            value={form.company}
            onChange={(e) => onChange({ company: e.target.value })}
            autoComplete="organization"
          />
          <TextInput
            id="client-address"
            labelText="Address"
            value={form.address}
            onChange={(e) => onChange({ address: e.target.value })}
            autoComplete="street-address"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <TextInput
                id="client-opening-balance"
                type="number"
                step="0.01"
                labelText="Opening Balance"
                helperText="Positive = client owes you · Negative = you owe client"
                value={form.opening_balance}
                onChange={(e) => onChange({ opening_balance: e.target.value })}
                inputMode="decimal"
              />
            </div>
            <Select
              id="client-opening-balance-currency"
              labelText="Currency"
              value={form.opening_balance_currency}
              onChange={(e) =>
                onChange({ opening_balance_currency: e.target.value as 'USD' | 'GBP' })
              }
            >
              <SelectItem value="USD" text="USD" />
              <SelectItem value="GBP" text="GBP" />
            </Select>
          </div>
          <TextArea
            id="client-notes"
            labelText="Notes"
            rows={3}
            value={form.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
          />
        </Stack>
        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>{submitLabel}</Button>
        </div>
      </form>
    </FormModalShell>
  );
};

export default ClientFormModalWithBalance;
