import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Plus, Package, Calendar, MapPin, Phone, User, ClipboardList } from 'lucide-react';
import { Modal, Button, TextInput, Select, SelectItem, TextArea } from './ui';
import { formatCurrency, formatDate } from '../utils/formatters';
import { useToast } from './Toast';
import { api } from '../services/apiClient';

// ── Types ─────────────────────────────────────────────────────────────────

interface PickupRequest {
  id: string;
  request_number: string;
  requested_by: string;
  requested_by_name?: string;
  pickup_date: string;
  pickup_address: string;
  contact_name: string;
  contact_phone?: string;
  status: 'Pending' | 'Confirmed' | 'Collected' | 'Cancelled';
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface PickupItem {
  id: string;
  request_id: string;
  description: string;
  quantity: number;
  weight_kg?: number | null;
  notes?: string;
  created_at: string;
}

interface Stats {
  counts: {
    total: number;
    pending: number;
    confirmed: number;
    collected: number;
    cancelled: number;
    upcoming: number;
  };
  upcoming: PickupRequest[];
}

type Tab = 'overview' | 'requests';

const STATUS_BADGE: Record<string, string> = {
  Pending:   'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20',
  Confirmed: 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20',
  Collected: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20',
  Cancelled: 'bg-stone-50 text-zinc-400 ring-1 ring-stone-300',
};

const fmt = (n: number) => formatCurrency(n, 'USD');

// ── Component ─────────────────────────────────────────────────────────────

export const GoodsPickup: React.FC = () => {
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [requests, setRequests] = useState<PickupRequest[]>([]);
  const [items, setItems] = useState<Record<string, PickupItem[]>>({});

  // New request modal
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    pickup_date: '',
    pickup_address: '',
    contact_name: '',
    contact_phone: '',
    notes: '',
  });
  const [formItems, setFormItems] = useState<{ description: string; quantity: number; weight_kg: string }[]>([]);
  const [saving, setSaving] = useState(false);

  // ── Data fetching ─────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsData, requestsData] = await Promise.all([
        api.request<Stats>('/goods-pickup?resource=stats'),
        api.request<PickupRequest[]>('/goods-pickup?resource=requests'),
      ]);
      setStats(statsData);
      setRequests(requestsData);
    } catch {
      showToast('Failed to load goods pickup data', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── CRUD helpers ──────────────────────────────────────────────────────

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await api.request(`/goods-pickup?resource=requests&id=${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      showToast(`Request marked as ${status}`, 'success');
      fetchData();
    } catch {
      showToast('Failed to update status', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.request(`/goods-pickup?resource=requests&id=${id}`, { method: 'DELETE' });
      showToast('Request deleted', 'success');
      fetchData();
    } catch {
      showToast('Failed to delete request', 'error');
    }
  };

  const loadItems = async (requestId: string) => {
    if (items[requestId]) return;
    try {
      const data = await api.request<PickupItem[]>(`/goods-pickup?resource=items&requestId=${requestId}`);
      setItems(prev => ({ ...prev, [requestId]: data }));
    } catch {
      // silent
    }
  };

  // ── Form helpers ──────────────────────────────────────────────────────

  const addFormItem = () => {
    setFormItems(prev => [...prev, { description: '', quantity: 1, weight_kg: '' }]);
  };

  const updateFormItem = (index: number, field: string, value: string | number) => {
    setFormItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const removeFormItem = (index: number) => {
    setFormItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!formData.pickup_date || !formData.pickup_address || !formData.contact_name) {
      showToast('Please fill in required fields (date, address, contact)', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        items: formItems
          .filter(i => i.description.trim())
          .map(i => ({
            description: i.description,
            quantity: i.quantity,
            weight_kg: i.weight_kg ? parseFloat(i.weight_kg) : null,
          })),
      };

      await api.request('/goods-pickup?resource=requests', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      showToast('Pickup request created', 'success');
      setShowForm(false);
      setFormData({ pickup_date: '', pickup_address: '', contact_name: '', contact_phone: '', notes: '' });
      setFormItems([]);
      fetchData();
    } catch (err: any) {
      showToast(err?.message || 'Failed to create request', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Loading state ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="flex-1 h-24 app-shimmer rounded-xl" />)}
        </div>
        <div className="h-64 app-shimmer rounded-xl" />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-0 border-b border-stone-200">
          {(['overview', 'requests'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
                tab === t ? 'border-amber-500 text-amber-600' : 'border-transparent text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {t === 'overview' ? (
                <span className="flex items-center gap-1.5"><ClipboardList size={14} /> Overview</span>
              ) : (
                <span className="flex items-center gap-1.5"><Package size={14} /> All Requests</span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" leftIcon={<RefreshCw size={14} />} onClick={fetchData}>
            Refresh
          </Button>
          <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setShowForm(true)}>
            New Request
          </Button>
        </div>
      </div>

      {/* ── Overview Tab ───────────────────────────────────────────── */}

      {tab === 'overview' && stats && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Requests', value: stats.counts.total, color: 'text-zinc-900' },
              { label: 'Pending',        value: stats.counts.pending, color: 'text-amber-600' },
              { label: 'Upcoming',       value: stats.counts.upcoming, color: 'text-blue-600' },
              { label: 'Collected',      value: stats.counts.collected, color: 'text-emerald-600' },
            ].map(s => (
              <div key={s.label} className="bg-white border border-stone-200 rounded-xl px-4 py-3.5">
                <p className="text-xs text-zinc-500 font-medium">{s.label}</p>
                <p className={`text-2xl font-bold tabular-nums mt-1 ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {stats.upcoming.length > 0 && (
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-stone-100">
                <h3 className="text-sm font-semibold text-zinc-900">Upcoming Pickups</h3>
              </div>
              <div className="divide-y divide-stone-100">
                {stats.upcoming.map(r => (
                  <div key={r.id} className="px-4 py-3 flex items-center justify-between hover:bg-stone-50">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-900">{r.request_number}</span>
                        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${STATUS_BADGE[r.status]}`}>{r.status}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-zinc-500">
                        <span className="flex items-center gap-1"><Calendar size={12} />{r.pickup_date}</span>
                        <span className="flex items-center gap-1"><MapPin size={12} className="shrink-0" />{r.pickup_address}</span>
                        <span className="flex items-center gap-1"><User size={12} />{r.contact_name}</span>
                      </div>
                    </div>
                    <div className="flex gap-1.5 ml-3 shrink-0">
                      {r.status === 'Pending' && (
                        <Button size="xs" onClick={() => handleStatusChange(r.id, 'Confirmed')}>Confirm</Button>
                      )}
                      {r.status === 'Confirmed' && (
                        <Button size="xs" onClick={() => handleStatusChange(r.id, 'Collected')}>Collected</Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Requests Tab ──────────────────────────────────────────── */}

      {tab === 'requests' && (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          {requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-stone-100">
                <Package size={20} className="text-zinc-400" />
              </div>
              <p className="text-sm font-medium text-zinc-700">No pickup requests yet</p>
              <button onClick={() => setShowForm(true)} className="mt-2 text-xs font-medium text-[#D97706] hover:text-amber-700">
                Create your first request
              </button>
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {requests.map(r => (
                <details key={r.id} className="group" onToggle={() => { if ((document.querySelector(`#items-${r.id}`) as HTMLDetailsElement)?.open) loadItems(r.id); }}>
                  <summary className="px-4 py-3 flex items-center justify-between hover:bg-stone-50 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-900">{r.request_number}</span>
                        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${STATUS_BADGE[r.status]}`}>{r.status}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-zinc-500">
                        <span className="flex items-center gap-1"><Calendar size={12} />{r.pickup_date}</span>
                        <span className="flex items-center gap-1"><MapPin size={12} className="shrink-0" />{r.pickup_address}</span>
                        <span className="flex items-center gap-1"><User size={12} />{r.contact_name}</span>
                        {r.contact_phone && <span className="flex items-center gap-1"><Phone size={12} />{r.contact_phone}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1.5 ml-3 shrink-0">
                      {r.status === 'Pending' && (
                        <>
                          <Button size="xs" onClick={(e) => { e.stopPropagation(); handleStatusChange(r.id, 'Confirmed'); }}>Confirm</Button>
                          <Button size="xs" variant="danger" onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }}>Delete</Button>
                        </>
                      )}
                      {r.status === 'Confirmed' && (
                        <Button size="xs" onClick={(e) => { e.stopPropagation(); handleStatusChange(r.id, 'Collected'); }}>Collected</Button>
                      )}
                      {r.status === 'Pending' && (
                        <Button size="xs" variant="ghost" onClick={(e) => { e.stopPropagation(); handleStatusChange(r.id, 'Cancelled'); }}>Cancel</Button>
                      )}
                    </div>
                  </summary>

                  {/* Items list (lazy-loaded) */}
                  <div className="px-4 pb-3 pt-1 border-t border-stone-100">
                    {items[r.id] === undefined ? (
                      <div className="h-8 app-shimmer rounded" />
                    ) : items[r.id].length === 0 ? (
                      <p className="text-xs text-zinc-400 py-2">No items listed</p>
                    ) : (
                      <div className="mt-2 space-y-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Items</p>
                        {items[r.id].map(item => (
                          <div key={item.id} className="flex items-center gap-3 text-xs text-zinc-700 bg-stone-50 rounded px-3 py-2">
                            <span className="font-medium text-zinc-900">{item.quantity}×</span>
                            <span className="flex-1">{item.description}</span>
                            {item.weight_kg && <span className="text-zinc-400">{item.weight_kg} kg</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 text-[10px] text-zinc-400">
                      Created: {formatDate(r.created_at)}
                      {r.requested_by_name && <> · by {r.requested_by_name}</>}
                    </div>
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── New Request Modal ─────────────────────────────────────── */}

      <Modal open={showForm} onClose={() => setShowForm(false)} size="lg">
        <Modal.Header>
          <Modal.Title>New Goods Pickup Request</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-5">
            {/* Contact & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextInput
                label="Pickup Date *"
                type="date"
                value={formData.pickup_date}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, pickup_date: e.target.value }))}
              />
              <TextInput
                label="Contact Name *"
                value={formData.contact_name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, contact_name: e.target.value }))}
                placeholder="Full name"
              />
            </div>

            <TextInput
              label="Contact Phone"
              value={formData.contact_phone}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
              placeholder="+44..."
            />

            <TextArea
              label="Pickup Address *"
              value={formData.pickup_address}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData(prev => ({ ...prev, pickup_address: e.target.value }))}
              placeholder="Full address including postcode"
              rows={3}
            />

            <TextArea
              label="Notes"
              value={formData.notes}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Special instructions, access codes, etc."
              rows={2}
            />

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-zinc-900">Items to Pickup</span>
                <Button size="xs" variant="ghost" leftIcon={<Plus size={12} />} onClick={addFormItem}>
                  Add Item
                </Button>
              </div>
              {formItems.length === 0 && (
                <p className="text-xs text-zinc-400 italic">No items added yet (optional)</p>
              )}
              <div className="space-y-2">
                {formItems.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 bg-stone-50 rounded-lg">
                    <div className="flex-1">
                      <TextInput
                        size="sm"
                        placeholder="Description *"
                        value={item.description}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateFormItem(i, 'description', e.target.value)}
                      />
                    </div>
                    <div className="w-20">
                      <TextInput
                        size="sm"
                        type="number"
                        min={1}
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateFormItem(i, 'quantity', parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <div className="w-24">
                      <TextInput
                        size="sm"
                        type="number"
                        step="0.1"
                        min={0}
                        placeholder="kg"
                        value={item.weight_kg}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateFormItem(i, 'weight_kg', e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFormItem(i)}
                      className="mt-1.5 text-zinc-400 hover:text-red-500 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Creating…' : 'Create Request'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default GoodsPickup;
