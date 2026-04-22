import React from 'react';

export type StatusType =
  | 'active' | 'inactive' | 'pending' | 'approved' | 'rejected'
  | 'accepted'
  | 'paid' | 'overdue' | 'draft' | 'sent' | 'cancelled'
  | 'completed' | 'in-progress' | 'on-hold'
  | 'high' | 'medium' | 'low'
  | 'success' | 'error' | 'warning' | 'info';

interface StatusBadgeProps {
  status:        StatusType | string;
  size?:         'sm' | 'md' | 'lg';
  className?:    string;
  customColors?: { bg: string; text: string };
}

const statusMap: Record<string, { classes: string; label: string }> = {
  active:       { classes: 'bg-green-100 text-green-800 border border-green-200', label: 'Active' },
  inactive:     { classes: 'bg-gray-100 text-gray-700 border border-gray-200', label: 'Inactive' },
  pending:      { classes: 'bg-amber-100 text-amber-800 border border-amber-200', label: 'Pending' },
  paid:         { classes: 'bg-green-100 text-green-800 border border-green-200', label: 'Paid' },
  overdue:      { classes: 'bg-red-100 text-red-800 border border-red-200', label: 'Overdue' },
  draft:        { classes: 'bg-gray-100 text-gray-600 border border-gray-200', label: 'Draft' },
  sent:         { classes: 'bg-blue-100 text-blue-800 border border-blue-200', label: 'Sent' },
  cancelled:    { classes: 'bg-gray-100 text-gray-600 border border-gray-200', label: 'Cancelled' },
  approved:     { classes: 'bg-green-100 text-green-800 border border-green-200', label: 'Approved' },
  accepted:     { classes: 'bg-green-100 text-green-800 border border-green-200', label: 'Accepted' },
  rejected:     { classes: 'bg-red-100 text-red-800 border border-red-200', label: 'Rejected' },
  completed:    { classes: 'bg-teal-100 text-teal-800 border border-teal-200', label: 'Completed' },
  'in-progress':{ classes: 'bg-blue-100 text-blue-800 border border-blue-200', label: 'In Progress' },
  'on-hold':    { classes: 'bg-amber-100 text-amber-800 border border-amber-200', label: 'On Hold' },
  high:         { classes: 'bg-red-100 text-red-800 border border-red-200', label: 'High' },
  medium:       { classes: 'bg-amber-100 text-amber-800 border border-amber-200', label: 'Medium' },
  low:          { classes: 'bg-cyan-100 text-cyan-800 border border-cyan-200', label: 'Low' },
  success:      { classes: 'bg-green-100 text-green-800 border border-green-200', label: 'Success' },
  error:        { classes: 'bg-red-100 text-red-800 border border-red-200', label: 'Error' },
  warning:      { classes: 'bg-amber-100 text-amber-800 border border-amber-200', label: 'Warning' },
  info:         { classes: 'bg-blue-100 text-blue-800 border border-blue-200', label: 'Info' },
};

const statusAliases: Record<string, string> = {
  'on leave':   'on-hold',
  'terminated': 'inactive',
  'generated':  'info',
};

const sizeClasses = { sm: 'px-2 py-0.5 text-xs', md: 'px-2.5 py-0.5 text-xs', lg: 'px-3 py-1 text-sm' };

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size      = 'md',
  className = '',
  customColors,
}) => {
  const normalised = status.toLowerCase().trim();
  const key        = statusAliases[normalised] ?? normalised;
  const config     = statusMap[key] ?? { classes: 'bg-gray-100 text-gray-600 border border-gray-200', label: status };

  if (customColors) {
    return (
      <span
        className={`inline-flex items-center font-medium ${sizeClasses[size]} ${className}`}
        style={{ backgroundColor: customColors.bg, color: customColors.text, cursor: 'default' }}
      >
        {config.label}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center font-medium ${sizeClasses[size]} ${config.classes} ${className}`} style={{ cursor: 'default' }}>
      {config.label}
    </span>
  );
};

// ── Dot variant ─────────────────────────────────────────────────────────────
interface StatusDotProps {
  status:    StatusType | string;
  size?:     'sm' | 'md' | 'lg';
  pulse?:    boolean;
  className?: string;
}

const dotColorMap: Record<string, string> = {
  active:     '#16a34a',
  inactive:   '#9ca3af',
  pending:    '#f59e0b',
  paid:       '#16a34a',
  overdue:    '#dc2626',
  error:      '#dc2626',
  warning:    '#f59e0b',
  success:    '#16a34a',
  info:       '#2563eb',
};

const dotSizePx = { sm: 6, md: 8, lg: 12 };

export const StatusDot: React.FC<StatusDotProps> = ({
  status,
  size      = 'md',
  pulse     = false,
  className = '',
}) => {
  const normalised = status.toLowerCase().trim();
  const key        = statusAliases[normalised] ?? normalised;
  const color      = dotColorMap[key] ?? '#9ca3af';
  const px         = dotSizePx[size];

  return (
    <span
      className={`inline-block rounded-full flex-shrink-0 ${className}`}
      style={{
        width: px,
        height: px,
        background: color,
        animation: pulse ? 'pulse 1.5s ease-in-out infinite' : undefined,
      }}
    />
  );
};
