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
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h3 className="text-lg font-bold text-zinc-900">Operating Funds</h3>
        <div className="flex items-center gap-3 flex-wrap">
          <Button size="sm" variant="secondary" onClick={onExportDriverFundsReport}>
            Export Driver Funds PDF
          </Button>
          <Button size="sm" onClick={onOpenFundModal}>
            Add Entry
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
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
  );
};

export default OperatingFundsView;
