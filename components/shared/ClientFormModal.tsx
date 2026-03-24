import React from 'react';
import { Button } from '../ui';

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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm cursor-pointer" onClick={onClose} />
      <div className="relative bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-8 max-w-2xl w-full shadow-2xl animate-in zoom-in-95 duration-200 max-h-[calc(100dvh-1rem)] sm:max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl sm:text-2xl font-bold text-zinc-900 mb-5 sm:mb-6">{title}</h3>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-zinc-700 mb-2 block">Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(event) => onChange({ name: event.target.value })}
              required
              className="w-full px-4 py-3 text-base rounded-xl border border-zinc-200 focus:ring-2 focus:ring-green-500 outline-none"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-zinc-700 mb-2 block">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={(event) => onChange({ email: event.target.value })}
                required
                className="w-full px-4 py-3 text-base rounded-xl border border-zinc-200 focus:ring-2 focus:ring-green-500 outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-zinc-700 mb-2 block">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(event) => onChange({ phone: event.target.value })}
                className="w-full px-4 py-3 text-base rounded-xl border border-zinc-200 focus:ring-2 focus:ring-green-500 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold text-zinc-700 mb-2 block">Company</label>
            <input
              type="text"
              value={form.company}
              onChange={(event) => onChange({ company: event.target.value })}
              className="w-full px-4 py-3 text-base rounded-xl border border-zinc-200 focus:ring-2 focus:ring-green-500 outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-zinc-700 mb-2 block">Address</label>
            <input
              type="text"
              value={form.address}
              onChange={(event) => onChange({ address: event.target.value })}
              className="w-full px-4 py-3 text-base rounded-xl border border-zinc-200 focus:ring-2 focus:ring-green-500 outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-zinc-700 mb-2 block">Notes</label>
            <textarea
              value={form.notes}
              onChange={(event) => onChange({ notes: event.target.value })}
              rows={3}
              className="w-full px-4 py-3 text-base rounded-xl border border-zinc-200 focus:ring-2 focus:ring-green-500 outline-none resize-none"
            />
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
            <Button type="button" variant="secondary" fullWidth onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" fullWidth>
              {submitLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClientFormModal;
