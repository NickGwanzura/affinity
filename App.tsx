
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
    <div className="flex items-center gap-2 text-gray-500">
      <Loader2 className="animate-spin" size={20} />
      <span className="text-sm">Loading workspace...</span>
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

  const resolveTenantDefaultView = (role: string) => {
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
      fullUrl.includes('token=') && (fullUrl.includes('reset') || fullUrl.includes('recovery'))
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
            setCurrentView(resolveTenantDefaultView(s.user.role));
          }
        }
      } catch (error) {
        console.error('Error checking session:', error);
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

    const nextView = resolveTenantDefaultView(newSession.user.role);
    setCurrentView(nextView);
    navigate('/dashboard', true);
  };

  const handleLogout = async () => {
    await authService.logout();
    setSession(null);
    setForcePasswordChange(false);
    navigate('/login', true);
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
          const nextView = resolveTenantDefaultView(session.user.role);
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
