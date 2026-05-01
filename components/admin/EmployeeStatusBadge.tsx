import React from 'react';
import type { Employee } from '../../types';

type EmployeeStatus = Employee['status'];

interface EmployeeStatusBadgeProps {
  status: EmployeeStatus;
}

const statusStyles: Record<EmployeeStatus, React.CSSProperties> = {
  Active: {
    background: 'var(--cds-support-success-inverse, #d1fae5)',
    color: 'var(--cds-support-success, #10b981)',
  },
  'On Leave': {
    background: 'var(--cds-support-warning-inverse, #fdf6dd)',
    color: 'var(--cds-support-warning, #92400e)',
  },
  Terminated: {
    background: 'var(--cds-support-error-inverse, #fee2e2)',
    color: 'var(--cds-support-error, #dc2626)',
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
