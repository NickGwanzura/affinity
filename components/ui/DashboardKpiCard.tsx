import React from 'react';
import type { LucideIcon } from 'lucide-react';

export type KpiIconTone =
  | 'amber'
  | 'blue'
  | 'emerald'
  | 'purple'
  | 'rose'
  | 'stone';

export interface DashboardKpiCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  iconTone?: KpiIconTone;
  trendIcon?: React.ReactNode;
  href?: string;
  onClick?: () => void;
}

const TONE_CLASSES: Record<KpiIconTone, string> = {
  amber: 'bg-[#D97706]/10 text-[#D97706]',
  blue: 'bg-blue-50 text-blue-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  purple: 'bg-purple-50 text-purple-600',
  rose: 'bg-rose-50 text-rose-600',
  stone: 'bg-stone-100 text-stone-700',
};

/**
 * KPI tile primitive. Ported from coolpro2026.
 * White surface, square corners, #E7E5E4 stroke. Amber brand default.
 */
export const DashboardKpiCard: React.FC<DashboardKpiCardProps> = ({
  label,
  value,
  icon: Icon,
  trend,
  iconTone = 'amber',
  trendIcon,
  href,
  onClick,
}) => {
  const interactive = Boolean(href || onClick);
  const body = (
    <div
      className={[
        'relative overflow-hidden rounded-xl bg-white p-5 border border-stone-200 h-full transition-[box-shadow,transform,border-color] duration-200 ease-out',
        interactive ? 'group-hover:-translate-y-0.5 group-hover:shadow-md group-hover:border-stone-300' : '',
      ].join(' ')}
    >
      {interactive && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-[#D97706]/5 opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-100"
        />
      )}
      <div className="relative flex items-center justify-between">
        <div
          className={`inline-flex items-center justify-center rounded-lg p-2.5 transition-transform duration-200 ease-out ${TONE_CLASSES[iconTone]} ${
            interactive ? 'group-hover:scale-105' : ''
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
        {trendIcon ? (
          <span className="text-emerald-600 inline-flex items-center">{trendIcon}</span>
        ) : null}
      </div>
      <div className="relative mt-4">
        <p className="truncate text-xl font-bold text-zinc-900 tabular-nums tracking-tight sm:text-2xl md:text-3xl">{value}</p>
        <p className="mt-1 text-sm text-zinc-500">{label}</p>
        {trend && <p className="mt-1.5 text-xs text-zinc-400">{trend}</p>}
      </div>
    </div>
  );

  if (href) {
    return (
      <a
        href={href}
        className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706]/40 focus-visible:ring-offset-2"
      >
        {body}
      </a>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706]/40 focus-visible:ring-offset-2"
      >
        {body}
      </button>
    );
  }

  return body;
};

export default DashboardKpiCard;
