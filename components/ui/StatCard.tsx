import React from 'react';

interface StatCardProps {
  title:     string;
  value:     string | number;
  subtitle?: string;
  icon?:     React.ReactNode;
  trend?: {
    value:      number;
    isPositive: boolean;
  };
  color?:     'blue' | 'green' | 'red' | 'amber' | 'purple' | 'zinc';
  isLoading?: boolean;
  className?: string;
}

const accentMap: Record<string, { bg: string; text: string }> = {
  blue:   { bg: '#0f62fe', text: '#ffffff' },
  green:  { bg: '#16a34a', text: '#ffffff' },
  red:    { bg: '#dc2626', text: '#ffffff' },
  amber:  { bg: '#f59e0b', text: '#111827' },
  purple: { bg: '#7c3aed', text: '#ffffff' },
  zinc:   { bg: '#e4e4e7', text: '#111827' },
};

const SkeletonLine = ({ width, className = '' }: { width: string; className?: string }) => (
  <div className={`h-4 bg-gray-200 animate-pulse ${className}`} style={{ width }} />
);

const SkeletonBox = ({ width, height }: { width: number; height: number }) => (
  <div className="bg-gray-200 animate-pulse" style={{ width, height }} />
);

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  color     = 'blue',
  isLoading = false,
  className = '',
}) => {
  const accent = accentMap[color] ?? accentMap.blue;

  if (isLoading) {
    return (
      <div className={`bg-white border border-gray-200 p-6 ${className}`}>
        <div className="flex justify-between items-start mb-4">
          <SkeletonLine width="60%" />
          <SkeletonBox width={40} height={40} />
        </div>
        <SkeletonLine width="40%" className="mb-2" />
        <SkeletonLine width="25%" />
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-white border border-gray-200 p-6 ${className}`}>
      {/* Left accent bar */}
      <div className="absolute top-0 left-0 w-1 h-full" style={{ background: accent.bg }} />

      <div className="pl-2">
        {/* Header row */}
        <div className="flex justify-between items-start mb-3">
          <p className="text-xs font-semibold text-gray-500 tracking-wider uppercase">
            {title}
          </p>
          {icon && (
            <div
              className="w-10 h-10 flex items-center justify-center flex-shrink-0"
              style={{ background: accent.bg, color: accent.text }}
            >
              {icon}
            </div>
          )}
        </div>

        {/* Value */}
        <p className="text-3xl font-light text-gray-900 tabular-nums leading-tight mb-2">
          {value}
        </p>

        {/* Trend / subtitle */}
        {(trend || subtitle) && (
          <div className="flex items-center gap-2 flex-wrap">
            {trend && (
              <span className={`inline-flex items-center gap-1 text-xs font-semibold ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {trend.isPositive ? '↑' : '↓'}
                {Math.abs(trend.value)}%
              </span>
            )}
            {subtitle && (
              <span className="text-xs text-gray-500">
                {subtitle}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
