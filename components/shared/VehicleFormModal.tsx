import React from 'react';
import FormModalShell from './FormModal';
import { Button, Stack, TextInput, Select, SelectItem } from '../ui';
import { Upload, AlertCircle } from 'lucide-react';

export interface VehicleFormValue {
  vin: string;
  reg: string;
  model: string;
  price: string;
  purpose: 'Resale' | 'Client';
  cbcaApplied: boolean;
  regBookUrl: string;
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
    <FormModalShell
      isOpen={isOpen}
      title={isEditing ? 'Edit Vehicle' : 'Add Vehicle'}
      label="Fleet record"
      size="lg"
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="space-y-6">
        <Stack gap={5}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextInput
              id="vehicle-vin"
              labelText="VIN Number"
              helperText="Unique vehicle identification number"
              value={form.vin}
              onChange={event => onChange({ vin: event.target.value })}
              placeholder="Enter VIN number"
              required
            />
            <TextInput
              id="vehicle-reg"
              labelText="Registration Number"
              helperText="Vehicle registration/license plate"
              value={form.reg}
              onChange={event => onChange({ reg: event.target.value })}
              placeholder="e.g. N 12345 AB"
            />
          </div>
          <TextInput
            id="vehicle-model"
            labelText="Make and Model"
            value={form.model}
            onChange={event => onChange({ model: event.target.value })}
            placeholder="e.g. Toyota Land Cruiser V8"
            required
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextInput
              id="vehicle-price"
              type="number"
              labelText="Purchase Price (GBP)"
              helperText="Purchase price in British Pounds"
              value={form.price}
              onChange={event => onChange({ price: event.target.value })}
              placeholder="0.00"
              min="0"
              step="0.01"
              required
            />
            <Select
              id="vehicle-purpose"
              labelText="Purpose"
              value={form.purpose}
              onChange={event => onChange({ purpose: event.target.value as 'Resale' | 'Client' })}
            >
              <SelectItem value="Resale" text="Resale" />
              <SelectItem value="Client" text="Client" />
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="vehicle-cbca"
              checked={form.cbcaApplied}
              onChange={event => onChange({ cbcaApplied: event.target.checked })}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <label htmlFor="vehicle-cbca" style={{ fontSize: '0.875rem', cursor: 'pointer' }}>
              CBCA Applied For
            </label>
          </div>
          <div>
            <label
              htmlFor="vehicle-reg-book"
              className="text-sm font-medium"
              style={{ color: 'var(--cds-text-primary, #18181b)' }}
            >
              Registration Book URL
            </label>
            <div className="mt-1 flex rounded-md shadow-sm">
              <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                <Upload size={16} />
              </span>
              <input
                type="url"
                id="vehicle-reg-book"
                value={form.regBookUrl}
                onChange={event => onChange({ regBookUrl: event.target.value })}
                placeholder="https://storage.example.com/reg-book.pdf"
                className="flex-1 min-w-0 block w-full px-3 py-2 rounded-md rounded-r-md border border-gray-300 focus:ring-[#D97706]/30 focus:border-[#D97706] sm:text-sm"
              />
            </div>
            {isEditing && !form.regBookUrl && (
              <div className="mt-2 flex items-center gap-2 text-amber-600 text-sm">
                <AlertCircle size={16} />
                <span>Registration book is missing. Please upload or add URL.</span>
              </div>
            )}
          </div>
          {!isEditing ? (
            <div className="border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              New vehicles are set to "UK" status by default. You can update the status later.
            </div>
          ) : null}
        </Stack>
        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">{isEditing ? 'Save Changes' : 'Add Vehicle'}</Button>
        </div>
      </form>
    </FormModalShell>
  );
};

export default VehicleFormModal;
