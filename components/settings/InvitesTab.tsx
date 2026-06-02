import React, { useEffect, useState } from 'react';
import { ZodError } from 'zod';
import { Button, Tag, InlineNotification, Modal, TextInput, Select, SelectItem } from '../ui';
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
            style={{ color: 'var(--cds-text-primary, #18181b)' }}
          >
            User Invitations
          </h2>
          <p
            className="font-medium"
            style={{ color: 'var(--cds-text-secondary, #52525b)' }}
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
          border: '1px solid var(--cds-border-subtle, #d6d3d1)',
        }}
      >
        <table className="w-full">
          <thead
            style={{
              background: 'var(--cds-layer-02, #ffffff)',
              borderBottom: '1px solid var(--cds-border-subtle, #d6d3d1)',
            }}
          >
            <tr>
              <th
                className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest"
                style={{ color: 'var(--cds-text-secondary, #52525b)' }}
              >
                Name
              </th>
              <th
                className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest"
                style={{ color: 'var(--cds-text-secondary, #52525b)' }}
              >
                Email
              </th>
              <th
                className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest"
                style={{ color: 'var(--cds-text-secondary, #52525b)' }}
              >
                Role
              </th>
              <th
                className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest"
                style={{ color: 'var(--cds-text-secondary, #52525b)' }}
              >
                Status
              </th>
              <th
                className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest"
                style={{ color: 'var(--cds-text-secondary, #52525b)' }}
              >
                Expires
              </th>
              <th
                className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest"
                style={{ color: 'var(--cds-text-secondary, #52525b)' }}
              >
                Invited By
              </th>
              <th
                className="px-6 py-4 text-right text-xs font-black uppercase tracking-widest"
                style={{ color: 'var(--cds-text-secondary, #52525b)' }}
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody style={{ borderTop: '1px solid var(--cds-border-subtle, #d6d3d1)' }}>
            {invites.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-6 py-12 text-center font-medium"
                  style={{ color: 'var(--cds-text-disabled, #a8a29e)' }}
                >
                  No pending invitations. Click "Send Invitation" to invite team members.
                </td>
              </tr>
            ) : (
              invites.map(invite => (
                <tr
                  key={invite.id}
                  style={{ borderBottom: '1px solid var(--cds-border-subtle, #d6d3d1)' }}
                >
                  <td
                    className="px-6 py-4 font-semibold"
                    style={{ color: 'var(--cds-text-primary, #18181b)' }}
                  >
                    {invite.name}
                  </td>
                  <td
                    className="px-6 py-4 font-mono text-sm"
                    style={{ color: 'var(--cds-text-secondary, #52525b)' }}
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
                    style={{ color: 'var(--cds-text-secondary, #52525b)' }}
                  >
                    {new Date(invite.expiresAt).toLocaleDateString()}
                  </td>
                  <td
                    className="px-6 py-4 text-sm"
                    style={{ color: 'var(--cds-text-secondary, #52525b)' }}
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
      <Modal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Send Invitation"
        label="Team member"
        size="sm"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" type="button" onClick={() => setShowInviteModal(false)}>
              Cancel
            </Button>
            <Button type="submit" form="invite-form" leftIcon={<Mail size={14} />}>
              Send Invite
            </Button>
          </div>
        }
      >
        <form id="invite-form" onSubmit={handleSendInvite} className="flex flex-col gap-5">
          <TextInput
            id="invite-name"
            labelText="Full Name"
            placeholder="John Doe"
            autoFocus
            value={inviteForm.name}
            onChange={e => setInviteForm({ ...inviteForm, name: e.target.value })}
          />
          <TextInput
            id="invite-email"
            type="email"
            labelText="Email Address"
            placeholder="john@company.com"
            autoComplete="email"
            value={inviteForm.email}
            onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })}
          />
          <Select
            id="invite-role"
            labelText="Role"
            value={inviteForm.role}
            onChange={e => setInviteForm({ ...inviteForm, role: e.target.value as UserRole })}
          >
            <SelectItem value="Driver" text="Driver" />
            <SelectItem value="Manager" text="Manager" />
            <SelectItem value="Accountant" text="Accountant" />
            <SelectItem value="Sales" text="Sales" />
            <SelectItem value="Admin" text="Admin" />
          </Select>
          <InlineNotification
            kind="info"
            title="Note:"
            subtitle="An invitation will be created with a secure signup link that expires in 7 days."
            hideCloseButton
          />
        </form>
      </Modal>
    </div>
  );
};

export default InvitesTab;
