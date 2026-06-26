import React from 'react';
import { Tag } from '../ui';

export type SettingsTabKey = 'company' | 'exchange-rates' | 'users' | 'forensics' | 'requests' | 'invites';

interface TabDef {
  key: SettingsTabKey;
  label: string;
}

const TABS: TabDef[] = [
  { key: 'company', label: 'Company Profile' },
  { key: 'exchange-rates', label: 'Exchange Rates' },
  { key: 'users', label: 'User Management' },
  { key: 'forensics', label: 'Forensic Log' },
  { key: 'requests', label: 'Requests' },
  { key: 'invites', label: 'Invitations' },
];

interface SettingsTabBarProps {
  activeTab: SettingsTabKey;
  onChange: (tab: SettingsTabKey) => void;
  pendingRequests: number;
  pendingInvites: number;
}

export const SettingsTabBar: React.FC<SettingsTabBarProps> = ({
  activeTab,
  onChange,
  pendingRequests,
  pendingInvites,
}) => {
  return (
    <div
      className="flex overflow-x-auto"
      style={{
        borderBottom: '1px solid #d6d3d1',
        background: '#ffffff',
      }}
    >
      {TABS.map(({ key, label }) => {
        const isActive = activeTab === key;
        const badge =
          key === 'requests' && pendingRequests > 0 ? (
            <span className="ml-2 px-2 py-0.5 text-xs font-bold">
              <Tag type="warm-gray" size="sm">
                {pendingRequests}
              </Tag>
            </span>
          ) : key === 'invites' && pendingInvites > 0 ? (
            <span className="ml-2 px-2 py-0.5 text-xs font-bold">
              <Tag type="green" size="sm">
                {pendingInvites}
              </Tag>
            </span>
          ) : null;

        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`px-6 py-4 text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${
              isActive ? '' : 'border-transparent'
            }`}
            style={
              isActive
                ? {
                    borderColor: '#D97706',
                    color: '#D97706',
                    background: '#ffffff',
                  }
                : { color: '#52525b' }
            }
          >
            {label}
            {badge && <>{' '}{badge}</>}
          </button>
        );
      })}
    </div>
  );
};

export default SettingsTabBar;
