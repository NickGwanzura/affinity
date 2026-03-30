import React from 'react';
import type { Employee } from '../../types';

interface AdminEmployeesViewProps {
  employees: Employee[];
  onEditEmployee: (employee: Employee) => void;
  onDeleteEmployee: (id: string) => void;
}

export const AdminEmployeesView: React.FC<AdminEmployeesViewProps> = ({
  employees,
  onEditEmployee,
  onDeleteEmployee,
}) => (
  <div className="space-y-6">
    <div className="bg-gradient-to-r from-orange-600 to-red-600 p-8  text-white">
      <h3 className="text-2xl font-black mb-2">Employee Management</h3>
      <p className="text-orange-100">Manage your team and their details</p>
    </div>

    <div className="bg-white  shadow-lg border border-zinc-200 overflow-hidden">
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
                  No employees yet. Click "Add Employee" to get started.
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
                    <span className={`inline-block px-2 py-1 text-xs font-semibold  ${
                      employee.status === 'Active' ? 'bg-green-100 text-green-700' :
                      employee.status === 'On Leave' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {employee.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button onClick={() => onEditEmployee(employee)} className="text-blue-600 hover:text-blue-800 font-semibold">
                      Edit
                    </button>
                    <button onClick={() => onDeleteEmployee(employee.id)} className="text-red-600 hover:text-red-800 font-semibold">
                      Delete
                    </button>
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

export default AdminEmployeesView;
