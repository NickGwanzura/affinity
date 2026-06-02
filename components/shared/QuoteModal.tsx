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

interface QuoteModalProps {
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

export const QuoteModal: React.FC<QuoteModalProps> = ({
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
      label="Quote"
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
            <div className="p-5 bg-white border-l-[3px] border-[#D97706] flex items-center gap-3">
              <span className="font-mono text-sm font-semibold text-[#D97706]">
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
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Client Information
          </h3>

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

            <Grid>
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
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Quote Details
          </h3>

          <Grid>
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

          <div className="mt-4">
            <TextArea
              id="quote-description"
              labelText="Description / Notes"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={2}
              placeholder="Brief description of the quote"
            />
          </div>
        </section>

        {/* Line Items */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
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

          <Stack gap={4}>
            {lineItems.map((item, index) => (
              <div
                key={item.id || index}
                className="p-5 bg-white border-l-[3px] border-stone-300"
              >
                <Grid>
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
                    <div className="bg-white px-3 py-3 text-right font-semibold">
                      <div className="text-xs text-zinc-500">Amount</div>
                      <div className="text-zinc-900">
                        {formatMoney(calculateLineAmount(item), formData.currency)}
                      </div>
                    </div>
                  </Column>
                  <Column sm={1} md={1} lg={1} className="flex items-end">
                    {lineItems.length > 1 && (
                      <IconButton
                        variant="ghost"
                        size="sm"
                        icon={<Trash2 size={14} />}
                        label="Remove line item"
                        onClick={() => removeLineItem(index)}
                        className="text-red-600"
                      />
                    )}
                  </Column>
                </Grid>

                {item.discount_percentage > 0 && (
                  <p className="mt-1 text-xs text-zinc-500">
                    Discount: {formatMoney((item.quantity * item.unit_price * item.discount_percentage) / 100, formData.currency)}
                  </p>
                )}
              </div>
            ))}
          </Stack>

          {/* Summary Strip */}
          <div className={`mt-5 grid gap-3 grid-cols-2 ${
            totals.discount > 0 && totals.tax > 0
              ? 'sm:grid-cols-4'
              : totals.discount > 0 || totals.tax > 0
                ? 'sm:grid-cols-3'
                : ''
          }`}>
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
          <div className="mt-4 py-4 px-5 bg-zinc-900 flex justify-between items-center">
            <span className="font-semibold text-sm text-zinc-400">
              Quote Total
            </span>
            <span className="font-bold text-lg text-white">
              {formatMoney(totals.total, formData.currency)}
            </span>
          </div>
        </section>
      </Stack>
    </Modal>
  );
};

// ── Summary cell helper ──────────────────────────────────────────────

const quoteCellAccent: Record<string, string> = {
  error: 'text-red-600',
  success: 'text-emerald-500',
  warning: 'text-amber-700',
};

const QuoteSummaryCell: React.FC<{
  label: string;
  value: string;
  emphasis?: boolean;
  accent?: 'error' | 'success' | 'warning';
}> = ({ label, value, emphasis, accent }) => (
  <div className="rounded-md border border-stone-200 bg-white px-4 py-4 text-center">
    <div className="mb-1 text-[0.6875rem] font-semibold uppercase tracking-[0.05em] text-zinc-600">
      {label}
    </div>
    <div className={`font-bold ${emphasis ? 'text-lg' : 'text-[0.9375rem]'} ${accent ? quoteCellAccent[accent] : 'text-zinc-900'}`}>
      {value}
    </div>
  </div>
);

export default QuoteModal;
