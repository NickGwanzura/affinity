import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Login } from './components/Login';
import { AcceptInvite } from './components/AcceptInvite';
import { ResetPassword } from './components/ResetPassword';
import { ForcePasswordChange } from './components/ForcePasswordChange';
import { Layout, AppView } from './components/Layout';
import { ToastViewport } from './components/Toast';
import { AuthSession } from './types';
import { authService } from './services/authService';
import { SessionProvider } from './contexts/SessionContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { logger } from './utils/logger';
import { captureException } from './utils/sentry';

const AdminDashboard = lazy(() =>
  import('./components/AdminDashboard').then(module => ({ default: module.AdminDashboard }))
);
const AccountantDashboard = lazy(() =>
  import('./components/AccountantDashboard').then(module => ({
    default: module.AccountantDashboard,
  }))
);
const DriverPortal = lazy(() =>
  import('./components/DriverPortal').then(module => ({ default: module.DriverPortal }))
);
const Settings = lazy(() =>
  import('./components/Settings').then(module => ({ default: module.Settings }))
);
const Financials = lazy(() =>
  import('./components/Financials').then(module => ({ default: module.Financials }))
);
const Documents = lazy(() =>
  import('./components/Documents').then(module => ({ default: module.Documents }))
);
const ClientDirectory = lazy(() =>
  import('./components/ClientDirectory').then(module => ({ default: module.ClientDirectory }))
);
const Shipments = lazy(() =>
  import('./components/Shipments').then(module => ({ default: module.Shipments }))
);
const UpdateCenter = lazy(() =>
  import('./components/UpdateCenter').then(module => ({ default: module.UpdateCenter }))
);

/**
 * Layout-preserving skeleton used while lazy views load.
 * Mirrors the real page chrome (page header + KPI cards + table) so the
 * eventual content lands without layout shift. Sidebar/Topbar already
 * render outside the Suspense boundary so they need no skeleton here.
 */
const ScreenLoader = () => (
  <div
    aria-busy="true"
    aria-live="polite"
    aria-label="Loading workspace"
    className="space-y-6"
  >
    {/* Page header skeleton */}
    <div className="flex items-end justify-between gap-4">
      <div className="space-y-2">
        <div className="h-7 w-56 animate-pulse bg-gray-200" />
        <div className="h-4 w-72 animate-pulse bg-gray-100" />
      </div>
      <div className="h-10 w-32 animate-pulse bg-gray-200" />
    </div>

    {/* KPI row skeleton — matches DashboardCard / StatCard chrome */}
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="relative bg-white border border-[#e0e0e0] p-6">
          <div className="absolute inset-y-0 left-0 w-[3px] bg-gray-200" />
          <div className="pl-2 space-y-3">
            <div className="h-3 w-24 animate-pulse bg-gray-200" />
            <div className="h-8 w-32 animate-pulse bg-gray-200" />
            <div className="h-3 w-20 animate-pulse bg-gray-100" />
          </div>
        </div>
      ))}
    </div>

    {/* Content block skeleton — table-ish */}
    <div className="bg-white border border-[#e0e0e0]">
      <div className="border-b border-[#e0e0e0] p-4">
        <div className="h-5 w-40 animate-pulse bg-gray-200" />
      </div>
      <div className="divide-y divide-[#f5f5f4]">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4 p-4">
            <div className="h-4 flex-[2] animate-pulse bg-gray-100" />
            <div className="h-4 flex-1 animate-pulse bg-gray-100" />
            <div className="h-4 flex-1 animate-pulse bg-gray-100" />
            <div className="h-4 flex-1 animate-pulse bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [currentView, setCurrentView] = useState<AppView>('admin');
  const [routePath, setRoutePath] = useState<string>(window.location.pathname || '/');
  const [loading, setLoading] = useState(true);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [forcePasswordChange, setForcePasswordChange] = useState(false);

  const navigate = (path: string, replace = false) => {
    if (window.location.pathname === path) {
      setRoutePath(path);
      return;
    }

    if (replace) {
      window.history.replaceState({}, document.title, path);
    } else {
      window.history.pushState({}, document.title, path);
    }
    setRoutePath(path);
  };

  const resolveDefaultView = (role: string) => {
    if (role === 'Driver') return 'driver' as const;
    if (role === 'Accountant') return 'accountant' as const;
    return 'admin' as const;
  };

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
      (fullUrl.includes('token=') && (fullUrl.includes('reset') || fullUrl.includes('recovery')))
    ) {
      setIsResetPassword(true);
    }

    const checkSession = async () => {
      try {
        const s = await authService.getSession();
        setSession(s);

        if (s) {
          if (s.forcePasswordChange) {
            setForcePasswordChange(true);
          } else {
            setCurrentView(resolveDefaultView(s.user.role));
          }
        }
      } catch (error) {
        logger.error('Error checking session', { err: error });
        captureException(error, { stage: 'app.checkSession' });
      } finally {
        setLoading(false);
      }
    };
    checkSession();

    const onPopState = () => {
      setRoutePath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (loading) return;

    if (!session) {
      if (routePath !== '/login') {
        navigate('/login', true);
      }
      return;
    }

    if (forcePasswordChange) return;

    if (routePath !== '/dashboard') {
      navigate('/dashboard', true);
    }
  }, [loading, routePath, session, forcePasswordChange]);

  const handleLogin = (newSession: AuthSession) => {
    setSession(newSession);
    setInviteToken(null);

    if (newSession.forcePasswordChange) {
      setForcePasswordChange(true);
      return;
    }

    const nextView = resolveDefaultView(newSession.user.role);
    setCurrentView(nextView);
    navigate('/dashboard', true);
  };

  const handleLogout = async () => {
    await authService.logout();
    setSession(null);
    setForcePasswordChange(false);
    navigate('/login', true);
  };

  const refreshSession = async (): Promise<AuthSession | null> => {
    try {
      const s = await authService.getSession();
      setSession(s);
      return s;
    } catch (error) {
      logger.error('Error refreshing session', { err: error });
      captureException(error, { stage: 'app.refreshSession' });
      return null;
    }
  };

  const clearSession = () => {
    setSession(null);
    setForcePasswordChange(false);
    navigate('/login', true);
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'admin':
        return <ErrorBoundary view="admin"><AdminDashboard /></ErrorBoundary>;
      case 'accountant':
        return <ErrorBoundary view="accountant"><AccountantDashboard /></ErrorBoundary>;
      case 'driver':
        return <ErrorBoundary view="driver"><DriverPortal /></ErrorBoundary>;
      case 'settings':
        return <ErrorBoundary view="settings"><Settings /></ErrorBoundary>;
      case 'financials':
        return <ErrorBoundary view="financials"><Financials /></ErrorBoundary>;
      case 'documents':
        return <ErrorBoundary view="documents"><Documents /></ErrorBoundary>;
      case 'clients':
        return <ErrorBoundary view="clients"><ClientDirectory /></ErrorBoundary>;
      case 'shipments':
        return <ErrorBoundary view="shipments"><Shipments /></ErrorBoundary>;
      case 'updates':
        return <ErrorBoundary view="updates"><UpdateCenter /></ErrorBoundary>;
      default:
        return <ErrorBoundary view="admin"><AdminDashboard /></ErrorBoundary>;
    }
  };

  let content: React.ReactNode;

  if (loading) {
    content = (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-blue-600" size={32} />
          <span className="text-sm text-gray-600">Initializing Affinity Logistics...</span>
        </div>
      </div>
    );
  } else if (session && forcePasswordChange) {
    content = (
      <ForcePasswordChange
        userId={session.user.id}
        userName={session.user.name}
        onComplete={() => {
          setForcePasswordChange(false);
          const nextView = resolveDefaultView(session.user.role);
          setCurrentView(nextView);
          navigate('/dashboard', true);
        }}
        onLogout={handleLogout}
      />
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
      <SessionProvider
        session={session}
        refreshSession={refreshSession}
        clearSession={clearSession}
      >
        <Layout
          currentView={currentView}
          onNavigate={setCurrentView}
          user={session.user}
          onLogout={handleLogout}
        >
          <Suspense fallback={<ScreenLoader />}>{renderCurrentView()}</Suspense>
        </Layout>
      </SessionProvider>
    );
  }

  return (
    <>
      <ToastViewport />
      {content}
    </>
  );
}
