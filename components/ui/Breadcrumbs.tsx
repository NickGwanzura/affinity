import React from 'react';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items, className = '' }) => {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={`flex items-center gap-1 text-xs ${className}`}>
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <React.Fragment key={`${item.label}-${idx}`}>
            {item.onClick && !isLast ? (
              <button
                type="button"
                onClick={item.onClick}
                className="text-[#78716C] hover:text-[#1C1917] hover:underline focus:outline-none focus-visible:underline border-0 bg-transparent p-0 cursor-pointer"
              >
                {item.label}
              </button>
            ) : (
              <span
                className={isLast ? 'text-[#1C1917] font-medium' : 'text-[#78716C]'}
                aria-current={isLast ? 'page' : undefined}
              >
                {item.label}
              </span>
            )}
            {!isLast && (
              <ChevronRight size={12} className="text-[#A8A29E]" aria-hidden="true" />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export default Breadcrumbs;
