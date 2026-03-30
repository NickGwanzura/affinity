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
  <div style={{ width: '100%' }}>
    {/* Mobile select */}
    <div style={{ display: 'block' }} className="md:hidden">
      <label style={{ 
        display: 'block', 
        marginBottom: '0.5rem', 
        fontSize: '0.75rem', 
        fontWeight: 700, 
        textTransform: 'uppercase', 
        letterSpacing: '0.1em',
        color: 'var(--cds-text-secondary, #525252)'
      }}>
        {label}
      </label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        style={{
          width: '100%',
          padding: '0.75rem 1rem',
          fontSize: '0.875rem',
          fontWeight: 600,
          color: 'var(--cds-text-primary, #161616)',
          background: 'var(--cds-layer-01, #ffffff)',
          border: '1px solid var(--cds-border-subtle, #e0e0e0)',
          outline: 'none',
        }}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
    
    {/* Desktop buttons */}
    <div style={{ 
      display: 'none',
      alignItems: 'center', 
      gap: '0.5rem', 
      overflowX: 'auto', 
      paddingBottom: '0.5rem',
      flexWrap: 'wrap'
    }} className="md:flex">
      {options.map((option) => {
        const isActive = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            style={{
              whiteSpace: 'nowrap',
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              transition: 'all 0.15s',
              background: isActive 
                ? 'var(--cds-interactive, #0f62fe)' 
                : 'var(--cds-layer-01, #f4f4f4)',
              color: isActive 
                ? 'var(--cds-text-on-color, #ffffff)' 
                : 'var(--cds-text-primary, #161616)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'var(--cds-layer-hover, #e8e8e8)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'var(--cds-layer-01, #f4f4f4)';
              }
            }}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  </div>
);

export default DashboardSectionSwitcher;
