import React, { memo, useCallback, useEffect, useState } from 'react';
import { VEHICLE_STATUS } from '../../constants';
import type { Vehicle } from '../../types';

// ============================================
// Types
// ============================================
interface VehicleFormData {
  vin_number: string;
  make_model: string;
  purchase_price_gbp: string;
}

interface VehicleModalProps {
  isOpen: boolean;
  vehicle: Vehicle | null;
  onClose: () => void;
  onSave: (data: Omit<Vehicle, 'id' | 'created_at'>) => Promise<void>;
}

// ============================================
// Component
// ============================================
export const VehicleModal: React.FC<VehicleModalProps> = memo(({
  isOpen,
  vehicle,
  onClose,
  onSave
}) => {
  // Form state
  const [formData, setFormData] = useState<VehicleFormData>({
    vin_number: '',
    make_model: '',
    purchase_price_gbp: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof VehicleFormData, string>>>({});

  // Initialize form when vehicle changes
  useEffect(() => {
    if (vehicle) {
      setFormData({
        vin_number: vehicle.vin_number,
        make_model: vehicle.make_model,
        purchase_price_gbp: vehicle.purchase_price_gbp.toString()
      });
    } else {
      setFormData({
        vin_number: '',
        make_model: '',
        purchase_price_gbp: ''
      });
    }
    setErrors({});
  }, [vehicle, isOpen]);

  // Handle input changes
  const handleChange = useCallback((field: keyof VehicleFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user types
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  }, [errors]);

  // Validate form
  const validateForm = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof VehicleFormData, string>> = {};

    if (!formData.vin_number.trim()) {
      newErrors.vin_number = 'VIN number is required';
    }

    if (!formData.make_model.trim()) {
      newErrors.make_model = 'Make & Model is required';
    }

    if (!formData.purchase_price_gbp) {
      newErrors.purchase_price_gbp = 'Purchase price is required';
    } else if (parseFloat(formData.purchase_price_gbp) < 0) {
      newErrors.purchase_price_gbp = 'Purchase price cannot be negative';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      await onSave({
        vin_number: formData.vin_number.trim(),
        make_model: formData.make_model.trim(),
        purchase_price_gbp: parseFloat(formData.purchase_price_gbp),
        status: vehicle?.status || VEHICLE_STATUS.UK
      });
      onClose();
    } catch (error) {
      console.error('Error saving vehicle:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, vehicle, validateForm, onSave, onClose]);

  // Handle modal close with escape key
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  if (!isOpen) return null;

  const isEditing = !!vehicle;
  const modalTitle = isEditing ? 'Edit Vehicle' : 'Add Vehicle';
  const submitButtonText = isEditing ? 'Save Changes' : 'Add Vehicle';

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vehicle-modal-title"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Content */}
      <div className="relative bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 
            id="vehicle-modal-title" 
            className="text-2xl font-bold text-zinc-900"
          >
            {modalTitle}
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 transition-colors p-2 rounded-lg hover:bg-zinc-100"
            aria-label="Close modal"
            type="button"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* VIN Number Field */}
          <div>
            <label 
              htmlFor="vehicle-vin" 
              className="text-sm font-semibold text-zinc-700 mb-2 block"
            >
              VIN Number <span className="text-red-500">*</span>
            </label>
            <input
              id="vehicle-vin"
              type="text"
              value={formData.vin_number}
              onChange={(e) => handleChange('vin_number', e.target.value)}
              required
              disabled={isSubmitting}
              placeholder="Enter VIN number"
              className={`w-full px-4 py-3 rounded-xl border bg-white focus:ring-2 focus:border-transparent transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
                errors.vin_number 
                  ? 'border-red-300 focus:ring-red-500' 
                  : 'border-zinc-200 focus:ring-blue-500'
              }`}
              aria-invalid={!!errors.vin_number}
              aria-describedby={errors.vin_number ? 'vin-error' : 'vin-help'}
            />
            {errors.vin_number ? (
              <p id="vin-error" className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errors.vin_number}
              </p>
            ) : (
              <p id="vin-help" className="text-xs text-zinc-400 mt-1">
                Unique vehicle identification number
              </p>
            )}
          </div>

          {/* Make & Model Field */}
          <div>
            <label 
              htmlFor="vehicle-model" 
              className="text-sm font-semibold text-zinc-700 mb-2 block"
            >
              Make & Model <span className="text-red-500">*</span>
            </label>
            <input
              id="vehicle-model"
              type="text"
              value={formData.make_model}
              onChange={(e) => handleChange('make_model', e.target.value)}
              required
              disabled={isSubmitting}
              placeholder="e.g. Toyota Land Cruiser V8"
              className={`w-full px-4 py-3 rounded-xl border bg-white focus:ring-2 focus:border-transparent transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
                errors.make_model 
                  ? 'border-red-300 focus:ring-red-500' 
                  : 'border-zinc-200 focus:ring-blue-500'
              }`}
              aria-invalid={!!errors.make_model}
              aria-describedby={errors.make_model ? 'model-error' : undefined}
            />
            {errors.make_model && (
              <p id="model-error" className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errors.make_model}
              </p>
            )}
          </div>

          {/* Purchase Price Field */}
          <div>
            <label 
              htmlFor="vehicle-price" 
              className="text-sm font-semibold text-zinc-700 mb-2 block"
            >
              Purchase Price (GBP) <span className="text-red-500">*</span>
            </label>
            <input
              id="vehicle-price"
              type="number"
              step="0.01"
              min="0"
              value={formData.purchase_price_gbp}
              onChange={(e) => handleChange('purchase_price_gbp', e.target.value)}
              required
              disabled={isSubmitting}
              placeholder="0.00"
              className={`w-full px-4 py-3 rounded-xl border bg-white focus:ring-2 focus:border-transparent transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
                errors.purchase_price_gbp 
                  ? 'border-red-300 focus:ring-red-500' 
                  : 'border-zinc-200 focus:ring-blue-500'
              }`}
              aria-invalid={!!errors.purchase_price_gbp}
              aria-describedby={errors.purchase_price_gbp ? 'price-error' : 'price-help'}
            />
            {errors.purchase_price_gbp ? (
              <p id="price-error" className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errors.purchase_price_gbp}
              </p>
            ) : (
              <p id="price-help" className="text-xs text-zinc-400 mt-1">
                Purchase price in British Pounds
              </p>
            )}
          </div>

          {/* Info Box - Only show for new vehicles */}
          {!isEditing && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm text-blue-800 flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>New vehicles are set to &quot;UK&quot; status by default. You can update the status later.</span>
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 rounded-xl border border-zinc-200 text-zinc-700 font-semibold hover:bg-zinc-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex-1 text-white font-bold py-3 rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                isEditing 
                  ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200' 
                  : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
              }`}
            >
              {isSubmitting && (
                <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              {submitButtonText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

VehicleModal.displayName = 'VehicleModal';

export default VehicleModal;
