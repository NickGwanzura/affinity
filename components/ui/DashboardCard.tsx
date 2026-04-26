import React from 'react';
import type { Intent } from './StatCard';

interface DashboardCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  footer?: React.ReactNode;
  intent?: Intent;
  className?: string;
  icon?: React.ReactNode;
}

const accentMap: Record<Intent, string> = {
  primary: '#D97706',
  success: '#059669',
  danger:  '#dc2626',
  warning: '#f59e0b',
  info:    '#2563eb',
  neutral: '#71717a',
};

export const DashboardCard: React.FC<DashboardCardProps> = ({
  title,
  value,
  subtitle,
  footer,
  intent = 'primary',
  className = '',
  icon,
}) => {
  const accent = accentMap[intent];

  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-lg bg-white border border-stone-200 transition-shadow duration-150 hover:shadow-sm ${className}`}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: accent }}
      />
      <div className="flex items-start justify-between gap-3 p-6 pl-7">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-600 mb-3">
            {title}
          </p>
          <p className="text-[32px] font-semibold leading-none tabular-nums text-zinc-900 mb-2">
            {value}
          </p>
          {subtitle && (
            <p className="text-sm text-zinc-600 leading-snug">{subtitle}</p>
          )}
        </div>
        {icon ? (
          <div
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-white"
            style={{ background: accent }}
          >
            {icon}
          </div>
        ) : null}
      </div>
      {footer && (
        <div className="border-t border-stone-200 px-6 py-3 pl-7 text-sm text-zinc-600">
          {footer}
        </div>
      )}
    </div>
  );
};

export default DashboardCard;
