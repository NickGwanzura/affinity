import React, { memo, useCallback, useEffect, useState, useMemo } from 'react';
import { EXPENSE_CATEGORIES, CURRENCIES, VEHICLE_STATUS } from '../../constants';
import type { Expense, Vehicle, Currency, ExpenseCategory, VehicleStatus } from '../../types';
import {
  Modal,
  Button,
  NumberInput,
  Select,
  SelectItem,
  TextArea,
  InlineNotification,
} from '../ui';

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

const DRIVERS = ['David', 'Boulton'] as const;

const emptyForm = (): ExpenseFormData => ({
  vehicle_id: '',
  description: '',
  amount: '',
  currency: CURRENCIES.NAD,
  category: EXPENSE_CATEGORIES.FUEL,
  location: VEHICLE_STATUS.NAMIBIA,
  driver_name: '',
});

export const ExpenseModal: React.FC<ExpenseModalProps> = memo(({
  isOpen,
  vehicles,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<ExpenseFormData>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof ExpenseFormData, string>>>({});

  const isDriverDisbursement = useMemo(
    () => formData.category === EXPENSE_CATEGORIES.DRIVER_DISBURSEMENT,
    [formData.category],
  );

  useEffect(() => {
    if (isOpen) {
      setFormData(emptyForm());
      setErrors({});
    }
  }, [isOpen]);

  const handleChange = useCallback(
    <K extends keyof ExpenseFormData>(field: K, value: ExpenseFormData[K]) => {
      setFormData((prev) => {
        const next = { ...prev, [field]: value };
        if (field === 'category' && value !== EXPENSE_CATEGORIES.DRIVER_DISBURSEMENT) {
          next.driver_name = '';
        }
        return next;
      });
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [errors],
  );

  const validateForm = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof ExpenseFormData, string>> = {};

    if (!formData.amount) {
      newErrors.amount = 'Amount is required';
    } else if (parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }

    if (formData.category === EXPENSE_CATEGORIES.OTHER && !formData.description.trim()) {
      newErrors.description = 'Description is required for "Other" category';
    }

    if (isDriverDisbursement && !formData.driver_name) {
      newErrors.driver_name = 'Please select a driver for the disbursement';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, isDriverDisbursement]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
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
          driver_name: formData.driver_name || undefined,
        });
        onClose();
      } catch (error) {
        console.error('Error saving expense:', error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData, isDriverDisbursement, validateForm, onSave, onClose],
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Expense"
      label="Expense record"
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
            variant="primary"
            type="submit"
            form="expense-form"
            isLoading={isSubmitting}
          >
            Add Expense
          </Button>
        </div>
      }
    >
      <form id="expense-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Expense Details */}
        <section>
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-400">Expense Details</h3>
            <div className="space-y-3">
            <Select
              id="expense-vehicle"
              labelText="Vehicle"
              helperText="Optional — leave empty for general expenses"
              value={formData.vehicle_id}
              onChange={(e) => handleChange('vehicle_id', e.target.value)}
              disabled={isSubmitting}
            >
              <SelectItem value="" text="None (General expense)" />
              {vehicles.map((v) => (
                <SelectItem key={v.id} value={v.id} text={`${v.make_model} (${v.vin_number})`} />
              ))}
            </Select>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <NumberInput
                id="expense-amount"
                labelText="Amount *"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => handleChange('amount', e.target.value)}
                min={0.01}
                step={0.01}
                required
                disabled={isSubmitting}
                invalid={!!errors.amount}
                invalidText={errors.amount}
              />
              <Select
                id="expense-currency"
                labelText="Currency"
                value={formData.currency}
                onChange={(e) => handleChange('currency', e.target.value as Currency)}
                disabled={isSubmitting}
              >
                <SelectItem value={CURRENCIES.NAD} text="NAD (Namibia)" />
                <SelectItem value={CURRENCIES.GBP} text="GBP (UK)" />
                <SelectItem value={CURRENCIES.USD} text="USD (General)" />
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                id="expense-category"
                labelText="Category"
                value={formData.category}
                onChange={(e) => handleChange('category', e.target.value as ExpenseCategory)}
                disabled={isSubmitting}
              >
                <SelectItem value={EXPENSE_CATEGORIES.FUEL} text="Fuel" />
                <SelectItem value={EXPENSE_CATEGORIES.TOLLS} text="Tolls" />
                <SelectItem value={EXPENSE_CATEGORIES.FOOD} text="Food" />
                <SelectItem value={EXPENSE_CATEGORIES.REPAIRS} text="Repairs" />
                <SelectItem value={EXPENSE_CATEGORIES.DUTY} text="Duty" />
                <SelectItem value={EXPENSE_CATEGORIES.SHIPPING} text="Shipping" />
                <SelectItem
                  value={EXPENSE_CATEGORIES.DRIVER_DISBURSEMENT}
                  text="💰 Driver Disbursement"
                />
                <SelectItem value={EXPENSE_CATEGORIES.OTHER} text="Other" />
              </Select>
              <Select
                id="expense-location"
                labelText="Location"
                value={formData.location}
                onChange={(e) => handleChange('location', e.target.value as VehicleStatus)}
                disabled={isSubmitting}
              >
                <SelectItem value={VEHICLE_STATUS.UK} text="UK" />
                <SelectItem value={VEHICLE_STATUS.NAMIBIA} text="Namibia" />
                <SelectItem value={VEHICLE_STATUS.ZIMBABWE} text="Zimbabwe" />
                <SelectItem value={VEHICLE_STATUS.BOTSWANA} text="Botswana" />
              </Select>
            </div>
          </div>
        </div>
        </section>

        {/* Driver Info */}
        <section>
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-400">Description & Notes</h3>
            <div className="space-y-3">
            {/* Driver Disbursement */}
            {isDriverDisbursement && (
              <>
                <InlineNotification
                  kind="warning"
                  title="Driver disbursement"
                  subtitle="Money will be recorded as disbursed to the selected driver for trip expenses."
                  hideCloseButton
                />
                <Select
                  id="expense-driver"
                  labelText="Driver *"
                  helperText="Money disbursed to this driver for trip expenses"
                  value={formData.driver_name}
                  onChange={(e) => handleChange('driver_name', e.target.value)}
                  required={isDriverDisbursement}
                  disabled={isSubmitting}
                  invalid={!!errors.driver_name}
                  invalidText={errors.driver_name}
                >
                  <SelectItem value="" text="-- Select Driver --" />
                  {DRIVERS.map((d) => (
                    <SelectItem key={d} value={d} text={d} />
                  ))}
                </Select>
              </>
            )}

            <TextArea
              id="expense-description"
              labelText={
                formData.category === EXPENSE_CATEGORIES.OTHER ? 'Description *' : 'Description'
              }
              placeholder={
                formData.category === EXPENSE_CATEGORIES.OTHER
                  ? 'Please specify the type of expense'
                  : 'E.g. Full tank at Engen Windhoek'
              }
              rows={3}
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              required={formData.category === EXPENSE_CATEGORIES.OTHER}
              disabled={isSubmitting}
              invalid={!!errors.description}
              invalidText={errors.description}
            />

            {Object.keys(errors).length > 0 && (
              <InlineNotification
                kind="error"
                title="Please fix the errors"
                subtitle="Review the highlighted fields and try again."
              />
            )}
          </div>
        </div>
        </section>
      </form>
    </Modal>
  );
});

ExpenseModal.displayName = 'ExpenseModal';

export default ExpenseModal;
