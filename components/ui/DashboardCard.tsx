import React from 'react';

interface DashboardCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  footer?: React.ReactNode;
  color?: 'blue' | 'green' | 'red' | 'amber' | 'purple' | 'neutral';
  className?: string;
}

const accentMap: Record<string, { bg: string; text: string }> = {
  blue:    { bg: '#0f62fe', text: '#ffffff' },
  green:   { bg: '#16a34a', text: '#ffffff' },
  red:     { bg: '#dc2626', text: '#ffffff' },
  amber:   { bg: '#f59e0b', text: '#111827' },
  purple:  { bg: '#7c3aed', text: '#ffffff' },
  neutral: { bg: '#e5e7eb', text: '#111827' },
};

export const DashboardCard: React.FC<DashboardCardProps> = ({
  title,
  value,
  subtitle,
  footer,
  color = 'blue',
  className = '',
}) => {
  const accent = accentMap[color] ?? accentMap.blue;

  return (
    <div className={`relative overflow-hidden bg-white border border-gray-200 ${className}`}>
      {/* Left accent bar */}
      <div
        className="absolute top-0 left-0 w-1 h-full"
        style={{ background: accent.bg }}
      />
      <div className="p-6 pl-7">
        {/* Header */}
        <p className="text-xs font-semibold text-gray-500 tracking-wider uppercase mb-3">
          {title}
        </p>

        {/* Value */}
        <p className="text-3xl font-light text-gray-900 tabular-nums leading-tight mb-2">
          {value}
        </p>

        {/* Subtitle */}
        {subtitle && (
          <p className="text-sm text-gray-500 mb-3">
            {subtitle}
          </p>
        )}

        {/* Footer content */}
        {footer && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardCard;
