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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#1C1917]">{title}</h1>
          {subtitle && (
            <p className="text-sm text-[#78716C] mt-0.5">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-3">{actions}</div>
        )}
      </div>
      {banner && (
        <div className="border border-[#D97706]/30 bg-[#D97706]/5 px-4 py-3">
          {banner}
        </div>
      )}
    </div>
  );
};

export default DashboardPageHeader;
