import React, { useState } from 'react';
import {
  Button,
  Form,
  TextInput,
  PasswordInput,
  Select,
  SelectItem,
  InlineNotification,
  Stack,
  Tag,
} from '@carbon/react';
import { Login as LoginIcon, Email, ArrowRight, Warning } from '@carbon/icons-react';
import { authService } from '../services/authService';
import { supabase } from '../services/supabaseService';
import { AuthSession, UserRole } from '../types';

interface LoginProps {
  onLogin: (session: AuthSession) => void;
}

type Mode = 'login' | 'register' | 'forgot';

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [mode, setMode]         = useState<Mode>('login');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [name, setName]         = useState('');
  const [role, setRole]         = useState<UserRole>('Driver');
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
      const session = await authService.login(email, password);
      onLogin(session);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await supabase.createRegistrationRequest({ name, email, role });
      setSuccess('Access request submitted. An administrator will approve it and send you an invite.');
      setName('');
      setEmail('');
      setRole('Driver');
      setTimeout(() => reset('login'), 3500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
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
      await authService.resetPassword(email);
      setSuccess('If an account exists with this email, you will receive reset instructions.');
      setTimeout(() => reset('login'), 3500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  const modeTitle: Record<Mode, string> = {
    login:    'Sign in',
    register: 'Request access',
    forgot:   'Reset password',
  };

  const submitLabel: Record<Mode, string> = {
    login:    loading ? 'Signing in…' : 'Sign in',
    register: loading ? 'Submitting…' : 'Submit request',
    forgot:   loading ? 'Sending…'    : 'Send reset email',
  };

  const onSubmit = mode === 'login' ? handleLogin : mode === 'forgot' ? handleForgot : handleRegister;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'IBM Plex Sans, sans-serif' }}>
      {/* ── Left: Branding panel ── */}
      <div
        style={{
          flex: '0 0 45%',
          background: 'linear-gradient(160deg, #001141 0%, #0043ce 60%, #0f62fe 100%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '4rem 3.5rem',
          position: 'relative',
          overflow: 'hidden',
        }}
        className="hidden md:flex"
      >
        {/* Background grid decoration */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.05,
          backgroundImage: 'linear-gradient(var(--cds-border-inverse,#fff) 1px, transparent 1px), linear-gradient(90deg, var(--cds-border-inverse,#fff) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Logo mark */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '3rem' }}>
            <div style={{
              width: 48, height: 48,
              background: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0f62fe" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: '1.25rem', letterSpacing: '0.05em', lineHeight: 1 }}>
                AFFINITY
              </div>
              <div style={{ color: '#78a9ff', fontSize: '0.75rem', letterSpacing: '0.2em', marginTop: '0.2rem' }}>
                LOGISTICS
              </div>
            </div>
          </div>

          <h2 style={{ color: '#fff', fontSize: '2.5rem', fontWeight: 300, lineHeight: 1.2, marginBottom: '1.5rem' }}>
            Global Logistics,<br />
            <strong style={{ fontWeight: 700 }}>Intelligent Transit.</strong>
          </h2>
          <p style={{ color: '#a6c8ff', fontSize: '1rem', lineHeight: 1.6, marginBottom: '3rem', maxWidth: '360px' }}>
            The all-in-one platform for cross-border vehicle logistics, landed cost tracking,
            and driver management across the SADC region.
          </p>

          {/* Stat chips */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', maxWidth: '380px' }}>
            {[
              { value: '100%', label: 'Transit Visibility' },
              { value: 'Zero', label: 'Audit Gaps' },
              { value: 'Live', label: 'Cost Tracking' },
              { value: 'Multi', label: 'Currency Support' },
            ].map(stat => (
              <div key={stat.label} style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                padding: '1rem',
              }}>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: '1.5rem' }}>{stat.value}</div>
                <div style={{ color: '#78a9ff', fontSize: '0.75rem', letterSpacing: '0.1em', marginTop: '0.25rem' }}>
                  {stat.label.toUpperCase()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right: Auth form ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--cds-background, #f4f4f4)',
        padding: '2rem',
      }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          {/* Mode tabs */}
          <div style={{ display: 'flex', gap: '0', marginBottom: '2rem', borderBottom: '1px solid var(--cds-border-subtle-01, #e0e0e0)' }}>
            {(['login', 'register', 'forgot'] as Mode[]).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => reset(m)}
                style={{
                  padding: '0.75rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: mode === m ? 600 : 400,
                  color: mode === m ? 'var(--cds-interactive, #0f62fe)' : 'var(--cds-text-secondary, #525252)',
                  background: 'none',
                  border: 'none',
                  borderBottom: mode === m ? '2px solid var(--cds-interactive, #0f62fe)' : '2px solid transparent',
                  cursor: 'pointer',
                  letterSpacing: '0.01em',
                  marginBottom: '-1px',
                  transition: 'all 0.1s',
                  fontFamily: 'IBM Plex Sans, sans-serif',
                }}
              >
                {m === 'login' ? 'Sign in' : m === 'register' ? 'Request access' : 'Reset password'}
              </button>
            ))}
          </div>

          <h3 style={{
            fontSize: '1.75rem',
            fontWeight: 300,
            color: 'var(--cds-text-primary, #161616)',
            marginBottom: '1.75rem',
            lineHeight: 1.25,
          }}>
            {modeTitle[mode]}
          </h3>

          {/* Notifications */}
          {error && (
            <div style={{ marginBottom: '1rem' }}>
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
            <div style={{ marginBottom: '1rem' }}>
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
              {mode === 'register' && (
                <TextInput
                  id="login-name"
                  labelText="Full name"
                  placeholder="John Smith"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              )}

              {mode === 'register' && (
                <Select
                  id="login-role"
                  labelText="Role"
                  value={role}
                  onChange={e => setRole(e.target.value as UserRole)}
                >
                  <SelectItem value="Driver"     text="Driver" />
                  <SelectItem value="Manager"    text="Manager" />
                  <SelectItem value="Accountant" text="Accountant" />
                </Select>
              )}

              <TextInput
                id="login-email"
                labelText="Work email"
                type="email"
                placeholder="email@affinity-logistics.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />

              {mode === 'login' && (
                <PasswordInput
                  id="login-password"
                  labelText="Password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  showPasswordLabel="Show password"
                  hidePasswordLabel="Hide password"
                />
              )}

              {mode === 'forgot' && (
                <p style={{ fontSize: '0.875rem', color: 'var(--cds-text-secondary, #525252)', lineHeight: 1.5 }}>
                  We'll send reset instructions to your email address if an account exists.
                </p>
              )}

              {mode === 'register' && (
                <p style={{ fontSize: '0.875rem', color: 'var(--cds-text-secondary, #525252)', lineHeight: 1.5 }}>
                  Your request will be reviewed by an administrator who will send you an invite link to set your password.
                </p>
              )}

              <Button
                type="submit"
                disabled={loading}
                renderIcon={mode === 'login' ? LoginIcon : mode === 'forgot' ? Email : ArrowRight}
                size="lg"
                style={{ width: '100%', maxWidth: '100%' }}
              >
                {submitLabel[mode]}
              </Button>

              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => reset('forgot')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--cds-link-primary, #0f62fe)',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    padding: 0,
                    fontFamily: 'IBM Plex Sans, sans-serif',
                    textDecoration: 'underline',
                  }}
                >
                  Forgot your password?
                </button>
              )}
            </Stack>
          </Form>
        </div>
      </div>
    </div>
  );
};
