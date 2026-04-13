
import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Loading, InlineLoading, Tile, Button } from '@carbon/react';
import { Login } from './components/Login';
import { AcceptInvite } from './components/AcceptInvite';
import { ResetPassword } from './components/ResetPassword';
import { Layout, AppView } from './components/Layout';
import { SuperAdminLayout } from './components/SuperAdminLayout';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { ToastViewport } from './components/Toast';
import { AuthSession } from './types';
import { authService } from './services/authService';
import { clearViewTenantId, getViewTenantId, setViewTenantId } from './services/apiClient';

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
  const [routePath, setRoutePath] = useState<string>(window.location.pathname || '/');
  const [tenantContextId, setTenantContextId] = useState<string | null>(getViewTenantId());
  const [loading, setLoading] = useState(true);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [isResetPassword, setIsResetPassword] = useState(false);

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

  const isSuperAdmin = session?.user?.accessRole === 'super_admin';

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

        // Default tenant view based on role
        if (s) {
          setCurrentView(resolveTenantDefaultView(s.user.role));
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
      setTenantContextId(getViewTenantId());
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

    const accessRole = session.user.accessRole || (session.user.role === 'Admin' ? 'tenant_admin' : 'user');

    if (accessRole === 'super_admin') {
      if (routePath === '/dashboard' && !tenantContextId) {
        navigate('/admin', true);
        return;
      }
      if (routePath !== '/admin' && routePath !== '/dashboard') {
        navigate('/admin', true);
      }
      return;
    }

    if (routePath === '/admin') {
      navigate('/dashboard', true);
      return;
    }
    if (routePath !== '/dashboard') {
      navigate('/dashboard', true);
    }
  }, [loading, routePath, session, tenantContextId]);

  const handleLogin = (newSession: AuthSession) => {
    setSession(newSession);
    const nextView = resolveTenantDefaultView(newSession.user.role);
    setCurrentView(nextView);

    if (newSession.user.accessRole === 'super_admin') {
      clearViewTenantId();
      setTenantContextId(null);
      navigate('/admin', true);
    } else {
      clearViewTenantId();
      setTenantContextId(null);
      navigate('/dashboard', true);
    }
    // Clear token if any
    setInviteToken(null);
  };

  const handleLogout = async () => {
    await authService.logout();
    clearViewTenantId();
    setTenantContextId(null);
    setSession(null);
    navigate('/login', true);
  };

  const handleViewTenant = (nextTenantId: string) => {
    setViewTenantId(nextTenantId);
    setTenantContextId(nextTenantId);
    navigate('/dashboard');
  };

  const handleExitTenantView = () => {
    clearViewTenantId();
    setTenantContextId(null);
    navigate('/admin');
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
  } else if (isSuperAdmin && routePath === '/admin') {
    content = (
      <SuperAdminLayout user={session.user} onLogout={handleLogout}>
        <Suspense fallback={<ScreenLoader />}>
          <SuperAdminDashboard
            activeTenantContextId={tenantContextId}
            onViewTenant={handleViewTenant}
            onExitTenantView={handleExitTenantView}
          />
        </Suspense>
      </SuperAdminLayout>
    );
  } else if (isSuperAdmin && routePath === '/dashboard' && !tenantContextId) {
    content = (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
        <InlineLoading description="Redirecting to platform dashboard..." status="active" />
      </div>
    );
  } else {
    content = (
      <Layout
        currentView={currentView}
        onNavigate={setCurrentView}
        user={session.user}
        onLogout={handleLogout}
      >
        {isSuperAdmin && tenantContextId && (
          <Tile
            style={{
              margin: '1rem',
              borderLeft: '4px solid var(--cds-support-warning, #f1c21b)',
              background: 'var(--cds-layer-01, #fff)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
              <span style={{ color: 'var(--cds-text-primary, #161616)' }}>
                Super admin tenant view is active. You are temporarily operating in tenant context.
              </span>
              <Button kind="ghost" size="sm" onClick={handleExitTenantView}>Exit Tenant View</Button>
            </div>
          </Tile>
        )}
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
