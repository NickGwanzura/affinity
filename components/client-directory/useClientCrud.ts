import type React from 'react';
import { useState } from 'react';
import type { Client } from '../../types';
import { dataService } from '../../services/dataService';
import type { ClientWithBalanceFormValue } from './ClientFormModalWithBalance';
import { emptyClientWithBalanceForm } from './ClientFormModalWithBalance';

interface UseClientCrudOpts {
  onSuccess: () => Promise<void> | void;
  showToast: (message: string, variant?: 'success' | 'error' | 'info' | 'warning') => void;
  confirm: (opts: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    confirmVariant?: 'danger' | 'primary';
  }) => Promise<boolean>;
  onDeleteSelected: (id: string) => void;
}

export function useClientCrud({
  onSuccess,
  showToast,
  confirm,
  onDeleteSelected,
}: UseClientCrudOpts) {
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState<ClientWithBalanceFormValue>(emptyClientWithBalanceForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyClientWithBalanceForm);
    setIsOpen(true);
  };

  const openEdit = (c: Client) => {
    setEditing(c);
    setForm({
      name: c.name,
      email: c.email || '',
      phone: c.phone || '',
      company: c.company || '',
      address: c.address || '',
      notes: c.notes || '',
      opening_balance: String(c.opening_balance ?? 0),
      opening_balance_currency: c.opening_balance_currency || 'USD',
    });
    setIsOpen(true);
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        company: form.company.trim(),
        address: form.address.trim(),
        notes: form.notes.trim(),
        opening_balance: parseFloat(form.opening_balance) || 0,
        opening_balance_currency: form.opening_balance_currency,
      };
      if (editing) {
        await dataService.updateClient(editing.id, payload);
        showToast('Client updated successfully', 'success');
      } else {
        await dataService.createClient(payload as Omit<Client, 'id' | 'created_at'>);
        showToast('Client created successfully', 'success');
      }
      setIsOpen(false);
      await onSuccess();
    } catch (err: any) {
      showToast(err?.message || 'Failed to save client', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (c: Client) => {
    const ok = await confirm({
      title: 'Delete Client?',
      message: `This will soft-delete "${c.name}". Financial history will be preserved.`,
      confirmLabel: 'Delete',
      confirmVariant: 'danger',
    });
    if (!ok) return;
    try {
      await dataService.deleteClient(c.id);
      showToast('Client deleted successfully', 'success');
      onDeleteSelected(c.id);
      await onSuccess();
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete client', 'error');
    }
  };

  return {
    isOpen,
    editing,
    form,
    isSubmitting,
    setFormField: (updates: Partial<ClientWithBalanceFormValue>) =>
      setForm((prev) => ({ ...prev, ...updates })),
    close: () => setIsOpen(false),
    openAdd,
    openEdit,
    handleSave,
    handleDelete,
  };
}
