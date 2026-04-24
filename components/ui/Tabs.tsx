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
      className={`flex border-b border-gray-200 overflow-x-auto ${className}`}
      {...rest}
    >
      {arr.map((child, i) =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement<{ index?: number }>, { index: i })
          : child
      )}
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
      className={`px-4 py-3 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#D97706] disabled:opacity-50 ${
        isActive
          ? 'border-[#D97706] text-[#D97706] font-semibold'
          : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
      } ${className}`}
    >
      {children}
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
