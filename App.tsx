
import React, { useState, useEffect } from 'react';
import { AdminDashboard } from './components/AdminDashboard';
import { AccountantDashboard } from './components/AccountantDashboard';
import { DriverPortal } from './components/DriverPortal';
import { Settings } from './components/Settings';
import { Financials } from './components/Financials';
import { Documents } from './components/Documents';
import { Login } from './components/Login';
import { AcceptInvite } from './components/AcceptInvite';
import { ResetPassword } from './components/ResetPassword';
import { Layout, AppView } from './components/Layout';
import { AuthSession } from './types';
import { authService } from './services/authService';

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
      {currentView === 'admin' && <AdminDashboard />}
      {currentView === 'accountant' && <AccountantDashboard />}
      {currentView === 'driver' && <DriverPortal />}
      {currentView === 'settings' && <Settings />}
      {currentView === 'financials' && <Financials />}
      {currentView === 'documents' && <Documents />}
    </Layout>
  );
}
