import React, { useState, useEffect } from 'react';
import { CheckCircle, Package, MapPin, Calendar, Phone, Mail, Menu } from 'lucide-react';
import { Button, TextInput, TextArea } from './ui';
import affinityLogo from '../assets/affinity-logo.svg';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface PublicGoodsPickupProps {
  token?: string;
}

export const PublicGoodsPickup: React.FC<PublicGoodsPickupProps> = ({ token }) => {
  // View mode (token provided = viewing existing request)
  const [viewData, setViewData] = useState<any>(null);
  const [viewLoading, setViewLoading] = useState(!!token);
  const [viewError, setViewError] = useState('');

  // Create mode
  const [mode, setMode] = useState<'form' | 'success'>('form');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successToken, setSuccessToken] = useState('');
  const [successNumber, setSuccessNumber] = useState('');
  const [items, setItems] = useState<{ description: string; quantity: number }[]>([]);

  const [form, setForm] = useState({
    client_name: '',
    client_email: '',
    pickup_date: '',
    pickup_address: '',
    contact_phone: '',
    notes: '',
  });

  // Load existing request if token provided
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/public-goods-pickup?token=${encodeURIComponent(token)}`);
        if (!res.ok) throw new Error('Request not found');
        const data = await res.json();
        setViewData(data);
      } catch {
        setViewError('Invalid or expired link. Please contact the sender.');
      } finally {
        setViewLoading(false);
      }
    })();
  }, [token]);

  // ── Form helpers ─────────────────────────────────────────────────

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const addItem = () => {
    setItems(prev => [...prev, { description: '', quantity: 1 }]);
  };

  const updateItem = (index: number, field: string, value: string | number) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.client_name || !form.client_email || !form.pickup_date || !form.pickup_address) {
      setError('Please fill in all required fields.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/public-goods-pickup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          items: items.filter(i => i.description.trim()),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');

      setSuccessToken(data.share_token);
      setSuccessNumber(data.request_number);
      setMode('success');
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Token view mode ──────────────────────────────────────────────

  if (token) {
    return (
      <div className="login-shell">
        <div className="login-shell__brand">
          <div className="login-shell__brand-grid" />
          <div className="login-shell__brand-content">
            <div className="login-shell__brand-lockup">
              <img src={affinityLogo} alt="Affinity Logistics" className="login-shell__logo-image" />
            </div>
            <h2 className="login-shell__headline">
              Global Logistics,
              <br />
              <strong>Intelligent Transit.</strong>
            </h2>
          </div>
        </div>

        <div className="login-shell__panel">
          <div className="login-shell__panel-inner">
            <div className="login-shell__card">
              {viewLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="animate-spin h-8 w-8 border-2 border-[#D97706] border-t-transparent rounded-full" />
                </div>
              ) : viewError ? (
                <div className="py-16 text-center">
                  <Package size={40} className="mx-auto mb-3 text-zinc-300" />
                  <p className="text-sm text-zinc-500">{viewError}</p>
                </div>
              ) : viewData ? (
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <Package size={24} className="text-[#D97706]" />
                    <div>
                      <h3 className="text-lg font-bold text-zinc-900">{viewData.request_number}</h3>
                      <span className={`inline-block mt-1 px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                        viewData.status === 'Pending' ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20' :
                        viewData.status === 'Confirmed' ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20' :
                        viewData.status === 'Collected' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20' :
                        'bg-stone-50 text-zinc-400 ring-1 ring-stone-300'
                      }`}>{viewData.status}</span>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-2 text-zinc-600">
                      <Calendar size={14} className="mt-0.5 shrink-0" />
                      <span>{viewData.pickup_date}</span>
                    </div>
                    <div className="flex items-start gap-2 text-zinc-600">
                      <MapPin size={14} className="mt-0.5 shrink-0" />
                      <span>{viewData.pickup_address}</span>
                    </div>
                    <div className="flex items-start gap-2 text-zinc-600">
                      <Phone size={14} className="mt-0.5 shrink-0" />
                      <span>{viewData.contact_phone || 'Not provided'}</span>
                    </div>
                  </div>

                  {viewData.items?.length > 0 && (
                    <div className="mt-5 pt-4 border-t border-stone-200">
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">Items</p>
                      <div className="space-y-1.5">
                        {viewData.items.map((item: any, i: number) => (
                          <div key={i} className="text-sm text-zinc-700 flex gap-2">
                            <span className="font-medium text-zinc-900">{item.quantity}×</span>
                            <span>{item.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Success screen ──────────────────────────────────────────────

  if (mode === 'success') {
    return (
      <div className="login-shell">
        <div className="login-shell__brand">
          <div className="login-shell__brand-grid" />
          <div className="login-shell__brand-content">
            <div className="login-shell__brand-lockup">
              <img src={affinityLogo} alt="Affinity Logistics" className="login-shell__logo-image" />
            </div>
            <h2 className="login-shell__headline">
              Global Logistics,
              <br />
              <strong>Intelligent Transit.</strong>
            </h2>
          </div>
        </div>

        <div className="login-shell__panel">
          <div className="login-shell__panel-inner">
            <div className="login-shell__card">
              <div className="py-8 px-6 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
                  <CheckCircle size={28} className="text-emerald-600" />
                </div>
                <h3 className="text-lg font-bold text-zinc-900 mb-1">Request Submitted!</h3>
                <p className="text-sm text-zinc-500 mb-4">
                  Your goods pickup request <strong className="text-zinc-800">{successNumber}</strong> has been received.
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800 text-left">
                  <p className="font-medium mb-1">Save this link to check your status:</p>
                  <p className="break-all text-amber-700 select-all">
                    {window.location.origin}/?type=goods-pickup&token={successToken}
                  </p>
                </div>
                <p className="mt-4 text-xs text-zinc-400">
                  You will receive a confirmation email shortly. Our team will contact you to confirm the pickup.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Form mode (default) ─────────────────────────────────────────

  return (
    <div className="login-shell">
      <div className="login-shell__brand">
        <div className="login-shell__brand-grid" />
        <div className="login-shell__brand-content">
          <div className="login-shell__brand-lockup">
            <img src={affinityLogo} alt="Affinity Logistics" className="login-shell__logo-image" />
          </div>
          <h2 className="login-shell__headline">
            Global Logistics,
            <br />
            <strong>Intelligent Transit.</strong>
          </h2>
          <p className="login-shell__headline-copy">
            Request a goods pickup in the UK. Our logistics team will confirm and arrange collection.
          </p>
          <div className="login-shell__stats">
            {[
              { value: 'UK', label: 'Coverage' },
              { value: '24h', label: 'Response' },
              { value: 'Safe', label: 'Handling' },
              { value: 'Track', label: 'Online' },
            ].map(stat => (
              <div key={stat.label} className="login-shell__stat">
                <div className="login-shell__stat-value">{stat.value}</div>
                <div className="login-shell__stat-label">{stat.label.toUpperCase()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="login-shell__panel">
        <div className="login-shell__panel-inner">
          <div className="login-shell__card">
            <div className="login-shell__intro">
              <h3 className="login-shell__title">Request a Pickup</h3>
              <p className="login-shell__description">
                Fill in the details below and we'll arrange a collection from your UK location.
              </p>
            </div>

            {error && (
              <div className="px-6 mb-4">
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
              <TextInput
                label="Your Name *"
                value={form.client_name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('client_name', e.target.value)}
                placeholder="Full name"
              />

              <TextInput
                label="Email Address *"
                type="email"
                value={form.client_email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('client_email', e.target.value)}
                placeholder="you@example.com"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <TextInput
                  label="Pickup Date *"
                  type="date"
                  value={form.pickup_date}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('pickup_date', e.target.value)}
                />
                <TextInput
                  label="Phone Number"
                  type="tel"
                  value={form.contact_phone}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('contact_phone', e.target.value)}
                  placeholder="+44..."
                />
              </div>

              <TextArea
                label="Pickup Address *"
                value={form.pickup_address}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateField('pickup_address', e.target.value)}
                placeholder="Full UK address including postcode"
                rows={3}
              />

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-zinc-900">Items to Collect</span>
                  <button
                    type="button"
                    onClick={addItem}
                    className="text-xs font-medium text-[#D97706] hover:text-amber-700"
                  >
                    + Add item
                  </button>
                </div>
                {items.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 mb-2">
                    <div className="flex-1">
                      <TextInput
                        size="sm"
                        placeholder="Description"
                        value={item.description}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(i, 'description', e.target.value)}
                      />
                    </div>
                    <div className="w-20">
                      <TextInput
                        size="sm"
                        type="number"
                        min={1}
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(i, 'quantity', parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(i)}
                      className="mt-1.5 text-zinc-400 hover:text-red-500 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <TextArea
                label="Notes"
                value={form.notes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateField('notes', e.target.value)}
                placeholder="Special instructions, access codes, fragile items, etc."
                rows={2}
              />

              <Button type="submit" fullWidth disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit Pickup Request'}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicGoodsPickup;
