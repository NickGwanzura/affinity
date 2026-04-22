import React from 'react';
import { Search } from 'lucide-react';
import type { EnrichedClient, ClientStats } from './types';
import { formatMoney } from './types';

interface ClientListSidebarProps {
  clients: EnrichedClient[];
  selectedClientId: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (client: EnrichedClient) => void;
  getStats: (clientName: string) => ClientStats;
  hidden?: boolean;
}

export const ClientListSidebar: React.FC<ClientListSidebarProps> = ({
  clients,
  selectedClientId,
  search,
  onSearchChange,
  onSelect,
  getStats,
  hidden,
}) => {
  return (
    <div className={`w-full lg:w-80 flex-shrink-0 ${hidden ? 'hidden lg:block' : ''}`}>
      <div className="bg-white border border-gray-200">
        <div className="p-3 border-b border-gray-200">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search clients..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 bg-white"
            />
          </div>
        </div>
        <div className="overflow-y-auto max-h-none lg:max-h-[calc(100vh-260px)]">
          {clients.length === 0 ? (
            <p className="text-center py-12 text-gray-500 text-sm">No clients found</p>
          ) : (
            clients.map((client) => {
              const stats = getStats(client.name);
              const isActive = selectedClientId === client.id;
              return (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => onSelect(client)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 transition-colors hover:bg-gray-50 ${
                    isActive ? 'bg-amber-50 border-l-4 border-l-amber-600' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{client.name}</p>
                      {client.company ? (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{client.company}</p>
                      ) : client.email ? (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{client.email}</p>
                      ) : null}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-semibold text-gray-700">{stats.invoiceCount} inv</p>
                      <SidebarBalance usd={stats.usdBalance} gbp={stats.gbpBalance} />
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

const SidebarBalance: React.FC<{ usd: number; gbp: number }> = ({ usd, gbp }) => {
  const hasUsd = Math.abs(usd) > 0.005;
  const hasGbp = Math.abs(gbp) > 0.005;
  if (!hasUsd && !hasGbp) return null;

  // Primary line shows USD balance; GBP exposure gets a tiny "+£" marker
  // so the sidebar stays visually tight. Detail header is the place for
  // the full two-currency breakdown.
  const usdLabel =
    usd > 0
      ? `${formatMoney(usd, 'USD')} due`
      : usd < 0
        ? `${formatMoney(Math.abs(usd), 'USD')} cr`
        : null;
  const usdClass = usd > 0 ? 'text-red-600' : 'text-green-600';

  const gbpMarker = hasGbp
    ? gbp > 0
      ? `+${formatMoney(gbp, 'GBP')}`
      : `+${formatMoney(Math.abs(gbp), 'GBP')} cr`
    : null;

  return (
    <div className="flex flex-col items-end">
      {usdLabel ? (
        <p className={`text-xs font-semibold ${usdClass}`}>{usdLabel}</p>
      ) : hasGbp ? (
        <p
          className={`text-xs font-semibold ${gbp > 0 ? 'text-red-600' : 'text-green-600'}`}
        >
          {gbp > 0
            ? `${formatMoney(gbp, 'GBP')} due`
            : `${formatMoney(Math.abs(gbp), 'GBP')} cr`}
        </p>
      ) : null}
      {usdLabel && gbpMarker ? (
        <p className="text-[10px] font-semibold text-amber-600">{gbpMarker}</p>
      ) : null}
    </div>
  );
};

export default ClientListSidebar;
