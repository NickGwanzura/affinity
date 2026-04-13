import React, { useState, useEffect } from 'react';
import {
  ComposedModal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  TextInput,
  TextArea,
  Select,
  SelectItem,
  Button,
  Stack,
  Grid,
  Column,
  Dropdown,
  NumberInput,
  DatePicker,
  DatePickerInput,
  Tag,
  Section,
  Heading,
} from '@carbon/react';
import { Add, TrashCan, Currency } from '@carbon/icons-react';
import type { Invoice, Client, Vehicle, LineItem } from '../../types';

interface LineItemDraft {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percentage: number;
  tax_rate: number;
}

interface InvoiceFormData {
  invoice_kind: 'Standard' | 'Deposit' | 'Final';
  vehicle_id: string;
  client_id: string;
  client_name: string;
  client_email: string;
  client_address: string;
  currency: 'USD' | 'GBP';
  description: string;
  notes: string;
  terms_and_conditions: string;
  due_date: string;
  status: 'Draft' | 'Sent' | 'Paid' | 'Overdue' | 'Cancelled';
  batch: string;
}

type LineItemSubmit = Omit<LineItemDraft, 'id'>;

interface CarbonInvoiceModalProps {
  open: boolean;
  editingInvoice: Invoice | null;
  clients: Client[];
  vehicles: Vehicle[];
  onClose: () => void;
  onSubmit: (data: {
    form: InvoiceFormData;
    lineItems: LineItemSubmit[];
  }) => void;
}

const makeEmptyLineItem = (): LineItemDraft => ({
  id: crypto.randomUUID(),
  description: '',
  quantity: 1,
  unit_price: 0,
  discount_percentage: 0,
  tax_rate: 0,
});

const EMPTY_FORM: InvoiceFormData = {
  invoice_kind: 'Standard',
  vehicle_id: '',
  client_id: '',
  client_name: '',
  client_email: '',
  client_address: '',
  currency: 'USD',
  description: '',
  notes: '',
  terms_and_conditions: 'Payment is due by the date specified above. Please include the invoice number with your payment.',
  due_date: '',
  status: 'Draft',
  batch: '',
};

const clampDiscount = (value: number): number => Math.min(100, Math.max(0, value));

const calculateLineAmount = (item: LineItemDraft): number => {
  const subtotal = item.quantity * item.unit_price;
  const discount = (subtotal * item.discount_percentage) / 100;
  const net = subtotal - discount;
  const tax = (net * item.tax_rate) / 100;
  return net + tax;
};

const formatMoney = (amount: number, currency: 'USD' | 'GBP'): string => {
  const symbol = currency === 'GBP' ? '£' : '$';
  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const CarbonInvoiceModal: React.FC<CarbonInvoiceModalProps> = ({
  open,
  editingInvoice,
  clients,
  vehicles,
  onClose,
  onSubmit,
}) => {
  const [formData, setFormData] = useState<InvoiceFormData>(EMPTY_FORM);
  const [lineItems, setLineItems] = useState<LineItemDraft[]>(() => [makeEmptyLineItem()]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form when editing
  useEffect(() => {
    if (open && editingInvoice) {
      const items: LineItemDraft[] = editingInvoice.items?.length
        ? editingInvoice.items.map(item => ({
            id: item.id || crypto.randomUUID(),
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount_percentage: item.discount_percentage || 0,
            tax_rate: item.tax_rate || 0,
          }))
        : [{
            id: crypto.randomUUID(),
            description: editingInvoice.description || '',
            quantity: 1,
            unit_price: editingInvoice.amount_usd || 0,
            discount_percentage: 0,
            tax_rate: 0,
          }];

      setFormData({
        invoice_kind: editingInvoice.invoice_kind || 'Standard',
        vehicle_id: editingInvoice.vehicle_id || '',
        client_id: editingInvoice.client_id || '',
        client_name: editingInvoice.client_name || '',
        client_email: editingInvoice.client_email || '',
        client_address: editingInvoice.client_address || '',
        currency: (editingInvoice.currency as 'USD' | 'GBP') || 'USD',
        description: editingInvoice.description || '',
        notes: editingInvoice.notes || '',
        terms_and_conditions: editingInvoice.terms_and_conditions || EMPTY_FORM.terms_and_conditions,
        due_date: editingInvoice.due_date || '',
        status: editingInvoice.status || 'Sent',
        batch: editingInvoice.batch || '',
      });
      setLineItems(items);
    } else if (open && !editingInvoice) {
      setFormData(EMPTY_FORM);
      setLineItems([makeEmptyLineItem()]);
    }
  }, [open, editingInvoice]);

  const handleClientChange = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    setFormData(prev => ({
      ...prev,
      client_id: clientId,
      client_name: client?.name || prev.client_name,
      client_email: client?.email || prev.client_email,
      client_address: client?.address || prev.client_address,
    }));
  };

  const updateLineItem = (index: number, field: keyof LineItemDraft, value: string | number) => {
    setLineItems(prev =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              [field]: field === 'description' ? value : Number(value) || 0,
            }
          : item
      )
    );
  };

  const addLineItem = () => {
    setLineItems(prev => [...prev, makeEmptyLineItem()]);
  };

  const removeLineItem = (index: number) => {
    setLineItems(prev => prev.filter((_, i) => i !== index));
  };

  const totals = lineItems.reduce(
    (acc, item) => {
      const subtotal = item.quantity * item.unit_price;
      const discount = (subtotal * item.discount_percentage) / 100;
      const net = subtotal - discount;
      const tax = (net * item.tax_rate) / 100;
      return {
        subtotal: acc.subtotal + subtotal,
        discount: acc.discount + discount,
        tax: acc.tax + tax,
        total: acc.total + net + tax,
      };
    },
    { subtotal: 0, discount: 0, tax: 0, total: 0 }
  );

  const handleSubmit = async () => {
    if (!formData.client_name.trim() || !formData.due_date) return;
    
    const validItems = lineItems.filter(item => item.description.trim());
    if (validItems.length === 0) return;

    setIsSubmitting(true);
    try {
      // Strip local draft `id` before submitting — API uses its own id
      const submittableItems = validItems.map(({ id: _id, ...rest }) => rest);
      await onSubmit({
        form: formData,
        lineItems: submittableItems,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const clientDropdownItems = clients.map(c => ({
    id: c.id,
    label: c.company ? `${c.name} — ${c.company}` : c.name,
    client: c,
  }));

  const vehicleDropdownItems = [
    { id: '', label: 'No Vehicle (Custom Invoice)' },
    ...vehicles.map(v => ({
      id: v.id,
      label: `${v.make_model} (${v.vin_number})`,
    })),
  ];

  const canSubmit = 
    formData.client_name.trim() && 
    formData.due_date && 
    lineItems.some(item => item.description.trim()) &&
    !isSubmitting;

  return (
    <ComposedModal
      open={open}
      onClose={onClose}
      size="lg"
      preventCloseOnClickOutside
    >
      <ModalHeader
        title={editingInvoice ? `Edit Invoice ${editingInvoice.invoice_number}` : 'Create Invoice'}
        subtitle={editingInvoice 
          ? 'Update invoice details, line items, and status'
          : 'Create a new invoice with itemized charges and payment terms'
        }
      />
      
      <ModalBody hasScrollingContent>
        <Stack gap={7}>
          {/* Invoice Number (when editing) */}
          {editingInvoice && (
            <Section>
              <div
                style={{
                  padding: 'var(--cds-spacing-04, 0.75rem) var(--cds-spacing-05, 1rem)',
                  backgroundColor: 'var(--cds-layer-02, #f4f4f4)',
                  borderLeft: '3px solid var(--cds-support-success, #24a148)',
                }}
              >
                <span
                  style={{
                    fontFamily: 'IBM Plex Mono, monospace',
                    fontSize: 'var(--cds-heading-01-font-size, 0.875rem)',
                    fontWeight: 600,
                    color: 'var(--cds-support-success, #24a148)',
                  }}
                >
                  {editingInvoice.invoice_number}
                </span>
                <Tag type="blue" size="sm" style={{ marginLeft: 'var(--cds-spacing-03, 0.5rem)' }}>
                  {formData.invoice_kind}
                </Tag>
              </div>
            </Section>
          )}

          {/* Client Section */}
          <Section>
            <Heading
              style={{
                fontSize: 'var(--cds-heading-01-font-size, 0.875rem)',
                fontWeight: 600,
                marginBottom: 'var(--cds-spacing-04, 0.75rem)',
                color: 'var(--cds-text-primary, #161616)',
              }}
            >
              Client Information
            </Heading>
            
            <Stack gap={5}>
              <Dropdown
                id="invoice-client"
                titleText="Saved Client"
                label="Select an existing client or leave blank for a one-off invoice"
                items={clientDropdownItems}
                itemToString={(item) => item?.label || ''}
                selectedItem={clientDropdownItems.find(c => c.id === formData.client_id) || null}
                onChange={({ selectedItem }) => handleClientChange(selectedItem?.id || '')}
              />
              
              <Grid narrow>
                <Column sm={4} md={8} lg={8}>
                  <TextInput
                    id="invoice-client-name"
                    labelText="Client Name *"
                    value={formData.client_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, client_name: e.target.value }))}
                    required
                  />
                </Column>
                <Column sm={4} md={8} lg={8}>
                  <TextInput
                    id="invoice-client-email"
                    labelText="Email"
                    type="email"
                    value={formData.client_email}
                    onChange={(e) => setFormData(prev => ({ ...prev, client_email: e.target.value }))}
                  />
                </Column>
              </Grid>
              
              <TextArea
                id="invoice-client-address"
                labelText="Address"
                value={formData.client_address}
                onChange={(e) => setFormData(prev => ({ ...prev, client_address: e.target.value }))}
                rows={2}
              />
            </Stack>
          </Section>

          {/* Invoice Details */}
          <Section>
            <Heading
              style={{
                fontSize: 'var(--cds-heading-01-font-size, 0.875rem)',
                fontWeight: 600,
                marginBottom: 'var(--cds-spacing-04, 0.75rem)',
                color: 'var(--cds-text-primary, #161616)',
              }}
            >
              Invoice Details
            </Heading>
            
            <Grid narrow>
              <Column sm={4} md={4} lg={8}>
                <Select
                  id="invoice-kind"
                  labelText="Invoice Type"
                  value={formData.invoice_kind}
                  onChange={(e) => setFormData(prev => ({ ...prev, invoice_kind: e.target.value as any }))}
                >
                  <SelectItem value="Standard" text="Standard" />
                  <SelectItem value="Deposit" text="Deposit" />
                  <SelectItem value="Final" text="Final" />
                </Select>
              </Column>
              
              <Column sm={4} md={4} lg={8}>
                <Dropdown
                  id="invoice-vehicle"
                  titleText="Vehicle (Optional)"
                  label="Select vehicle"
                  items={vehicleDropdownItems}
                  itemToString={(item) => item?.label || ''}
                  selectedItem={vehicleDropdownItems.find(v => v.id === formData.vehicle_id) || vehicleDropdownItems[0]}
                  onChange={({ selectedItem }) => setFormData(prev => ({ ...prev, vehicle_id: selectedItem?.id || '' }))}
                />
              </Column>
              
              <Column sm={4} md={4} lg={8}>
                <Select
                  id="invoice-currency"
                  labelText="Currency"
                  value={formData.currency}
                  onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value as any }))}
                >
                  <SelectItem value="USD" text="USD ($)" />
                  <SelectItem value="GBP" text="GBP (£)" />
                </Select>
              </Column>
              
              <Column sm={4} md={4} lg={8}>
                <DatePicker
                  datePickerType="single"
                  value={formData.due_date}
                  onChange={([date]: Date[]) => {
                    if (date) {
                      setFormData(prev => ({ ...prev, due_date: date.toISOString().split('T')[0] }));
                    }
                  }}
                >
                  <DatePickerInput
                    id="invoice-due-date"
                    labelText="Due Date *"
                    placeholder="yyyy-mm-dd"
                    required
                  />
                </DatePicker>
              </Column>
              
              <Column sm={4} md={4} lg={8}>
                {editingInvoice ? (
                  <Select
                    id="invoice-status"
                    labelText="Status"
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                  >
                    <SelectItem value="Draft" text="Draft" />
                    <SelectItem value="Sent" text="Sent" />
                    <SelectItem value="Paid" text="Paid" />
                    <SelectItem value="Overdue" text="Overdue" />
                    <SelectItem value="Cancelled" text="Cancelled" />
                  </Select>
                ) : (
                  <Select
                    id="invoice-status"
                    labelText="Status"
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                  >
                    <SelectItem value="Draft" text="Draft" />
                    <SelectItem value="Sent" text="Sent" />
                  </Select>
                )}
              </Column>
              
              <Column sm={4} md={4} lg={8}>
                <TextInput
                  id="invoice-batch"
                  labelText="Batch Code (Optional)"
                  value={formData.batch}
                  onChange={(e) => setFormData(prev => ({ ...prev, batch: e.target.value }))}
                  placeholder="e.g., BATCH-001"
                />
              </Column>
            </Grid>
          </Section>

          {/* Line Items */}
          <Section>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--cds-spacing-04, 0.75rem)',
              }}
            >
              <Heading
                style={{
                  fontSize: 'var(--cds-heading-01-font-size, 0.875rem)',
                  fontWeight: 600,
                  color: 'var(--cds-text-primary, #161616)',
                }}
              >
                Line Items
              </Heading>
              <Button
                kind="ghost"
                size="sm"
                renderIcon={Add}
                onClick={addLineItem}
              >
                Add Line Item
              </Button>
            </div>

            <Stack gap={4}>
              {lineItems.map((item, index) => (
                <div
                  key={item.id || index}
                  style={{
                    padding: 'var(--cds-spacing-04, 0.75rem)',
                    backgroundColor: 'var(--cds-layer-02, #f4f4f4)',
                    borderLeft: '3px solid var(--cds-border-subtle, #c6c6c6)',
                  }}
                >
                  <Grid narrow>
                    <Column sm={4} md={6} lg={8}>
                      <TextInput
                        id={`line-desc-${index}`}
                        labelText="Description *"
                        value={item.description}
                        onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                        placeholder="Item description"
                      />
                    </Column>
                    <Column sm={2} md={3} lg={3}>
                      <NumberInput
                        id={`line-qty-${index}`}
                        label="Qty"
                        value={item.quantity}
                        onChange={(_e, { value }) => updateLineItem(index, 'quantity', Number(value))}
                        min={1}
                        step={1}
                        hideSteppers
                      />
                    </Column>
                    <Column sm={3} md={4} lg={4}>
                      <NumberInput
                        id={`line-price-${index}`}
                        label="Unit Price"
                        value={item.unit_price}
                        onChange={(_e, { value }) => updateLineItem(index, 'unit_price', Number(value))}
                        min={0}
                        step={0.01}
                        hideSteppers
                      />
                    </Column>
                    <Column sm={3} md={4} lg={4}>
                      <NumberInput
                        id={`line-discount-${index}`}
                        label="Discount %"
                        value={item.discount_percentage}
                        onChange={(_e, { value }) => updateLineItem(index, 'discount_percentage', clampDiscount(Number(value)))}
                        min={0}
                        max={100}
                        step={0.01}
                        hideSteppers
                      />
                    </Column>
                    <Column sm={3} md={4} lg={4}>
                      <NumberInput
                        id={`line-tax-${index}`}
                        label="Tax %"
                        value={item.tax_rate}
                        onChange={(_e, { value }) => updateLineItem(index, 'tax_rate', Number(value))}
                        min={0}
                        step={0.01}
                        hideSteppers
                      />
                    </Column>
                    <Column sm={3} md={4} lg={4}>
                      <div
                        style={{
                          padding: 'var(--cds-spacing-04, 0.75rem)',
                          backgroundColor: 'var(--cds-layer-01, #ffffff)',
                          fontWeight: 600,
                          textAlign: 'right',
                        }}
                      >
                        <div style={{ fontSize: 'var(--cds-label-01-font-size, 0.75rem)', color: 'var(--cds-text-secondary, #525252)' }}>
                          Amount
                        </div>
                        <div style={{ color: 'var(--cds-text-primary, #161616)' }}>
                          {formatMoney(calculateLineAmount(item), formData.currency)}
                        </div>
                      </div>
                    </Column>
                    <Column sm={1} md={1} lg={1} style={{ display: 'flex', alignItems: 'flex-end' }}>
                      {lineItems.length > 1 && (
                        <Button
                          kind="danger--ghost"
                          size="sm"
                          renderIcon={TrashCan}
                          iconDescription="Remove line item"
                          hasIconOnly
                          onClick={() => removeLineItem(index)}
                        />
                      )}
                    </Column>
                  </Grid>
                  
                  {item.discount_percentage > 0 && (
                    <p
                      style={{
                        fontSize: 'var(--cds-caption-01-font-size, 0.75rem)',
                        color: 'var(--cds-text-secondary, #525252)',
                        marginTop: 'var(--cds-spacing-02, 0.25rem)',
                      }}
                    >
                      Discount: {formatMoney((item.quantity * item.unit_price * item.discount_percentage) / 100, formData.currency)}
                    </p>
                  )}
                </div>
              ))}
            </Stack>

            {/* Totals */}
            <div
              style={{
                marginTop: 'var(--cds-spacing-05, 1rem)',
                padding: 'var(--cds-spacing-04, 0.75rem) var(--cds-spacing-05, 1rem)',
                backgroundColor: 'var(--cds-layer-02, #f4f4f4)',
                borderTop: '2px solid var(--cds-border-subtle, #c6c6c6)',
              }}
            >
              <div style={{ maxWidth: '300px', marginLeft: 'auto' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 'var(--cds-body-01-font-size, 0.875rem)',
                    color: 'var(--cds-text-secondary, #525252)',
                    marginBottom: 'var(--cds-spacing-02, 0.25rem)',
                  }}
                >
                  <span>Subtotal:</span>
                  <span>{formatMoney(totals.subtotal, formData.currency)}</span>
                </div>
                {totals.discount > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 'var(--cds-body-01-font-size, 0.875rem)',
                      color: 'var(--cds-support-success, #24a148)',
                      marginBottom: 'var(--cds-spacing-02, 0.25rem)',
                    }}
                  >
                    <span>Discounts:</span>
                    <span>-{formatMoney(totals.discount, formData.currency)}</span>
                  </div>
                )}
                {totals.tax > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 'var(--cds-body-01-font-size, 0.875rem)',
                      color: 'var(--cds-text-secondary, #525252)',
                      marginBottom: 'var(--cds-spacing-02, 0.25rem)',
                    }}
                  >
                    <span>Tax:</span>
                    <span>{formatMoney(totals.tax, formData.currency)}</span>
                  </div>
                )}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 'var(--cds-heading-03-font-size, 1.25rem)',
                    fontWeight: 600,
                    color: 'var(--cds-text-primary, #161616)',
                    paddingTop: 'var(--cds-spacing-03, 0.5rem)',
                    borderTop: '1px solid var(--cds-border-subtle, #c6c6c6)',
                    marginTop: 'var(--cds-spacing-03, 0.5rem)',
                  }}
                >
                  <span>Total:</span>
                  <span>{formatMoney(totals.total, formData.currency)}</span>
                </div>
              </div>
            </div>
          </Section>

          {/* Notes & Terms */}
          <Section>
            <Heading
              style={{
                fontSize: 'var(--cds-heading-01-font-size, 0.875rem)',
                fontWeight: 600,
                marginBottom: 'var(--cds-spacing-04, 0.75rem)',
                color: 'var(--cds-text-primary, #161616)',
              }}
            >
              Notes & Terms
            </Heading>
            
            <Stack gap={5}>
              <TextArea
                id="invoice-notes"
                labelText="Internal Notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                placeholder="Internal notes (not shown on invoice)"
              />
              
              <TextArea
                id="invoice-terms"
                labelText="Terms & Conditions"
                value={formData.terms_and_conditions}
                onChange={(e) => setFormData(prev => ({ ...prev, terms_and_conditions: e.target.value }))}
                rows={3}
                placeholder="Payment terms and conditions"
              />
            </Stack>
          </Section>
        </Stack>
      </ModalBody>

      <ModalFooter
        primaryButtonText={isSubmitting ? 'Saving...' : (editingInvoice ? 'Save Changes' : 'Create Invoice')}
        primaryButtonDisabled={!canSubmit}
        secondaryButtonText="Cancel"
        onRequestSubmit={handleSubmit}
        onRequestClose={onClose}
      />
    </ComposedModal>
  );
};

export default CarbonInvoiceModal;
