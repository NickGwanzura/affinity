import React, { createContext, useContext, useState } from 'react';

interface TabsContext {
  selected: number;
  setSelected: (i: number) => void;
}
const Ctx = createContext<TabsContext | null>(null);

interface TabsProps {
  selectedIndex?:   number;
  defaultSelected?: number;
  onChange?:        (payload: { selectedIndex: number }) => void;
  children:         React.ReactNode;
  className?:       string;
}
export const Tabs: React.FC<TabsProps> = ({
  selectedIndex, defaultSelected = 0, onChange, children, className = '',
}) => {
  const [internal, setInternal] = useState(defaultSelected);
  const selected = selectedIndex ?? internal;
  const setSelected = (i: number) => {
    if (selectedIndex === undefined) setInternal(i);
    onChange?.({ selectedIndex: i });
  };
  return (
    <Ctx.Provider value={{ selected, setSelected }}>
      <div className={className}>{children}</div>
    </Ctx.Provider>
  );
};

interface TabListProps {
  children:   React.ReactNode;
  className?: string;
  'aria-label'?: string;
}
export const TabList: React.FC<TabListProps> = ({ children, className = '', ...rest }) => {
  const arr = React.Children.toArray(children);
  return (
    <div
      role="tablist"
      className={`relative overflow-x-auto border-b border-stone-200 [scrollbar-width:thin] ${className}`}
      {...rest}
    >
      <div className="flex min-w-max">
        {arr.map((child, i) =>
          React.isValidElement(child)
            ? React.cloneElement(child as React.ReactElement<{ index?: number }>, { index: i })
            : child
        )}
      </div>
    </div>
  );
};

interface TabProps {
  children:   React.ReactNode;
  disabled?:  boolean;
  className?: string;
  index?:     number;
}
export const Tab: React.FC<TabProps> = ({ children, disabled, className = '', index = 0 }) => {
  const ctx = useContext(Ctx);
  if (!ctx) return null;
  const isActive = ctx.selected === index;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      disabled={disabled}
      onClick={() => !disabled && ctx.setSelected(index)}
      className={`group relative inline-flex shrink-0 items-center px-3.5 py-2.5 text-sm whitespace-nowrap transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#D97706]/40 disabled:opacity-50 disabled:cursor-not-allowed ${
        isActive
          ? 'text-[#D97706] font-semibold'
          : 'text-zinc-600 hover:text-zinc-900'
      } ${className}`}
    >
      <span className="relative z-10">{children}</span>
      {/* Active indicator: amber bar with subtle glow */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-3 bottom-0 h-[2px] origin-center rounded-full bg-[#D97706] transition-transform duration-200 ease-out ${
          isActive ? 'scale-x-100 opacity-100' : 'scale-x-0 opacity-0'
        }`}
        style={{ boxShadow: isActive ? '0 0 12px rgba(217,119,6,0.35)' : undefined }}
      />
      {/* Inactive hover hint */}
      {!isActive && !disabled && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-3 bottom-0 h-[2px] origin-center scale-x-0 rounded-full bg-stone-300 transition-transform duration-150 ease-out group-hover:scale-x-100"
        />
      )}
    </button>
  );
};

interface TabPanelsProps {
  children:   React.ReactNode;
  className?: string;
}
export const TabPanels: React.FC<TabPanelsProps> = ({ children, className = '' }) => {
  const ctx = useContext(Ctx);
  if (!ctx) return null;
  const arr = React.Children.toArray(children);
  return <div className={className}>{arr[ctx.selected] ?? null}</div>;
};

interface TabPanelProps {
  children:   React.ReactNode;
  className?: string;
}
export const TabPanel: React.FC<TabPanelProps> = ({ children, className = '' }) => (
  <div role="tabpanel" className={className}>{children}</div>
);
