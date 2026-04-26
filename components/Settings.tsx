import React, { useEffect, useState } from 'react';
import { DashboardPageHeader } from './ui';
import { CompanyDetails } from '../types';
import { dataService } from '../services/dataService';
import { useSession } from '../contexts/SessionContext';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmModal';
import { CompanyTab } from './settings/CompanyTab';
import { UsersTab } from './settings/UsersTab';
import { ForensicsTab } from './settings/ForensicsTab';
import { RequestsTab } from './settings/RequestsTab';
import { InvitesTab } from './settings/InvitesTab';
import { SettingsTabBar, SettingsTabKey } from './settings/SettingsTabBar';

export const Settings: React.FC = () => {
  const { ToastContainer } = useToast();
  const { ConfirmDialog } = useConfirm();
  const session = useSession();
  const [activeTab, setActiveTab] = useState<SettingsTabKey>('company');
  const [company, setCompany] = useState<CompanyDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [pendingInvites, setPendingInvites] = useState(0);

  // Shell loads only the company details + lightweight badge counts.
  // Per-tab data fetches happen inside each tab on mount.
  useEffect(() => {
    const load = async () => {
      const [c, invites, requests] = await Promise.all([
        dataService.getCompanyDetails().catch((e: unknown) => {
          console.error('[Settings] getCompanyDetails:', e);
          return null;
        }),
        dataService.getInvites().catch((e: unknown) => {
          console.error('[Settings] getInvites (badge):', e);
          return [];
        }),
        dataService.getRegistrationRequests().catch((e: unknown) => {
          console.error('[Settings] getRegistrationRequests (badge):', e);
          return [];
        }),
      ]);
      setCompany(c);
      setPendingInvites(
        Array.isArray(invites) ? invites.filter(i => i.status === 'Pending').length : 0
      );
      setPendingRequests(
        Array.isArray(requests) ? requests.filter(r => r.status === 'Pending').length : 0
      );
      setLoading(false);
    };
    load();
  }, []);

  if (loading)
    return (
      <div className="flex items-center justify-center h-64 font-sans">
        <div
          className="animate-spin h-8 w-8 border-b-2"
          style={{ borderColor: 'var(--cds-interactive, #D97706)' }}
        ></div>
      </div>
    );

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'company':
        return <CompanyTab company={company} setCompany={setCompany} />;
      case 'users':
        return <UsersTab onSwitchToInvites={() => setActiveTab('invites')} />;
      case 'forensics':
        return <ForensicsTab />;
      case 'requests':
        return <RequestsTab onPendingCountChange={setPendingRequests} />;
      case 'invites':
        return (
          <InvitesTab
            inviterEmail={session?.user?.email || 'admin'}
            onPendingCountChange={setPendingInvites}
          />
        );
    }
  };

  return (
    <div className="max-w-[90rem] mx-auto font-sans px-4 lg:px-8">
      <ToastContainer />
      <ConfirmDialog />
      <div className="mb-8">
        <DashboardPageHeader
          title="Settings"
          subtitle="Organisation, users, and system configuration"
        />
      </div>

      <div
        className="overflow-hidden"
        style={{
          background: 'var(--cds-layer-01, #ffffff)',
          border: '1px solid var(--cds-border-subtle, #d6d3d1)',
        }}
      >
        <SettingsTabBar
          activeTab={activeTab}
          onChange={setActiveTab}
          pendingRequests={pendingRequests}
          pendingInvites={pendingInvites}
        />
        <div className="p-8">{renderActiveTab()}</div>
      </div>
    </div>
  );
};
