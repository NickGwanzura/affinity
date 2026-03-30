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
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-600"></div>
        <p className="text-zinc-500 font-bold animate-pulse uppercase tracking-widest text-xs">Loading Employees</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action button */}
      <div className="flex items-center gap-2">
        <button
          onClick={openAddModal}
          className="bg-orange-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-orange-700 transition-all shadow-xl shadow-orange-100 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="2.5" /></svg>
          Add Employee
        </button>
      </div>

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-orange-600 to-red-600 p-8 rounded-3xl text-white">
        <h3 className="text-2xl font-black mb-2">Employee Management</h3>
        <p className="text-orange-100">Manage your team and their details</p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-lg border border-zinc-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Employee #</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Name</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Position</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Base Pay</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-zinc-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-zinc-500">
                    No employees yet. Click &quot;Add Employee&quot; to get started.
                  </td>
                </tr>
              ) : (
                employees.map((employee) => (
                  <tr key={employee.id} className="hover:bg-zinc-50">
                    <td className="px-6 py-4 font-mono text-sm text-zinc-600">{employee.employee_number}</td>
                    <td className="px-6 py-4 font-semibold text-zinc-900">{employee.name}</td>
                    <td className="px-6 py-4 text-zinc-600">{employee.position}</td>
                    <td className="px-6 py-4 text-zinc-900 font-semibold">${employee.base_pay_usd.toLocaleString()} {employee.currency}</td>
                    <td className="px-6 py-4 text-zinc-600">{employee.employment_type}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-md ${
                        employee.status === 'Active' ? 'bg-green-100 text-green-700' :
                        employee.status === 'On Leave' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {employee.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button onClick={() => openEditModal(employee)} className="text-blue-600 hover:text-blue-800 font-semibold">Edit</button>
                      <button onClick={() => handleDeleteEmployee(employee.id)} className="text-red-600 hover:text-red-800 font-semibold">Delete</button>
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
