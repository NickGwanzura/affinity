
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseService';
import { UserInvite, AuthSession } from '../types';

interface AcceptInviteProps {
    token: string;
    onSuccess: (session: AuthSession) => void;
    onCancel: () => void;
}

export const AcceptInvite: React.FC<AcceptInviteProps> = ({ token, onSuccess, onCancel }) => {
    const [invite, setInvite] = useState<UserInvite | null>(null);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const verifyToken = async () => {
            try {
                const data = await supabase.getInviteByToken(token);
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
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setSubmitting(true);
        try {
            const session = await supabase.acceptInvite(token, password);
            onSuccess(session);
        } catch (err: any) {
            setError(err.message || 'Failed to accept invitation. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (error && !invite) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-8">
                <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border border-zinc-200 text-center">
                    <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h3 className="text-2xl font-black text-zinc-900 mb-2">Invitation Error</h3>
                    <p className="text-zinc-500 font-medium mb-8">{error}</p>
                    <button
                        onClick={onCancel}
                        className="w-full bg-zinc-900 text-white font-black py-4 rounded-2xl hover:bg-zinc-800 transition-all font-sans"
                    >
                        Back to Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col md:flex-row font-sans">
            {/* Left Column: Visual/Instructional */}
            <div className="md:w-1/2 bg-gradient-to-br from-blue-700 to-blue-900 relative flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 z-0 opacity-20">
                    <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <path d="M0 0 L100 0 L100 100 L0 100 Z" fill="none" stroke="white" strokeWidth="0.1" />
                        <path d="M0 50 L100 50" stroke="white" strokeWidth="0.05" />
                        <path d="M50 0 L50 100" stroke="white" strokeWidth="0.05" />
                    </svg>
                </div>

                <div className="relative z-10 px-12 py-24 text-white max-w-xl text-center md:text-left">
                    <div className="flex items-center gap-3 mb-12 justify-center md:justify-start">
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-2xl">
                            <svg className="w-8 h-8 text-blue-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-3xl font-black tracking-tighter leading-none">AFFINITY</h1>
                            <p className="text-xs font-bold tracking-[0.3em] text-blue-300 uppercase">Operations Engine</p>
                        </div>
                    </div>

                    <h2 className="text-5xl font-black leading-tight mb-6">
                        Join the<br />
                        <span className="text-blue-300">Logistics Team.</span>
                    </h2>
                    <p className="text-lg text-blue-100 font-medium mb-8">
                        You've been invited by <span className="text-white underline decoration-blue-400 font-black">{invite?.invitedBy}</span> to join Affinity Logistics as a <span className="bg-blue-600 px-2 py-0.5 rounded-lg text-white font-black">{invite?.role}</span>.
                    </p>

                    <div className="p-6 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 inline-block">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-400/20 rounded-full flex items-center justify-center">
                                <svg className="w-6 h-6 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-xs font-bold uppercase tracking-widest text-blue-300">Invited User</p>
                                <p className="text-xl font-black">{invite?.name}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Column: Password Setup */}
            <div className="md:w-1/2 bg-white flex items-center justify-center p-8">
                <div className="max-w-md w-full">
                    <div className="mb-10">
                        <h3 className="text-3xl font-black text-zinc-900 mb-2">Setup Your Account</h3>
                        <p className="text-zinc-500 font-medium">Please set a secure password to complete your registration for <strong>{invite?.email}</strong>.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 text-sm font-bold flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2.5" /></svg>
                                {error}
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">New Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                placeholder="••••••••"
                                className="w-full px-5 py-4 rounded-2xl border border-zinc-200 bg-transparent focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-medium"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">Confirm Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                required
                                placeholder="••••••••"
                                className="w-full px-5 py-4 rounded-2xl border border-zinc-200 bg-transparent focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-medium"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                        >
                            {submitting ? (
                                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                    Complete Registration
                                </>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={onCancel}
                            className="w-full text-sm font-bold text-zinc-400 hover:text-zinc-600 transition-colors"
                        >
                            Cancel and go to Login
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};
