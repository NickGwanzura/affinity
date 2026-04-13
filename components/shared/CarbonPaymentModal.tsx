import React, { useState, useMemo } from 'react';
import {
  ComposedModal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  TextInput,
  Select,
  SelectItem,
  Button,
  Stack,
  Grid,
  Column,
  Tag,
  Dropdown,
  NumberInput,
} from '@carbon/react';
import { Add, TrashCan, Warning } from '@carbon/icons-react';
import type { Invoice, Payment, Client } from '../../types';

interface PaymentAllocationDraft {
  invoice_id: string;
  amount: string;
}

interface PaymentFormData {
  client_id: string;
  client_name: string;
  amount: string;
  currency: 'USD' | 'GBP';
  method: string;
  date: string;
  notes: string;
}

interface CarbonPaymentModalProps {
  open: boolean;
  editingPayment: Payment | null;
  clients: Client[];
  invoices: Invoice[];
  onClose: () => void;
  onSubmit: (data: {
    payment: PaymentFormData;
    allocations: PaymentAllocationDraft[];
    isUnallocated: boolean;
  }) => void;
  onDelete?: (paymentId: string) => void;
}

const PAYMENT_METHODS = [
  'Bank Transfer',
  'Cash',
  'Card',
  'Check',
  'Other',
];

const EMPTY_FORM: PaymentFormData = {
  client_id: '',
  client_name: '',
  amount: '',
  currency: 'USD',
  method: 'Bank Transfer',
  date: new Date().toISOString().split('T')[0],
  notes: '',
};

export const CarbonPaymentModal: React.FC<CarbonPaymentModalProps> = ({
  open,
  editingPayment,
  clients,
  invoices,
  onClose,
  onSubmit,
  onDelete,
}) => {
  const [formData, setFormData] = useState<PaymentFormData>(EMPTY_FORM);
  const [allocations, setAllocations] = useState<PaymentAllocationDraft[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form when editing
  React.useEffect(() => {
    if (open && editingPayment) {
      setFormData({
        client_id: editingPayment.client_id || '',
        client_name: editingPayment.client_name || '',
        amount: editingPayment.amount_usd.toString(),
        currency: editingPayment.currency || 'USD',
        method: editingPayment.method || 'Bank Transfer',
        date: editingPayment.date ? editingPayment.date.split('T')[0] : new Date().toISOString().split('T')[0],
        notes: editingPayment?.notes || '',
      });
      // Convert allocations
      const paymentAllocations = editingPayment.allocations?.map(a => ({
        invoice_id: a.invoice_id || '',
        amount: a.amount_allocated.toString(),
      })) || [];
      setAllocations(paymentAllocations.length > 0 ? paymentAllocations : []);
    } else if (open && !editingPayment) {
      setFormData(EMPTY_FORM);
      setAllocations([]);
    }
  }, [open, editingPayment]);

  const selectedClient = useMemo(() => {
    if (!formData.client_id) return null;
    return clients.find(c => c.id === formData.client_id);
  }, [formData.client_id, clients]);

  const clientInvoices = useMemo(() => {
    if (!selectedClient) return [];
    return invoices.filter(
      inv =>
        // Primary: match by client_id
        (inv.client_id === selectedClient.id ||
          // Fallback: name match for invoices without client_id (legacy data only)
          (!inv.client_id && inv.client_name?.toLowerCase() === selectedClient.name?.toLowerCase())) &&
        inv.currency === formData.currency &&
        inv.status !== 'Paid'
    );
  }, [selectedClient, invoices, formData.currency]);

  const totalAllocated = useMemo(() => {
    return allocations.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
  }, [allocations]);

  const paymentAmount = parseFloat(formData.amount) || 0;
  const remainingAmount = paymentAmount - totalAllocated;
  const isOverAllocated = totalAllocated > paymentAmount + 0.01;
  const isFullyAllocated = remainingAmount <= 0.01 && totalAllocated > 0;

  const handleClientChange = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    setFormData(prev => ({
      ...prev,
      client_id: clientId,
      client_name: client?.name || '',
    }));
    setAllocations([]);
  };

  const addAllocation = () => {
    setAllocations(prev => [...prev, { invoice_id: '', amount: '' }]);
  };

  const removeAllocation = (index: number) => {
    setAllocations(prev => prev.filter((_, i) => i !== index));
  };

  const updateAllocation = (index: number, field: keyof PaymentAllocationDraft, value: string) => {
    setAllocations(prev =>
      prev.map((a, i) => (i === index ? { ...a, [field]: value } : a))
    );
  };

  const handleSubmit = async () => {
    if (!formData.client_id || !formData.amount) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        payment: formData,
        allocations: allocations.filter(a => a.invoice_id && parseFloat(a.amount) > 0),
        isUnallocated: allocations.length === 0 || totalAllocated === 0,
      });
      // onSubmit is expected to call onClose — don't reset state after success
      // to avoid setting state on an unmounted component
    } catch (err) {
      setIsSubmitting(false); // only reset on error — success closes the modal
      throw err;
    }
  };

  const clientDropdownItems = clients.map(c => ({
    id: c.id,
    label: c.name,
  }));

  return (
    <ComposedModal
      open={open}
      onClose={onClose}
      size="lg"
      preventCloseOnClickOutside
    >
      <ModalHeader
        title={editingPayment ? 'Edit Payment' : 'Record Payment'}
        subtitle={editingPayment 
          ? 'Update payment details and invoice allocations'
          : 'Record a new payment from a client'
        }
      />
      
      <ModalBody hasScrollingContent>
        <Stack gap={6}>
          {/* Client Selection */}
          <section>
            <h4 style={{ 
              fontSize: 'var(--cds-heading-01-font-size, 0.875rem)', 
              fontWeight: 600,
              marginBottom: 'var(--cds-spacing-04, 0.75rem)',
              color: 'var(--cds-text-primary, #161616)'
            }}>
              Client Information
            </h4>
            <Dropdown
              id="payment-client"
              titleText="Client *"
              label="Select a client"
              items={clientDropdownItems}
              itemToString={(item) => item?.label || ''}
              selectedItem={clientDropdownItems.find(c => c.id === formData.client_id) || null}
              onChange={({ selectedItem }) => handleClientChange(selectedItem?.id || '')}
              disabled={!!editingPayment}
            />
          </section>

          {/* Payment Details */}
          <section>
            <h4 style={{ 
              fontSize: 'var(--cds-heading-01-font-size, 0.875rem)', 
              fontWeight: 600,
              marginBottom: 'var(--cds-spacing-04, 0.75rem)',
              color: 'var(--cds-text-primary, #161616)'
            }}>
              Payment Details
            </h4>
            <Grid narrow>
              <Column sm={4} md={4} lg={8}>
                <NumberInput
                  id="payment-amount"
                  label="Amount *"
                  value={formData.amount}
                  onChange={(_e, { value }) => setFormData(prev => ({ ...prev, amount: String(value) }))}
                  step={0.01}
                  min={0}
                  hideSteppers
                />
              </Column>
              <Column sm={4} md={4} lg={8}>
                <Select
                  id="payment-currency"
                  labelText="Currency"
                  value={formData.currency}
                  onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value as 'USD' | 'GBP' }))}
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
                  onChange={(e) => setFormData(prev => ({ ...prev, method: e.target.value }))}
                >
                  {PAYMENT_METHODS.map(method => (
                    <React.Fragment key={method}>
                      <SelectItem value={method} text={method} />
                    </React.Fragment>
                  ))}
                </Select>
              </Column>
              <Column sm={4} md={4} lg={8}>
                <TextInput
                  id="payment-date"
                  labelText="Date *"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                />
              </Column>
            </Grid>
          </section>

          {/* Summary Card */}
          {paymentAmount > 0 && (
            <section style={{ 
              backgroundColor: 'var(--cds-layer-02, #f4f4f4)', 
              padding: 'var(--cds-spacing-05, 1rem)',
              borderLeft: '3px solid var(--cds-interactive, #0f62fe)'
            }}>
              <Stack gap={3}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 'var(--cds-body-compact-01-font-size, 0.875rem)' }}>
                    Payment Amount
                  </span>
                  <span style={{ 
                    fontSize: 'var(--cds-heading-03-font-size, 1.25rem)', 
                    fontWeight: 600,
                    color: 'var(--cds-text-primary, #161616)'
                  }}>
                    {formData.currency === 'GBP' ? '£' : '$'}{paymentAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {totalAllocated > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 'var(--cds-body-compact-01-font-size, 0.875rem)' }}>
                      Allocated to Invoices
                    </span>
                    <span style={{ 
                      fontSize: 'var(--cds-heading-01-font-size, 0.875rem)', 
                      fontWeight: 600,
                      color: 'var(--cds-text-secondary, #525252)'
                    }}>
                      {formData.currency === 'GBP' ? '£' : '$'}{totalAllocated.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {remainingAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 'var(--cds-body-compact-01-font-size, 0.875rem)' }}>
                      Remaining (Client Credit)
                    </span>
                    <span style={{ 
                      fontSize: 'var(--cds-heading-01-font-size, 0.875rem)', 
                      fontWeight: 600,
                      color: 'var(--cds-support-warning, #f1c21b)'
                    }}>
                      {formData.currency === 'GBP' ? '£' : '$'}{remainingAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {isOverAllocated && (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 'var(--cds-spacing-03, 0.5rem)',
                    color: 'var(--cds-support-error, #da1e28)'
                  }}>
                    <Warning size={16} />
                    <span style={{ fontSize: 'var(--cds-body-compact-01-font-size, 0.875rem)' }}>
                      Allocated amount exceeds payment total
                    </span>
                  </div>
                )}
              </Stack>
            </section>
          )}

          {/* Invoice Allocations */}
          {selectedClient && (
            <section>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: 'var(--cds-spacing-04, 0.75rem)'
              }}>
                <h4 style={{ 
                  fontSize: 'var(--cds-heading-01-font-size, 0.875rem)', 
                  fontWeight: 600,
                  color: 'var(--cds-text-primary, #161616)'
                }}>
                  Invoice Allocations
                </h4>
                <Button
                  kind="ghost"
                  size="sm"
                  renderIcon={Add}
                  onClick={addAllocation}
                  disabled={clientInvoices.length === 0}
                >
                  Add Allocation
                </Button>
              </div>

              {clientInvoices.length === 0 ? (
                <div style={{ 
                  padding: 'var(--cds-spacing-05, 1rem)',
                  backgroundColor: 'var(--cds-layer-02, #f4f4f4)',
                  borderLeft: '3px solid var(--cds-support-warning, #f1c21b)'
                }}>
                  <Stack gap={2}>
                    <p style={{ fontSize: 'var(--cds-body-01-font-size, 0.875rem)' }}>
                      No open invoices found for this client in {formData.currency}.
                    </p>
                    <p style={{ 
                      fontSize: 'var(--cds-body-compact-01-font-size, 0.875rem)',
                      color: 'var(--cds-text-secondary, #525252)'
                    }}>
                      This payment will be recorded as <Tag type="warm-gray" size="sm">Unallocated</Tag> and will reduce the client's balance.
                    </p>
                  </Stack>
                </div>
              ) : allocations.length === 0 ? (
                <p style={{ 
                  fontSize: 'var(--cds-body-compact-01-font-size, 0.875rem)',
                  color: 'var(--cds-text-secondary, #525252)',
                  fontStyle: 'italic'
                }}>
                  No allocations added. Payment will be recorded as unallocated client credit.
                </p>
              ) : (
                <Stack gap={4}>
                  {allocations.map((allocation, index) => {
                    const selectedInvoice = clientInvoices.find(inv => inv.id === allocation.invoice_id);
                    const outstanding = selectedInvoice 
                      ? selectedInvoice.amount_usd - (selectedInvoice.amount_paid || 0)
                      : 0;
                    
                    return (
                      <Grid narrow key={index} style={{ 
                        padding: 'var(--cds-spacing-04, 0.75rem)',
                        backgroundColor: 'var(--cds-layer-02, #f4f4f4)'
                      }}>
                        <Column sm={4} md={6} lg={10}>
                          <Dropdown
                            id={`allocation-invoice-${index}`}
                            titleText="Invoice"
                            label="Select invoice"
                            items={clientInvoices.map(inv => ({
                              id: inv.id,
                              label: `${inv.invoice_number} · ${formData.currency === 'GBP' ? '£' : '$'}${outstanding.toLocaleString()} due`,
                              invoice: inv,
                            }))}
                            itemToString={(item) => item?.label || ''}
                            selectedItem={allocation.invoice_id 
                              ? { 
                                  id: allocation.invoice_id, 
                                  label: selectedInvoice?.invoice_number || '',
                                  invoice: selectedInvoice,
                                } 
                              : null
                            }
                            onChange={({ selectedItem }) => {
                              updateAllocation(index, 'invoice_id', selectedItem?.id || '');
                              // Auto-fill with outstanding amount if empty
                              if (selectedItem?.invoice && !allocation.amount) {
                                const outAmt = selectedItem.invoice.amount_usd - (selectedItem.invoice.amount_paid || 0);
                                updateAllocation(index, 'amount', outAmt.toString());
                              }
                            }}
                          />
                          {selectedInvoice && (
                            <p style={{ 
                              fontSize: 'var(--cds-label-01-font-size, 0.75rem)',
                              color: 'var(--cds-text-secondary, #525252)',
                              marginTop: 'var(--cds-spacing-02, 0.25rem)'
                            }}>
                              Outstanding: {formData.currency === 'GBP' ? '£' : '$'}{outstanding.toLocaleString()}
                            </p>
                          )}
                        </Column>
                        <Column sm={3} md={4} lg={5}>
                          <NumberInput
                            id={`allocation-amount-${index}`}
                            label="Amount"
                            value={allocation.amount}
                            onChange={(_e, { value }) => updateAllocation(index, 'amount', String(value))}
                            step={0.01}
                            min={0}
                            hideSteppers
                          />
                        </Column>
                        <Column sm={1} md={2} lg={1} style={{ display: 'flex', alignItems: 'flex-end' }}>
                          <Button
                            kind="danger--ghost"
                            size="sm"
                            renderIcon={TrashCan}
                            iconDescription="Remove allocation"
                            hasIconOnly
                            onClick={() => removeAllocation(index)}
                          />
                        </Column>
                      </Grid>
                    );
                  })}
                </Stack>
              )}
            </section>
          )}

          {/* Notes */}
          <section>
            <TextInput
              id="payment-notes"
              labelText="Notes"
              placeholder="Optional notes about this payment"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            />
          </section>
        </Stack>
      </ModalBody>

      <ModalFooter
        primaryButtonText={isSubmitting ? 'Saving...' : (editingPayment ? 'Save Changes' : 'Record Payment')}
        primaryButtonDisabled={
          !formData.client_id || 
          !formData.amount || 
          parseFloat(formData.amount) <= 0 ||
          isOverAllocated ||
          isSubmitting
        }
        secondaryButtonText="Cancel"
        onRequestSubmit={handleSubmit}
        onRequestClose={onClose}
      >
        {editingPayment && onDelete && (
          <Button
            kind="danger"
            size="sm"
            onClick={() => onDelete(editingPayment.id)}
            disabled={isSubmitting}
          >
            Delete Payment
          </Button>
        )}
      </ModalFooter>
    </ComposedModal>
  );
};

export default CarbonPaymentModal;
