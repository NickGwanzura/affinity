import React from 'react';
import CarbonFormModal from '../shared/FormModal';
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
  if (!isOpen) return null;

  return (
    <CarbonFormModal
      isOpen={isOpen}
      title={title}
      label="Client details"
      size="md"
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="space-y-6">
        <Stack gap={5}>
          <TextInput
            id="client-name"
            labelText="Name"
            value={form.name}
            onChange={(e) => onChange({ name: e.target.value })}
            required
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextInput
              id="client-email"
              type="email"
              labelText="Email"
              value={form.email}
              onChange={(e) => onChange({ email: e.target.value })}
            />
            <TextInput
              id="client-phone"
              type="tel"
              labelText="Phone"
              value={form.phone}
              onChange={(e) => onChange({ phone: e.target.value })}
            />
          </div>
          <TextInput
            id="client-company"
            labelText="Company"
            value={form.company}
            onChange={(e) => onChange({ company: e.target.value })}
          />
          <TextInput
            id="client-address"
            labelText="Address"
            value={form.address}
            onChange={(e) => onChange({ address: e.target.value })}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <TextInput
                id="client-opening-balance"
                type="number"
                step="0.01"
                labelText="Opening Balance"
                helperText="Carried-forward balance at client creation"
                value={form.opening_balance}
                onChange={(e) => onChange({ opening_balance: e.target.value })}
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
          <Button type="submit" disabled={isSubmitting || !form.name.trim()}>
            {isSubmitting ? 'Saving...' : submitLabel}
          </Button>
        </div>
      </form>
    </CarbonFormModal>
  );
};

export default ClientFormModalWithBalance;
