import React from 'react';
import type { Employee } from '../../types';

type EmployeeStatus = Employee['status'];

interface EmployeeStatusBadgeProps {
  status: EmployeeStatus;
}

const statusStyles: Record<EmployeeStatus, React.CSSProperties> = {
  Active: {
    background: '#d1fae5',
    color: '#10b981',
  },
  'On Leave': {
    background: '#fdf6dd',
    color: '#92400e',
  },
  Terminated: {
    background: '#fee2e2',
    color: '#dc2626',
  },
};

export const EmployeeStatusBadge: React.FC<EmployeeStatusBadgeProps> = ({ status }) => (
  <span
    className="inline-block px-2 py-1 text-xs font-semibold rounded-sm"
    style={statusStyles[status] ?? statusStyles.Active}
  >
    {status}
  </span>
);

export default EmployeeStatusBadge;
