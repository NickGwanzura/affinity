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
  const body = (
    <div className="bg-white p-6 border border-[#E7E5E4] h-full">
      <div className="flex items-center justify-between">
        <div className={`p-2.5 ${TONE_CLASSES[iconTone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        {trendIcon ? (
          <span className="text-emerald-500">{trendIcon}</span>
        ) : null}
      </div>
      <div className="mt-4">
        <p className="text-3xl font-bold text-[#1C1917]">{value}</p>
        <p className="text-sm text-[#78716C] mt-1">{label}</p>
        {trend && <p className="text-xs text-[#A8A29E] mt-2">{trend}</p>}
      </div>
    </div>
  );

  if (href) {
    return (
      <a
        href={href}
        className="block transition-colors focus:outline-none focus:ring-2 focus:ring-[#D97706]/40"
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
        className="block w-full text-left transition-colors focus:outline-none focus:ring-2 focus:ring-[#D97706]/40"
      >
        {body}
      </button>
    );
  }

  return body;
};

export default DashboardKpiCard;
