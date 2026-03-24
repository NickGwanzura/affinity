import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Currency, Expense, ExpenseCategory, OperatingFund, Vehicle, VehicleStatus } from '../types';
import { EXCHANGE_RATES } from '../constants';
import { supabase } from '../services/supabaseService';
import { supabaseClient } from '../services/supabaseClient';
import { Button } from './ui';

type DriverLedgerEntry = {
  id: string;
  date: string;
  isCredit: boolean;
  title: string;
  subtitle: string;
  vehicleLabel: string;
  amount: number;
  currency: Currency;
  amountUsd: number;
  receiptUrl?: string;
};

const formatUsd = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value || 0);

const formatMoney = (value: number, currency: Currency) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value || 0);

export const DriverPortal: React.FC = () => {
  const [currentDriver, setCurrentDriver] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [driverExpenses, setDriverExpenses] = useState<Expense[]>([]);
  const [driverFunds, setDriverFunds] = useState<OperatingFund[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string>('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('NAD');
  const [category, setCategory] = useState<Exclude<ExpenseCategory, 'Driver Disbursement'>>('Fuel');
  const [location, setLocation] = useState<VehicleStatus>('Namibia');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadPortalData = async () => {
    try {
      setLoading(true);
      setUploadError('');

      const session = await supabase.getSession();
      const driverName = session?.user?.name?.trim();

      if (!driverName) {
        throw new Error('Unable to load your driver profile. Please sign in again.');
      }

      setCurrentDriver(driverName);

      const [vehicleData, expenseData, fundData] = await Promise.all([
        supabase.getVehicles(),
        supabase.getExpensesByDriver(driverName),
        supabase.getOperatingFundsByRecipient(driverName).catch(() => [] as OperatingFund[]),
      ]);

      setVehicles(vehicleData);
      setDriverExpenses(expenseData);
      setDriverFunds((fundData || []).filter((fund) => fund.type === 'Disbursed'));
    } catch (error: any) {
      setUploadError(error?.message || 'Failed to load your driver funds. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortalData();
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const vehicleNames = useMemo(() => {
    return new Map(vehicles.map((vehicle) => [vehicle.id, `${vehicle.make_model} (${vehicle.vin_number})`]));
  }, [vehicles]);

  const expenseDisbursements = useMemo(
    () => driverExpenses.filter((expense) => expense.category === 'Driver Disbursement'),
    [driverExpenses],
  );

  const drawdowns = useMemo(
    () => driverExpenses.filter((expense) => expense.category !== 'Driver Disbursement'),
    [driverExpenses],
  );

  const allocatedFromExpenseUsd = useMemo(
    () => expenseDisbursements.reduce((sum, expense) => sum + expense.amount * (expense.exchange_rate_to_usd || 1), 0),
    [expenseDisbursements],
  );

  const allocatedFromFundsUsd = useMemo(
    () => driverFunds.reduce((sum, fund) => sum + fund.amount * (EXCHANGE_RATES[fund.currency] || 1), 0),
    [driverFunds],
  );

  const spentUsd = useMemo(
    () => drawdowns.reduce((sum, expense) => sum + expense.amount * (expense.exchange_rate_to_usd || 1), 0),
    [drawdowns],
  );

  const allocatedUsd = allocatedFromExpenseUsd + allocatedFromFundsUsd;
  const availableUsd = allocatedUsd - spentUsd;

  const ledger = useMemo<DriverLedgerEntry[]>(() => {
    const allocationEntries: DriverLedgerEntry[] = expenseDisbursements.map((expense) => ({
      id: `expense-disbursement-${expense.id}`,
      date: expense.created_at,
      isCredit: true,
      title: 'Vehicle/Trip Disbursement',
      subtitle: expense.description || 'Driver funds allocated',
      vehicleLabel: expense.vehicle_id ? vehicleNames.get(expense.vehicle_id) || 'Assigned vehicle' : 'General allocation',
      amount: expense.amount,
      currency: expense.currency,
      amountUsd: expense.amount * (expense.exchange_rate_to_usd || 1),
    }));

    const operatingFundEntries: DriverLedgerEntry[] = driverFunds.map((fund) => ({
      id: `operating-fund-${fund.id}`,
      date: fund.date || fund.created_at,
      isCredit: true,
      title: 'Operating Fund Disbursement',
      subtitle: fund.description || fund.reference || 'Operating funds allocated',
      vehicleLabel: 'General allocation',
      amount: fund.amount,
      currency: fund.currency,
      amountUsd: fund.amount * (EXCHANGE_RATES[fund.currency] || 1),
    }));

    const drawdownEntries: DriverLedgerEntry[] = drawdowns.map((expense) => ({
      id: `expense-${expense.id}`,
      date: expense.created_at,
      isCredit: false,
      title: expense.category,
      subtitle: expense.description || 'Expense submitted',
      vehicleLabel: expense.vehicle_id ? vehicleNames.get(expense.vehicle_id) || 'Assigned vehicle' : 'General expense',
      amount: expense.amount,
      currency: expense.currency,
      amountUsd: expense.amount * (expense.exchange_rate_to_usd || 1),
      receiptUrl: expense.receipt_url,
    }));

    return [...allocationEntries, ...operatingFundEntries, ...drawdownEntries].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [drawdowns, driverFunds, expenseDisbursements, vehicleNames]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File size must be less than 10MB');
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    setUploadError('');

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.onerror = () => {
      setUploadError('Failed to read file. Please try again.');
    };
    reader.readAsDataURL(file);
  };

  const uploadReceipt = async (file: File): Promise<string | null> => {
    try {
      setUploading(true);
      setUploadError('');

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `receipts/${fileName}`;

      const { error } = await supabaseClient.storage
        .from('receipts')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        throw error;
      }

      const { data: urlData } = supabaseClient.storage.from('receipts').getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get public URL');
      }

      return urlData.publicUrl;
    } catch (error: any) {
      setUploadError(error.message || 'Failed to upload receipt. Please try again.');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const clearReceipt = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentDriver) {
      setUploadError('Your driver profile is not available right now. Please sign in again.');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setUploadError('Enter a valid amount to draw down.');
      return;
    }

    const amountUsd = parsedAmount * (EXCHANGE_RATES[currency] || 1);
    if (amountUsd > availableUsd + 0.001) {
      setUploadError(`This drawdown exceeds your available balance of ${formatUsd(availableUsd)}.`);
      return;
    }

    setSubmitting(true);
    setUploadError('');

    try {
      let receiptUrl: string | undefined;

      if (selectedFile) {
        receiptUrl = await uploadReceipt(selectedFile) || undefined;
        if (!receiptUrl) {
          setUploadError('Receipt upload failed, continuing without receipt. You may want to retry.');
        }
      }

      await supabase.addExpense({
        vehicle_id: selectedVehicle || undefined,
        description,
        amount: parsedAmount,
        currency,
        category,
        location,
        receipt_url: receiptUrl,
        driver_name: currentDriver,
      });

      await loadPortalData();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);

      setDescription('');
      setAmount('');
      clearReceipt();
    } catch (error: any) {
      setUploadError(error.message || 'Failed to submit expense. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="bg-white border border-zinc-200 rounded-3xl shadow-sm p-10 text-center">
          <div className="w-10 h-10 mx-auto mb-4 rounded-full border-2 border-zinc-300 border-t-zinc-900 animate-spin" />
          <p className="text-zinc-600 font-medium">Loading your funds and drawdowns...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <section className="bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_35%),linear-gradient(135deg,#111827_0%,#0f172a_45%,#164e63_100%)] rounded-[2rem] p-8 text-white shadow-2xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-emerald-200 text-sm uppercase tracking-[0.28em] font-semibold">Driver Funds</p>
            <h2 className="text-4xl font-black mt-3">Welcome back, {currentDriver}</h2>
            <p className="text-slate-300 mt-3 max-w-2xl">
              View every allocation made by admin or accounting, track what you have already spent, and submit the next drawdown from the balance available to you.
            </p>
          </div>
          <div className="bg-white/10 border border-white/15 rounded-3xl px-6 py-5 backdrop-blur-sm">
            <p className="text-slate-300 text-xs uppercase tracking-[0.25em] font-semibold">Available To Draw</p>
            <p className={`text-4xl font-black mt-2 ${availableUsd >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
              {formatUsd(availableUsd)}
            </p>
            <p className="text-slate-300 text-sm mt-2">
              {availableUsd > 0 ? 'You can submit expenses against this balance now.' : 'No available balance right now. Ask admin or accounting to top up your funds.'}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-zinc-400">Allocated</p>
          <p className="text-3xl font-black text-zinc-900 mt-3">{formatUsd(allocatedUsd)}</p>
          <p className="text-sm text-zinc-500 mt-2">
            {expenseDisbursements.length + driverFunds.length} allocation{expenseDisbursements.length + driverFunds.length === 1 ? '' : 's'} recorded for you
          </p>
        </div>
        <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-zinc-400">Spent</p>
          <p className="text-3xl font-black text-zinc-900 mt-3">{formatUsd(spentUsd)}</p>
          <p className="text-sm text-zinc-500 mt-2">
            {drawdowns.length} drawdown{drawdowns.length === 1 ? '' : 's'} submitted from the app
          </p>
        </div>
        <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-zinc-400">Allocations Mix</p>
          <p className="text-3xl font-black text-zinc-900 mt-3">{formatUsd(allocatedFromExpenseUsd)}</p>
          <p className="text-sm text-zinc-500 mt-2">
            Trip-specific disbursements plus {formatUsd(allocatedFromFundsUsd)} from operating fund top-ups
          </p>
        </div>
      </section>

      <section className="grid gap-8 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="px-6 py-6 border-b border-zinc-200 bg-zinc-50/80">
            <h3 className="text-2xl font-black text-zinc-900">Submit Drawdown</h3>
            <p className="text-zinc-500 mt-2">
              Every expense submitted here is tagged to your driver profile and deducted from your available funds.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {success && (
              <div className="bg-emerald-50 text-emerald-700 p-4 rounded-2xl border border-emerald-200 font-medium">
                Expense logged successfully and your drawdown balance has been refreshed.
              </div>
            )}

            {uploadError && (
              <div className="bg-rose-50 text-rose-700 p-4 rounded-2xl border border-rose-200 font-medium">
                {uploadError}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="vehicle-select" className="text-sm font-semibold text-zinc-700 block mb-2">
                  Vehicle <span className="text-zinc-400 text-xs">(Optional)</span>
                </label>
                <select
                  id="vehicle-select"
                  value={selectedVehicle}
                  onChange={(e) => setSelectedVehicle(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-zinc-200 bg-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
                >
                  <option value="">General drawdown</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.make_model} ({vehicle.vin_number})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="category-select" className="text-sm font-semibold text-zinc-700 block mb-2">Category</label>
                <select
                  id="category-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Exclude<ExpenseCategory, 'Driver Disbursement'>)}
                  className="w-full px-4 py-3 rounded-2xl border border-zinc-200 bg-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
                >
                  <option value="Fuel">Fuel</option>
                  <option value="Tolls">Tolls</option>
                  <option value="Food">Food</option>
                  <option value="Repairs">Repairs</option>
                  <option value="Duty">Duty</option>
                  <option value="Shipping">Shipping</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <label htmlFor="amount-input" className="text-sm font-semibold text-zinc-700 block mb-2">Amount</label>
                <input
                  id="amount-input"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  placeholder="0.00"
                  autoComplete="off"
                  className="w-full px-4 py-3 rounded-2xl border border-zinc-200 bg-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label htmlFor="currency-select" className="text-sm font-semibold text-zinc-700 block mb-2">Currency</label>
                <select
                  id="currency-select"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as Currency)}
                  className="w-full px-4 py-3 rounded-2xl border border-zinc-200 bg-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
                >
                  <option value="NAD">NAD</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                  <option value="BWP">BWP</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="location-select" className="text-sm font-semibold text-zinc-700 block mb-2">Location</label>
                <select
                  id="location-select"
                  value={location}
                  onChange={(e) => setLocation(e.target.value as VehicleStatus)}
                  className="w-full px-4 py-3 rounded-2xl border border-zinc-200 bg-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
                >
                  <option value="UK">UK</option>
                  <option value="Namibia">Namibia</option>
                  <option value="Zimbabwe">Zimbabwe</option>
                  <option value="Botswana">Botswana</option>
                </select>
              </div>

              <div>
                <label htmlFor="receipt-input" className="text-sm font-semibold text-zinc-700 block mb-2">
                  Receipt <span className="text-zinc-400 text-xs">(Optional)</span>
                </label>
                <input
                  id="receipt-input"
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="w-full px-4 py-[0.8rem] rounded-2xl border border-zinc-200 bg-white text-sm file:mr-4 file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:rounded-xl file:font-semibold"
                />
              </div>
            </div>

            <div>
              <label htmlFor="description-input" className="text-sm font-semibold text-zinc-700 block mb-2">Description</label>
              <textarea
                id="description-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="What is this expense for?"
                className="w-full px-4 py-3 rounded-2xl border border-zinc-200 bg-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none resize-none"
              />
            </div>

            {previewUrl && (
              <div className="rounded-3xl border border-zinc-200 p-4 bg-zinc-50">
                <div className="flex items-center justify-between gap-4 mb-3">
                  <p className="text-sm font-semibold text-zinc-700">Receipt preview</p>
                  <Button type="button" variant="danger" size="sm" onClick={clearReceipt}>
                    Remove
                  </Button>
                </div>
                <img src={previewUrl} alt="Receipt preview" className="max-h-72 rounded-2xl object-contain bg-white border border-zinc-200" />
              </div>
            )}

            <Button
              type="submit"
              fullWidth
              isLoading={submitting || uploading}
              disabled={availableUsd <= 0}
              className="w-full"
            >
              Submit Drawdown
            </Button>
          </form>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-zinc-200">
              <h3 className="text-xl font-black text-zinc-900">Latest Activity</h3>
              <p className="text-zinc-500 mt-1">Allocations and drawdowns tied to your profile</p>
            </div>

            <div className="divide-y divide-zinc-200">
              {ledger.length === 0 ? (
                <div className="p-6 text-zinc-500">
                  No funds or drawdowns are attached to your profile yet.
                </div>
              ) : (
                ledger.slice(0, 8).map((entry) => (
                  <div key={entry.id} className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-black text-zinc-900">{entry.title}</p>
                        <p className="text-sm text-zinc-600 mt-1">{entry.subtitle}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-zinc-500">
                          <span>{new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          <span className="w-1 h-1 rounded-full bg-zinc-300" />
                          <span>{entry.vehicleLabel}</span>
                          {entry.receiptUrl && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-zinc-300" />
                              <a href={entry.receiptUrl} target="_blank" rel="noreferrer" className="font-semibold text-cyan-700 hover:text-cyan-800">
                                Receipt
                              </a>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <p className={`text-sm font-black ${entry.isCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {entry.isCredit ? '+' : '-'}{formatMoney(entry.amount, entry.currency)}
                        </p>
                        <p className="text-xs text-zinc-500 mt-1">{formatUsd(entry.amountUsd)}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm p-6">
            <h3 className="text-xl font-black text-zinc-900">How It Works</h3>
            <div className="space-y-3 mt-4 text-sm text-zinc-600">
              <p>Funds become available here when an admin or accountant records a driver disbursement for your profile.</p>
              <p>Those allocations can be general or attached to a vehicle, and both show up in your activity feed.</p>
              <p>Every expense you submit from this portal is tagged to you and deducted from the available balance shown above.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
