import React from 'react';
import type { Client } from '../../types';
import { formatDate } from '../../utils/formatters';

interface AdminClientsViewProps {
  clients: Client[];
  onEditClient: (client: Client) => void;
  onDeleteClient: (id: string) => void;
}

export const AdminClientsView: React.FC<AdminClientsViewProps> = ({
  clients,
  onEditClient,
  onDeleteClient,
}) => (
  <div className="space-y-6">
    <div className="bg-gradient-to-r from-green-600 to-teal-600 p-8 rounded-3xl text-white">
      <h3 className="text-2xl font-black mb-2">Client Management</h3>
      <p className="text-green-100">Manage all your clients and contacts</p>
    </div>

    <div className="bg-white rounded-2xl shadow-lg border border-zinc-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Name</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Email</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Phone</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Company</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">Created</th>
              <th className="px-6 py-4 text-right text-xs font-bold text-zinc-600 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {clients.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                  No clients yet. Click "Add Client" to get started.
                </td>
              </tr>
            ) : (
              clients.map((client) => (
                <tr key={client.id} className="hover:bg-zinc-50">
                  <td className="px-6 py-4 font-semibold text-zinc-900">{client.name}</td>
                  <td className="px-6 py-4 text-zinc-600">{client.email || '-'}</td>
                  <td className="px-6 py-4 text-zinc-600">{client.phone || '-'}</td>
                  <td className="px-6 py-4 text-zinc-600">{client.company || '-'}</td>
                  <td className="px-6 py-4 text-zinc-600 text-sm">{formatDate(client.created_at)}</td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button onClick={() => onEditClient(client)} className="text-blue-600 hover:text-blue-800 font-semibold">
                      Edit
                    </button>
                    <button onClick={() => onDeleteClient(client.id)} className="text-red-600 hover:text-red-800 font-semibold">
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

export default AdminClientsView;
