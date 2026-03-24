import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  InlineLoading,
  InlineNotification,
  Link,
  Select,
  SelectItem,
  Tag,
  TextArea,
  TextInput,
  Tile,
} from '@carbon/react';
import { Currency, Expense, ExpenseCategory, OperatingFund, Vehicle, VehicleStatus } from '../types';
import { EXCHANGE_RATES } from '../constants';
import { supabase } from '../services/supabaseService';
import { supabaseClient } from '../services/supabaseClient';
import { Button, StatCard } from './ui';
import { getDriverIdentityAliases } from '../utils/driverIdentity';

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

  const uniqueById = <T extends { id: string }>(items: T[]) => {
    const seen = new Set<string>();
    return items.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  };

  const loadPortalData = async () => {
    try {
      setLoading(true);
      setUploadError('');

      const session = await supabase.getSession();
      const driverAliases = getDriverIdentityAliases(session?.user);
      const driverName = session?.user?.name?.trim() || driverAliases[0];

      if (!driverName || driverAliases.length === 0) {
        throw new Error('Unable to load your driver profile. Please sign in again.');
      }

      setCurrentDriver(driverName);

      const [vehicleData, expenseDataGroups, fundDataGroups] = await Promise.all([
        supabase.getVehicles(),
        Promise.all(
          driverAliases.map((alias) =>
            supabase.getExpensesByDriver(alias).catch(() => [] as Expense[]),
          ),
        ),
        Promise.all(
          driverAliases.map((alias) =>
            supabase.getOperatingFundsByRecipient(alias).catch(() => [] as OperatingFund[]),
          ),
        ),
      ]);

      const expenseData = uniqueById(expenseDataGroups.flat());
      const fundData = uniqueById(fundDataGroups.flat());

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

  const openFilePicker = () => {
    fileInputRef.current?.click();
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <Tile style={{ padding: '2rem' }}>
          <div className="flex justify-center">
            <InlineLoading description="Loading your funds and drawdowns..." status="active" />
          </div>
        </Tile>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <Tile
        className="overflow-hidden"
        style={{
          padding: '1.5rem',
          background:
            'radial-gradient(circle at top left, rgba(69,137,255,0.2), transparent 34%), linear-gradient(135deg, #161616 0%, #262626 48%, #0f62fe 100%)',
          color: '#ffffff',
        }}
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Tag type="blue">Driver Funds</Tag>
              <Tag type={availableUsd > 0 ? 'green' : 'red'}>
                {availableUsd > 0 ? 'Ready To Draw' : 'Awaiting Allocation'}
              </Tag>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black mt-4 break-words">Welcome back, {currentDriver}</h2>
            <p className="text-sm sm:text-base text-slate-200 mt-3 max-w-3xl leading-6">
              View every driver-specific allocation from admin or accounting, track what has already been spent, and submit the next drawdown directly from your available balance.
            </p>
          </div>

          <div className="border border-white/15 bg-white/10 backdrop-blur-sm px-5 py-4 w-full lg:max-w-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-200">Available To Draw</p>
            <p className={`text-3xl sm:text-4xl font-black mt-3 ${availableUsd >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
              {formatUsd(availableUsd)}
            </p>
            <p className="text-sm text-slate-200 mt-3 leading-5">
              {availableUsd > 0
                ? 'You can submit expenses against this balance now.'
                : 'No balance is available right now. Ask admin or accounting to top up your driver funds.'}
            </p>
          </div>
        </div>
      </Tile>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Allocated"
          value={formatUsd(allocatedUsd)}
          subtitle={`${expenseDisbursements.length + driverFunds.length} allocation${expenseDisbursements.length + driverFunds.length === 1 ? '' : 's'} recorded`}
          color="blue"
        />
        <StatCard
          title="Spent"
          value={formatUsd(spentUsd)}
          subtitle={`${drawdowns.length} drawdown${drawdowns.length === 1 ? '' : 's'} submitted`}
          color="red"
        />
        <StatCard
          title="Allocation Mix"
          value={formatUsd(allocatedFromExpenseUsd)}
          subtitle={`Operating fund top-ups: ${formatUsd(allocatedFromFundsUsd)}`}
          color="green"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
        <Tile style={{ padding: '1.5rem' }}>
          <div className="space-y-6">
            <div>
              <h3 className="text-2xl font-black text-zinc-900">Submit Drawdown</h3>
              <p className="text-zinc-600 mt-2 leading-6">
                Every expense submitted here is tagged to your driver profile and deducted from your available funds.
              </p>
            </div>

            {success && (
              <InlineNotification
                kind="success"
                lowContrast
                hideCloseButton={false}
                title="Success"
                subtitle="Expense logged successfully and your drawdown balance has been refreshed."
                onClose={() => setSuccess(false)}
              />
            )}

            {uploadError && (
              <InlineNotification
                kind="error"
                lowContrast
                hideCloseButton={false}
                title="Could not complete request"
                subtitle={uploadError}
                onClose={() => setUploadError('')}
              />
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Select
                    id="vehicle-select"
                    labelText="Vehicle (Optional)"
                    value={selectedVehicle}
                    onChange={(event) => setSelectedVehicle(event.target.value)}
                  >
                    <SelectItem value="" text="General drawdown" />
                    {vehicles.map((vehicle) => (
                      <SelectItem
                        key={vehicle.id}
                        value={vehicle.id}
                        text={`${vehicle.make_model} (${vehicle.vin_number})`}
                      />
                    ))}
                  </Select>
                </div>

                <div>
                  <Select
                    id="category-select"
                    labelText="Category"
                    value={category}
                    onChange={(event) => setCategory(event.target.value as Exclude<ExpenseCategory, 'Driver Disbursement'>)}
                  >
                    <SelectItem value="Fuel" text="Fuel" />
                    <SelectItem value="Tolls" text="Tolls" />
                    <SelectItem value="Food" text="Food" />
                    <SelectItem value="Repairs" text="Repairs" />
                    <SelectItem value="Duty" text="Duty" />
                    <SelectItem value="Shipping" text="Shipping" />
                    <SelectItem value="Other" text="Other" />
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="md:col-span-2">
                  <TextInput
                    id="amount-input"
                    labelText="Amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    required
                    autoComplete="off"
                    placeholder="0.00"
                  />
                  <p className="text-xs text-zinc-500 mt-2">
                    Available balance: {formatUsd(availableUsd)}
                  </p>
                </div>

                <div>
                  <Select
                    id="currency-select"
                    labelText="Currency"
                    value={currency}
                    onChange={(event) => setCurrency(event.target.value as Currency)}
                  >
                    <SelectItem value="NAD" text="NAD" />
                    <SelectItem value="USD" text="USD" />
                    <SelectItem value="GBP" text="GBP" />
                    <SelectItem value="BWP" text="BWP" />
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Select
                    id="location-select"
                    labelText="Location"
                    value={location}
                    onChange={(event) => setLocation(event.target.value as VehicleStatus)}
                  >
                    <SelectItem value="UK" text="UK" />
                    <SelectItem value="Namibia" text="Namibia" />
                    <SelectItem value="Zimbabwe" text="Zimbabwe" />
                    <SelectItem value="Botswana" text="Botswana" />
                  </Select>
                </div>

                <div className="space-y-3">
                  <label htmlFor="receipt-input" className="block text-sm font-medium text-zinc-700">
                    Receipt (Optional)
                  </label>
                  <input
                    id="receipt-input"
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <div className="flex flex-col gap-3 rounded-sm border border-dashed border-zinc-300 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-800">
                        {selectedFile ? selectedFile.name : 'No receipt selected'}
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">Upload a photo of the receipt if you have one.</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Button type="button" variant="secondary" size="sm" onClick={openFilePicker}>
                        {selectedFile ? 'Replace Receipt' : 'Choose Receipt'}
                      </Button>
                      {selectedFile && (
                        <Button type="button" variant="ghost" size="sm" onClick={clearReceipt}>
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <TextArea
                id="description-input"
                labelText="Description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                placeholder="What is this expense for?"
              />

              {previewUrl && (
                <Tile style={{ padding: '1rem' }}>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-zinc-900">Receipt preview</p>
                        <p className="text-xs text-zinc-500 mt-1">Double-check the image before you submit.</p>
                      </div>
                      <Tag type="gray">{selectedFile?.type || 'image'}</Tag>
                    </div>
                    <img
                      src={previewUrl}
                      alt="Receipt preview"
                      className="w-full max-h-80 object-contain border border-zinc-200 bg-white"
                    />
                  </div>
                </Tile>
              )}

              <Button
                type="submit"
                fullWidth
                isLoading={submitting || uploading}
                disabled={availableUsd <= 0}
              >
                Submit Drawdown
              </Button>
            </form>
          </div>
        </Tile>

        <div className="space-y-6">
          <Tile style={{ padding: '1.5rem' }}>
            <div className="space-y-5">
              <div>
                <h3 className="text-xl font-black text-zinc-900">Latest Activity</h3>
                <p className="text-zinc-600 mt-2">Allocations and drawdowns linked to your profile</p>
              </div>

              {ledger.length === 0 ? (
                <InlineNotification
                  kind="info"
                  lowContrast
                  hideCloseButton
                  title="No activity yet"
                  subtitle="No funds or drawdowns are attached to your profile yet."
                />
              ) : (
                <div className="space-y-3">
                  {ledger.slice(0, 8).map((entry) => (
                    <Tile key={entry.id} style={{ padding: '1rem' }}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-zinc-900 break-words">{entry.title}</p>
                            <Tag type={entry.isCredit ? 'green' : 'red'}>
                              {entry.isCredit ? 'Allocation' : 'Spend'}
                            </Tag>
                          </div>
                          <p className="text-sm text-zinc-600 break-words">{entry.subtitle}</p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                            <span>{new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            <span className="hidden sm:inline">•</span>
                            <span>{entry.vehicleLabel}</span>
                            {entry.receiptUrl && (
                              <>
                                <span className="hidden sm:inline">•</span>
                                <Link href={entry.receiptUrl} target="_blank" rel="noreferrer">
                                  Receipt
                                </Link>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="sm:text-right">
                          <p className={`text-sm font-bold ${entry.isCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {entry.isCredit ? '+' : '-'}{formatMoney(entry.amount, entry.currency)}
                          </p>
                          <p className="text-xs text-zinc-500 mt-1">{formatUsd(entry.amountUsd)}</p>
                        </div>
                      </div>
                    </Tile>
                  ))}
                </div>
              )}
            </div>
          </Tile>

          <Tile style={{ padding: '1.5rem' }}>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-black text-zinc-900">How It Works</h3>
                <p className="text-zinc-600 mt-2">A quick guide to how allocations and spend tracking work in the portal.</p>
              </div>
              <ol className="space-y-3 text-sm text-zinc-700 leading-6">
                <li>Admin or accounting records a driver-specific disbursement for your profile.</li>
                <li>The allocation appears here immediately, whether it is vehicle-specific or a general top-up.</li>
                <li>Every expense you submit reduces the available balance shown above.</li>
              </ol>
            </div>
          </Tile>
        </div>
      </section>
    </div>
  );
};
