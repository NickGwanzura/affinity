import React, { useEffect, useState } from 'react';
import { ZodError } from 'zod';
import { Button, Tag, Tile, InlineNotification } from '../ui';
import { RefreshCw, Plus, KeyRound, Pencil, Trash2, Minus } from 'lucide-react';
import { AppUser, UserRole } from '../../types';
import { dataService } from '../../services/dataService';
import { authService } from '../../services/authService';
import { useToast } from '../Toast';
import {
  setPasswordFormSchema,
  userCreateFormSchema,
  userEditFormSchema,
  getFirstValidationMessage,
} from '../../utils/clientValidation';

interface UsersTabProps {
  onSwitchToInvites?: () => void;
}

export const UsersTab: React.FC<UsersTabProps> = ({ onSwitchToInvites }) => {
  const { showToast } = useToast();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<string>('');

  // User management state
  const [showUserModal, setShowUserModal] = useState(false);
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
    status: 'Active' as const,
  });
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    role: 'Driver' as UserRole,
    status: 'Active' as 'Active' | 'Inactive',
  });
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [bulkTargetStatus, setBulkTargetStatus] = useState<'Active' | 'Inactive' | null>(null);

  const setStatusMessage = (
    message: string,
    toastType: Parameters<typeof showToast>[1] = 'success'
  ) => {
    setSaveStatus(message);
    showToast(message, toastType);
    window.setTimeout(() => setSaveStatus(''), 4000);
  };

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

  useEffect(() => {
    (async () => {
      try {
        await loadUsers();
      } catch (userError: any) {
        console.error('[Settings] loadUsers:', userError.message);
      }
      setLoading(false);
    })();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      userCreateFormSchema.parse(userForm);
      const newUser = await authService.createUser({
        name: userForm.name,
        email: userForm.email,
        password: userForm.password,
        role: userForm.role,
      });
      setUsers([...users, newUser]);
      setShowUserModal(false);
      setUserForm({ name: '', email: '', password: '', role: 'Driver', status: 'Active' });
      setStatusMessage('User created successfully.');
    } catch (error: any) {
      console.error('Error creating user:', error);
      const message =
        error instanceof ZodError
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
      const message =
        error instanceof ZodError
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
      status: user.status,
    });
    setShowEditModal(true);
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToEdit) return;
    try {
      userEditFormSchema.parse(editForm);
      const updatedUser = await dataService.updateUser(userToEdit.id, editForm);
      setUsers(users.map(u => (u.id === userToEdit.id ? updatedUser : u)));
      setShowEditModal(false);
      setUserToEdit(null);
      const roleChanged = userToEdit.role !== editForm.role;
      const statusMsg = roleChanged
        ? `User updated! Role changed from ${userToEdit.role} to ${editForm.role}. User will see new role on next login.`
        : 'User updated successfully!';
      setStatusMessage(statusMsg);
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

  const handleToggleUserStatus = async (user: AppUser) => {
    const nextStatus: 'Active' | 'Inactive' = user.status === 'Active' ? 'Inactive' : 'Active';
    try {
      setUsers(prev => prev.map(u => (u.id === user.id ? { ...u, status: nextStatus } : u)));
      const updatedUser = await dataService.updateUser(user.id, { status: nextStatus });
      setUsers(prev => prev.map(u => (u.id === user.id ? updatedUser : u)));
      setStatusMessage(
        `User ${nextStatus === 'Active' ? 'activated' : 'deactivated'} successfully!`
      );
    } catch (error: any) {
      console.error('Error toggling user status:', error);
      setUsers(prev => prev.map(u => (u.id === user.id ? { ...u, status: user.status } : u)));
      showToast('Failed to update status. Please try again.', 'error');
    }
  };

  const toggleSelectUser = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
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
      setUsers(prev => prev.map(u => (ids.includes(u.id) ? { ...u, status } : u)));
      const updates = ids.map(async id => {
        try {
          return await dataService.updateUser(id, { status });
        } catch (e) {
          return null;
        }
      });
      const results = await Promise.all(updates);
      const failedIds = ids.filter((id, idx) => results[idx] === null);
      const successfulUsers = results.filter((u): u is AppUser => !!u);
      setUsers(prev =>
        prev.map(u => {
          const updated = successfulUsers.find(su => su.id === u.id);
          return updated ? updated : u;
        })
      );
      if (failedIds.length) {
        setUsers(prev =>
          prev.map(u =>
            failedIds.includes(u.id)
              ? { ...u, status: u.status === 'Active' ? 'Inactive' : 'Active' }
              : u
          )
        );
        showToast(
          `Failed to update ${failedIds.length} user(s). Changes were reverted for them.`,
          'warning'
        );
      }
      setStatusMessage(`Updated ${successfulUsers.length} user(s) to ${status}.`);
      setSelectedUserIds([]);
    } finally {
      setIsBulkUpdating(false);
    }
  };

  return (
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
            <svg
              className="w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0"
              style={{ color: 'var(--cds-interactive, #D97706)' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          </div>
          <p
            className="text-2xl sm:text-2xl font-black"
            style={{ color: 'var(--cds-text-primary, #18181b)' }}
          >
            {users.length}
          </p>
          <p
            className="text-xs sm:text-xs font-bold uppercase tracking-wider mt-1"
            style={{ color: 'var(--cds-text-secondary, #52525b)' }}
          >
            Total Users
          </p>
        </Tile>

        <Tile className="min-h-[100px]">
          <div className="flex items-center justify-between mb-2">
            <svg
              className="w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0"
              style={{ color: 'var(--cds-support-success, #10b981)' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p
            className="text-2xl sm:text-2xl font-black"
            style={{ color: 'var(--cds-text-primary, #18181b)' }}
          >
            {users.filter(u => u.status === 'Active').length}
          </p>
          <p
            className="text-xs sm:text-xs font-bold uppercase tracking-wider mt-1"
            style={{ color: 'var(--cds-support-success, #10b981)' }}
          >
            Active Users
          </p>
        </Tile>

        <Tile className="min-h-[100px]">
          <div className="flex items-center justify-between mb-2">
            <svg
              className="w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0"
              style={{ color: 'var(--cds-tag-color-purple, #8a3ffc)' }}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <p
            className="text-2xl sm:text-2xl font-black"
            style={{ color: 'var(--cds-text-primary, #18181b)' }}
          >
            {users.filter(u => u.role === 'Admin').length}
          </p>
          <p
            className="text-xs sm:text-xs font-bold uppercase tracking-wider mt-1"
            style={{ color: 'var(--cds-tag-color-purple, #8a3ffc)' }}
          >
            Administrators
          </p>
        </Tile>

        <Tile className="min-h-[100px]">
          <div className="flex items-center justify-between mb-2">
            <svg
              className="w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0"
              style={{ color: 'var(--cds-tag-color-warm-gray, #a8a29e)' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p
            className="text-2xl sm:text-2xl font-black"
            style={{ color: 'var(--cds-text-primary, #18181b)' }}
          >
            {users.filter(u => u.status === 'Inactive').length}
          </p>
          <p
            className="text-xs sm:text-xs font-bold uppercase tracking-wider mt-1"
            style={{ color: 'var(--cds-text-disabled, #a8a29e)' }}
          >
            Inactive Users
          </p>
        </Tile>
      </div>

      {/* Action Row - Responsive: stacked on mobile, flex on tablet+ */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4">
        <div className="flex-shrink-0">
          <h3
            className="text-base sm:text-lg font-bold"
            style={{ color: 'var(--cds-text-primary, #18181b)' }}
          >
            Team Directory
          </h3>
          <p
            className="text-xs sm:text-sm mt-0.5 sm:mt-1"
            style={{ color: 'var(--cds-text-secondary, #52525b)' }}
          >
            {users.length} user{users.length !== 1 ? 's' : ''} in database
          </p>
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
                  const syncedUser = await dataService.syncCurrentUser();
                  const u = await dataService.getUsers();
                  setUsers(u);
                  setSelectedUserIds([]);
                  setBulkTargetStatus(null);
                  setStatusMessage(
                    `Synced. Found ${u.length} user${u.length !== 1 ? 's' : ''} in the database.${syncedUser ? ' Your profile is synced.' : ''}`
                  );
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
              onClick={() => {
                setBulkTargetStatus('Active');
                handleBulkUpdateStatus('Active');
              }}
              disabled={selectedUserIds.length === 0 || isBulkUpdating}
              className="flex-1 sm:flex-none"
            >
              {isBulkUpdating && bulkTargetStatus === 'Active' ? 'Activating…' : 'Activate'}
            </Button>
            <Button
              variant={selectedUserIds.length === 0 || isBulkUpdating ? 'ghost' : 'danger'}
              size="sm"
              onClick={() => {
                setBulkTargetStatus('Inactive');
                handleBulkUpdateStatus('Inactive');
              }}
              disabled={selectedUserIds.length === 0 || isBulkUpdating}
              className="flex-1 sm:flex-none"
            >
              {isBulkUpdating && bulkTargetStatus === 'Inactive'
                ? 'Deactivating…'
                : 'Deactivate'}
            </Button>
          </div>

          {/* Selection indicator */}
          {selectedUserIds.length > 0 && (
            <span className="self-center">
              <Tag
                type={
                  bulkTargetStatus === 'Active'
                    ? 'green'
                    : bulkTargetStatus === 'Inactive'
                      ? 'warm-gray'
                      : 'blue'
                }
                size="sm"
              >
                {selectedUserIds.length} selected
              </Tag>
            </span>
          )}
        </div>
      </div>

      {/* Status message */}
      {saveStatus && (
        <InlineNotification
          kind="success"
          title="Success"
          subtitle={saveStatus}
          hideCloseButton
        />
      )}

      {/* User List Container */}
      <div
        className="overflow-hidden"
        style={{ border: '1px solid var(--cds-border-subtle, #d6d3d1)' }}
      >
        {loading ? (
          <div
            className="p-6 sm:p-8 text-center"
            style={{ color: 'var(--cds-text-secondary, #52525b)' }}
          >
            Loading users...
          </div>
        ) : users.length === 0 ? (
          <div className="p-6 sm:p-8 text-center">
            <div className="max-w-md mx-auto">
              <svg
                className="w-16 h-16 mx-auto mb-4"
                style={{ color: 'var(--cds-text-disabled, #a8a29e)' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <h3
                className="text-lg font-bold mb-2"
                style={{ color: 'var(--cds-text-primary, #18181b)' }}
              >
                No Users Found
              </h3>
              <p
                className="mb-4 text-sm sm:text-base"
                style={{ color: 'var(--cds-text-secondary, #52525b)' }}
              >
                Users appear here after they log in. Click <strong>"Sync & Refresh"</strong>{' '}
                to add yourself, or invite new team members.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  onClick={async () => {
                    setLoading(true);
                    try {
                      const synced = await dataService.syncCurrentUser();
                      if (synced) {
                        await loadUsers();
                        setStatusMessage(
                          'Your profile synced. You can now edit your role.'
                        );
                      }
                    } catch (error: any) {
                      console.error('[Settings] Sync error:', error);
                      showToast(
                        error?.message || 'Profile sync failed. Please try again.',
                        'error'
                      );
                    }
                    setLoading(false);
                  }}
                  leftIcon={<RefreshCw size={14} />}
                  className="min-h-[44px]"
                >
                  Sync My Profile
                </Button>
                <Button onClick={() => onSwitchToInvites?.()} className="min-h-[44px]">
                  Invite Team Member
                </Button>
              </div>
              <p
                className="text-xs mt-4"
                style={{ color: 'var(--cds-text-secondary, #52525b)' }}
              >
                To change a user's role: Click the <strong>Edit</strong> (pencil) icon next
                to their name.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop/Tablet Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs lg:text-sm">
                <thead
                  style={{
                    background: 'var(--cds-layer-02, #ffffff)',
                    borderBottom: '1px solid var(--cds-border-subtle, #d6d3d1)',
                  }}
                >
                  <tr>
                    <th className="px-4 lg:px-6 py-3 w-12">
                      <input
                        type="checkbox"
                        checked={
                          selectedUserIds.length === users.length && users.length > 0
                        }
                        onChange={toggleSelectAll}
                        className="w-4 h-4"
                        style={{ borderColor: 'var(--cds-border-subtle, #d6d3d1)' }}
                      />
                    </th>
                    <th
                      className="px-4 lg:px-6 py-3 font-semibold"
                      style={{ color: 'var(--cds-text-secondary, #52525b)' }}
                    >
                      User
                    </th>
                    <th
                      className="px-4 lg:px-6 py-3 font-semibold hidden lg:table-cell"
                      style={{ color: 'var(--cds-text-secondary, #52525b)' }}
                    >
                      Email
                    </th>
                    <th
                      className="px-4 lg:px-6 py-3 font-semibold"
                      style={{ color: 'var(--cds-text-secondary, #52525b)' }}
                    >
                      Role
                    </th>
                    <th
                      className="px-4 lg:px-6 py-3 font-semibold"
                      style={{ color: 'var(--cds-text-secondary, #52525b)' }}
                    >
                      Status
                    </th>
                    <th
                      className="px-4 lg:px-6 py-3 font-semibold text-right"
                      style={{ color: 'var(--cds-text-secondary, #52525b)' }}
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody style={{ borderTop: '1px solid var(--cds-border-subtle, #d6d3d1)' }}>
                  {users.map(user => (
                    <tr
                      key={user.id}
                      className="group"
                      style={{
                        borderBottom: '1px solid var(--cds-border-subtle, #d6d3d1)',
                      }}
                    >
                      <td className="px-4 lg:px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(user.id)}
                          onChange={() => toggleSelectUser(user.id)}
                          className="w-4 h-4"
                          style={{ borderColor: 'var(--cds-border-subtle, #d6d3d1)' }}
                        />
                      </td>
                      <td className="px-4 lg:px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="relative flex-shrink-0">
                            <div
                              className="w-9 h-9 lg:w-10 lg:h-10 overflow-hidden"
                              style={{
                                borderRadius: '50%',
                                border: '2px solid var(--cds-layer-01, #ffffff)',
                              }}
                            >
                              <img
                                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`}
                                alt={user.name}
                                className="w-full h-full"
                              />
                            </div>
                            <div
                              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 lg:w-3 lg:h-3 border-2"
                              style={{
                                borderRadius: '50%',
                                borderColor: 'var(--cds-layer-01, #ffffff)',
                                background:
                                  user.status === 'Active'
                                    ? 'var(--cds-support-success, #10b981)'
                                    : 'var(--cds-text-disabled, #a8a29e)',
                              }}
                            ></div>
                          </div>
                          <div className="min-w-0">
                            <p
                              className="font-semibold truncate"
                              style={{ color: 'var(--cds-text-primary, #18181b)' }}
                            >
                              {user.name}
                            </p>
                            {/* Email shown under name on tablet, hidden on desktop (shown in separate column) */}
                            <p
                              className="text-xs truncate lg:hidden"
                              style={{ color: 'var(--cds-text-secondary, #52525b)' }}
                            >
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 lg:px-6 py-4 hidden lg:table-cell">
                        <span
                          className="font-mono text-xs truncate block max-w-[200px]"
                          style={{ color: 'var(--cds-text-secondary, #52525b)' }}
                          title={user.email}
                        >
                          {user.email}
                        </span>
                      </td>
                      <td className="px-4 lg:px-6 py-4">
                        <Tag
                          type={
                            user.role === 'Admin'
                              ? 'purple'
                              : user.role === 'Manager'
                                ? 'blue'
                                : user.role === 'Accountant'
                                  ? 'green'
                                  : 'cyan'
                          }
                          size="sm"
                        >
                          {user.role}
                        </Tag>
                      </td>
                      <td className="px-4 lg:px-6 py-4">
                        <Tag
                          type={user.status === 'Active' ? 'green' : 'warm-gray'}
                          size="sm"
                        >
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
                            title={
                              user.status === 'Active' ? 'Deactivate user' : 'Activate user'
                            }
                            leftIcon={
                              user.status === 'Active' ? (
                                <Minus size={14} />
                              ) : (
                                <Plus size={14} />
                              )
                            }
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
              <div
                className="px-4 py-3 flex items-center justify-between"
                style={{ background: 'var(--cds-layer-02, #ffffff)' }}
              >
                <label
                  className="flex items-center gap-2 text-sm font-medium"
                  style={{ color: 'var(--cds-text-secondary, #52525b)' }}
                >
                  <input
                    type="checkbox"
                    checked={selectedUserIds.length === users.length && users.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 flex-shrink-0"
                    style={{ borderColor: 'var(--cds-border-subtle, #d6d3d1)' }}
                  />
                  Select All
                </label>
                <span
                  className="text-xs"
                  style={{ color: 'var(--cds-text-secondary, #52525b)' }}
                >
                  {users.length} user{users.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div style={{ borderTop: '1px solid var(--cds-border-subtle, #d6d3d1)' }}>
                {users.map(user => (
                  <div
                    key={user.id}
                    className="p-4"
                    style={{ borderBottom: '1px solid var(--cds-border-subtle, #d6d3d1)' }}
                  >
                    {/* Top Row: Checkbox, Avatar, Name/Email, Actions */}
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(user.id)}
                        onChange={() => toggleSelectUser(user.id)}
                        className="w-4 h-4 flex-shrink-0"
                        style={{ borderColor: 'var(--cds-border-subtle, #d6d3d1)' }}
                      />
                      <div className="relative flex-shrink-0">
                        <div
                          className="w-10 h-10 overflow-hidden"
                          style={{
                            borderRadius: '50%',
                            border: '2px solid var(--cds-layer-01, #ffffff)',
                          }}
                        >
                          <img
                            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`}
                            alt={user.name}
                            className="w-full h-full"
                          />
                        </div>
                        <div
                          className="absolute -bottom-0.5 -right-0.5 w-3 h-3 border-2"
                          style={{
                            borderRadius: '50%',
                            borderColor: 'var(--cds-layer-01, #ffffff)',
                            background:
                              user.status === 'Active'
                                ? 'var(--cds-support-success, #10b981)'
                                : 'var(--cds-text-disabled, #a8a29e)',
                          }}
                        ></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="font-semibold truncate"
                          style={{ color: 'var(--cds-text-primary, #18181b)' }}
                        >
                          {user.name}
                        </p>
                        <p
                          className="text-xs truncate"
                          style={{ color: 'var(--cds-text-secondary, #52525b)' }}
                        >
                          {user.email}
                        </p>
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
                        <Tag
                          type={
                            user.role === 'Admin'
                              ? 'purple'
                              : user.role === 'Manager'
                                ? 'blue'
                                : user.role === 'Accountant'
                                  ? 'green'
                                  : 'cyan'
                          }
                          size="sm"
                        >
                          {user.role}
                        </Tag>
                        <Tag
                          type={user.status === 'Active' ? 'green' : 'warm-gray'}
                          size="sm"
                        >
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
                          title={
                            user.status === 'Active' ? 'Deactivate user' : 'Activate user'
                          }
                          leftIcon={
                            user.status === 'Active' ? (
                              <Minus size={14} />
                            ) : (
                              <Plus size={14} />
                            )
                          }
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

      {/* User Creation Modal */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 backdrop-blur-sm cursor-pointer"
            style={{ background: 'rgba(22, 22, 22, 0.4)' }}
            onClick={() => setShowUserModal(false)}
          ></div>
          <div
            className="relative p-8 max-w-md w-full max-h-[90vh] overflow-y-auto"
            style={{
              background: 'var(--cds-layer-01, #ffffff)',
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
            }}
          >
            <h3
              className="text-2xl font-black mb-6"
              style={{ color: 'var(--cds-text-primary, #18181b)' }}
            >
              Add New User
            </h3>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-1">
                <label
                  className="text-sm font-semibold"
                  style={{ color: 'var(--cds-text-secondary, #52525b)' }}
                >
                  Full Name
                </label>
                <input
                  required
                  type="text"
                  value={userForm.name}
                  onChange={e => setUserForm({ ...userForm, name: e.target.value })}
                  placeholder="John Doe"
                  className="w-full px-4 py-3 outline-none"
                  style={{ border: '1px solid var(--cds-border-subtle, #d6d3d1)' }}
                />
              </div>
              <div className="space-y-1">
                <label
                  className="text-sm font-semibold"
                  style={{ color: 'var(--cds-text-secondary, #52525b)' }}
                >
                  Email Address
                </label>
                <input
                  required
                  type="email"
                  value={userForm.email}
                  onChange={e => setUserForm({ ...userForm, email: e.target.value })}
                  placeholder="john@affinity.com"
                  className="w-full px-4 py-3 outline-none"
                  style={{ border: '1px solid var(--cds-border-subtle, #d6d3d1)' }}
                />
              </div>
              <div className="space-y-1">
                <label
                  className="text-sm font-semibold"
                  style={{ color: 'var(--cds-text-secondary, #52525b)' }}
                >
                  Password
                </label>
                <input
                  required
                  type="password"
                  value={userForm.password}
                  onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                  placeholder="Min 8 characters"
                  minLength={8}
                  className="w-full px-4 py-3 outline-none"
                  style={{ border: '1px solid var(--cds-border-subtle, #d6d3d1)' }}
                />
                <p className="text-xs" style={{ color: 'var(--cds-text-secondary, #52525b)' }}>
                  Must be at least 8 characters
                </p>
              </div>
              <div className="space-y-1">
                <label
                  className="text-sm font-semibold"
                  style={{ color: 'var(--cds-text-secondary, #52525b)' }}
                >
                  Role
                </label>
                <div className="space-y-2">
                  <div
                    onClick={() => setUserForm({ ...userForm, role: 'Admin' })}
                    className="p-4 cursor-pointer transition-all"
                    style={{
                      border: `2px solid ${userForm.role === 'Admin' ? 'var(--cds-tag-color-purple, #8a3ffc)' : 'var(--cds-border-subtle, #d6d3d1)'}`,
                      background:
                        userForm.role === 'Admin'
                          ? 'var(--cds-tag-background-purple, #f6f2ff)'
                          : 'transparent',
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className="font-bold"
                        style={{ color: 'var(--cds-text-primary, #18181b)' }}
                      >
                        Administrator
                      </span>
                      <div
                        className="w-5 h-5 flex items-center justify-center"
                        style={{
                          borderRadius: '50%',
                          border: `2px solid ${userForm.role === 'Admin' ? 'var(--cds-tag-color-purple, #8a3ffc)' : 'var(--cds-border-subtle, #d6d3d1)'}`,
                          background:
                            userForm.role === 'Admin'
                              ? 'var(--cds-tag-color-purple, #8a3ffc)'
                              : 'transparent',
                        }}
                      >
                        {userForm.role === 'Admin' && (
                          <svg
                            className="w-3 h-3 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--cds-text-secondary, #52525b)' }}>
                      Full system access, user management, and all settings
                    </p>
                  </div>

                  <div
                    onClick={() => setUserForm({ ...userForm, role: 'Manager' })}
                    className="p-4 cursor-pointer transition-all"
                    style={{
                      border: `2px solid ${userForm.role === 'Manager' ? 'var(--cds-interactive, #D97706)' : 'var(--cds-border-subtle, #d6d3d1)'}`,
                      background:
                        userForm.role === 'Manager'
                          ? 'var(--cds-layer-selected-01, #e5f6ff)'
                          : 'transparent',
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className="font-bold"
                        style={{ color: 'var(--cds-text-primary, #18181b)' }}
                      >
                        Manager
                      </span>
                      <div
                        className="w-5 h-5 flex items-center justify-center"
                        style={{
                          borderRadius: '50%',
                          border: `2px solid ${userForm.role === 'Manager' ? 'var(--cds-interactive, #D97706)' : 'var(--cds-border-subtle, #d6d3d1)'}`,
                          background:
                            userForm.role === 'Manager'
                              ? 'var(--cds-interactive, #D97706)'
                              : 'transparent',
                        }}
                      >
                        {userForm.role === 'Manager' && (
                          <svg
                            className="w-3 h-3 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--cds-text-secondary, #52525b)' }}>
                      Dashboard, reports, vehicles, and operational data
                    </p>
                  </div>

                  <div
                    onClick={() => setUserForm({ ...userForm, role: 'Accountant' })}
                    className="p-4 cursor-pointer transition-all"
                    style={{
                      border: `2px solid ${userForm.role === 'Accountant' ? 'var(--cds-support-success, #10b981)' : 'var(--cds-border-subtle, #d6d3d1)'}`,
                      background:
                        userForm.role === 'Accountant'
                          ? 'var(--cds-tag-background-green, #d1fae5)'
                          : 'transparent',
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className="font-bold"
                        style={{ color: 'var(--cds-text-primary, #18181b)' }}
                      >
                        Accountant
                      </span>
                      <div
                        className="w-5 h-5 flex items-center justify-center"
                        style={{
                          borderRadius: '50%',
                          border: `2px solid ${userForm.role === 'Accountant' ? 'var(--cds-support-success, #10b981)' : 'var(--cds-border-subtle, #d6d3d1)'}`,
                          background:
                            userForm.role === 'Accountant'
                              ? 'var(--cds-support-success, #10b981)'
                              : 'transparent',
                        }}
                      >
                        {userForm.role === 'Accountant' && (
                          <svg
                            className="w-3 h-3 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--cds-text-secondary, #52525b)' }}>
                      Financial data, expenses, quotes, invoices, and payments
                    </p>
                  </div>

                  <div
                    onClick={() => setUserForm({ ...userForm, role: 'Driver' })}
                    className="p-4 cursor-pointer transition-all"
                    style={{
                      border: `2px solid ${userForm.role === 'Driver' ? 'var(--cds-tag-color-cyan, #1192e8)' : 'var(--cds-border-subtle, #d6d3d1)'}`,
                      background:
                        userForm.role === 'Driver'
                          ? 'var(--cds-tag-background-cyan, #e5f6ff)'
                          : 'transparent',
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className="font-bold"
                        style={{ color: 'var(--cds-text-primary, #18181b)' }}
                      >
                        Driver
                      </span>
                      <div
                        className="w-5 h-5 flex items-center justify-center"
                        style={{
                          borderRadius: '50%',
                          border: `2px solid ${userForm.role === 'Driver' ? 'var(--cds-tag-color-cyan, #1192e8)' : 'var(--cds-border-subtle, #d6d3d1)'}`,
                          background:
                            userForm.role === 'Driver'
                              ? 'var(--cds-tag-color-cyan, #1192e8)'
                              : 'transparent',
                        }}
                      >
                        {userForm.role === 'Driver' && (
                          <svg
                            className="w-3 h-3 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--cds-text-secondary, #52525b)' }}>
                      Driver portal, document uploads, and trip logs
                    </p>
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
                    setUserForm({
                      name: '',
                      email: '',
                      password: '',
                      role: 'Driver',
                      status: 'Active',
                    });
                  }}
                >
                  Cancel
                </Button>
                <Button variant="primary" type="submit" style={{ flex: 1 }}>
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
          <div
            className="absolute inset-0 backdrop-blur-sm cursor-pointer"
            style={{ background: 'rgba(22, 22, 22, 0.4)' }}
            onClick={() => setShowSetPasswordModal(false)}
          ></div>
          <div
            className="relative p-8 max-w-md w-full max-h-[90vh] overflow-y-auto"
            style={{
              background: 'var(--cds-layer-01, #ffffff)',
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div
                className="w-12 h-12 flex items-center justify-center"
                style={{ borderRadius: '50%', background: 'var(--cds-layer-selected-01, #e5f6ff)' }}
              >
                <svg
                  className="w-6 h-6"
                  style={{ color: 'var(--cds-interactive, #D97706)' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                  />
                </svg>
              </div>
              <div>
                <h3
                  className="text-2xl font-black"
                  style={{ color: 'var(--cds-text-primary, #18181b)' }}
                >
                  Set Password
                </h3>
                <p className="text-sm" style={{ color: 'var(--cds-text-secondary, #52525b)' }}>
                  Set a new password for {userToSetPassword.name}
                </p>
              </div>
            </div>
            <form onSubmit={handleSetPassword} className="space-y-4">
              <div className="space-y-1">
                <label
                  className="text-sm font-semibold"
                  style={{ color: 'var(--cds-text-secondary, #52525b)' }}
                >
                  New Password
                </label>
                <input
                  required
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  placeholder="Min 8 characters"
                  minLength={8}
                  className="w-full px-4 py-3 outline-none"
                  style={{ border: '1px solid var(--cds-border-subtle, #d6d3d1)' }}
                />
              </div>
              <div className="space-y-1">
                <label
                  className="text-sm font-semibold"
                  style={{ color: 'var(--cds-text-secondary, #52525b)' }}
                >
                  Confirm Password
                </label>
                <input
                  required
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={e =>
                    setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                  }
                  placeholder="Re-enter password"
                  minLength={8}
                  className="w-full px-4 py-3 outline-none"
                  style={{ border: '1px solid var(--cds-border-subtle, #d6d3d1)' }}
                />
              </div>
              <div
                className="p-4"
                style={{
                  background: 'var(--cds-tag-background-warm-gray, #f7f3f2)',
                  border: '1px solid var(--cds-tag-border-warm-gray, #e5e0df)',
                }}
              >
                <p
                  className="text-xs font-medium"
                  style={{ color: 'var(--cds-text-secondary, #52525b)' }}
                >
                  ⚠️ This will immediately change the user's password. They will need to use the new
                  password on their next login.
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
                  style={{
                    color: 'var(--cds-text-secondary, #52525b)',
                    border: '1px solid var(--cds-border-subtle, #d6d3d1)',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 font-bold text-sm text-white"
                  style={{ background: 'var(--cds-interactive, #D97706)' }}
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
          <div
            className="absolute inset-0 backdrop-blur-sm cursor-pointer"
            style={{ background: 'rgba(22, 22, 22, 0.4)' }}
            onClick={() => setShowEditModal(false)}
          ></div>
          <div
            className="relative p-8 max-w-md w-full max-h-[90vh] overflow-y-auto"
            style={{
              background: 'var(--cds-layer-01, #ffffff)',
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
            }}
          >
            <h3
              className="text-2xl font-black mb-6"
              style={{ color: 'var(--cds-text-primary, #18181b)' }}
            >
              Edit User
            </h3>
            <form onSubmit={handleEditUser} className="space-y-4">
              <div className="space-y-1">
                <label
                  className="text-sm font-semibold"
                  style={{ color: 'var(--cds-text-secondary, #52525b)' }}
                >
                  Full Name
                </label>
                <input
                  required
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="John Doe"
                  className="w-full px-4 py-3 outline-none"
                  style={{ border: '1px solid var(--cds-border-subtle, #d6d3d1)' }}
                />
              </div>
              <div className="space-y-1">
                <label
                  className="text-sm font-semibold"
                  style={{ color: 'var(--cds-text-secondary, #52525b)' }}
                >
                  Email Address
                </label>
                <input
                  required
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                  placeholder="john@affinity.com"
                  className="w-full px-4 py-3 outline-none"
                  style={{ border: '1px solid var(--cds-border-subtle, #d6d3d1)' }}
                />
              </div>
              <div className="space-y-1">
                <label
                  className="text-sm font-semibold"
                  style={{ color: 'var(--cds-text-secondary, #52525b)' }}
                >
                  Role
                </label>
                <div className="space-y-2">
                  <div
                    onClick={() => setEditForm({ ...editForm, role: 'Admin' })}
                    className="p-3 cursor-pointer transition-all"
                    style={{
                      border: `2px solid ${editForm.role === 'Admin' ? 'var(--cds-tag-color-purple, #8a3ffc)' : 'var(--cds-border-subtle, #d6d3d1)'}`,
                      background:
                        editForm.role === 'Admin'
                          ? 'var(--cds-tag-background-purple, #f6f2ff)'
                          : 'transparent',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="font-bold text-sm"
                        style={{ color: 'var(--cds-text-primary, #18181b)' }}
                      >
                        Administrator
                      </span>
                      <div
                        className="w-4 h-4 flex items-center justify-center"
                        style={{
                          borderRadius: '50%',
                          border: `2px solid ${editForm.role === 'Admin' ? 'var(--cds-tag-color-purple, #8a3ffc)' : 'var(--cds-border-subtle, #d6d3d1)'}`,
                          background:
                            editForm.role === 'Admin'
                              ? 'var(--cds-tag-color-purple, #8a3ffc)'
                              : 'transparent',
                        }}
                      >
                        {editForm.role === 'Admin' && (
                          <svg
                            className="w-2.5 h-2.5 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>

                  <div
                    onClick={() => setEditForm({ ...editForm, role: 'Manager' })}
                    className="p-3 cursor-pointer transition-all"
                    style={{
                      border: `2px solid ${editForm.role === 'Manager' ? 'var(--cds-interactive, #D97706)' : 'var(--cds-border-subtle, #d6d3d1)'}`,
                      background:
                        editForm.role === 'Manager'
                          ? 'var(--cds-layer-selected-01, #e5f6ff)'
                          : 'transparent',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="font-bold text-sm"
                        style={{ color: 'var(--cds-text-primary, #18181b)' }}
                      >
                        Manager
                      </span>
                      <div
                        className="w-4 h-4 flex items-center justify-center"
                        style={{
                          borderRadius: '50%',
                          border: `2px solid ${editForm.role === 'Manager' ? 'var(--cds-interactive, #D97706)' : 'var(--cds-border-subtle, #d6d3d1)'}`,
                          background:
                            editForm.role === 'Manager'
                              ? 'var(--cds-interactive, #D97706)'
                              : 'transparent',
                        }}
                      >
                        {editForm.role === 'Manager' && (
                          <svg
                            className="w-2.5 h-2.5 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>

                  <div
                    onClick={() => setEditForm({ ...editForm, role: 'Accountant' })}
                    className="p-3 cursor-pointer transition-all"
                    style={{
                      border: `2px solid ${editForm.role === 'Accountant' ? 'var(--cds-support-success, #10b981)' : 'var(--cds-border-subtle, #d6d3d1)'}`,
                      background:
                        editForm.role === 'Accountant'
                          ? 'var(--cds-tag-background-green, #d1fae5)'
                          : 'transparent',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="font-bold text-sm"
                        style={{ color: 'var(--cds-text-primary, #18181b)' }}
                      >
                        Accountant
                      </span>
                      <div
                        className="w-4 h-4 flex items-center justify-center"
                        style={{
                          borderRadius: '50%',
                          border: `2px solid ${editForm.role === 'Accountant' ? 'var(--cds-support-success, #10b981)' : 'var(--cds-border-subtle, #d6d3d1)'}`,
                          background:
                            editForm.role === 'Accountant'
                              ? 'var(--cds-support-success, #10b981)'
                              : 'transparent',
                        }}
                      >
                        {editForm.role === 'Accountant' && (
                          <svg
                            className="w-2.5 h-2.5 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>

                  <div
                    onClick={() => setEditForm({ ...editForm, role: 'Driver' })}
                    className="p-3 cursor-pointer transition-all"
                    style={{
                      border: `2px solid ${editForm.role === 'Driver' ? 'var(--cds-tag-color-cyan, #1192e8)' : 'var(--cds-border-subtle, #d6d3d1)'}`,
                      background:
                        editForm.role === 'Driver'
                          ? 'var(--cds-tag-background-cyan, #e5f6ff)'
                          : 'transparent',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="font-bold text-sm"
                        style={{ color: 'var(--cds-text-primary, #18181b)' }}
                      >
                        Driver
                      </span>
                      <div
                        className="w-4 h-4 flex items-center justify-center"
                        style={{
                          borderRadius: '50%',
                          border: `2px solid ${editForm.role === 'Driver' ? 'var(--cds-tag-color-cyan, #1192e8)' : 'var(--cds-border-subtle, #d6d3d1)'}`,
                          background:
                            editForm.role === 'Driver'
                              ? 'var(--cds-tag-color-cyan, #1192e8)'
                              : 'transparent',
                        }}
                      >
                        {editForm.role === 'Driver' && (
                          <svg
                            className="w-2.5 h-2.5 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <label
                  className="text-sm font-semibold"
                  style={{ color: 'var(--cds-text-secondary, #52525b)' }}
                >
                  Status
                </label>
                <select
                  required
                  value={editForm.status}
                  onChange={e =>
                    setEditForm({ ...editForm, status: e.target.value as 'Active' | 'Inactive' })
                  }
                  className="w-full px-4 py-3 outline-none"
                  style={{ border: '1px solid var(--cds-border-subtle, #d6d3d1)' }}
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
                  style={{
                    color: 'var(--cds-text-secondary, #52525b)',
                    border: '1px solid var(--cds-border-subtle, #d6d3d1)',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 font-bold text-sm text-white"
                  style={{ background: 'var(--cds-interactive, #D97706)' }}
                >
                  Update User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 backdrop-blur-sm cursor-pointer"
            style={{ background: 'rgba(22, 22, 22, 0.4)' }}
            onClick={() => setShowDeleteDialog(false)}
          ></div>
          <div
            className="relative p-8 max-w-md w-full max-h-[90vh] overflow-y-auto"
            style={{
              background: 'var(--cds-layer-01, #ffffff)',
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div className="flex items-center gap-4 mb-4">
              <div
                className="w-12 h-12 flex items-center justify-center"
                style={{
                  borderRadius: '50%',
                  background: 'var(--cds-tag-background-red, #fff0f0)',
                }}
              >
                <svg
                  className="w-6 h-6"
                  style={{ color: 'var(--cds-support-error, #dc2626)' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div>
                <h3
                  className="text-xl font-black"
                  style={{ color: 'var(--cds-text-primary, #18181b)' }}
                >
                  Delete User
                </h3>
                <p className="text-sm" style={{ color: 'var(--cds-text-secondary, #52525b)' }}>
                  This action cannot be undone
                </p>
              </div>
            </div>
            <div className="p-4 mb-6" style={{ background: 'var(--cds-layer-02, #ffffff)' }}>
              <p className="text-sm" style={{ color: 'var(--cds-text-secondary, #52525b)' }}>
                Are you sure you want to delete{' '}
                <span className="font-bold" style={{ color: 'var(--cds-text-primary, #18181b)' }}>
                  {userToDelete.name}
                </span>
                ?
              </p>
              <p className="text-xs mt-2" style={{ color: 'var(--cds-text-secondary, #52525b)' }}>
                {userToDelete.email}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteDialog(false)}
                className="flex-1 px-4 py-3 font-bold text-sm"
                style={{
                  color: 'var(--cds-text-secondary, #52525b)',
                  border: '1px solid var(--cds-border-subtle, #d6d3d1)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                className="flex-1 px-4 py-3 font-bold text-sm text-white"
                style={{ background: 'var(--cds-support-error, #dc2626)' }}
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

export default UsersTab;
