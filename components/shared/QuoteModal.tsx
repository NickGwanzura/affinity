import React, { useState, useEffect } from 'react';
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
  Tag,
} from '../ui';
import { Plus, Trash2 } from 'lucide-react';
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
    <Modal
      isOpen={open}
      onClose={onClose}
      title={editingQuote ? `Edit Quote ${editingQuote.quote_number}` : 'Create Quote'}
      label={editingQuote
        ? 'Update quote details, line items, and status'
        : 'Create a new quote for a client'
      }
      size="lg"
      preventCloseOnClickOutside
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isSubmitting ? 'Saving...' : (editingQuote ? 'Save Changes' : 'Create Quote')}
          </Button>
        </div>
      }
    >
      <Stack gap={7}>
        {/* Quote Number (when editing) */}
        {editingQuote && (
          <section>
            <div
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: '#f4f4f4',
                borderLeft: '3px solid #0f62fe',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span
                style={{
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#0f62fe',
                }}
              >
                {editingQuote.quote_number}
              </span>
              <Tag type={getStatusTagType(formData.status)} size="sm">
                {formData.status}
              </Tag>
            </div>
          </section>
        )}

        {/* Client Section */}
        <section>
          <h2 className="text-base font-semibold text-gray-900" style={{ marginBottom: '0.75rem' }}>
            Client Information
          </h2>

          <Stack gap={5}>
            <Select
              id="quote-client"
              labelText="Saved Client"
              value={formData.client_id}
              onChange={(e) => handleClientChange(e.target.value)}
            >
              <SelectItem value="" text="Select an existing client or leave blank for a one-off quote" />
              {clients.map(c => (
                <SelectItem
                  key={c.id}
                  value={c.id}
                  text={c.company ? `${c.name} — ${c.company}` : c.name}
                />
              ))}
            </Select>

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
        </section>

        {/* Quote Details */}
        <section>
          <h2 className="text-base font-semibold text-gray-900" style={{ marginBottom: '0.75rem' }}>
            Quote Details
          </h2>

          <Grid narrow>
            <Column sm={4} md={4} lg={8}>
              <Select
                id="quote-vehicle"
                labelText="Vehicle (Optional)"
                value={formData.vehicle_id}
                onChange={(e) => setFormData(prev => ({ ...prev, vehicle_id: e.target.value }))}
              >
                <SelectItem value="" text="No Vehicle" />
                {vehicles.map(v => (
                  <SelectItem
                    key={v.id}
                    value={v.id}
                    text={`${v.make_model} (${v.vin_number})`}
                  />
                ))}
              </Select>
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
              <TextInput
                id="quote-valid-until"
                labelText="Valid Until *"
                type="date"
                value={formData.valid_until}
                onChange={(e) => setFormData(prev => ({ ...prev, valid_until: e.target.value }))}
                helperText="Required — the date after which this quote expires"
              />
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
            style={{ marginTop: '1rem' }}
          />
        </section>

        {/* Line Items */}
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
              Line Items
            </h2>
            <Button
              variant="ghost"
              size="sm"
              renderIcon={Plus}
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
                  padding: '0.75rem',
                  backgroundColor: '#f4f4f4',
                  borderLeft: '3px solid #c6c6c6',
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
                      labelText="Qty"
                      value={item.quantity}
                      onChange={(_e, { value }) => updateLineItem(index, 'quantity', Number(value))}
                      min={1}
                      step={1}
                    />
                  </Column>
                  <Column sm={3} md={4} lg={4}>
                    <NumberInput
                      id={`quote-line-price-${index}`}
                      labelText="Unit Price"
                      value={item.unit_price}
                      onChange={(_e, { value }) => updateLineItem(index, 'unit_price', Number(value))}
                      min={0}
                      step={0.01}
                    />
                  </Column>
                  <Column sm={3} md={4} lg={4}>
                    <NumberInput
                      id={`quote-line-discount-${index}`}
                      labelText="Discount %"
                      value={item.discount_percentage}
                      onChange={(_e, { value }) => updateLineItem(index, 'discount_percentage', clampDiscount(Number(value)))}
                      min={0}
                      max={100}
                      step={0.01}
                    />
                  </Column>
                  <Column sm={3} md={4} lg={4}>
                    <NumberInput
                      id={`quote-line-tax-${index}`}
                      labelText="Tax %"
                      value={item.tax_rate}
                      onChange={(_e, { value }) => updateLineItem(index, 'tax_rate', Number(value))}
                      min={0}
                      step={0.01}
                    />
                  </Column>
                  <Column sm={3} md={4} lg={4}>
                    <div
                      style={{
                        padding: '0.75rem',
                        backgroundColor: '#ffffff',
                        fontWeight: 600,
                        textAlign: 'right',
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', color: '#525252' }}>
                        Amount
                      </div>
                      <div style={{ color: '#161616' }}>
                        {formatMoney(calculateLineAmount(item), formData.currency)}
                      </div>
                    </div>
                  </Column>
                  <Column sm={1} md={1} lg={1} style={{ display: 'flex', alignItems: 'flex-end' }}>
                    {lineItems.length > 1 && (
                      <IconButton
                        variant="ghost"
                        size="sm"
                        icon={<Trash2 size={14} />}
                        label="Remove line item"
                        onClick={() => removeLineItem(index)}
                        style={{ color: '#da1e28' }}
                      />
                    )}
                  </Column>
                </Grid>

                {item.discount_percentage > 0 && (
                  <p
                    style={{
                      fontSize: '0.75rem',
                      color: '#525252',
                      marginTop: '0.25rem',
                    }}
                  >
                    Discount: {formatMoney((item.quantity * item.unit_price * item.discount_percentage) / 100, formData.currency)}
                  </p>
                )}
              </div>
            ))}
          </Stack>

          {/* Summary Strip */}
          <div
            style={{
              marginTop: '1rem',
              display: 'grid',
              gridTemplateColumns: totals.discount > 0 && totals.tax > 0
                ? 'repeat(4, 1fr)'
                : totals.discount > 0 || totals.tax > 0
                  ? 'repeat(3, 1fr)'
                  : 'repeat(2, 1fr)',
              gap: '1px',
              background: '#e0e0e0',
              border: '1px solid #e0e0e0',
            }}
          >
            <QuoteSummaryCell label="Subtotal" value={formatMoney(totals.subtotal, formData.currency)} />
            {totals.discount > 0 && (
              <QuoteSummaryCell label="Discounts" value={`-${formatMoney(totals.discount, formData.currency)}`} accent="success" />
            )}
            {totals.tax > 0 && (
              <QuoteSummaryCell label="Tax" value={formatMoney(totals.tax, formData.currency)} />
            )}
            <QuoteSummaryCell label="Total" value={formatMoney(totals.total, formData.currency)} emphasis />
          </div>

          {/* Dark Total Bar */}
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
              Quote Total
            </span>
            <span style={{ fontWeight: 700, fontSize: '1.125rem', color: '#ffffff' }}>
              {formatMoney(totals.total, formData.currency)}
            </span>
          </div>
        </section>
      </Stack>
    </Modal>
  );
};

// ── Summary cell helper (matches CarbonPaymentModal style) ─────────────────

const quoteAccentColor = {
  error: '#da1e28',
  success: '#24a148',
  warning: '#8e4e00',
};

const QuoteSummaryCell: React.FC<{
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
        color: accent ? quoteAccentColor[accent] : '#161616',
      }}
    >
      {value}
    </div>
  </div>
);

export default CarbonQuoteModal;
