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
                    isActive ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
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
                      {stats.outstanding > 0 ? (
                        <p className="text-xs font-semibold text-red-600">
                          {formatMoney(stats.outstanding)} due
                        </p>
                      ) : stats.creditBalance > 0 ? (
                        <p className="text-xs font-semibold text-green-600">
                          {formatMoney(stats.creditBalance)} cr
                        </p>
                      ) : null}
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

export default ClientListSidebar;
