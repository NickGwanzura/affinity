import { createContext, useContext, ReactNode } from 'react';
import type { AuthSession } from '../types';

type SessionContextValue = {
  session: AuthSession | null;
  refreshSession: () => Promise<AuthSession | null>;
  clearSession: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({
  session,
  refreshSession,
  clearSession,
  children,
}: SessionContextValue & { children: ReactNode }) {
  return (
    <SessionContext.Provider value={{ session, refreshSession, clearSession }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): AuthSession | null {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx.session;
}

export function useSessionContext(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSessionContext must be used within SessionProvider');
  return ctx;
}
