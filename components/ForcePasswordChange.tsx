import React, { useState } from 'react';
import { Key, LogOut, X } from 'lucide-react';
import { Button } from './ui';
import { authService } from '../services/authService';
import { useToast } from './Toast';

interface ForcePasswordChangeProps {
  userId: string;
  userName: string;
  onComplete: () => void;
  onLogout: () => void;
}

export const ForcePasswordChange: React.FC<ForcePasswordChangeProps> = ({
  userId,
  userName,
  onComplete,
  onLogout,
}) => {
  const { showToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const validate = (): string | null => {
    if (!currentPassword) return 'Enter your current password.';
    if (newPassword.length < 8) return 'New password must be at least 8 characters.';
    if (!/[A-Z]/.test(newPassword)) return 'New password needs at least one uppercase letter.';
    if (!/[0-9]/.test(newPassword)) return 'New password needs at least one number.';
    if (!/[^a-zA-Z0-9]/.test(newPassword)) return 'New password needs at least one special character.';
    if (newPassword !== confirmPassword) return 'Passwords do not match.';
    if (currentPassword === newPassword) return 'New password must differ from current password.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      await authService.changePassword(userId, currentPassword, newPassword);
      showToast('Password changed successfully. Welcome!', 'success');
      onComplete();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to change password';
      setError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-shell__brand">
        <div className="login-shell__brand-grid" />
        <div className="login-shell__brand-content">
          <div className="login-shell__brand-lockup">
            <div className="login-shell__logo-mark">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <div className="login-shell__brand-name">AFFINITY</div>
              <div className="login-shell__brand-subtitle">LOGISTICS</div>
            </div>
          </div>
          <h2 className="login-shell__headline">
            Security First,<br />
            <strong>Always Protected.</strong>
          </h2>
          <p className="login-shell__headline-copy">
            Your password was set by an administrator. Please choose a personal
            password to secure your account before continuing.
          </p>
        </div>
      </div>

      <div className="login-shell__panel">
        <div className="login-shell__panel-inner">
          <div className="login-shell__card">
            <div className="login-shell__intro">
              <h3 className="login-shell__title">Change your password</h3>
              <p className="login-shell__description">
                Welcome, {userName}. You must set a new password before you can
                access the platform.
              </p>
            </div>

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

            <form onSubmit={handleSubmit}>
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-1">
                  <label htmlFor="force-current-password" className="text-sm font-medium text-gray-900">
                    Current password
                  </label>
                  <input
                    id="force-current-password"
                    type="password"
                    placeholder="Enter your temporary password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrentPassword(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="force-new-password" className="text-sm font-medium text-gray-900">
                    New password
                  </label>
                  <input
                    id="force-new-password"
                    type="password"
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-0.5">
                    Must include uppercase, number, and special character
                  </p>
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="force-confirm-password" className="text-sm font-medium text-gray-900">
                    Confirm new password
                  </label>
                  <input
                    id="force-confirm-password"
                    type="password"
                    placeholder="Re-enter new password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                    required
                    className={`w-full px-3 py-2 text-sm bg-white border text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${confirmPassword.length > 0 && newPassword !== confirmPassword ? 'border-red-500' : 'border-gray-300'}`}
                  />
                  {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                    <p className="text-xs text-red-600 mt-0.5">Passwords do not match</p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  renderIcon={Key}
                  size="lg"
                  fullWidth
                >
                  {loading ? 'Changing password...' : 'Set new password'}
                </Button>

                <button
                  type="button"
                  onClick={onLogout}
                  className="login-shell__link"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
