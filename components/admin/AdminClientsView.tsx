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
    <div className="bg-gradient-to-r from-green-600 to-teal-600 p-4 sm:p-6 md:p-8  text-white">
      <h3 className="text-xl sm:text-2xl font-black mb-2">Client Management</h3>
      <p className="text-green-100">Manage all your clients and contacts</p>
    </div>

    <div className="bg-white  shadow-lg border border-zinc-200 overflow-hidden">
      <div className="space-y-3 p-3 sm:hidden">
        {clients.length === 0 ? (
          <div className="border border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">
            No clients yet. Click &quot;Add Client&quot; to get started.
          </div>
        ) : (
          clients.map((client) => (
            <div key={client.id} className="border border-zinc-100 bg-white p-4 shadow-sm">
              <div className="mb-1 font-bold text-zinc-900">{client.name}</div>
              {client.company && (
                <div className="mb-1 text-xs text-zinc-500">{client.company}</div>
              )}
              {client.email && (
                <div className="mb-1 text-xs text-zinc-600">
                  <a href={`mailto:${client.email}`} className="text-blue-600 hover:text-blue-800">{client.email}</a>
                </div>
              )}
              {client.phone && (
                <div className="mb-1 text-xs text-zinc-600">{client.phone}</div>
              )}
              <div className="mb-3 text-xs text-zinc-400">{formatDate(client.created_at)}</div>
              <div className="flex flex-wrap gap-2 border-t border-zinc-50 pt-3">
                <button onClick={() => onEditClient(client)} className="px-2 py-1 text-xs font-bold text-blue-600 hover:text-blue-800">Edit</button>
                <button onClick={() => onDeleteClient(client.id)} className="px-2 py-1 text-xs font-bold text-red-600 hover:text-red-800">Delete</button>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="hidden sm:block overflow-x-auto">
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
                  No clients yet. Click &quot;Add Client&quot; to get started.
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
