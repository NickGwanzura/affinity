import React, { useState, useEffect } from 'react';
import {
  Modal,
  TextInput,
  TextArea,
  Select,
  SelectItem,
  Button,
  NumberInput,
  Tag,
} from '../ui';
import { Plus, Trash2 } from 'lucide-react';
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
      label="Invoice"
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
      <div className="space-y-6">
        {/* Invoice Number (when editing) */}
        {editingInvoice && (
          <section>
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 flex items-center gap-3">
              <span className="font-mono text-sm font-semibold text-emerald-600">
                {editingInvoice.invoice_number}
              </span>
              <Tag type="blue" size="sm">
                {formData.invoice_kind}
              </Tag>
            </div>
          </section>
        )}

        {/* Client Section */}
        <section>
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-400">
              Client Information
            </h3>

            <div className="space-y-3">
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

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TextInput
                  id="invoice-client-name"
                  labelText="Client Name *"
                  value={formData.client_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, client_name: e.target.value }))}
                  required
                />
                <TextInput
                  id="invoice-client-email"
                  labelText="Email"
                  type="email"
                  value={formData.client_email}
                  onChange={(e) => setFormData(prev => ({ ...prev, client_email: e.target.value }))}
                />
              </div>

              <TextArea
                id="invoice-client-address"
                labelText="Address"
                value={formData.client_address}
                onChange={(e) => setFormData(prev => ({ ...prev, client_address: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
        </section>

        {/* Invoice Details */}
        <section>
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-400">
              Invoice Details
            </h3>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

            <Select
              id="invoice-currency"
              labelText="Currency"
              value={formData.currency}
              onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value as any }))}
            >
              <SelectItem value="USD" text="USD ($)" />
              <SelectItem value="GBP" text="GBP (£)" />
            </Select>

            <TextInput
              id="invoice-due-date"
              labelText="Due Date *"
              type="date"
              value={formData.due_date}
              onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
              required
            />

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

            <TextInput
              id="invoice-batch"
              labelText="Batch Code (Optional)"
              value={formData.batch}
              onChange={(e) => setFormData(prev => ({ ...prev, batch: e.target.value }))}
              placeholder="e.g., BATCH-001"
            />
          </div>
          </div>
        </section>

        {/* Line Items */}
        <section>
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
            <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-400">
              Line Items
            </h3>
            <Button
              variant="ghost"
              size="sm"
              renderIcon={Plus}
              onClick={addLineItem}
            >
              Add Line Item
            </Button>
          </div>

          <div className="space-y-3">
            {lineItems.map((item, index) => (
              <div
                key={item.id || index}
                className="rounded-xl border border-stone-200 bg-white p-4"
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                  <div className="sm:col-span-4">
                    <TextInput
                      id={`line-desc-${index}`}
                      labelText="Description *"
                      value={item.description}
                      onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                      placeholder="Item description"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <NumberInput
                      id={`line-qty-${index}`}
                      labelText="Qty"
                      value={item.quantity}
                      onChange={(_e, { value }) => updateLineItem(index, 'quantity', Number(value))}
                      min={1}
                      step={1}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <NumberInput
                      id={`line-price-${index}`}
                      labelText="Unit Price"
                      value={item.unit_price}
                      onChange={(_e, { value }) => updateLineItem(index, 'unit_price', Number(value))}
                      min={0}
                      step={0.01}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <NumberInput
                      id={`line-discount-${index}`}
                      labelText="Discount %"
                      value={item.discount_percentage}
                      onChange={(_e, { value }) => updateLineItem(index, 'discount_percentage', clampDiscount(Number(value)))}
                      min={0}
                      max={100}
                      step={0.01}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <NumberInput
                      id={`line-tax-${index}`}
                      labelText="Tax %"
                      value={item.tax_rate}
                      onChange={(_e, { value }) => updateLineItem(index, 'tax_rate', Number(value))}
                      min={0}
                      step={0.01}
                    />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="text-sm font-semibold text-zinc-900">
                    Amount: {formatMoney(calculateLineAmount(item), formData.currency)}
                  </div>
                  <div className="flex items-center gap-2">
                    {item.discount_percentage > 0 && (
                      <span className="text-xs text-zinc-500">
                        Discount: {formatMoney((item.quantity * item.unit_price * item.discount_percentage) / 100, formData.currency)}
                      </span>
                    )}
                    {lineItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLineItem(index)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-red-500 hover:bg-red-50 transition-colors"
                        aria-label="Remove line item"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary Strip */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <InvoiceSummaryCell label="Subtotal" value={formatMoney(totals.subtotal, formData.currency)} />
            <InvoiceSummaryCell label="Discounts" value={`-${formatMoney(totals.discount, formData.currency)}`} accent="success" />
            <InvoiceSummaryCell label="Tax" value={formatMoney(totals.tax, formData.currency)} />
            <InvoiceSummaryCell label="Total" value={formatMoney(totals.total, formData.currency)} emphasis />
          </div>

          {/* Dark Total Bar */}
          <div className="mt-3 rounded-xl py-3 px-4 bg-zinc-900 flex justify-between items-center">
            <span className="font-semibold text-sm text-zinc-400">
              Invoice Total
            </span>
            <span className="font-bold text-lg text-white">
              {formatMoney(totals.total, formData.currency)}
            </span>
          </div>
          </div>
        </section>

        {/* Notes & Terms */}
        <section>
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-400">
              Notes &amp; Terms
            </h3>

            <div className="space-y-3">
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
                labelText="Terms &amp; Conditions"
                value={formData.terms_and_conditions}
                onChange={(e) => setFormData(prev => ({ ...prev, terms_and_conditions: e.target.value }))}
                rows={3}
                placeholder="Payment terms and conditions"
              />
            </div>
          </div>
        </section>
      </div>
    </Modal>
  );
};

// ── Summary cell helper ──────────────────────────────────────────────

const invoiceCellAccent: Record<string, string> = {
  error: 'text-red-600',
  success: 'text-emerald-500',
  warning: 'text-amber-700',
};

const InvoiceSummaryCell: React.FC<{
  label: string;
  value: string;
  emphasis?: boolean;
  accent?: 'error' | 'success' | 'warning';
}> = ({ label, value, emphasis, accent }) => (
  <div className="rounded-lg border border-stone-200 bg-white px-3 py-3 text-center">
    <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-600">
      {label}
    </div>
    <div className={`font-bold ${emphasis ? 'text-lg' : 'text-sm'} ${accent ? invoiceCellAccent[accent] : 'text-zinc-900'}`}>
      {value}
    </div>
  </div>
);

export default InvoiceModal;
