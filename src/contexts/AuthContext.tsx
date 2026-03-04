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

export function AuthProvider({ children }: { children: ReactNode }) {
  const session = authClient.useSession();
  const [astrovaUser, setAstrovaUser] = useState<AstrovaUser | null>(null);
  const [jwtToken, setJwtToken] = useState<string | null>(null);
  const syncAttempts = useRef(0);

  const isLoaded = !session.isPending;
  const sessionUser = session.data?.user;

  // Fetch JWT token whenever the session changes using getJWTToken()
  useEffect(() => {
    if (!sessionUser) {
      setJwtToken(null);
      return;
    }
    getJWTToken().then((token: string | null) => {
      setJwtToken(token ?? null);
    }).catch(() => setJwtToken(null));
  }, [sessionUser?.id, session.data]);

  // A user is truly signed in only when we have both a user AND a JWT token
  const isSignedIn = !!sessionUser && !!jwtToken;

  // Keep api.ts token in sync
  useEffect(() => {
    setTokenProvider(() => jwtToken);
  }, [jwtToken]);

  const signOutFn = useCallback(async () => {
    try { await authClient.signOut(); } catch { /* ignore signout errors */ }
    setAstrovaUser(null);
    setJwtToken(null);
    syncAttempts.current = 0;
  }, []);

  const syncAstrovaUser = useCallback(async () => {
    if (!sessionUser || !jwtToken) return;

    // Don't retry more than 2 times — if API keeps failing, session is stale
    if (syncAttempts.current >= 2) {
      console.warn('[auth] API calls failed after sign-in. Clearing stale session.');
      signOutFn();
      return;
    }
    syncAttempts.current++;

    const au = await getOrCreateAstrovaUser(
      sessionUser.id,
      sessionUser.email ?? '',
      sessionUser.name ?? undefined,
      sessionUser.image ?? undefined,
    );

    if (au) {
      setAstrovaUser(au);
      syncAttempts.current = 0;
    } else if (syncAttempts.current >= 2) {
      // Second failure — stale session, sign out
      console.warn('[auth] Failed to sync user from API. Signing out.');
      signOutFn();
    }
  }, [sessionUser?.id, jwtToken, signOutFn]);

  useEffect(() => {
    if (isSignedIn) {
      syncAttempts.current = 0;
      syncAstrovaUser();
    } else if (isLoaded && !sessionUser) {
      setAstrovaUser(null);
      syncAttempts.current = 0;
    }
  }, [isSignedIn, isLoaded, syncAstrovaUser]);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const resp = await authClient.signIn.email({ email, password });
      if (resp.error) return { error: resp.error.message ?? 'Sign-in failed' };
      return {};
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, name?: string) => {
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
    syncAttempts.current = 0;
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
