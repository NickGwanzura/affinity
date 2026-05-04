import React from 'react';

export interface DashboardPageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  banner?: React.ReactNode;
}

/**
 * Page header primitive for dashboard pages.
 * Ported from coolpro2026 — stacks vertically on mobile, row on desktop.
 * Square corners. No rounded/shadow. Amber-brand accent on optional banner.
 */
export const DashboardPageHeader: React.FC<DashboardPageHeaderProps> = ({
  title,
  subtitle,
  actions,
  banner,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">{title}</h1>
          {subtitle && (
            <p className="text-sm text-zinc-500 mt-1 leading-relaxed">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">{actions}</div>
        )}
      </div>
      {banner && (
        <div className="rounded-lg border border-[#D97706]/30 bg-[#D97706]/[0.06] px-4 py-3 shadow-[inset_0_1px_0_rgba(217,119,6,0.08)]">
          {banner}
        </div>
      )}
    </div>
  );
};

export default DashboardPageHeader;
