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
  Section,
  Heading,
  Tag,
} from '@carbon/react';
import { Add, TrashCan } from '@carbon/icons-react';
import type { Quote, Client, Vehicle } from '../../types';

interface LineItemDraft {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percentage: number;
  tax_rate: number;
}

interface QuoteFormData {
  vehicle_id: string;
  client_id: string;
  client_name: string;
  client_email: string;
  client_address: string;
  currency: 'USD' | 'GBP';
  description: string;
  valid_until: string;
  status: 'Draft' | 'Sent' | 'Accepted' | 'Rejected';
}

type LineItemSubmit = Omit<LineItemDraft, 'id'>;

interface CarbonQuoteModalProps {
  open: boolean;
  editingQuote: Quote | null;
  clients: Client[];
  vehicles: Vehicle[];
  onClose: () => void;
  onSubmit: (data: {
    form: QuoteFormData;
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

const EMPTY_FORM: QuoteFormData = {
  vehicle_id: '',
  client_id: '',
  client_name: '',
  client_email: '',
  client_address: '',
  currency: 'USD',
  description: '',
  valid_until: '',
  status: 'Draft',
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

export const CarbonQuoteModal: React.FC<CarbonQuoteModalProps> = ({
  open,
  editingQuote,
  clients,
  vehicles,
  onClose,
  onSubmit,
}) => {
  const [formData, setFormData] = useState<QuoteFormData>(EMPTY_FORM);
  const [lineItems, setLineItems] = useState<LineItemDraft[]>(() => [makeEmptyLineItem()]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form when editing
  useEffect(() => {
    if (open && editingQuote) {
      const items: LineItemDraft[] = editingQuote.items?.length
        ? editingQuote.items.map(item => ({
            id: item.id || crypto.randomUUID(),
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount_percentage: item.discount_percentage || 0,
            tax_rate: item.tax_rate || 0,
          }))
        : [{
            id: crypto.randomUUID(),
            description: editingQuote.description || '',
            quantity: 1,
            unit_price: editingQuote.amount_usd || 0,
            discount_percentage: 0,
            tax_rate: 0,
          }];

      setFormData({
        vehicle_id: editingQuote.vehicle_id || '',
        client_id: editingQuote.client_id || '',
        client_name: editingQuote.client_name || '',
        client_email: editingQuote.client_email || '',
        client_address: editingQuote.client_address || '',
        currency: (editingQuote.currency as 'USD' | 'GBP') || 'USD',
        description: editingQuote.description || '',
        valid_until: editingQuote.valid_until || '',
        status: editingQuote.status || 'Draft',
      });
      setLineItems(items);
    } else if (open && !editingQuote) {
      setFormData(EMPTY_FORM);
      setLineItems([makeEmptyLineItem()]);
    }
  }, [open, editingQuote]);

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
    if (!formData.client_name.trim() || !formData.valid_until) return;
    
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
    { id: '', label: 'No Vehicle' },
    ...vehicles.map(v => ({
      id: v.id,
      label: `${v.make_model} (${v.vin_number})`,
    })),
  ];

  const getStatusTagType = (status: string) => {
    switch (status) {
      case 'Accepted': return 'green';
      case 'Rejected': return 'red';
      case 'Sent': return 'blue';
      default: return 'warm-gray';
    }
  };

  const canSubmit =
    formData.client_name.trim() &&
    formData.valid_until &&
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
        title={editingQuote ? `Edit Quote ${editingQuote.quote_number}` : 'Create Quote'}
        subtitle={editingQuote 
          ? 'Update quote details, line items, and status'
          : 'Create a new quote for a client'
        }
      />
      
      <ModalBody hasScrollingContent>
        <Stack gap={7}>
          {/* Quote Number (when editing) */}
          {editingQuote && (
            <Section>
              <div
                style={{
                  padding: 'var(--cds-spacing-04, 0.75rem) var(--cds-spacing-05, 1rem)',
                  backgroundColor: 'var(--cds-layer-02, #f4f4f4)',
                  borderLeft: '3px solid var(--cds-interactive, #0f62fe)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--cds-spacing-03, 0.5rem)',
                }}
              >
                <span
                  style={{
                    fontFamily: 'IBM Plex Mono, monospace',
                    fontSize: 'var(--cds-heading-01-font-size, 0.875rem)',
                    fontWeight: 600,
                    color: 'var(--cds-interactive, #0f62fe)',
                  }}
                >
                  {editingQuote.quote_number}
                </span>
                <Tag type={getStatusTagType(formData.status)} size="sm">
                  {formData.status}
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
                id="quote-client"
                titleText="Saved Client"
                label="Select an existing client or leave blank for a one-off quote"
                items={clientDropdownItems}
                itemToString={(item) => item?.label || ''}
                selectedItem={clientDropdownItems.find(c => c.id === formData.client_id) || null}
                onChange={({ selectedItem }) => handleClientChange(selectedItem?.id || '')}
              />
              
              <Grid narrow>
                <Column sm={4} md={8} lg={8}>
                  <TextInput
                    id="quote-client-name"
                    labelText="Client Name *"
                    value={formData.client_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, client_name: e.target.value }))}
                    required
                  />
                </Column>
                <Column sm={4} md={8} lg={8}>
                  <TextInput
                    id="quote-client-email"
                    labelText="Email"
                    type="email"
                    value={formData.client_email}
                    onChange={(e) => setFormData(prev => ({ ...prev, client_email: e.target.value }))}
                  />
                </Column>
              </Grid>
              
              <TextArea
                id="quote-client-address"
                labelText="Address"
                value={formData.client_address}
                onChange={(e) => setFormData(prev => ({ ...prev, client_address: e.target.value }))}
                rows={2}
              />
            </Stack>
          </Section>

          {/* Quote Details */}
          <Section>
            <Heading
              style={{
                fontSize: 'var(--cds-heading-01-font-size, 0.875rem)',
                fontWeight: 600,
                marginBottom: 'var(--cds-spacing-04, 0.75rem)',
                color: 'var(--cds-text-primary, #161616)',
              }}
            >
              Quote Details
            </Heading>
            
            <Grid narrow>
              <Column sm={4} md={4} lg={8}>
                <Dropdown
                  id="quote-vehicle"
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
                  id="quote-currency"
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
                  value={formData.valid_until}
                  onChange={([date]: Date[]) => {
                    if (date) {
                      setFormData(prev => ({ ...prev, valid_until: date.toISOString().split('T')[0] }));
                    }
                  }}
                >
                  <DatePickerInput
                    id="quote-valid-until"
                    labelText="Valid Until *"
                    placeholder="yyyy-mm-dd"
                    helperText="Required — the date after which this quote expires"
                  />
                </DatePicker>
              </Column>
              
              {editingQuote && (
                <Column sm={4} md={4} lg={8}>
                  <Select
                    id="quote-status"
                    labelText="Status"
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                  >
                    <SelectItem value="Draft" text="Draft" />
                    <SelectItem value="Sent" text="Sent" />
                    <SelectItem value="Accepted" text="Accepted" />
                    <SelectItem value="Rejected" text="Rejected" />
                  </Select>
                </Column>
              )}
            </Grid>

            <TextArea
              id="quote-description"
              labelText="Description / Notes"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={2}
              placeholder="Brief description of the quote"
              style={{ marginTop: 'var(--cds-spacing-05, 1rem)' }}
            />
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
                        id={`quote-line-desc-${index}`}
                        labelText="Description *"
                        value={item.description}
                        onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                        placeholder="Item description"
                      />
                    </Column>
                    <Column sm={2} md={3} lg={3}>
                      <NumberInput
                        id={`quote-line-qty-${index}`}
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
                        id={`quote-line-price-${index}`}
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
                        id={`quote-line-discount-${index}`}
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
                        id={`quote-line-tax-${index}`}
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
        </Stack>
      </ModalBody>

      <ModalFooter
        primaryButtonText={isSubmitting ? 'Saving...' : (editingQuote ? 'Save Changes' : 'Create Quote')}
        primaryButtonDisabled={!canSubmit}
        secondaryButtonText="Cancel"
        onRequestSubmit={handleSubmit}
        onRequestClose={onClose}
      />
    </ComposedModal>
  );
};

export default CarbonQuoteModal;
