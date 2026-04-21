
import React, { useState, useEffect } from 'react';
import {
 TextInput,
 TextArea,
 Button,
 Tag,
 Tile,
 Stack,
 Checkbox,
 InlineNotification,
} from './ui';
import { Settings as SettingsIcon, User, ShieldCheck, Mail, RefreshCw, Plus, KeyRound, Pencil, Trash2, Minus, Copy } from 'lucide-react';
import { CompanyDetails, AppUser, UserRole, UserInvite, RegistrationRequest, Client, AuditLog } from '../types';
import { dataService } from '../services/dataService';
import { authService } from '../services/authService';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmModal';
import { companyDetailsFormSchema, getFirstValidationMessage, inviteFormSchema, setPasswordFormSchema, userCreateFormSchema, userEditFormSchema } from '../utils/clientValidation';
import { ZodError } from 'zod';
import ForensicLogPanel from './shared/ForensicLogPanel';
import { DashboardCard } from './ui';


export const Settings: React.FC = () => {
 const { showToast, ToastContainer } = useToast();
 const { confirm, ConfirmDialog } = useConfirm();
 const [activeTab, setActiveTab] = useState<'company' | 'users' | 'forensics' | 'clients' | 'requests' | 'invites'>('company');
 const [company, setCompany] = useState<CompanyDetails | null>(null);
 const [users, setUsers] = useState<AppUser[]>([]);
 const [clients, setClients] = useState<Client[]>([]);
 const [invites, setInvites] = useState<UserInvite[]>([]);
 const [registrationRequests, setRegistrationRequests] = useState<RegistrationRequest[]>([]);
 const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
 const [logsLoading, setLogsLoading] = useState(false);
 const [loading, setLoading] = useState(true);
 const [saveStatus, setSaveStatus] = useState<string>('');

 // User management state
 const [showUserModal, setShowUserModal] = useState(false);
 const [showInviteModal, setShowInviteModal] = useState(false);
 const [showDeleteDialog, setShowDeleteDialog] = useState(false);
 const [showEditModal, setShowEditModal] = useState(false);
 const [showSetPasswordModal, setShowSetPasswordModal] = useState(false);
 const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);
 const [userToEdit, setUserToEdit] = useState<AppUser | null>(null);
 const [userToSetPassword, setUserToSetPassword] = useState<AppUser | null>(null);
 const [userForm, setUserForm] = useState({
 name: '',
 email: '',
 password: '',
 role: 'Driver' as UserRole,
 status: 'Active' as const
 });
 const [passwordForm, setPasswordForm] = useState({
 newPassword: '',
 confirmPassword: ''
 });
 const [editForm, setEditForm] = useState({
 name: '',
 email: '',
 role: 'Driver' as UserRole,
 status: 'Active' as 'Active' | 'Inactive'
 });
 const [inviteForm, setInviteForm] = useState({
 name: '',
 email: '',
 role: 'Driver' as UserRole
 });
 const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
 const [isBulkUpdating, setIsBulkUpdating] = useState(false);
 const [bulkTargetStatus, setBulkTargetStatus] = useState<'Active' | 'Inactive' | null>(null);

 // Dedicated function to load users - can be called for refresh
 const loadUsers = async () => {
 try {
  const u = await dataService.getUsers();
  setUsers(u);
  return u;
 } catch (error: any) {
  console.error('[Settings] Error loading users:', error);
  throw error;
 }
 };

 const setStatusMessage = (message: string, toastType: Parameters<typeof showToast>[1] = 'success') => {
 setSaveStatus(message);
 showToast(message, toastType);
 window.setTimeout(() => setSaveStatus(''), 4000);
 };

 const loadAuditLogs = async () => {
 setLogsLoading(true);
 try {
  const nextLogs = await dataService.getAuditLogs(150);
  setAuditLogs(nextLogs);
 } catch (error: any) {
  console.error('[Settings] getAuditLogs:', error);
  showToast(error?.message || 'Failed to load forensic log.', 'error');
 } finally {
  setLogsLoading(false);
 }
 };

 useEffect(() => {
 const load = async () => {
  // Load each section independently so one failure doesn't blank the whole page
  const [c, i, r, logs] = await Promise.all([
  dataService.getCompanyDetails().catch((e: unknown) => { console.error('[Settings] getCompanyDetails:', e); return null; }),
  dataService.getInvites().catch((e: unknown) => { console.error('[Settings] getInvites:', e); return [] as UserInvite[]; }),
  dataService.getRegistrationRequests().catch((e: unknown) => { console.error('[Settings] getRegistrationRequests:', e); return [] as RegistrationRequest[]; }),
  dataService.getAuditLogs(150).catch((e: unknown) => { console.error('[Settings] getAuditLogs:', e); return [] as AuditLog[]; }),
  ]);

  setCompany(c);
  setInvites(Array.isArray(i) ? i : []);
  setRegistrationRequests(Array.isArray(r) ? r : []);
  setAuditLogs(Array.isArray(logs) ? logs : []);

  try {
  await loadUsers();
  } catch (userError: any) {
  console.error('[Settings] loadUsers:', userError.message);
  }

  setLoading(false);
 };
 load();
 }, []);

 const handleCompanySubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!company) return;
 try {
  companyDetailsFormSchema.parse(company);
  await dataService.updateCompanyDetails(company);
  setStatusMessage('Business details saved.');
 } catch (error) {
  console.error('Error saving company details:', error);
  const message = error instanceof ZodError
  ? getFirstValidationMessage(error)
  : 'Error saving company details. Please try again.';
  setStatusMessage(message, 'error');
 }
 };

 const handleCreateUser = async (e: React.FormEvent) => {
 e.preventDefault();

 try {
  userCreateFormSchema.parse(userForm);
  const newUser = await authService.createUser({
  name: userForm.name,
  email: userForm.email,
  password: userForm.password,
  role: userForm.role
  });
  setUsers([...users, newUser]);
  setShowUserModal(false);
  setUserForm({ name: '', email: '', password: '', role: 'Driver', status: 'Active' });
  setStatusMessage('User created successfully.');
 } catch (error: any) {
  console.error('Error creating user:', error);
  const message = error instanceof ZodError
  ? getFirstValidationMessage(error)
  : error.message || 'Failed to create user. Please try again.';
  showToast(message, 'error');
 }
 };

 const openSetPasswordModal = (user: AppUser) => {
 setUserToSetPassword(user);
 setPasswordForm({ newPassword: '', confirmPassword: '' });
 setShowSetPasswordModal(true);
 };

 const handleSetPassword = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!userToSetPassword) return;

 try {
  setPasswordFormSchema.parse(passwordForm);
  await authService.adminSetUserPassword(userToSetPassword.id, passwordForm.newPassword);
  setShowSetPasswordModal(false);
  setUserToSetPassword(null);
  setPasswordForm({ newPassword: '', confirmPassword: '' });
  setStatusMessage(`Password updated for ${userToSetPassword.name}.`);
 } catch (error: any) {
  console.error('Error setting password:', error);
  const message = error instanceof ZodError
  ? getFirstValidationMessage(error)
  : error.message || 'Failed to set password. Please try again.';
  showToast(message, 'error');
 }
 };

 const handleDeleteUser = async () => {
 if (!userToDelete) return;
 try {
  await dataService.deleteUser(userToDelete.id);
  setUsers(users.filter(u => u.id !== userToDelete.id));
  setShowDeleteDialog(false);
  setUserToDelete(null);
  setStatusMessage('User deleted successfully.');
 } catch (error: any) {
  console.error('Error deleting user:', error);
  if (error.name === 'ValidationError') {
  showToast(error.message, 'warning');
  } else {
  showToast('Failed to delete user. Please try again.', 'error');
  }
  setShowDeleteDialog(false);
  setUserToDelete(null);
 }
 };

 const openDeleteDialog = (user: AppUser) => {
 setUserToDelete(user);
 setShowDeleteDialog(true);
 };

 const openEditModal = (user: AppUser) => {
 setUserToEdit(user);
 setEditForm({
  name: user.name,
  email: user.email,
  role: user.role,
  status: user.status
 });
 setShowEditModal(true);
 };

 const handleEditUser = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!userToEdit) return;

 try {
  userEditFormSchema.parse(editForm);
  const updatedUser = await dataService.updateUser(userToEdit.id, editForm);
  
  // Update local state with the returned user
  setUsers(users.map(u => u.id === userToEdit.id ? updatedUser : u));
  setShowEditModal(false);
  setUserToEdit(null);
  
  // Show success message with role change info
  const roleChanged = userToEdit.role !== editForm.role;
  const statusMsg = roleChanged 
  ? `User updated! Role changed from ${userToEdit.role} to ${editForm.role}. User will see new role on next login.`
  : 'User updated successfully!';
  setStatusMessage(statusMsg);
  
  // Refresh users list to ensure we have latest data from database
  await loadUsers();
 } catch (error: any) {
  console.error('[Settings] Error updating user:', error);
  if (error instanceof ZodError) {
  showToast(getFirstValidationMessage(error), 'warning');
  } else if (error.name === 'ValidationError') {
  showToast(`${error.field}: ${error.message}`, 'warning');
  } else {
  showToast(error.message || 'Failed to update user. Please try again.', 'error');
  }
 }
 };

 const handleSendInvite = async (e: React.FormEvent) => {
 e.preventDefault();
 try {
  inviteFormSchema.parse(inviteForm);
  const currentUser = await dataService.getSession();
  const invite = await dataService.createInvite(
  inviteForm.email,
  inviteForm.role,
  inviteForm.name,
  currentUser?.user?.email || 'admin'
  );
  setInvites([...invites, invite]);
  setShowInviteModal(false);
  setInviteForm({ name: '', email: '', role: 'Driver' });
  setStatusMessage('Invite created successfully. Share the invite link from the Invitations tab.');
 } catch (error: any) {
  console.error('Error sending invite:', error);
  if (error instanceof ZodError) {
  showToast(getFirstValidationMessage(error), 'warning');
  } else if (error.name === 'ValidationError') {
  showToast(`${error.field}: ${error.message}`, 'warning');
  } else {
  showToast('Failed to send invite. Please try again.', 'error');
  }
 }
 };

 const handleDeleteInvite = async (inviteId: string) => {
 try {
  await dataService.deleteInvite(inviteId);
  setInvites(invites.filter(i => i.id !== inviteId));
  setStatusMessage('Invite cancelled successfully.');
 } catch (error: any) {
  console.error('Error deleting invite:', error);
  showToast('Failed to cancel invite. Please try again.', 'error');
 }
 };

 const handleResendInvite = async (inviteId: string) => {
 try {
  const updatedInvite = await dataService.resendInvite(inviteId);
  setInvites(invites.map(i => i.id === inviteId ? updatedInvite : i));
  setStatusMessage('Invite refreshed successfully. Share the updated invite link from the Invitations tab.');
 } catch (error: any) {
  console.error('Error resending invite:', error);
  showToast('Failed to resend invite. Please try again.', 'error');
 }
 };

 const handleCopyInviteLink = async (inviteToken: string) => {
 const inviteUrl = `${window.location.origin}?token=${inviteToken}`;
 try {
  await navigator.clipboard.writeText(inviteUrl);
  setStatusMessage('Invite link copied to clipboard.');
 } catch (error) {
  console.error('Error copying invite link:', error);
  showToast('Copy failed. Please try again.', 'warning');
 }
 };

 const handleApproveRequest = async (requestId: string) => {
 try {
  const currentUser = await dataService.getSession();
  await dataService.approveRegistrationRequest(requestId, currentUser?.user?.id || 'admin');

  // Refresh the lists
  const [updatedRequests, updatedUsers, updatedInvites] = await Promise.all([
  dataService.getRegistrationRequests(),
  dataService.getUsers(),
  dataService.getInvites(),
  ]);
  setRegistrationRequests(updatedRequests);
  setUsers(updatedUsers);
  setInvites(updatedInvites);
  await loadAuditLogs();

  setStatusMessage('Registration approved. An invite was created so the user can set a password.');
 } catch (error: any) {
  console.error('Error approving request:', error);
  const errorMessage = error.message || 'Unknown error';
  showToast(`Failed to approve registration: ${errorMessage}`, 'error');
 }
 };

 const handleRejectRequest = async (requestId: string) => {
 try {
  const currentUser = await dataService.getSession();
  await dataService.rejectRegistrationRequest(requestId, currentUser?.user?.id || 'admin');

  const updatedRequests = await dataService.getRegistrationRequests();
  setRegistrationRequests(updatedRequests);
  await loadAuditLogs();

  setStatusMessage('Registration request rejected.');
 } catch (error: any) {
  console.error('Error rejecting request:', error);
  showToast('Failed to reject registration. Please try again.', 'error');
 }
 };

 const handleResetPassword = async (userEmail: string) => {
 const confirmed = await confirm({
  title: 'Create Password Reset',
  message: `Create a server-side password reset request for ${userEmail}?`,
  confirmLabel: 'Create Reset',
  cancelLabel: 'Cancel',
  confirmVariant: 'primary'
 });
 if (!confirmed) return;

 try {
  await dataService.resetUserPassword(userEmail);
  await loadAuditLogs();
  setStatusMessage(`Password reset initiated for ${userEmail}.`);
 } catch (error: any) {
  console.error('Error sending password reset:', error);
  showToast('Failed to create password reset request. Please try again.', 'error');
 }
 };

 const handleToggleUserStatus = async (user: AppUser) => {
 const nextStatus: 'Active' | 'Inactive' = user.status === 'Active' ? 'Inactive' : 'Active';
 try {
  // Optimistic UI update
  setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: nextStatus } : u));
  const updatedUser = await dataService.updateUser(user.id, { status: nextStatus });
  setUsers(prev => prev.map(u => u.id === user.id ? updatedUser : u));
  await loadAuditLogs();
  setStatusMessage(`User ${nextStatus === 'Active' ? 'activated' : 'deactivated'} successfully!`);
 } catch (error: any) {
  console.error('Error toggling user status:', error);
  // Revert optimistic update on failure
  setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: user.status } : u));
  showToast('Failed to update status. Please try again.', 'error');
 }
 };

 const toggleSelectUser = (userId: string) => {
 setSelectedUserIds(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
 };

 const toggleSelectAll = () => {
 if (selectedUserIds.length === users.length) {
  setSelectedUserIds([]);
 } else {
  setSelectedUserIds(users.map(u => u.id));
 }
 };

 const handleBulkUpdateStatus = async (status: 'Active' | 'Inactive') => {
 if (selectedUserIds.length === 0) return;
 setIsBulkUpdating(true);
 const ids = [...selectedUserIds];
 try {
  // Optimistic update
  setUsers(prev => prev.map(u => ids.includes(u.id) ? { ...u, status } : u));
  const updates = ids.map(async (id) => {
  try {
   return await dataService.updateUser(id, { status });
  } catch (e) {
   return null;
  }
  });
  const results = await Promise.all(updates);
  const failedIds = ids.filter((id, idx) => results[idx] === null);
  const successfulUsers = results.filter((u): u is AppUser => !!u);
  // Apply confirmed updates
  setUsers(prev => prev.map(u => {
  const updated = successfulUsers.find(su => su.id === u.id);
  return updated ? updated : u;
  }));
  // Revert failures
  if (failedIds.length) {
  setUsers(prev => prev.map(u => failedIds.includes(u.id) ? { ...u, status: u.status === 'Active' ? 'Inactive' : 'Active' } : u));
  showToast(`Failed to update ${failedIds.length} user(s). Changes were reverted for them.`, 'warning');
  }
  await loadAuditLogs();
  setStatusMessage(`Updated ${successfulUsers.length} user(s) to ${status}.`);
  setSelectedUserIds([]);
 } finally {
  setIsBulkUpdating(false);
 }
 };

 if (loading) return (
 <div className="flex items-center justify-center h-64 font-sans">
  <div className="animate-spin h-8 w-8 border-b-2" style={{ borderColor: 'var(--cds-interactive, #0f62fe)' }}></div>
 </div>
 );

 return (
 <div className="max-w-4xl mx-auto font-sans">
  <ToastContainer />
  <ConfirmDialog />
  <div className="flex items-center gap-4 mb-8">
  <div className="p-3" style={{ background: 'var(--cds-layer-02, #f4f4f4)' }}>
   <svg className="w-6 h-6" style={{ color: 'var(--cds-interactive, #0f62fe)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
   </svg>
  </div>
  <div>
   <h2 className="text-2xl font-bold" style={{ color: 'var(--cds-text-primary, #161616)' }}>Platform Settings</h2>
   <p style={{ color: 'var(--cds-text-secondary, #525252)' }}>Manage your business profile and team access</p>
  </div>
  </div>

  <div className="overflow-hidden" style={{ background: 'var(--cds-layer-01, #ffffff)', border: '1px solid var(--cds-border-subtle, #c6c6c6)' }}>
  <div className="flex overflow-x-auto" style={{ borderBottom: '1px solid var(--cds-border-subtle, #c6c6c6)', background: 'var(--cds-layer-02, #f4f4f4)' }}>
   <button
   onClick={() => setActiveTab('company')}
   className={`px-6 py-4 text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${activeTab === 'company'
    ? ''
    : 'border-transparent'
    }`}
   style={activeTab === 'company'
    ? { borderColor: 'var(--cds-interactive, #0f62fe)', color: 'var(--cds-interactive, #0f62fe)', background: 'var(--cds-background, #ffffff)' }
    : { color: 'var(--cds-text-secondary, #525252)' }
   }
   >
   Company Profile
   </button>
   <button
   onClick={() => setActiveTab('users')}
   className={`px-6 py-4 text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${activeTab === 'users'
    ? ''
    : 'border-transparent'
    }`}
   style={activeTab === 'users'
    ? { borderColor: 'var(--cds-interactive, #0f62fe)', color: 'var(--cds-interactive, #0f62fe)', background: 'var(--cds-background, #ffffff)' }
    : { color: 'var(--cds-text-secondary, #525252)' }
   }
   >
   User Management
   </button>
   <button
   onClick={() => setActiveTab('forensics')}
   className={`px-6 py-4 text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${activeTab === 'forensics'
    ? ''
    : 'border-transparent'
    }`}
   style={activeTab === 'forensics'
    ? { borderColor: 'var(--cds-interactive, #0f62fe)', color: 'var(--cds-interactive, #0f62fe)', background: 'var(--cds-background, #ffffff)' }
    : { color: 'var(--cds-text-secondary, #525252)' }
   }
   >
   Forensic Log
   </button>
   <button
   onClick={() => setActiveTab('requests')}
   className={`px-6 py-4 text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${activeTab === 'requests'
    ? ''
    : 'border-transparent'
    }`}
   style={activeTab === 'requests'
    ? { borderColor: 'var(--cds-interactive, #0f62fe)', color: 'var(--cds-interactive, #0f62fe)', background: 'var(--cds-background, #ffffff)' }
    : { color: 'var(--cds-text-secondary, #525252)' }
   }
   >
   Requests {registrationRequests.filter(r => r.status === 'Pending').length > 0 && (
    <span className="ml-2 px-2 py-0.5 text-xs font-bold">
    <Tag type="warm-gray" size="sm">{registrationRequests.filter(r => r.status === 'Pending').length}</Tag>
    </span>
   )}
   </button>
   <button
   onClick={() => setActiveTab('invites')}
   className={`px-6 py-4 text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${activeTab === 'invites'
    ? ''
    : 'border-transparent'
    }`}
   style={activeTab === 'invites'
    ? { borderColor: 'var(--cds-interactive, #0f62fe)', color: 'var(--cds-interactive, #0f62fe)', background: 'var(--cds-background, #ffffff)' }
    : { color: 'var(--cds-text-secondary, #525252)' }
   }
   >
   Invitations {invites.filter(i => i.status === 'Pending').length > 0 && (
    <span className="ml-2 px-2 py-0.5 text-xs font-bold">
    <Tag type="green" size="sm">{invites.filter(i => i.status === 'Pending').length}</Tag>
    </span>
   )}
   </button>
  </div>

  <div className="p-8">
   {activeTab === 'company' && company && (
   <form onSubmit={handleCompanySubmit}>
    <Stack gap={6}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
     <TextInput
     id="company-name"
     labelText="Legal Company Name"
     value={company.name}
     onChange={(e) => setCompany({ ...company, name: e.target.value })}
     />
     <TextInput
     id="company-reg"
     labelText="Registration Number"
     value={company.registration_no}
     onChange={(e) => setCompany({ ...company, registration_no: e.target.value })}
     />
     <TextInput
     id="company-tax"
     labelText="Tax / VAT ID"
     value={company.tax_id}
     onChange={(e) => setCompany({ ...company, tax_id: e.target.value })}
     />
     <TextInput
     id="company-email"
     type="email"
     labelText="HQ Contact Email"
     value={company.contact_email}
     onChange={(e) => setCompany({ ...company, contact_email: e.target.value })}
     />
     <TextInput
     id="company-phone"
     type="tel"
     labelText="Phone Number"
     value={company.phone ?? ''}
     onChange={(e) => setCompany({ ...company, phone: e.target.value })}
     />
     <TextInput
     id="company-website"
     type="url"
     labelText="Website"
     placeholder="https://example.com"
     value={company.website ?? ''}
     onChange={(e) => setCompany({ ...company, website: e.target.value })}
     />
    </div>
    <TextArea
     id="company-address"
     labelText="HQ Address"
     rows={3}
     value={company.address}
     onChange={(e) => setCompany({ ...company, address: e.target.value })}
    />
    <TextInput
     id="company-logo"
     type="url"
     labelText="Company Logo URL"
     helperText="PDFs now use the built-in Affinity logo. This URL is optional for other branded surfaces."
     placeholder="https://example.com/logo.png"
     value={company.logo_url ?? ''}
     onChange={(e) => setCompany({ ...company, logo_url: e.target.value })}
    />
    {company.logo_url && (
     <Tile style={{ padding: '1rem', background: 'var(--cds-layer-02, #f4f4f4)' }}>
     <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--cds-text-secondary, #525252)', marginBottom: '0.75rem' }}>Logo Preview:</p>
     <img
      src={company.logo_url}
      alt="Company Logo"
      style={{ height: '4rem', objectFit: 'contain' }}
      onError={(e) => {
      (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="50"%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" fill="%23999"%3EInvalid URL%3C/text%3E%3C/svg%3E';
      }}
     />
     </Tile>
    )}
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingTop: '1rem' }}>
     <Button type="submit" leftIcon={<SettingsIcon size={14} />}>Save Business Details</Button>
     {saveStatus && <InlineNotification kind="success" title="Saved" subtitle={saveStatus} hideCloseButton />}
    </div>
    </Stack>
   </form>
   )}

   {activeTab === 'users' && (
   <div className="space-y-4 sm:space-y-6">
    {/* 
    RESPONSIVE USER MANAGEMENT PORTAL
    Breakpoints: sm (640px), md (768px), lg (1024px)
    - Mobile: 1 column cards, stacked buttons, card-based user list
    - Tablet: 2 column KPIs, wrapped buttons, compressed table
    - Desktop: 4 column KPIs, inline buttons, full table
    */}
    
    {/* KPI Cards - Responsive Grid: 1 col mobile, 2 col tablet, 4 col desktop */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
    <Tile className="min-h-[100px]">
     <div className="flex items-center justify-between mb-2">
     <svg className="w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0" style={{ color: 'var(--cds-interactive, #0f62fe)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
     </svg>
     </div>
     <p className="text-2xl sm:text-2xl font-black" style={{ color: 'var(--cds-text-primary, #161616)' }}>{users.length}</p>
     <p className="text-xs sm:text-xs font-bold uppercase tracking-wider mt-1" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Total Users</p>
    </Tile>

    <Tile className="min-h-[100px]">
     <div className="flex items-center justify-between mb-2">
     <svg className="w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0" style={{ color: 'var(--cds-support-success, #24a148)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
     </svg>
     </div>
     <p className="text-2xl sm:text-2xl font-black" style={{ color: 'var(--cds-text-primary, #161616)' }}>{users.filter(u => u.status === 'Active').length}</p>
     <p className="text-xs sm:text-xs font-bold uppercase tracking-wider mt-1" style={{ color: 'var(--cds-support-success, #24a148)' }}>Active Users</p>
    </Tile>

    <Tile className="min-h-[100px]">
     <div className="flex items-center justify-between mb-2">
     <svg className="w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0" style={{ color: 'var(--cds-tag-color-purple, #8a3ffc)' }} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
     </svg>
     </div>
     <p className="text-2xl sm:text-2xl font-black" style={{ color: 'var(--cds-text-primary, #161616)' }}>{users.filter(u => u.role === 'Admin').length}</p>
     <p className="text-xs sm:text-xs font-bold uppercase tracking-wider mt-1" style={{ color: 'var(--cds-tag-color-purple, #8a3ffc)' }}>Administrators</p>
    </Tile>

    <Tile className="min-h-[100px]">
     <div className="flex items-center justify-between mb-2">
     <svg className="w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0" style={{ color: 'var(--cds-tag-color-warm-gray, #8d8d8d)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
     </svg>
     </div>
     <p className="text-2xl sm:text-2xl font-black" style={{ color: 'var(--cds-text-primary, #161616)' }}>{users.filter(u => u.status === 'Inactive').length}</p>
     <p className="text-xs sm:text-xs font-bold uppercase tracking-wider mt-1" style={{ color: 'var(--cds-text-disabled, #8d8d8d)' }}>Inactive Users</p>
    </Tile>
    </div>

    {/* Action Row - Responsive: stacked on mobile, flex on tablet+ */}
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4">
    <div className="flex-shrink-0">
     <h3 className="text-base sm:text-lg font-bold" style={{ color: 'var(--cds-text-primary, #161616)' }}>Team Directory</h3>
     <p className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: 'var(--cds-text-secondary, #525252)' }}>{users.length} user{users.length !== 1 ? 's' : ''} in database</p>
    </div>
    
    {/* Action Buttons - Responsive flex container */}
    <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
     {/* Primary Action - Full width on mobile */}
     <Button
     onClick={() => setShowUserModal(true)}
     leftIcon={<Plus size={14} />}
     className="w-full sm:w-auto"
     >
     Add New User
     </Button>
     
     {/* Secondary Actions - Row on mobile, inline on tablet+ */}
     <div className="flex flex-wrap gap-2">
     <Button
      variant="secondary"
      size="sm"
      onClick={async () => {
      setLoading(true);
      try {
       // Sync the current user's profile to Neon
       const syncedUser = await dataService.syncCurrentUser();
       const u = await dataService.getUsers();
       setUsers(u);
       setSelectedUserIds([]);
       setBulkTargetStatus(null);
       await loadAuditLogs();
       setStatusMessage(`Synced. Found ${u.length} user${u.length !== 1 ? 's' : ''} in the database.${syncedUser ? ' Your profile is synced.' : ''}`);
      } catch (error: any) {
       console.error('[Settings] Refresh error:', error);
       showToast(error?.message || 'Sync failed. Please try again.', 'error');
      }
      setLoading(false);
      }}
      leftIcon={<RefreshCw size={14} />}
      disabled={isBulkUpdating}
      className="flex-1 sm:flex-none"
     >
      Sync & Refresh
     </Button>
     <Button
      variant={selectedUserIds.length === 0 || isBulkUpdating ? 'ghost' : 'primary'}
      size="sm"
      onClick={() => { setBulkTargetStatus('Active'); handleBulkUpdateStatus('Active'); }}
      disabled={selectedUserIds.length === 0 || isBulkUpdating}
      className="flex-1 sm:flex-none"
     >
      {isBulkUpdating && bulkTargetStatus === 'Active' ? 'Activating…' : 'Activate'}
     </Button>
     <Button
      variant={selectedUserIds.length === 0 || isBulkUpdating ? 'ghost' : 'danger'}
      size="sm"
      onClick={() => { setBulkTargetStatus('Inactive'); handleBulkUpdateStatus('Inactive'); }}
      disabled={selectedUserIds.length === 0 || isBulkUpdating}
      className="flex-1 sm:flex-none"
     >
      {isBulkUpdating && bulkTargetStatus === 'Inactive' ? 'Deactivating…' : 'Deactivate'}
     </Button>
     </div>
     
     {/* Selection indicator */}
     {selectedUserIds.length > 0 && (
     <span className="self-center">
      <Tag type={bulkTargetStatus === 'Active' ? 'green' : bulkTargetStatus === 'Inactive' ? 'warm-gray' : 'blue'} size="sm">
       {selectedUserIds.length} selected
      </Tag>
     </span>
     )}
    </div>
    </div>
    
    {/* Status message */}
    {saveStatus && activeTab === 'users' && (
    <InlineNotification kind="success" title="Success" subtitle={saveStatus} hideCloseButton />
    )}

    {/* User List Container */}
    <div className="overflow-hidden" style={{ border: '1px solid var(--cds-border-subtle, #c6c6c6)' }}>
    {loading ? (
     <div className="p-6 sm:p-8 text-center" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Loading users...</div>
    ) : users.length === 0 ? (
     <div className="p-6 sm:p-8 text-center">
     <div className="max-w-md mx-auto">
      <svg className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--cds-text-disabled, #8d8d8d)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
      <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--cds-text-primary, #161616)' }}>No Users Found</h3>
      <p className="mb-4 text-sm sm:text-base" style={{ color: 'var(--cds-text-secondary, #525252)' }}>
      Users appear here after they log in. Click <strong>"Sync & Refresh"</strong> to add yourself, or invite new team members.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
      <Button
       onClick={async () => {
       setLoading(true);
       try {
        const synced = await dataService.syncCurrentUser();
        if (synced) {
        await loadUsers();
        await loadAuditLogs();
        setStatusMessage('Your profile synced. You can now edit your role.');
        }
       } catch (error: any) {
        console.error('[Settings] Sync error:', error);
        showToast(error?.message || 'Profile sync failed. Please try again.', 'error');
       }
       setLoading(false);
       }}
       leftIcon={<RefreshCw size={14} />}
       className="min-h-[44px]"
      >
       Sync My Profile
      </Button>
      <Button
       onClick={() => setShowInviteModal(true)}
       className="min-h-[44px]"
      >
       Invite Team Member
      </Button>
      </div>
      <p className="text-xs mt-4" style={{ color: 'var(--cds-text-secondary, #525252)' }}>
      To change a user's role: Click the <strong>Edit</strong> (pencil) icon next to their name.
      </p>
     </div>
     </div>
    ) : (
     <>
     {/* Desktop/Tablet Table View */}
     <div className="hidden md:block overflow-x-auto">
      <table className="w-full text-left text-xs lg:text-sm">
      <thead style={{ background: 'var(--cds-layer-02, #f4f4f4)', borderBottom: '1px solid var(--cds-border-subtle, #c6c6c6)' }}>
       <tr>
       <th className="px-4 lg:px-6 py-3 w-12">
        <input
        type="checkbox"
        checked={selectedUserIds.length === users.length && users.length > 0}
        onChange={toggleSelectAll}
        className="w-4 h-4"
        style={{ borderColor: 'var(--cds-border-subtle, #c6c6c6)' }}
        />
       </th>
       <th className="px-4 lg:px-6 py-3 font-semibold" style={{ color: 'var(--cds-text-secondary, #525252)' }}>User</th>
       <th className="px-4 lg:px-6 py-3 font-semibold hidden lg:table-cell" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Email</th>
       <th className="px-4 lg:px-6 py-3 font-semibold" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Role</th>
       <th className="px-4 lg:px-6 py-3 font-semibold" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Status</th>
       <th className="px-4 lg:px-6 py-3 font-semibold text-right" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Actions</th>
       </tr>
      </thead>
      <tbody style={{ borderTop: '1px solid var(--cds-border-subtle, #c6c6c6)' }}>
       {users.map(user => (
       <tr key={user.id} className="group" style={{ borderBottom: '1px solid var(--cds-border-subtle, #c6c6c6)' }}>
        <td className="px-4 lg:px-6 py-4">
        <input
         type="checkbox"
         checked={selectedUserIds.includes(user.id)}
         onChange={() => toggleSelectUser(user.id)}
         className="w-4 h-4"
         style={{ borderColor: 'var(--cds-border-subtle, #c6c6c6)' }}
        />
        </td>
        <td className="px-4 lg:px-6 py-4">
        <div className="flex items-center gap-3">
         <div className="relative flex-shrink-0">
         <div className="w-9 h-9 lg:w-10 lg:h-10 overflow-hidden" style={{ borderRadius: '50%', border: '2px solid var(--cds-layer-01, #ffffff)' }}>
          <img
          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`}
          alt={user.name}
          className="w-full h-full"
          />
         </div>
         <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 lg:w-3 lg:h-3 border-2" style={{ borderRadius: '50%', borderColor: 'var(--cds-layer-01, #ffffff)', background: user.status === 'Active' ? 'var(--cds-support-success, #24a148)' : 'var(--cds-text-disabled, #8d8d8d)' }}></div>
         </div>
         <div className="min-w-0">
         <p className="font-semibold truncate" style={{ color: 'var(--cds-text-primary, #161616)' }}>{user.name}</p>
         {/* Email shown under name on tablet, hidden on desktop (shown in separate column) */}
         <p className="text-xs truncate lg:hidden" style={{ color: 'var(--cds-text-secondary, #525252)' }}>{user.email}</p>
         </div>
        </div>
        </td>
        <td className="px-4 lg:px-6 py-4 hidden lg:table-cell">
        <span className="font-mono text-xs truncate block max-w-[200px]" style={{ color: 'var(--cds-text-secondary, #525252)' }} title={user.email}>{user.email}</span>
        </td>
        <td className="px-4 lg:px-6 py-4">
        <Tag type={user.role === 'Admin' ? 'purple' : user.role === 'Manager' ? 'blue' : user.role === 'Accountant' ? 'green' : 'cyan'} size="sm">
         {user.role}
        </Tag>
        </td>
        <td className="px-4 lg:px-6 py-4">
        <Tag type={user.status === 'Active' ? 'green' : 'warm-gray'} size="sm">
         {user.status}
        </Tag>
        </td>
        <td className="px-4 lg:px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-1 lg:gap-2">
         <Button
          variant="ghost"
          size="sm"
          title="Set password"
          leftIcon={<KeyRound size={14} />}
          onClick={() => openSetPasswordModal(user)}
         />
         <Button
          variant="ghost"
          size="sm"
          title={user.status === 'Active' ? 'Deactivate user' : 'Activate user'}
          leftIcon={user.status === 'Active' ? <Minus size={14} /> : <Plus size={14} />}
          onClick={() => handleToggleUserStatus(user)}
         />
         <Button
          variant="ghost"
          size="sm"
          title="Edit user role"
          leftIcon={<Pencil size={14} />}
          onClick={() => openEditModal(user)}
         />
         <Button
          variant="danger"
          size="sm"
          title="Delete user"
          leftIcon={<Trash2 size={14} />}
          onClick={() => openDeleteDialog(user)}
         />
        </div>
        </td>
       </tr>
       ))}
      </tbody>
      </table>
     </div>

     {/* Mobile Card View */}
     <div className="md:hidden">
      {/* Select All Header for Mobile */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'var(--cds-layer-02, #f4f4f4)' }}>
      <label className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--cds-text-secondary, #525252)' }}>
       <input
       type="checkbox"
       checked={selectedUserIds.length === users.length && users.length > 0}
       onChange={toggleSelectAll}
       className="w-4 h-4 flex-shrink-0"
       style={{ borderColor: 'var(--cds-border-subtle, #c6c6c6)' }}
       />
       Select All
      </label>
      <span className="text-xs" style={{ color: 'var(--cds-text-secondary, #525252)' }}>{users.length} user{users.length !== 1 ? 's' : ''}</span>
      </div>
      
      <div style={{ borderTop: '1px solid var(--cds-border-subtle, #c6c6c6)' }}>
      {users.map(user => (
       <div key={user.id} className="p-4" style={{ borderBottom: '1px solid var(--cds-border-subtle, #c6c6c6)' }}>
       {/* Top Row: Checkbox, Avatar, Name/Email, Actions */}
       <div className="flex items-center gap-3">
        <input
        type="checkbox"
        checked={selectedUserIds.includes(user.id)}
        onChange={() => toggleSelectUser(user.id)}
        className="w-4 h-4 flex-shrink-0"
        style={{ borderColor: 'var(--cds-border-subtle, #c6c6c6)' }}
        />
        <div className="relative flex-shrink-0">
        <div className="w-10 h-10 overflow-hidden" style={{ borderRadius: '50%', border: '2px solid var(--cds-layer-01, #ffffff)' }}>
         <img
         src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`}
         alt={user.name}
         className="w-full h-full"
         />
        </div>
        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 border-2" style={{ borderRadius: '50%', borderColor: 'var(--cds-layer-01, #ffffff)', background: user.status === 'Active' ? 'var(--cds-support-success, #24a148)' : 'var(--cds-text-disabled, #8d8d8d)' }}></div>
        </div>
        <div className="flex-1 min-w-0">
        <p className="font-semibold truncate" style={{ color: 'var(--cds-text-primary, #161616)' }}>{user.name}</p>
        <p className="text-xs truncate" style={{ color: 'var(--cds-text-secondary, #525252)' }}>{user.email}</p>
        </div>
        
        {/* Actions Dropdown Area */}
        <div className="flex items-center gap-1 flex-shrink-0">
        <Button
         variant="ghost"
         size="sm"
         title="Set password"
         leftIcon={<KeyRound size={14} />}
         onClick={() => openSetPasswordModal(user)}
        />
        <Button
         variant="ghost"
         size="sm"
         title="Edit user role"
         leftIcon={<Pencil size={14} />}
         onClick={() => openEditModal(user)}
        />
        <Button
         variant="danger"
         size="sm"
         title="Delete user"
         leftIcon={<Trash2 size={14} />}
         onClick={() => openDeleteDialog(user)}
        />
        </div>
       </div>
       
       {/* Bottom Row: Role, Status, and Secondary Actions */}
       <div className="flex items-center justify-between mt-3 pl-7">
        <div className="flex items-center gap-2">
        <Tag type={user.role === 'Admin' ? 'purple' : user.role === 'Manager' ? 'blue' : user.role === 'Accountant' ? 'green' : 'cyan'} size="sm">
         {user.role}
        </Tag>
        <Tag type={user.status === 'Active' ? 'green' : 'warm-gray'} size="sm">
         {user.status}
        </Tag>
        </div>
        <div className="flex items-center gap-1">
        <Button
         variant="ghost"
         size="sm"
         title="Set password"
         leftIcon={<KeyRound size={14} />}
         onClick={() => openSetPasswordModal(user)}
        />
        <Button
         variant="ghost"
         size="sm"
         title={user.status === 'Active' ? 'Deactivate user' : 'Activate user'}
         leftIcon={user.status === 'Active' ? <Minus size={14} /> : <Plus size={14} />}
         onClick={() => handleToggleUserStatus(user)}
        />
        </div>
       </div>
       </div>
      ))}
      </div>
     </div>
     </>
    )}
    </div>
   </div>
   )}

   {activeTab === 'forensics' && (
   <ForensicLogPanel
    logs={auditLogs}
    loading={logsLoading}
    onRefresh={loadAuditLogs}
   />
   )}

   {activeTab === 'requests' && (
   <div className="space-y-6">
    <div className="flex justify-between items-center">
    <div>
     <h2 className="text-2xl font-black" style={{ color: 'var(--cds-text-primary, #161616)' }}>Registration Requests</h2>
     <p className="font-medium" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Review and approve account requests from users</p>
    </div>
    </div>

    {saveStatus && (
    <InlineNotification kind="info" title="Info" subtitle={saveStatus} hideCloseButton />
    )}

    <div className="overflow-hidden" style={{ background: 'var(--cds-layer-01, #ffffff)', border: '1px solid var(--cds-border-subtle, #c6c6c6)' }}>
    <table className="w-full">
     <thead style={{ background: 'var(--cds-layer-02, #f4f4f4)', borderBottom: '1px solid var(--cds-border-subtle, #c6c6c6)' }}>
     <tr>
      <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Name</th>
      <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Email</th>
      <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Role</th>
      <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Status</th>
      <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Requested</th>
      <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-widest" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Actions</th>
     </tr>
     </thead>
     <tbody style={{ borderTop: '1px solid var(--cds-border-subtle, #c6c6c6)' }}>
     {registrationRequests.length === 0 ? (
      <tr>
      <td colSpan={6} className="px-6 py-12 text-center font-medium" style={{ color: 'var(--cds-text-disabled, #8d8d8d)' }}>
       No registration requests yet. Users can request access from the sign-in page.
      </td>
      </tr>
     ) : (
      registrationRequests.map((request) => (
      <tr key={request.id} style={{ borderBottom: '1px solid var(--cds-border-subtle, #c6c6c6)' }}>
       <td className="px-6 py-4 font-semibold" style={{ color: 'var(--cds-text-primary, #161616)' }}>{request.name}</td>
       <td className="px-6 py-4 font-mono text-sm" style={{ color: 'var(--cds-text-secondary, #525252)' }}>{request.email}</td>
       <td className="px-6 py-4">
       <Tag type={request.role === 'Manager' ? 'blue' : request.role === 'Accountant' ? 'warm-gray' : 'cyan'} size="sm">
        {request.role}
       </Tag>
       </td>
       <td className="px-6 py-4">
       <Tag type={request.status === 'Pending' ? 'warm-gray' : request.status === 'Approved' ? 'green' : 'red'} size="sm">
        {request.status}
       </Tag>
       </td>
       <td className="px-6 py-4 text-sm" style={{ color: 'var(--cds-text-secondary, #525252)' }}>
       {new Date(request.requested_at).toLocaleDateString()}
       </td>
       <td className="px-6 py-4 text-right">
       {request.status === 'Pending' && (
        <div className="flex items-center justify-end gap-2">
        <Button
         variant="primary"
         size="sm"
         onClick={() => handleApproveRequest(request.id)}
        >
         Approve
        </Button>
        <Button
         variant="danger"
         size="sm"
         onClick={() => handleRejectRequest(request.id)}
        >
         Reject
        </Button>
        </div>
       )}
       {request.status !== 'Pending' && (
        <span className="text-xs font-medium" style={{ color: 'var(--cds-text-disabled, #8d8d8d)' }}>
        Reviewed {request.reviewed_at ? new Date(request.reviewed_at).toLocaleDateString() : ''}
        </span>
       )}
       </td>
      </tr>
      ))
     )}
     </tbody>
    </table>
    </div>
   </div>
   )}

   {activeTab === 'invites' && (
   <div className="space-y-6">
    <div className="flex justify-between items-center">
    <div>
     <h2 className="text-2xl font-black" style={{ color: 'var(--cds-text-primary, #161616)' }}>User Invitations</h2>
     <p className="font-medium" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Send email invitations to new team members</p>
    </div>
    <Button
     onClick={() => setShowInviteModal(true)}
     leftIcon={<Mail size={14} />}
    >
     Send Invitation
    </Button>
    </div>

    {saveStatus && (
    <InlineNotification kind="info" title="Info" subtitle={saveStatus} hideCloseButton />
    )}

    <div className="overflow-hidden" style={{ background: 'var(--cds-layer-01, #ffffff)', border: '1px solid var(--cds-border-subtle, #c6c6c6)' }}>
    <table className="w-full">
     <thead style={{ background: 'var(--cds-layer-02, #f4f4f4)', borderBottom: '1px solid var(--cds-border-subtle, #c6c6c6)' }}>
     <tr>
      <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Name</th>
      <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Email</th>
      <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Role</th>
      <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Status</th>
      <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Expires</th>
      <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Invited By</th>
      <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-widest" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Actions</th>
     </tr>
     </thead>
     <tbody style={{ borderTop: '1px solid var(--cds-border-subtle, #c6c6c6)' }}>
     {invites.length === 0 ? (
      <tr>
      <td colSpan={7} className="px-6 py-12 text-center font-medium" style={{ color: 'var(--cds-text-disabled, #8d8d8d)' }}>
       No pending invitations. Click "Send Invitation" to invite team members.
      </td>
      </tr>
     ) : (
      invites.map((invite) => (
      <tr key={invite.id} style={{ borderBottom: '1px solid var(--cds-border-subtle, #c6c6c6)' }}>
       <td className="px-6 py-4 font-semibold" style={{ color: 'var(--cds-text-primary, #161616)' }}>{invite.name}</td>
       <td className="px-6 py-4 font-mono text-sm" style={{ color: 'var(--cds-text-secondary, #525252)' }}>{invite.email}</td>
       <td className="px-6 py-4">
       <Tag type={invite.role === 'Admin' ? 'purple' : invite.role === 'Manager' ? 'blue' : invite.role === 'Accountant' ? 'warm-gray' : 'cyan'} size="sm">
        {invite.role}
       </Tag>
       </td>
       <td className="px-6 py-4">
       <Tag type={invite.status === 'Pending' ? 'warm-gray' : invite.status === 'Accepted' ? 'green' : 'red'} size="sm">
        {invite.status}
       </Tag>
       </td>
       <td className="px-6 py-4 text-sm" style={{ color: 'var(--cds-text-secondary, #525252)' }}>
       {new Date(invite.expiresAt).toLocaleDateString()}
       </td>
       <td className="px-6 py-4 text-sm" style={{ color: 'var(--cds-text-secondary, #525252)' }}>{invite.invitedBy}</td>
       <td className="px-6 py-4 text-right">
       <div className="flex items-center justify-end gap-2">
        {invite.status === 'Pending' && (
        <>
         <Button
          variant="ghost"
          size="sm"
          title="Copy invite link"
          leftIcon={<Copy size={14} />}
          onClick={() => handleCopyInviteLink(invite.inviteToken)}
         />
         <Button
          variant="ghost"
          size="sm"
          title="Resend invitation"
          leftIcon={<RefreshCw size={14} />}
          onClick={() => handleResendInvite(invite.id)}
         />
         <Button
          variant="danger"
          size="sm"
          title="Cancel invitation"
          leftIcon={<Trash2 size={14} />}
          onClick={() => handleDeleteInvite(invite.id)}
         />
        </>
        )}
       </div>
       </td>
      </tr>
      ))
     )}
     </tbody>
    </table>
    </div>
   </div>
   )}
  </div>
  </div>

  {/* User Creation Modal */}
  {showUserModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
   <div className="absolute inset-0 backdrop-blur-sm cursor-pointer" style={{ background: 'rgba(22, 22, 22, 0.4)' }} onClick={() => setShowUserModal(false)}></div>
   <div className="relative p-8 max-w-md w-full max-h-[90vh] overflow-y-auto" style={{ background: 'var(--cds-layer-01, #ffffff)', boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)' }}>
   <h3 className="text-2xl font-black mb-6" style={{ color: 'var(--cds-text-primary, #161616)' }}>Add New User</h3>
   <form onSubmit={handleCreateUser} className="space-y-4">
    <div className="space-y-1">
    <label className="text-sm font-semibold" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Full Name</label>
    <input
     required
     type="text"
     value={userForm.name}
     onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
     placeholder="John Doe"
     className="w-full px-4 py-3 outline-none"
     style={{ border: '1px solid var(--cds-border-subtle, #c6c6c6)' }}
    />
    </div>
    <div className="space-y-1">
    <label className="text-sm font-semibold" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Email Address</label>
    <input
     required
     type="email"
     value={userForm.email}
     onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
     placeholder="john@affinity.com"
     className="w-full px-4 py-3 outline-none"
     style={{ border: '1px solid var(--cds-border-subtle, #c6c6c6)' }}
    />
    </div>
    <div className="space-y-1">
    <label className="text-sm font-semibold" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Password</label>
    <input
     required
     type="password"
     value={userForm.password}
     onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
     placeholder="Min 8 characters"
     minLength={8}
     className="w-full px-4 py-3 outline-none"
     style={{ border: '1px solid var(--cds-border-subtle, #c6c6c6)' }}
    />
    <p className="text-xs" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Must be at least 8 characters</p>
    </div>
    <div className="space-y-1">
    <label className="text-sm font-semibold" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Role</label>
    <div className="space-y-2">
     <div
     onClick={() => setUserForm({ ...userForm, role: 'Admin' })}
     className="p-4 cursor-pointer transition-all"
     style={{ border: `2px solid ${userForm.role === 'Admin' ? 'var(--cds-tag-color-purple, #8a3ffc)' : 'var(--cds-border-subtle, #c6c6c6)'}`, background: userForm.role === 'Admin' ? 'var(--cds-tag-background-purple, #f6f2ff)' : 'transparent' }}
     >
     <div className="flex items-center justify-between mb-1">
      <span className="font-bold" style={{ color: 'var(--cds-text-primary, #161616)' }}>Administrator</span>
      <div className="w-5 h-5 flex items-center justify-center" style={{ borderRadius: '50%', border: `2px solid ${userForm.role === 'Admin' ? 'var(--cds-tag-color-purple, #8a3ffc)' : 'var(--cds-border-subtle, #c6c6c6)'}`, background: userForm.role === 'Admin' ? 'var(--cds-tag-color-purple, #8a3ffc)' : 'transparent' }}>
      {userForm.role === 'Admin' && (
       <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
       <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
       </svg>
      )}
      </div>
     </div>
     <p className="text-xs" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Full system access, user management, and all settings</p>
     </div>

     <div
     onClick={() => setUserForm({ ...userForm, role: 'Manager' })}
     className="p-4 cursor-pointer transition-all"
     style={{ border: `2px solid ${userForm.role === 'Manager' ? 'var(--cds-interactive, #0f62fe)' : 'var(--cds-border-subtle, #c6c6c6)'}`, background: userForm.role === 'Manager' ? 'var(--cds-layer-selected-01, #e5f6ff)' : 'transparent' }}
     >
     <div className="flex items-center justify-between mb-1">
      <span className="font-bold" style={{ color: 'var(--cds-text-primary, #161616)' }}>Manager</span>
      <div className="w-5 h-5 flex items-center justify-center" style={{ borderRadius: '50%', border: `2px solid ${userForm.role === 'Manager' ? 'var(--cds-interactive, #0f62fe)' : 'var(--cds-border-subtle, #c6c6c6)'}`, background: userForm.role === 'Manager' ? 'var(--cds-interactive, #0f62fe)' : 'transparent' }}>
      {userForm.role === 'Manager' && (
       <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
       <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
       </svg>
      )}
      </div>
     </div>
     <p className="text-xs" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Dashboard, reports, vehicles, and operational data</p>
     </div>

     <div
     onClick={() => setUserForm({ ...userForm, role: 'Accountant' })}
     className="p-4 cursor-pointer transition-all"
     style={{ border: `2px solid ${userForm.role === 'Accountant' ? 'var(--cds-support-success, #24a148)' : 'var(--cds-border-subtle, #c6c6c6)'}`, background: userForm.role === 'Accountant' ? 'var(--cds-tag-background-green, #defbe6)' : 'transparent' }}
     >
     <div className="flex items-center justify-between mb-1">
      <span className="font-bold" style={{ color: 'var(--cds-text-primary, #161616)' }}>Accountant</span>
      <div className="w-5 h-5 flex items-center justify-center" style={{ borderRadius: '50%', border: `2px solid ${userForm.role === 'Accountant' ? 'var(--cds-support-success, #24a148)' : 'var(--cds-border-subtle, #c6c6c6)'}`, background: userForm.role === 'Accountant' ? 'var(--cds-support-success, #24a148)' : 'transparent' }}>
      {userForm.role === 'Accountant' && (
       <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
       <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
       </svg>
      )}
      </div>
     </div>
     <p className="text-xs" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Financial data, expenses, quotes, invoices, and payments</p>
     </div>

     <div
     onClick={() => setUserForm({ ...userForm, role: 'Driver' })}
     className="p-4 cursor-pointer transition-all"
     style={{ border: `2px solid ${userForm.role === 'Driver' ? 'var(--cds-tag-color-cyan, #1192e8)' : 'var(--cds-border-subtle, #c6c6c6)'}`, background: userForm.role === 'Driver' ? 'var(--cds-tag-background-cyan, #e5f6ff)' : 'transparent' }}
     >
     <div className="flex items-center justify-between mb-1">
      <span className="font-bold" style={{ color: 'var(--cds-text-primary, #161616)' }}>Driver</span>
      <div className="w-5 h-5 flex items-center justify-center" style={{ borderRadius: '50%', border: `2px solid ${userForm.role === 'Driver' ? 'var(--cds-tag-color-cyan, #1192e8)' : 'var(--cds-border-subtle, #c6c6c6)'}`, background: userForm.role === 'Driver' ? 'var(--cds-tag-color-cyan, #1192e8)' : 'transparent' }}>
      {userForm.role === 'Driver' && (
       <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
       <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
       </svg>
      )}
      </div>
     </div>
     <p className="text-xs" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Driver portal, document uploads, and trip logs</p>
     </div>
    </div>
    </div>
    <div className="flex gap-3 pt-4">
    <Button
     variant="secondary"
     type="button"
     style={{ flex: 1 }}
     onClick={() => {
     setShowUserModal(false);
     setUserForm({ name: '', email: '', password: '', role: 'Driver', status: 'Active' });
     }}
    >
     Cancel
    </Button>
    <Button
     variant="primary"
     type="submit"
     style={{ flex: 1 }}
    >
     Create User
    </Button>
    </div>
   </form>
   </div>
  </div>
  )}

  {/* Set Password Modal */}
  {showSetPasswordModal && userToSetPassword && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
   <div className="absolute inset-0 backdrop-blur-sm cursor-pointer" style={{ background: 'rgba(22, 22, 22, 0.4)' }} onClick={() => setShowSetPasswordModal(false)}></div>
   <div className="relative p-8 max-w-md w-full max-h-[90vh] overflow-y-auto" style={{ background: 'var(--cds-layer-01, #ffffff)', boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)' }}>
   <div className="flex items-center gap-3 mb-6">
    <div className="w-12 h-12 flex items-center justify-center" style={{ borderRadius: '50%', background: 'var(--cds-layer-selected-01, #e5f6ff)' }}>
    <svg className="w-6 h-6" style={{ color: 'var(--cds-interactive, #0f62fe)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    </svg>
    </div>
    <div>
    <h3 className="text-2xl font-black" style={{ color: 'var(--cds-text-primary, #161616)' }}>Set Password</h3>
    <p className="text-sm" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Set a new password for {userToSetPassword.name}</p>
    </div>
   </div>
   <form onSubmit={handleSetPassword} className="space-y-4">
    <div className="space-y-1">
    <label className="text-sm font-semibold" style={{ color: 'var(--cds-text-secondary, #525252)' }}>New Password</label>
    <input
     required
     type="password"
     value={passwordForm.newPassword}
     onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
     placeholder="Min 8 characters"
     minLength={8}
     className="w-full px-4 py-3 outline-none"
     style={{ border: '1px solid var(--cds-border-subtle, #c6c6c6)' }}
    />
    </div>
    <div className="space-y-1">
    <label className="text-sm font-semibold" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Confirm Password</label>
    <input
     required
     type="password"
     value={passwordForm.confirmPassword}
     onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
     placeholder="Re-enter password"
     minLength={8}
     className="w-full px-4 py-3 outline-none"
     style={{ border: '1px solid var(--cds-border-subtle, #c6c6c6)' }}
    />
    </div>
    <div className="p-4" style={{ background: 'var(--cds-tag-background-warm-gray, #f7f3f2)', border: '1px solid var(--cds-tag-border-warm-gray, #e5e0df)' }}>
    <p className="text-xs font-medium" style={{ color: 'var(--cds-text-secondary, #525252)' }}>
     ⚠️ This will immediately change the user's password. They will need to use the new password on their next login.
    </p>
    </div>
    <div className="flex gap-3 pt-4">
    <button
     type="button"
     onClick={() => {
     setShowSetPasswordModal(false);
     setUserToSetPassword(null);
     setPasswordForm({ newPassword: '', confirmPassword: '' });
     }}
     className="flex-1 px-4 py-3 font-bold text-sm"
     style={{ color: 'var(--cds-text-secondary, #525252)', border: '1px solid var(--cds-border-subtle, #c6c6c6)' }}
    >
     Cancel
    </button>
    <button
     type="submit"
     className="flex-1 px-4 py-3 font-bold text-sm text-white"
     style={{ background: 'var(--cds-interactive, #0f62fe)' }}
    >
     Set Password
    </button>
    </div>
   </form>
   </div>
  </div>
  )}

  {/* Edit User Modal */}
  {showEditModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
   <div className="absolute inset-0 backdrop-blur-sm cursor-pointer" style={{ background: 'rgba(22, 22, 22, 0.4)' }} onClick={() => setShowEditModal(false)}></div>
   <div className="relative p-8 max-w-md w-full max-h-[90vh] overflow-y-auto" style={{ background: 'var(--cds-layer-01, #ffffff)', boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)' }}>
   <h3 className="text-2xl font-black mb-6" style={{ color: 'var(--cds-text-primary, #161616)' }}>Edit User</h3>
   <form onSubmit={handleEditUser} className="space-y-4">
    <div className="space-y-1">
    <label className="text-sm font-semibold" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Full Name</label>
    <input
     required
     type="text"
     value={editForm.name}
     onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
     placeholder="John Doe"
     className="w-full px-4 py-3 outline-none"
     style={{ border: '1px solid var(--cds-border-subtle, #c6c6c6)' }}
    />
    </div>
    <div className="space-y-1">
    <label className="text-sm font-semibold" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Email Address</label>
    <input
     required
     type="email"
     value={editForm.email}
     onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
     placeholder="john@affinity.com"
     className="w-full px-4 py-3 outline-none"
     style={{ border: '1px solid var(--cds-border-subtle, #c6c6c6)' }}
    />
    </div>
    <div className="space-y-1">
    <label className="text-sm font-semibold" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Role</label>
    <div className="space-y-2">
     <div
     onClick={() => setEditForm({ ...editForm, role: 'Admin' })}
     className="p-3 cursor-pointer transition-all"
     style={{ border: `2px solid ${editForm.role === 'Admin' ? 'var(--cds-tag-color-purple, #8a3ffc)' : 'var(--cds-border-subtle, #c6c6c6)'}`, background: editForm.role === 'Admin' ? 'var(--cds-tag-background-purple, #f6f2ff)' : 'transparent' }}
     >
     <div className="flex items-center justify-between">
      <span className="font-bold text-sm" style={{ color: 'var(--cds-text-primary, #161616)' }}>Administrator</span>
      <div className="w-4 h-4 flex items-center justify-center" style={{ borderRadius: '50%', border: `2px solid ${editForm.role === 'Admin' ? 'var(--cds-tag-color-purple, #8a3ffc)' : 'var(--cds-border-subtle, #c6c6c6)'}`, background: editForm.role === 'Admin' ? 'var(--cds-tag-color-purple, #8a3ffc)' : 'transparent' }}>
      {editForm.role === 'Admin' && (
       <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
       <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
       </svg>
      )}
      </div>
     </div>
     </div>

     <div
     onClick={() => setEditForm({ ...editForm, role: 'Manager' })}
     className="p-3 cursor-pointer transition-all"
     style={{ border: `2px solid ${editForm.role === 'Manager' ? 'var(--cds-interactive, #0f62fe)' : 'var(--cds-border-subtle, #c6c6c6)'}`, background: editForm.role === 'Manager' ? 'var(--cds-layer-selected-01, #e5f6ff)' : 'transparent' }}
     >
     <div className="flex items-center justify-between">
      <span className="font-bold text-sm" style={{ color: 'var(--cds-text-primary, #161616)' }}>Manager</span>
      <div className="w-4 h-4 flex items-center justify-center" style={{ borderRadius: '50%', border: `2px solid ${editForm.role === 'Manager' ? 'var(--cds-interactive, #0f62fe)' : 'var(--cds-border-subtle, #c6c6c6)'}`, background: editForm.role === 'Manager' ? 'var(--cds-interactive, #0f62fe)' : 'transparent' }}>
      {editForm.role === 'Manager' && (
       <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
       <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
       </svg>
      )}
      </div>
     </div>
     </div>

     <div
     onClick={() => setEditForm({ ...editForm, role: 'Accountant' })}
     className="p-3 cursor-pointer transition-all"
     style={{ border: `2px solid ${editForm.role === 'Accountant' ? 'var(--cds-support-success, #24a148)' : 'var(--cds-border-subtle, #c6c6c6)'}`, background: editForm.role === 'Accountant' ? 'var(--cds-tag-background-green, #defbe6)' : 'transparent' }}
     >
     <div className="flex items-center justify-between">
      <span className="font-bold text-sm" style={{ color: 'var(--cds-text-primary, #161616)' }}>Accountant</span>
      <div className="w-4 h-4 flex items-center justify-center" style={{ borderRadius: '50%', border: `2px solid ${editForm.role === 'Accountant' ? 'var(--cds-support-success, #24a148)' : 'var(--cds-border-subtle, #c6c6c6)'}`, background: editForm.role === 'Accountant' ? 'var(--cds-support-success, #24a148)' : 'transparent' }}>
      {editForm.role === 'Accountant' && (
       <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
       <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
       </svg>
      )}
      </div>
     </div>
     </div>

     <div
     onClick={() => setEditForm({ ...editForm, role: 'Driver' })}
     className="p-3 cursor-pointer transition-all"
     style={{ border: `2px solid ${editForm.role === 'Driver' ? 'var(--cds-tag-color-cyan, #1192e8)' : 'var(--cds-border-subtle, #c6c6c6)'}`, background: editForm.role === 'Driver' ? 'var(--cds-tag-background-cyan, #e5f6ff)' : 'transparent' }}
     >
     <div className="flex items-center justify-between">
      <span className="font-bold text-sm" style={{ color: 'var(--cds-text-primary, #161616)' }}>Driver</span>
      <div className="w-4 h-4 flex items-center justify-center" style={{ borderRadius: '50%', border: `2px solid ${editForm.role === 'Driver' ? 'var(--cds-tag-color-cyan, #1192e8)' : 'var(--cds-border-subtle, #c6c6c6)'}`, background: editForm.role === 'Driver' ? 'var(--cds-tag-color-cyan, #1192e8)' : 'transparent' }}>
      {editForm.role === 'Driver' && (
       <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
       <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
       </svg>
      )}
      </div>
     </div>
     </div>
    </div>
    </div>
    <div className="space-y-1">
    <label className="text-sm font-semibold" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Status</label>
    <select
     required
     value={editForm.status}
     onChange={(e) => setEditForm({ ...editForm, status: e.target.value as ('Active' | 'Inactive') })}
     className="w-full px-4 py-3 outline-none"
     style={{ border: '1px solid var(--cds-border-subtle, #c6c6c6)' }}
    >
     <option value="Active">Active</option>
     <option value="Inactive">Inactive</option>
    </select>
    </div>
    <div className="flex gap-3 pt-4">
    <button
     type="button"
     onClick={() => setShowEditModal(false)}
     className="flex-1 px-4 py-3 font-bold text-sm"
     style={{ color: 'var(--cds-text-secondary, #525252)', border: '1px solid var(--cds-border-subtle, #c6c6c6)' }}
    >
     Cancel
    </button>
    <button
     type="submit"
     className="flex-1 px-4 py-3 font-bold text-sm text-white"
     style={{ background: 'var(--cds-interactive, #0f62fe)' }}
    >
     Update User
    </button>
    </div>
   </form>
   </div>
  </div>
  )}

  {/* Invite Modal */}
  {showInviteModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
   <div className="absolute inset-0 backdrop-blur-sm cursor-pointer" style={{ background: 'rgba(22, 22, 22, 0.4)' }} onClick={() => setShowInviteModal(false)}></div>
   <div className="relative p-8 max-w-md w-full max-h-[90vh] overflow-y-auto" style={{ background: 'var(--cds-layer-01, #ffffff)', boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)' }}>
   <div className="flex items-center gap-3 mb-6">
    <div className="w-12 h-12 flex items-center justify-center" style={{ borderRadius: '50%', background: 'var(--cds-tag-background-green, #defbe6)' }}>
    <svg className="w-6 h-6" style={{ color: 'var(--cds-support-success, #24a148)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
    </div>
    <div>
    <h3 className="text-2xl font-black" style={{ color: 'var(--cds-text-primary, #161616)' }}>Send Invitation</h3>
    <p className="text-sm" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Invite a new team member via email</p>
    </div>
   </div>
   <form onSubmit={handleSendInvite} className="space-y-4">
    <div className="space-y-1">
    <label className="text-sm font-semibold" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Full Name</label>
    <input
     required
     type="text"
     value={inviteForm.name}
     onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
     placeholder="John Doe"
     className="w-full px-4 py-3 outline-none"
     style={{ border: '1px solid var(--cds-border-subtle, #c6c6c6)' }}
    />
    </div>
    <div className="space-y-1">
    <label className="text-sm font-semibold" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Email Address</label>
    <input
     required
     type="email"
     value={inviteForm.email}
     onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
     placeholder="john@company.com"
     className="w-full px-4 py-3 outline-none"
     style={{ border: '1px solid var(--cds-border-subtle, #c6c6c6)' }}
    />
    </div>
    <div className="space-y-1">
    <label className="text-sm font-semibold" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Role</label>
    <select
     required
     value={inviteForm.role}
     onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as UserRole })}
     className="w-full px-4 py-3 outline-none"
     style={{ border: '1px solid var(--cds-border-subtle, #c6c6c6)' }}
    >
     <option value="Driver">Driver</option>
     <option value="Manager">Manager</option>
     <option value="Accountant">Accountant</option>
     <option value="Admin">Admin</option>
    </select>
    </div>
    <div className="p-4" style={{ background: 'var(--cds-layer-selected-01, #e5f6ff)', border: '1px solid var(--cds-border-subtle, #c6c6c6)' }}>
    <p className="text-xs font-medium" style={{ color: 'var(--cds-text-secondary, #525252)' }}>
     📧 An email invitation will be sent with a secure signup link. The invitation expires in 7 days.
    </p>
    </div>
    <div className="flex gap-3 pt-4">
    <button
     type="button"
     onClick={() => setShowInviteModal(false)}
     className="flex-1 px-4 py-3 font-bold text-sm"
     style={{ color: 'var(--cds-text-secondary, #525252)', border: '1px solid var(--cds-border-subtle, #c6c6c6)' }}
    >
     Cancel
    </button>
    <button
     type="submit"
     className="flex-1 px-4 py-3 font-bold text-sm text-white"
     style={{ background: 'var(--cds-support-success, #24a148)' }}
    >
     Send Invite
    </button>
    </div>
   </form>
   </div>
  </div>
  )}

  {/* Delete Confirmation Dialog */}
  {showDeleteDialog && userToDelete && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
   <div className="absolute inset-0 backdrop-blur-sm cursor-pointer" style={{ background: 'rgba(22, 22, 22, 0.4)' }} onClick={() => setShowDeleteDialog(false)}></div>
   <div className="relative p-8 max-w-md w-full max-h-[90vh] overflow-y-auto" style={{ background: 'var(--cds-layer-01, #ffffff)', boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)' }}>
   <div className="flex items-center gap-4 mb-4">
    <div className="w-12 h-12 flex items-center justify-center" style={{ borderRadius: '50%', background: 'var(--cds-tag-background-red, #fff0f0)' }}>
    <svg className="w-6 h-6" style={{ color: 'var(--cds-support-error, #da1e28)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
    </div>
    <div>
    <h3 className="text-xl font-black" style={{ color: 'var(--cds-text-primary, #161616)' }}>Delete User</h3>
    <p className="text-sm" style={{ color: 'var(--cds-text-secondary, #525252)' }}>This action cannot be undone</p>
    </div>
   </div>
   <div className="p-4 mb-6" style={{ background: 'var(--cds-layer-02, #f4f4f4)' }}>
    <p className="text-sm" style={{ color: 'var(--cds-text-secondary, #525252)' }}>Are you sure you want to delete <span className="font-bold" style={{ color: 'var(--cds-text-primary, #161616)' }}>{userToDelete.name}</span>?</p>
    <p className="text-xs mt-2" style={{ color: 'var(--cds-text-secondary, #525252)' }}>{userToDelete.email}</p>
   </div>
   <div className="flex gap-3">
    <button
    onClick={() => setShowDeleteDialog(false)}
    className="flex-1 px-4 py-3 font-bold text-sm"
    style={{ color: 'var(--cds-text-secondary, #525252)', border: '1px solid var(--cds-border-subtle, #c6c6c6)' }}
    >
    Cancel
    </button>
    <button
    onClick={handleDeleteUser}
    className="flex-1 px-4 py-3 font-bold text-sm text-white"
    style={{ background: 'var(--cds-support-error, #da1e28)' }}
    >
    Delete User
    </button>
   </div>
   </div>
  </div>
  )}
 </div>
 );
};
