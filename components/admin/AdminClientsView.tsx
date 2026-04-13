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

    <div className="overflow-hidden shadow-lg" style={{ background: 'var(--cds-background, #ffffff)', border: '1px solid var(--cds-border-subtle, #e0e0e0)' }}>
      <div className="space-y-3 p-3 sm:hidden">
        {clients.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm" style={{ border: '1px solid var(--cds-border-subtle, #e0e0e0)', background: 'var(--cds-layer-01, #f4f4f4)', color: 'var(--cds-text-secondary, #525252)' }}>
            No clients yet. Click &quot;Add Client&quot; to get started.
          </div>
        ) : (
          clients.map((client) => (
            <div key={client.id} className="p-4" style={{ border: '1px solid var(--cds-border-subtle, #e0e0e0)', background: 'var(--cds-background, #ffffff)' }}>
              <div className="mb-1 font-bold" style={{ color: 'var(--cds-text-primary, #161616)' }}>{client.name}</div>
              {client.company && (
                <div className="mb-1 text-xs" style={{ color: 'var(--cds-text-secondary, #525252)' }}>{client.company}</div>
              )}
              {client.email && (
                <div className="mb-1 text-xs" style={{ color: 'var(--cds-text-secondary, #525252)' }}>
                  <a href={`mailto:${client.email}`} style={{ color: 'var(--cds-interactive, #0f62fe)' }}>{client.email}</a>
                </div>
              )}
              {client.phone && (
                <div className="mb-1 text-xs" style={{ color: 'var(--cds-text-secondary, #525252)' }}>{client.phone}</div>
              )}
              <div className="mb-3 text-xs" style={{ color: 'var(--cds-text-secondary, #525252)' }}>{formatDate(client.created_at)}</div>
              <div className="flex flex-wrap gap-2 border-t border-zinc-50 pt-3">
                <button onClick={() => onEditClient(client)} className="px-2 py-1 text-xs font-bold" style={{ color: 'var(--cds-interactive, #0f62fe)' }}>Edit</button>
                <button onClick={() => onDeleteClient(client.id)} className="px-2 py-1 text-xs font-bold" style={{ color: 'var(--cds-support-error, #da1e28)' }}>Delete</button>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Name</th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Email</th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Phone</th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Company</th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Created</th>
              <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {clients.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center" style={{ color: 'var(--cds-text-secondary, #525252)' }}>
                  No clients yet. Click &quot;Add Client&quot; to get started.
                </td>
              </tr>
            ) : (
              clients.map((client) => (
                <tr key={client.id} className="hover:bg-zinc-50">
                  <td className="px-6 py-4 font-semibold" style={{ color: 'var(--cds-text-primary, #161616)' }}>{client.name}</td>
                  <td className="px-6 py-4" style={{ color: 'var(--cds-text-secondary, #525252)' }}>{client.email || '-'}</td>
                  <td className="px-6 py-4" style={{ color: 'var(--cds-text-secondary, #525252)' }}>{client.phone || '-'}</td>
                  <td className="px-6 py-4" style={{ color: 'var(--cds-text-secondary, #525252)' }}>{client.company || '-'}</td>
                  <td className="px-6 py-4 text-sm" style={{ color: 'var(--cds-text-secondary, #525252)' }}>{formatDate(client.created_at)}</td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button onClick={() => onEditClient(client)} className="font-semibold" style={{ color: 'var(--cds-interactive, #0f62fe)' }}>
                      Edit
                    </button>
                    <button onClick={() => onDeleteClient(client.id)} className="font-semibold" style={{ color: 'var(--cds-support-error, #da1e28)' }}>
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
