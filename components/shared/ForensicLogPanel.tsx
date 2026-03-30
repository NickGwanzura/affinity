import React from 'react';
import type { AuditLog } from '../../types';

interface ForensicLogPanelProps {
  logs: AuditLog[];
  loading?: boolean;
  onRefresh: () => Promise<void> | void;
}

const formatActionLabel = (action: string) =>
  action
    .split('.')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' / ');

const formatDataPreview = (value: unknown) => {
  if (!value) return 'No payload';
  try {
    const serialized = JSON.stringify(value, null, 2);
    if (serialized.length <= 220) return serialized;
    return `${serialized.slice(0, 217)}...`;
  } catch {
    return 'Unable to render payload';
  }
};

export const ForensicLogPanel: React.FC<ForensicLogPanelProps> = ({ logs, loading = false, onRefresh }) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-black text-zinc-900">System Forensic Log</h2>
          <p className="text-sm text-zinc-500">
            Authentication, account, invite, company, and expense mutations captured from the API.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onRefresh()}
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-zinc-800"
        >
          Refresh Log
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">Entries Loaded</p>
          <p className="mt-3 text-3xl font-black text-blue-950">{logs.length}</p>
          <p className="mt-2 text-sm text-blue-800">Latest audit trail pulled from the API.</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">Auth Events</p>
          <p className="mt-3 text-3xl font-black text-emerald-950">
            {logs.filter((log) => log.action.startsWith('auth.')).length}
          </p>
          <p className="mt-2 text-sm text-emerald-800">Logins, password resets, and password changes.</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600">Mutation Events</p>
          <p className="mt-3 text-3xl font-black text-amber-950">
            {logs.filter((log) => !log.action.startsWith('auth.')).length}
          </p>
          <p className="mt-2 text-sm text-amber-800">Users, invites, requests, company, and expenses.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-zinc-500">Loading forensic entries...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">
            No audit entries found yet. Actions will appear here once tracked API mutations occur.
          </div>
        ) : (
          <div className="divide-y divide-zinc-200">
            {logs.map((log) => (
              <div key={log.id} className="p-4 sm:p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-zinc-900 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white">
                        {formatActionLabel(log.action)}
                      </span>
                      {log.table_name && (
                        <span className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
                          {log.table_name}
                        </span>
                      )}
                    </div>
                    <p className="mt-3 text-sm font-semibold text-zinc-900">
                      {log.user_name || 'System'} {log.user_email ? `(${log.user_email})` : ''}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {new Date(log.created_at).toLocaleString()} {log.ip_address ? `• ${log.ip_address}` : ''}
                    </p>
                    {log.record_id && (
                      <p className="mt-1 break-all text-xs text-zinc-500">Record: {log.record_id}</p>
                    )}
                  </div>

                  <div className="grid gap-3 lg:w-[420px] lg:grid-cols-2">
                    <div className="rounded-xl bg-zinc-50 p-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">Before</p>
                      <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-zinc-700">
                        {formatDataPreview(log.old_data)}
                      </pre>
                    </div>
                    <div className="rounded-xl bg-zinc-50 p-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">After</p>
                      <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-zinc-700">
                        {formatDataPreview(log.new_data)}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ForensicLogPanel;
