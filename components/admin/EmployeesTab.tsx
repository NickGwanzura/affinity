import React, { useEffect, useState, useMemo, useRef } from 'react';
import { ChevronUp, ChevronDown, Users, Plus, Pencil, Trash2, Search } from 'lucide-react';
import { Employee } from '../../types';
import { dataService } from '../../services/dataService';
import { useToast } from '../Toast';
import { useConfirm } from '../ConfirmModal';
import { Button } from '../ui';
import { EmptyState } from '../ui/EmptyState';
import { EXCHANGE_RATES } from '../../constants';
import EmployeeFormModal, {
  createEmptyEmployeeForm,
  toEmployeeFormValue,
  type EmployeeFormValue,
} from '../shared/EmployeeFormModal';
import { EmployeeStatusBadge } from './EmployeeStatusBadge';

type SortField = 'name' | 'position' | 'base_pay_usd' | 'employment_type' | 'status';
type SortDir = 'asc' | 'desc';
type StatusFilter = 'All' | Employee['status'];

export const EmployeesTab: React.FC = () => {
  const { showToast, ToastContainer } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeForm, setEmployeeForm] = useState<EmployeeFormValue>(createEmptyEmployeeForm());
  const [formDirty, setFormDirty] = useState(false);
  const initialFormRef = useRef<EmployeeFormValue>(createEmptyEmployeeForm());

  // List controls
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const notifySuccess = (msg: string) => showToast(msg, 'success');
  const notifyError = (msg: string) => showToast(msg, 'error');
  const notifyWarning = (msg: string) => showToast(msg, 'warning');

  const handleEmployeeFormChange = (updates: Partial<EmployeeFormValue>) => {
    setEmployeeForm((prev) => {
      const next = { ...prev, ...updates };
      // Mark dirty if anything differs from initial snapshot
      const dirty = (Object.keys(next) as (keyof EmployeeFormValue)[]).some(
        (k) => next[k] !== initialFormRef.current[k]
      );
      setFormDirty(dirty);
      return next;
    });
  };

  const fetchData = async () => {
    try {
      const data = await dataService.getEmployees();
      setEmployees(data);
    } catch (err) {
      console.error('[EmployeesTab] fetchData error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openAddModal = () => {
    const empty = createEmptyEmployeeForm();
    initialFormRef.current = empty;
    setEditingEmployee(null);
    setEmployeeForm(empty);
    setFormDirty(false);
    setShowEmployeeModal(true);
  };

  const openEditModal = (employee: Employee) => {
    const val = toEmployeeFormValue(employee);
    initialFormRef.current = val;
    setEditingEmployee(employee);
    setEmployeeForm(val);
    setFormDirty(false);
    setShowEmployeeModal(true);
  };

  const handleCloseModal = async () => {
    if (formDirty) {
      const ok = await confirm({
        title: 'Discard changes?',
        message: 'You have unsaved changes. Are you sure you want to close without saving?',
        confirmLabel: 'Discard',
        confirmVariant: 'danger',
      });
      if (!ok) return;
    }
    setShowEmployeeModal(false);
    setEditingEmployee(null);
    setFormDirty(false);
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...employeeForm, base_pay_usd: parseFloat(employeeForm.base_pay_usd) || 0 };
      if (editingEmployee) {
        await dataService.updateEmployee(editingEmployee.id, payload);
      } else {
        await dataService.createEmployee(payload);
      }
      setShowEmployeeModal(false);
      setEditingEmployee(null);
      setEmployeeForm(createEmptyEmployeeForm());
      setFormDirty(false);
      try {
        await fetchData();
        notifySuccess(editingEmployee ? 'Employee updated successfully!' : 'Employee created successfully!');
      } catch {
        notifyWarning('Employee saved but failed to refresh list. Please refresh the page.');
      }
    } catch (err: any) {
      console.error('[EmployeesTab] handleSaveEmployee error:', err);
      notifyError(err?.message || 'Failed to save employee. Please try again.');
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    const approved = await confirm({
      title: 'Delete employee?',
      message: 'This will also delete all associated payslips.',
      confirmLabel: 'Delete Employee',
      confirmVariant: 'danger',
    });
    if (!approved) return;
    try {
      await dataService.deleteEmployee(id);
      await fetchData();
      notifySuccess('Employee deleted successfully.');
    } catch (err: any) {
      console.error('[EmployeesTab] handleDeleteEmployee error:', err);
      notifyError(err?.message || 'Failed to delete employee.');
    }
  };

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

    // Status filter
    if (statusFilter !== 'All') {
      list = list.filter((e) => e.status === statusFilter);
    }

    // Search
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

    // Sort
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

  // Banner stats
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
    'px-6 py-4 text-left text-xs font-bold uppercase tracking-[0.08em] select-none cursor-pointer hover:text-zinc-900 transition-colors';

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-stone-200 border-t-[#D97706]" />
        <p className="font-bold animate-pulse uppercase tracking-widest text-xs text-zinc-600">
          Loading Employees
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner with action */}
      <div className="rounded-md bg-gradient-to-r from-[#D97706] to-[#92400E] p-8 text-white shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-2xl font-bold mb-3">Employee Management</h3>
            <div className="flex flex-wrap gap-6 text-sm">
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
          <Button
            variant="secondary"
            size="md"
            leftIcon={<Plus size={16} />}
            onClick={openAddModal}
            className="shrink-0"
          >
            Add Employee
          </Button>
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
          <label htmlFor="status-filter" className="text-xs font-medium text-zinc-600 whitespace-nowrap">
            Status
          </label>
          <select
            id="status-filter"
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

      {/* Table */}
      <div
        className="overflow-hidden shadow-lg"
        style={{ background: '#ffffff', border: '1px solid #e7e5e4' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th
                  className={thCls}
                  style={{ color: '#52525b' }}
                >
                  Employee #
                </th>
                <th
                  className={thCls}
                  style={{ color: '#52525b' }}
                  onClick={() => handleSort('name')}
                >
                  Name <SortIcon field="name" />
                </th>
                <th
                  className={thCls}
                  style={{ color: '#52525b' }}
                  onClick={() => handleSort('position')}
                >
                  Position <SortIcon field="position" />
                </th>
                <th
                  className={thCls}
                  style={{ color: '#52525b' }}
                  onClick={() => handleSort('base_pay_usd')}
                >
                  Base Pay <SortIcon field="base_pay_usd" />
                </th>
                <th
                  className={thCls}
                  style={{ color: '#52525b' }}
                  onClick={() => handleSort('employment_type')}
                >
                  Type <SortIcon field="employment_type" />
                </th>
                <th
                  className={thCls}
                  style={{ color: '#52525b' }}
                  onClick={() => handleSort('status')}
                >
                  Status <SortIcon field="status" />
                </th>
                <th
                  className="px-6 py-4 text-right text-xs font-bold uppercase tracking-[0.08em]"
                  style={{ color: '#52525b' }}
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
                      action={
                        !search && statusFilter === 'All'
                          ? { label: 'Add Employee', onClick: openAddModal }
                          : undefined
                      }
                    />
                  </td>
                </tr>
              ) : (
                filteredAndSorted.map((employee) => (
                  <tr key={employee.id} className="hover:bg-zinc-50">
                    <td className="px-6 py-4 font-mono text-sm text-zinc-600">
                      {employee.employee_number}
                    </td>
                    <td className="px-6 py-4 font-semibold text-zinc-900">
                      {employee.name}
                    </td>
                    <td className="px-6 py-4 text-zinc-600">
                      {employee.position}
                    </td>
                    <td className="px-6 py-4 font-semibold text-zinc-900">
                      {employee.base_pay_usd.toLocaleString()} {employee.currency}
                    </td>
                    <td className="px-6 py-4 text-zinc-600">
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
                          onClick={() => openEditModal(employee)}
                          aria-label={`Edit employee ${employee.name}`}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="danger-tertiary"
                          size="sm"
                          leftIcon={<Trash2 size={13} />}
                          onClick={() => handleDeleteEmployee(employee.id)}
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

      <EmployeeFormModal
        isOpen={showEmployeeModal}
        title={editingEmployee ? 'Edit Employee' : 'Add New Employee'}
        onClose={handleCloseModal}
        onSubmit={handleSaveEmployee}
        form={employeeForm}
        onChange={handleEmployeeFormChange}
        isNewEmployee={!editingEmployee}
        existingEmployees={employees}
      />

      <ToastContainer />
      <ConfirmDialog />
    </div>
  );
};

export default EmployeesTab;
