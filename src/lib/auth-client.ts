import { createAuthClient } from '@neondatabase/neon-js/auth';
import { BetterAuthReactAdapter } from '@neondatabase/neon-js/auth/react/adapters';

export const authClient = createAuthClient(
  import.meta.env.VITE_NEON_AUTH_URL,
  {
    adapter: BetterAuthReactAdapter({
      fetchOptions: {
        credentials: 'include',
      },
    }),
  }
);

const NEON_AUTH_URL = import.meta.env.VITE_NEON_AUTH_URL;

/**
 * Fetch a JWT token from Neon Auth's /token endpoint.
 * This exchanges the current session cookie for a signed JWT
 * that the backend can verify via JWKS.
 */
export async function getJWTToken(): Promise<string | null> {
  // [FIX #2] Add 8s timeout to prevent hanging forever
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const resp = await fetch(`${NEON_AUTH_URL}/token`, {
      credentials: 'include',
      signal: controller.signal,
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.token ?? data.jwt ?? data.access_token ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
