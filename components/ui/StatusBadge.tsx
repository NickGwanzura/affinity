import React from 'react';
import { Tag } from '@carbon/react';

export type StatusType =
  | 'active' | 'inactive' | 'pending' | 'approved' | 'rejected'
  | 'paid' | 'overdue' | 'draft' | 'sent' | 'cancelled'
  | 'completed' | 'in-progress' | 'on-hold'
  | 'high' | 'medium' | 'low'
  | 'success' | 'error' | 'warning' | 'info';

type CarbonTagType =
  | 'red' | 'magenta' | 'purple' | 'blue' | 'cyan' | 'teal'
  | 'green' | 'gray' | 'warm-gray' | 'cool-gray'
  | 'high-contrast' | 'outline';

interface StatusBadgeProps {
  status:        StatusType | string;
  size?:         'sm' | 'md' | 'lg';
  className?:    string;
  customColors?: { bg: string; text: string };  // kept for API compat; ignored in Carbon
}

// Map status strings → Carbon Tag type + display label
const statusMap: Record<string, { type: CarbonTagType; label: string }> = {
  // User / vehicle
  active:       { type: 'green',     label: 'Active' },
  inactive:     { type: 'gray',      label: 'Inactive' },
  pending:      { type: 'warm-gray', label: 'Pending' },
  // Financial
  paid:         { type: 'green',     label: 'Paid' },
  overdue:      { type: 'red',       label: 'Overdue' },
  draft:        { type: 'cool-gray', label: 'Draft' },
  sent:         { type: 'blue',      label: 'Sent' },
  cancelled:    { type: 'gray',      label: 'Cancelled' },
  // Request
  approved:     { type: 'green',     label: 'Approved' },
  rejected:     { type: 'red',       label: 'Rejected' },
  // Progress
  completed:    { type: 'teal',      label: 'Completed' },
  'in-progress':{ type: 'blue',      label: 'In Progress' },
  'on-hold':    { type: 'warm-gray', label: 'On Hold' },
  // Priority
  high:         { type: 'red',       label: 'High' },
  medium:       { type: 'warm-gray', label: 'Medium' },
  low:          { type: 'cyan',      label: 'Low' },
  // Semantic
  success:      { type: 'green',     label: 'Success' },
  error:        { type: 'red',       label: 'Error' },
  warning:      { type: 'warm-gray', label: 'Warning' },
  info:         { type: 'blue',      label: 'Info' },
};

// Status aliases kept for backward compatibility
const statusAliases: Record<string, string> = {
  'on leave':   'on-hold',
  'terminated': 'inactive',
  'generated':  'info',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size      = 'md',
  className = '',
}) => {
  const normalised = status.toLowerCase().trim();
  const key        = statusAliases[normalised] ?? normalised;
  const config     = statusMap[key] ?? { type: 'gray' as CarbonTagType, label: status };
  // Carbon Tag accepts 'sm' | 'md' — map 'lg' → 'md'
  const carbonSize = size === 'lg' ? ('md' as const) : (size as 'sm' | 'md');

  return (
    <Tag
      type={config.type}
      size={carbonSize}
      className={className}
      style={{ cursor: 'default' }}
    >
      {config.label}
    </Tag>
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
  active:     'var(--cds-support-success, #24a148)',
  inactive:   'var(--cds-text-disabled, #8d8d8d)',
  pending:    'var(--cds-support-warning, #f1c21b)',
  paid:       'var(--cds-support-success, #24a148)',
  overdue:    'var(--cds-support-error, #da1e28)',
  error:      'var(--cds-support-error, #da1e28)',
  warning:    'var(--cds-support-warning, #f1c21b)',
  success:    'var(--cds-support-success, #24a148)',
  info:       'var(--cds-support-info, #4589ff)',
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
  const color      = dotColorMap[key] ?? 'var(--cds-text-disabled, #8d8d8d)';
  const px         = dotSizePx[size];

  return (
    <span
      className={className}
      style={{
        display: 'inline-block',
        width: px,
        height: px,
        borderRadius: '50%',
        background: color,
        animation: pulse ? 'pulse 1.5s ease-in-out infinite' : undefined,
        flexShrink: 0,
      }}
    />
  );
};
