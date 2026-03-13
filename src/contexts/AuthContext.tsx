import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { onIdTokenChanged, type User } from 'firebase/auth';
import {
  auth,
  signInWithGoogle as firebaseSignInWithGoogle,
  signOutUser,
} from '@/lib/firebase';
import { normalizeAstrovaUser, type AstrovaUser } from '@/lib/api';

export interface AuthContextType {
  astrovaUser: AstrovaUser | null;
  user: User | null;
  loading: boolean;
  isLoaded: boolean;
  isSignedIn: boolean;
  signInWithGoogle: () => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [astrovaUser, setAstrovaUser] = useState<AstrovaUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const prevUserId = useRef<string | undefined>(undefined);
  const sessionSyncTokenRef = useRef<string | null>(null);

  const isLoaded = !loading;
  const isSignedIn = !!firebaseUser || !!astrovaUser;

  const syncServerSession = useCallback(async (idToken: string, force = false) => {
    if (!force && sessionSyncTokenRef.current === idToken) return null;
    try {
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ token: idToken }),
      });
      if (!res.ok) {
        console.error('[auth] session sync failed', res.status, await res.text());
        sessionSyncTokenRef.current = null;
        setAstrovaUser(null);
        return null;
      }
      const data = await res.json();
      const user = normalizeAstrovaUser(data?.user ?? null);
      setAstrovaUser(user);
      sessionSyncTokenRef.current = idToken;

      return user;
    } catch (error) {
      console.error('[auth] session sync error', error);
      sessionSyncTokenRef.current = null;
      setAstrovaUser(null);
      return null;
    }
  }, []);

  // Check existing session first (for cross-subdomain SSO), then listen to Firebase
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    async function init() {
      // User identity is established via Firebase → /api/auth/session only.
      // auth.magnova.ai returns magnova user IDs (different from Astrova DB IDs).
      if (!auth) {
        setFirebaseUser(null);
        setLoading(false);
        return;
      }

      unsubscribe = onIdTokenChanged(auth, async (nextUser) => {
        setFirebaseUser(nextUser);
        if (!nextUser) {
          sessionSyncTokenRef.current = null;
          setToken(null);
          setAstrovaUser(null);
          setLoading(false);
          return;
        }

        try {
          const idToken = await nextUser.getIdToken();
          setToken(idToken);
          await syncServerSession(idToken);
        } catch (error) {
          console.error('[auth] failed to refresh token', error);
          setToken(null);
        } finally {
          setLoading(false);
        }
      });
    }
    
    init();
    return () => unsubscribe?.();
  }, [syncServerSession]);

  useEffect(() => {
    const currentUserId = firebaseUser?.uid;
    if (currentUserId !== prevUserId.current) {
      if (prevUserId.current !== undefined) {
        setAstrovaUser(null);
      }
      prevUserId.current = currentUserId;
    }
  }, [firebaseUser?.uid]);

  const signInWithGoogle = useCallback(async () => {
    try {
      await firebaseSignInWithGoogle();
      return {};
    } catch (error) {
      return { error: (error as Error).message || 'Google sign-in failed' };
    }
  }, []);


  const signOutFn = useCallback(async () => {
    try {
      await fetch('/api/auth/signout', { method: 'DELETE' });
    } catch (error) {
      console.error('[auth] session sign out failed', error);
    }
    try {
      await signOutUser();
    } catch (error) {
      console.error('[auth] sign out failed', error);
    } finally {
      sessionSyncTokenRef.current = null;
      setToken(null);
      setAstrovaUser(null);
      setFirebaseUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    await syncServerSession(token, true);
  }, [token, syncServerSession]);

  return (
    <AuthContext.Provider value={{
      astrovaUser,
      user: firebaseUser,
      loading,
      isLoaded,
      isSignedIn,
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
