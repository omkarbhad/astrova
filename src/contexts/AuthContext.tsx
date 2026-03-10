import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { onIdTokenChanged, type User } from 'firebase/auth';
import {
  auth,
  signInWithGoogle as firebaseSignInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  signOutUser,
} from '@/lib/firebase';
import { type AstrovaUser } from '@/lib/api';

export interface AuthContextType {
  astrovaUser: AstrovaUser | null;
  user: User | null;
  loading: boolean;
  isLoaded: boolean;
  isSignedIn: boolean;
  signInWithGoogle: () => Promise<{ error?: string }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, name?: string) => Promise<{ error?: string; needsVerification?: boolean }>;
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
      const user = data?.user ?? null;
      setAstrovaUser(user);
      sessionSyncTokenRef.current = idToken;

      // Sync shared Magnova session cookie (.magnova.ai) for cross-app SSO
      try {
        await fetch('https://auth.magnova.ai/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ token: idToken }),
        });
      } catch {
        // Non-fatal — Astrova still works, cross-app SSO won't be set
      }

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
    let sessionChecked = false;
    
    async function init() {
      // Check if magnova_auth cookie exists (set by auth.magnova.ai)
      try {
        const hasAuthCookie = document.cookie.includes('magnova_auth=1');
        if (hasAuthCookie) {
          // Session API is on auth.magnova.ai, not local
          const res = await fetch('https://auth.magnova.ai/api/auth/session', { 
            method: 'GET', 
            credentials: 'include' 
          });
          if (res.ok) {
            const data = await res.json();
            if (data.user) {
              setAstrovaUser(data.user);
              sessionChecked = true;
            }
          }
        }
      } catch {
        // Continue to Firebase
      }
      
      // Also listen to Firebase for direct sign-ins when configured
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
          if (!sessionChecked) setAstrovaUser(null);
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

  const signInWithEmailFn = useCallback(async (email: string, password: string) => {
    try {
      await signInWithEmail(email, password);
      return {};
    } catch (error) {
      return { error: (error as Error).message || 'Sign-in failed' };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    try {
      await signUpWithEmail(email, password);
      return {};
    } catch (error) {
      return { error: (error as Error).message || 'Sign-up failed' };
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
      signInWithEmail: signInWithEmailFn,
      signUp,
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
