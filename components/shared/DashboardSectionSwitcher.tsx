import React from 'react';

export interface DashboardSectionOption<T extends string> {
  id: T;
  label: string;
  activeClasses?: string;
  icon?: React.ReactNode;
}

interface DashboardSectionSwitcherProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  label: string;
  options: Array<DashboardSectionOption<T>>;
}

export const DashboardSectionSwitcher = <T extends string>({
  value,
  onChange,
  label,
  options,
}: DashboardSectionSwitcherProps<T>) => (
  <div className="w-full md:w-auto">
    <div className="md:hidden">
      <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
    <div className="hidden items-center gap-2 overflow-x-auto pb-2 md:flex md:flex-wrap">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition-all ${
            value === option.id
              ? option.activeClasses || 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100'
              : 'bg-zinc-100 text-zinc-700'
          }`}
        >
          <span className="flex items-center gap-2">
            {option.icon}
            {option.label}
          </span>
        </button>
      ))}
    </div>
  </div>
);

export default DashboardSectionSwitcher;
