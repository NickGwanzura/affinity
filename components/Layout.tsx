
import React, { useState } from 'react';
import { AppUser, UserRole } from '../types';
import { supabase } from '../services/supabaseService';

export type AppView = 'admin' | 'driver' | 'accountant' | 'settings' | 'financials' | 'documents';

interface LayoutProps {
  children: React.ReactNode;
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  user: AppUser;
  onLogout: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentView, onNavigate, user, onLogout }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const allNavItems: { id: AppView; label: string; roles: UserRole[]; icon: React.ReactNode }[] = [
    { 
      id: 'admin', 
      label: 'Dashboard', 
      roles: ['Admin', 'Manager'],
      icon: <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /> 
    },
    { 
      id: 'accountant', 
      label: 'Accountant', 
      roles: ['Admin', 'Accountant'],
      icon: <path d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /> 
    },
    { 
      id: 'financials', 
      label: 'Financials', 
      roles: ['Admin', 'Manager', 'Accountant'],
      icon: <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> 
    },
    { 
      id: 'documents', 
      label: 'Documents', 
      roles: ['Admin', 'Manager', 'Driver'],
      icon: <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /> 
    },
    { 
      id: 'driver', 
      label: 'Driver Portal', 
      roles: ['Admin', 'Driver'],
      icon: <path d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /> 
    },
    { 
      id: 'settings', 
      label: 'Settings', 
      roles: ['Admin'],
      icon: <path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /> 
    },
  ];

  const visibleNavItems = allNavItems.filter(item => item.roles.includes(user.role));

  const handleLogout = async () => {
    try {
      await supabase.logout();
      onLogout();
    } catch (error) {
      console.error('Error logging out:', error);
      // Still call onLogout to clear local session state
      onLogout();
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-black tracking-tighter text-zinc-900 leading-none uppercase">Affinity</h1>
                <p className="text-[10px] font-bold tracking-[0.2em] text-blue-600 uppercase">Logistics</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <nav className="hidden lg:flex items-center gap-1 bg-zinc-100 p-1 rounded-xl">
                {visibleNavItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                      currentView === item.id 
                        ? 'bg-white text-blue-600 shadow-sm' 
                        : 'text-zinc-500 hover:text-zinc-900'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {item.icon}
                    </svg>
                    {item.label}
                  </button>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-4">
               {/* Mobile Menu Button */}
               <button 
                 onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                 className="lg:hidden p-2 rounded-xl hover:bg-zinc-100 transition-colors"
               >
                 <svg className="w-6 h-6 text-zinc-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   {mobileMenuOpen ? (
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                   ) : (
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                   )}
                 </svg>
               </button>

               {/* User Info Display */}
               <div className="hidden sm:flex items-center gap-3 px-3 py-2 bg-zinc-50 rounded-xl border border-zinc-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full border-2 border-white shadow-sm overflow-hidden">
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`} className="w-full h-full" alt="avatar" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-zinc-900 leading-none">{user.name}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                          user.role === 'Admin' ? 'bg-purple-100 text-purple-700' :
                          user.role === 'Manager' ? 'bg-blue-100 text-blue-700' :
                          user.role === 'Accountant' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-orange-100 text-orange-700'
                        }`}>{user.role}</span>
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                        <span className="text-[9px] font-bold text-emerald-600 uppercase">Online</span>
                      </div>
                    </div>
                  </div>
               </div>

               {/* User Menu */}
               <div className="group relative">
                <button className="p-2 rounded-xl hover:bg-zinc-100 transition-colors">
                  <svg className="w-5 h-5 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>
                {/* Dropdown Menu */}
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-zinc-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all p-3 z-[100]">
                  <div className="pb-3 mb-3 border-b border-zinc-100">
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Logged in as</p>
                    <p className="text-sm font-bold text-zinc-900">{user.name}</p>
                    <p className="text-xs text-zinc-500 mt-1">{user.email}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider ${
                        user.role === 'Admin' ? 'bg-purple-100 text-purple-700' :
                        user.role === 'Manager' ? 'bg-blue-100 text-blue-700' :
                        user.role === 'Accountant' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>{user.role}</span>
                      <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider ${
                        user.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-500'
                      }`}>{user.status}</span>
                    </div>
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeWidth="2.5" /></svg>
                    Logout System
                  </button>
                </div>
               </div>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-zinc-200 bg-white">
            <nav className="max-w-7xl mx-auto px-4 py-4 space-y-1">
              {visibleNavItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                    currentView === item.id 
                      ? 'bg-blue-50 text-blue-600 border border-blue-200' 
                      : 'text-zinc-600 hover:bg-zinc-50'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    {item.icon}
                  </svg>
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        )}
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-10">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 z-50 safe-area-inset-bottom">
        <nav className="grid grid-cols-5 gap-1 px-2 py-2">
          {visibleNavItems.slice(0, 5).map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-all ${
                currentView === item.id 
                  ? 'text-blue-600 bg-blue-50' 
                  : 'text-zinc-400 hover:text-zinc-900'
              }`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                {item.icon}
              </svg>
              <span className="text-[10px] font-bold leading-none">{item.label.split(' ')[0]}</span>
            </button>
          ))}
        </nav>
      </div>

      <footer className="bg-zinc-50 border-t border-zinc-200 py-10 mt-20">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 opacity-60">
             <div className="w-6 h-6 bg-zinc-900 rounded flex items-center justify-center text-white text-[10px] font-black">A</div>
             <span className="text-sm font-black text-zinc-900 uppercase tracking-tighter">Affinity Logistics</span>
          </div>
          <p className="text-zinc-400 text-[11px] font-bold uppercase tracking-widest">
            &copy; {new Date().getFullYear()} Global Operations Center. Secured.
          </p>
          <div className="flex gap-6 text-[11px] font-bold text-zinc-400 uppercase tracking-widest">
             <a href="#" className="hover:text-blue-600 transition-colors">Documentation</a>
             <a href="#" className="hover:text-blue-600 transition-colors">API Status</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
