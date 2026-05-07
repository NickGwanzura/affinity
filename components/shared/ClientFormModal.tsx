import React, { useState } from 'react';
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
  isSubmitting?: boolean;
}

export const ClientFormModal: React.FC<ClientFormModalProps> = ({
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

  if (!isOpen) {
    return null;
  }

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
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="client-form" isLoading={isSubmitting}>{submitLabel}</Button>
        </div>
      }
    >
      <form id="client-form" onSubmit={handleSubmit}>
        <Stack gap={5}>
          <TextInput
            id="client-name"
            labelText="Name *"
            value={form.name}
            onChange={(event) => {
              setNameError(false);
              onChange({ name: event.target.value });
            }}
            required
            autoComplete="name"
            invalid={nameError}
            invalidText="Name is required"
          />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <TextInput
              id="client-email"
              type="email"
              labelText="Email"
              value={form.email}
              onChange={(event) => onChange({ email: event.target.value })}
              autoComplete="email"
              inputMode="email"
            />
            <TextInput
              id="client-phone"
              type="tel"
              labelText="Phone"
              value={form.phone}
              onChange={(event) => onChange({ phone: event.target.value })}
              autoComplete="tel"
              inputMode="tel"
            />
          </div>
          <TextInput
            id="client-company"
            labelText="Company"
            value={form.company}
            onChange={(event) => onChange({ company: event.target.value })}
            autoComplete="organization"
          />
          <TextInput
            id="client-address"
            labelText="Address"
            value={form.address}
            onChange={(event) => onChange({ address: event.target.value })}
            autoComplete="street-address"
          />
          <TextArea
            id="client-notes"
            labelText="Notes"
            rows={3}
            value={form.notes}
            onChange={(event) => onChange({ notes: event.target.value })}
          />
        </Stack>
      </form>
    </FormModalShell>
  );
};

export default ClientFormModal;
