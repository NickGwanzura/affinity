import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Save, Pencil } from 'lucide-react';
import { api } from '../../services/apiClient';
import { useToast } from '../Toast';
import { Button, TextInput, InlineNotification } from '../ui';
import { formatCurrency } from '../../utils/formatters';

interface ExchangeRate {
  currency: string;
  rate_to_usd: number;
}

const CURRENCY_LABELS: Record<string, string> = {
  USD: 'US Dollar',
  GBP: 'British Pound',
  NAD: 'Namibia Dollar',
  BWP: 'Botswana Pula',
  ZAR: 'South African Rand',
};

export const ExchangeRatesTab: React.FC = () => {
  const { showToast } = useToast();
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchRates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.request<ExchangeRate[]>('/exchange-rates');
      setRates(data);
    } catch {
      showToast('Failed to load exchange rates', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchRates(); }, [fetchRates]);

  const handleEdit = (currency: string, currentRate: number) => {
    setEditing(currency);
    setEditValue(String(currentRate));
  };

  const handleSave = async (currency: string) => {
    const rate = parseFloat(editValue);
    if (!Number.isFinite(rate) || rate <= 0) {
      showToast('Rate must be a positive number', 'error');
      return;
    }

    setSaving(true);
    try {
      await api.request<{ currency: string; rate_to_usd: number }>(
        `/exchange-rates?id=${currency}&rate=${rate}`,
        { method: 'PUT' }
      );
      showToast(`${currency} rate updated to ${rate}`, 'success');
      setEditing(null);
      // Refresh the list
      await fetchRates();
    } catch {
      showToast('Failed to update rate', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditing(null);
    setEditValue('');
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 app-shimmer rounded" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-zinc-900">Exchange Rates</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            All rates are relative to 1 USD. Updates take effect immediately.
          </p>
        </div>
        <Button size="sm" variant="ghost" leftIcon={<RefreshCw size={14} />} onClick={fetchRates}>
          Refresh
        </Button>
      </div>

      <InlineNotification kind="info" lowContrast>
        Exchange rates update automatically on the server at startup. Changes made here are applied
        instantly and do not require a deploy.
      </InlineNotification>

      <div className="border border-stone-200 rounded-lg overflow-hidden divide-y divide-stone-100">
        {rates.map((r) => {
          const isEditing = editing === r.currency;
          return (
            <div key={r.currency} className="flex items-center justify-between px-4 py-3 hover:bg-stone-50">
              <div>
                <span className="text-sm font-semibold text-zinc-900">{r.currency}</span>
                <span className="ml-2 text-xs text-zinc-500">{CURRENCY_LABELS[r.currency] || ''}</span>
              </div>

              <div className="flex items-center gap-3">
                {isEditing ? (
                  <>
                    <div className="w-28">
                      <TextInput
                        type="number"
                        step="0.001"
                        min="0.001"
                        value={editValue}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditValue(e.target.value)}
                        size="sm"
                      />
                    </div>
                    <Button
                      size="sm"
                      leftIcon={<Save size={14} />}
                      onClick={() => handleSave(r.currency)}
                      disabled={saving}
                    >
                      {saving ? 'Saving…' : 'Save'}
                    </Button>
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="text-xs text-zinc-500 hover:text-zinc-700"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-sm tabular-nums font-semibold text-zinc-800 w-20 text-right">
                      1 {r.currency} = {formatCurrency(r.rate_to_usd, 'USD')}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleEdit(r.currency, r.rate_to_usd)}
                      className="p-1.5 rounded text-zinc-400 hover:text-zinc-700 hover:bg-stone-100"
                      aria-label={`Edit ${r.currency} rate`}
                    >
                      <Pencil size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ExchangeRatesTab;
