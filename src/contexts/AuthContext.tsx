import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { authClient, getJWTToken } from '@/lib/auth-client';
import { getOrCreateAstrovaUser, setTokenProvider, type AstrovaUser } from '@/lib/api';

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

/** Remove all user-specific data from localStorage */
function clearUserData() {
  localStorage.removeItem('astrova_saved_charts');
  localStorage.removeItem('astrova_dakshina_credits');
  localStorage.removeItem('astrova_auth_token');
  localStorage.removeItem('astrova_user_preferences');
  localStorage.removeItem('astrova_chart_cache');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const session = authClient.useSession();
  const [astrovaUser, setAstrovaUser] = useState<AstrovaUser | null>(null);
  const [jwtToken, setJwtToken] = useState<string | null>(null);
  const prevSessionUserId = useRef<string | undefined>(undefined);

  const sessionPending = session.isPending;
  const sessionUser = session.data?.user;

  // isLoaded = fully resolved: session check done AND (no user OR JWT fetched)
  // This prevents AuthGuard from redirecting while JWT is still loading
  const isLoaded = !sessionPending && (!sessionUser || !!jwtToken);

  // Signed in = session exists + JWT token ready
  const isSignedIn = !!sessionUser && !!jwtToken;

  // When session user changes (different account or sign-out), clear old data
  useEffect(() => {
    if (sessionUser?.id !== prevSessionUserId.current) {
      if (prevSessionUserId.current && sessionUser?.id) {
        setAstrovaUser(null);
        setJwtToken(null);
        clearUserData();
      }
      prevSessionUserId.current = sessionUser?.id;
    }
  }, [sessionUser?.id]);

  // Fetch JWT token whenever session changes
  useEffect(() => {
    if (!sessionUser) {
      setJwtToken(null);
      return;
    }
    getJWTToken().then((token) => setJwtToken(token ?? null)).catch(() => setJwtToken(null));
  }, [sessionUser?.id, session.data]);

  // Keep api.ts token in sync
  useEffect(() => {
    setTokenProvider(() => jwtToken);
  }, [jwtToken]);

  // Sync astrova user from DB once we have session + JWT
  const syncAstrovaUser = useCallback(async () => {
    if (!sessionUser || !jwtToken) return;
    const au = await getOrCreateAstrovaUser(
      sessionUser.id,
      sessionUser.email ?? '',
      sessionUser.name ?? undefined,
      sessionUser.image ?? undefined,
    );
    if (au) {
      setAstrovaUser(au);
    }
  }, [sessionUser?.id, jwtToken]);

  useEffect(() => {
    if (isSignedIn) {
      syncAstrovaUser();
    } else if (!sessionPending && !sessionUser) {
      setAstrovaUser(null);
    }
  }, [isSignedIn, sessionPending, sessionUser, syncAstrovaUser]);

  const signOutFn = useCallback(async () => {
    try { await authClient.signOut(); } catch { /* ignore */ }
    setAstrovaUser(null);
    setJwtToken(null);
    clearUserData();
  }, []);

  // Simple signIn — no pre-signOut, just sign in directly
  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const resp = await authClient.signIn.email({ email, password });
      if (resp.error) return { error: resp.error.message ?? 'Sign-in failed' };
      return {};
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, name?: string): Promise<{ error?: string; needsVerification?: boolean }> => {
    try {
      const resp = await authClient.signUp.email({
        email,
        password,
        name: name ?? email.split('@')[0],
      });
      if (resp.error) return { error: resp.error.message ?? 'Sign-up failed' };
      return {};
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      await authClient.signIn.social({
        provider: 'google',
        callbackURL: '/chart',
      });
      return {};
    } catch (e) {
      return { error: (e as Error).message };
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
