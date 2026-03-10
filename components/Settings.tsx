
import React, { useState, useEffect } from 'react';
import { CompanyDetails, AppUser, UserRole, SupabaseConfig, UserInvite, RegistrationRequest, Client } from '../types';
import { supabase } from '../services/supabaseService';
import { authService } from '../services/authService';


export const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'company' | 'users' | 'clients' | 'requests' | 'invites' | 'supabase'>('company');
  const [company, setCompany] = useState<CompanyDetails | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [invites, setInvites] = useState<UserInvite[]>([]);
  const [registrationRequests, setRegistrationRequests] = useState<RegistrationRequest[]>([]);
  const [dbConfig, setDbConfig] = useState<SupabaseConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<string>('');
  const [copied, setCopied] = useState(false);

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
      console.log('[Settings] Loading users from database...');
      const u = await supabase.getUsers();
      console.log('[Settings] Users loaded:', u.length, 'users');
      setUsers(u);
      return u;
    } catch (error: any) {
      console.error('[Settings] Error loading users:', error);
      throw error;
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [c, d, i, r] = await Promise.all([
          supabase.getCompanyDetails(),
          supabase.getSupabaseConfig(),
          supabase.getInvites(),
          supabase.getRegistrationRequests()
        ]);
        
        // Load users separately for better error handling
        let u: AppUser[] = [];
        try {
          u = await loadUsers();
        } catch (userError: any) {
          console.error('[Settings] Failed to load users:', userError.message);
          // Don't fail completely, just show empty users
        }
        
        console.log('SETTINGS LOADED - Users from database:', u);
        console.log('User count:', u.length);
        setCompany(c);
        setDbConfig(d);
        setInvites(i);
        setRegistrationRequests(r);
        setLoading(false);
      } catch (error) {
        console.error('Error loading settings:', error);
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    setSaveStatus('Saving...');
    try {
      await supabase.updateCompanyDetails(company);
      setTimeout(() => setSaveStatus('All changes saved!'), 500);
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (error) {
      console.error('Error saving company details:', error);
      setSaveStatus('Error saving. Please try again.');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  const handleDbSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbConfig) return;
    setSaveStatus('Connecting...');
    try {
      await supabase.updateSupabaseConfig(dbConfig);
      setTimeout(() => setSaveStatus('Supabase Connected!'), 500);
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (error) {
      console.error('Error updating Supabase config:', error);
      setSaveStatus('Connection failed. Check credentials.');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate password
    if (!userForm.password || userForm.password.length < 8) {
      alert('Password must be at least 8 characters');
      return;
    }
    
    try {
      // Use authService to create user with password
      const newUser = await authService.createUser({
        name: userForm.name,
        email: userForm.email,
        password: userForm.password,
        role: userForm.role
      });
      setUsers([...users, newUser]);
      setShowUserModal(false);
      setUserForm({ name: '', email: '', password: '', role: 'Driver', status: 'Active' });
      setSaveStatus('User created successfully!');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (error: any) {
      console.error('Error creating user:', error);
      alert(error.message || 'Failed to create user. Please try again.');
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

    // Validate passwords match
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    // Validate password length
    if (passwordForm.newPassword.length < 8) {
      alert('Password must be at least 8 characters');
      return;
    }

    try {
      await authService.adminSetUserPassword(userToSetPassword.id, passwordForm.newPassword);
      setShowSetPasswordModal(false);
      setUserToSetPassword(null);
      setPasswordForm({ newPassword: '', confirmPassword: '' });
      setSaveStatus(`Password updated for ${userToSetPassword.name}`);
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (error: any) {
      console.error('Error setting password:', error);
      alert(error.message || 'Failed to set password. Please try again.');
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await supabase.deleteUser(userToDelete.id);
      setUsers(users.filter(u => u.id !== userToDelete.id));
      setShowDeleteDialog(false);
      setUserToDelete(null);
      setSaveStatus('User deleted successfully!');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (error: any) {
      console.error('Error deleting user:', error);
      if (error.name === 'ValidationError') {
        alert(error.message);
      } else {
        alert('Failed to delete user. Please try again.');
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
      console.log('[Settings] Updating user:', userToEdit.id, 'with:', editForm);
      const updatedUser = await supabase.updateUser(userToEdit.id, editForm);
      console.log('[Settings] User updated successfully:', updatedUser);
      
      // Update local state with the returned user
      setUsers(users.map(u => u.id === userToEdit.id ? updatedUser : u));
      setShowEditModal(false);
      setUserToEdit(null);
      
      // Show success message with role change info
      const roleChanged = userToEdit.role !== editForm.role;
      const statusMsg = roleChanged 
        ? `User updated! Role changed from ${userToEdit.role} to ${editForm.role}. User will see new role on next login.`
        : 'User updated successfully!';
      setSaveStatus(statusMsg);
      setTimeout(() => setSaveStatus(''), 5000);
      
      // Refresh users list to ensure we have latest data from database
      await loadUsers();
    } catch (error: any) {
      console.error('[Settings] Error updating user:', error);
      if (error.name === 'ValidationError') {
        alert(`${error.field}: ${error.message}`);
      } else {
        alert(error.message || 'Failed to update user. Please try again.');
      }
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const currentUser = await supabase.getSession();
      const invite = await supabase.createInvite(
        inviteForm.email,
        inviteForm.role,
        inviteForm.name,
        currentUser?.user?.email || 'admin'
      );
      setInvites([...invites, invite]);
      setShowInviteModal(false);
      setInviteForm({ name: '', email: '', role: 'Driver' });
      setSaveStatus('Invite sent! Check console for email preview.');
      setTimeout(() => setSaveStatus(''), 5000);
    } catch (error: any) {
      console.error('Error sending invite:', error);
      if (error.name === 'ValidationError') {
        alert(`${error.field}: ${error.message}`);
      } else {
        alert('Failed to send invite. Please try again.');
      }
    }
  };

  const handleDeleteInvite = async (inviteId: string) => {
    try {
      await supabase.deleteInvite(inviteId);
      setInvites(invites.filter(i => i.id !== inviteId));
      setSaveStatus('Invite cancelled successfully!');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (error: any) {
      console.error('Error deleting invite:', error);
      alert('Failed to cancel invite. Please try again.');
    }
  };

  const handleResendInvite = async (inviteId: string) => {
    try {
      const updatedInvite = await supabase.resendInvite(inviteId);
      setInvites(invites.map(i => i.id === inviteId ? updatedInvite : i));
      setSaveStatus('Invite resent! Check console for email preview.');
      setTimeout(() => setSaveStatus(''), 5000);
    } catch (error: any) {
      console.error('Error resending invite:', error);
      alert('Failed to resend invite. Please try again.');
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    try {
      const currentUser = await supabase.getSession();
      await supabase.approveRegistrationRequest(requestId, currentUser?.user?.id || 'admin');

      // Refresh the lists
      const [updatedRequests, updatedUsers] = await Promise.all([
        supabase.getRegistrationRequests(),
        supabase.getUsers()
      ]);
      setRegistrationRequests(updatedRequests);
      setUsers(updatedUsers);

      setSaveStatus('Registration approved! User can now sign in.');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (error: any) {
      console.error('Error approving request:', error);
      const errorMessage = error.message || 'Unknown error';
      alert(`Failed to approve registration: ${errorMessage}\n\nPlease check the browser console for details.`);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      const currentUser = await supabase.getSession();
      await supabase.rejectRegistrationRequest(requestId, currentUser?.user?.id || 'admin');

      const updatedRequests = await supabase.getRegistrationRequests();
      setRegistrationRequests(updatedRequests);

      setSaveStatus('Registration request rejected.');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (error: any) {
      console.error('Error rejecting request:', error);
      alert('Failed to reject registration. Please try again.');
    }
  };

  const handleResetPassword = async (userEmail: string) => {
    if (!confirm(`Send password reset email to ${userEmail}?`)) return;

    try {
      await supabase.resetUserPassword(userEmail);
      setSaveStatus(`Password reset email sent to ${userEmail}!`);
      setTimeout(() => setSaveStatus(''), 5000);
    } catch (error: any) {
      console.error('Error sending password reset:', error);
      alert('Failed to send password reset email. Please try again.');
    }
  };

  const handleToggleUserStatus = async (user: AppUser) => {
    const nextStatus: 'Active' | 'Inactive' = user.status === 'Active' ? 'Inactive' : 'Active';
    try {
      // Optimistic UI update
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: nextStatus } : u));
      const updatedUser = await supabase.updateUser(user.id, { status: nextStatus });
      setUsers(prev => prev.map(u => u.id === user.id ? updatedUser : u));
      setSaveStatus(`User ${nextStatus === 'Active' ? 'activated' : 'deactivated'} successfully!`);
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (error: any) {
      console.error('Error toggling user status:', error);
      // Revert optimistic update on failure
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: user.status } : u));
      alert('Failed to update status. Please try again.');
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
          return await supabase.updateUser(id, { status });
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
        alert(`Failed to update ${failedIds.length} user(s). Changes reverted for those.`);
      }
      setSaveStatus(`Updated ${successfulUsers.length} user(s) to ${status}.`);
      setTimeout(() => setSaveStatus(''), 3000);
      setSelectedUserIds([]);
    } finally {
      setIsBulkUpdating(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64 font-sans">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto font-sans">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-blue-100 rounded-xl">
          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">Platform Settings</h2>
          <p className="text-zinc-500">Manage your business profile and team access</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
        <div className="flex border-b border-zinc-200 bg-zinc-50/50 overflow-x-auto">
          <button
            onClick={() => setActiveTab('company')}
            className={`px-6 py-4 text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${activeTab === 'company'
              ? 'border-blue-600 text-blue-600 bg-white'
              : 'border-transparent text-zinc-500 hover:text-zinc-700'
              }`}
          >
            Company Profile
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-4 text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${activeTab === 'users'
              ? 'border-blue-600 text-blue-600 bg-white'
              : 'border-transparent text-zinc-500 hover:text-zinc-700'
              }`}
          >
            User Management
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-6 py-4 text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${activeTab === 'requests'
              ? 'border-blue-600 text-blue-600 bg-white'
              : 'border-transparent text-zinc-500 hover:text-zinc-700'
              }`}
          >
            Requests {registrationRequests.filter(r => r.status === 'Pending').length > 0 && (
              <span className="ml-2 bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs font-bold">
                {registrationRequests.filter(r => r.status === 'Pending').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('invites')}
            className={`px-6 py-4 text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${activeTab === 'invites'
              ? 'border-blue-600 text-blue-600 bg-white'
              : 'border-transparent text-zinc-500 hover:text-zinc-700'
              }`}
          >
            Invitations {invites.filter(i => i.status === 'Pending').length > 0 && (
              <span className="ml-2 bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-bold">
                {invites.filter(i => i.status === 'Pending').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('supabase')}
            className={`px-6 py-4 text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${activeTab === 'supabase'
              ? 'border-blue-600 text-blue-600 bg-white'
              : 'border-transparent text-zinc-500 hover:text-zinc-700'
              }`}
          >
            Supabase Connection
          </button>
        </div>

        <div className="p-8">
          {activeTab === 'company' && company && (
            <form onSubmit={handleCompanySubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-zinc-700">Legal Company Name</label>
                  <input
                    type="text"
                    value={company.name}
                    onChange={(e) => setCompany({ ...company, name: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-zinc-200 bg-transparent focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-zinc-700">Registration Number</label>
                  <input
                    type="text"
                    value={company.registration_no}
                    onChange={(e) => setCompany({ ...company, registration_no: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-zinc-200 bg-transparent focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-zinc-700">Tax / VAT ID</label>
                  <input
                    type="text"
                    value={company.tax_id}
                    onChange={(e) => setCompany({ ...company, tax_id: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-zinc-200 bg-transparent focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-zinc-700">HQ Contact Email</label>
                  <input
                    type="email"
                    value={company.contact_email}
                    onChange={(e) => setCompany({ ...company, contact_email: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-zinc-200 bg-transparent focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-zinc-700">Phone Number</label>
                  <input
                    type="tel"
                    value={company.phone}
                    onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-zinc-200 bg-transparent focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-zinc-700">Website</label>
                  <input
                    type="url"
                    value={company.website}
                    onChange={(e) => setCompany({ ...company, website: e.target.value })}
                    placeholder="https://example.com"
                    className="w-full px-4 py-2 rounded-lg border border-zinc-200 bg-transparent focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-zinc-700">HQ Address</label>
                <textarea
                  value={company.address}
                  onChange={(e) => setCompany({ ...company, address: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg border border-zinc-200 bg-transparent focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-zinc-700">Company Logo URL</label>
                <input
                  type="url"
                  value={company.logo_url}
                  onChange={(e) => setCompany({ ...company, logo_url: e.target.value })}
                  placeholder="https://example.com/logo.png"
                  className="w-full px-4 py-2 rounded-lg border border-zinc-200 bg-transparent focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <p className="text-xs text-zinc-500 mt-1">This logo will appear on quotes and invoices. Recommended size: 200x100px</p>
                {company.logo_url && (
                  <div className="mt-2 p-4 border border-zinc-200 rounded-lg bg-zinc-50">
                    <p className="text-xs font-semibold text-zinc-600 mb-2">Logo Preview:</p>
                    <img
                      src={company.logo_url}
                      alt="Company Logo"
                      className="h-16 object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="50"%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" fill="%23999"%3EInvalid URL%3C/text%3E%3C/svg%3E';
                      }}
                    />
                  </div>
                )}
              </div>
              <div className="pt-4 flex items-center justify-between">
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-2.5 rounded-lg transition-all shadow-md active:scale-95 font-sans"
                >
                  Save Business Details
                </button>
                {saveStatus && <span className="text-emerald-600 font-medium animate-fade-in">{saveStatus}</span>}
              </div>
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
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200 min-h-[100px]">
                  <div className="flex items-center justify-between mb-2">
                    <svg className="w-7 h-7 sm:w-8 sm:h-8 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <p className="text-2xl sm:text-2xl font-black text-blue-900">{users.length}</p>
                  <p className="text-[10px] sm:text-xs font-bold text-blue-700 uppercase tracking-wider mt-1">Total Users</p>
                </div>

                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4 border border-emerald-200 min-h-[100px]">
                  <div className="flex items-center justify-between mb-2">
                    <svg className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-2xl sm:text-2xl font-black text-emerald-900">{users.filter(u => u.status === 'Active').length}</p>
                  <p className="text-[10px] sm:text-xs font-bold text-emerald-700 uppercase tracking-wider mt-1">Active Users</p>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200 min-h-[100px]">
                  <div className="flex items-center justify-between mb-2">
                    <svg className="w-7 h-7 sm:w-8 sm:h-8 text-purple-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-2xl sm:text-2xl font-black text-purple-900">{users.filter(u => u.role === 'Admin').length}</p>
                  <p className="text-[10px] sm:text-xs font-bold text-purple-700 uppercase tracking-wider mt-1">Administrators</p>
                </div>

                <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4 border border-amber-200 min-h-[100px]">
                  <div className="flex items-center justify-between mb-2">
                    <svg className="w-7 h-7 sm:w-8 sm:h-8 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-2xl sm:text-2xl font-black text-amber-900">{users.filter(u => u.status === 'Inactive').length}</p>
                  <p className="text-[10px] sm:text-xs font-bold text-amber-700 uppercase tracking-wider mt-1">Inactive Users</p>
                </div>
              </div>

              {/* Action Row - Responsive: stacked on mobile, flex on tablet+ */}
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4">
                <div className="flex-shrink-0">
                  <h3 className="text-base sm:text-lg font-bold text-zinc-800">Team Directory</h3>
                  <p className="text-xs sm:text-sm text-zinc-500 mt-0.5 sm:mt-1">{users.length} user{users.length !== 1 ? 's' : ''} in database</p>
                </div>
                
                {/* Action Buttons - Responsive flex container */}
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
                  {/* Primary Action - Full width on mobile */}
                  <button
                    onClick={() => setShowUserModal(true)}
                    className="w-full sm:w-auto bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-bold px-4 py-2.5 sm:py-2 rounded-lg transition-all font-sans min-h-[44px] sm:min-h-0 order-first sm:order-last"
                  >
                    + Add New User
                  </button>
                  
                  {/* Secondary Actions - Row on mobile, inline on tablet+ */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={async () => {
                        setLoading(true);
                        try {
                          // Sync the current user's profile to Neon
                          console.log('[Settings] Syncing current user profile...');
                          const syncedUser = await supabase.syncCurrentUser();
                          if (syncedUser) {
                            console.log('[Settings] Current user synced:', syncedUser.email, 'Role:', syncedUser.role);
                          }
                          // Then refresh the users list
                          const u = await supabase.getUsers();
                          console.log('[Settings] Refreshed users:', u.length);
                          setUsers(u);
                          setSelectedUserIds([]);
                          setBulkTargetStatus(null);
                          setSaveStatus(`Synced! Found ${u.length} user${u.length !== 1 ? 's' : ''} in database.${syncedUser ? ' Your profile is synced.' : ''}`);
                          setTimeout(() => setSaveStatus(''), 4000);
                        } catch (error: any) {
                          console.error('[Settings] Refresh error:', error);
                          alert('Error: ' + error.message);
                        }
                        setLoading(false);
                      }}
                      className="flex-1 sm:flex-none bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs sm:text-sm font-bold px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg transition-all font-sans flex items-center justify-center gap-2 min-h-[44px] sm:min-h-0"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span className="sm:inline">Sync & Refresh</span>
                    </button>
                    <button
                      onClick={() => { setBulkTargetStatus('Active'); handleBulkUpdateStatus('Active'); }}
                      disabled={selectedUserIds.length === 0 || isBulkUpdating}
                      className={`flex-1 sm:flex-none text-xs sm:text-sm font-bold px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg transition-all font-sans min-h-[44px] sm:min-h-0 ${selectedUserIds.length === 0 || isBulkUpdating ? 'bg-zinc-100 text-zinc-400' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                    >
                      {isBulkUpdating && bulkTargetStatus === 'Active' ? 'Activating…' : 'Activate'}
                    </button>
                    <button
                      onClick={() => { setBulkTargetStatus('Inactive'); handleBulkUpdateStatus('Inactive'); }}
                      disabled={selectedUserIds.length === 0 || isBulkUpdating}
                      className={`flex-1 sm:flex-none text-xs sm:text-sm font-bold px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg transition-all font-sans min-h-[44px] sm:min-h-0 ${selectedUserIds.length === 0 || isBulkUpdating ? 'bg-zinc-100 text-zinc-400' : 'bg-amber-600 text-white hover:bg-amber-700'}`}
                    >
                      {isBulkUpdating && bulkTargetStatus === 'Inactive' ? 'Deactivating…' : 'Deactivate'}
                    </button>
                  </div>
                  
                  {/* Selection indicator */}
                  {selectedUserIds.length > 0 && (
                    <span className={`self-center px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap ${bulkTargetStatus === 'Active' ? 'bg-emerald-100 text-emerald-700' :
                      bulkTargetStatus === 'Inactive' ? 'bg-amber-100 text-amber-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                      {selectedUserIds.length} selected
                    </span>
                  )}
                </div>
              </div>
              
              {/* Status message */}
              {saveStatus && activeTab === 'users' && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg font-medium text-sm">
                  {saveStatus}
                </div>
              )}

              {/* User List Container */}
              <div className="border border-zinc-200 rounded-xl overflow-hidden">
                {loading ? (
                  <div className="p-6 sm:p-8 text-center text-zinc-500">Loading users...</div>
                ) : users.length === 0 ? (
                  <div className="p-6 sm:p-8 text-center">
                    <div className="max-w-md mx-auto">
                      <svg className="w-16 h-16 mx-auto text-zinc-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <h3 className="text-lg font-bold text-zinc-800 mb-2">No Users Found</h3>
                      <p className="text-zinc-500 mb-4 text-sm sm:text-base">
                        Users appear here after they log in. Click <strong>"Sync & Refresh"</strong> to add yourself, or invite new team members.
                      </p>
                      <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <button
                          onClick={async () => {
                            setLoading(true);
                            try {
                              console.log('[Settings] Syncing current user...');
                              const synced = await supabase.syncCurrentUser();
                              if (synced) {
                                console.log('[Settings] Synced:', synced.email);
                                await loadUsers();
                                setSaveStatus(`Your profile synced! You can now edit your role.`);
                                setTimeout(() => setSaveStatus(''), 4000);
                              }
                            } catch (error: any) {
                              console.error('[Settings] Sync error:', error);
                              alert('Error: ' + error.message);
                            }
                            setLoading(false);
                          }}
                          className="bg-zinc-900 hover:bg-zinc-800 text-white px-5 py-2.5 rounded-lg font-bold min-h-[44px] flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Sync My Profile
                        </button>
                        <button
                          onClick={() => setShowInviteModal(true)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-bold min-h-[44px]"
                        >
                          Invite Team Member
                        </button>
                      </div>
                      <p className="text-xs text-zinc-400 mt-4">
                        To change a user's role: Click the <strong>Edit</strong> (pencil) icon next to their name.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Desktop/Tablet Table View */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left text-xs lg:text-sm">
                        <thead className="bg-zinc-50 border-b border-zinc-200">
                          <tr>
                            <th className="px-4 lg:px-6 py-3 w-12">
                              <input
                                type="checkbox"
                                checked={selectedUserIds.length === users.length && users.length > 0}
                                onChange={toggleSelectAll}
                                className="w-4 h-4 rounded border-zinc-300"
                              />
                            </th>
                            <th className="px-4 lg:px-6 py-3 font-semibold text-zinc-600">User</th>
                            <th className="px-4 lg:px-6 py-3 font-semibold text-zinc-600 hidden lg:table-cell">Email</th>
                            <th className="px-4 lg:px-6 py-3 font-semibold text-zinc-600">Role</th>
                            <th className="px-4 lg:px-6 py-3 font-semibold text-zinc-600">Status</th>
                            <th className="px-4 lg:px-6 py-3 font-semibold text-zinc-600 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200">
                          {users.map(user => (
                            <tr key={user.id} className="hover:bg-zinc-50 transition-colors group">
                              <td className="px-4 lg:px-6 py-4">
                                <input
                                  type="checkbox"
                                  checked={selectedUserIds.includes(user.id)}
                                  onChange={() => toggleSelectUser(user.id)}
                                  className="w-4 h-4 rounded border-zinc-300"
                                />
                              </td>
                              <td className="px-4 lg:px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="relative flex-shrink-0">
                                    <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-full overflow-hidden border-2 border-white shadow-sm">
                                      <img
                                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`}
                                        alt={user.name}
                                        className="w-full h-full"
                                      />
                                    </div>
                                    <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 lg:w-3 lg:h-3 rounded-full border-2 border-white ${user.status === 'Active' ? 'bg-emerald-500' : 'bg-zinc-400'}`}></div>
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-semibold text-zinc-900 truncate">{user.name}</p>
                                    {/* Email shown under name on tablet, hidden on desktop (shown in separate column) */}
                                    <p className="text-xs text-zinc-500 truncate lg:hidden">{user.email}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 lg:px-6 py-4 hidden lg:table-cell">
                                <span className="text-zinc-600 font-mono text-xs truncate block max-w-[200px]" title={user.email}>{user.email}</span>
                              </td>
                              <td className="px-4 lg:px-6 py-4">
                                <span className={`px-2 py-1 rounded-lg text-[10px] lg:text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1 ${user.role === 'Admin' ? 'bg-purple-100 text-purple-700 border border-purple-200' :
                                  user.role === 'Manager' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                                    user.role === 'Accountant' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                                      'bg-orange-100 text-orange-700 border border-orange-200'
                                  }`}>
                                  {user.role === 'Admin' && (
                                    <svg className="w-3 h-3 hidden lg:inline" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                  {user.role}
                                </span>
                              </td>
                              <td className="px-4 lg:px-6 py-4">
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] lg:text-xs font-bold ${user.status === 'Active'
                                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                  : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
                                  }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'Active' ? 'bg-emerald-500' : 'bg-zinc-400'}`}></span>
                                  {user.status}
                                </span>
                              </td>
                              <td className="px-4 lg:px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-1 lg:gap-2">
                                  <button
                                    onClick={() => openSetPasswordModal(user)}
                                    className="text-zinc-400 hover:text-blue-600 p-1.5 lg:p-1 transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
                                    title="Set password"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleToggleUserStatus(user)}
                                    className={`text-zinc-400 p-1.5 lg:p-1 transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center ${user.status === 'Active' ? 'hover:text-amber-600' : 'hover:text-emerald-600'}`}
                                    title={user.status === 'Active' ? 'Deactivate user' : 'Activate user'}
                                  >
                                    {user.status === 'Active' ? (
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
                                      </svg>
                                    ) : (
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12M6 12h12" />
                                      </svg>
                                    )}
                                  </button>
                                  <button
                                    onClick={() => openEditModal(user)}
                                    className="text-blue-600 hover:text-blue-800 p-1.5 lg:p-1 transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
                                    title="Edit user role"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => openDeleteDialog(user)}
                                    className="text-zinc-400 hover:text-red-600 p-1.5 lg:p-1 transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
                                    title="Delete user"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
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
                      <div className="px-4 py-3 bg-zinc-50 flex items-center justify-between">
                        <label className="flex items-center gap-2 text-sm font-medium text-zinc-600">
                          <input
                            type="checkbox"
                            checked={selectedUserIds.length === users.length && users.length > 0}
                            onChange={toggleSelectAll}
                            className="w-4 h-4 rounded border-zinc-300"
                          />
                          Select All
                        </label>
                        <span className="text-xs text-zinc-500">{users.length} user{users.length !== 1 ? 's' : ''}</span>
                      </div>
                      
                      <div className="divide-y divide-zinc-200">
                        {users.map(user => (
                          <div key={user.id} className="p-4 hover:bg-zinc-50 transition-colors">
                            {/* Top Row: Checkbox, Avatar, Name/Email, Actions */}
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={selectedUserIds.includes(user.id)}
                                onChange={() => toggleSelectUser(user.id)}
                                className="w-4 h-4 rounded border-zinc-300 flex-shrink-0"
                              />
                              <div className="relative flex-shrink-0">
                                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-sm">
                                  <img
                                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`}
                                    alt={user.name}
                                    className="w-full h-full"
                                  />
                                </div>
                                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${user.status === 'Active' ? 'bg-emerald-500' : 'bg-zinc-400'}`}></div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-zinc-900 truncate">{user.name}</p>
                                <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                              </div>
                              
                              {/* Actions Dropdown Area */}
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  onClick={() => openSetPasswordModal(user)}
                                  className="text-zinc-400 hover:text-blue-600 p-2 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                                  title="Set password"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => openEditModal(user)}
                                  className="text-blue-600 hover:text-blue-800 p-2 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                                  title="Edit user role"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => openDeleteDialog(user)}
                                  className="text-zinc-400 hover:text-red-600 p-2 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                                  title="Delete user"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                            
                            {/* Bottom Row: Role, Status, and Secondary Actions */}
                            <div className="flex items-center justify-between mt-3 pl-7">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${user.role === 'Admin' ? 'bg-purple-100 text-purple-700 border border-purple-200' :
                                  user.role === 'Manager' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                                    user.role === 'Accountant' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                                      'bg-orange-100 text-orange-700 border border-orange-200'
                                  }`}>
                                  {user.role}
                                </span>
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${user.status === 'Active'
                                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                  : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
                                  }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'Active' ? 'bg-emerald-500' : 'bg-zinc-400'}`}></span>
                                  {user.status}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => openSetPasswordModal(user)}
                                  className="text-zinc-400 hover:text-blue-600 p-2 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                                  title="Set password"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleToggleUserStatus(user)}
                                  className={`p-2 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center ${user.status === 'Active' ? 'text-zinc-400 hover:text-amber-600' : 'text-zinc-400 hover:text-emerald-600'}`}
                                  title={user.status === 'Active' ? 'Deactivate user' : 'Activate user'}
                                >
                                  {user.status === 'Active' ? (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
                                    </svg>
                                  ) : (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12M6 12h12" />
                                    </svg>
                                  )}
                                </button>
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

          {activeTab === 'requests' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-black text-zinc-900">Registration Requests</h2>
                  <p className="text-zinc-500 font-medium">Review and approve account requests from users</p>
                </div>
              </div>

              {saveStatus && (
                <div className="bg-blue-50 text-blue-700 px-6 py-4 rounded-xl border border-blue-200 font-bold flex items-center gap-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {saveStatus}
                </div>
              )}

              <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-zinc-50 border-b border-zinc-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-zinc-500">Name</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-zinc-500">Email</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-zinc-500">Role</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-zinc-500">Status</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-zinc-500">Requested</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-zinc-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {registrationRequests.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-zinc-400 font-medium">
                          No registration requests yet. Users can request access from the sign-in page.
                        </td>
                      </tr>
                    ) : (
                      registrationRequests.map((request) => (
                        <tr key={request.id} className="hover:bg-zinc-50 transition-colors">
                          <td className="px-6 py-4 font-semibold text-zinc-900">{request.name}</td>
                          <td className="px-6 py-4 text-zinc-600 font-mono text-sm">{request.email}</td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${request.role === 'Manager' ? 'bg-blue-100 text-blue-700' :
                              request.role === 'Accountant' ? 'bg-amber-100 text-amber-700' :
                                'bg-zinc-100 text-zinc-700'
                              }`}>
                              {request.role}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${request.status === 'Pending' ? 'bg-amber-100 text-amber-700' :
                              request.status === 'Approved' ? 'bg-green-100 text-green-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                              {request.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-zinc-600 text-sm">
                            {new Date(request.requested_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {request.status === 'Pending' && (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleApproveRequest(request.id)}
                                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all font-bold text-sm flex items-center gap-1"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleRejectRequest(request.id)}
                                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all font-bold text-sm flex items-center gap-1"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                  Reject
                                </button>
                              </div>
                            )}
                            {request.status !== 'Pending' && (
                              <span className="text-xs text-zinc-400 font-medium">
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
                  <h2 className="text-2xl font-black text-zinc-900">User Invitations</h2>
                  <p className="text-zinc-500 font-medium">Send email invitations to new team members</p>
                </div>
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all shadow-lg shadow-green-200 font-bold"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  Send Invitation
                </button>
              </div>

              {saveStatus && (
                <div className="bg-blue-50 text-blue-700 px-6 py-4 rounded-xl border border-blue-200 font-bold flex items-center gap-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {saveStatus}
                </div>
              )}

              <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-zinc-50 border-b border-zinc-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-zinc-500">Name</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-zinc-500">Email</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-zinc-500">Role</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-zinc-500">Status</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-zinc-500">Expires</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-zinc-500">Invited By</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-zinc-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {invites.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-zinc-400 font-medium">
                          No pending invitations. Click "Send Invitation" to invite team members.
                        </td>
                      </tr>
                    ) : (
                      invites.map((invite) => (
                        <tr key={invite.id} className="hover:bg-zinc-50 transition-colors">
                          <td className="px-6 py-4 font-semibold text-zinc-900">{invite.name}</td>
                          <td className="px-6 py-4 text-zinc-600 font-mono text-sm">{invite.email}</td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${invite.role === 'Admin' ? 'bg-purple-100 text-purple-700' :
                              invite.role === 'Manager' ? 'bg-blue-100 text-blue-700' :
                                invite.role === 'Accountant' ? 'bg-amber-100 text-amber-700' :
                                  'bg-zinc-100 text-zinc-700'
                              }`}>
                              {invite.role}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${invite.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                              invite.status === 'Accepted' ? 'bg-green-100 text-green-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                              {invite.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-zinc-600 text-sm">
                            {new Date(invite.expiresAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-zinc-600 text-sm">{invite.invitedBy}</td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {invite.status === 'Pending' && (
                                <>
                                  <button
                                    onClick={() => handleResendInvite(invite.id)}
                                    className="text-blue-600 hover:text-blue-800 p-1 transition-colors"
                                    title="Resend invitation"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteInvite(invite.id)}
                                    className="text-zinc-400 hover:text-red-600 p-1 transition-colors"
                                    title="Cancel invitation"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
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

          {activeTab === 'supabase' && dbConfig && (
            <div className="space-y-10">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-600 rounded-lg text-white">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-blue-900">Live Database Sync</h3>
                </div>
                <p className="text-blue-800 text-sm mb-6 leading-relaxed font-medium">
                  Enter your Supabase project credentials to transition from the mock environment to a live PostgreSQL production database.
                </p>
                <form onSubmit={handleDbSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-blue-900/60 tracking-widest ml-1">Project URL</label>
                    <input
                      type="text"
                      placeholder="https://xyz.supabase.co"
                      value={dbConfig.url}
                      onChange={(e) => setDbConfig({ ...dbConfig, url: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-blue-200 bg-transparent focus:ring-4 focus:ring-blue-100 outline-none font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-blue-900/60 tracking-widest ml-1">Anon API Key</label>
                    <input
                      type="password"
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      value={dbConfig.anonKey}
                      onChange={(e) => setDbConfig({ ...dbConfig, anonKey: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-blue-200 bg-transparent focus:ring-4 focus:ring-blue-100 outline-none font-mono text-sm"
                    />
                  </div>
                  <div className="pt-2 flex items-center justify-between">
                    <button
                      type="submit"
                      className="bg-blue-900 text-white font-bold px-8 py-3 rounded-xl shadow-lg shadow-blue-200 hover:bg-black transition-all font-sans"
                    >
                      Initialize Connection
                    </button>
                    {saveStatus && <span className="text-blue-600 font-black text-xs uppercase tracking-widest animate-pulse font-sans">{saveStatus}</span>}
                  </div>
                </form>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <div>
                    <h3 className="text-lg font-black text-zinc-900">Schema Generator</h3>
                    <p className="text-zinc-500 text-xs">Run this SQL in your Supabase SQL Editor to prepare your tables.</p>
                  </div>
                  <button
                    onClick={copyToClipboard}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-zinc-800 transition-all font-sans"
                  >
                    {copied ? (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth="3" /></svg>
                        Copied
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" strokeWidth="2.5" /></svg>
                        Copy SQL
                      </>
                    )}
                  </button>
                </div>
                <div className="relative group">
                  <div className="absolute inset-0 bg-blue-600 opacity-0 group-hover:opacity-5 blur-xl transition-opacity"></div>
                  <pre className="bg-zinc-900 text-zinc-300 p-6 rounded-2xl overflow-x-auto text-xs font-mono leading-relaxed ring-1 ring-zinc-800 relative z-10 shadow-2xl">
                    <code>{SQL_SCHEMA}</code>
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User Creation Modal */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={() => setShowUserModal(false)}></div>
          <div className="relative bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <h3 className="text-2xl font-black text-zinc-900 mb-6">Add New User</h3>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-zinc-700">Full Name</label>
                <input
                  required
                  type="text"
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  placeholder="John Doe"
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-zinc-700">Email Address</label>
                <input
                  required
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  placeholder="john@affinity.com"
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-zinc-700">Password</label>
                <input
                  required
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  placeholder="Min 8 characters"
                  minLength={8}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <p className="text-xs text-zinc-500">Must be at least 8 characters</p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-zinc-700">Role</label>
                <div className="space-y-2">
                  <div
                    onClick={() => setUserForm({ ...userForm, role: 'Admin' })}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${userForm.role === 'Admin'
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-zinc-200 hover:border-purple-300'
                      }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-zinc-900">Administrator</span>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${userForm.role === 'Admin' ? 'border-purple-500 bg-purple-500' : 'border-zinc-300'
                        }`}>
                        {userForm.role === 'Admin' && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-zinc-600">Full system access, user management, and all settings</p>
                  </div>

                  <div
                    onClick={() => setUserForm({ ...userForm, role: 'Manager' })}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${userForm.role === 'Manager'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-zinc-200 hover:border-blue-300'
                      }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-zinc-900">Manager</span>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${userForm.role === 'Manager' ? 'border-blue-500 bg-blue-500' : 'border-zinc-300'
                        }`}>
                        {userForm.role === 'Manager' && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-zinc-600">Dashboard, reports, vehicles, and operational data</p>
                  </div>

                  <div
                    onClick={() => setUserForm({ ...userForm, role: 'Accountant' })}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${userForm.role === 'Accountant'
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-zinc-200 hover:border-emerald-300'
                      }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-zinc-900">Accountant</span>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${userForm.role === 'Accountant' ? 'border-emerald-500 bg-emerald-500' : 'border-zinc-300'
                        }`}>
                        {userForm.role === 'Accountant' && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-zinc-600">Financial data, expenses, quotes, invoices, and payments</p>
                  </div>

                  <div
                    onClick={() => setUserForm({ ...userForm, role: 'Driver' })}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${userForm.role === 'Driver'
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-zinc-200 hover:border-orange-300'
                      }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-zinc-900">Driver</span>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${userForm.role === 'Driver' ? 'border-orange-500 bg-orange-500' : 'border-zinc-300'
                        }`}>
                        {userForm.role === 'Driver' && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-zinc-600">Driver portal, document uploads, and trip logs</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowUserModal(false);
                    setUserForm({ name: '', email: '', password: '', role: 'Driver', status: 'Active' });
                  }}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-sm text-zinc-500 border border-zinc-200 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-sm bg-blue-600 text-white hover:bg-blue-700"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Set Password Modal */}
      {showSetPasswordModal && userToSetPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={() => setShowSetPasswordModal(false)}></div>
          <div className="relative bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <div>
                <h3 className="text-2xl font-black text-zinc-900">Set Password</h3>
                <p className="text-sm text-zinc-500">Set a new password for {userToSetPassword.name}</p>
              </div>
            </div>
            <form onSubmit={handleSetPassword} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-zinc-700">New Password</label>
                <input
                  required
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  placeholder="Min 8 characters"
                  minLength={8}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-zinc-700">Confirm Password</label>
                <input
                  required
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  placeholder="Re-enter password"
                  minLength={8}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-xs text-amber-700 font-medium">
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
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-sm text-zinc-500 border border-zinc-200 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-sm bg-blue-600 text-white hover:bg-blue-700"
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
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={() => setShowEditModal(false)}></div>
          <div className="relative bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <h3 className="text-2xl font-black text-zinc-900 mb-6">Edit User</h3>
            <form onSubmit={handleEditUser} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-zinc-700">Full Name</label>
                <input
                  required
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="John Doe"
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-zinc-700">Email Address</label>
                <input
                  required
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  placeholder="john@affinity.com"
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-zinc-700">Role</label>
                <div className="space-y-2">
                  <div
                    onClick={() => setEditForm({ ...editForm, role: 'Admin' })}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${editForm.role === 'Admin'
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-zinc-200 hover:border-purple-300'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-zinc-900">Administrator</span>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${editForm.role === 'Admin' ? 'border-purple-500 bg-purple-500' : 'border-zinc-300'
                        }`}>
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
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${editForm.role === 'Manager'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-zinc-200 hover:border-blue-300'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-zinc-900">Manager</span>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${editForm.role === 'Manager' ? 'border-blue-500 bg-blue-500' : 'border-zinc-300'
                        }`}>
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
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${editForm.role === 'Accountant'
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-zinc-200 hover:border-emerald-300'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-zinc-900">Accountant</span>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${editForm.role === 'Accountant' ? 'border-emerald-500 bg-emerald-500' : 'border-zinc-300'
                        }`}>
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
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${editForm.role === 'Driver'
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-zinc-200 hover:border-orange-300'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-zinc-900">Driver</span>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${editForm.role === 'Driver' ? 'border-orange-500 bg-orange-500' : 'border-zinc-300'
                        }`}>
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
                <label className="text-sm font-semibold text-zinc-700">Status</label>
                <select
                  required
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value as ('Active' | 'Inactive') })}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-sm text-zinc-500 border border-zinc-200 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-sm bg-blue-600 text-white hover:bg-blue-700"
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
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={() => setShowInviteModal(false)}></div>
          <div className="relative bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-2xl font-black text-zinc-900">Send Invitation</h3>
                <p className="text-sm text-zinc-500">Invite a new team member via email</p>
              </div>
            </div>
            <form onSubmit={handleSendInvite} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-zinc-700">Full Name</label>
                <input
                  required
                  type="text"
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                  placeholder="John Doe"
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-zinc-700">Email Address</label>
                <input
                  required
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  placeholder="john@company.com"
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-zinc-700">Role</label>
                <select
                  required
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as UserRole })}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-green-500 outline-none"
                >
                  <option value="Driver">Driver</option>
                  <option value="Manager">Manager</option>
                  <option value="Accountant">Accountant</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-xs text-blue-700 font-medium">
                  📧 An email invitation will be sent with a secure signup link. The invitation expires in 7 days.
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-sm text-zinc-500 border border-zinc-200 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-sm bg-green-600 text-white hover:bg-green-700"
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
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={() => setShowDeleteDialog(false)}></div>
          <div className="relative bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-black text-zinc-900">Delete User</h3>
                <p className="text-sm text-zinc-500">This action cannot be undone</p>
              </div>
            </div>
            <div className="bg-zinc-50 rounded-xl p-4 mb-6">
              <p className="text-sm text-zinc-700">Are you sure you want to delete <span className="font-bold">{userToDelete.name}</span>?</p>
              <p className="text-xs text-zinc-500 mt-2">{userToDelete.email}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteDialog(false)}
                className="flex-1 px-4 py-3 rounded-xl font-bold text-sm text-zinc-500 border border-zinc-200 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                className="flex-1 px-4 py-3 rounded-xl font-bold text-sm bg-red-600 text-white hover:bg-red-700"
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
