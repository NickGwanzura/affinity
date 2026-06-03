import React, { useEffect, useState } from 'react';
import { Button, Tag, InlineNotification } from '../ui';
import { RegistrationRequest } from '../../types';
import { dataService } from '../../services/dataService';
import { useSession } from '../../contexts/SessionContext';
import { useToast } from '../Toast';

interface RequestsTabProps {
  onPendingCountChange?: (count: number) => void;
}

export const RequestsTab: React.FC<RequestsTabProps> = ({ onPendingCountChange }) => {
  const { showToast } = useToast();
  const session = useSession();
  const [registrationRequests, setRegistrationRequests] = useState<RegistrationRequest[]>([]);
  const [saveStatus, setSaveStatus] = useState<string>('');

  const setStatusMessage = (
    message: string,
    toastType: Parameters<typeof showToast>[1] = 'success'
  ) => {
    setSaveStatus(message);
    showToast(message, toastType);
    window.setTimeout(() => setSaveStatus(''), 4000);
  };

  useEffect(() => {
    dataService
      .getRegistrationRequests()
      .then(r => {
        const list = Array.isArray(r) ? r : [];
        setRegistrationRequests(list);
        onPendingCountChange?.(list.filter(x => x.status === 'Pending').length);
      })
      .catch((e: unknown) => {
        console.error('[Settings] getRegistrationRequests:', e);
        setRegistrationRequests([]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApproveRequest = async (requestId: string) => {
    try {
      await dataService.approveRegistrationRequest(requestId, session?.user?.id || 'admin');
      const updatedRequests = await dataService.getRegistrationRequests();
      setRegistrationRequests(updatedRequests);
      onPendingCountChange?.(updatedRequests.filter(x => x.status === 'Pending').length);
      setStatusMessage(
        'Registration approved. An invite was created so the user can set a password.'
      );
    } catch (error: any) {
      console.error('Error approving request:', error);
      const errorMessage = error.message || 'Unknown error';
      showToast(`Failed to approve registration: ${errorMessage}`, 'error');
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await dataService.rejectRegistrationRequest(requestId, session?.user?.id || 'admin');
      const updatedRequests = await dataService.getRegistrationRequests();
      setRegistrationRequests(updatedRequests);
      onPendingCountChange?.(updatedRequests.filter(x => x.status === 'Pending').length);
      setStatusMessage('Registration request rejected.');
    } catch (error: any) {
      console.error('Error rejecting request:', error);
      showToast('Failed to reject registration. Please try again.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2
            className="text-2xl font-black"
            style={{ color: '#18181b' }}
          >
            Registration Requests
          </h2>
          <p
            className="font-medium"
            style={{ color: '#52525b' }}
          >
            Review and approve account requests from users
          </p>
        </div>
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
          background: '#ffffff',
          border: '1px solid #d6d3d1',
        }}
      >
        <table className="w-full">
          <thead
            style={{
              background: '#ffffff',
              borderBottom: '1px solid #d6d3d1',
            }}
          >
            <tr>
              <th
                className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest"
                style={{ color: '#52525b' }}
              >
                Name
              </th>
              <th
                className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest"
                style={{ color: '#52525b' }}
              >
                Email
              </th>
              <th
                className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest"
                style={{ color: '#52525b' }}
              >
                Role
              </th>
              <th
                className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest"
                style={{ color: '#52525b' }}
              >
                Status
              </th>
              <th
                className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest"
                style={{ color: '#52525b' }}
              >
                Requested
              </th>
              <th
                className="px-6 py-4 text-right text-xs font-black uppercase tracking-widest"
                style={{ color: '#52525b' }}
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody style={{ borderTop: '1px solid #d6d3d1' }}>
            {registrationRequests.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-12 text-center font-medium"
                  style={{ color: '#a8a29e' }}
                >
                  No registration requests yet. Users can request access from the sign-in
                  page.
                </td>
              </tr>
            ) : (
              registrationRequests.map(request => (
                <tr
                  key={request.id}
                  style={{ borderBottom: '1px solid #d6d3d1' }}
                >
                  <td
                    className="px-6 py-4 font-semibold"
                    style={{ color: '#18181b' }}
                  >
                    {request.name}
                  </td>
                  <td
                    className="px-6 py-4 font-mono text-sm"
                    style={{ color: '#52525b' }}
                  >
                    {request.email}
                  </td>
                  <td className="px-6 py-4">
                    <Tag
                      type={
                        request.role === 'Manager'
                          ? 'blue'
                          : request.role === 'Accountant'
                            ? 'warm-gray'
                            : 'cyan'
                      }
                      size="sm"
                    >
                      {request.role}
                    </Tag>
                  </td>
                  <td className="px-6 py-4">
                    <Tag
                      type={
                        request.status === 'Pending'
                          ? 'warm-gray'
                          : request.status === 'Approved'
                            ? 'green'
                            : 'red'
                      }
                      size="sm"
                    >
                      {request.status}
                    </Tag>
                  </td>
                  <td
                    className="px-6 py-4 text-sm"
                    style={{ color: '#52525b' }}
                  >
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
                      <span
                        className="text-xs font-medium"
                        style={{ color: '#a8a29e' }}
                      >
                        Reviewed{' '}
                        {request.reviewed_at
                          ? new Date(request.reviewed_at).toLocaleDateString()
                          : ''}
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
  );
};

export default RequestsTab;
