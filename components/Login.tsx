
import React, { useState } from 'react';
import { supabase } from '../services/supabaseService';
import { AuthSession, UserRole } from '../types';

interface LoginProps {
  onLogin: (session: AuthSession) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('Driver');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const session = await supabase.login(email, password);
      onLogin(session);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      setLoading(false);
      return;
    }
    
    try {
      await supabase.createRegistrationRequest({
        name,
        email,
        role,
        password
      });
      setSuccess('Registration request submitted! An admin will review your account.');
      setName('');
      setEmail('');
      setPassword('');
      setRole('Driver');
      setTimeout(() => {
        setMode('login');
        setSuccess('');
      }, 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row font-sans">
      {/* Left Column: Visual/Marketing */}
      <div className="md:w-1/2 bg-blue-900 relative flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=2000" 
            className="w-full h-full object-cover opacity-30 grayscale"
            alt="Logistics background"
          />
          <div className="absolute inset-0 bg-blue-900/60 mix-blend-multiply"></div>
        </div>
        
        <div className="relative z-10 px-12 py-24 text-white max-w-xl">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-2xl">
              <svg className="w-8 h-8 text-blue-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tighter leading-none">AFFINITY</h1>
              <p className="text-xs font-bold tracking-[0.3em] text-blue-300 uppercase">Operations Engine</p>
            </div>
          </div>
          
          <h2 className="text-5xl font-black leading-tight mb-6">
            Global Logistics,<br />
            <span className="text-blue-400">Intelligent Transit.</span>
          </h2>
          <p className="text-lg text-blue-100 font-medium mb-8">
            The all-in-one platform for cross-border vehicle logistics, landed cost tracking, and driver management across the SADC region.
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
              <p className="text-2xl font-black mb-1">100%</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-300">Transit Visibility</p>
            </div>
            <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
              <p className="text-2xl font-black mb-1">Zero</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-300">Audit Gaps</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Auth Form */}
      <div className="md:w-1/2 bg-white flex items-center justify-center p-8">
        <div className="max-w-md w-full">
          <div className="mb-10">
            <h3 className="text-3xl font-black text-zinc-900 mb-2">
              {mode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h3>
            <p className="text-zinc-500 font-medium">
              {mode === 'login' 
                ? 'Please sign in to access your dashboard.' 
                : 'Request access and admin will approve your account.'}
            </p>
          </div>

          <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-6">
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 text-sm font-bold flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2.5" /></svg>
                {error}
              </div>
            )}
            
            {success && (
              <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl border border-emerald-200 text-sm font-bold flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth="2.5" /></svg>
                {success}
              </div>
            )}

            {mode === 'register' && (
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">Full Name</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required 
                  placeholder="John Smith"
                  className="w-full px-5 py-4 rounded-2xl border border-zinc-200 bg-transparent focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-medium"
                />
              </div>
            )}

            {mode === 'register' && (
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">Role</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value as UserRole)}
                  className="w-full px-5 py-4 rounded-2xl border border-zinc-200 bg-transparent focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-medium"
                >
                  <option value="Driver">Driver</option>
                  <option value="Manager">Manager</option>
                  <option value="Accountant">Accountant</option>
                </select>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">Work Email</label>
              <input 
                type="email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                required 
                placeholder="email@affinity-logistics.com"
                className="w-full px-5 py-4 rounded-2xl border border-zinc-200 bg-transparent focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-medium"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">Secure Password</label>
                {mode === 'login' && (
                  <a href="#" className="text-[10px] font-black uppercase text-blue-600 tracking-widest hover:underline">Forgot?</a>
                )}
              </div>
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-5 py-4 rounded-2xl border border-zinc-200 bg-transparent focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-medium"
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-blue-200 hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {mode === 'login' ? (
                      <path d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" strokeWidth="2.5" />
                    ) : (
                      <path d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" strokeWidth="2.5" />
                    )}
                  </svg>
                  {mode === 'login' ? 'Sign In to Platform' : 'Submit Request'}
                </>
              )}
            </button>
            
            <div className="text-center pt-4">
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login');
                  setError('');
                  setSuccess('');
                }}
                className="text-sm font-bold text-zinc-500 hover:text-blue-600 transition-colors"
              >
                {mode === 'login' 
                  ? "Don't have an account? Request Access" 
                  : 'Already have an account? Sign In'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
