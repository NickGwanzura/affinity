import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Column,
  ComposedModal,
  Grid,
  InlineLoading,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
  TextInput,
  Tile,
} from '@carbon/react';
import { Add, Launch, View, WarningFilled } from '@carbon/icons-react';
import { api, clearViewTenantId } from '../services/apiClient';
import { StatCard } from './ui';
import { useToast } from './Toast';
import { useCarbonConfirm } from './shared';
import type { Tenant } from '../types';

type DashboardSection = 'overview' | 'tenants' | 'users' | 'submissions' | 'system' | 'logs';

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  access_role: 'super_admin' | 'tenant_admin' | 'user';
  status: 'Active' | 'Inactive' | 'Pending';
  tenant_id: string | null;
  tenant_name?: string | null;
  tenant_status?: string | null;
  created_at: string;
};

type AdminMetrics = {
  totals: {
    users: number;
    tenants: number;
    activeTenants: number;
    suspendedTenants: number;
    pendingTenants: number;
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
  tenant_name: string | null;
  created_at: string;
};

type AdminQuestionnaire = {
  id: string;
  title: string;
  status: string;
  tenant_id: string | null;
  tenant_name: string | null;
  created_at: string | null;
};

type AdminSubmission = {
  id: string;
  type: 'registration_request' | 'questionnaire_submission';
  status: string;
  tenant_id: string | null;
  tenant_name: string | null;
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

interface SuperAdminDashboardProps {
  activeTenantContextId: string | null;
  onViewTenant: (tenantId: string) => void;
  onExitTenantView: () => void;
}

const sections: Array<{ id: DashboardSection; label: string; description: string }> = [
  { id: 'overview', label: 'Overview', description: 'Platform KPIs and approval pressure.' },
  { id: 'tenants', label: 'Tenants', description: 'Approve, suspend, delete, and inspect tenants.' },
  { id: 'users', label: 'Users', description: 'Cross-tenant user controls and account state.' },
  { id: 'submissions', label: 'Submissions', description: 'Questionnaire and submission system control.' },
  { id: 'system', label: 'System', description: 'API/DB health and error signals.' },
  { id: 'logs', label: 'Logs', description: 'Platform audit feed across all tenants.' },
];

const tenantTagType = (status: string): React.ComponentProps<typeof Tag>['type'] => {
  switch (status.toLowerCase()) {
    case 'active':
      return 'green';
    case 'suspended':
      return 'red';
    default:
      return 'warm-gray';
  }
};

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
  if (accessRole === 'tenant_admin') return 'blue';
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

const TableBodyCompat = TableBody as unknown as React.ComponentType<{ children?: React.ReactNode }>;
const SelectItemCompat = SelectItem as unknown as React.ComponentType<{ value: string; text: string }>;

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({
  activeTenantContextId,
  onViewTenant,
  onExitTenantView,
}) => {
  const { showToast } = useToast();
  const { confirm, ConfirmDialog } = useCarbonConfirm();

  const [loading, setLoading] = useState(true);
  const [sectionLoading, setSectionLoading] = useState<Record<string, boolean>>({});
  const [activeSection, setActiveSection] = useState<DashboardSection>('overview');

  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [approvals, setApprovals] = useState<ApprovalsPayload | null>(null);
  const [system, setSystem] = useState<AdminSystemPayload | null>(null);
  const [logs, setLogs] = useState<AdminLogPayload[]>([]);
  const [submissions, setSubmissions] = useState<AdminSubmissionsPayload | null>(null);

  const [tenantFilter, setTenantFilter] = useState<string>('');
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState<string>('');
  const [submissionTypeFilter, setSubmissionTypeFilter] = useState<'all' | 'registration_request' | 'questionnaire_submission'>('all');
  const [logActionFilter, setLogActionFilter] = useState<string>('');

  const [showCreateTenant, setShowCreateTenant] = useState(false);
  const [newTenantName, setNewTenantName] = useState('');
  const [newTenantStatus, setNewTenantStatus] = useState<'active' | 'pending'>('active');
  const [createTenantLoading, setCreateTenantLoading] = useState(false);

  const activeTenantContext = useMemo(
    () => tenants.find((tenant) => tenant.id === activeTenantContextId) || null,
    [activeTenantContextId, tenants],
  );

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
      const [metricsPayload, tenantsPayload, usersPayload, approvalsPayload, systemPayload, logsPayload, submissionsPayload] =
        await Promise.all([
          api.admin.metrics(),
          api.admin.tenants.list(),
          api.admin.users.list(tenantFilter ? { tenantId: tenantFilter } : undefined),
          api.admin.approvals.list(),
          api.admin.system(),
          api.admin.logs({
            limit: 120,
            action: logActionFilter || undefined,
            tenantId: tenantFilter || undefined,
          }),
          api.admin.submissions.list({
            tenantId: tenantFilter || undefined,
            status: submissionStatusFilter || undefined,
            type: submissionTypeFilter,
          }),
        ]);

      setMetrics(metricsPayload as AdminMetrics);
      setTenants(tenantsPayload as Tenant[]);
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
  }, [activeSection, logActionFilter, showToast, submissionStatusFilter, submissionTypeFilter, tenantFilter]);

  useEffect(() => {
    loadData(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loading) {
      loadData(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logActionFilter, submissionStatusFilter, submissionTypeFilter, tenantFilter]);

  const handleCreateTenantClick = () => {
    setNewTenantName('');
    setNewTenantStatus('active');
    setShowCreateTenant(true);
  };

  const handleCreateTenantSubmit = async () => {
    if (!newTenantName.trim()) return;
    setCreateTenantLoading(true);
    try {
      await api.admin.tenants.create({ name: newTenantName.trim(), status: newTenantStatus });
      showToast('Tenant created successfully.', 'success');
      setShowCreateTenant(false);
      await loadData(false);
    } catch (error) {
      showToast(getErrorMessage(error, 'Failed to create tenant'), 'error');
    } finally {
      setCreateTenantLoading(false);
    }
  };

  const updateTenantStatus = async (tenantId: string, status: 'pending' | 'active' | 'suspended') => {
    try {
      await api.admin.tenants.update(tenantId, { status });
      showToast(`Tenant moved to ${status}.`, 'success');
      await loadData(false);
    } catch (error) {
      showToast(getErrorMessage(error, 'Failed to update tenant status'), 'error');
    }
  };

  const removeTenant = async (tenantId: string) => {
    try {
      await api.admin.tenants.delete(tenantId);
      showToast('Tenant deleted.', 'success');
      await loadData(false);
    } catch (error) {
      showToast(getErrorMessage(error, 'Failed to delete tenant'), 'error');
    }
  };

  const handleDeleteTenant = async (tenant: { id: string; name: string }) => {
    const confirmed = await confirm({
      title: 'Delete Tenant',
      message: `This will permanently delete "${tenant.name}" and all associated users and data. This action cannot be undone.`,
      confirmLabel: 'Delete Tenant',
      confirmVariant: 'danger',
    });
    if (confirmed) await removeTenant(tenant.id);
  };

  const handleApproveTenant = async (tenant: { id: string; name: string }) => {
    const confirmed = await confirm({
      title: 'Approve Tenant',
      message: `Approve "${tenant.name}"? This will enable access for all their users.`,
      confirmLabel: 'Approve',
      confirmVariant: 'primary',
    });
    if (confirmed) await updateTenantStatus(tenant.id, 'active');
  };

  const handleSuspendTenant = async (tenant: { id: string; name: string }) => {
    const confirmed = await confirm({
      title: 'Suspend Tenant',
      message: `Suspend "${tenant.name}"? All users in this tenant will lose access immediately.`,
      confirmLabel: 'Suspend',
      confirmVariant: 'danger',
    });
    if (confirmed) await updateTenantStatus(tenant.id, 'suspended');
  };

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

  const enterTenantView = (tenantId: string) => {
    onViewTenant(tenantId);
    showToast('Tenant view enabled. You are operating in explicit tenant context.', 'success');
  };

  const exitTenantView = () => {
    clearViewTenantId();
    onExitTenantView();
    showToast('Tenant context cleared. Back to platform scope.', 'success');
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem' }}>
        <InlineLoading description="Loading platform control tower..." status="active" />
      </div>
    );
  }

  const overviewContent = (
    <>
      <Grid condensed fullWidth>
        <Column sm={4} md={2} lg={4}><StatCard title="Total Users" value={metrics?.totals.users ?? 0} color="blue" /></Column>
        <Column sm={4} md={2} lg={4}><StatCard title="Total Tenants" value={metrics?.totals.tenants ?? 0} color="purple" /></Column>
        <Column sm={4} md={2} lg={4}><StatCard title="Pending Approvals" value={metrics?.totals.pendingApprovals ?? 0} color="amber" /></Column>
        <Column sm={4} md={2} lg={4}><StatCard title="Active Tenants" value={metrics?.totals.activeTenants ?? 0} color="green" /></Column>
      </Grid>

      <Grid condensed fullWidth style={{ marginTop: '1rem' }}>
        <Column sm={4} md={8} lg={8}>
          <Tile style={{ border: '1px solid var(--cds-border-subtle, #c6c6c6)' }}>
            <h3 style={{ margin: 0, color: 'var(--cds-text-primary, #161616)' }}>Tenant State</h3>
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Tag type="green">Active: {metrics?.totals.activeTenants ?? 0}</Tag>
              <Tag type="red">Suspended: {metrics?.totals.suspendedTenants ?? 0}</Tag>
              <Tag type="warm-gray">Pending: {metrics?.totals.pendingTenants ?? 0}</Tag>
            </div>
          </Tile>
        </Column>

        <Column sm={4} md={8} lg={8}>
          <TableContainer
            title="Recent Platform Activity"
            description="Latest actions across the platform."
            style={{ background: 'var(--cds-layer-01, #fff)', border: '1px solid var(--cds-border-subtle, #c6c6c6)' }}
          >
            <Table size="sm">
              <TableHead>
                <TableRow>
                  <TableHeader>Action</TableHeader>
                  <TableHeader>Actor</TableHeader>
                  <TableHeader>Time</TableHeader>
                </TableRow>
              </TableHead>
              <TableBodyCompat>
                {(metrics?.activity || []).slice(0, 8).map((activity) => (
                  <TableRow key={activity.id}>
                    <TableCell>{activity.action}</TableCell>
                    <TableCell>{activity.user_email || 'system'}</TableCell>
                    <TableCell>{compactDateTime(activity.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBodyCompat>
            </Table>
          </TableContainer>
        </Column>
      </Grid>
    </>
  );

  const tenantsContent = (
    <TableContainer
      title="Tenant Management"
      description="Super admin control for all platform tenants."
      style={{ background: 'var(--cds-layer-01, #fff)', border: '1px solid var(--cds-border-subtle, #c6c6c6)' }}
    >
      <div style={{ padding: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
        <Button kind="secondary" size="sm" renderIcon={Add} onClick={handleCreateTenantClick} disabled={createTenantLoading}>
          Create Tenant
        </Button>
      </div>
      <Table size="md">
        <TableHead>
          <TableRow>
            <TableHeader>Tenant</TableHeader>
            <TableHeader>Status</TableHeader>
            <TableHeader>Users</TableHeader>
            <TableHeader>Pending</TableHeader>
            <TableHeader>Actions</TableHeader>
          </TableRow>
        </TableHead>
        <TableBodyCompat>
          {tenants.map((tenant) => (
            <TableRow key={tenant.id}>
              <TableCell>{tenant.name}</TableCell>
              <TableCell><Tag type={tenantTagType(tenant.status)}>{tenant.status}</Tag></TableCell>
              <TableCell>{tenant.user_count ?? 0}</TableCell>
              <TableCell>{tenant.pending_users ?? 0}</TableCell>
              <TableCell>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <Button kind="ghost" size="sm" renderIcon={View} onClick={() => enterTenantView(tenant.id)}>
                    View Tenant
                  </Button>
                  <Button kind="ghost" size="sm" onClick={() => handleApproveTenant(tenant)}>Approve</Button>
                  <Button kind="ghost" size="sm" onClick={() => handleSuspendTenant(tenant)}>Suspend</Button>
                  <Button kind="danger--ghost" size="sm" onClick={() => handleDeleteTenant(tenant)}>Delete</Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBodyCompat>
      </Table>
    </TableContainer>
  );

  const usersContent = (
    <TableContainer
      title="User Management"
      description="Global user controls across every tenant."
      style={{ background: 'var(--cds-layer-01, #fff)', border: '1px solid var(--cds-border-subtle, #c6c6c6)' }}
    >
      <div style={{ padding: '0.75rem' }}>
        <Select
          id="tenant-filter-users"
          labelText="Filter by tenant"
          value={tenantFilter}
          onChange={(event) => setTenantFilter(event.target.value)}
        >
          <SelectItemCompat value="" text="All tenants" />
          {tenants.map((tenant) => (
            <SelectItemCompat key={tenant.id} value={tenant.id} text={tenant.name} />
          ))}
        </Select>
      </div>
      <Table size="md">
        <TableHead>
          <TableRow>
            <TableHeader>User</TableHeader>
            <TableHeader>Access</TableHeader>
            <TableHeader>Tenant</TableHeader>
            <TableHeader>Status</TableHeader>
            <TableHeader>Actions</TableHeader>
          </TableRow>
        </TableHead>
        <TableBodyCompat>
          {users.slice(0, 120).map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <div>
                  <div>{user.name}</div>
                  <small style={{ color: 'var(--cds-text-secondary, #525252)' }}>{user.email}</small>
                </div>
              </TableCell>
              <TableCell>
                <Tag type={accessRoleTagType(user.access_role)}>{user.access_role}</Tag>
              </TableCell>
              <TableCell>
                {user.tenant_name ? (
                  <Tag type={tenantTagType(user.tenant_status || 'pending')}>{user.tenant_name}</Tag>
                ) : (
                  <Tag type="high-contrast">Platform</Tag>
                )}
              </TableCell>
              <TableCell>
                <Tag type={userStatusTagType(user.status)}>{user.status}</Tag>
              </TableCell>
              <TableCell>
                {user.access_role === 'super_admin' ? (
                  <Tag type="purple">Platform Owner</Tag>
                ) : (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {user.status === 'Pending' && (
                      <>
                        <Button kind="ghost" size="sm" onClick={() => reviewPendingUser(user.id, 'approve')}>Approve</Button>
                        <Button kind="danger--ghost" size="sm" onClick={() => reviewPendingUser(user.id, 'reject')}>Reject</Button>
                      </>
                    )}
                    {user.status !== 'Pending' && user.status !== 'Active' && (
                      <Button kind="ghost" size="sm" onClick={() => updateUserStatus(user, 'Active')}>Activate</Button>
                    )}
                    {user.status === 'Active' && (
                      <Button kind="danger--ghost" size="sm" onClick={() => updateUserStatus(user, 'Inactive')}>Suspend</Button>
                    )}
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBodyCompat>
      </Table>
    </TableContainer>
  );

  const submissionsContent = (
    <>
      <Grid condensed fullWidth>
        <Column sm={4} md={4} lg={4}>
          <StatCard title="Questionnaires" value={submissions?.summary.questionnaires ?? 0} color="purple" />
        </Column>
        <Column sm={4} md={4} lg={4}>
          <StatCard title="Submissions" value={submissions?.summary.submissions ?? 0} color="blue" />
        </Column>
        <Column sm={4} md={4} lg={4}>
          <StatCard title="Pending" value={submissions?.summary.pendingSubmissions ?? 0} color="amber" />
        </Column>
        <Column sm={4} md={4} lg={4}>
          <Tile style={{ border: '1px solid var(--cds-border-subtle, #c6c6c6)' }}>
            <h3 style={{ margin: 0, color: 'var(--cds-text-primary, #161616)' }}>Data Sources</h3>
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Tag type={submissions?.sources.questionnairesTable ? 'green' : 'cool-gray'}>questionnaires</Tag>
              <Tag type={submissions?.sources.questionnaireSubmissionsTable ? 'green' : 'cool-gray'}>questionnaire_submissions</Tag>
              <Tag type={submissions?.sources.registrationRequestsTable ? 'green' : 'cool-gray'}>registration_requests</Tag>
            </div>
          </Tile>
        </Column>
      </Grid>

      <Grid condensed fullWidth style={{ marginTop: '1rem' }}>
        <Column sm={4} md={8} lg={8}>
          <TableContainer
            title="Questionnaires"
            description="Questionnaire templates created across the platform."
            style={{ background: 'var(--cds-layer-01, #fff)', border: '1px solid var(--cds-border-subtle, #c6c6c6)' }}
          >
            <Table size="md">
              <TableHead>
                <TableRow>
                  <TableHeader>Title</TableHeader>
                  <TableHeader>Tenant</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Created</TableHeader>
                </TableRow>
              </TableHead>
              <TableBodyCompat>
                {(submissions?.questionnaires || []).slice(0, 100).map((questionnaire) => (
                  <TableRow key={questionnaire.id}>
                    <TableCell>{questionnaire.title}</TableCell>
                    <TableCell>{questionnaire.tenant_name || '-'}</TableCell>
                    <TableCell><Tag type={tenantTagType(questionnaire.status || 'pending')}>{questionnaire.status || 'unknown'}</Tag></TableCell>
                    <TableCell>{compactDateTime(questionnaire.created_at)}</TableCell>
                  </TableRow>
                ))}
                {(submissions?.questionnaires || []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4}>No questionnaires found.</TableCell>
                  </TableRow>
                )}
              </TableBodyCompat>
            </Table>
          </TableContainer>
        </Column>

        <Column sm={4} md={8} lg={8}>
          <TableContainer
            title="Submissions"
            description="Global submission feed with tenant and type filters."
            style={{ background: 'var(--cds-layer-01, #fff)', border: '1px solid var(--cds-border-subtle, #c6c6c6)' }}
          >
            <div style={{ padding: '0.75rem', display: 'grid', gap: '0.75rem' }}>
              <Select
                id="submission-type-filter"
                labelText="Filter by type"
                value={submissionTypeFilter}
                onChange={(event) => setSubmissionTypeFilter(event.target.value as typeof submissionTypeFilter)}
              >
                <SelectItemCompat value="all" text="All types" />
                <SelectItemCompat value="registration_request" text="Registration requests" />
                <SelectItemCompat value="questionnaire_submission" text="Questionnaire submissions" />
              </Select>
              <Select
                id="submission-status-filter"
                labelText="Filter by status"
                value={submissionStatusFilter}
                onChange={(event) => setSubmissionStatusFilter(event.target.value)}
              >
                <SelectItemCompat value="" text="All statuses" />
                <SelectItemCompat value="Pending" text="Pending" />
                <SelectItemCompat value="Approved" text="Approved" />
                <SelectItemCompat value="Rejected" text="Rejected" />
                <SelectItemCompat value="Active" text="Active" />
                <SelectItemCompat value="Inactive" text="Inactive" />
              </Select>
            </div>
            <Table size="md">
              <TableHead>
                <TableRow>
                  <TableHeader>Type</TableHeader>
                  <TableHeader>Submitter</TableHeader>
                  <TableHeader>Tenant</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Submitted</TableHeader>
                </TableRow>
              </TableHead>
              <TableBodyCompat>
                {(submissions?.submissions || []).slice(0, 120).map((submission) => (
                  <TableRow key={submission.id}>
                    <TableCell>{submission.type}</TableCell>
                    <TableCell>
                      <div>
                        <div>{submission.submitter_name || submission.title || '-'}</div>
                        {submission.submitter_email && (
                          <small style={{ color: 'var(--cds-text-secondary, #525252)' }}>{submission.submitter_email}</small>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{submission.tenant_name || '-'}</TableCell>
                    <TableCell><Tag type={userStatusTagType(submission.status)}>{submission.status}</Tag></TableCell>
                    <TableCell>{compactDateTime(submission.submitted_at)}</TableCell>
                  </TableRow>
                ))}
                {(submissions?.submissions || []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>No submissions found.</TableCell>
                  </TableRow>
                )}
              </TableBodyCompat>
            </Table>
          </TableContainer>
        </Column>
      </Grid>
    </>
  );

  const systemContent = (
    <Grid condensed fullWidth>
      <Column sm={4} md={8} lg={6}>
        <Tile style={{ border: '1px solid var(--cds-border-subtle, #c6c6c6)' }}>
          <h3 style={{ margin: 0, color: 'var(--cds-text-primary, #161616)' }}>System Health</h3>
          <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <Tag type={system?.checks.api ? 'green' : 'red'}>API: {system?.checks.api ? 'healthy' : 'unhealthy'}</Tag>
            <Tag type={system?.checks.database ? 'green' : 'red'}>DB: {system?.checks.database ? 'healthy' : 'unhealthy'}</Tag>
            <Tag type={system?.status === 'healthy' ? 'green' : 'red'}>Status: {system?.status || 'unknown'}</Tag>
          </div>
          <p style={{ marginTop: '0.75rem', color: 'var(--cds-text-secondary, #525252)' }}>
            Uptime: {formatUptime(system?.uptimeSeconds ?? 0)}
          </p>
          <p style={{ marginTop: '0.25rem', color: 'var(--cds-text-secondary, #525252)' }}>
            Last check: {compactDateTime(system?.timestamp)}
          </p>
        </Tile>
      </Column>

      <Column sm={4} md={8} lg={10}>
        <TableContainer
          title="Recent Error Signals"
          description="Latest failed/error/rejected events detected in audit stream."
          style={{ background: 'var(--cds-layer-01, #fff)', border: '1px solid var(--cds-border-subtle, #c6c6c6)' }}
        >
          <Table size="sm">
            <TableHead>
              <TableRow>
                <TableHeader>Action</TableHeader>
                <TableHeader>Table</TableHeader>
                <TableHeader>Actor</TableHeader>
                <TableHeader>Time</TableHeader>
              </TableRow>
            </TableHead>
            <TableBodyCompat>
              {(system?.recentErrors || []).map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.action}</TableCell>
                  <TableCell>{row.table_name || '-'}</TableCell>
                  <TableCell>{row.user_email || 'system'}</TableCell>
                  <TableCell>{compactDateTime(row.created_at)}</TableCell>
                </TableRow>
              ))}
              {(system?.recentErrors || []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <WarningFilled size={16} />
                      No recent error signals.
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBodyCompat>
          </Table>
        </TableContainer>
      </Column>
    </Grid>
  );

  const logsContent = (
    <TableContainer
      title="Audit Logs"
      description="Platform-wide admin and system activity feed."
      style={{ background: 'var(--cds-layer-01, #fff)', border: '1px solid var(--cds-border-subtle, #c6c6c6)' }}
    >
      <div style={{ padding: '0.75rem', display: 'grid', gap: '0.75rem' }}>
        <TextInput
          id="logs-action-filter"
          labelText="Filter action contains"
          value={logActionFilter}
          onChange={(event) => setLogActionFilter(event.target.value)}
          placeholder="e.g. approvals, failed, users.updated"
        />
        <Button kind="secondary" size="sm" renderIcon={Launch} onClick={() => loadData(false)}>
          Refresh Logs
        </Button>
      </div>
      <Table size="sm">
        <TableHead>
          <TableRow>
            <TableHeader>Action</TableHeader>
            <TableHeader>Actor</TableHeader>
            <TableHeader>Tenant</TableHeader>
            <TableHeader>Table</TableHeader>
            <TableHeader>Time</TableHeader>
          </TableRow>
        </TableHead>
        <TableBodyCompat>
          {logs.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell>{entry.action}</TableCell>
              <TableCell>{entry.user_email || 'system'}</TableCell>
              <TableCell>{entry.tenant_name || 'platform'}</TableCell>
              <TableCell>{entry.table_name || '-'}</TableCell>
              <TableCell>{compactDateTime(entry.created_at)}</TableCell>
            </TableRow>
          ))}
          {logs.length === 0 && (
            <TableRow>
              <TableCell colSpan={5}>No logs found for current filters.</TableCell>
            </TableRow>
          )}
        </TableBodyCompat>
      </Table>
    </TableContainer>
  );

  const sectionContent: Record<DashboardSection, React.ReactNode> = {
    overview: overviewContent,
    tenants: tenantsContent,
    users: usersContent,
    submissions: submissionsContent,
    system: systemContent,
    logs: logsContent,
  };

  return (
    <div style={{ padding: '1.5rem', background: 'var(--cds-layer-02, #f4f4f4)', minHeight: '100%' }}>
      <Tile style={{ marginBottom: '1rem', padding: '1rem', borderLeft: '4px solid var(--cds-interactive, #0f62fe)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, color: 'var(--cds-text-primary, #161616)' }}>Super Admin Control Tower</h2>
            <p style={{ margin: '0.5rem 0 0', color: 'var(--cds-text-secondary, #525252)' }}>
              Platform-only operations. No tenant workspace logic is mixed into this dashboard.
            </p>
          </div>
          {activeTenantContext ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Tag type="blue">Viewing tenant: {activeTenantContext.name}</Tag>
              <Button kind="ghost" size="sm" onClick={exitTenantView}>Exit Tenant View</Button>
            </div>
          ) : (
            <Tag type="high-contrast">Platform Scope</Tag>
          )}
        </div>
      </Tile>

      <Grid condensed fullWidth>
        <Column sm={4} md={4} lg={4}>
          <Tile style={{ border: '1px solid var(--cds-border-subtle, #c6c6c6)', padding: '0.75rem' }}>
            <h3 style={{ margin: 0, color: 'var(--cds-text-primary, #161616)' }}>Admin Sections</h3>
            <p style={{ margin: '0.5rem 0 0.75rem', color: 'var(--cds-text-secondary, #525252)' }}>
              {selectedSectionMeta.description}
            </p>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {sections.map((section) => (
                <Button
                  key={section.id}
                  kind={activeSection === section.id ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveSection(section.id)}
                >
                  {section.label}
                </Button>
              ))}
            </div>
          </Tile>
        </Column>

        <Column sm={4} md={12} lg={12}>
          {sectionLoading[activeSection] ? (
            <InlineLoading description="Loading..." />
          ) : (
            sectionContent[activeSection]
          )}
        </Column>
      </Grid>

      {(approvals?.pendingUsers || []).length > 0 && activeSection !== 'users' && (
        <Tile
          style={{
            marginTop: '1rem',
            borderLeft: '4px solid var(--cds-support-warning, #f1c21b)',
            border: '1px solid var(--cds-border-subtle, #c6c6c6)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div>
              <strong>{approvals.pendingUsers.length} pending user approvals</strong>
              <p style={{ margin: '0.25rem 0 0', color: 'var(--cds-text-secondary, #525252)' }}>
                Open Users section to approve/reject pending accounts.
              </p>
            </div>
            <Button kind="secondary" size="sm" onClick={() => setActiveSection('users')}>Review Approvals</Button>
          </div>
        </Tile>
      )}

      <ComposedModal open={showCreateTenant} onClose={() => setShowCreateTenant(false)}>
        <ModalHeader title="Create New Tenant" />
        <ModalBody>
          <TextInput
            id="new-tenant-name"
            labelText="Tenant Name"
            value={newTenantName}
            onChange={(e) => setNewTenantName(e.target.value)}
            placeholder="Enter tenant name"
            required
          />
          <div style={{ marginTop: '1rem' }}>
            <Select
              id="new-tenant-status"
              labelText="Initial Status"
              value={newTenantStatus}
              onChange={(e) => setNewTenantStatus(e.target.value as 'active' | 'pending')}
            >
              <SelectItemCompat value="active" text="Active" />
              <SelectItemCompat value="pending" text="Pending Approval" />
            </Select>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button kind="secondary" onClick={() => setShowCreateTenant(false)}>Cancel</Button>
          <Button
            kind="primary"
            onClick={handleCreateTenantSubmit}
            disabled={!newTenantName.trim() || createTenantLoading}
          >
            {createTenantLoading ? 'Creating...' : 'Create Tenant'}
          </Button>
        </ModalFooter>
      </ComposedModal>

      <ConfirmDialog />
    </div>
  );
};

export default SuperAdminDashboard;
