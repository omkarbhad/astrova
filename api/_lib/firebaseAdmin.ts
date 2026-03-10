/**
 * Edge-compatible Firebase ID token verifier.
 * Uses the firebase-admin-lite approach — fetches Google's public keys and
 * verifies the JWT with jose (no Node.js builtins required).
 */
import { createRemoteJWKSet, jwtVerify } from 'jose';

const FIREBASE_PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '';
const JWKS_URI = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJWKS() {
  if (!jwks) jwks = createRemoteJWKSet(new URL(JWKS_URI));
  return jwks;
}

export async function verifyToken(token: string): Promise<{ uid: string; email?: string; name?: string; picture?: string }> {
  const { payload } = await jwtVerify(token, getJWKS(), {
    issuer: ISSUER,
    audience: FIREBASE_PROJECT_ID,
  });
  return {
    uid: payload.sub as string,
    email: payload.email as string | undefined,
    name: payload.name as string | undefined,
    picture: payload.picture as string | undefined,
  };
}
