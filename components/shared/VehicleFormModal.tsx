import React from 'react';
import { Button } from '../ui';

export interface VehicleFormValue {
  vin: string;
  model: string;
  price: string;
}

interface VehicleFormModalProps {
  isOpen: boolean;
  isEditing: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  form: VehicleFormValue;
  onChange: (updates: Partial<VehicleFormValue>) => void;
}

export const VehicleFormModal: React.FC<VehicleFormModalProps> = ({
  isOpen,
  isEditing,
  onClose,
  onSubmit,
  form,
  onChange,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm cursor-pointer" onClick={onClose} />
      <div className="relative bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-zinc-900">{isEditing ? 'Edit Vehicle' : 'Add Vehicle'}</h3>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="text-sm font-semibold text-zinc-700 mb-2 block">VIN Number *</label>
            <input
              type="text"
              value={form.vin}
              onChange={(event) => onChange({ vin: event.target.value })}
              required
              placeholder="Enter VIN number"
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
            />
            <p className="text-xs text-zinc-400 mt-1">Unique vehicle identification number</p>
          </div>

          <div>
            <label className="text-sm font-semibold text-zinc-700 mb-2 block">Make &amp; Model *</label>
            <input
              type="text"
              value={form.model}
              onChange={(event) => onChange({ model: event.target.value })}
              required
              placeholder="e.g. Toyota Land Cruiser V8"
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-zinc-700 mb-2 block">Purchase Price (GBP) *</label>
            <input
              type="number"
              step="0.01"
              value={form.price}
              onChange={(event) => onChange({ price: event.target.value })}
              required
              placeholder="0.00"
              min="0"
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
            />
            <p className="text-xs text-zinc-400 mt-1">Purchase price in British Pounds</p>
          </div>

          {!isEditing && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm text-blue-800 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>New vehicles are set to &quot;UK&quot; status by default. You can update the status later.</span>
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" fullWidth onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" fullWidth>
              {isEditing ? 'Save Changes' : 'Add Vehicle'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VehicleFormModal;
