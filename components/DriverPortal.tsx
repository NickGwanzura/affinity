import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Route, CheckCircle2, Wallet } from 'lucide-react';
import { MyFundsWidget } from './shared/MyFundsWidget';
import { Currency, Expense, ExpenseCategory, OperatingFund, Trip, Vehicle, VehicleStatus } from '../types';
import { EXCHANGE_RATES } from '../constants';
import { dataService } from '../services/dataService';
import { authFetch } from '../services/authFetch';
import { useSession } from '../contexts/SessionContext';
import {
  Button,
  StatCard,
  TextInput,
  Select,
  SelectItem,
  TextArea,
  DashboardPageHeader,
  DashboardKpiCard,
  DashboardSection,
} from './ui';
import { getDriverIdentityAliases } from '../utils/driverIdentity';
import { useToast } from './Toast';
import { driverDrawdownSchema, getFirstValidationMessage } from '../utils/clientValidation';
import { ZodError } from 'zod';

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

type CurrencyTotals = Partial<Record<Currency, number>>;

type ReceivedFundDisbursement = {
  id: string;
  amount: number;
  currency: Currency;
  note?: string | null;
  disbursed_at: string;
  created_at?: string;
  from_name?: string;
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

const summarizeCurrencyTotals = (entries: Array<{ amount: number; currency: Currency }>): CurrencyTotals =>
  entries.reduce<CurrencyTotals>((totals, entry) => {
    totals[entry.currency] = (totals[entry.currency] || 0) + (entry.amount || 0);
    return totals;
  }, {});

const getNonZeroCurrencies = (totals: CurrencyTotals): Currency[] =>
  (Object.entries(totals) as Array<[Currency, number | undefined]>)
    .filter(([, amount]) => (amount || 0) > 0)
    .map(([currency]) => currency);

const formatCurrencyBreakdown = (totals: CurrencyTotals): string =>
  getNonZeroCurrencies(totals)
    .map((currency) => formatMoney(totals[currency] || 0, currency))
    .join(' • ');

const getDateKey = (value?: string) => {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value.slice(0, 10) : parsed.toISOString().slice(0, 10);
};

const getAllocationFingerprint = (amount: number, currency: Currency, date?: string) =>
  `${currency}:${Number(amount || 0).toFixed(2)}:${getDateKey(date)}`;

export const DriverPortal: React.FC = () => {
  const { showToast } = useToast();
  const session = useSession();
  const [currentDriver, setCurrentDriver] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [driverExpenses, setDriverExpenses] = useState<Expense[]>([]);
  const [driverFunds, setDriverFunds] = useState<OperatingFund[]>([]);
  const [receivedFundDisbursements, setReceivedFundDisbursements] = useState<ReceivedFundDisbursement[]>([]);
  const [assignedTrips, setAssignedTrips] = useState<Trip[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string>('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('NAD');
  const [category, setCategory] = useState<Exclude<ExpenseCategory, 'Driver Disbursement'>>('Fuel');
  const [location, setLocation] = useState<VehicleStatus>('Namibia');
  const [tripReference, setTripReference] = useState('');
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

      const driverAliases = getDriverIdentityAliases(session?.user);
      const driverName = session?.user?.name?.trim() || driverAliases[0];

      if (!driverName || driverAliases.length === 0) {
        throw new Error('Unable to load your driver profile. Please sign in again.');
      }

      setCurrentDriver(driverName);

      const [vehicleData, expenseDataGroups, fundDataGroups, receivedDisbursementsResponse, tripData] = await Promise.all([
        dataService.getVehicles(),
        Promise.all(
          driverAliases.map((alias) =>
            dataService.getExpensesByDriver(alias).catch(() => [] as Expense[]),
          ),
        ),
        Promise.all(
          driverAliases.map((alias) =>
            dataService.getOperatingFundsByRecipient(alias).catch(() => [] as OperatingFund[]),
          ),
        ),
        authFetch('/api/fund-disbursements?resource=received')
          .then((response) => response.ok ? response.json() : []),
        dataService.getTrips({ upcomingOnly: true }).catch(() => [] as Trip[]),
      ]);

      const expenseData = uniqueById(expenseDataGroups.flat());
      const fundData = uniqueById(fundDataGroups.flat());
      const receivedDisbursements = (Array.isArray(receivedDisbursementsResponse) ? receivedDisbursementsResponse : [])
        .map((entry) => ({
          ...entry,
          amount: Number(entry.amount) || 0,
        })) as ReceivedFundDisbursement[];
      const receivedDisbursementKeys = new Set(
        receivedDisbursements.map((entry) =>
          getAllocationFingerprint(entry.amount, entry.currency, entry.disbursed_at),
        ),
      );
      const legacyDriverFunds = (fundData || []).filter((fund) => {
        if (fund.type !== 'Disbursed') return false;
        return !receivedDisbursementKeys.has(getAllocationFingerprint(fund.amount, fund.currency, fund.date));
      });

      setVehicles(vehicleData);
      setDriverExpenses(expenseData);
      setDriverFunds(legacyDriverFunds);
      setReceivedFundDisbursements(receivedDisbursements);
      setAssignedTrips(tripData);
    } catch (error: any) {
      const message = error?.message || 'Failed to load your driver funds. Please refresh the page.';
      setUploadError(message);
      showToast(message, 'error');
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
    () => expenseDisbursements.reduce((sum, expense) => sum + (expense.amount || 0) * (expense.exchange_rate_to_usd || 1), 0),
    [expenseDisbursements],
  );

  const allocatedFromFundsUsd = useMemo(
    () => driverFunds.reduce((sum, fund) => sum + (fund.amount || 0) * (EXCHANGE_RATES[fund.currency] || 1), 0),
    [driverFunds],
  );

  const allocatedFromFundDisbursementsUsd = useMemo(
    () => receivedFundDisbursements.reduce(
      (sum, disbursement) => sum + (disbursement.amount || 0) * (EXCHANGE_RATES[disbursement.currency] || 1),
      0,
    ),
    [receivedFundDisbursements],
  );

  const spentUsd = useMemo(
    () => drawdowns.reduce((sum, expense) => sum + (expense.amount || 0) * (expense.exchange_rate_to_usd || 1), 0),
    [drawdowns],
  );

  const allocatedUsd = allocatedFromExpenseUsd + allocatedFromFundsUsd + allocatedFromFundDisbursementsUsd;
  const availableUsd = allocatedUsd - spentUsd;

  const allocationCurrencyTotals = useMemo(
    () => summarizeCurrencyTotals([
      ...expenseDisbursements.map((expense) => ({ amount: expense.amount, currency: expense.currency })),
      ...driverFunds.map((fund) => ({ amount: fund.amount, currency: fund.currency })),
      ...receivedFundDisbursements.map((disbursement) => ({ amount: disbursement.amount, currency: disbursement.currency })),
    ]),
    [driverFunds, expenseDisbursements, receivedFundDisbursements],
  );

  const spentCurrencyTotals = useMemo(
    () => summarizeCurrencyTotals(drawdowns.map((expense) => ({ amount: expense.amount, currency: expense.currency }))),
    [drawdowns],
  );

  const expenseAllocationCurrencyTotals = useMemo(
    () => summarizeCurrencyTotals(expenseDisbursements.map((expense) => ({ amount: expense.amount, currency: expense.currency }))),
    [expenseDisbursements],
  );

  const fundAllocationCurrencyTotals = useMemo(
    () => summarizeCurrencyTotals(driverFunds.map((fund) => ({ amount: fund.amount, currency: fund.currency }))),
    [driverFunds],
  );

  const fundDisbursementCurrencyTotals = useMemo(
    () => summarizeCurrencyTotals(
      receivedFundDisbursements.map((disbursement) => ({ amount: disbursement.amount, currency: disbursement.currency }))
    ),
    [receivedFundDisbursements],
  );

  const allocationBreakdown = useMemo(
    () => formatCurrencyBreakdown(allocationCurrencyTotals),
    [allocationCurrencyTotals],
  );

  const balanceCurrency = useMemo(() => {
    const uniqueCurrencies = new Set<Currency>([
      ...getNonZeroCurrencies(allocationCurrencyTotals),
      ...getNonZeroCurrencies(spentCurrencyTotals),
    ]);
    return uniqueCurrencies.size === 1 ? Array.from(uniqueCurrencies)[0] : null;
  }, [allocationCurrencyTotals, spentCurrencyTotals]);

  const formatPreferredDisplay = (usdAmount: number, totals: CurrencyTotals): string => {
    const currencies = getNonZeroCurrencies(totals);
    if (currencies.length === 1) {
      const currency = currencies[0];
      return formatMoney(totals[currency] || 0, currency);
    }
    if (currencies.length > 1) {
      return formatCurrencyBreakdown(totals);
    }
    return formatUsd(usdAmount);
  };

  const availableByCurrency = useMemo<CurrencyTotals>(() => {
    const result: CurrencyTotals = {};
    for (const [cur, allocated] of Object.entries(allocationCurrencyTotals) as Array<[Currency, number | undefined]>) {
      result[cur] = (allocated || 0) - (spentCurrencyTotals[cur] || 0);
    }
    return result;
  }, [allocationCurrencyTotals, spentCurrencyTotals]);

  const availableBalanceDisplay = balanceCurrency
    ? formatMoney(availableUsd / (EXCHANGE_RATES[balanceCurrency] || 1), balanceCurrency)
    : formatCurrencyBreakdown(availableByCurrency) || formatUsd(availableUsd);

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

    const fundDisbursementEntries: DriverLedgerEntry[] = receivedFundDisbursements.map((disbursement) => ({
      id: `fund-disbursement-${disbursement.id}`,
      date: disbursement.created_at || disbursement.disbursed_at,
      isCredit: true,
      title: 'Fund Disbursement',
      subtitle: disbursement.note || (disbursement.from_name ? `Funds from ${disbursement.from_name}` : 'Funds allocated to you'),
      vehicleLabel: 'General allocation',
      amount: disbursement.amount,
      currency: disbursement.currency,
      amountUsd: disbursement.amount * (EXCHANGE_RATES[disbursement.currency] || 1),
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

    return [...allocationEntries, ...operatingFundEntries, ...fundDisbursementEntries, ...drawdownEntries].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [drawdowns, driverFunds, expenseDisbursements, receivedFundDisbursements, vehicleNames]);

  const upcomingTrips = useMemo(
    () => assignedTrips
      .filter((trip) => trip.status !== 'Completed' && trip.status !== 'Cancelled')
      .sort((left, right) => new Date(left.departure_date).getTime() - new Date(right.departure_date).getTime())
      .slice(0, 6),
    [assignedTrips],
  );

  // ── Top-line KPIs for the dashboard shell ───────────────────────────
  // Active Trips: in-transit or assigned trips for this driver
  // Completed This Month: trips completed in the current calendar month
  // Available Balance: current USD drawdown balance
  const dashboardKpis = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const activeTrips = assignedTrips.filter(
      (trip) => trip.status === 'In Transit' || trip.status === 'Assigned',
    ).length;

    const completedThisMonth = assignedTrips.filter((trip) => {
      if (trip.status !== 'Completed') return false;
      const end = trip.actual_arrival_at || trip.eta_date;
      if (!end) return false;
      return new Date(end).getTime() >= monthStart;
    }).length;

    return {
      activeTrips,
      completedThisMonth,
    };
  }, [assignedTrips]);

  const calendarDays = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(startOfToday);
      date.setDate(startOfToday.getDate() + index);
      const isoDate = date.toISOString().split('T')[0];
      const events = upcomingTrips.filter((event) => event.departure_date.slice(0, 10) === isoDate);

      return {
        isoDate,
        label: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: date.getDate(),
        events,
      };
    });
  }, [upcomingTrips]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file');
      showToast('Please select an image file.', 'warning');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File size must be less than 10MB');
      showToast('Receipt images must be 10MB or smaller.', 'warning');
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
      showToast('Failed to read the selected receipt.', 'error');
    };
    reader.readAsDataURL(file);
  };

  const uploadReceipt = async (file: File): Promise<string | null> => {
    try {
      setUploading(true);
      setUploadError('');
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string' && reader.result.length > 0) {
            resolve(reader.result);
            return;
          }
          reject(new Error('Failed to encode receipt image'));
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
    } catch (error: any) {
      setUploadError(error.message || 'Failed to upload receipt. Please try again.');
      showToast(error.message || 'Failed to upload receipt. Please try again.', 'error');
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
      const message = 'Your driver profile is not available right now. Please sign in again.';
      setUploadError(message);
      showToast(message, 'error');
      return;
    }

    try {
      driverDrawdownSchema.parse({ amount, description, currency, category, location });
    } catch (error) {
      const message = error instanceof ZodError ? getFirstValidationMessage(error) : 'Please review the drawdown form.';
      setUploadError(message);
      showToast(message, 'warning');
      return;
    }

    const parsedAmount = parseFloat(amount);

    const amountUsd = parsedAmount * (EXCHANGE_RATES[currency] || 1);
    if (amountUsd > availableUsd + 0.001) {
      const message = `This drawdown exceeds your available balance of ${formatUsd(availableUsd)}.`;
      setUploadError(message);
      showToast(message, 'warning');
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
          showToast('Receipt upload failed, continuing without the receipt.', 'warning');
        }
      }

      await dataService.addExpense({
        vehicle_id: selectedVehicle || undefined,
        description,
        amount: parsedAmount,
        currency,
        category,
        location,
        exchange_rate_to_usd: EXCHANGE_RATES[currency] || 1,
        receipt_url: receiptUrl,
        driver_name: currentDriver,
        trip_reference: tripReference || undefined,
      });

      await loadPortalData();
      setSuccess(true);
      showToast('Expense logged successfully and your drawdown balance has been refreshed.', 'success');
      setTimeout(() => setSuccess(false), 3000);

      setDescription('');
      setAmount('');
      setTripReference('');
      clearReceipt();
    } catch (error: any) {
      const message = error.message || 'Failed to submit expense. Please try again.';
      setUploadError(message);
      showToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Header skeleton */}
        <div className="space-y-2">
          <div className="h-8 w-40 app-shimmer rounded" />
          <div className="h-4 w-56 app-shimmer rounded" />
        </div>
        {/* KPI row skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {[1,2,3].map(i => (
            <div key={i} className="rounded-lg border border-stone-200 bg-white p-6">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="h-3 w-24 app-shimmer rounded" />
                <div className="h-10 w-10 app-shimmer rounded-lg" />
              </div>
              <div className="h-8 w-32 app-shimmer rounded mb-2" />
              <div className="h-3 w-28 app-shimmer rounded" />
            </div>
          ))}
        </div>
        {/* Content skeleton */}
        <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="rounded-lg border border-stone-200 bg-white p-6">
            <div className="h-5 w-36 app-shimmer rounded mb-2" />
            <div className="h-3 w-64 app-shimmer rounded mb-6" />
            <div className="space-y-4">
              {[1,2,3,4].map(i => (
                <div key={i} className="h-12 w-full app-shimmer rounded" />
              ))}
            </div>
          </div>
          <div className="space-y-6">
            <div className="rounded-lg border border-stone-200 bg-white p-6">
              <div className="h-5 w-32 app-shimmer rounded mb-6" />
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {[1,2,3,4,5,6,7].map(i => (
                  <div key={i} className="h-24 app-shimmer rounded" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <DashboardPageHeader
        title="Driver Portal"
        subtitle={currentDriver ? `Hello, ${currentDriver}` : 'Driver funds and drawdowns'}
        banner={
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#D97706]">Available To Draw</p>
              <p className={`text-2xl font-bold mt-1 ${availableUsd >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {availableBalanceDisplay}
              </p>
            </div>
            <p className="text-xs text-stone-600 max-w-md leading-5">
              {availableUsd > 0
                ? 'You can submit expenses against this balance now.'
                : 'No balance is available right now. Ask admin or accounting to top up your driver funds.'}
            </p>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <DashboardKpiCard
          label="Active Trips"
          value={dashboardKpis.activeTrips}
          icon={Route}
          iconTone="amber"
          trend="In transit or assigned"
        />
        <DashboardKpiCard
          label="Completed This Month"
          value={dashboardKpis.completedThisMonth}
          icon={CheckCircle2}
          iconTone="emerald"
          trend="Trips completed"
        />
        <DashboardKpiCard
          label="Available Balance"
          value={availableBalanceDisplay}
          icon={Wallet}
          iconTone="blue"
          trend={availableUsd >= 0 ? 'Ready to draw' : 'Awaiting allocation'}
        />
      </div>

      <DashboardSection
        title="Allocations & Spend"
        subtitle="Your running totals across every currency"
      >
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard
            title="Allocated"
            value={formatPreferredDisplay(allocatedUsd, allocationCurrencyTotals)}
            subtitle={`${expenseDisbursements.length + driverFunds.length + receivedFundDisbursements.length} allocation${expenseDisbursements.length + driverFunds.length + receivedFundDisbursements.length === 1 ? '' : 's'} recorded`}
            intent="primary"
          />
          <StatCard
            title="Spent"
            value={formatPreferredDisplay(spentUsd, spentCurrencyTotals)}
            subtitle={`${drawdowns.length} drawdown${drawdowns.length === 1 ? '' : 's'} submitted`}
            intent="danger"
          />
          <StatCard
            title="Allocation Mix"
            value={formatPreferredDisplay(allocatedFromExpenseUsd, expenseAllocationCurrencyTotals)}
            subtitle={`Fund disbursements: ${formatPreferredDisplay(allocatedFromFundDisbursementsUsd, fundDisbursementCurrencyTotals)} • Operating top-ups: ${formatPreferredDisplay(allocatedFromFundsUsd, fundAllocationCurrencyTotals)}`}
            intent="success"
          />
        </section>
      </DashboardSection>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
        <DashboardSection
          title="Submit Drawdown"
          subtitle="Every expense submitted here is tagged to your driver profile and deducted from your available funds."
        >
          <div className="space-y-6">

            {success && (
              <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <div className="flex-1">
                  <p className="font-semibold">Success</p>
                  <p className="mt-0.5 text-emerald-700">Expense logged successfully and your drawdown balance has been refreshed.</p>
                </div>
                <button onClick={() => setSuccess(false)} className="shrink-0 text-emerald-500 hover:text-emerald-700">×</button>
              </div>
            )}

            {uploadError && (
              <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <div className="flex-1">
                  <p className="font-semibold">Could not complete request</p>
                  <p className="mt-0.5 text-red-700">{uploadError}</p>
                </div>
                <button onClick={() => setUploadError('')} className="shrink-0 text-red-500 hover:text-red-700">×</button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Select
                  id="vehicle-select"
                  labelText="Vehicle (Optional)"
                  value={selectedVehicle}
                  onChange={(e) => setSelectedVehicle(e.target.value)}
                >
                  <SelectItem value="" text="General drawdown" />
                  {vehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id} text={`${vehicle.make_model} (${vehicle.vin_number})`} />
                  ))}
                </Select>

                <Select
                  id="category-select"
                  labelText="Category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Exclude<ExpenseCategory, 'Driver Disbursement'>)}
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

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="md:col-span-2">
                  <TextInput
                    id="amount-input"
                    type="number"
                    step="0.01"
                    min="0.01"
                    labelText="Amount *"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    placeholder="0.00"
                  />
                  <p className="text-xs text-zinc-500 mt-2">
                    Available balance: {availableBalanceDisplay}
                  </p>
                </div>

                <Select
                  id="currency-select"
                  labelText="Currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as Currency)}
                >
                  <SelectItem value="NAD" text="Namibian Dollars (NAD)" />
                  <SelectItem value="ZAR" text="Rands (ZAR)" />
                  <SelectItem value="BWP" text="Pulas (BWP)" />
                  <SelectItem value="USD" text="US Dollars (USD)" />
                  <SelectItem value="GBP" text="British Pounds (GBP)" />
                </Select>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Select
                  id="location-select"
                  labelText="Location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value as VehicleStatus)}
                >
                  <SelectItem value="UK" text="UK" />
                  <SelectItem value="Namibia" text="Namibia" />
                  <SelectItem value="Zimbabwe" text="Zimbabwe" />
                  <SelectItem value="Botswana" text="Botswana" />
                </Select>

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
                  <div className="flex flex-col gap-3 border border-dashed border-stone-300 p-4 rounded-lg sm:flex-row sm:items-center sm:justify-between">
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

              <TextInput
                id="trip-reference-input"
                labelText="Trip Reference (Optional)"
                value={tripReference}
                onChange={(e) => setTripReference(e.target.value)}
                placeholder="e.g. Windhoek delivery - April run"
              />

              <TextArea
                id="description-input"
                labelText="Description *"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="What is this expense for?"
                required
              />

              {previewUrl && (
                <div className="bg-white border border-zinc-200 p-4">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-zinc-900">Receipt preview</p>
                        <p className="text-xs text-zinc-500 mt-1">Double-check the image before you submit.</p>
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-800">{selectedFile?.type || 'image'}</span>
                    </div>
                    <img
                      src={previewUrl}
                      alt="Receipt preview"
                      className="w-full max-h-80 object-contain border border-zinc-200 bg-white"
                    />
                  </div>
                </div>
              )}

              <div className="sticky bottom-3 z-10 border border-zinc-200 bg-white/95 p-3 shadow-lg backdrop-blur">
                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-semibold text-zinc-900">Ready to submit</p>
                  <p className="text-xs text-zinc-500">Available balance: {availableBalanceDisplay}</p>
                </div>
                <Button
                  type="submit"
                  fullWidth
                  isLoading={submitting || uploading}
                  disabled={availableUsd <= 0}
                >
                  Submit Drawdown
                </Button>
              </div>
            </form>
          </div>
        </DashboardSection>

        <div className="space-y-6">
          <DashboardSection
            title="Upcoming Schedule"
            subtitle="Your assigned trips now come from the dedicated planner, with real route, status, and ETA data."
          >
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                {calendarDays.map((day) => (
                  <div
                    key={day.isoDate}
                    className={`border p-3 ${
                      day.events.length > 0
                        ? 'border-blue-200 bg-blue-50'
                        : 'border-zinc-200 bg-zinc-50'
                    }`}
                  >
                    <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">{day.label}</p>
                    <p className="mt-2 text-2xl font-black text-zinc-900">{day.dayNumber}</p>
                    <p className="mt-2 text-xs text-zinc-600">
                      {day.events.length > 0 ? `${day.events.length} trip item${day.events.length === 1 ? '' : 's'}` : 'Open'}
                    </p>
                  </div>
                ))}
              </div>

              {upcomingTrips.length === 0 ? (
                <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3">
                  <p className="font-semibold text-sm">No trip date recorded yet</p>
                  <p className="text-sm mt-0.5">Once operations records a dated driver allocation, your next trip will appear here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingTrips.slice(0, 3).map((trip) => (
                    <div key={trip.id} className="bg-white border border-zinc-200 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-zinc-900">{trip.title}</p>
                            <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${
                              trip.status === 'Delayed' ? 'bg-red-100 text-red-800' : trip.status === 'Completed' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {trip.status}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-zinc-600">
                            {trip.route_origin} to {trip.route_destination}
                          </p>
                          <p className="mt-2 text-xs text-zinc-500">
                            Vehicle: {trip.assigned_vehicle_label || 'Unassigned'}
                          </p>
                          <p className="mt-2 text-xs text-zinc-500">
                            Departure {new Date(trip.departure_date).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            ETA {new Date(trip.eta_date).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </p>
                        </div>
                        <div className="text-sm font-bold text-blue-700">{trip.trip_number}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DashboardSection>

          <DashboardSection
            title="Latest Activity"
            subtitle="Allocations and drawdowns linked to your profile"
          >
            <div className="space-y-5">
              {ledger.length === 0 ? (
                <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3">
                  <p className="font-semibold text-sm">No activity yet</p>
                  <p className="text-sm mt-0.5">No funds or drawdowns are attached to your profile yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {ledger.slice(0, 8).map((entry) => (
                    <div key={entry.id} className="bg-white border border-zinc-200 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-zinc-900 break-words">{entry.title}</p>
                            <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${
                              entry.isCredit ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {entry.isCredit ? 'Allocation' : 'Spend'}
                            </span>
                          </div>
                          <p className="text-sm text-zinc-600 break-words">{entry.subtitle}</p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                            <span>{new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            <span className="hidden sm:inline">•</span>
                            <span>{entry.vehicleLabel}</span>
                            {entry.receiptUrl && (
                              <>
                                <span className="hidden sm:inline">•</span>
                                <a href={entry.receiptUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                                  Receipt
                                </a>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="sm:text-right">
                          <p className={`text-sm font-bold ${entry.isCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {entry.isCredit ? '+' : '-'}{formatMoney(entry.amount, entry.currency)}
                          </p>
                          <p className="text-xs text-zinc-500 mt-1">USD eq. {formatUsd(entry.amountUsd)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DashboardSection>

          <DashboardSection
            title="My Funds"
            subtitle="Log expenses and disburse funds to others. Every entry feeds the audit trail."
          >
            <MyFundsWidget canDisburse={true} />
          </DashboardSection>

          <DashboardSection
            title="How It Works"
            subtitle="A quick guide to how allocations and spend tracking work in the portal."
          >
            <ol className="space-y-3 text-sm text-zinc-700 leading-6">
              <li>Admin or accounting records a driver-specific disbursement for your profile.</li>
              <li>The allocation appears here immediately, whether it is vehicle-specific or a general top-up.</li>
              <li>Every expense you submit reduces the available balance shown above.</li>
            </ol>
          </DashboardSection>
        </div>
      </section>
    </div>
  );
};
