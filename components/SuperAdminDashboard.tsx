import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, AlertTriangle } from 'lucide-react';
import { api } from '../services/apiClient';
import {
  Button,
  InlineLoading,
  StatCard,
  Tag,
  TextInput,
  Tile,
} from './ui';
import { useToast } from './Toast';
import { useCarbonConfirm } from './shared';

type DashboardSection = 'overview' | 'users' | 'submissions' | 'system' | 'logs';

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  access_role: 'super_admin' | 'admin' | 'user';
  status: 'Active' | 'Inactive' | 'Pending';
  created_at: string;
};

type AdminMetrics = {
  totals: {
    users: number;
    pendingApprovals: number;
  };
  activity: Array<{
    id: string;
    action: string;
    table_name: string;
    user_email?: string | null;
    created_at: string;
  }>;
};

type ApprovalsPayload = {
  pendingCount: number;
  pendingUsers: AdminUser[];
};

type AdminSystemPayload = {
  status: 'healthy' | 'degraded';
  checks: {
    api: boolean;
    database: boolean;
  };
  recentErrors: Array<{
    id: string;
    action: string;
    table_name: string | null;
    created_at: string;
    user_email: string | null;
  }>;
  timestamp: string;
  uptimeSeconds: number;
};

type AdminLogPayload = {
  id: string;
  action: string;
  table_name: string | null;
  record_id: string | null;
  user_email: string | null;
  created_at: string;
};

type AdminQuestionnaire = {
  id: string;
  title: string;
  status: string;
  created_at: string | null;
};

type AdminSubmission = {
  id: string;
  type: 'registration_request' | 'questionnaire_submission';
  status: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  title: string | null;
  submitter_name: string | null;
  submitter_email: string | null;
  metadata: Record<string, unknown>;
};

type AdminSubmissionsPayload = {
  summary: {
    questionnaires: number;
    submissions: number;
    pendingSubmissions: number;
  };
  questionnaires: AdminQuestionnaire[];
  submissions: AdminSubmission[];
  sources: {
    questionnairesTable: boolean;
    questionnaireSubmissionsTable: boolean;
    registrationRequestsTable: boolean;
  };
};

const sections: Array<{ id: DashboardSection; label: string; description: string }> = [
  { id: 'overview', label: 'Overview', description: 'Platform KPIs and approval pressure.' },
  { id: 'users', label: 'Users', description: 'User controls and account state.' },
  { id: 'submissions', label: 'Submissions', description: 'Questionnaire and submission system control.' },
  { id: 'system', label: 'System', description: 'API/DB health and error signals.' },
  { id: 'logs', label: 'Logs', description: 'Platform audit feed.' },
];

const userStatusTagType = (status: string): React.ComponentProps<typeof Tag>['type'] => {
  switch (status.toLowerCase()) {
    case 'active':
      return 'green';
    case 'pending':
      return 'warm-gray';
    default:
      return 'red';
  }
};

const accessRoleTagType = (accessRole: string): React.ComponentProps<typeof Tag>['type'] => {
  if (accessRole === 'super_admin') return 'purple';
  if (accessRole === 'admin') return 'blue';
  return 'cool-gray';
};

const compactDateTime = (value: string | null | undefined): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
};

const formatUptime = (seconds: number): string => {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [
    d > 0 && `${d}d`,
    h > 0 && `${h}h`,
    m > 0 && `${m}m`,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : '<1m';
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

const TableContainer: React.FC<{
  title:        string;
  description?: string;
  children:     React.ReactNode;
}> = ({ title, description, children }) => (
  <div className="bg-white border border-gray-200">
    <div className="px-4 py-3 border-b border-gray-200">
      <h3 className="m-0 text-sm font-semibold text-gray-900">{title}</h3>
      {description && <p className="mt-1 text-xs text-gray-500">{description}</p>}
    </div>
    {children}
  </div>
);

const thCls   = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600';
const tdCls   = 'px-3 py-2 text-sm text-gray-800 border-t border-gray-100';

export const SuperAdminDashboard: React.FC = () => {
  const { showToast } = useToast();
  const { confirm, ConfirmDialog } = useCarbonConfirm();

  const [loading, setLoading] = useState(true);
  const [sectionLoading, setSectionLoading] = useState<Record<string, boolean>>({});
  const [activeSection, setActiveSection] = useState<DashboardSection>('overview');

  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [approvals, setApprovals] = useState<ApprovalsPayload | null>(null);
  const [system, setSystem] = useState<AdminSystemPayload | null>(null);
  const [logs, setLogs] = useState<AdminLogPayload[]>([]);
  const [submissions, setSubmissions] = useState<AdminSubmissionsPayload | null>(null);

  const [submissionStatusFilter, setSubmissionStatusFilter] = useState<string>('');
  const [submissionTypeFilter, setSubmissionTypeFilter] = useState<'all' | 'registration_request' | 'questionnaire_submission'>('all');
  const [logActionFilter, setLogActionFilter] = useState<string>('');

  const selectedSectionMeta = useMemo(
    () => sections.find((section) => section.id === activeSection) || sections[0],
    [activeSection],
  );

  const loadData = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setLoading(true);
    } else {
      setSectionLoading(prev => ({ ...prev, [activeSection]: true }));
    }
    try {
      const [metricsPayload, usersPayload, approvalsPayload, systemPayload, logsPayload, submissionsPayload] =
        await Promise.all([
          api.admin.metrics(),
          api.admin.users.list(),
          api.admin.approvals.list(),
          api.admin.system(),
          api.admin.logs({
            limit: 120,
            action: logActionFilter || undefined,
          }),
          api.admin.submissions.list({
            status: submissionStatusFilter || undefined,
            type: submissionTypeFilter,
          }),
        ]);

      setMetrics(metricsPayload as AdminMetrics);
      setUsers(usersPayload as AdminUser[]);
      setApprovals(approvalsPayload as ApprovalsPayload);
      setSystem(systemPayload as AdminSystemPayload);
      setLogs(logsPayload as AdminLogPayload[]);
      setSubmissions(submissionsPayload as AdminSubmissionsPayload);
    } catch (error) {
      showToast(getErrorMessage(error, 'Failed to load platform dashboard data'), 'error');
    } finally {
      if (isInitial) {
        setLoading(false);
      } else {
        setSectionLoading(prev => ({ ...prev, [activeSection]: false }));
      }
    }
  }, [activeSection, logActionFilter, showToast, submissionStatusFilter, submissionTypeFilter]);

  useEffect(() => {
    loadData(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loading) {
      loadData(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logActionFilter, submissionStatusFilter, submissionTypeFilter]);

  const reviewPendingUser = async (userId: string, action: 'approve' | 'reject') => {
    try {
      if (action === 'approve') {
        await api.admin.approvals.approve(userId);
      } else {
        await api.admin.approvals.reject(userId);
      }
      showToast(`User ${action}d successfully.`, 'success');
      await loadData(false);
    } catch (error) {
      showToast(getErrorMessage(error, `Failed to ${action} user`), 'error');
    }
  };

  const updateUserStatus = async (user: AdminUser, nextStatus: 'Active' | 'Inactive') => {
    try {
      if (user.status === 'Pending') {
        if (nextStatus === 'Active') {
          await api.admin.approvals.approve(user.id);
        } else {
          await api.admin.approvals.reject(user.id);
        }
      } else {
        await api.admin.users.update(user.id, { status: nextStatus });
      }

      showToast(`User status updated to ${nextStatus}.`, 'success');
      await loadData(false);
    } catch (error) {
      showToast(getErrorMessage(error, 'Failed to update user status'), 'error');
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <InlineLoading description="Loading platform control tower..." status="active" />
      </div>
    );
  }

  const overviewContent = (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard title="Total Users" value={metrics?.totals.users ?? 0} color="blue" />
        <StatCard title="Pending Approvals" value={metrics?.totals.pendingApprovals ?? 0} color="amber" />
      </div>

      <TableContainer title="Recent Platform Activity" description="Latest actions across the platform.">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className={thCls}>Action</th>
              <th className={thCls}>Actor</th>
              <th className={thCls}>Time</th>
            </tr>
          </thead>
          <tbody>
            {(metrics?.activity || []).slice(0, 8).map((activity) => (
              <tr key={activity.id}>
                <td className={tdCls}>{activity.action}</td>
                <td className={tdCls}>{activity.user_email || 'system'}</td>
                <td className={tdCls}>{compactDateTime(activity.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableContainer>
    </div>
  );

  const usersContent = (
    <TableContainer title="User Management" description="Global user controls.">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className={thCls}>User</th>
            <th className={thCls}>Access</th>
            <th className={thCls}>Status</th>
            <th className={thCls}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.slice(0, 120).map((user) => (
            <tr key={user.id}>
              <td className={tdCls}>
                <div className="font-medium text-gray-900">{user.name}</div>
                <div className="text-xs text-gray-500">{user.email}</div>
              </td>
              <td className={tdCls}>
                <Tag type={accessRoleTagType(user.access_role)}>{user.access_role}</Tag>
              </td>
              <td className={tdCls}>
                <Tag type={userStatusTagType(user.status)}>{user.status}</Tag>
              </td>
              <td className={tdCls}>
                {user.access_role === 'super_admin' ? (
                  <Tag type="purple">Platform Owner</Tag>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {user.status === 'Pending' && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => reviewPendingUser(user.id, 'approve')}>Approve</Button>
                        <Button variant="danger" size="sm" onClick={() => reviewPendingUser(user.id, 'reject')}>Reject</Button>
                      </>
                    )}
                    {user.status !== 'Pending' && user.status !== 'Active' && (
                      <Button variant="ghost" size="sm" onClick={() => updateUserStatus(user, 'Active')}>Activate</Button>
                    )}
                    {user.status === 'Active' && (
                      <Button variant="danger" size="sm" onClick={() => updateUserStatus(user, 'Inactive')}>Suspend</Button>
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableContainer>
  );

  const submissionsContent = (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Questionnaires" value={submissions?.summary.questionnaires ?? 0} color="purple" />
        <StatCard title="Submissions" value={submissions?.summary.submissions ?? 0} color="blue" />
        <StatCard title="Pending" value={submissions?.summary.pendingSubmissions ?? 0} color="amber" />
        <Tile>
          <h3 className="m-0 text-sm font-semibold text-gray-900">Data Sources</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <Tag type={submissions?.sources.questionnairesTable ? 'green' : 'cool-gray'}>questionnaires</Tag>
            <Tag type={submissions?.sources.questionnaireSubmissionsTable ? 'green' : 'cool-gray'}>questionnaire_submissions</Tag>
            <Tag type={submissions?.sources.registrationRequestsTable ? 'green' : 'cool-gray'}>registration_requests</Tag>
          </div>
        </Tile>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TableContainer title="Questionnaires" description="Questionnaire templates.">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className={thCls}>Title</th>
                <th className={thCls}>Status</th>
                <th className={thCls}>Created</th>
              </tr>
            </thead>
            <tbody>
              {(submissions?.questionnaires || []).slice(0, 100).map((questionnaire) => (
                <tr key={questionnaire.id}>
                  <td className={tdCls}>{questionnaire.title}</td>
                  <td className={tdCls}><Tag type="cool-gray">{questionnaire.status || 'unknown'}</Tag></td>
                  <td className={tdCls}>{compactDateTime(questionnaire.created_at)}</td>
                </tr>
              ))}
              {(submissions?.questionnaires || []).length === 0 && (
                <tr><td className={tdCls} colSpan={3}>No questionnaires found.</td></tr>
              )}
            </tbody>
          </table>
        </TableContainer>

        <TableContainer title="Submissions" description="Global submission feed.">
          <div className="p-3 grid gap-3">
            <select
              value={submissionTypeFilter}
              onChange={(event) => setSubmissionTypeFilter(event.target.value as typeof submissionTypeFilter)}
              className="p-2 border border-gray-300"
            >
              <option value="all">All types</option>
              <option value="registration_request">Registration requests</option>
              <option value="questionnaire_submission">Questionnaire submissions</option>
            </select>
            <select
              value={submissionStatusFilter}
              onChange={(event) => setSubmissionStatusFilter(event.target.value)}
              className="p-2 border border-gray-300"
            >
              <option value="">All statuses</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className={thCls}>Type</th>
                <th className={thCls}>Submitter</th>
                <th className={thCls}>Status</th>
                <th className={thCls}>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {(submissions?.submissions || []).slice(0, 120).map((submission) => (
                <tr key={submission.id}>
                  <td className={tdCls}>{submission.type}</td>
                  <td className={tdCls}>
                    <div className="font-medium text-gray-900">{submission.submitter_name || submission.title || '-'}</div>
                    {submission.submitter_email && (
                      <div className="text-xs text-gray-500">{submission.submitter_email}</div>
                    )}
                  </td>
                  <td className={tdCls}><Tag type={userStatusTagType(submission.status)}>{submission.status}</Tag></td>
                  <td className={tdCls}>{compactDateTime(submission.submitted_at)}</td>
                </tr>
              ))}
              {(submissions?.submissions || []).length === 0 && (
                <tr><td className={tdCls} colSpan={4}>No submissions found.</td></tr>
              )}
            </tbody>
          </table>
        </TableContainer>
      </div>
    </div>
  );

  const systemContent = (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Tile>
        <h3 className="m-0 text-sm font-semibold text-gray-900">System Health</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <Tag type={system?.checks.api ? 'green' : 'red'}>API: {system?.checks.api ? 'healthy' : 'unhealthy'}</Tag>
          <Tag type={system?.checks.database ? 'green' : 'red'}>DB: {system?.checks.database ? 'healthy' : 'unhealthy'}</Tag>
          <Tag type={system?.status === 'healthy' ? 'green' : 'red'}>Status: {system?.status || 'unknown'}</Tag>
        </div>
        <p className="mt-3 text-sm text-gray-500">Uptime: {formatUptime(system?.uptimeSeconds ?? 0)}</p>
        <p className="mt-1 text-sm text-gray-500">Last check: {compactDateTime(system?.timestamp)}</p>
      </Tile>

      <TableContainer title="Recent Error Signals" description="Latest failed/error/rejected events detected in audit stream.">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className={thCls}>Action</th>
              <th className={thCls}>Table</th>
              <th className={thCls}>Actor</th>
              <th className={thCls}>Time</th>
            </tr>
          </thead>
          <tbody>
            {(system?.recentErrors || []).map((row) => (
              <tr key={row.id}>
                <td className={tdCls}>{row.action}</td>
                <td className={tdCls}>{row.table_name || '-'}</td>
                <td className={tdCls}>{row.user_email || 'system'}</td>
                <td className={tdCls}>{compactDateTime(row.created_at)}</td>
              </tr>
            ))}
            {(system?.recentErrors || []).length === 0 && (
              <tr>
                <td className={tdCls} colSpan={4}>
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} />
                    No recent error signals.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableContainer>
    </div>
  );

  const logsContent = (
    <TableContainer title="Audit Logs" description="Platform-wide admin and system activity feed.">
      <div className="p-3 grid gap-3">
        <TextInput
          id="logs-action-filter"
          labelText="Filter action contains"
          value={logActionFilter}
          onChange={(event) => setLogActionFilter(event.target.value)}
          placeholder="e.g. approvals, failed, users.updated"
        />
        <Button variant="secondary" size="sm" leftIcon={<ExternalLink size={14} />} onClick={() => loadData(false)}>
          Refresh Logs
        </Button>
      </div>
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className={thCls}>Action</th>
            <th className={thCls}>Actor</th>
            <th className={thCls}>Table</th>
            <th className={thCls}>Time</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((entry) => (
            <tr key={entry.id}>
              <td className={tdCls}>{entry.action}</td>
              <td className={tdCls}>{entry.user_email || 'system'}</td>
              <td className={tdCls}>{entry.table_name || '-'}</td>
              <td className={tdCls}>{compactDateTime(entry.created_at)}</td>
            </tr>
          ))}
          {logs.length === 0 && (
            <tr><td className={tdCls} colSpan={4}>No logs found for current filters.</td></tr>
          )}
        </tbody>
      </table>
    </TableContainer>
  );

  const sectionContent: Record<DashboardSection, React.ReactNode> = {
    overview: overviewContent,
    users: usersContent,
    submissions: submissionsContent,
    system: systemContent,
    logs: logsContent,
  };

  return (
    <div className="p-6 bg-gray-100 min-h-full">
      <Tile className="mb-4 border-l-4 border-l-blue-600">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="m-0 text-lg font-semibold text-gray-900">Super Admin Control Tower</h2>
            <p className="mt-2 text-sm text-gray-500">Platform-only operations.</p>
          </div>
          <Tag type="high-contrast">Platform Scope</Tag>
        </div>
      </Tile>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-1">
          <Tile>
            <h3 className="m-0 text-sm font-semibold text-gray-900">Admin Sections</h3>
            <p className="mt-2 mb-3 text-sm text-gray-500">{selectedSectionMeta.description}</p>
            <div className="grid gap-2">
              {sections.map((section) => (
                <Button
                  key={section.id}
                  variant={activeSection === section.id ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveSection(section.id)}
                >
                  {section.label}
                </Button>
              ))}
            </div>
          </Tile>
        </div>

        <div className="lg:col-span-3">
          {sectionLoading[activeSection] ? (
            <InlineLoading description="Loading..." />
          ) : (
            sectionContent[activeSection]
          )}
        </div>
      </div>

      {(approvals?.pendingUsers || []).length > 0 && activeSection !== 'users' && (
        <Tile className="mt-4 border-l-4 border-l-amber-500">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <strong className="text-gray-900">{approvals.pendingUsers.length} pending user approvals</strong>
              <p className="mt-1 text-sm text-gray-500">Open Users section to approve/reject pending accounts.</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setActiveSection('users')}>Review Approvals</Button>
          </div>
        </Tile>
      )}

      <ConfirmDialog />
    </div>
  );
};

export default SuperAdminDashboard;
