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

// [FIX #11] Centralized localStorage keys — prevents missed cleanup on logout
const USER_STORAGE_KEYS = [
  'astrova_saved_charts',
  'astrova_dakshina_credits',
  'astrova_auth_token',
  'astrova_user_preferences',
  'astrova_chart_cache',
  'astrova_charts',
] as const;

function clearUserData() {
  for (const key of USER_STORAGE_KEYS) {
    try { localStorage.removeItem(key); } catch { /* storage unavailable */ }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const session = authClient.useSession();
  const [astrovaUser, setAstrovaUser] = useState<AstrovaUser | null>(null);
  const [jwtToken, setJwtToken] = useState<string | null>(null);
  const prevSessionUserId = useRef<string | undefined>(undefined);
  // [FIX #48] Track initial mount to avoid double-fetch during hydration
  const hasMounted = useRef(false);

  const sessionPending = session.isPending;
  const sessionUser = session.data?.user;

  // isLoaded = fully resolved: session check done AND (no user OR JWT fetched)
  // This prevents AuthGuard from redirecting while JWT is still loading
  const isLoaded = !sessionPending && (!sessionUser || !!jwtToken);

  // Signed in = session exists + JWT token ready
  const isSignedIn = !!sessionUser && !!jwtToken;

  // [FIX #1] When session user changes OR signs out, clear old data immediately
  useEffect(() => {
    if (sessionUser?.id !== prevSessionUserId.current) {
      // Clear data when transitioning from any previous user (including to signed-out)
      if (prevSessionUserId.current !== undefined) {
        setAstrovaUser(null);
        setJwtToken(null);
        clearUserData();
      }
      prevSessionUserId.current = sessionUser?.id;
    }
  }, [sessionUser?.id]);

  // [FIX #3] Fetch JWT token only when session user ID changes (removed session.data dep)
  useEffect(() => {
    if (!sessionUser) {
      setJwtToken(null);
      return;
    }
    if (!hasMounted.current) hasMounted.current = true;
    let cancelled = false;
    getJWTToken().then((token) => {
      if (!cancelled) setJwtToken(token ?? null);
    }).catch(() => {
      if (!cancelled) setJwtToken(null);
    });
    return () => { cancelled = true; };
  }, [sessionUser?.id]);

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

  // [FIX #47] Properly clear state in finally — works even if signOut throws
  const signOutFn = useCallback(async () => {
    try {
      await authClient.signOut();
    } catch {
      // Sign out may fail if session already expired — still clear local state
    } finally {
      setAstrovaUser(null);
      setJwtToken(null);
      clearUserData();
    }
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
