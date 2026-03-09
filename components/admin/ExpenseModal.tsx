import React, { memo, useCallback, useEffect, useState, useMemo } from 'react';
import { EXPENSE_CATEGORIES, CURRENCIES, VEHICLE_STATUS } from '../../constants';
import type { Expense, Vehicle, Currency, ExpenseCategory, VehicleStatus } from '../../types';

// ============================================
// Types
// ============================================
interface ExpenseFormData {
  vehicle_id: string;
  description: string;
  amount: string;
  currency: Currency;
  category: ExpenseCategory;
  location: VehicleStatus;
  driver_name: string;
}

interface ExpenseModalProps {
  isOpen: boolean;
  vehicles: Vehicle[];
  onClose: () => void;
  onSave: (data: Omit<Expense, 'id' | 'created_at' | 'exchange_rate_to_usd'>) => Promise<void>;
}

// Driver options for disbursements
const DRIVERS = ['David', 'Boulton'] as const;

// ============================================
// Component
// ============================================
export const ExpenseModal: React.FC<ExpenseModalProps> = memo(({
  isOpen,
  vehicles,
  onClose,
  onSave
}) => {
  // Form state
  const [formData, setFormData] = useState<ExpenseFormData>({
    vehicle_id: '',
    description: '',
    amount: '',
    currency: CURRENCIES.NAD,
    category: EXPENSE_CATEGORIES.FUEL,
    location: VEHICLE_STATUS.NAMIBIA,
    driver_name: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof ExpenseFormData, string>>>({});

  // Check if this is a driver disbursement
  const isDriverDisbursement = useMemo(() => 
    formData.category === EXPENSE_CATEGORIES.DRIVER_DISBURSEMENT,
  [formData.category]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        vehicle_id: '',
        description: '',
        amount: '',
        currency: CURRENCIES.NAD,
        category: EXPENSE_CATEGORIES.FUEL,
        location: VEHICLE_STATUS.NAMIBIA,
        driver_name: ''
      });
      setErrors({});
    }
  }, [isOpen]);

  // Handle input changes
  const handleChange = useCallback(<K extends keyof ExpenseFormData>(
    field: K, 
    value: ExpenseFormData[K]
  ) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      
      // Clear driver name if not driver disbursement
      if (field === 'category' && value !== EXPENSE_CATEGORIES.DRIVER_DISBURSEMENT) {
        newData.driver_name = '';
      }
      
      return newData;
    });
    
    // Clear error when user types
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  }, [errors]);

  // Validate form
  const validateForm = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof ExpenseFormData, string>> = {};

    if (!formData.amount) {
      newErrors.amount = 'Amount is required';
    } else if (parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }

    // Description is required for "Other" category
    if (formData.category === EXPENSE_CATEGORIES.OTHER && !formData.description.trim()) {
      newErrors.description = 'Description is required for "Other" category';
    }

    // Driver is required for driver disbursement
    if (isDriverDisbursement && !formData.driver_name) {
      newErrors.driver_name = 'Please select a driver for the disbursement';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, isDriverDisbursement]);

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const description = isDriverDisbursement && formData.driver_name
        ? `Driver Disbursement - ${formData.driver_name}: ${formData.description || 'Trip funds'}`
        : formData.description;

      await onSave({
        vehicle_id: formData.vehicle_id || undefined,
        description,
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        category: formData.category,
        location: formData.location,
        driver_name: formData.driver_name || undefined
      });
      onClose();
    } catch (error) {
      console.error('Error saving expense:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, isDriverDisbursement, validateForm, onSave, onClose]);

  // Handle modal close with escape key
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  if (!isOpen) return null;

  // Expense category options
  const categoryOptions: { value: ExpenseCategory; label: string }[] = [
    { value: EXPENSE_CATEGORIES.FUEL, label: 'Fuel' },
    { value: EXPENSE_CATEGORIES.TOLLS, label: 'Tolls' },
    { value: EXPENSE_CATEGORIES.FOOD, label: 'Food' },
    { value: EXPENSE_CATEGORIES.REPAIRS, label: 'Repairs' },
    { value: EXPENSE_CATEGORIES.DUTY, label: 'Duty' },
    { value: EXPENSE_CATEGORIES.SHIPPING, label: 'Shipping' },
    { value: EXPENSE_CATEGORIES.DRIVER_DISBURSEMENT, label: '💰 Driver Disbursement' },
    { value: EXPENSE_CATEGORIES.OTHER, label: 'Other' }
  ];

  // Location options
  const locationOptions: { value: VehicleStatus; label: string }[] = [
    { value: VEHICLE_STATUS.UK, label: 'UK' },
    { value: VEHICLE_STATUS.NAMIBIA, label: 'Namibia' },
    { value: VEHICLE_STATUS.ZIMBABWE, label: 'Zimbabwe' },
    { value: VEHICLE_STATUS.BOTSWANA, label: 'Botswana' }
  ];

  // Currency options
  const currencyOptions: { value: Currency; label: string }[] = [
    { value: CURRENCIES.NAD, label: 'NAD (Namibia)' },
    { value: CURRENCIES.GBP, label: 'GBP (UK)' },
    { value: CURRENCIES.USD, label: 'USD (General)' }
  ];

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="expense-modal-title"
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
            id="expense-modal-title" 
            className="text-2xl font-bold text-zinc-900"
          >
            Add Expense
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
          {/* Vehicle Selection */}
          <div>
            <label 
              htmlFor="expense-vehicle" 
              className="text-sm font-semibold text-zinc-700 mb-2 block"
            >
              Vehicle Selection <span className="text-zinc-400 text-xs">(Optional)</span>
            </label>
            <select
              id="expense-vehicle"
              value={formData.vehicle_id}
              onChange={(e) => handleChange('vehicle_id', e.target.value)}
              disabled={isSubmitting}
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">None (General expense)</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.make_model} ({vehicle.vin_number})
                </option>
              ))}
            </select>
          </div>

          {/* Amount & Currency */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label 
                htmlFor="expense-amount" 
                className="text-sm font-semibold text-zinc-700 mb-2 block"
              >
                Amount <span className="text-red-500">*</span>
              </label>
              <input
                id="expense-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={formData.amount}
                onChange={(e) => handleChange('amount', e.target.value)}
                required
                disabled={isSubmitting}
                placeholder="0.00"
                className={`w-full px-4 py-3 rounded-xl border bg-white focus:ring-2 focus:border-transparent transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
                  errors.amount 
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-zinc-200 focus:ring-green-500'
                }`}
                aria-invalid={!!errors.amount}
                aria-describedby={errors.amount ? 'amount-error' : undefined}
              />
              {errors.amount && (
                <p id="amount-error" className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {errors.amount}
                </p>
              )}
            </div>
            <div>
              <label 
                htmlFor="expense-currency" 
                className="text-sm font-semibold text-zinc-700 mb-2 block"
              >
                Currency
              </label>
              <select
                id="expense-currency"
                value={formData.currency}
                onChange={(e) => handleChange('currency', e.target.value as Currency)}
                disabled={isSubmitting}
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {currencyOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Category & Location */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label 
                htmlFor="expense-category" 
                className="text-sm font-semibold text-zinc-700 mb-2 block"
              >
                Category
              </label>
              <select
                id="expense-category"
                value={formData.category}
                onChange={(e) => handleChange('category', e.target.value as ExpenseCategory)}
                disabled={isSubmitting}
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {categoryOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label 
                htmlFor="expense-location" 
                className="text-sm font-semibold text-zinc-700 mb-2 block"
              >
                Location
              </label>
              <select
                id="expense-location"
                value={formData.location}
                onChange={(e) => handleChange('location', e.target.value as VehicleStatus)}
                disabled={isSubmitting}
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {locationOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Driver Selection - Only shown for Driver Disbursement */}
          {isDriverDisbursement && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <label 
                htmlFor="expense-driver" 
                className="text-sm font-semibold text-amber-800 mb-2 block"
              >
                Select Driver <span className="text-red-500">*</span>
              </label>
              <select
                id="expense-driver"
                value={formData.driver_name}
                onChange={(e) => handleChange('driver_name', e.target.value)}
                required={isDriverDisbursement}
                disabled={isSubmitting}
                className={`w-full px-4 py-3 rounded-xl border bg-white focus:ring-2 focus:border-transparent transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
                  errors.driver_name 
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-amber-300 focus:ring-amber-500'
                }`}
                aria-invalid={!!errors.driver_name}
                aria-describedby={errors.driver_name ? 'driver-error' : 'driver-help'}
              >
                <option value="">-- Select Driver --</option>
                {DRIVERS.map(driver => (
                  <option key={driver} value={driver}>{driver}</option>
                ))}
              </select>
              {errors.driver_name ? (
                <p id="driver-error" className="text-xs text-red-500 mt-2 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {errors.driver_name}
                </p>
              ) : (
                <p id="driver-help" className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                  <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  Money disbursed to this driver for trip expenses
                </p>
              )}
            </div>
          )}

          {/* Description */}
          <div>
            <label 
              htmlFor="expense-description" 
              className="text-sm font-semibold text-zinc-700 mb-2 block"
            >
              Description {formData.category === EXPENSE_CATEGORIES.OTHER && <span className="text-red-500">*</span>}
            </label>
            <textarea
              id="expense-description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder={formData.category === EXPENSE_CATEGORIES.OTHER 
                ? "Please specify the type of expense" 
                : "E.g. Full tank at Engen Windhoek"}
              rows={3}
              required={formData.category === EXPENSE_CATEGORIES.OTHER}
              disabled={isSubmitting}
              className={`w-full px-4 py-3 rounded-xl border bg-white focus:ring-2 focus:border-transparent transition-all outline-none resize-none disabled:opacity-50 disabled:cursor-not-allowed ${
                errors.description 
                  ? 'border-red-300 focus:ring-red-500' 
                  : 'border-zinc-200 focus:ring-green-500'
              }`}
              aria-invalid={!!errors.description}
              aria-describedby={errors.description ? 'description-error' : undefined}
            />
            {errors.description && (
              <p id="description-error" className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errors.description}
              </p>
            )}
          </div>

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
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-green-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting && (
                <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              Add Expense
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

ExpenseModal.displayName = 'ExpenseModal';

export default ExpenseModal;
