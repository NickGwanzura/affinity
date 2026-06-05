import React, { useState } from 'react';
import { Snowflake, Wifi, Car, Building2, TrendingUp } from 'lucide-react';
import FreezitSales from './FreezitSales';
import WiFiTokenSales from './WiFiTokenSales';
import CarHire from './CarHire';
import IceSales from './IceSales';
import Lodgers from './Lodgers';
import SalesPL from './SalesPL';

const TABS = [
  { id: 'freezit',    label: 'Freezit Sales',    Icon: Snowflake,  Component: FreezitSales   },
  { id: 'ice',        label: 'Ice Sales',         Icon: Snowflake,  Component: IceSales       },
  { id: 'wifi',       label: 'WiFi Tokens',       Icon: Wifi,       Component: WiFiTokenSales },
  { id: 'car-hire',   label: 'Car Hire',          Icon: Car,        Component: CarHire        },
  { id: 'lodgers',    label: 'Lodgers',           Icon: Building2,  Component: Lodgers        },
  { id: 'sales-pl',   label: 'Sales P&L',         Icon: TrendingUp, Component: SalesPL        },
] as const;

type TabId = typeof TABS[number]['id'];

interface Props {
  initialTab?: TabId;
}

export const SalesHub: React.FC<Props> = ({ initialTab = 'freezit' }) => {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const active = TABS.find(t => t.id === activeTab) ?? TABS[0];

  return (
    <div className="space-y-0">
      {/* Tab bar */}
      <div className="sticky top-0 z-10 bg-[#F9F9F8] border-b border-stone-200 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 mb-6">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={[
                'flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors shrink-0',
                activeTab === id
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800 hover:border-stone-300',
              ].join(' ')}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Active module */}
      <active.Component />
    </div>
  );
};

export default SalesHub;
