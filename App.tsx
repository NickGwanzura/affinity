
import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Login } from './components/Login';
import { AcceptInvite } from './components/AcceptInvite';
import { ResetPassword } from './components/ResetPassword';
import { Layout, AppView } from './components/Layout';
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
  <div className="min-h-[40vh] flex items-center justify-center">
    <div className="flex items-center gap-3 text-zinc-500">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <span className="text-sm font-bold uppercase tracking-widest">Loading workspace</span>
    </div>
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) {
    // Show password reset page
    if (isResetPassword) {
      return (
        <ResetPassword 
          onComplete={() => {
            setIsResetPassword(false);
            // Clear the hash from URL
            window.history.replaceState({}, document.title, window.location.pathname);
          }} 
        />
      );
    }

    if (inviteToken) {
      return (
        <AcceptInvite
          token={inviteToken}
          onSuccess={handleLogin}
          onCancel={() => {
            setInviteToken(null);
            window.history.replaceState({}, document.title, window.location.pathname);
          }}
        />
      );
    }
    return <Login onLogin={handleLogin} />;
  }

  return (
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
