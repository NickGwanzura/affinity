import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { IconButton, Tag, Tile } from '../ui';
import type { EnrichedClient, ClientStats } from './types';
import { formatMoney } from './types';

interface ClientDetailHeaderProps {
  client: EnrichedClient;
  stats: ClientStats;
  onEdit: () => void;
  onDelete: () => void;
  onBack: () => void;
}

export const ClientDetailHeader: React.FC<ClientDetailHeaderProps> = ({
  client,
  stats,
  onEdit,
  onDelete,
  onBack,
}) => {
  return (
    <Tile>
      <div className="mb-4 lg:hidden">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-[40px] items-center gap-2 border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
        >
          <span aria-hidden="true">←</span>
          Back to clients
        </button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-semibold text-gray-900">{client.name}</h2>
            {client.isRegistered ? (
              <Tag type="green" size="sm">Registered</Tag>
            ) : (
              <Tag type="gray" size="sm">Unregistered</Tag>
            )}
            {client.isRegistered && (
              <div className="flex gap-1">
                <IconButton
                  icon={<Pencil size={14} />}
                  variant="ghost"
                  size="sm"
                  label="Edit client"
                  onClick={onEdit}
                />
                <IconButton
                  icon={<Trash2 size={14} />}
                  variant="ghost"
                  size="sm"
                  label="Delete client"
                  onClick={onDelete}
                />
              </div>
            )}
          </div>
          {client.company && (
            <p className="text-gray-500 text-sm mt-0.5">{client.company}</p>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm text-gray-600">
            {client.email && <span>✉ {client.email}</span>}
            {client.phone && <span>📞 {client.phone}</span>}
            {client.address && <span>📍 {client.address}</span>}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mt-6 pt-4 border-t border-gray-200">
        <StatItem label="Opening Bal" value={formatMoney(stats.openingBalance)} />
        <StatItem label="Total Billed" value={formatMoney(stats.totalBilled)} />
        <StatItem
          label="Total Paid"
          value={formatMoney(stats.totalPaid)}
          tone="success"
        />
        <StatItem
          label={
            stats.outstanding > 0 ? 'Balance Due' : stats.creditBalance > 0 ? 'Credit' : 'Balance'
          }
          value={
            stats.outstanding > 0
              ? formatMoney(stats.outstanding)
              : stats.creditBalance > 0
                ? formatMoney(stats.creditBalance)
                : formatMoney(0)
          }
          tone={stats.outstanding > 0 ? 'danger' : stats.creditBalance > 0 ? 'success' : 'default'}
        />
        <StatItem label="Quotes" value={String(stats.quoteCount)} tone="info" />
      </div>
    </Tile>
  );
};

const toneColor: Record<string, string> = {
  default: 'text-gray-900',
  success: 'text-green-600',
  danger: 'text-red-600',
  info: 'text-blue-600',
};

const StatItem: React.FC<{
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'danger' | 'info';
}> = ({ label, value, tone = 'default' }) => (
  <div>
    <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">{label}</p>
    <p className={`text-xl font-semibold mt-1 ${toneColor[tone]}`}>{value}</p>
  </div>
);

export default ClientDetailHeader;
