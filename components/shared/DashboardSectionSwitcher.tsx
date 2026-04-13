import React from 'react';
import { ContentSwitcher, Switch, Select } from '@carbon/react';

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
  <div style={{ width: '100%' }}>
    {/* Mobile: Carbon Select */}
    <div className="md:hidden">
      <Select
        id={`section-switcher-select-${label.replace(/\s+/g, '-').toLowerCase()}`}
        labelText={label}
        hideLabel
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((option) => (
          <option key={String(option.id)} value={String(option.id)}>{option.label}</option>
        ))}
      </Select>
    </div>

    {/* Desktop: Carbon ContentSwitcher */}
    <div className="hidden md:block">
      <ContentSwitcher
        selectedIndex={options.findIndex((o) => o.id === value)}
        onChange={({ name }: { name?: string | number }) => {
          if (typeof name === 'string') onChange(name as T);
        }}
      >
        {options.map((option) => (
          <Switch key={option.id} name={option.id} text={option.label} />
        ))}
      </ContentSwitcher>
    </div>
  </div>
);

export default DashboardSectionSwitcher;
