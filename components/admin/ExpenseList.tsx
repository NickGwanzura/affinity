import React, { memo, useCallback, useMemo } from 'react';
import { EXPENSE_CATEGORIES, CURRENCIES, VEHICLE_STATUS, EXCHANGE_RATES } from '../../constants';
import type { Expense, Vehicle, ExpenseCategory, VehicleStatus, Currency } from '../../types';

// ============================================
// Types
// ============================================
interface ExpenseListProps {
  expenses: Expense[];
  vehicles: Vehicle[];
  onDelete?: (expenseId: string) => void;
  showVehicleColumn?: boolean;
  maxItems?: number;
  title?: string;
  emptyMessage?: string;
}

interface ExpenseRowProps {
  expense: Expense;
  vehicleName: string | null;
  onDelete?: (expenseId: string) => void;
  showVehicleColumn: boolean;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get category badge styles based on expense category
 */
const getCategoryStyles = (category: ExpenseCategory): string => {
  const styles: Record<ExpenseCategory, string> = {
    [EXPENSE_CATEGORIES.FUEL]: 'bg-blue-50 text-blue-700 ring-blue-100',
    [EXPENSE_CATEGORIES.TOLLS]: 'bg-amber-50 text-amber-700 ring-amber-100',
    [EXPENSE_CATEGORIES.FOOD]: 'bg-orange-50 text-orange-700 ring-orange-100',
    [EXPENSE_CATEGORIES.REPAIRS]: 'bg-red-50 text-red-700 ring-red-100',
    [EXPENSE_CATEGORIES.DUTY]: 'bg-purple-50 text-purple-700 ring-purple-100',
    [EXPENSE_CATEGORIES.SHIPPING]: 'bg-cyan-50 text-cyan-700 ring-cyan-100',
    [EXPENSE_CATEGORIES.DRIVER_DISBURSEMENT]: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    [EXPENSE_CATEGORIES.OTHER]: 'bg-zinc-100 text-zinc-600 ring-zinc-200'
  };
  return styles[category] || styles[EXPENSE_CATEGORIES.OTHER];
};

/**
 * Get category icon based on expense category
 */
const getCategoryIcon = (category: ExpenseCategory): string => {
  const icons: Record<ExpenseCategory, string> = {
    [EXPENSE_CATEGORIES.FUEL]: 'M13 10V3L4 14h7v7l9-11h-7z',
    [EXPENSE_CATEGORIES.TOLLS]: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    [EXPENSE_CATEGORIES.FOOD]: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z',
    [EXPENSE_CATEGORIES.REPAIRS]: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    [EXPENSE_CATEGORIES.DUTY]: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z',
    [EXPENSE_CATEGORIES.SHIPPING]: 'M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0',
    [EXPENSE_CATEGORIES.DRIVER_DISBURSEMENT]: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
    [EXPENSE_CATEGORIES.OTHER]: 'M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z'
  };
  return icons[category] || icons[EXPENSE_CATEGORIES.OTHER];
};

/**
 * Get location badge styles
 */
const getLocationStyles = (location: VehicleStatus): string => {
  const styles: Record<VehicleStatus, string> = {
    [VEHICLE_STATUS.UK]: 'bg-zinc-100 text-zinc-600',
    [VEHICLE_STATUS.NAMIBIA]: 'bg-amber-100 text-amber-700',
    [VEHICLE_STATUS.ZIMBABWE]: 'bg-emerald-100 text-emerald-700',
    [VEHICLE_STATUS.BOTSWANA]: 'bg-purple-100 text-purple-700',
    [VEHICLE_STATUS.SOLD]: 'bg-blue-100 text-blue-700'
  };
  return styles[location] || styles[VEHICLE_STATUS.UK];
};

/**
 * Format amount with currency
 */
const formatAmount = (amount: number, currency: Currency): string => {
  const symbols: Record<Currency, string> = {
    [CURRENCIES.GBP]: '£',
    [CURRENCIES.NAD]: 'N$',
    [CURRENCIES.USD]: '$'
  };
  return `${symbols[currency]}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Convert amount to USD for comparison
 */
const toUSD = (amount: number, currency: Currency): number => {
  return amount * (EXCHANGE_RATES[currency] || 1);
};

/**
 * Format date
 */
const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

// ============================================
// Sub-Components
// ============================================

const ExpenseRow: React.FC<ExpenseRowProps> = memo(({ 
  expense, 
  vehicleName, 
  onDelete, 
  showVehicleColumn 
}) => {
  const handleDelete = useCallback(() => {
    if (onDelete) {
      onDelete(expense.id);
    }
  }, [expense.id, onDelete]);

  const categoryStyles = useMemo(() => getCategoryStyles(expense.category), [expense.category]);
  const categoryIcon = useMemo(() => getCategoryIcon(expense.category), [expense.category]);
  const locationStyles = useMemo(() => getLocationStyles(expense.location), [expense.location]);
  const formattedAmount = useMemo(() => formatAmount(expense.amount, expense.currency), [expense.amount, expense.currency]);
  const usdAmount = useMemo(() => toUSD(expense.amount, expense.currency), [expense.amount, expense.currency]);
  const formattedDate = useMemo(() => formatDate(expense.created_at), [expense.created_at]);

  const isDriverDisbursement = expense.category === EXPENSE_CATEGORIES.DRIVER_DISBURSEMENT;

  return (
    <tr className="hover:bg-zinc-50 transition-colors group">
      {/* Date Column */}
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="text-sm text-zinc-600">{formattedDate}</span>
      </td>

      {/* Category Column */}
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ring-1 ${categoryStyles}`}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={categoryIcon} />
            </svg>
            {expense.category}
          </span>
        </div>
      </td>

      {/* Vehicle Column (optional) */}
      {showVehicleColumn && (
        <td className="px-6 py-4">
          {vehicleName ? (
            <span className="text-sm font-medium text-zinc-900">{vehicleName}</span>
          ) : (
            <span className="text-sm text-zinc-400 italic">General</span>
          )}
        </td>
      )}

      {/* Location Column */}
      <td className="px-6 py-4">
        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${locationStyles}`}>
          {expense.location}
        </span>
      </td>

      {/* Description Column */}
      <td className="px-6 py-4">
        <div className="flex flex-col">
          <span className="text-sm text-zinc-900 line-clamp-1" title={expense.description}>
            {expense.description}
          </span>
          {isDriverDisbursement && expense.driver_name && (
            <span className="text-xs text-emerald-600 font-medium mt-0.5">
              Driver: {expense.driver_name}
            </span>
          )}
        </div>
      </td>

      {/* Amount Column */}
      <td className="px-6 py-4 text-right">
        <div className="flex flex-col items-end">
          <span className="text-sm font-bold text-zinc-900">{formattedAmount}</span>
          {expense.currency !== CURRENCIES.USD && (
            <span className="text-xs text-zinc-400">
              ${usdAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} USD
            </span>
          )}
        </div>
      </td>

      {/* Actions Column */}
      {onDelete && (
        <td className="px-6 py-4 text-right">
          <button
            onClick={handleDelete}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg hover:bg-red-50 text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            title="Delete expense"
            aria-label={`Delete expense ${expense.description}`}
            type="button"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </td>
      )}
    </tr>
  );
});

ExpenseRow.displayName = 'ExpenseRow';

// ============================================
// Main Component
// ============================================

export const ExpenseList: React.FC<ExpenseListProps> = memo(({
  expenses,
  vehicles,
  onDelete,
  showVehicleColumn = true,
  maxItems,
  title = 'Recent Expenses',
  emptyMessage = 'No expenses yet.'
}) => {
  // Create vehicle lookup map
  const vehicleMap = useMemo(() => {
    const map = new Map<string, Vehicle>();
    vehicles.forEach(v => map.set(v.id, v));
    return map;
  }, [vehicles]);

  // Get vehicle name for an expense
  const getVehicleName = useCallback((vehicleId?: string): string | null => {
    if (!vehicleId) return null;
    const vehicle = vehicleMap.get(vehicleId);
    return vehicle ? `${vehicle.make_model}` : null;
  }, [vehicleMap]);

  // Sort expenses by date (newest first) and limit if needed
  const sortedExpenses = useMemo(() => {
    const sorted = [...expenses].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return maxItems ? sorted.slice(0, maxItems) : sorted;
  }, [expenses, maxItems]);

  // Calculate totals
  const totals = useMemo(() => {
    return sortedExpenses.reduce((acc, expense) => ({
      count: acc.count + 1,
      usd: acc.usd + toUSD(expense.amount, expense.currency)
    }), { count: 0, usd: 0 });
  }, [sortedExpenses]);

  if (expenses.length === 0) {
    return (
      <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 p-12 text-center">
        <svg 
          className="w-16 h-16 text-zinc-300 mx-auto mb-4" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="text-lg font-bold text-zinc-900 mb-2">No Expenses Found</h3>
        <p className="text-zinc-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/30">
        <div>
          <h3 className="text-lg font-black text-zinc-900 tracking-tight">{title}</h3>
          <p className="text-sm text-zinc-500 mt-0.5">
            {totals.count} transaction{totals.count !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest">Total (USD)</p>
          <p className="text-xl font-black text-zinc-900">
            ${totals.usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table 
          className="w-full text-left text-sm"
          role="table"
          aria-label="Expense list"
        >
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-100">
              <th 
                scope="col" 
                className="px-6 py-4 font-black text-zinc-400 uppercase tracking-widest text-[10px]"
              >
                Date
              </th>
              <th 
                scope="col" 
                className="px-6 py-4 font-black text-zinc-400 uppercase tracking-widest text-[10px]"
              >
                Category
              </th>
              {showVehicleColumn && (
                <th 
                  scope="col" 
                  className="px-6 py-4 font-black text-zinc-400 uppercase tracking-widest text-[10px]"
                >
                  Vehicle
                </th>
              )}
              <th 
                scope="col" 
                className="px-6 py-4 font-black text-zinc-400 uppercase tracking-widest text-[10px]"
              >
                Location
              </th>
              <th 
                scope="col" 
                className="px-6 py-4 font-black text-zinc-400 uppercase tracking-widest text-[10px]"
              >
                Description
              </th>
              <th 
                scope="col" 
                className="px-6 py-4 font-black text-zinc-400 uppercase tracking-widest text-[10px] text-right"
              >
                Amount
              </th>
              {onDelete && (
                <th 
                  scope="col" 
                  className="px-6 py-4 font-black text-zinc-400 uppercase tracking-widest text-[10px] text-right"
                >
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {sortedExpenses.map((expense) => (
              <ExpenseRow
                key={expense.id}
                expense={expense}
                vehicleName={getVehicleName(expense.vehicle_id)}
                onDelete={onDelete}
                showVehicleColumn={showVehicleColumn}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

ExpenseList.displayName = 'ExpenseList';

export default ExpenseList;
