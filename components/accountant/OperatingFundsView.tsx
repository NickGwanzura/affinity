import React from 'react';
import type { OperatingFund } from '../../types';
import type { DriverFundsReportData } from '../../utils/driverFunds';
import { Button, DriverFundsSnapshotPanel, DriverFundsSummaryPanel } from '../ui';
import { formatDate } from '../../utils/formatters';

interface OperatingFundsViewProps {
  operatingFunds: OperatingFund[];
  driverFundsReport: DriverFundsReportData;
  formatCurrency: (amount: number, currency?: 'USD' | 'GBP') => string;
  onDeleteFund: (id: string) => void;
  onExportDriverFundsReport: () => void;
  onOpenFundModal: () => void;
}

export const OperatingFundsView: React.FC<OperatingFundsViewProps> = ({
  operatingFunds,
  driverFundsReport,
  formatCurrency,
  onDeleteFund,
  onExportDriverFundsReport,
  onOpenFundModal,
}) => {
  const totalReceived = operatingFunds.filter((fund) => fund.type === 'Received').reduce((sum, fund) => sum + fund.amount, 0);
  const totalDisbursed = operatingFunds.filter((fund) => fund.type === 'Disbursed').reduce((sum, fund) => sum + fund.amount, 0);
  const balance = totalReceived - totalDisbursed;

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-bold text-zinc-900">Operating Funds</h3>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
          <Button size="sm" variant="secondary" onClick={onExportDriverFundsReport} className="w-full sm:w-auto">
            Export Driver Funds PDF
          </Button>
          <Button size="sm" onClick={onOpenFundModal} className="w-full sm:w-auto">
            Add Entry
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
          <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Total Received</p>
          <p className="text-2xl font-black text-emerald-700 mt-1">${totalReceived.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4">
          <p className="text-xs font-bold text-red-600 uppercase tracking-wider">Total Disbursed</p>
          <p className="text-2xl font-black text-red-700 mt-1">${totalDisbursed.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className={`rounded-2xl border p-4 ${balance >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
          <p className={`text-xs font-bold uppercase tracking-wider ${balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>Balance</p>
          <p className={`text-2xl font-black mt-1 ${balance >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>${Math.abs(balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}{balance < 0 ? ' DR' : ''}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
        <DriverFundsSummaryPanel
          report={driverFundsReport}
          subtitle="Every driver-specific disbursement with the remaining balance still available to them."
          emptyMessage="No driver allocations have been recorded yet."
          formatValue={formatCurrency}
        />

        <DriverFundsSnapshotPanel
          report={driverFundsReport}
          subtitle="A graceful operational rollup of cash already consumed versus cash still in play."
          formatValue={formatCurrency}
          balanceLabel="Remaining available"
          spentHelper="{count} spend entries"
          balanceHelper="Outstanding trip budget still available"
        />
      </div>

      <div className="space-y-3 md:hidden">
        {operatingFunds.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-400">
            No entries yet
          </div>
        ) : operatingFunds.map((fund) => (
          <div key={fund.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{formatDate(fund.date)}</p>
                <p className="mt-1 font-semibold text-zinc-900">{fund.description}</p>
              </div>
              <span className={`shrink-0 px-2 py-0.5 rounded-md text-xs font-black uppercase tracking-tighter ${fund.type === 'Received' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{fund.type}</span>
            </div>
            <div className="mt-3 space-y-1 text-sm text-zinc-600">
              <p><span className="font-semibold text-zinc-900">Amount:</span> {fund.currency === 'GBP' ? '£' : '$'}{fund.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              <p><span className="font-semibold text-zinc-900">Reference:</span> {fund.reference || '—'}</p>
              <p><span className="font-semibold text-zinc-900">Recipient:</span> {fund.recipient || '—'}</p>
              <p><span className="font-semibold text-zinc-900">Approved by:</span> {fund.approved_by || '—'}</p>
            </div>
            <div className="mt-4">
              <button onClick={() => onDeleteFund(fund.id)} className="min-h-[44px] text-sm font-semibold text-red-500 hover:text-red-700">Delete</button>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden md:block overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-bold text-zinc-600 uppercase">Date</th>
            <th className="px-4 py-3 text-left text-xs font-bold text-zinc-600 uppercase">Type</th>
            <th className="px-4 py-3 text-left text-xs font-bold text-zinc-600 uppercase">Amount</th>
            <th className="px-4 py-3 text-left text-xs font-bold text-zinc-600 uppercase">Description</th>
            <th className="px-4 py-3 text-left text-xs font-bold text-zinc-600 uppercase">Ref / Recipient</th>
            <th className="px-4 py-3 text-left text-xs font-bold text-zinc-600 uppercase">Approved By</th>
            <th className="px-4 py-3 text-right text-xs font-bold text-zinc-600 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody>
          {operatingFunds.length === 0 ? (
            <tr><td colSpan={7} className="px-6 py-8 text-center text-zinc-400">No entries yet</td></tr>
          ) : operatingFunds.map((fund) => (
            <tr key={fund.id} className="hover:bg-zinc-50 border-t">
              <td className="px-4 py-3 text-xs text-zinc-500">{formatDate(fund.date)}</td>
              <td className="px-4 py-3">
                <span className={`px-2 py-0.5 rounded-md text-xs font-black uppercase tracking-tighter ${fund.type === 'Received' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{fund.type}</span>
              </td>
              <td className="px-4 py-3 font-bold">{fund.currency === 'GBP' ? '£' : '$'}{fund.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              <td className="px-4 py-3 text-zinc-700 max-w-[200px] truncate">{fund.description}</td>
              <td className="px-4 py-3 text-xs text-zinc-500">{fund.reference || fund.recipient || '—'}</td>
              <td className="px-4 py-3 text-xs text-zinc-500">{fund.approved_by || '—'}</td>
              <td className="px-4 py-3 text-right">
                <button onClick={() => onDeleteFund(fund.id)} className="text-red-500 hover:text-red-700 text-xs font-semibold">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
};

export default OperatingFundsView;
