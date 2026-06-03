import React from 'react';
import { Pencil, Trash2, Mail, Phone, MapPin } from 'lucide-react';
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
          className="inline-flex min-h-[40px] items-center gap-2 border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
        >
          <span aria-hidden="true">←</span>
          Back to clients
        </button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-semibold text-zinc-900">{client.name}</h2>
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
            <p className="text-zinc-500 text-sm mt-0.5">{client.company}</p>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm text-zinc-600">
            {client.email && (
              <span className="inline-flex items-center gap-1.5">
                <Mail size={14} className="text-zinc-600" />
                {client.email}
              </span>
            )}
            {client.phone && (
              <span className="inline-flex items-center gap-1.5">
                <Phone size={14} className="text-zinc-600" />
                {client.phone}
              </span>
            )}
            {client.address && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={14} className="text-zinc-600" />
                {client.address}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mt-6 pt-4 border-t border-zinc-200">
        <StatItem label="Opening Bal" value={formatMoney(stats.openingBalance)} />
        <StatItem label="Total Billed" value={formatMoney(stats.totalBilled)} />
        <StatItem
          label="Total Paid"
          value={formatMoney(stats.totalPaid)}
          tone="success"
        />
        <OutstandingStats usd={stats.usdBalance} gbp={stats.gbpBalance} />
        <StatItem label="Quotes" value={String(stats.quoteCount)} tone="info" />
      </div>
    </Tile>
  );
};

const OutstandingStats: React.FC<{ usd: number; gbp: number }> = ({ usd, gbp }) => {
  const hasUsd = Math.abs(usd) > 0.005;
  const hasGbp = Math.abs(gbp) > 0.005;

  if (!hasUsd && !hasGbp) {
    return <StatItem label="Balance" value="Settled" tone="default" />;
  }

  const renderOne = (amount: number, currency: 'USD' | 'GBP') => {
    const label =
      amount > 0
        ? `Outstanding (${currency})`
        : amount < 0
          ? `Credit (${currency})`
          : `Balance (${currency})`;
    const tone: 'danger' | 'success' | 'default' =
      amount > 0 ? 'danger' : amount < 0 ? 'success' : 'default';
    return (
      <StatItem
        key={currency}
        label={label}
        value={formatMoney(Math.abs(amount), currency)}
        tone={tone}
      />
    );
  };

  if (hasUsd && hasGbp) {
    // Stack both mini-stats in the grid cell so the row stays 5-column.
    return (
      <div className="flex flex-col gap-2">
        {renderOne(usd, 'USD')}
        {renderOne(gbp, 'GBP')}
      </div>
    );
  }
  return hasUsd ? renderOne(usd, 'USD') : renderOne(gbp, 'GBP');
};

const toneColor: Record<string, string> = {
  default: 'text-zinc-900',
  success: 'text-green-600',
  danger: 'text-red-600',
  info: 'text-amber-600',
};

const StatItem: React.FC<{
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'danger' | 'info';
}> = ({ label, value, tone = 'default' }) => (
  <div>
    <p className="text-xs text-zinc-500 uppercase font-semibold tracking-[0.08em]">{label}</p>
    <p className={`text-xl font-semibold mt-1 ${toneColor[tone]}`}>{value}</p>
  </div>
);

export default ClientDetailHeader;
