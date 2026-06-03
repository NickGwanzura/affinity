import React, { useState, useMemo } from 'react';
import {
  Modal,
  TextInput,
  TextArea,
  Select,
  SelectItem,
  Button,
  IconButton,
  Stack,
  Grid,
  Column,
  NumberInput,
} from '../ui';
import { Plus, Trash2, AlertTriangle, Check } from 'lucide-react';
import type { Invoice, Payment } from '../../types';

// ── Types ────────────────────────────────────────────────────────────────────

interface PaymentAllocationDraft {
  invoice_id: string;
  amount: string;
}

interface ClientOption {
  id: string;
  name: string;
  isRegistered: boolean;
}

interface AllocationCandidate {
  invoice: Invoice;
  outstandingAmount: number;
}

interface ClientBalanceInfo {
  balance: number;
  credit: number;
  currency: 'USD' | 'GBP';
  openingBalance: number;
  totalInvoiced: number;
  totalPaid: number;
}

export interface PaymentFormData {
  client_id: string;
  client_name: string;
  currency: 'USD' | 'GBP';
  amount: string;
  method: string;
  date: string;
  notes: string;
}

export interface PaymentModalProps {
  open: boolean;
  editingPayment: Payment | null;
  clientOptions: ClientOption[];
  allocationCandidates: AllocationCandidate[];
  /** Pre-populated form data (state lifted from parent) */
  formData: PaymentFormData;
  allocations: PaymentAllocationDraft[];
  isSubmitting: boolean;
  /** Client balance info for the selected client */
  clientBalance: ClientBalanceInfo | null;
  onFormChange: (updates: Partial<PaymentFormData>) => void;
  onClientChange: (clientId: string, clientName: string) => void;
  onAllocationsChange: (allocations: PaymentAllocationDraft[]) => void;
  onClose: () => void;
  onSubmit: (e?: React.FormEvent) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const PAYMENT_METHODS = ['Bank Transfer', 'Cash', 'Card', 'Check', 'Other'];

const formatMoney = (amount: number, currency?: string) =>
  amount.toLocaleString('en-US', {
    style: 'currency',
    currency: currency === 'GBP' ? 'GBP' : 'USD',
  });

// ── Component ────────────────────────────────────────────────────────────────

export const PaymentModal: React.FC<PaymentModalProps> = ({
  open,
  editingPayment,
  clientOptions,
  allocationCandidates,
  formData,
  allocations,
  isSubmitting,
  clientBalance,
  onFormChange,
  onClientChange,
  onAllocationsChange,
  onClose,
  onSubmit,
}) => {
  // ── Derived state ────────────────────────────────────────────────────────

  const allocatedInvoiceIds = useMemo(
    () => new Set(allocations.map(a => a.invoice_id)),
    [allocations],
  );

  const totalAllocated = useMemo(
    () => allocations.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0),
    [allocations],
  );

  const paymentAmount = parseFloat(formData.amount) || 0;
  const remainingAmount = paymentAmount - totalAllocated;
  const isOverAllocated = totalAllocated > paymentAmount + 0.01;

  const canSubmit =
    !!formData.client_name.trim() &&
    !!formData.amount &&
    paymentAmount > 0 &&
    !!formData.date &&
    !isOverAllocated &&
    !isSubmitting;

  // ── Allocation helpers ───────────────────────────────────────────────────

  const addAllocationRow = () => {
    onAllocationsChange([...allocations, { invoice_id: '', amount: '' }]);
  };

  const updateAllocationInvoice = (index: number, invoiceId: string) => {
    const candidate = allocationCandidates.find(c => c.invoice.id === invoiceId);
    const next = allocations.map((entry, i) =>
      i === index
        ? {
            ...entry,
            invoice_id: invoiceId,
            amount: entry.amount || (candidate ? candidate.outstandingAmount.toFixed(2) : ''),
          }
        : entry,
    );
    onAllocationsChange(next);
  };

  const updateAllocationAmount = (index: number, value: string) => {
    const next = allocations.map((entry, i) =>
      i === index ? { ...entry, amount: value } : entry,
    );
    onAllocationsChange(next);
  };

  const removeAllocation = (index: number) => {
    const next =
      allocations.length === 1
        ? [{ invoice_id: '', amount: '' }]
        : allocations.filter((_, i) => i !== index);
    onAllocationsChange(next);
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={editingPayment ? 'Edit Payment' : 'Record Payment'}
      label="Payment record"
      size="lg"
      preventCloseOnClickOutside
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => onSubmit()}
            disabled={!canSubmit}
            isLoading={isSubmitting}
          >
            {editingPayment ? 'Save Changes' : 'Record Payment'}
          </Button>
        </div>
      }
    >
      <Stack gap={3}>
        {/* ── Client ──────────────────────────────────────────────── */}
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Client
          </h3>
          <Select
            id="payment-client"
            labelText="Client *"
            value={formData.client_id}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
              const opt = clientOptions.find(c => c.id === e.target.value);
              onClientChange(e.target.value, opt?.name || '');
            }}
            disabled={!!editingPayment}
          >
            <SelectItem value="" text="Select a client" />
            {clientOptions.map(c => (
              <SelectItem
                key={c.id}
                value={c.id}
                text={`${c.name}${!c.isRegistered ? ' (unregistered)' : ''}`}
              />
            ))}
          </Select>
        </section>

        {/* ── Client Balance ──────────────────────────────────────── */}
        {clientBalance && formData.client_name && (
          <div className="rounded-lg bg-white border border-stone-200 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-[0.05em] text-zinc-600">
                Client Balance Summary
              </span>
              <span className="text-xs text-zinc-600">
                Opening + Invoiced - Paid
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
              <div>
                <div className="text-xs text-zinc-600">Opening</div>
                <div className="font-bold">{formatMoney(clientBalance.openingBalance, clientBalance.currency)}</div>
              </div>
              <div>
                <div className="text-xs text-zinc-600">Invoiced</div>
                <div className="font-bold">{formatMoney(clientBalance.totalInvoiced, clientBalance.currency)}</div>
              </div>
              <div>
                <div className="text-xs text-zinc-600">Paid</div>
                <div className="font-bold text-emerald-500">
                  {formatMoney(clientBalance.totalPaid, clientBalance.currency)}
                </div>
              </div>
              <div>
                <div className="text-xs text-zinc-600">
                  {clientBalance.balance > 0 ? 'Due' : clientBalance.credit > 0 ? 'Credit' : 'Balance'}
                </div>
                <div
                  className={[
                    'text-lg font-bold',
                    clientBalance.balance > 0
                      ? 'text-red-600'
                      : clientBalance.credit > 0
                        ? 'text-emerald-500'
                        : 'text-zinc-900',
                  ].join(' ')}
                >
                  {clientBalance.balance > 0
                    ? formatMoney(clientBalance.balance, clientBalance.currency)
                    : clientBalance.credit > 0
                      ? formatMoney(clientBalance.credit, clientBalance.currency)
                      : formatMoney(0, clientBalance.currency)}
                </div>
              </div>
            </div>
            {clientBalance.balance <= 0 && clientBalance.credit === 0 && (
              <div className="mt-2 p-2 bg-amber-100 text-xs flex items-center gap-2">
                <AlertTriangle size={14} />
                Client has no outstanding balance. Payment will be recorded as credit.
              </div>
            )}
          </div>
        )}

        {/* ── Payment Details ─────────────────────────────────────── */}
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Payment Details
          </h3>

          <Grid>
            <Column sm={4} md={4} lg={8}>
              <NumberInput
                id="payment-amount"
                labelText="Amount *"
                value={formData.amount}
                onChange={(_e: any, { value }: any) => onFormChange({ amount: String(value) })}
                step={0.01}
                min={0}
              />
            </Column>
            <Column sm={4} md={4} lg={8}>
              <Select
                id="payment-currency"
                labelText="Currency"
                value={formData.currency}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  onFormChange({ currency: e.target.value as 'USD' | 'GBP' })
                }
              >
                <SelectItem value="USD" text="USD ($)" />
                <SelectItem value="GBP" text="GBP (£)" />
              </Select>
            </Column>
            <Column sm={4} md={4} lg={8}>
              <Select
                id="payment-method"
                labelText="Payment Method"
                value={formData.method}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  onFormChange({ method: e.target.value })
                }
              >
                {PAYMENT_METHODS.map(m => (
                  <SelectItem key={m} value={m} text={m} />
                ))}
              </Select>
            </Column>
            <Column sm={4} md={4} lg={8}>
              <TextInput
                id="payment-date"
                labelText="Payment Date *"
                type="date"
                value={formData.date}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onFormChange({ date: e.target.value })
                }
              />
            </Column>
          </Grid>
        </section>

        {/* ── Allocation Summary ──────────────────────────────────── */}
        {paymentAmount > 0 && (
          <div className="grid grid-cols-3 gap-2">
            <SummaryCell label="Payment Total" value={formatMoney(paymentAmount, formData.currency)} emphasis />
            <SummaryCell label="Allocated" value={formatMoney(totalAllocated, formData.currency)} />
            <SummaryCell
              label={
                isOverAllocated
                  ? 'Over-allocated'
                  : remainingAmount <= 0.01 && totalAllocated > 0
                    ? 'Fully Allocated'
                    : 'Unallocated'
              }
              value={formatMoney(Math.abs(remainingAmount), formData.currency)}
              accent={
                isOverAllocated
                  ? 'error'
                  : remainingAmount <= 0.01 && totalAllocated > 0
                    ? 'success'
                    : 'warning'
              }
            />
          </div>
        )}

        {isOverAllocated && (
          <div className="flex items-center gap-2 py-3 px-4 bg-red-100 border-l-[3px] border-red-600 text-red-600">
            <AlertTriangle size={16} />
            <span className="text-sm font-semibold">
              Allocated amount exceeds payment total
            </span>
          </div>
        )}

        {/* ── Allocations ─────────────────────────────────────────── */}
        {formData.client_name && (
          <section>
            <div className="flex justify-between items-center mb-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Allocations{' '}
                <span className="font-normal normal-case tracking-normal text-zinc-400">
                  (Optional)
                </span>
              </h3>
              <Button
                variant="ghost"
                size="sm"
                renderIcon={Plus}
                onClick={addAllocationRow}
                disabled={!formData.client_name}
              >
                Add
              </Button>
            </div>

            <p className="text-xs text-zinc-600 mb-3">
              Split this payment across open invoices.
            </p>

            <Stack gap={3}>
              {allocations.map((allocation, index) => {
                const selectedInvoice = allocationCandidates.find(
                  c => c.invoice.id === allocation.invoice_id,
                );
                const invoiceOptions = allocationCandidates.filter(
                  c => !allocatedInvoiceIds.has(c.invoice.id) || c.invoice.id === allocation.invoice_id,
                );

                return (
                  <div
                    key={`${allocation.invoice_id || 'new'}-${index}`}
                    className="p-3 rounded-lg bg-white border border-stone-200"
                  >
                    <Grid>
                      <Column sm={4} md={5} lg={8}>
                        <Select
                          id={`alloc-invoice-${index}`}
                          labelText="Invoice"
                          value={allocation.invoice_id}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                            updateAllocationInvoice(index, e.target.value)
                          }
                        >
                          <SelectItem value="" text="Select invoice" />
                          {invoiceOptions.map(({ invoice, outstandingAmount }) => (
                            <SelectItem
                              key={invoice.id}
                              value={invoice.id}
                              text={`${invoice.invoice_number} · ${formatMoney(outstandingAmount, invoice.currency)} due${invoice.status === 'Paid' ? ' (Paid)' : ''}`}
                            />
                          ))}
                        </Select>
                      </Column>
                      <Column sm={3} md={4} lg={6}>
                        <NumberInput
                          id={`alloc-amount-${index}`}
                          labelText="Allocated Amount"
                          value={allocation.amount}
                          onChange={(_e: any, { value }: any) =>
                            updateAllocationAmount(index, String(value))
                          }
                          step={0.01}
                          min={0}
                        />
                        {selectedInvoice && (
                          <p className="text-xs text-zinc-600 mt-1">
                            Outstanding: {formatMoney(selectedInvoice.outstandingAmount, selectedInvoice.invoice.currency)}
                          </p>
                        )}
                      </Column>
                      <Column sm={1} md={1} lg={2} className="flex items-end">
                        <IconButton
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 size={14} />}
                          label="Remove allocation"
                          onClick={() => removeAllocation(index)}
                          className="text-red-600"
                        />
                      </Column>
                    </Grid>
                  </div>
                );
              })}
            </Stack>

            {/* Allocated Total */}
            <div className="mt-3 rounded-lg py-3 px-4 bg-zinc-900 flex justify-between items-center">
              <span className="font-semibold text-sm text-zinc-400">
                Allocated Total
              </span>
              <span className="font-bold text-white">
                {formatMoney(totalAllocated, formData.currency)}
              </span>
            </div>

            {/* No invoices available notice */}
            {allocationCandidates.length === 0 && (
              <div className="mt-3 p-3 rounded-lg bg-white border border-stone-200">
                <p className="text-sm text-zinc-600">
                  No pending invoices found for this client in {formData.currency}.
                </p>
                <p className="mt-1 text-sm font-semibold text-amber-500">
                  This payment will be recorded as UNALLOCATED (client credit).
                </p>
              </div>
            )}
          </section>
        )}

        {/* ── Notes ───────────────────────────────────────────────── */}
        <section>
          <TextArea
            id="payment-notes"
            labelText="Notes"
            value={formData.notes}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              onFormChange({ notes: e.target.value })
            }
            rows={2}
            placeholder="Optional receipt notes"
          />
        </section>
      </Stack>
    </Modal>
  );
};

// ── Summary cell helper ─────────────────────────────────────────────────────

const accentClasses = {
  error: 'text-red-600',
  success: 'text-emerald-500',
  warning: 'text-amber-700',
};

const SummaryCell: React.FC<{
  label: string;
  value: string;
  emphasis?: boolean;
  accent?: 'error' | 'success' | 'warning';
}> = ({ label, value, emphasis, accent }) => (
  <div className="bg-white border border-stone-200 rounded-md px-4 py-4 text-center">
    <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.05em] text-zinc-600 mb-1">
      {label}
    </div>
    <div
      className={[
        'font-bold',
        emphasis ? 'text-lg' : 'text-[0.9375rem]',
        accent ? accentClasses[accent] : 'text-zinc-900',
      ].join(' ')}
    >
      {value}
    </div>
  </div>
);

export default PaymentModal;
