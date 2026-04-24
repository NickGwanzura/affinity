
import React, { useState, useEffect } from 'react';
import { dataService } from '../services/dataService';
import { UserInvite, AuthSession } from '../types';
import { useToast } from './Toast';
import { Button } from './ui';
import affinityLogo from '../assets/affinity-logo.svg';

interface AcceptInviteProps {
    token: string;
    onSuccess: (session: AuthSession) => void;
    onCancel: () => void;
}

export const AcceptInvite: React.FC<AcceptInviteProps> = ({ token, onSuccess, onCancel }) => {
    const { showToast } = useToast();
    const [invite, setInvite] = useState<UserInvite | null>(null);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const verifyToken = async () => {
            try {
                const data = await dataService.getInviteByToken(token);
                if (!data) {
                    setError('Invalid or expired invite token. Please contact your administrator.');
                } else {
                    setInvite(data);
                }
            } catch (err: any) {
                setError(err.message || 'Failed to verify invite token.');
            } finally {
                setLoading(false);
            }
        };
        verifyToken();
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password.length < 8) {
            setError('Password must be at least 8 characters long.');
            showToast('Password must be at least 8 characters long.', 'warning');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            showToast('Passwords do not match.', 'warning');
            return;
        }

        setSubmitting(true);
        try {
            const session = await dataService.acceptInvite(token, password);
            showToast('Account created successfully. Welcome!', 'success');
            onSuccess(session);
        } catch (err: any) {
            setError(err.message || 'Failed to accept invitation. Please try again.');
            showToast(err.message || 'Failed to accept invitation. Please try again.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
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
                    </div>
                </div>
                <div className="login-shell__panel">
                    <div className="login-shell__panel-inner">
                        <div className="flex items-center justify-center py-16">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error && !invite) {
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
                    </div>
                </div>
                <div className="login-shell__panel">
                    <div className="login-shell__panel-inner">
                        <div className="login-shell__card">
                            <div className="login-shell__intro">
                                <h3 className="login-shell__title">Invitation Error</h3>
                                <p className="login-shell__description">{error}</p>
                            </div>
                            <Button onClick={onCancel} fullWidth size="lg">
                                Back to Login
                            </Button>
                        </div>
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
                        Join the<br />
                        <strong>Logistics Team.</strong>
                    </h2>
                    <p className="login-shell__headline-copy">
                        You've been invited by <strong>{invite?.invitedBy}</strong> to join Affinity Logistics as a <strong>{invite?.role}</strong>.
                    </p>
                </div>
            </div>

            <div className="login-shell__panel">
                <div className="login-shell__panel-inner">
                    <div className="login-shell__card">
                        <div className="login-shell__intro">
                            <h3 className="login-shell__title">Setup your account</h3>
                            <p className="login-shell__description">
                                Please set a secure password to complete your registration for <strong>{invite?.email}</strong>.
                            </p>
                        </div>

                        {error && (
                            <div className="login-shell__notice">
                                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 text-red-800 text-sm">
                                    <span className="font-semibold shrink-0">Error:</span>
                                    <span className="flex-1">{error}</span>
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
                            <div className="flex flex-col gap-5">
                                <div className="flex flex-col gap-1">
                                    <label htmlFor="accept-invite-password" className="text-sm font-medium text-gray-900">
                                        New password
                                    </label>
                                    <input
                                        id="accept-invite-password"
                                        type="password"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        required
                                        placeholder="At least 8 characters"
                                        autoComplete="new-password"
                                        className="w-full px-3 py-2 text-sm bg-white border border-gray-300 text-gray-900 placeholder-gray-400"
                                    />
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label htmlFor="accept-invite-confirm" className="text-sm font-medium text-gray-900">
                                        Confirm password
                                    </label>
                                    <input
                                        id="accept-invite-confirm"
                                        type="password"
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        required
                                        placeholder="Re-enter password"
                                        autoComplete="new-password"
                                        className="w-full px-3 py-2 text-sm bg-white border border-gray-300 text-gray-900 placeholder-gray-400"
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    disabled={submitting}
                                    size="lg"
                                    fullWidth
                                >
                                    {submitting ? 'Completing...' : 'Complete registration'}
                                </Button>

                                <button
                                    type="button"
                                    onClick={onCancel}
                                    className="login-shell__link"
                                >
                                    Cancel and go to login
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};
