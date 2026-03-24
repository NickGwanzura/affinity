import React from 'react';
import type { Client } from '../../types';

interface AccountantClientsViewProps {
  clients: Client[];
  getClientStats: (client: Client) => { count: number; total: number };
  onEditClient: (client: Client) => void;
  onDeleteClient: (id: string) => void;
}

export const AccountantClientsView: React.FC<AccountantClientsViewProps> = ({
  clients,
  getClientStats,
  onEditClient,
  onDeleteClient,
}) => (
  <div className="space-y-5">
    <div className="rounded-2xl border border-zinc-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 border-b border-zinc-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider">Client</th>
            <th className="px-4 py-3 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider">Contact</th>
            <th className="px-4 py-3 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider">Company</th>
            <th className="px-4 py-3 text-center text-xs font-bold text-zinc-500 uppercase tracking-wider">Invoices</th>
            <th className="px-4 py-3 text-right text-xs font-bold text-zinc-500 uppercase tracking-wider">Total Revenue</th>
            <th className="px-4 py-3 text-center text-xs font-bold text-zinc-500 uppercase tracking-wider">Source</th>
            <th className="px-4 py-3 text-right text-xs font-bold text-zinc-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {clients.length === 0 ? (
            <tr><td colSpan={7} className="px-6 py-12 text-center text-zinc-400">No clients yet — they will appear here once invoices are created</td></tr>
          ) : clients.map((client) => {
            const isVirtual = client.id.startsWith('__invoice__');
            const stats = getClientStats(client);
            return (
              <tr key={client.id} className="hover:bg-zinc-50 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-semibold text-zinc-900">{client.name}</p>
                  {client.address && <p className="text-xs text-zinc-400 truncate max-w-[160px]">{client.address}</p>}
                </td>
                <td className="px-4 py-3">
                  <p className="text-zinc-700">{client.email || '—'}</p>
                  {client.phone && <p className="text-xs text-zinc-400">{client.phone}</p>}
                </td>
                <td className="px-4 py-3 text-zinc-600">{client.company || '—'}</td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-block px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-bold">{stats.count}</span>
                </td>
                <td className="px-4 py-3 text-right font-bold text-green-700">
                  {stats.total > 0 ? `$${stats.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  {isVirtual
                    ? <span className="inline-block px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-200">Invoice</span>
                    : <span className="inline-block px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-semibold border border-green-200">Saved</span>
                  }
                </td>
                <td className="px-4 py-3 text-right space-x-3">
                  <button onClick={() => onEditClient(client)} className="text-blue-600 hover:text-blue-800 font-semibold text-xs">
                    {isVirtual ? 'Save & Edit' : 'Edit'}
                  </button>
                  {!isVirtual && (
                    <button onClick={() => onDeleteClient(client.id)} className="text-red-500 hover:text-red-700 font-semibold text-xs">Delete</button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>

    {clients.some((client) => client.id.startsWith('__invoice__')) && (
      <p className="text-xs text-zinc-400">
        <span className="font-semibold text-amber-600">Invoice</span> clients are pulled from your invoice records. Click <span className="font-semibold">Save &amp; Edit</span> to save them as full client records.
      </p>
    )}
  </div>
);

export default AccountantClientsView;
