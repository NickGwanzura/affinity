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
    <div className="rounded-md bg-gradient-to-r from-[#D97706] to-[#92400E] p-4 sm:p-6 md:p-8 text-white shadow-sm">
      <h3 className="text-xl sm:text-2xl font-bold mb-2">Employee Management</h3>
      <p className="text-amber-100">Manage your team and their details</p>
    </div>

    <div className="overflow-hidden shadow-lg" style={{ background: 'var(--cds-background, #ffffff)', border: '1px solid var(--cds-border-subtle, #e7e5e4)' }}>
      <div className="space-y-3 p-3 sm:hidden">
        {employees.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm" style={{ border: '1px solid var(--cds-border-subtle, #e7e5e4)', background: 'var(--cds-layer-01, #ffffff)', color: 'var(--cds-text-secondary, #52525b)' }}>
            No employees yet. Click &quot;Add Employee&quot; to get started.
          </div>
        ) : (
          employees.map((employee) => (
            <div key={employee.id} className="p-4" style={{ border: '1px solid var(--cds-border-subtle, #e7e5e4)', background: 'var(--cds-background, #ffffff)' }}>
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <div className="font-bold" style={{ color: 'var(--cds-text-primary, #18181b)' }}>{employee.name}</div>
                  <div className="font-mono text-xs" style={{ color: 'var(--cds-text-secondary, #52525b)' }}>{employee.employee_number}</div>
                </div>
                <span className="inline-block px-2 py-0.5 text-xs font-semibold" style={
                  employee.status === 'Active' ? { background: 'var(--cds-support-success-inverse, #d1fae5)', color: 'var(--cds-support-success, #10b981)' } :
                  employee.status === 'On Leave' ? { background: 'var(--cds-support-warning-inverse, #fdf6dd)', color: 'var(--cds-support-warning-inverse, #92400e)' } :
                  { background: 'var(--cds-support-error-inverse, #fee2e2)', color: 'var(--cds-support-error, #dc2626)' }
                }>
                  {employee.status}
                </span>
              </div>
              <div className="mb-1 text-xs" style={{ color: 'var(--cds-text-secondary, #52525b)' }}>{employee.position} &middot; {employee.employment_type}</div>
              <div className="mb-3 font-semibold text-sm" style={{ color: 'var(--cds-text-primary, #18181b)' }}>${employee.base_pay_usd.toLocaleString()} {employee.currency}</div>
              <div className="flex flex-wrap gap-2 border-t border-zinc-50 pt-3">
                <button onClick={() => onEditEmployee(employee)} className="px-2 py-1 text-xs font-bold" style={{ color: 'var(--cds-interactive, #D97706)' }}>Edit</button>
                <button onClick={() => onDeleteEmployee(employee.id)} className="px-2 py-1 text-xs font-bold" style={{ color: 'var(--cds-support-error, #dc2626)' }}>Delete</button>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="hidden sm:block overflow-x-auto">
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
                    <button onClick={() => onEditEmployee(employee)} className="font-semibold" style={{ color: 'var(--cds-interactive, #D97706)' }}>
                      Edit
                    </button>
                    <button onClick={() => onDeleteEmployee(employee.id)} className="font-semibold" style={{ color: 'var(--cds-support-error, #dc2626)' }}>
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
