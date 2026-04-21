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

export interface CarbonPaymentModalProps {
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

export const CarbonPaymentModal: React.FC<CarbonPaymentModalProps> = ({
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
      label={
        editingPayment
          ? 'Update payment details and invoice allocations'
          : 'Record an inbound payment and immediately create a receipt'
      }
      size="lg"
      preventCloseOnClickOutside
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => onSubmit()}
            disabled={!canSubmit}
          >
            {isSubmitting ? 'Saving…' : editingPayment ? 'Save Changes' : 'Record Payment'}
          </Button>
        </div>
      }
    >
      <Stack gap={7}>
        {/* ── Client ──────────────────────────────────────────────── */}
        <section>
          <h2 className="text-base font-semibold text-gray-900" style={{ marginBottom: '0.75rem' }}>
            Client
          </h2>
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
          <div
            style={{
              padding: '1rem',
              backgroundColor: '#f4f4f4',
              border: '1px solid #e0e0e0',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.5rem',
              }}
            >
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#525252',
                }}
              >
                Client Balance Summary
              </span>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: '#525252',
                }}
              >
                Opening + Invoiced - Paid
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#525252' }}>Opening</div>
                <div style={{ fontWeight: 700 }}>{formatMoney(clientBalance.openingBalance, clientBalance.currency)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#525252' }}>Invoiced</div>
                <div style={{ fontWeight: 700 }}>{formatMoney(clientBalance.totalInvoiced, clientBalance.currency)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#525252' }}>Paid</div>
                <div style={{ fontWeight: 700, color: '#24a148' }}>
                  {formatMoney(clientBalance.totalPaid, clientBalance.currency)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#525252' }}>
                  {clientBalance.balance > 0 ? 'Due' : clientBalance.credit > 0 ? 'Credit' : 'Balance'}
                </div>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: '1.125rem',
                    color:
                      clientBalance.balance > 0
                        ? '#da1e28'
                        : clientBalance.credit > 0
                          ? '#24a148'
                          : '#161616',
                  }}
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
              <div
                style={{
                  marginTop: '0.5rem',
                  padding: '0.5rem',
                  backgroundColor: '#fcf4d6',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <AlertTriangle size={14} />
                Client has no outstanding balance. Payment will be recorded as credit.
              </div>
            )}
          </div>
        )}

        {/* ── Payment Details ─────────────────────────────────────── */}
        <section>
          <h2 className="text-base font-semibold text-gray-900" style={{ marginBottom: '0.75rem' }}>
            Payment Details
          </h2>

          <Grid narrow>
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
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '1px',
              background: '#e0e0e0',
              border: '1px solid #e0e0e0',
            }}
          >
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              background: '#fff1f1',
              borderLeft: '3px solid #da1e28',
              color: '#da1e28',
            }}
          >
            <AlertTriangle size={16} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
              Allocated amount exceeds payment total
            </span>
          </div>
        )}

        {/* ── Allocations ─────────────────────────────────────────── */}
        {formData.client_name && (
          <section>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.75rem',
              }}
            >
              <h2 className="text-base font-semibold text-gray-900">
                Allocations{' '}
                <span
                  style={{
                    fontWeight: 400,
                    fontSize: '0.75rem',
                    color: '#525252',
                  }}
                >
                  (Optional)
                </span>
              </h2>
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

            <p
              style={{
                fontSize: '0.75rem',
                color: '#525252',
                marginBottom: '0.75rem',
              }}
            >
              Split this payment across open invoices.
            </p>

            <Stack gap={4}>
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
                    style={{
                      padding: '0.75rem',
                      backgroundColor: '#f4f4f4',
                      borderLeft: '3px solid #c6c6c6',
                    }}
                  >
                    <Grid narrow>
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
                          <p
                            style={{
                              fontSize: '0.75rem',
                              color: '#525252',
                              marginTop: '0.25rem',
                            }}
                          >
                            Outstanding: {formatMoney(selectedInvoice.outstandingAmount, selectedInvoice.invoice.currency)}
                          </p>
                        )}
                      </Column>
                      <Column sm={1} md={1} lg={2} style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <IconButton
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 size={14} />}
                          label="Remove allocation"
                          onClick={() => removeAllocation(index)}
                          style={{ color: '#da1e28' }}
                        />
                      </Column>
                    </Grid>
                  </div>
                );
              })}
            </Stack>

            {/* Allocated Total */}
            <div
              style={{
                marginTop: '0.75rem',
                padding: '0.75rem 1rem',
                backgroundColor: '#161616',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  color: '#525252',
                }}
              >
                Allocated Total
              </span>
              <span style={{ fontWeight: 700, color: '#ffffff' }}>
                {formatMoney(totalAllocated, formData.currency)}
              </span>
            </div>

            {/* No invoices available notice */}
            {allocationCandidates.length === 0 && (
              <div
                style={{
                  marginTop: '0.75rem',
                  padding: '0.75rem',
                  backgroundColor: '#ffffff',
                  border: '1px solid #c6c6c6',
                }}
              >
                <p
                  style={{
                    fontSize: '0.875rem',
                    color: '#525252',
                  }}
                >
                  No pending invoices found for this client in {formData.currency}.
                </p>
                <p
                  style={{
                    marginTop: '0.25rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: '#f1c21b',
                  }}
                >
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

const accentColor = {
  error: '#da1e28',
  success: '#24a148',
  warning: '#8e4e00',
};

const SummaryCell: React.FC<{
  label: string;
  value: string;
  emphasis?: boolean;
  accent?: 'error' | 'success' | 'warning';
}> = ({ label, value, emphasis, accent }) => (
  <div
    style={{
      background: '#f4f4f4',
      padding: '0.875rem 1rem',
      textAlign: 'center',
    }}
  >
    <div
      style={{
        fontSize: '0.6875rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: '#525252',
        marginBottom: '0.25rem',
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontSize: emphasis ? '1.125rem' : '0.9375rem',
        fontWeight: 700,
        color: accent ? accentColor[accent] : '#161616',
      }}
    >
      {value}
    </div>
  </div>
);

export default CarbonPaymentModal;
