import React, { useEffect, useState } from 'react';
import { ZodError } from 'zod';
import { Button, Tag, InlineNotification } from '../ui';
import { Mail, RefreshCw, Trash2, Copy } from 'lucide-react';
import { UserInvite, UserRole } from '../../types';
import { dataService } from '../../services/dataService';
import { useToast } from '../Toast';
import { inviteFormSchema, getFirstValidationMessage } from '../../utils/clientValidation';

interface InvitesTabProps {
  inviterEmail: string;
  onPendingCountChange?: (count: number) => void;
}

export const InvitesTab: React.FC<InvitesTabProps> = ({ inviterEmail, onPendingCountChange }) => {
  const { showToast } = useToast();
  const [invites, setInvites] = useState<UserInvite[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string>('');
  const [inviteForm, setInviteForm] = useState({
    name: '',
    email: '',
    role: 'Driver' as UserRole,
  });

  const setStatusMessage = (
    message: string,
    toastType: Parameters<typeof showToast>[1] = 'success'
  ) => {
    setSaveStatus(message);
    showToast(message, toastType);
    window.setTimeout(() => setSaveStatus(''), 4000);
  };

  const applyInvites = (next: UserInvite[]) => {
    setInvites(next);
    onPendingCountChange?.(next.filter(i => i.status === 'Pending').length);
  };

  useEffect(() => {
    dataService
      .getInvites()
      .then(i => applyInvites(Array.isArray(i) ? i : []))
      .catch((e: unknown) => {
        console.error('[Settings] getInvites:', e);
        applyInvites([]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      inviteFormSchema.parse(inviteForm);
      const invite = await dataService.createInvite(
        inviteForm.email,
        inviteForm.role,
        inviteForm.name,
        inviterEmail
      );
      applyInvites([...invites, invite]);
      setShowInviteModal(false);
      setInviteForm({ name: '', email: '', role: 'Driver' });
      setStatusMessage(
        'Invite created successfully. Share the invite link from the Invitations tab.'
      );
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
      applyInvites(invites.filter(i => i.id !== inviteId));
      setStatusMessage('Invite cancelled successfully.');
    } catch (error: any) {
      console.error('Error deleting invite:', error);
      showToast('Failed to cancel invite. Please try again.', 'error');
    }
  };

  const handleResendInvite = async (inviteId: string) => {
    try {
      const updatedInvite = await dataService.resendInvite(inviteId);
      applyInvites(invites.map(i => (i.id === inviteId ? updatedInvite : i)));
      setStatusMessage(
        'Invite refreshed successfully. Share the updated invite link from the Invitations tab.'
      );
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2
            className="text-2xl font-black"
            style={{ color: 'var(--cds-text-primary, #161616)' }}
          >
            User Invitations
          </h2>
          <p
            className="font-medium"
            style={{ color: 'var(--cds-text-secondary, #525252)' }}
          >
            Send email invitations to new team members
          </p>
        </div>
        <Button onClick={() => setShowInviteModal(true)} leftIcon={<Mail size={14} />}>
          Send Invitation
        </Button>
      </div>

      {saveStatus && (
        <InlineNotification
          kind="info"
          title="Info"
          subtitle={saveStatus}
          hideCloseButton
        />
      )}

      <div
        className="overflow-hidden"
        style={{
          background: 'var(--cds-layer-01, #ffffff)',
          border: '1px solid var(--cds-border-subtle, #c6c6c6)',
        }}
      >
        <table className="w-full">
          <thead
            style={{
              background: 'var(--cds-layer-02, #f4f4f4)',
              borderBottom: '1px solid var(--cds-border-subtle, #c6c6c6)',
            }}
          >
            <tr>
              <th
                className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest"
                style={{ color: 'var(--cds-text-secondary, #525252)' }}
              >
                Name
              </th>
              <th
                className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest"
                style={{ color: 'var(--cds-text-secondary, #525252)' }}
              >
                Email
              </th>
              <th
                className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest"
                style={{ color: 'var(--cds-text-secondary, #525252)' }}
              >
                Role
              </th>
              <th
                className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest"
                style={{ color: 'var(--cds-text-secondary, #525252)' }}
              >
                Status
              </th>
              <th
                className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest"
                style={{ color: 'var(--cds-text-secondary, #525252)' }}
              >
                Expires
              </th>
              <th
                className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest"
                style={{ color: 'var(--cds-text-secondary, #525252)' }}
              >
                Invited By
              </th>
              <th
                className="px-6 py-4 text-right text-xs font-black uppercase tracking-widest"
                style={{ color: 'var(--cds-text-secondary, #525252)' }}
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody style={{ borderTop: '1px solid var(--cds-border-subtle, #c6c6c6)' }}>
            {invites.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-6 py-12 text-center font-medium"
                  style={{ color: 'var(--cds-text-disabled, #8d8d8d)' }}
                >
                  No pending invitations. Click "Send Invitation" to invite team members.
                </td>
              </tr>
            ) : (
              invites.map(invite => (
                <tr
                  key={invite.id}
                  style={{ borderBottom: '1px solid var(--cds-border-subtle, #c6c6c6)' }}
                >
                  <td
                    className="px-6 py-4 font-semibold"
                    style={{ color: 'var(--cds-text-primary, #161616)' }}
                  >
                    {invite.name}
                  </td>
                  <td
                    className="px-6 py-4 font-mono text-sm"
                    style={{ color: 'var(--cds-text-secondary, #525252)' }}
                  >
                    {invite.email}
                  </td>
                  <td className="px-6 py-4">
                    <Tag
                      type={
                        invite.role === 'Admin'
                          ? 'purple'
                          : invite.role === 'Manager'
                            ? 'blue'
                            : invite.role === 'Accountant'
                              ? 'warm-gray'
                              : 'cyan'
                      }
                      size="sm"
                    >
                      {invite.role}
                    </Tag>
                  </td>
                  <td className="px-6 py-4">
                    <Tag
                      type={
                        invite.status === 'Pending'
                          ? 'warm-gray'
                          : invite.status === 'Accepted'
                            ? 'green'
                            : 'red'
                      }
                      size="sm"
                    >
                      {invite.status}
                    </Tag>
                  </td>
                  <td
                    className="px-6 py-4 text-sm"
                    style={{ color: 'var(--cds-text-secondary, #525252)' }}
                  >
                    {new Date(invite.expiresAt).toLocaleDateString()}
                  </td>
                  <td
                    className="px-6 py-4 text-sm"
                    style={{ color: 'var(--cds-text-secondary, #525252)' }}
                  >
                    {invite.invitedBy}
                  </td>
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

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 backdrop-blur-sm cursor-pointer"
            style={{ background: 'rgba(22, 22, 22, 0.4)' }}
            onClick={() => setShowInviteModal(false)}
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
                style={{
                  borderRadius: '50%',
                  background: 'var(--cds-tag-background-green, #defbe6)',
                }}
              >
                <svg
                  className="w-6 h-6"
                  style={{ color: 'var(--cds-support-success, #24a148)' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div>
                <h3
                  className="text-2xl font-black"
                  style={{ color: 'var(--cds-text-primary, #161616)' }}
                >
                  Send Invitation
                </h3>
                <p className="text-sm" style={{ color: 'var(--cds-text-secondary, #525252)' }}>
                  Invite a new team member via email
                </p>
              </div>
            </div>
            <form onSubmit={handleSendInvite} className="space-y-4">
              <div className="space-y-1">
                <label
                  className="text-sm font-semibold"
                  style={{ color: 'var(--cds-text-secondary, #525252)' }}
                >
                  Full Name
                </label>
                <input
                  required
                  type="text"
                  value={inviteForm.name}
                  onChange={e => setInviteForm({ ...inviteForm, name: e.target.value })}
                  placeholder="John Doe"
                  className="w-full px-4 py-3 outline-none"
                  style={{ border: '1px solid var(--cds-border-subtle, #c6c6c6)' }}
                />
              </div>
              <div className="space-y-1">
                <label
                  className="text-sm font-semibold"
                  style={{ color: 'var(--cds-text-secondary, #525252)' }}
                >
                  Email Address
                </label>
                <input
                  required
                  type="email"
                  value={inviteForm.email}
                  onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })}
                  placeholder="john@company.com"
                  className="w-full px-4 py-3 outline-none"
                  style={{ border: '1px solid var(--cds-border-subtle, #c6c6c6)' }}
                />
              </div>
              <div className="space-y-1">
                <label
                  className="text-sm font-semibold"
                  style={{ color: 'var(--cds-text-secondary, #525252)' }}
                >
                  Role
                </label>
                <select
                  required
                  value={inviteForm.role}
                  onChange={e => setInviteForm({ ...inviteForm, role: e.target.value as UserRole })}
                  className="w-full px-4 py-3 outline-none"
                  style={{ border: '1px solid var(--cds-border-subtle, #c6c6c6)' }}
                >
                  <option value="Driver">Driver</option>
                  <option value="Manager">Manager</option>
                  <option value="Accountant">Accountant</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
              <div
                className="p-4"
                style={{
                  background: 'var(--cds-layer-selected-01, #e5f6ff)',
                  border: '1px solid var(--cds-border-subtle, #c6c6c6)',
                }}
              >
                <p
                  className="text-xs font-medium"
                  style={{ color: 'var(--cds-text-secondary, #525252)' }}
                >
                  📧 An email invitation will be sent with a secure signup link. The invitation
                  expires in 7 days.
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 px-4 py-3 font-bold text-sm"
                  style={{
                    color: 'var(--cds-text-secondary, #525252)',
                    border: '1px solid var(--cds-border-subtle, #c6c6c6)',
                  }}
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
    </div>
  );
};

export default InvitesTab;
