import React from 'react';
import { BarChart3, DollarSign, Download, FilePlus, Receipt } from 'lucide-react';

export type FinancialsTab = 'quotes' | 'invoices' | 'payments' | 'receipts' | 'statements';

interface FinancialsTabBarProps {
  activeTab: FinancialsTab;
  onChange: (tab: FinancialsTab) => void;
  counts: {
    quotes: number;
    invoices: number;
    payments: number;
    receipts: number;
  };
}

const TABS: { id: FinancialsTab; label: string; icon: React.ElementType }[] = [
  { id: 'quotes', label: 'Quotes', icon: FilePlus },
  { id: 'invoices', label: 'Invoices', icon: Receipt },
  { id: 'payments', label: 'Payments', icon: DollarSign },
  { id: 'receipts', label: 'Receipts', icon: Download },
  { id: 'statements', label: 'Statements', icon: BarChart3 },
];

export const FinancialsTabBar: React.FC<FinancialsTabBarProps> = ({
  activeTab,
  onChange,
  counts,
}) => {
  const getCount = (id: FinancialsTab): number | undefined => {
    if (id === 'quotes') return counts.quotes;
    if (id === 'invoices') return counts.invoices;
    if (id === 'payments') return counts.payments;
    if (id === 'receipts') return counts.receipts;
    return undefined;
  };

  return (
    <div
      className="border-b"
      style={{ borderColor: 'var(--cds-border-subtle, #c6c6c6)' }}
    >
      <div className="flex overflow-x-auto">
        {TABS.map(tab => {
          const count = getCount(tab.id);
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                isActive
                  ? 'border-[#D97706] text-[#D97706]'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <Icon size={16} />
              {tab.label}
              {typeof count === 'number' && (
                <span className="ml-1 text-xs opacity-70">({count})</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
