import React from 'react';
import { Select, SelectItem } from '../ui';

export interface DashboardSectionOption<T extends string> {
  id:             T;
  label:          string;
  activeClasses?: string;
  icon?:          React.ReactNode;
}

interface DashboardSectionSwitcherProps<T extends string> {
  value:    T;
  onChange: (value: T) => void;
  label:    string;
  options:  Array<DashboardSectionOption<T>>;
}

export const DashboardSectionSwitcher = <T extends string>({
  value, onChange, label, options,
}: DashboardSectionSwitcherProps<T>) => {
  const slug = label.replace(/\s+/g, '-').toLowerCase();

  return (
    <div className="w-full">
      {/* Mobile: native select keeps things compact + accessible. */}
      <div className="md:hidden">
        <Select
          id={`section-switcher-select-${slug}`}
          labelText={label}
          hideLabel
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
        >
          {options.map((opt) => (
            <SelectItem key={String(opt.id)} value={String(opt.id)} text={opt.label} />
          ))}
        </Select>
      </div>

      {/* Desktop: scrollable tab-rail with animated underline indicator.
          Matches the shared Tabs primitive so cross-page navigation feels
          identical. Handles 9–10+ tabs without breaking the page grid. */}
      <div
        role="tablist"
        aria-label={label}
        className="hidden md:block relative overflow-x-auto border-b border-stone-300 [scrollbar-width:thin]"
      >
        <div className="flex min-w-max">
          {options.map((opt) => {
            const isActive = opt.id === value;
            return (
              <button
                key={String(opt.id)}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onChange(opt.id)}
                className={`group relative inline-flex shrink-0 items-center gap-2 whitespace-nowrap px-3.5 py-2.5 text-sm transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#D97706]/40 ${
                  isActive
                    ? 'text-[#D97706] font-semibold'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                {opt.icon && (
                  <span
                    className={`inline-flex items-center transition-colors duration-150 ${
                      isActive ? 'text-[#D97706]' : 'text-zinc-500 group-hover:text-zinc-700'
                    }`}
                    aria-hidden="true"
                  >
                    {opt.icon}
                  </span>
                )}
                <span className="relative z-10">{opt.label}</span>

                {/* Active indicator: amber bar overlaid on the rail line. */}
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-x-3 -bottom-px h-[2px] origin-center rounded-full bg-[#D97706] transition-transform duration-200 ease-out ${
                    isActive ? 'scale-x-100 opacity-100' : 'scale-x-0 opacity-0'
                  }`}
                  style={{ boxShadow: isActive ? '0 0 12px rgba(217,119,6,0.35)' : undefined }}
                />

                {/* Inactive hover preview underline (stone-400 for contrast against rail). */}
                {!isActive && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-3 -bottom-px h-[2px] origin-center scale-x-0 rounded-full bg-stone-400 transition-transform duration-150 ease-out group-hover:scale-x-100"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DashboardSectionSwitcher;
