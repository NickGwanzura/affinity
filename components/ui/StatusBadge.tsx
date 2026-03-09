import React from 'react';

export type StatusType = 
  | 'active' | 'inactive' | 'pending' | 'approved' | 'rejected'
  | 'paid' | 'overdue' | 'draft' | 'sent' | 'cancelled'
  | 'completed' | 'in-progress' | 'on-hold'
  | 'high' | 'medium' | 'low'
  | 'success' | 'error' | 'warning' | 'info';

interface StatusBadgeProps {
  status: StatusType | string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  customColors?: {
    bg: string;
    text: string;
  };
}

const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  // User/Vehicle Status
  active: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Active' },
  inactive: { bg: 'bg-zinc-100', text: 'text-zinc-600', label: 'Inactive' },
  pending: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pending' },
  
  // Financial Status
  paid: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Paid' },
  overdue: { bg: 'bg-rose-100', text: 'text-rose-700', label: 'Overdue' },
  draft: { bg: 'bg-zinc-100', text: 'text-zinc-600', label: 'Draft' },
  sent: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Sent' },
  cancelled: { bg: 'bg-zinc-100', text: 'text-zinc-500', label: 'Cancelled' },
  
  // Request Status
  approved: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Approved' },
  rejected: { bg: 'bg-rose-100', text: 'text-rose-700', label: 'Rejected' },
  
  // Progress Status
  completed: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Completed' },
  'in-progress': { bg: 'bg-blue-100', text: 'text-blue-700', label: 'In Progress' },
  'on-hold': { bg: 'bg-amber-100', text: 'text-amber-700', label: 'On Hold' },
  
  // Priority
  high: { bg: 'bg-rose-100', text: 'text-rose-700', label: 'High' },
  medium: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Medium' },
  low: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Low' },
  
  // Semantic
  success: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Success' },
  error: { bg: 'bg-rose-100', text: 'text-rose-700', label: 'Error' },
  warning: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Warning' },
  info: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Info' },
};

// Status aliases for flexibility
const statusAliases: Record<string, string> = {
  'on leave': 'on-hold',
  'terminated': 'inactive',
  'generated': 'info',
};

const sizeStyles = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-1 text-xs',
  lg: 'px-3 py-1.5 text-sm',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  className = '',
  customColors,
}) => {
  // Normalize status string
  const normalizedStatus = status.toLowerCase().trim();
  const aliasedStatus = statusAliases[normalizedStatus] || normalizedStatus;
  
  const style = customColors || statusStyles[aliasedStatus] || { 
    bg: 'bg-zinc-100', 
    text: 'text-zinc-600',
    label: status 
  };

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full uppercase tracking-wider ${sizeStyles[size]} ${style.bg} ${style.text} ${className}`}
    >
      {style.label}
    </span>
  );
};

// Dot variant for compact status indication
interface StatusDotProps {
  status: StatusType | string;
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
  className?: string;
}

const dotSizes = {
  sm: 'w-1.5 h-1.5',
  md: 'w-2 h-2',
  lg: 'w-3 h-3',
};

export const StatusDot: React.FC<StatusDotProps> = ({
  status,
  size = 'md',
  pulse = false,
  className = '',
}) => {
  const normalizedStatus = status.toLowerCase().trim();
  const aliasedStatus = statusAliases[normalizedStatus] || normalizedStatus;
  
  const colorMap: Record<string, string> = {
    active: 'bg-emerald-500',
    inactive: 'bg-zinc-400',
    pending: 'bg-amber-500',
    paid: 'bg-emerald-500',
    overdue: 'bg-rose-500',
    error: 'bg-rose-500',
    warning: 'bg-amber-500',
    success: 'bg-emerald-500',
    info: 'bg-blue-500',
  };

  const color = colorMap[aliasedStatus] || 'bg-zinc-400';

  return (
    <span
      className={`inline-block rounded-full ${dotSizes[size]} ${color} ${pulse ? 'animate-pulse' : ''} ${className}`}
    />
  );
};
