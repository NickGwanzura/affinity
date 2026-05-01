import React, { useState, useEffect } from 'react';
import { Lock } from 'lucide-react';
import { authService } from '../services/authService';
import { useToast } from './Toast';
import { Button, TextInput, PasswordInput, InlineNotification } from './ui';
import { getFirstValidationMessage, passwordResetFormSchema } from '../utils/clientValidation';
import { ZodError } from 'zod';
import affinityLogo from '../assets/affinity-logo.svg';

interface ResetPasswordProps {
  onComplete: () => void;
}

export const ResetPassword: React.FC<ResetPasswordProps> = ({ onComplete }) => {
  const { showToast } = useToast();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [manualToken, setManualToken] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  // Validate password on change
  useEffect(() => {
    const errors: string[] = [];
    if (newPassword.length > 0) {
      if (newPassword.length < 8) errors.push('At least 8 characters');
      if (!/[A-Z]/.test(newPassword)) errors.push('One uppercase letter');
      if (!/[0-9]/.test(newPassword)) errors.push('One number');
      if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword)) errors.push('One special character');
    }
    setValidationErrors(errors);
  }, [newPassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Get token from URL or manual input
    let token = manualToken.trim();

    if (!token) {
      // Try to extract from URL (hash or query params)
      const hash = window.location.hash;
      const search = window.location.search;
      const fullUrl = hash + search;

      // Try multiple token formats
      const tokenMatch = fullUrl.match(/[?&]token=([^&]+)/) ||
                         fullUrl.match(/[?&]access_token=([^&]+)/) ||
                         fullUrl.match(/token[:=]([^&]+)/i);
      token = tokenMatch ? tokenMatch[1] : '';

    }

    if (!token) {
      const message = 'Invalid or missing reset token. Please check your email link or enter the token manually below.';
      setError(message);
      showToast(message, 'warning');
      setShowManualInput(true);
      setLoading(false);
      return;
    }

    try {
      passwordResetFormSchema.parse({ token, newPassword, confirmPassword });
      await authService.updatePassword(token, newPassword);
      setSuccess(true);
      showToast('Password reset successfully. Redirecting to sign in.', 'success');
      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (err: unknown) {
      const message = err instanceof ZodError
        ? getFirstValidationMessage(err)
        : err instanceof Error
          ? err.message
          : 'Failed to reset password';
      setError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
        <div className="bg-white shadow-xl border border-zinc-200 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-black text-zinc-900 mb-2">Password Updated!</h2>
          <p className="text-zinc-500 mb-6">Your password has been successfully reset. Redirecting to login...</p>
          <div className="w-full bg-zinc-100 h-2 overflow-hidden">
            <div className="bg-emerald-500 h-full animate-[shrink_2s_linear_forwards]" style={{ width: '100%' }}></div>
          </div>
        </div>
      </div>
    );
  }

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
            Reset your
            <br />
            <strong>Password.</strong>
          </h2>
          <p className="login-shell__headline-copy">
            Create a new secure password to regain access to the Affinity logistics workspace.
          </p>
        </div>
      </div>

      <div className="login-shell__panel">
        <div className="login-shell__panel-inner">
          <div className="login-shell__mobile-brand">
            <div className="login-shell__mobile-brand-row">
              <div className="login-shell__mobile-copy">
                <h2 className="login-shell__mobile-title">Reset your password.</h2>
              </div>
              <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.75rem' }}>AL</span>
            </div>
          </div>

          <div className="login-shell__card">
            <div className="login-shell__intro">
              <h3 className="login-shell__title">Create new password</h3>
              <p className="login-shell__description">
                Enter a new password for your account. Make it strong and unique.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <InlineNotification
                  kind="error"
                  title="Error:"
                  subtitle={
                    <>
                      {error}
                      {!showManualInput && (
                        <>
                          {' '}
                          <button
                            type="button"
                            onClick={() => setShowManualInput(true)}
                            className="underline hover:no-underline"
                          >
                            Enter token manually
                          </button>
                        </>
                      )}
                    </>
                  }
                  onClose={() => setError('')}
                />
              )}

              {showManualInput && (
                <TextInput
                  id="reset-token"
                  labelText="Reset token (from email)"
                  helperText="Copy the token from your reset email and paste it here."
                  placeholder="Paste your reset token here"
                  className="font-mono"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                />
              )}

              <PasswordInput
                id="new-password"
                labelText="New password"
                placeholder="••••••••"
                autoComplete="new-password"
                autoFocus
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />

              {newPassword.length > 0 && validationErrors.length > 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-semibold text-amber-800 mb-2">Password must contain:</p>
                  <ul className="space-y-1">
                    {validationErrors.map((err, i) => (
                      <li key={i} className="text-xs text-amber-700 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        {err}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <PasswordInput
                id="confirm-password"
                labelText="Confirm password"
                placeholder="••••••••"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                invalid={Boolean(confirmPassword) && newPassword !== confirmPassword}
                invalidText="Passwords do not match"
              />

              <Button
                type="submit"
                isLoading={loading}
                disabled={validationErrors.length > 0 || newPassword !== confirmPassword}
                renderIcon={Lock}
                size="lg"
                fullWidth
              >
                Reset password
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
