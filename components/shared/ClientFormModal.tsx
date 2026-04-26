import React from 'react';
import FormModalShell from './FormModal';
import { Button, Stack, TextArea, TextInput } from '../ui';

export interface ClientFormValue {
  name: string;
  email: string;
  phone: string;
  address: string;
  company: string;
  notes: string;
}

interface ClientFormModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  form: ClientFormValue;
  onChange: (updates: Partial<ClientFormValue>) => void;
  submitLabel?: string;
}

export const ClientFormModal: React.FC<ClientFormModalProps> = ({
  isOpen,
  title,
  onClose,
  onSubmit,
  form,
  onChange,
  submitLabel = 'Save Client',
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <FormModalShell
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
            onChange={(event) => onChange({ name: event.target.value })}
            required
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextInput
              id="client-email"
              type="email"
              labelText="Email"
              value={form.email}
              onChange={(event) => onChange({ email: event.target.value })}
              required
            />
            <TextInput
              id="client-phone"
              type="tel"
              labelText="Phone"
              value={form.phone}
              onChange={(event) => onChange({ phone: event.target.value })}
            />
          </div>
          <TextInput
            id="client-company"
            labelText="Company"
            value={form.company}
            onChange={(event) => onChange({ company: event.target.value })}
          />
          <TextInput
            id="client-address"
            labelText="Address"
            value={form.address}
            onChange={(event) => onChange({ address: event.target.value })}
          />
          <TextArea
            id="client-notes"
            labelText="Notes"
            rows={4}
            value={form.notes}
            onChange={(event) => onChange({ notes: event.target.value })}
          />
        </Stack>
        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">{submitLabel}</Button>
        </div>
      </form>
    </FormModalShell>
  );
};

export default ClientFormModal;
