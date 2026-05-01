import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, Search, Pencil, Trash2, Users } from 'lucide-react';
import type { Employee } from '../../types';
import { EXCHANGE_RATES } from '../../constants';
import { Button } from '../ui';
import { EmptyState } from '../ui/EmptyState';
import { EmployeeStatusBadge } from './EmployeeStatusBadge';

type SortField = 'name' | 'position' | 'base_pay_usd' | 'employment_type' | 'status';
type SortDir = 'asc' | 'desc';
type StatusFilter = 'All' | Employee['status'];

interface AdminEmployeesViewProps {
  employees: Employee[];
  onEditEmployee: (employee: Employee) => void;
  onDeleteEmployee: (id: string) => void;
  onAddEmployee?: () => void;
}

export const AdminEmployeesView: React.FC<AdminEmployeesViewProps> = ({
  employees,
  onEditEmployee,
  onDeleteEmployee,
  onAddEmployee,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const filteredAndSorted = useMemo(() => {
    let list = employees;

    if (statusFilter !== 'All') {
      list = list.filter((e) => e.status === statusFilter);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          (e.email || '').toLowerCase().includes(q) ||
          e.position.toLowerCase().includes(q) ||
          (e.employee_number || '').toLowerCase().includes(q)
      );
    }

    list = [...list].sort((a, b) => {
      let av: string | number = '';
      let bv: string | number = '';
      if (sortField === 'base_pay_usd') {
        av = a.base_pay_usd;
        bv = b.base_pay_usd;
      } else {
        av = (a[sortField] ?? '').toString().toLowerCase();
        bv = (b[sortField] ?? '').toString().toLowerCase();
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [employees, search, statusFilter, sortField, sortDir]);

  const totalMonthlyUSD = useMemo(
    () =>
      employees.reduce(
        (sum, e) => sum + e.base_pay_usd * (EXCHANGE_RATES[e.currency] ?? 1),
        0
      ),
    [employees]
  );
  const activeCount = employees.filter((e) => e.status === 'Active').length;

  const SortIcon: React.FC<{ field: SortField }> = ({ field }) => {
    if (sortField !== field) return <ChevronDown size={12} className="opacity-30 inline ml-1" />;
    return sortDir === 'asc'
      ? <ChevronUp size={12} className="inline ml-1 text-[#D97706]" />
      : <ChevronDown size={12} className="inline ml-1 text-[#D97706]" />;
  };

  const thCls =
    'px-6 py-4 text-left text-xs font-bold uppercase tracking-wider select-none cursor-pointer hover:text-zinc-900 transition-colors';

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="rounded-md bg-gradient-to-r from-[#D97706] to-[#92400E] p-4 sm:p-6 md:p-8 text-white shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-xl sm:text-2xl font-bold mb-3">Employee Management</h3>
            <div className="flex flex-wrap gap-4 sm:gap-6 text-sm">
              <span>
                <span className="font-semibold text-white">{employees.length}</span>
                <span className="ml-1.5 text-amber-200">Total</span>
              </span>
              <span>
                <span className="font-semibold text-white">{activeCount}</span>
                <span className="ml-1.5 text-amber-200">Active</span>
              </span>
              <span>
                <span className="font-semibold text-white">
                  ${totalMonthlyUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
                <span className="ml-1.5 text-amber-200">Monthly payroll (USD equiv.)</span>
              </span>
            </div>
          </div>
          {onAddEmployee && (
            <Button
              variant="secondary"
              size="md"
              onClick={onAddEmployee}
              className="shrink-0"
            >
              Add Employee
            </Button>
          )}
        </div>
      </div>

      {/* Search + filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <input
            type="search"
            placeholder="Search name, email, position, #…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full bg-white text-zinc-900 text-sm placeholder-zinc-400 border border-stone-300 rounded-md pl-9 pr-3 py-2 min-h-[2.5rem] shadow-sm transition-[border-color,box-shadow] duration-150 hover:border-stone-400 focus:outline-none focus-visible:border-[#D97706] focus-visible:ring-2 focus-visible:ring-[#D97706]/30"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="admin-status-filter" className="text-xs font-medium text-zinc-600 whitespace-nowrap">
            Status
          </label>
          <select
            id="admin-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="bg-white text-zinc-900 text-sm border border-stone-300 rounded-md px-3 py-2 min-h-[2.5rem] shadow-sm transition-[border-color,box-shadow] duration-150 hover:border-stone-400 focus:outline-none focus-visible:border-[#D97706] focus-visible:ring-2 focus-visible:ring-[#D97706]/30 cursor-pointer"
          >
            <option value="All">All</option>
            <option value="Active">Active</option>
            <option value="On Leave">On Leave</option>
            <option value="Terminated">Terminated</option>
          </select>
        </div>
      </div>

      <div
        className="overflow-hidden shadow-lg"
        style={{ background: 'var(--cds-background, #ffffff)', border: '1px solid var(--cds-border-subtle, #e7e5e4)' }}
      >
        {/* Mobile card list */}
        <div className="space-y-3 p-3 sm:hidden">
          {filteredAndSorted.length === 0 ? (
            <EmptyState
              icon={<Users size={32} />}
              title={search || statusFilter !== 'All' ? 'No matching employees' : 'No employees yet'}
              description={
                search || statusFilter !== 'All'
                  ? 'Try adjusting your search or filter.'
                  : 'Add your first employee to get started.'
              }
            />
          ) : (
            filteredAndSorted.map((employee) => (
              <div
                key={employee.id}
                className="p-4"
                style={{ border: '1px solid var(--cds-border-subtle, #e7e5e4)', background: 'var(--cds-background, #ffffff)' }}
              >
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <div className="font-bold" style={{ color: 'var(--cds-text-primary, #18181b)' }}>
                      {employee.name}
                    </div>
                    <div className="font-mono text-xs" style={{ color: 'var(--cds-text-secondary, #52525b)' }}>
                      {employee.employee_number}
                    </div>
                  </div>
                  <EmployeeStatusBadge status={employee.status} />
                </div>
                <div className="mb-1 text-xs" style={{ color: 'var(--cds-text-secondary, #52525b)' }}>
                  {employee.position} &middot; {employee.employment_type}
                </div>
                <div className="mb-3 font-semibold text-sm" style={{ color: 'var(--cds-text-primary, #18181b)' }}>
                  {employee.base_pay_usd.toLocaleString()} {employee.currency}
                </div>
                <div className="flex flex-wrap gap-2 border-t border-zinc-100 pt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<Pencil size={13} />}
                    onClick={() => onEditEmployee(employee)}
                    aria-label={`Edit employee ${employee.name}`}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="danger-tertiary"
                    size="sm"
                    leftIcon={<Trash2 size={13} />}
                    onClick={() => onDeleteEmployee(employee.id)}
                    aria-label={`Delete employee ${employee.name}`}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th
                  className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider"
                  style={{ color: 'var(--cds-text-secondary, #52525b)' }}
                >
                  Employee #
                </th>
                <th
                  className={thCls}
                  style={{ color: 'var(--cds-text-secondary, #52525b)' }}
                  onClick={() => handleSort('name')}
                >
                  Name <SortIcon field="name" />
                </th>
                <th
                  className={thCls}
                  style={{ color: 'var(--cds-text-secondary, #52525b)' }}
                  onClick={() => handleSort('position')}
                >
                  Position <SortIcon field="position" />
                </th>
                <th
                  className={thCls}
                  style={{ color: 'var(--cds-text-secondary, #52525b)' }}
                  onClick={() => handleSort('base_pay_usd')}
                >
                  Base Pay <SortIcon field="base_pay_usd" />
                </th>
                <th
                  className={thCls}
                  style={{ color: 'var(--cds-text-secondary, #52525b)' }}
                  onClick={() => handleSort('employment_type')}
                >
                  Type <SortIcon field="employment_type" />
                </th>
                <th
                  className={thCls}
                  style={{ color: 'var(--cds-text-secondary, #52525b)' }}
                  onClick={() => handleSort('status')}
                >
                  Status <SortIcon field="status" />
                </th>
                <th
                  className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider"
                  style={{ color: 'var(--cds-text-secondary, #52525b)' }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {filteredAndSorted.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-0">
                    <EmptyState
                      icon={<Users size={32} />}
                      title={search || statusFilter !== 'All' ? 'No matching employees' : 'No employees yet'}
                      description={
                        search || statusFilter !== 'All'
                          ? 'Try adjusting your search or filter.'
                          : 'Add your first employee to get started.'
                      }
                    />
                  </td>
                </tr>
              ) : (
                filteredAndSorted.map((employee) => (
                  <tr key={employee.id} className="hover:bg-zinc-50">
                    <td className="px-6 py-4 font-mono text-sm" style={{ color: 'var(--cds-text-secondary, #52525b)' }}>
                      {employee.employee_number}
                    </td>
                    <td className="px-6 py-4 font-semibold" style={{ color: 'var(--cds-text-primary, #18181b)' }}>
                      {employee.name}
                    </td>
                    <td className="px-6 py-4" style={{ color: 'var(--cds-text-secondary, #52525b)' }}>
                      {employee.position}
                    </td>
                    <td className="px-6 py-4 font-semibold" style={{ color: 'var(--cds-text-primary, #18181b)' }}>
                      {employee.base_pay_usd.toLocaleString()} {employee.currency}
                    </td>
                    <td className="px-6 py-4" style={{ color: 'var(--cds-text-secondary, #52525b)' }}>
                      {employee.employment_type}
                    </td>
                    <td className="px-6 py-4">
                      <EmployeeStatusBadge status={employee.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<Pencil size={13} />}
                          onClick={() => onEditEmployee(employee)}
                          aria-label={`Edit employee ${employee.name}`}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="danger-tertiary"
                          size="sm"
                          leftIcon={<Trash2 size={13} />}
                          onClick={() => onDeleteEmployee(employee.id)}
                          aria-label={`Delete employee ${employee.name}`}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminEmployeesView;
