import React, { useEffect, useState } from 'react';
import { Employee } from '../../types';
import { dataService } from '../../services/dataService';
import { useToast } from '../Toast';
import { useConfirm } from '../ConfirmModal';
import EmployeeFormModal, { createEmptyEmployeeForm, toEmployeeFormValue, type EmployeeFormValue } from '../shared/EmployeeFormModal';

export const EmployeesTab: React.FC = () => {
  const { showToast, ToastContainer } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeForm, setEmployeeForm] = useState<EmployeeFormValue>(createEmptyEmployeeForm());

  const notifySuccess = (msg: string) => showToast(msg, 'success');
  const notifyError = (msg: string) => showToast(msg, 'error');
  const notifyWarning = (msg: string) => showToast(msg, 'warning');
  const handleEmployeeFormChange = (updates: Partial<EmployeeFormValue>) => {
    setEmployeeForm((prev) => ({ ...prev, ...updates }));
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
    setEditingEmployee(null);
    setEmployeeForm(createEmptyEmployeeForm());
    setShowEmployeeModal(true);
  };

  const openEditModal = (employee: Employee) => {
    setEditingEmployee(employee);
    setEmployeeForm(toEmployeeFormValue(employee));
    setShowEmployeeModal(true);
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-stone-200 border-t-[#D97706]"></div>
        <p className="font-bold animate-pulse uppercase tracking-widest text-xs" style={{ color: 'var(--cds-text-secondary, #52525b)' }}>Loading Employees</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action button */}
      <div className="flex items-center gap-2">
        <button
          onClick={openAddModal}
          className="bg-orange-600 text-white px-6 py-2.5  font-bold text-sm hover:bg-orange-700 transition-all shadow-xl shadow-orange-100 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="2.5" /></svg>
          Add Employee
        </button>
      </div>

      {/* Header Banner */}
      <div className="rounded-md bg-gradient-to-r from-[#D97706] to-[#92400E] p-8 text-white shadow-sm">
        <h3 className="text-2xl font-bold mb-2">Employee Management</h3>
        <p className="text-amber-100">Manage your team and their details</p>
      </div>

      {/* Table */}
      <div className="overflow-hidden shadow-lg" style={{ background: 'var(--cds-background, #ffffff)', border: '1px solid var(--cds-border-subtle, #e7e5e4)' }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--cds-text-secondary, #52525b)' }}>Employee #</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--cds-text-secondary, #52525b)' }}>Name</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--cds-text-secondary, #52525b)' }}>Position</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--cds-text-secondary, #52525b)' }}>Base Pay</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--cds-text-secondary, #52525b)' }}>Type</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--cds-text-secondary, #52525b)' }}>Status</th>
                <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--cds-text-secondary, #52525b)' }}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center" style={{ color: 'var(--cds-text-secondary, #52525b)' }}>
                    No employees yet. Click &quot;Add Employee&quot; to get started.
                  </td>
                </tr>
              ) : (
                employees.map((employee) => (
                  <tr key={employee.id} className="hover:bg-zinc-50">
                    <td className="px-6 py-4 font-mono text-sm" style={{ color: 'var(--cds-text-secondary, #52525b)' }}>{employee.employee_number}</td>
                    <td className="px-6 py-4 font-semibold" style={{ color: 'var(--cds-text-primary, #18181b)' }}>{employee.name}</td>
                    <td className="px-6 py-4" style={{ color: 'var(--cds-text-secondary, #52525b)' }}>{employee.position}</td>
                    <td className="px-6 py-4 font-semibold" style={{ color: 'var(--cds-text-primary, #18181b)' }}>${employee.base_pay_usd.toLocaleString()} {employee.currency}</td>
                    <td className="px-6 py-4" style={{ color: 'var(--cds-text-secondary, #52525b)' }}>{employee.employment_type}</td>
                    <td className="px-6 py-4">
                      <span className="inline-block px-2 py-1 text-xs font-semibold" style={
                        employee.status === 'Active' ? { background: 'var(--cds-support-success-inverse, #d1fae5)', color: 'var(--cds-support-success, #10b981)' } :
                        employee.status === 'On Leave' ? { background: 'var(--cds-support-warning-inverse, #fdf6dd)', color: 'var(--cds-support-warning-inverse, #92400e)' } :
                        { background: 'var(--cds-support-error-inverse, #fee2e2)', color: 'var(--cds-support-error, #dc2626)' }
                      }>
                        {employee.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button onClick={() => openEditModal(employee)} className="font-semibold" style={{ color: 'var(--cds-interactive, #D97706)' }}>Edit</button>
                      <button onClick={() => handleDeleteEmployee(employee.id)} className="font-semibold" style={{ color: 'var(--cds-support-error, #dc2626)' }}>Delete</button>
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
        onClose={() => setShowEmployeeModal(false)}
        onSubmit={handleSaveEmployee}
        form={employeeForm}
        onChange={handleEmployeeFormChange}
      />

      <ToastContainer />
      <ConfirmDialog />
    </div>
  );
};

export default EmployeesTab;
