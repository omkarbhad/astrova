import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { getOrCreateAstrovaUser, setTokenProvider, type AstrovaUser } from '@/lib/api';
import type { Session } from '@supabase/supabase-js';

interface AuthContextType {
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
  const [sessionLoading, setSessionLoading] = useState(true);
  const [astrovaUser, setAstrovaUser] = useState<AstrovaUser | null>(null);
  const prevUserId = useRef<string | undefined>(undefined);

  // With Supabase, session.access_token IS the JWT — no separate fetch needed
  const isLoaded = !sessionLoading;
  const isSignedIn = !!session?.user;

  // Bootstrap: get initial session + subscribe to auth changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setSessionLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setSessionLoading(false);
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  // When session user changes, clear stale data
  useEffect(() => {
    const currentUserId = session?.user?.id;
    if (currentUserId !== prevUserId.current) {
      if (prevUserId.current !== undefined) {
        setAstrovaUser(null);
      }
      prevUserId.current = currentUserId;
    }
  }, [session?.user?.id]);

  // Keep api.ts token provider in sync with the Supabase access_token
  useEffect(() => {
    setTokenProvider(() => session?.access_token ?? null);
  }, [session?.access_token]);

  // Sync astrova user from Neon DB once we have a valid session
  const syncAstrovaUser = useCallback(async () => {
    const user = session?.user;
    if (!user || !session?.access_token) return;
    const au = await getOrCreateAstrovaUser(
      user.id,
      user.email ?? '',
      user.user_metadata?.name ?? user.user_metadata?.full_name ?? undefined,
      user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? undefined,
    );
    if (au) setAstrovaUser(au);
  }, [session?.user?.id, session?.access_token]);

  useEffect(() => {
    if (isSignedIn) {
      syncAstrovaUser();
    } else if (isLoaded && !session) {
      setAstrovaUser(null);
    }
  }, [isSignedIn, isLoaded, session, syncAstrovaUser]);

  // Auth methods
  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      return {};
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, name?: string): Promise<{ error?: string; needsVerification?: boolean }> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name: name ?? email.split('@')[0] },
        },
      });
      if (error) return { error: error.message };
      // Supabase returns user with identities=[] when email already exists
      if (data.user && data.user.identities?.length === 0) {
        return { error: 'An account with this email already exists.' };
      }
      // Email confirmation required — session is null
      if (data.user && !data.session) {
        return { needsVerification: true };
      }
      return {};
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/chart`,
        },
      });
      if (error) return { error: error.message };
      return {};
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, []);

  const signOutFn = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Sign out may fail if session already expired
    } finally {
      setAstrovaUser(null);
      setSession(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    await syncAstrovaUser();
  }, [syncAstrovaUser]);

  return (
    <AuthContext.Provider value={{
      astrovaUser,
      isLoaded,
      isSignedIn,
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
