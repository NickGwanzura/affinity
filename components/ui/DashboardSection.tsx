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
  const classes = ['bg-white border border-[#E7E5E4] p-6', className]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={classes}>
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#1C1917]">{title}</h2>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-3">{actions}</div>
        )}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
};

export default DashboardSection;
