import React from 'react';
import type { Payslip } from '../../types';
import { formatMonthYear } from '../../utils/formatters';

interface PayslipsListViewProps {
  payslips: Payslip[];
  onApprove: (id: string) => void;
  onMarkPaid: (id: string) => void;
  onDownload: (payslip: Payslip) => void;
  onDelete: (id: string) => void;
  showIntro?: boolean;
}

export const PayslipsListView: React.FC<PayslipsListViewProps> = ({
  payslips,
  onApprove,
  onMarkPaid,
  onDownload,
  onDelete,
  showIntro = true,
}) => (
  <div className="space-y-6">
    {showIntro && (
      <div className="bg-gradient-to-r from-pink-600 to-purple-600 p-8  text-white">
        <h3 className="text-2xl font-black mb-2">Payslip Management</h3>
        <p className="text-pink-100">Generate and manage employee payslips</p>
      </div>
    )}

    <div className="bg-white  shadow-lg border border-zinc-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Payslip #</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Employee</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Period</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Gross Pay</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Net Pay</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-right text-xs font-bold text-zinc-600 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {payslips.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-zinc-500">
                  No payslips yet. Click "Generate Payslip" to get started.
                </td>
              </tr>
            ) : (
              payslips.map((payslip) => (
                <tr key={payslip.id} className="hover:bg-zinc-50">
                  <td className="px-6 py-4 font-mono text-sm text-zinc-600">{payslip.payslip_number}</td>
                  <td className="px-6 py-4 font-semibold text-zinc-900">{payslip.employee?.name || 'N/A'}</td>
                  <td className="px-6 py-4 text-zinc-600">{formatMonthYear(payslip.year, payslip.month)}</td>
                  <td className="px-6 py-4 text-zinc-900 font-semibold">${payslip.gross_pay.toLocaleString()}</td>
                  <td className="px-6 py-4 text-green-600 font-bold">${payslip.net_pay.toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-block px-2 py-1 text-xs font-semibold  ${
                      payslip.status === 'Generated' ? 'bg-blue-100 text-blue-700' :
                      payslip.status === 'Approved' ? 'bg-yellow-100 text-yellow-700' :
                      payslip.status === 'Paid' ? 'bg-green-100 text-green-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {payslip.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {payslip.status === 'Generated' && (
                        <button onClick={() => onApprove(payslip.id)} className="text-yellow-600 hover:text-yellow-800 font-semibold text-sm">
                          Approve
                        </button>
                      )}
                      {payslip.status === 'Approved' && (
                        <button onClick={() => onMarkPaid(payslip.id)} className="text-green-600 hover:text-green-800 font-semibold text-sm">
                          Mark Paid
                        </button>
                      )}
                      <button
                        onClick={() => onDownload(payslip)}
                        className="text-purple-600 hover:text-purple-800 font-semibold text-sm flex items-center gap-1"
                        title="Download PDF"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        PDF
                      </button>
                      <button onClick={() => onDelete(payslip.id)} className="text-red-600 hover:text-red-800 font-semibold text-sm">
                        Delete
                      </button>
                    </div>
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

export default PayslipsListView;
