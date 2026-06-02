import React, { useState } from 'react';
import { Key, LogOut } from 'lucide-react';
import { Button, PasswordInput, InlineNotification } from './ui';
import { authService } from '../services/authService';
import { useToast } from './Toast';
import affinityLogo from '../assets/affinity-logo.svg';

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
            <img
              src={affinityLogo}
              alt="Affinity Logistics"
              className="login-shell__logo-image"
            />
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
                <InlineNotification
                  kind="error"
                  title="Error:"
                  subtitle={error}
                  onClose={() => setError('')}
                />
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="flex flex-col gap-4">
                <PasswordInput
                  id="force-current-password"
                  labelText="Current password"
                  placeholder="Enter your temporary password"
                  autoComplete="current-password"
                  autoFocus
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />

                <PasswordInput
                  id="force-new-password"
                  labelText="New password"
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  helperText="Must include uppercase, number, and special character"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />

                <PasswordInput
                  id="force-confirm-password"
                  labelText="Confirm new password"
                  placeholder="Re-enter new password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  invalid={confirmPassword.length > 0 && newPassword !== confirmPassword}
                  invalidText="Passwords do not match"
                />

                <Button
                  type="submit"
                  isLoading={loading}
                  renderIcon={Key}
                  size="lg"
                  fullWidth
                >
                  {loading ? 'Changing password…' : 'Set new password'}
                </Button>

                <button
                  type="button"
                  onClick={onLogout}
                  className="login-shell__link inline-flex items-center gap-1"
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
