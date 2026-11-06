import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { configured, supabase } from './supabase';
import type { Staff } from './types';

interface AuthState {
  session: Session | null;
  staff: Staff | null;
  loading: boolean;
  isAdmin: boolean;
  passwordRecovery: boolean;
  clearRecovery: () => void;
  signOut: () => Promise<void>;
  refreshStaff: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  const loadStaff = useCallback(async (s: Session | null) => {
    if (!s) {
      setStaff(null);
      return;
    }
    const { data } = await supabase.from('staff').select('*').eq('user_id', s.user.id).maybeSingle();
    setStaff((data as Staff | null) ?? null);
  }, []);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    void supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadStaff(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      // Supabase empfiehlt, im Callback keine weiteren Supabase-Aufrufe direkt abzuwarten
      setTimeout(() => void loadStaff(s), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadStaff]);

  const value: AuthState = {
    session,
    staff,
    loading,
    isAdmin: staff?.role === 'admin' && staff.active,
    passwordRecovery,
    clearRecovery: () => setPasswordRecovery(false),
    signOut: async () => {
      await supabase.auth.signOut();
      setStaff(null);
    },
    refreshStaff: () => loadStaff(session),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth außerhalb von AuthProvider');
  return ctx;
}
