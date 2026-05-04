import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

export type Intent = 'primary' | 'success' | 'danger' | 'warning' | 'info' | 'neutral';

interface StatCardProps {
  title:     string;
  value:     string | number;
  subtitle?: string;
  icon?:     React.ReactNode;
  trend?: {
    value:      number;
    isPositive: boolean;
  };
  intent?:    Intent;
  isLoading?: boolean;
  className?: string;
}

const intentMap: Record<Intent, { bg: string; text: string }> = {
  primary: { bg: '#D97706', text: '#ffffff' },
  success: { bg: '#059669', text: '#ffffff' },
  danger:  { bg: '#dc2626', text: '#ffffff' },
  warning: { bg: '#f59e0b', text: '#18181b' },
  info:    { bg: '#2563eb', text: '#ffffff' },
  neutral: { bg: '#e4e4e7', text: '#18181b' },
};

const SkeletonLine = ({ width, className = '' }: { width: string; className?: string }) => (
  <div className={`h-4 app-shimmer rounded ${className}`} style={{ width }} />
);

const SkeletonBox = ({ width, height }: { width: number; height: number }) => (
  <div className="app-shimmer rounded" style={{ width, height }} />
);

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  intent    = 'primary',
  isLoading = false,
  className = '',
}) => {
  const accent = intentMap[intent];

  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg border border-stone-200 p-6 ${className}`}>
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
    <div className={`group relative overflow-hidden bg-white rounded-lg border border-stone-200 p-6 transition-[box-shadow,transform,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md hover:border-stone-300 ${className}`}>
      <div className="absolute top-0 left-0 w-1 h-full" style={{ background: accent.bg }} />
      {/* Subtle accent glow that warms on hover */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-30"
        style={{ background: accent.bg }}
      />

      <div className="relative pl-2">
        <div className="flex justify-between items-start mb-3 gap-3">
          <p className="text-[11px] font-semibold text-zinc-500 tracking-[0.08em] uppercase">
            {title}
          </p>
          {icon && (
            <div
              className="w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0 shadow-sm transition-transform duration-200 ease-out group-hover:scale-105"
              style={{ background: accent.bg, color: accent.text }}
            >
              {icon}
            </div>
          )}
        </div>

        <p className="text-3xl font-semibold text-zinc-900 tabular-nums tracking-tight leading-tight mb-2">
          {value}
        </p>

        {(trend || subtitle) && (
          <div className="flex items-center gap-2 flex-wrap">
            {trend && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                  trend.isPositive
                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70'
                    : 'bg-red-50 text-red-700 ring-1 ring-red-200/70'
                }`}
              >
                {trend.isPositive ? <TrendingUp size={11} aria-hidden="true" /> : <TrendingDown size={11} aria-hidden="true" />}
                <span className="tabular-nums">{Math.abs(trend.value)}%</span>
              </span>
            )}
            {subtitle && (
              <span className="text-xs text-zinc-500">
                {subtitle}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
