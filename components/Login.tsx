import React, { useState } from 'react';
import {
  Button,
  Form,
  TextInput,
  PasswordInput,
  InlineNotification,
  Stack,
  Tag,
} from '@carbon/react';
import { Login as LoginIcon, Email } from '@carbon/icons-react';
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
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0f62fe" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
              <Tag type="blue">Carbon UI</Tag>
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
              <InlineNotification
                kind="error"
                title="Error:"
                subtitle={error}
                lowContrast
                hideCloseButton={false}
                onClose={() => setError('')}
              />
            </div>
          )}
          {success && (
            <div className="login-shell__notice">
              <InlineNotification
                kind="success"
                title="Success:"
                subtitle={success}
                lowContrast
                hideCloseButton={false}
                onClose={() => setSuccess('')}
              />
            </div>
          )}

          <Form onSubmit={onSubmit}>
            <Stack gap={6}>
              <TextInput
                id="login-email"
                labelText="Work email"
                type="email"
                placeholder="email@affinity-logistics.com"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />

              {mode === 'login' && (
                <PasswordInput
                  id="login-password"
                  labelText="Password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  showPasswordLabel="Show password"
                  hidePasswordLabel="Hide password"
                />
              )}

              {mode === 'forgot' && (
                <p className="login-shell__helper-text">
                  We'll send reset instructions to your email address if an account exists.
                </p>
              )}

              <Button
                type="submit"
                disabled={loading}
                renderIcon={mode === 'login' ? LoginIcon : Email}
                size="lg"
                style={{ width: '100%', maxWidth: '100%' }}
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
            </Stack>
          </Form>
          </div>
        </div>
      </div>
    </div>
  );
};
