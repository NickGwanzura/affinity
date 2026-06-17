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

// Soft Tailwind-aligned status palette.
const palette = {
  success: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
  danger:  'bg-red-50 text-red-800 border border-red-200',
  warning: 'bg-amber-50 text-amber-800 border border-amber-200',
  info:    'bg-blue-50 text-blue-800 border border-blue-200',
  primary: 'bg-[#fef3c7] text-[#92400E] border border-[#fde68a]',
  neutral: 'bg-stone-100 text-stone-700 border border-stone-200',
} as const;

type PaletteKey = keyof typeof palette;

const statusMap: Record<string, { palette: PaletteKey; label: string }> = {
  active:        { palette: 'success', label: 'Active' },
  inactive:      { palette: 'neutral', label: 'Inactive' },
  pending:       { palette: 'warning', label: 'Pending' },
  paid:          { palette: 'success', label: 'Paid' },
  overdue:       { palette: 'danger',  label: 'Overdue' },
  draft:         { palette: 'neutral', label: 'Draft' },
  sent:          { palette: 'info',    label: 'Sent' },
  cancelled:     { palette: 'neutral', label: 'Cancelled' },
  approved:      { palette: 'success', label: 'Approved' },
  accepted:      { palette: 'success', label: 'Accepted' },
  rejected:      { palette: 'danger',  label: 'Rejected' },
  completed:     { palette: 'success', label: 'Completed' },
  'in-progress': { palette: 'info',    label: 'In Progress' },
  'on-hold':     { palette: 'warning', label: 'On Hold' },
  high:          { palette: 'danger',  label: 'High' },
  medium:        { palette: 'warning', label: 'Medium' },
  low:           { palette: 'info',    label: 'Low' },
  success:       { palette: 'success', label: 'Success' },
  error:         { palette: 'danger',  label: 'Error' },
  warning:       { palette: 'warning', label: 'Warning' },
  info:          { palette: 'info',    label: 'Info' },
};

const statusAliases: Record<string, string> = {
  'on leave':   'on-hold',
  'terminated': 'inactive',
  'generated':  'info',
};

const sizeClasses = {
  sm: 'rounded-full px-2 py-0.5 text-[11px] tracking-wide',
  md: 'rounded-full px-2.5 py-[3px] text-xs tracking-wide',
  lg: 'rounded-full px-3 py-1 text-sm',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size      = 'md',
  className = '',
  customColors,
}) => {
  const normalised = (status || '').toLowerCase().trim();
  const key        = statusAliases[normalised] ?? normalised;
  const config     = statusMap[key] ?? { palette: 'neutral' as const, label: status };

  if (customColors) {
    return (
      <span
        className={`inline-flex cursor-default items-center font-medium ${sizeClasses[size]} ${className}`}
        style={{ backgroundColor: customColors.bg, color: customColors.text }}
      >
        {config.label}
      </span>
    );
  }

  return (
    <span className={`inline-flex cursor-default items-center font-medium ${sizeClasses[size]} ${palette[config.palette]} ${className}`}>
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
  active:     '#059669',
  inactive:   '#a8a29e',
  pending:    '#f59e0b',
  paid:       '#059669',
  overdue:    '#dc2626',
  error:      '#dc2626',
  warning:    '#f59e0b',
  success:    '#059669',
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
  const color      = dotColorMap[key] ?? '#a8a29e';
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
