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
      {/* Mobile: native select */}
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

      {/* Desktop: segmented control */}
      <div
        role="tablist"
        aria-label={label}
        className="hidden md:inline-flex border border-gray-300 bg-white"
      >
        {options.map((opt) => {
          const isActive = opt.id === value;
          return (
            <button
              key={String(opt.id)}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(opt.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-r border-gray-300 last:border-r-0 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 ${
                isActive
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {opt.icon}
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DashboardSectionSwitcher;
