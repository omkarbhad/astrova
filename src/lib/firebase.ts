import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  type Auth,
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
} from 'firebase/auth';

const requiredKeys = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

type EnvKey = (typeof requiredKeys)[number];

function getEnv(key: EnvKey): string | undefined {
  return import.meta.env[key] as string | undefined;
}

const hasFirebaseConfig = requiredKeys.every((key) => Boolean(getEnv(key)));
let authInstance: Auth | null = null;
let googleProvider: GoogleAuthProvider | null = null;

if (hasFirebaseConfig) {
  const firebaseConfig = {
    apiKey: getEnv('VITE_FIREBASE_API_KEY')!,
    authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN')!,
    projectId: getEnv('VITE_FIREBASE_PROJECT_ID')!,
    storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET')!,
    messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID')!,
    appId: getEnv('VITE_FIREBASE_APP_ID')!,
  };

  let app: FirebaseApp;
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
  authInstance = getAuth(app);
  googleProvider = new GoogleAuthProvider();
}

function requireFirebaseAuth(): Auth {
  if (!authInstance) {
    throw new Error('Firebase Auth is not configured. Set VITE_FIREBASE_* vars or use Magnova centralized auth.');
  }
  return authInstance;
}

export const auth = authInstance;
export const isFirebaseConfigured = hasFirebaseConfig;

export function signInWithGoogle() {
  const currentAuth = requireFirebaseAuth();
  return signInWithPopup(currentAuth, googleProvider!);
}

export function signInWithEmail(email: string, password: string) {
  const currentAuth = requireFirebaseAuth();
  return signInWithEmailAndPassword(currentAuth, email, password);
}

export function signUpWithEmail(email: string, password: string) {
  const currentAuth = requireFirebaseAuth();
  return createUserWithEmailAndPassword(currentAuth, email, password);
}

export function resetPassword(email: string, redirectUrl?: string) {
  const currentAuth = requireFirebaseAuth();
  const options = redirectUrl ? { url: redirectUrl } : undefined;
  return sendPasswordResetEmail(currentAuth, email, options);
}

export function signOutUser() {
  if (!authInstance) return Promise.resolve();
  return firebaseSignOut(authInstance);
}
