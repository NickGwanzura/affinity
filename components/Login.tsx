import React, { useState } from 'react';
import { LogIn, Mail } from 'lucide-react';
import { Button, TextInput, PasswordInput, InlineNotification } from './ui';
import { authService } from '../services/authService';
import { AuthSession } from '../types';
import { useToast } from './Toast';
import {
  forgotPasswordFormSchema,
  getFirstValidationMessage,
  loginFormSchema,
} from '../utils/clientValidation';
import { ZodError } from 'zod';
import affinityLogo from '../assets/affinity-logo.svg';

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
            <img
              src={affinityLogo}
              alt="Affinity Logistics"
              className="login-shell__logo-image"
            />
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
                <InlineNotification
                  kind="error"
                  title="Error:"
                  subtitle={error}
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
                  onClose={() => setSuccess('')}
                />
              </div>
            )}

            <form onSubmit={onSubmit}>
              <div className="flex flex-col gap-5">
                <TextInput
                  id="login-email"
                  type="email"
                  labelText="Work email"
                  placeholder="email@company.com"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

                {mode === 'login' && (
                  <PasswordInput
                    id="login-password"
                    labelText="Password"
                    placeholder="Enter password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                )}

                {mode === 'forgot' && (
                  <p className="login-shell__helper-text">
                    We'll send reset instructions to your email address if an account exists.
                  </p>
                )}

                <Button
                  type="submit"
                  isLoading={loading}
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
