import React, { useMemo, useState } from 'react';
import type { AppUser, Expense, Vehicle } from '../../types';
import { ExpenseList } from './ExpenseList';

interface AdminDriverEntriesViewProps {
  expenses: Expense[];
  vehicles: Vehicle[];
  drivers: AppUser[];
  onDeleteExpense?: (expenseId: string) => void;
}

const ALL = '__all__';

export const AdminDriverEntriesView: React.FC<AdminDriverEntriesViewProps> = ({
  expenses,
  vehicles,
  drivers,
  onDeleteExpense,
}) => {
  const [selectedDriver, setSelectedDriver] = useState<string>(ALL);

  const driverEntries = useMemo(
    () => expenses.filter(e => typeof e.driver_name === 'string' && e.driver_name.trim().length > 0),
    [expenses],
  );

  const driverOptions = useMemo(() => {
    const fromExpenses = new Set<string>();
    driverEntries.forEach(e => {
      if (e.driver_name) fromExpenses.add(e.driver_name.trim());
    });
    drivers.forEach(d => {
      if (d.name) fromExpenses.add(d.name.trim());
    });
    return Array.from(fromExpenses).sort((a, b) => a.localeCompare(b));
  }, [driverEntries, drivers]);

  const filtered = useMemo(() => {
    if (selectedDriver === ALL) return driverEntries;
    return driverEntries.filter(
      e => (e.driver_name || '').trim().toLowerCase() === selectedDriver.toLowerCase(),
    );
  }, [driverEntries, selectedDriver]);

  return (
    <div className="space-y-4">
      <div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4"
        style={{
          background: 'var(--cds-background, #ffffff)',
          border: '1px solid var(--cds-border-subtle, #e7e5e4)',
        }}
      >
        <div>
          <h3
            className="text-sm font-black uppercase tracking-widest"
            style={{ color: 'var(--cds-text-secondary, #52525b)' }}
          >
            Filter by Driver
          </h3>
          <p className="text-xs mt-1" style={{ color: 'var(--cds-text-secondary, #52525b)' }}>
            Showing entries submitted by drivers and disbursements made to them.
          </p>
        </div>
        <select
          value={selectedDriver}
          onChange={e => setSelectedDriver(e.target.value)}
          className="min-w-[14rem] px-3 py-2 text-sm font-medium border focus:outline-none focus:ring-2 focus:ring-[#D97706]/30"
          style={{
            background: 'var(--cds-background, #ffffff)',
            borderColor: 'var(--cds-border-subtle, #e7e5e4)',
            color: 'var(--cds-text-primary, #18181b)',
          }}
        >
          <option value={ALL}>All drivers ({driverEntries.length})</option>
          {driverOptions.map(name => {
            const count = driverEntries.filter(
              e => (e.driver_name || '').trim().toLowerCase() === name.toLowerCase(),
            ).length;
            return (
              <option key={name} value={name}>
                {name} ({count})
              </option>
            );
          })}
        </select>
      </div>

      <ExpenseList
        expenses={filtered}
        vehicles={vehicles}
        onDelete={onDeleteExpense}
        showVehicleColumn={true}
        showDriverColumn={true}
        title={selectedDriver === ALL ? 'All Driver Entries' : `Entries — ${selectedDriver}`}
        emptyMessage={
          selectedDriver === ALL
            ? 'No driver-linked expenses yet.'
            : `No entries recorded for ${selectedDriver}.`
        }
      />
    </div>
  );
};

export default AdminDriverEntriesView;
