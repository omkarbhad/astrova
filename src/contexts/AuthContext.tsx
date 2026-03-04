import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { authClient } from '@/lib/auth-client';
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
  const syncAttempts = useRef(0);

  const isLoaded = !session.isPending;
  const sessionUser = session.data?.user;

  // Neon Auth: find the JWT (access_token) — check multiple possible locations
  const rawData = session.data as Record<string, unknown> | null;
  const sessionObj = rawData?.session as Record<string, unknown> | undefined;
  const sessionToken = (
    (sessionObj?.access_token as string) ??
    (sessionObj?.accessToken as string) ??
    (rawData?.accessToken as string) ??
    (rawData?.access_token as string) ??
    (sessionObj?.token as string) ??
    null
  );

  // For debugging, let's also check if there are any JWT-like tokens in the session
  const allTokens = [
    sessionObj?.access_token,
    sessionObj?.accessToken, 
    rawData?.accessToken,
    rawData?.access_token,
    sessionObj?.token
  ].filter(Boolean);

  // Find if any token looks like a JWT (starts with eyJ)
  const jwtToken = allTokens.find(token => 
    typeof token === 'string' && token.startsWith('eyJ')
  ) as string | undefined;

  // Use JWT token if found, otherwise fall back to the regular token extraction
  const finalToken = jwtToken || sessionToken;

  // Debug: log session structure once on change (remove after confirming)
  useEffect(() => {
    if (rawData) {
      console.log('[auth] session keys:', Object.keys(rawData));
      if (sessionObj) console.log('[auth] session.session keys:', Object.keys(sessionObj));
      console.log('[auth] token type:', finalToken?.substring(0, 4) === 'eyJ' ? 'JWT' : 'opaque', '| length:', finalToken?.length);
      console.log('[auth] all tokens found:', allTokens.map(t => typeof t === 'string' ? `${t.substring(0, 4)}...(${t.length})` : 'invalid'));
      
      // Show warning if only opaque tokens are available
      if (finalToken && !finalToken.startsWith('eyJ')) {
        console.warn('[auth] WARNING: Only opaque token available. JWT tokens required for API access.');
        // You could also show a user-friendly message here
      }
    }
  }, [finalToken]);

  // A user is truly signed in only when we have both a user AND a valid token
  const isSignedIn = !!sessionUser && !!finalToken;

  // Keep api.ts token in sync with Neon Auth session
  useEffect(() => {
    setTokenProvider(() => finalToken ?? null);
  }, [finalToken]);

  const signOutFn = useCallback(async () => {
    try { await authClient.signOut(); } catch { /* ignore signout errors */ }
    setAstrovaUser(null);
    syncAttempts.current = 0;
  }, []);

  const syncAstrovaUser = useCallback(async () => {
    if (!sessionUser || !finalToken) return;

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
  }, [sessionUser?.id, finalToken, signOutFn]);

  useEffect(() => {
    if (isSignedIn) {
      syncAttempts.current = 0;
      syncAstrovaUser();
    } else if (isLoaded) {
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
