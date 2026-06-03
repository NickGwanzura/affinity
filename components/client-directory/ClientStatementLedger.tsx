import React from 'react';
import { Download } from 'lucide-react';
import { Button, Tag, Tile } from '../ui';
import type { LedgerRow, ClientStats } from './types';
import { formatMoney } from './types';

interface ClientStatementLedgerProps {
  ledger: LedgerRow[];
  stats: ClientStats;
  openingBalance: number;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onDownloadPdf: () => void;
  isGenerating: boolean;
}

const typeTag = (type: LedgerRow['type']) => {
  if (type === 'opening') return <Tag type="gray" size="sm">Opening</Tag>;
  if (type === 'invoice') return <Tag type="blue" size="sm">Invoice</Tag>;
  return <Tag type="green" size="sm">Payment</Tag>;
};

export const ClientStatementLedger: React.FC<ClientStatementLedgerProps> = ({
  ledger,
  stats: _stats,
  openingBalance,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onDownloadPdf,
  isGenerating,
}) => {
  void _stats;
  const filtered = ledger.filter((entry) => {
    if (!dateFrom && !dateTo) return true;
    const d = entry.date.toISOString().split('T')[0];
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  });

  // Per-currency closing balances: we walk the filtered ledger and track
  // USD/GBP running totals independently so currencies never get summed.
  const currencyClosings = filtered.reduce(
    (acc, entry) => {
      const cur = entry.currency || 'USD';
      acc[cur] = entry.balance;
      return acc;
    },
    { USD: 0, GBP: 0 } as Record<'USD' | 'GBP', number>
  );
  const hasUsd = filtered.some((e) => (e.currency || 'USD') === 'USD');
  const hasGbp = filtered.some((e) => e.currency === 'GBP');

  // Legacy fallback used when the filtered view is empty.
  const closingBalance =
    filtered.length > 0 ? filtered[filtered.length - 1].balance : openingBalance;

  return (
    <div className="flex flex-col gap-4">
      <Tile>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end sm:justify-between">
          <div className="flex gap-3 flex-wrap">
            <div className="flex flex-col gap-1">
              <label htmlFor="ledger-date-from" className="text-xs font-medium text-zinc-700">
                From
              </label>
              <input
                id="ledger-date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => onDateFromChange(e.target.value)}
                className="border border-zinc-300 bg-white px-2 py-1.5 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="ledger-date-to" className="text-xs font-medium text-zinc-700">
                To
              </label>
              <input
                id="ledger-date-to"
                type="date"
                value={dateTo}
                onChange={(e) => onDateToChange(e.target.value)}
                className="border border-zinc-300 bg-white px-2 py-1.5 text-sm"
              />
            </div>
          </div>
          <Button
            leftIcon={<Download size={14} />}
            onClick={onDownloadPdf}
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating…' : 'Download PDF Statement'}
          </Button>
        </div>
      </Tile>

      <div className="bg-white border border-zinc-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-zinc-600">Date</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-zinc-600">Type</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-zinc-600">Reference</th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-[0.08em] text-zinc-600">Debit</th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-[0.08em] text-zinc-600">Credit</th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-[0.08em] text-zinc-600">Balance</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-zinc-500 text-sm">
                  No entries for the selected date range
                </td>
              </tr>
            ) : (
              <>
                {filtered.map((entry, idx) => {
                  const rowCurrency = entry.currency || 'USD';
                  return (
                    <tr key={idx} className="border-t border-zinc-100 hover:bg-zinc-50">
                      <td className="px-3 py-2 text-zinc-800">{entry.date.toLocaleDateString()}</td>
                      <td className="px-3 py-2">{typeTag(entry.type)}</td>
                      <td className="px-3 py-2 font-mono text-xs text-zinc-700">{entry.reference}</td>
                      <td className="px-3 py-2 text-right font-semibold text-red-600">
                        {entry.debit > 0 ? formatMoney(entry.debit, rowCurrency) : '–'}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-green-600">
                        {entry.credit > 0 ? formatMoney(entry.credit, rowCurrency) : '–'}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-semibold ${
                          entry.balance > 0
                            ? 'text-red-600'
                            : entry.balance < 0
                              ? 'text-green-600'
                              : 'text-zinc-900'
                        }`}
                      >
                        {formatMoney(Math.abs(entry.balance), rowCurrency)}{' '}
                        {entry.balance > 0 ? 'DR' : entry.balance < 0 ? 'CR' : ''}
                      </td>
                    </tr>
                  );
                })}
                {hasUsd && hasGbp ? (
                  <>
                    <ClosingBalanceRow
                      label="Closing Balance (USD)"
                      amount={currencyClosings.USD}
                      currency="USD"
                    />
                    <ClosingBalanceRow
                      label="Closing Balance (GBP)"
                      amount={currencyClosings.GBP}
                      currency="GBP"
                    />
                  </>
                ) : (
                  <ClosingBalanceRow
                    label="Current Balance"
                    amount={
                      hasGbp
                        ? currencyClosings.GBP
                        : hasUsd
                          ? currencyClosings.USD
                          : closingBalance
                    }
                    currency={hasGbp ? 'GBP' : 'USD'}
                  />
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ClosingBalanceRow: React.FC<{
  label: string;
  amount: number;
  currency: 'USD' | 'GBP';
}> = ({ label, amount, currency }) => (
  <tr className="border-t-2 border-zinc-800 bg-zinc-50">
    <td colSpan={5} className="px-3 py-3">
      <span className="font-semibold uppercase tracking-[0.08em] text-xs">{label}</span>
    </td>
    <td
      className={`px-3 py-3 text-right font-bold text-lg ${
        amount > 0
          ? 'text-red-600'
          : amount < 0
            ? 'text-green-600'
            : 'text-zinc-900'
      }`}
    >
      {amount > 0
        ? `${formatMoney(amount, currency)} DR`
        : amount < 0
          ? `${formatMoney(Math.abs(amount), currency)} CR`
          : formatMoney(0, currency)}
    </td>
  </tr>
);

export default ClientStatementLedger;
