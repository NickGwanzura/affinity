import React from 'react';

interface DashboardCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  footer?: React.ReactNode;
  color?: 'blue' | 'green' | 'red' | 'amber' | 'purple' | 'neutral';
  className?: string;
  icon?: React.ReactNode;
}

const accentMap: Record<NonNullable<DashboardCardProps['color']>, string> = {
  blue:    '#D97706',
  green:   '#198038',
  red:     '#da1e28',
  amber:   '#f1c21b',
  purple:  '#8a3ffc',
  neutral: '#6f6f6f',
};

export const DashboardCard: React.FC<DashboardCardProps> = ({
  title,
  value,
  subtitle,
  footer,
  color = 'blue',
  className = '',
  icon,
}) => {
  const accent = accentMap[color];

  return (
    <div
      className={`group relative flex flex-col bg-white border border-[#e0e0e0] transition-colors duration-150 hover:border-[#c6c6c6] ${className}`}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: accent }}
      />
      <div className="flex items-start justify-between gap-3 p-6 pl-7">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#525252] mb-3">
            {title}
          </p>
          <p className="text-[32px] font-light leading-none tabular-nums text-[#161616] mb-2">
            {value}
          </p>
          {subtitle && (
            <p className="text-sm text-[#525252] leading-snug">{subtitle}</p>
          )}
        </div>
        {icon ? (
          <div
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center text-white"
            style={{ background: accent }}
          >
            {icon}
          </div>
        ) : null}
      </div>
      {footer && (
        <div className="border-t border-[#e0e0e0] px-6 py-3 pl-7 text-sm text-[#525252]">
          {footer}
        </div>
      )}
    </div>
  );
};

export default DashboardCard;
