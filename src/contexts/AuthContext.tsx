import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase, getOrCreateAstrovaUser, type AstrovaUser } from '@/lib/supabase';
import type { Session, User as SupabaseAuthUser } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  authUser: SupabaseAuthUser | null;
  astrovaUser: AstrovaUser | null;
  isLoaded: boolean;
  isSignedIn: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, name?: string) => Promise<{ error?: string; needsVerification?: boolean }>;
  signInWithGoogle: () => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authUser, setAuthUser] = useState<SupabaseAuthUser | null>(null);
  const [astrovaUser, setAstrovaUser] = useState<AstrovaUser | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const syncAstrovaUser = useCallback(async (su: SupabaseAuthUser) => {
    const au = await getOrCreateAstrovaUser(
      su.id,
      su.email || '',
      su.user_metadata?.full_name || su.user_metadata?.name || undefined,
      su.user_metadata?.avatar_url || su.user_metadata?.picture || undefined
    );
    setAstrovaUser(au);
  }, []);

  useEffect(() => {
    if (!supabase) { setIsLoaded(true); return; }

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setAuthUser(s?.user ?? null);
      if (s?.user) syncAstrovaUser(s.user);
      setIsLoaded(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setAuthUser(s?.user ?? null);
      if (s?.user) syncAstrovaUser(s.user);
      else setAstrovaUser(null);
      setIsLoaded(true);
      // Auto-redirect after OAuth callback (SIGNED_IN event from OAuth redirect)
      if (event === 'SIGNED_IN' && s?.user && window.location.pathname === '/login') {
        window.location.href = '/chart';
      }
    });

    return () => subscription.unsubscribe();
  }, [syncAstrovaUser]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: 'Supabase not configured' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return {};
  }, []);

  const signUp = useCallback(async (email: string, password: string, name?: string) => {
    if (!supabase) return { error: 'Supabase not configured' };
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (error) return { error: error.message };
    return { needsVerification: true };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) return { error: 'Supabase not configured' };
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/chart` },
    });
    if (error) return { error: error.message };
    return {};
  }, []);

  const signOutFn = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setAstrovaUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (authUser) await syncAstrovaUser(authUser);
  }, [authUser, syncAstrovaUser]);

  return (
    <AuthContext.Provider value={{
      session,
      authUser,
      astrovaUser,
      isLoaded,
      isSignedIn: !!session && !!authUser,
      signIn,
      signUp,
      signInWithGoogle,
      signOut: signOutFn,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function useAstrovaUser() {
  const { astrovaUser } = useAuth();
  return astrovaUser;
}
