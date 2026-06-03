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
    <div className="rounded-md bg-gradient-to-r from-[#D97706] to-[#92400E] p-4 sm:p-6 md:p-8 text-white shadow-sm">
      <h3 className="text-xl sm:text-2xl font-bold mb-2">Client Management</h3>
      <p className="text-amber-100">Manage all your clients and contacts</p>
    </div>

    <div className="overflow-hidden shadow-lg" style={{ background: '#ffffff', border: '1px solid #e7e5e4' }}>
      <div className="space-y-3 p-3 sm:hidden">
        {clients.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm" style={{ border: '1px solid #e7e5e4', background: '#ffffff', color: '#52525b' }}>
            No clients yet. Click &quot;Add Client&quot; to get started.
          </div>
        ) : (
          clients.map((client) => (
            <div key={client.id} className="p-4" style={{ border: '1px solid #e7e5e4', background: '#ffffff' }}>
              <div className="mb-1 font-bold text-zinc-900">{client.name}</div>
              {client.company && (
                <div className="mb-1 text-xs text-zinc-600">{client.company}</div>
              )}
              {client.email && (
                <div className="mb-1 text-xs text-zinc-600">
                  <a href={`mailto:${client.email}`} style={{ color: '#D97706' }}>{client.email}</a>
                </div>
              )}
              {client.phone && (
                <div className="mb-1 text-xs text-zinc-600">{client.phone}</div>
              )}
              <div className="mb-3 text-xs text-zinc-600">{formatDate(client.created_at)}</div>
              <div className="flex flex-wrap gap-2 border-t border-zinc-50 pt-3">
                <button onClick={() => onEditClient(client)} className="px-2 py-1 text-xs font-bold text-amber-600">Edit</button>
                <button onClick={() => onDeleteClient(client.id)} className="px-2 py-1 text-xs font-bold text-red-600">Delete</button>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-[0.08em] text-zinc-600">Name</th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-[0.08em] text-zinc-600">Email</th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-[0.08em] text-zinc-600">Phone</th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-[0.08em] text-zinc-600">Company</th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-[0.08em] text-zinc-600">Created</th>
              <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-[0.08em] text-zinc-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {clients.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-zinc-600">
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
                  <td className="px-6 py-4 text-sm text-zinc-600">{formatDate(client.created_at)}</td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button onClick={() => onEditClient(client)} className="font-semibold text-amber-600">
                      Edit
                    </button>
                    <button onClick={() => onDeleteClient(client.id)} className="font-semibold text-red-600">
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
