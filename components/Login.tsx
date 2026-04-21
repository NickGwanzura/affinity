import React, { useState } from 'react';
import { LogIn, Mail, X } from 'lucide-react';
import { Button } from './ui';
import { authService } from '../services/authService';
import { AuthSession } from '../types';
import { useToast } from './Toast';
import { forgotPasswordFormSchema, getFirstValidationMessage, loginFormSchema } from '../utils/clientValidation';
import { ZodError } from 'zod';

interface LoginProps {
  onLogin: (session: AuthSession) => void;
}

type Mode = 'login' | 'forgot';

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const { showToast } = useToast();
  const [mode, setMode]         = useState<Mode>('login');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  const reset = (nextMode: Mode) => {
    setMode(nextMode);
    setError('');
    setSuccess('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      loginFormSchema.parse({ email, password });
      const session = await authService.login(email, password);
      showToast(`Welcome back, ${session.user.name}.`, 'success');
      onLogin(session);
    } catch (err: unknown) {
      const message = err instanceof ZodError
        ? getFirstValidationMessage(err)
        : err instanceof Error
          ? err.message
          : 'Login failed';
      setError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      forgotPasswordFormSchema.parse({ email });
      await authService.resetPassword(email);
      const message = 'If an account exists with this email, you will receive reset instructions.';
      setSuccess(message);
      showToast(message, 'success');
      setTimeout(() => reset('login'), 3500);
    } catch (err: unknown) {
      const message = err instanceof ZodError
        ? getFirstValidationMessage(err)
        : err instanceof Error
          ? err.message
          : 'Failed to send reset email';
      setError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const modeTitle: Record<Mode, string> = {
    login:    'Sign in',
    forgot:   'Reset password',
  };

  const submitLabel: Record<Mode, string> = {
    login:    loading ? 'Signing in…' : 'Sign in',
    forgot:   loading ? 'Sending…'    : 'Send reset email',
  };

  const onSubmit = mode === 'login' ? handleLogin : handleForgot;

  return (
    <div className="login-shell">
      <div className="login-shell__brand">
        {/* Background grid decoration */}
        <div className="login-shell__brand-grid" />

        <div className="login-shell__brand-content">
          {/* Logo mark */}
          <div className="login-shell__brand-lockup">
            <div className="login-shell__logo-mark">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <div className="login-shell__brand-name">
                AFFINITY
              </div>
              <div className="login-shell__brand-subtitle">
                LOGISTICS
              </div>
            </div>
          </div>

          <h2 className="login-shell__headline">
            Global Logistics,<br />
            <strong>Intelligent Transit.</strong>
          </h2>
          <p className="login-shell__headline-copy">
            The all-in-one platform for cross-border vehicle logistics, landed cost tracking,
            and driver management across the SADC region.
          </p>

          {/* Stat chips */}
          <div className="login-shell__stats">
            {[
              { value: '100%', label: 'Transit Visibility' },
              { value: 'Zero', label: 'Audit Gaps' },
              { value: 'Live', label: 'Cost Tracking' },
              { value: 'Multi', label: 'Currency Support' },
            ].map(stat => (
              <div key={stat.label} className="login-shell__stat">
                <div className="login-shell__stat-value">{stat.value}</div>
                <div className="login-shell__stat-label">
                  {stat.label.toUpperCase()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right: Auth form ── */}
      <div className="login-shell__panel">
        <div className="login-shell__panel-inner">
          {/* Mobile brand card */}
          <div className="login-shell__mobile-brand">
            <div className="login-shell__mobile-brand-row">
              <div className="login-shell__mobile-copy">
                <div className="login-shell__mobile-eyebrow">
                  Affinity Logistics
                </div>
                <h2 className="login-shell__mobile-title">
                  Fleet access for every trip.
                </h2>
                <p className="login-shell__mobile-text">
                  Sign in, review trip operations, and move through the platform cleanly from any device.
                </p>
              </div>
              <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                Affinity
              </span>
            </div>
          </div>

          <div className="login-shell__card">
          {/* Mode tabs */}
          <div className="login-shell__tabs" role="tablist" aria-label="Authentication options">
            {(['login', 'forgot'] as Mode[]).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => reset(m)}
                role="tab"
                aria-selected={mode === m}
                className={`login-shell__tab ${mode === m ? 'is-active' : ''}`}
              >
                {m === 'login' ? 'Sign in' : 'Reset password'}
              </button>
            ))}
          </div>

          <div className="login-shell__intro">
            <h3 className="login-shell__title">{modeTitle[mode]}</h3>
            <p className="login-shell__description">
              {mode === 'login'
                ? 'Sign in with your approved company account to access the logistics workspace.'
                : 'We will send reset instructions to your email address if an account exists.'}
            </p>
          </div>

          {/* Notifications */}
          {error && (
            <div className="login-shell__notice">
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 text-red-800 text-sm">
                <span className="font-semibold shrink-0">Error:</span>
                <span className="flex-1">{error}</span>
                <button
                  type="button"
                  onClick={() => setError('')}
                  className="shrink-0 text-red-600 hover:text-red-800"
                  aria-label="Dismiss"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}
          {success && (
            <div className="login-shell__notice">
              <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 text-green-800 text-sm">
                <span className="font-semibold shrink-0">Success:</span>
                <span className="flex-1">{success}</span>
                <button
                  type="button"
                  onClick={() => setSuccess('')}
                  className="shrink-0 text-green-600 hover:text-green-800"
                  aria-label="Dismiss"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          <form onSubmit={onSubmit}>
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-1">
                <label htmlFor="login-email" className="text-sm font-medium text-gray-900">
                  Work email
                </label>
                <input
                  id="login-email"
                  type="email"
                  placeholder="email@affinity-logistics.com"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {mode === 'login' && (
                <div className="flex flex-col gap-1">
                  <label htmlFor="login-password" className="text-sm font-medium text-gray-900">
                    Password
                  </label>
                  <input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              )}

              {mode === 'forgot' && (
                <p className="login-shell__helper-text">
                  We'll send reset instructions to your email address if an account exists.
                </p>
              )}

              <Button
                type="submit"
                disabled={loading}
                renderIcon={mode === 'login' ? LogIn : Mail}
                size="lg"
                fullWidth
              >
                {submitLabel[mode]}
              </Button>

              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => reset('forgot')}
                  className="login-shell__link"
                >
                  Forgot your password?
                </button>
              )}
            </div>
          </form>
          </div>
        </div>
      </div>
    </div>
  );
};
