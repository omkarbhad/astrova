# Auth: magnova-auth SSO Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Astrova's Firebase auth with cookie-based SSO via magnova-auth, so Astrova reads the `magnova_session` cookie set by `auth.magnova.ai` and uses it to identify users.

**Architecture:** magnova-auth handles all sign-in (Google OAuth via Firebase). It sets a `magnova_session` httpOnly cookie on `Domain=.magnova.ai` containing the Firebase UID. Astrova reads this cookie server-side, verifies it against `auth.magnova.ai/api/auth/session` (GET), then looks up/creates the user in Astrova's own `users` table by `firebase_uid`. No Firebase SDK in Astrova.

**Tech Stack:** React 19, TypeScript, Vercel Edge Functions, Neon Postgres, magnova-auth SSO

**Spec:** `docs/superpowers/specs/2026-03-10-auth-magnova-sso-design.md`

**Key URLs:**
- Sign in: `https://auth.magnova.ai/astrova?redirect=https://astrova.magnova.ai/chart`
- Verify session: `GET https://auth.magnova.ai/api/auth/session` (with `credentials: include`)
- Sign out: `GET https://auth.magnova.ai/api/auth/signout?redirect=https://astrova.magnova.ai`

**Key discovery:** magnova-auth's `GET /api/auth/session` (at `src/app/api/auth/session/route.ts:81-108`) already verifies the `magnova_session` cookie and returns the magnova user. We use this as our verify endpoint — no new endpoint needed on magnova-auth.

---

## File Structure

### Create
- `api/auth/me.ts` — New endpoint: reads cookie, verifies via magnova-auth, looks up/creates Astrova user

### Modify
- `src/contexts/AuthContext.tsx` — Replace Firebase auth with cookie-based session check
- `api/_lib/auth.ts` — Remove `verifyToken` import, simplify to cookie-only auth
- `api/auth/signout.ts` — Keep as-is (already works)
- `package.json` — Remove `firebase` dependency

### Delete
- `src/lib/firebase.ts` — Firebase client SDK (no longer needed)
- `api/_lib/firebaseAdmin.ts` — Firebase admin/token verification (no longer needed)
- `api/auth/session.ts` — POST endpoint for Firebase token sync (replaced by `me.ts`)

---

## Chunk 1: Backend — New /api/auth/me endpoint

### Task 1: Create `/api/auth/me` endpoint

**Files:**
- Create: `api/auth/me.ts`

This endpoint:
1. Reads `magnova_session` cookie (contains firebase_uid)
2. Calls `auth.magnova.ai/api/auth/session` (GET, forwarding the cookie) to verify
3. If invalid → 401
4. If valid → uses firebase_uid to look up / create user in Astrova's `users` table
5. Returns the Astrova user object

- [ ] **Step 1: Create `api/auth/me.ts`**

```typescript
import { getDb, json } from '../_lib/db.js';

export const config = { runtime: 'edge' };

const SESSION_COOKIE_NAME = 'magnova_session';
const MAGNOVA_AUTH_URL = 'https://auth.magnova.ai';

function extractCookie(req: Request, name: string): string | null {
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [key, ...valueParts] = part.trim().split('=');
    if (key === name) return decodeURIComponent(valueParts.join('='));
  }
  return null;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const firebaseUid = extractCookie(req, SESSION_COOKIE_NAME);
    if (!firebaseUid) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify session with magnova-auth by forwarding the cookie
    const verifyRes = await fetch(`${MAGNOVA_AUTH_URL}/api/auth/session`, {
      method: 'GET',
      headers: {
        Cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(firebaseUid)}`,
      },
    });

    if (!verifyRes.ok) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { user: magnovaUser } = await verifyRes.json();
    if (!magnovaUser?.firebase_uid) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Look up or create user in Astrova's DB
    const sql = getDb();
    const email = magnovaUser.email || '';
    const name = magnovaUser.name || null;
    const avatarUrl = magnovaUser.avatar_url || null;

    let rows = await sql`
      SELECT id, firebase_uid AS auth_id, email,
             COALESCE(display_name, name) AS display_name,
             avatar_url, role, is_banned, credits, credits_used,
             last_login_at, created_at
      FROM users
      WHERE firebase_uid = ${firebaseUid}
      LIMIT 1`;

    if (!rows[0]) {
      // First time in Astrova — create user with 10 credits
      rows = await sql`
        INSERT INTO users (firebase_uid, email, name, display_name, avatar_url, credits, last_login_at)
        VALUES (${firebaseUid}, ${email}, ${name}, ${name}, ${avatarUrl}, 10, now())
        RETURNING id, firebase_uid AS auth_id, email,
                  COALESCE(display_name, name) AS display_name,
                  avatar_url, role, is_banned, credits, credits_used,
                  last_login_at, created_at`;
    } else {
      // Update last_login and any changed profile info from magnova
      await sql`
        UPDATE users SET
          email = COALESCE(NULLIF(${email}, ''), email),
          display_name = COALESCE(${name}, display_name, name),
          avatar_url = COALESCE(${avatarUrl}, avatar_url),
          last_login_at = now(),
          updated_at = now()
        WHERE firebase_uid = ${firebaseUid}`;
    }

    return json(rows[0]);
  } catch (e) {
    console.error('[auth/me]', e);
    return new Response('Internal Server Error', { status: 500 });
  }
}
```

- [ ] **Step 2: Verify the endpoint compiles**

Run: `npx tsc --noEmit api/auth/me.ts` or just check for IDE errors.

- [ ] **Step 3: Commit**

```bash
git add api/auth/me.ts
git commit -m "feat: add /api/auth/me endpoint for magnova-auth SSO verification"
```

---

### Task 2: Update `requireAuth` in `api/_lib/auth.ts`

**Files:**
- Modify: `api/_lib/auth.ts`

Remove the `verifyToken` import (from firebaseAdmin). The `requireAuth` function already reads the `magnova_session` cookie and queries Astrova's DB by `firebase_uid` — this is correct behavior. Only change: remove the dead import.

- [ ] **Step 1: Remove `verifyToken` import**

In `api/_lib/auth.ts`, line 2 currently has:
```typescript
import { sql } from './db.js';
// verifyToken no longer needed - magnova_session cookie contains Firebase UID directly
```

No functional change needed — `requireAuth` already works by reading the cookie and querying the Astrova `users` table. Just verify the comment is accurate.

- [ ] **Step 2: Commit (if any change made)**

```bash
git add api/_lib/auth.ts
git commit -m "chore: clean up auth.ts comments"
```

---

## Chunk 2: Frontend — Replace Firebase AuthContext with cookie-based session

### Task 3: Simplify `AuthContext.tsx`

**Files:**
- Modify: `src/contexts/AuthContext.tsx`

Replace the entire Firebase-based auth flow with a simple cookie-based session check.

- [ ] **Step 1: Rewrite `AuthContext.tsx`**

```typescript
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { normalizeAstrovaUser, type AstrovaUser } from '@/lib/api';

export interface AuthContextType {
  astrovaUser: AstrovaUser | null;
  user: null; // kept for backward compat with components that check user
  loading: boolean;
  isLoaded: boolean;
  isSignedIn: boolean;
  signInWithGoogle: () => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const AUTH_MAGNOVA_URL = 'https://auth.magnova.ai';
const ASTROVA_URL = 'https://astrova.magnova.ai';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [astrovaUser, setAstrovaUser] = useState<AstrovaUser | null>(null);
  const [loading, setLoading] = useState(true);

  const isLoaded = !loading;
  const isSignedIn = !!astrovaUser;

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const user = normalizeAstrovaUser(data);
        setAstrovaUser(user);
        return user;
      }
      setAstrovaUser(null);
      return null;
    } catch {
      setAstrovaUser(null);
      return null;
    }
  }, []);

  // Check session on mount
  useEffect(() => {
    checkSession().finally(() => setLoading(false));
  }, [checkSession]);

  const signInWithGoogle = useCallback(async () => {
    // Redirect to magnova-auth with Astrova as the return URL
    window.location.href = `${AUTH_MAGNOVA_URL}/astrova?redirect=${encodeURIComponent(ASTROVA_URL + '/chart')}`;
    return {};
  }, []);

  const signOut = useCallback(async () => {
    // Clear Astrova session cookie
    try {
      await fetch('/api/auth/signout', { method: 'DELETE', credentials: 'include' });
    } catch {
      // best effort
    }
    setAstrovaUser(null);
    // Redirect to magnova-auth signout to clear the shared cookie
    window.location.href = `${AUTH_MAGNOVA_URL}/api/auth/signout?redirect=${encodeURIComponent(ASTROVA_URL)}`;
  }, []);

  const refreshUser = useCallback(async () => {
    await checkSession();
  }, [checkSession]);

  return (
    <AuthContext.Provider value={{
      astrovaUser,
      user: null,
      loading,
      isLoaded,
      isSignedIn,
      signInWithGoogle,
      signOut,
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
```

- [ ] **Step 2: Check for remaining Firebase imports across the frontend**

Run: `grep -r "firebase" src/ --include="*.ts" --include="*.tsx" -l`

Any file that imports from `@/lib/firebase` or `firebase/auth` needs to be updated. The main ones are `AuthContext.tsx` (done) and potentially components that use `user` (Firebase User object).

- [ ] **Step 3: Commit**

```bash
git add src/contexts/AuthContext.tsx
git commit -m "feat: replace Firebase auth with magnova-auth SSO in AuthContext"
```

---

### Task 4: Remove Firebase files and dependencies

**Files:**
- Delete: `src/lib/firebase.ts`
- Delete: `api/_lib/firebaseAdmin.ts`
- Delete: `api/auth/session.ts`
- Modify: `package.json` — remove `firebase` dep

- [ ] **Step 1: Check for remaining imports of deleted files**

Run:
```bash
grep -r "firebase" src/ api/ --include="*.ts" --include="*.tsx" -l
```

Expected: only `api/_lib/auth.ts` (which has a comment mentioning firebase, not an import) and possibly test files.

- [ ] **Step 2: Delete Firebase files**

```bash
rm src/lib/firebase.ts
rm api/_lib/firebaseAdmin.ts
rm api/auth/session.ts
```

- [ ] **Step 3: Remove `firebase` from `package.json`**

```bash
pnpm remove firebase
```

- [ ] **Step 4: Verify build still works**

```bash
pnpm build
```

Expected: build succeeds with no import errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove Firebase SDK and related files, use magnova-auth SSO only"
```

---

## Chunk 3: Cleanup and deploy

### Task 5: Remove Firebase env vars from Vercel

**Files:** None (Vercel dashboard or CLI)

- [ ] **Step 1: Remove VITE_FIREBASE_* vars from Vercel**

```bash
vercel env rm VITE_FIREBASE_API_KEY production preview development
vercel env rm VITE_FIREBASE_AUTH_DOMAIN production preview development
vercel env rm VITE_FIREBASE_PROJECT_ID production preview development
vercel env rm VITE_FIREBASE_STORAGE_BUCKET production preview development
vercel env rm VITE_FIREBASE_MESSAGING_SENDER_ID production preview development
vercel env rm VITE_FIREBASE_APP_ID production preview development
vercel env rm VITE_FIREBASE_MEASUREMENT_ID production preview development
```

Note: These are interactive commands. If they fail, remove via Vercel dashboard.

- [ ] **Step 2: Clean up local `.env`**

Remove `VITE_FIREBASE_*` lines from `.env` since they're placeholder values and no longer used.

- [ ] **Step 3: Commit env changes**

```bash
git add .env
git commit -m "chore: remove Firebase env vars from local config"
```

---

### Task 6: Deploy and verify

- [ ] **Step 1: Deploy to Vercel**

```bash
vercel --prod
```

- [ ] **Step 2: Test the full flow**

1. Open `https://astrova.magnova.ai` in an incognito window
2. Should redirect to `auth.magnova.ai/astrova?redirect=...`
3. Sign in with Google
4. Should redirect back to Astrova with user loaded
5. Check credits display shows correct value
6. Send a chat message — credits should deduct and `credits_used` should increment in DB
7. Refresh page — session should persist (cookie-based)
8. Sign out — should clear session and redirect

- [ ] **Step 3: Verify DB state**

```bash
# Check credits_used is no longer 0 after sending a message
node -e "
const { Pool } = require('@neondatabase/serverless');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT id, email, credits, credits_used FROM users').then(r => {
  console.log(JSON.stringify(r.rows, null, 2));
  pool.end();
});
"
```

- [ ] **Step 4: Final commit if any tweaks needed**
