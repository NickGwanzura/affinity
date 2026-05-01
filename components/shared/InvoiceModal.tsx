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
import { Plus, Trash2, DollarSign } from 'lucide-react';
import type { Invoice, Client, Vehicle } from '../../types';

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

interface InvoiceModalProps {
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

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
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

  const canSubmit =
    formData.client_name.trim() &&
    formData.due_date &&
    lineItems.some(item => item.description.trim()) &&
    !isSubmitting;

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={editingInvoice ? `Edit Invoice ${editingInvoice.invoice_number}` : 'Create Invoice'}
      label={editingInvoice
        ? 'Update invoice details, line items, and status'
        : 'Create a new invoice with itemized charges and payment terms'
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
            {isSubmitting ? 'Saving...' : (editingInvoice ? 'Save Changes' : 'Create Invoice')}
          </Button>
        </div>
      }
    >
      <Stack gap={7}>
        {/* Invoice Number (when editing) */}
        {editingInvoice && (
          <section>
            <div
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: '#ffffff',
                borderLeft: '3px solid #10b981',
              }}
            >
              <span
                className="font-mono"
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#10b981',
                }}
              >
                {editingInvoice.invoice_number}
              </span>
              <Tag type="blue" size="sm" style={{ marginLeft: '0.5rem' }}>
                {formData.invoice_kind}
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
              id="invoice-client"
              labelText="Saved Client"
              value={formData.client_id}
              onChange={(e) => handleClientChange(e.target.value)}
            >
              <SelectItem value="" text="Select an existing client or leave blank for a one-off invoice" />
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
        </section>

        {/* Invoice Details */}
        <section>
          <h2 className="text-base font-semibold text-gray-900" style={{ marginBottom: '0.75rem' }}>
            Invoice Details
          </h2>

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
              <Select
                id="invoice-vehicle"
                labelText="Vehicle (Optional)"
                value={formData.vehicle_id}
                onChange={(e) => setFormData(prev => ({ ...prev, vehicle_id: e.target.value }))}
              >
                <SelectItem value="" text="No Vehicle (Custom Invoice)" />
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
              <TextInput
                id="invoice-due-date"
                labelText="Due Date *"
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                required
              />
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
                  backgroundColor: '#ffffff',
                  borderLeft: '3px solid #d6d3d1',
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
                      labelText="Qty"
                      value={item.quantity}
                      onChange={(_e, { value }) => updateLineItem(index, 'quantity', Number(value))}
                      min={1}
                      step={1}
                    />
                  </Column>
                  <Column sm={3} md={4} lg={4}>
                    <NumberInput
                      id={`line-price-${index}`}
                      labelText="Unit Price"
                      value={item.unit_price}
                      onChange={(_e, { value }) => updateLineItem(index, 'unit_price', Number(value))}
                      min={0}
                      step={0.01}
                    />
                  </Column>
                  <Column sm={3} md={4} lg={4}>
                    <NumberInput
                      id={`line-discount-${index}`}
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
                      id={`line-tax-${index}`}
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
                      <div style={{ fontSize: '0.75rem', color: '#52525b' }}>
                        Amount
                      </div>
                      <div style={{ color: '#18181b' }}>
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
                        style={{ color: '#dc2626' }}
                      />
                    )}
                  </Column>
                </Grid>

                {item.discount_percentage > 0 && (
                  <p
                    style={{
                      fontSize: '0.75rem',
                      color: '#52525b',
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
              background: '#e7e5e4',
              border: '1px solid #e7e5e4',
            }}
          >
            <InvoiceSummaryCell label="Subtotal" value={formatMoney(totals.subtotal, formData.currency)} />
            {totals.discount > 0 && (
              <InvoiceSummaryCell label="Discounts" value={`-${formatMoney(totals.discount, formData.currency)}`} accent="success" />
            )}
            {totals.tax > 0 && (
              <InvoiceSummaryCell label="Tax" value={formatMoney(totals.tax, formData.currency)} />
            )}
            <InvoiceSummaryCell label="Total" value={formatMoney(totals.total, formData.currency)} emphasis />
          </div>

          {/* Dark Total Bar */}
          <div
            style={{
              marginTop: '0.75rem',
              padding: '0.75rem 1rem',
              backgroundColor: '#18181b',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                fontWeight: 600,
                fontSize: '0.875rem',
                color: '#52525b',
              }}
            >
              Invoice Total
            </span>
            <span style={{ fontWeight: 700, fontSize: '1.125rem', color: '#ffffff' }}>
              {formatMoney(totals.total, formData.currency)}
            </span>
          </div>
        </section>

        {/* Notes & Terms */}
        <section>
          <h2 className="text-base font-semibold text-gray-900" style={{ marginBottom: '0.75rem' }}>
            Notes & Terms
          </h2>

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
        </section>
      </Stack>
    </Modal>
  );
};

// ── Summary cell helper (matches PaymentModal style) ─────────────────

const invoiceAccentColor = {
  error: '#dc2626',
  success: '#10b981',
  warning: '#8e4e00',
};

const InvoiceSummaryCell: React.FC<{
  label: string;
  value: string;
  emphasis?: boolean;
  accent?: 'error' | 'success' | 'warning';
}> = ({ label, value, emphasis, accent }) => (
  <div
    style={{
      background: '#ffffff',
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
        color: '#52525b',
        marginBottom: '0.25rem',
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontSize: emphasis ? '1.125rem' : '0.9375rem',
        fontWeight: 700,
        color: accent ? invoiceAccentColor[accent] : '#18181b',
      }}
    >
      {value}
    </div>
  </div>
);

export default InvoiceModal;
