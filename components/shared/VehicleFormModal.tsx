import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import {
  Modal,
  Button,
  TextInput,
  Select,
  SelectItem,
  Checkbox,
  InlineNotification,
} from '../ui';

export interface VehicleFormValue {
  vin: string;
  reg: string;
  model: string;
  price: string;
  purpose: 'Resale' | 'Client';
  cbcaApplied: boolean;
  regBookUrl: string;
  currency?: 'GBP' | 'USD';
}

interface VehicleFormModalProps {
  isOpen: boolean;
  isEditing: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  form: VehicleFormValue;
  onChange: (updates: Partial<VehicleFormValue>) => void;
  isSubmitting?: boolean;
  hidePurpose?: boolean;
}

export const VehicleFormModal: React.FC<VehicleFormModalProps> = ({
  isOpen,
  isEditing,
  onClose,
  onSubmit,
  form,
  onChange,
  isSubmitting = false,
  hidePurpose = false,
}) => {
  const [errors, setErrors] = useState<Partial<Record<'vin' | 'model' | 'price', string>>>({});

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const validationErrors: Partial<Record<'vin' | 'model' | 'price', string>> = {};

    const vinTrimmed = form.vin.trim();
    if (!vinTrimmed) {
      validationErrors.vin = 'VIN number is required';
    } else if (vinTrimmed.length > 17) {
      validationErrors.vin = 'VIN number must be 17 characters or fewer';
    }

    if (!form.model.trim()) {
      validationErrors.model = 'Make and Model is required';
    }

    const parsedPrice = parseFloat(form.price);
    if (!form.price) {
      validationErrors.price = 'Purchase price is required';
    } else if (isNaN(parsedPrice) || parsedPrice <= 0) {
      validationErrors.price = 'Purchase price must be greater than 0';
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    onSubmit(e);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Vehicle' : 'Add Vehicle'}
      label="Fleet record"
      size="md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="ghost"
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="vehicle-form"
            isLoading={isSubmitting}
          >
            {isEditing ? 'Save Changes' : 'Add Vehicle'}
          </Button>
        </div>
      }
    >
      <form id="vehicle-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Row 1: Make and Model — full width, autoFocus */}
        <TextInput
          id="vehicle-model"
          labelText="Make and Model *"
          placeholder="e.g. Toyota Land Cruiser V8"
          autoFocus
          value={form.model}
          onChange={(e) => {
            if (errors.model) setErrors((prev) => ({ ...prev, model: undefined }));
            onChange({ model: e.target.value });
          }}
          invalid={!!errors.model}
          invalidText={errors.model}
        />

        {/* Row 2: VIN | Reg — 2-col grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInput
            id="vehicle-vin"
            labelText="VIN Number *"
            helperText="Unique vehicle identification number"
            placeholder="Enter VIN number"
            autoComplete="off"
            value={form.vin}
            onChange={(e) => {
              if (errors.vin) setErrors((prev) => ({ ...prev, vin: undefined }));
              onChange({ vin: e.target.value.toUpperCase() });
            }}
            invalid={!!errors.vin}
            invalidText={errors.vin}
          />
          <TextInput
            id="vehicle-reg"
            labelText="Registration Number"
            helperText="Leave blank if not yet registered."
            placeholder="e.g. N 12345 AB"
            value={form.reg}
            onChange={(e) => onChange({ reg: e.target.value })}
          />
        </div>

        {/* Row 3: Price | Currency — 3-col grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <TextInput
              id="vehicle-price"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              labelText="Purchase Price *"
              placeholder="0.00"
              value={form.price}
              onChange={(e) => {
                if (errors.price) setErrors((prev) => ({ ...prev, price: undefined }));
                onChange({ price: e.target.value });
              }}
              invalid={!!errors.price}
              invalidText={errors.price}
            />
          </div>
          <Select
            id="vehicle-currency"
            labelText="Currency"
            value={form.currency ?? 'GBP'}
            onChange={(e) => onChange({ currency: e.target.value as 'GBP' | 'USD' })}
          >
            <SelectItem value="GBP" text="GBP" />
            <SelectItem value="USD" text="USD" />
          </Select>
        </div>

        {/* Row 4: Purpose Select — only when !hidePurpose */}
        {!hidePurpose && (
          <Select
            id="vehicle-purpose"
            labelText="Purpose"
            value={form.purpose}
            onChange={(e) => onChange({ purpose: e.target.value as 'Resale' | 'Client' })}
          >
            <SelectItem value="Resale" text="Resale" />
            <SelectItem value="Client" text="Client" />
          </Select>
        )}

        {/* Row 5: CBCA Checkbox */}
        <Checkbox
          id="vehicle-cbca"
          labelText="CBCA Applied For"
          helperText="Cross-border cargo authorisation lodged with customs"
          checked={form.cbcaApplied}
          onChange={(e) => onChange({ cbcaApplied: e.target.checked })}
        />

        {/* Row 6: Reg book URL */}
        <div>
          <TextInput
            id="vehicle-reg-book"
            type="url"
            labelText="Reg book URL"
            helperText="Paste a link to a hosted PDF of the registration book"
            autoComplete="url"
            value={form.regBookUrl}
            onChange={(e) => onChange({ regBookUrl: e.target.value })}
          />
          {isEditing && !form.regBookUrl && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-600">
              <AlertCircle size={12} aria-hidden="true" />
              Reg book missing — paste a link above.
            </p>
          )}
        </div>

        {/* Row 7: UK status notice — only when adding */}
        {!isEditing && (
          <InlineNotification
            kind="info"
            title="Note:"
            subtitle="New vehicles are set to &quot;UK&quot; status by default. You can update the status later."
            hideCloseButton
          />
        )}
      </form>
    </Modal>
  );
};

export default VehicleFormModal;
