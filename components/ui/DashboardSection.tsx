import React from 'react';

export interface DashboardSectionProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * Panel primitive for dashboard feature sections.
 * Ported from coolpro2026. Square corners, white surface, #E7E5E4 stroke.
 */
export const DashboardSection: React.FC<DashboardSectionProps> = ({
  title,
  subtitle,
  actions,
  children,
  className,
}) => {
  const classes = ['bg-white border border-stone-200 rounded-lg p-5 sm:p-6', className]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={classes}>
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">{title}</h2>
          {subtitle && (
            <p className="text-sm text-zinc-500 mt-1 leading-relaxed">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">{actions}</div>
        )}
      </div>
      <div className="mt-5 sm:mt-6">{children}</div>
    </section>
  );
};

export default DashboardSection;
