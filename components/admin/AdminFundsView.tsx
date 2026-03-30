import React from 'react';
import type { OperatingFund } from '../../types';
import type { DriverFundsReportData } from '../../utils/driverFunds';
import { Button, DriverFundsSnapshotPanel, DriverFundsSummaryPanel } from '../ui';
import { formatDate } from '../../utils/formatters';

interface AdminFundsViewProps {
  fundsBalance: { received: number; disbursed: number; balance: number };
  operatingFunds: OperatingFund[];
  driverFundsReport: DriverFundsReportData;
  onDeleteOperatingFund: (id: string) => void;
  onExportDriverFundsReport: () => void;
}

export const AdminFundsView: React.FC<AdminFundsViewProps> = ({
  fundsBalance,
  operatingFunds,
  driverFundsReport,
  onDeleteOperatingFund,
  onExportDriverFundsReport,
}) => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-6  text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-white/20 flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-emerald-100 text-sm font-semibold uppercase tracking-wide">Funds Received</span>
        </div>
        <p className="text-3xl font-black">${fundsBalance.received.toLocaleString()}</p>
      </div>

      <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-6  text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-white/20 flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-orange-100 text-sm font-semibold uppercase tracking-wide">Total Disbursed</span>
        </div>
        <p className="text-3xl font-black">${fundsBalance.disbursed.toLocaleString()}</p>
      </div>

      <div className={`bg-gradient-to-br ${fundsBalance.balance >= 0 ? 'from-blue-500 to-blue-600' : 'from-red-500 to-red-600'} p-6  text-white shadow-lg`}>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-white/20 flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
            </svg>
          </div>
          <span className="text-blue-100 text-sm font-semibold uppercase tracking-wide">Current Balance</span>
        </div>
        <p className="text-3xl font-black">${fundsBalance.balance.toLocaleString()}</p>
      </div>
    </div>

    <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
      <DriverFundsSummaryPanel
        report={driverFundsReport}
        subtitle="Keep a live view of what each driver has received, spent, and still has available."
        emptyMessage="No driver allocations have been recorded yet."
        action={(
            <Button size="sm" onClick={onExportDriverFundsReport} className="w-full sm:w-auto">
              Export Driver Funds PDF
            </Button>
        )}
      />

      <DriverFundsSnapshotPanel
        report={driverFundsReport}
        subtitle="A quick Carbon-style pulse check on how much cash is still active in the field."
        balanceLabel="Remaining available"
        spentHelper="{count} drawdown entries"
        balanceHelper="Available for upcoming trip costs"
      />
    </div>

    <div className="bg-white shadow-lg border border-zinc-200 overflow-hidden">
      <div className="p-6 border-b border-zinc-200">
        <h3 className="text-xl font-bold text-zinc-900">Transaction History</h3>
        <p className="text-zinc-500 text-sm">Track all operating funds received and disbursed</p>
      </div>
      <div className="space-y-3 p-4 md:hidden">
        {operatingFunds.length === 0 ? (
          <div className=" border border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">
            No transactions yet. Record a transaction to get started.
          </div>
        ) : (
          operatingFunds.map((fund) => (
            <div key={fund.id} className=" border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{formatDate(fund.date)}</p>
                  <p className="mt-1 font-semibold text-zinc-900">{fund.description}</p>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold  ${
                  fund.type === 'Received' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'
                }`}>
                  {fund.type}
                </span>
              </div>
              <div className="mt-3 space-y-1 text-sm text-zinc-600">
                <p><span className="font-semibold text-zinc-900">Recipient:</span> {fund.recipient || '-'}</p>
                <p><span className="font-semibold text-zinc-900">Reference:</span> {fund.reference || '-'}</p>
                <p className={`${fund.type === 'Received' ? 'text-emerald-600' : 'text-orange-600'} font-bold`}>
                  {fund.type === 'Received' ? '+' : '-'}${fund.amount.toLocaleString()}
                </p>
              </div>
              <div className="mt-4">
                <button
                  onClick={() => onDeleteOperatingFund(fund.id)}
                  className="min-h-[44px] text-sm font-semibold text-red-600 hover:text-red-800"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Date</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Type</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Description</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Recipient</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Reference</th>
              <th className="px-6 py-4 text-right text-xs font-bold text-zinc-600 uppercase tracking-wider">Amount</th>
              <th className="px-6 py-4 text-right text-xs font-bold text-zinc-600 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {operatingFunds.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-zinc-500">
                  <div className="flex flex-col items-center gap-3">
                    <svg className="w-12 h-12 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <p>No transactions yet. Click "Record Transaction" to get started.</p>
                  </div>
                </td>
              </tr>
            ) : (
              operatingFunds.map((fund) => (
                <tr key={fund.id} className="hover:bg-zinc-50">
                  <td className="px-6 py-4 text-sm text-zinc-600">
                    {formatDate(fund.date)}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold  ${
                      fund.type === 'Received' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {fund.type === 'Received' ? (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                      ) : (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                        </svg>
                      )}
                      {fund.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-semibold text-zinc-900">{fund.description}</td>
                  <td className="px-6 py-4 text-zinc-600">{fund.recipient || '-'}</td>
                  <td className="px-6 py-4 text-zinc-500 text-sm">{fund.reference || '-'}</td>
                  <td className={`px-6 py-4 text-right font-bold ${fund.type === 'Received' ? 'text-emerald-600' : 'text-orange-600'}`}>
                    {fund.type === 'Received' ? '+' : '-'}${fund.amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => onDeleteOperatingFund(fund.id)}
                      className="text-red-600 hover:text-red-800 font-semibold text-sm"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

export default AdminFundsView;
