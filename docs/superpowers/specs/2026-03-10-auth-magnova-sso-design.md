# Astrova Auth via magnova-auth SSO

**Date:** 2026-03-10
**Status:** Approved

## Context

Astrova is one of several apps under `.magnova.ai`. Authentication is handled centrally by `auth.magnova.ai` (magnova-auth), which manages Google sign-in via Firebase and sets a shared `magnova_session` httpOnly cookie on `Domain=.magnova.ai`.

Previously, Astrova bundled the Firebase SDK and had its own auth flow, leading to:
- Two separate `users` tables (magnova-auth DB and Astrova DB) with different UUIDs for the same person
- Credits deduction failing because the wrong user ID was used
- Unnecessary Firebase SDK weight in the Astrova bundle

## Design

### Architecture

```
User → auth.magnova.ai (Google sign-in)
     → sets magnova_session cookie (Domain=.magnova.ai, httpOnly, contains Firebase UID)
     → redirects to astrova.magnova.ai

Astrova page load:
  Frontend → GET /api/auth/me (credentials: include)
  Backend  → reads magnova_session cookie → extracts firebase_uid
           → calls auth.magnova.ai/api/auth/verify to validate session
           → if invalid → 401
           → if valid → looks up/creates user in Astrova's users table (by firebase_uid)
           → returns Astrova user object (Astrova UUID, credits, email, etc.)
  Frontend → if 200, set astrovaUser; if 401, redirect to auth.magnova.ai
```

### Changes to Astrova

#### Remove
- Firebase SDK (`firebase/auth`, `firebase/app`)
- `src/lib/firebase.ts`
- `api/_lib/firebaseAdmin.ts`
- `api/auth/session.ts` (POST endpoint for Firebase token verification)
- All `VITE_FIREBASE_*` environment variables from Astrova
- Firebase-related dependencies from `package.json`

#### Add
- `GET /api/auth/me` — new endpoint:
  1. Read `magnova_session` cookie (firebase_uid)
  2. Call `auth.magnova.ai/api/auth/verify` with the firebase_uid to validate
  3. If invalid → return 401
  4. If valid → query Astrova `users` table by `firebase_uid`
  5. If user not found → INSERT with email/name from verify response, 10 initial credits
  6. Return Astrova user object

#### Modify
- `src/contexts/AuthContext.tsx` — simplify:
  - On mount: `GET /api/auth/me`
  - If 200 → set `astrovaUser`, `isSignedIn = true`
  - If 401 → `isSignedIn = false`
  - `signInWithGoogle` → `window.location.href = 'https://auth.magnova.ai?redirect=https://astrova.magnova.ai'`
  - `signOut` → `DELETE /api/auth/signout` then redirect to `auth.magnova.ai/signout`
  - Remove Firebase imports, `onIdTokenChanged`, token management
- `api/_lib/auth.ts` — `requireAuth()` stays mostly the same (reads `magnova_session` cookie, queries Astrova `users` table). Add verification call to `auth.magnova.ai/api/auth/verify` for session validation.
- `api/auth/signout.ts` — keep as-is (clears cookie)

### Changes to magnova-auth

#### Add
- `GET /api/auth/verify` — new endpoint:
  1. Read `magnova_session` cookie OR accept `firebase_uid` as query param
  2. Look up user in magnova `magnova_users` table by firebase_uid
  3. If found → return `{ valid: true, firebase_uid, email, name, avatar_url }`
  4. If not found → return `{ valid: false }`
  5. Must handle CORS for `astrova.magnova.ai` origin

### Data Flow: Credits Deduction (Fixed)

The credits deduction flow is unchanged. The fix is structural:
- `astrovaUser.id` is now always the Astrova DB UUID (looked up by `firebase_uid`)
- Never the magnova UUID (which was the root cause of the 403 errors)
- `deductCredits` sends the correct Astrova UUID → credits API finds the user → UPDATE succeeds

### What Stays the Same
- Astrova's own Neon Postgres DB and all tables (users, credit_transactions, etc.)
- All API endpoints except auth (credits, charts, sessions, kb, models, settings)
- Credits system, CreditsContext
- Frontend UI (sidebar, chat, charts)

### Environment Variables

#### Astrova (after changes)
- `DATABASE_URL` — Astrova Neon Postgres (unchanged)
- `MAGNOVA_AUTH_URL` — `https://auth.magnova.ai` (new, for verify calls)
- Remove all `VITE_FIREBASE_*` vars

#### magnova-auth
- No changes needed

### Sign-in/Sign-out Flows

**Sign in:**
1. User visits `astrova.magnova.ai`
2. Frontend calls `GET /api/auth/me`
3. No cookie → 401 → frontend redirects to `https://auth.magnova.ai?redirect=https://astrova.magnova.ai`
4. User signs in on auth.magnova.ai → cookie set on `.magnova.ai` → redirect back
5. Frontend calls `GET /api/auth/me` again → 200 → user loaded

**Sign out:**
1. Frontend calls `DELETE /api/auth/signout` (clears Astrova-specific state)
2. Redirect to `https://auth.magnova.ai/signout` (clears magnova_session cookie + Firebase sign-out)
