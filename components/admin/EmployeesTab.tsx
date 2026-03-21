import React, { useEffect, useState } from 'react';
import { Employee } from '../../types';
import { supabase } from '../../services/supabaseService';
import { useToast } from '../Toast';
import { useConfirm } from '../ConfirmModal';

export const EmployeesTab: React.FC = () => {
  const { showToast, ToastContainer } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeForm, setEmployeeForm] = useState({
    name: '', email: '', phone: '', department: '', position: '',
    base_pay_usd: '', currency: 'USD' as 'USD' | 'NAD' | 'GBP' | 'BWP',
    employment_type: 'Full-time' as 'Full-time' | 'Part-time' | 'Contract' | 'Intern',
    date_hired: '', national_id: '', bank_account: '', bank_name: '', tax_number: ''
  });

  const notifySuccess = (msg: string) => showToast(msg, 'success');
  const notifyError = (msg: string) => showToast(msg, 'error');
  const notifyWarning = (msg: string) => showToast(msg, 'warning');

  const fetchData = async () => {
    try {
      const data = await supabase.getEmployees();
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
    setEmployeeForm({
      name: '', email: '', phone: '', department: '', position: '',
      base_pay_usd: '', currency: 'USD', employment_type: 'Full-time',
      date_hired: '', national_id: '', bank_account: '', bank_name: '', tax_number: ''
    });
    setShowEmployeeModal(true);
  };

  const openEditModal = (employee: Employee) => {
    setEditingEmployee(employee);
    setEmployeeForm({
      name: employee.name,
      email: employee.email || '',
      phone: employee.phone || '',
      department: employee.department || '',
      position: employee.position,
      base_pay_usd: employee.base_pay_usd.toString(),
      currency: employee.currency,
      employment_type: employee.employment_type,
      date_hired: employee.date_hired,
      national_id: employee.national_id || '',
      bank_account: employee.bank_account || '',
      bank_name: employee.bank_name || '',
      tax_number: employee.tax_number || ''
    });
    setShowEmployeeModal(true);
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...employeeForm, base_pay_usd: parseFloat(employeeForm.base_pay_usd) || 0 };
      if (editingEmployee) {
        await supabase.updateEmployee(editingEmployee.id, payload);
      } else {
        await supabase.createEmployee(payload);
      }
      setShowEmployeeModal(false);
      setEditingEmployee(null);
      setEmployeeForm({
        name: '', email: '', phone: '', department: '', position: '',
        base_pay_usd: '', currency: 'USD', employment_type: 'Full-time',
        date_hired: '', national_id: '', bank_account: '', bank_name: '', tax_number: ''
      });
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
      await supabase.deleteEmployee(id);
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

      {/* Employee Modal */}
      {showEmployeeModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={() => setShowEmployeeModal(false)}></div>
          <div className="relative bg-white rounded-3xl p-8 max-w-3xl w-full shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-zinc-900 mb-6">{editingEmployee ? 'Edit Employee' : 'Add New Employee'}</h3>
            <form onSubmit={handleSaveEmployee} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Full Name *</label>
                  <input type="text" value={employeeForm.name} onChange={(e) => setEmployeeForm({ ...employeeForm, name: e.target.value })} required className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-orange-500 outline-none" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Email *</label>
                  <input type="email" value={employeeForm.email} onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })} required className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-orange-500 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Phone</label>
                  <input type="tel" value={employeeForm.phone} onChange={(e) => setEmployeeForm({ ...employeeForm, phone: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-orange-500 outline-none" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Department</label>
                  <input type="text" value={employeeForm.department} onChange={(e) => setEmployeeForm({ ...employeeForm, department: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-orange-500 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Position *</label>
                  <input type="text" value={employeeForm.position} onChange={(e) => setEmployeeForm({ ...employeeForm, position: e.target.value })} required className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-orange-500 outline-none" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Base Pay (USD) *</label>
                  <input type="number" step="0.01" value={employeeForm.base_pay_usd} onChange={(e) => setEmployeeForm({ ...employeeForm, base_pay_usd: e.target.value })} required className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-orange-500 outline-none" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Currency</label>
                  <select value={employeeForm.currency} onChange={(e) => setEmployeeForm({ ...employeeForm, currency: e.target.value as any })} className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-orange-500 outline-none">
                    <option value="USD">USD</option>
                    <option value="NAD">NAD</option>
                    <option value="GBP">GBP</option>
                    <option value="BWP">BWP</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Employment Type</label>
                  <select value={employeeForm.employment_type} onChange={(e) => setEmployeeForm({ ...employeeForm, employment_type: e.target.value as any })} className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-orange-500 outline-none">
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Intern">Intern</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-zinc-700 mb-2 block">Date Hired *</label>
                  <input type="date" value={employeeForm.date_hired} onChange={(e) => setEmployeeForm({ ...employeeForm, date_hired: e.target.value })} required className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-orange-500 outline-none" />
                </div>
              </div>
              <div className="border-t border-zinc-200 pt-4 mt-4">
                <h4 className="text-sm font-bold text-zinc-700 mb-3">Optional Banking &amp; Tax Details</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-zinc-700 mb-2 block">National ID</label>
                    <input type="text" value={employeeForm.national_id} onChange={(e) => setEmployeeForm({ ...employeeForm, national_id: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-orange-500 outline-none" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-zinc-700 mb-2 block">Tax Number</label>
                    <input type="text" value={employeeForm.tax_number} onChange={(e) => setEmployeeForm({ ...employeeForm, tax_number: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-orange-500 outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="text-sm font-semibold text-zinc-700 mb-2 block">Bank Name</label>
                    <input type="text" value={employeeForm.bank_name} onChange={(e) => setEmployeeForm({ ...employeeForm, bank_name: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-orange-500 outline-none" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-zinc-700 mb-2 block">Bank Account</label>
                    <input type="text" value={employeeForm.bank_account} onChange={(e) => setEmployeeForm({ ...employeeForm, bank_account: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-orange-500 outline-none" />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowEmployeeModal(false)} className="flex-1 px-6 py-3 rounded-xl border border-zinc-200 text-zinc-700 font-semibold hover:bg-zinc-50">Cancel</button>
                <button type="submit" className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-xl shadow-lg">Save Employee</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ToastContainer />
      <ConfirmDialog />
    </div>
  );
};

export default EmployeesTab;
