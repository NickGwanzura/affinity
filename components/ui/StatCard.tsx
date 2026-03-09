import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: 'blue' | 'green' | 'red' | 'amber' | 'purple' | 'zinc';
  isLoading?: boolean;
  className?: string;
}

const colorSchemes = {
  blue: { bg: 'bg-blue-50', iconBg: 'bg-blue-100', iconColor: 'text-blue-600', trend: 'text-blue-600' },
  green: { bg: 'bg-emerald-50', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', trend: 'text-emerald-600' },
  red: { bg: 'bg-rose-50', iconBg: 'bg-rose-100', iconColor: 'text-rose-600', trend: 'text-rose-600' },
  amber: { bg: 'bg-amber-50', iconBg: 'bg-amber-100', iconColor: 'text-amber-600', trend: 'text-amber-600' },
  purple: { bg: 'bg-purple-50', iconBg: 'bg-purple-100', iconColor: 'text-purple-600', trend: 'text-purple-600' },
  zinc: { bg: 'bg-zinc-50', iconBg: 'bg-zinc-100', iconColor: 'text-zinc-600', trend: 'text-zinc-600' },
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = 'blue',
  isLoading = false,
  className = '',
}) => {
  const colors = colorSchemes[color];

  if (isLoading) {
    return (
      <div className={`bg-white p-6 rounded-2xl shadow-sm border border-zinc-200 ${className}`}>
        <div className="animate-pulse">
          <div className="flex justify-between items-start mb-4">
            <div className="h-4 w-24 bg-zinc-200 rounded" />
            <div className="w-10 h-10 bg-zinc-200 rounded-xl" />
          </div>
          <div className="h-8 w-32 bg-zinc-200 rounded mb-2" />
          <div className="h-3 w-16 bg-zinc-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white p-6 rounded-2xl shadow-sm border border-zinc-200 hover:shadow-md transition-shadow ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">{title}</p>
        {icon && (
          <div className={`w-10 h-10 ${colors.iconBg} rounded-xl flex items-center justify-center ${colors.iconColor}`}>
            {icon}
          </div>
        )}
      </div>
      <p className="text-3xl font-bold text-zinc-900">{value}</p>
      {(subtitle || trend) && (
        <div className="flex items-center gap-2 mt-2">
          {trend && (
            <span className={`text-xs font-semibold flex items-center gap-1 ${trend.isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
              {trend.isPositive ? (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              ) : (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              )}
              {Math.abs(trend.value)}%
            </span>
          )}
          {subtitle && <p className="text-xs text-zinc-500">{subtitle}</p>}
        </div>
      )}
    </div>
  );
};
