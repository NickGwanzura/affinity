
import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Loading, InlineLoading } from '@carbon/react';
import { Login } from './components/Login';
import { AcceptInvite } from './components/AcceptInvite';
import { ResetPassword } from './components/ResetPassword';
import { Layout, AppView } from './components/Layout';
import { ToastViewport } from './components/Toast';
import { AuthSession } from './types';
import { authService } from './services/authService';

const AdminDashboard = lazy(() =>
  import('./components/AdminDashboard').then((module) => ({ default: module.AdminDashboard }))
);
const AccountantDashboard = lazy(() =>
  import('./components/AccountantDashboard').then((module) => ({ default: module.AccountantDashboard }))
);
const DriverPortal = lazy(() =>
  import('./components/DriverPortal').then((module) => ({ default: module.DriverPortal }))
);
const Settings = lazy(() =>
  import('./components/Settings').then((module) => ({ default: module.Settings }))
);
const Financials = lazy(() =>
  import('./components/Financials').then((module) => ({ default: module.Financials }))
);
const Documents = lazy(() =>
  import('./components/Documents').then((module) => ({ default: module.Documents }))
);
const ClientDirectory = lazy(() =>
  import('./components/ClientDirectory').then((module) => ({ default: module.ClientDirectory }))
);

const ScreenLoader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
    <InlineLoading description="Loading workspace..." status="active" />
  </div>
);

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [currentView, setCurrentView] = useState<AppView>('admin');
  const [loading, setLoading] = useState(true);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [isResetPassword, setIsResetPassword] = useState(false);

  useEffect(() => {
    // Check for invite token in URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) setInviteToken(token);

    // Check for password reset hash (multiple formats)
    const hash = window.location.hash;
    const search = window.location.search;
    const fullUrl = hash + search;
    
    // Neon Auth can send different formats:
    // #type=recovery&token=xxx
    // #access_token=xxx&type=recovery
    // ?type=recovery&token=xxx
    if (
      fullUrl.includes('type=recovery') ||
      fullUrl.includes('token=') && (fullUrl.includes('reset') || fullUrl.includes('recovery'))
    ) {
      setIsResetPassword(true);
    }

    const checkSession = async () => {
      try {
        const s = await authService.getSession();
        setSession(s);

        // Default view based on role
        if (s) {
          if (s.user.role === 'Driver') setCurrentView('driver');
          else if (s.user.role === 'Accountant') setCurrentView('accountant');
          else setCurrentView('admin');
        }
      } catch (error) {
        console.error('Error checking session:', error);
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  const handleLogin = (newSession: AuthSession) => {
    setSession(newSession);
    if (newSession.user.role === 'Driver') setCurrentView('driver');
    else if (newSession.user.role === 'Accountant') setCurrentView('accountant');
    else setCurrentView('admin');
    // Clear token if any
    setInviteToken(null);
    window.history.replaceState({}, document.title, window.location.pathname);
  };

  const handleLogout = async () => {
    await authService.logout();
    setSession(null);
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'admin':
        return <AdminDashboard />;
      case 'accountant':
        return <AccountantDashboard />;
      case 'driver':
        return <DriverPortal />;
      case 'settings':
        return <Settings />;
      case 'financials':
        return <Financials />;
      case 'documents':
        return <Documents />;
      case 'clients':
        return <ClientDirectory />;
      default:
        return <AdminDashboard />;
    }
  };

  let content: React.ReactNode;

  if (loading) {
    content = (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--cds-background, #f4f4f4)' }}>
        <Loading description="Initializing Affinity Logistics..." withOverlay={false} />
      </div>
    );
  } else if (!session) {
    if (isResetPassword) {
      content = (
        <ResetPassword
          onComplete={() => {
            setIsResetPassword(false);
            window.history.replaceState({}, document.title, window.location.pathname);
          }}
        />
      );
    } else if (inviteToken) {
      content = (
        <AcceptInvite
          token={inviteToken}
          onSuccess={handleLogin}
          onCancel={() => {
            setInviteToken(null);
            window.history.replaceState({}, document.title, window.location.pathname);
          }}
        />
      );
    } else {
      content = <Login onLogin={handleLogin} />;
    }
  } else {
    content = (
      <Layout
        currentView={currentView}
        onNavigate={setCurrentView}
        user={session.user}
        onLogout={handleLogout}
      >
        <Suspense fallback={<ScreenLoader />}>
          {renderCurrentView()}
        </Suspense>
      </Layout>
    );
  }

  return (
    <>
      <ToastViewport />
      {content}
    </>
  );
}
