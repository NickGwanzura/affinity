import React, { useState } from 'react';
import { LogIn, Mail, X } from 'lucide-react';
import { Button } from './ui';
import { authService } from '../services/authService';
import { AuthSession } from '../types';
import { useToast } from './Toast';
import {
  forgotPasswordFormSchema,
  getFirstValidationMessage,
  loginFormSchema,
} from '../utils/clientValidation';
import { ZodError } from 'zod';

interface LoginProps {
  onLogin: (session: AuthSession) => void;
}

type Mode = 'login' | 'forgot';

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const { showToast } = useToast();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
      const message =
        err instanceof ZodError
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
      const message =
        err instanceof ZodError
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
    login: 'Sign in',
    forgot: 'Reset password',
  };

  const submitLabel: Record<Mode, string> = {
    login: loading ? 'Signing in…' : 'Sign in',
    forgot: loading ? 'Sending…' : 'Send reset email',
  };

  const onSubmit = mode === 'login' ? handleLogin : handleForgot;

  return (
    <div className="login-shell">
      <div className="login-shell__brand">
        <div className="login-shell__brand-grid" />

        <div className="login-shell__brand-content">
          <div className="login-shell__brand-lockup">
            <div className="login-shell__logo-mark">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#000"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <div className="login-shell__brand-name">AFFINITY</div>
              <div className="login-shell__brand-subtitle">LOGISTICS</div>
            </div>
          </div>

          <h2 className="login-shell__headline">
            Global Logistics,
            <br />
            <strong>Intelligent Transit.</strong>
          </h2>
          <p className="login-shell__headline-copy">
            The all-in-one platform for cross-border vehicle logistics, landed cost tracking, and
            driver management across the SADC region.
          </p>

          <div className="login-shell__stats">
            {[
              { value: '100%', label: 'Transit Visibility' },
              { value: 'Zero', label: 'Audit Gaps' },
              { value: 'Live', label: 'Cost Tracking' },
              { value: 'Multi', label: 'Currency Support' },
            ].map(stat => (
              <div key={stat.label} className="login-shell__stat">
                <div className="login-shell__stat-value">{stat.value}</div>
                <div className="login-shell__stat-label">{stat.label.toUpperCase()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="login-shell__panel">
        <div className="login-shell__panel-inner">
          <div className="login-shell__mobile-brand">
            <div className="login-shell__mobile-brand-row">
              <div className="login-shell__mobile-copy">
                <h2 className="login-shell__mobile-title">Fleet access for every trip.</h2>
              </div>
              <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.75rem' }}>AL</span>
            </div>
          </div>

          <div className="login-shell__card">
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

            {error && (
              <div className="login-shell__notice">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.5rem',
                    padding: '0.75rem',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#dc2626',
                    fontSize: '0.875rem',
                    borderRadius: '6px',
                  }}
                >
                  <span style={{ fontWeight: 600, flexShrink: 0 }}>Error:</span>
                  <span style={{ flex: 1 }}>{error}</span>
                  <button
                    type="button"
                    onClick={() => setError('')}
                    style={{
                      flexShrink: 0,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      color: '#dc2626',
                    }}
                    aria-label="Dismiss"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}
            {success && (
              <div className="login-shell__notice">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.5rem',
                    padding: '0.75rem',
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    color: '#16a34a',
                    fontSize: '0.875rem',
                    borderRadius: '6px',
                  }}
                >
                  <span style={{ fontWeight: 600, flexShrink: 0 }}>Success:</span>
                  <span style={{ flex: 1 }}>{success}</span>
                  <button
                    type="button"
                    onClick={() => setSuccess('')}
                    style={{
                      flexShrink: 0,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      color: '#16a34a',
                    }}
                    aria-label="Dismiss"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={onSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  <label
                    htmlFor="login-email"
                    style={{ fontSize: '0.875rem', fontWeight: 500, color: '#000' }}
                  >
                    Work email
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    placeholder="email@company.com"
                    autoComplete="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '0.625rem 0.75rem',
                      fontSize: '0.9375rem',
                      background: '#fafafa',
                      border: '1px solid #e5e5e5',
                      borderRadius: '6px',
                      color: '#000',
                      outline: 'none',
                      transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                    }}
                    onFocus={e => {
                      e.target.style.borderColor = '#000';
                      e.target.style.boxShadow = '0 0 0 2px rgba(0,0,0,0.05)';
                    }}
                    onBlur={e => {
                      e.target.style.borderColor = '#e5e5e5';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>

                {mode === 'login' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                    <label
                      htmlFor="login-password"
                      style={{ fontSize: '0.875rem', fontWeight: 500, color: '#000' }}
                    >
                      Password
                    </label>
                    <input
                      id="login-password"
                      type="password"
                      placeholder="Enter password"
                      autoComplete="current-password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '0.625rem 0.75rem',
                        fontSize: '0.9375rem',
                        background: '#fafafa',
                        border: '1px solid #e5e5e5',
                        borderRadius: '6px',
                        color: '#000',
                        outline: 'none',
                        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                      }}
                      onFocus={e => {
                        e.target.style.borderColor = '#000';
                        e.target.style.boxShadow = '0 0 0 2px rgba(0,0,0,0.05)';
                      }}
                      onBlur={e => {
                        e.target.style.borderColor = '#e5e5e5';
                        e.target.style.boxShadow = 'none';
                      }}
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
