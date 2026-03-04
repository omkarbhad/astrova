import { createAuthClient, createInternalNeonAuth } from '@neondatabase/neon-js/auth';
import { BetterAuthReactAdapter } from '@neondatabase/neon-js/auth/react/adapters';

const adapterOptions = {
  adapter: BetterAuthReactAdapter({
    fetchOptions: {
      credentials: 'include',
    },
  }),
};

// Raw Better Auth React client — provides useSession, signIn, signOut, etc.
export const authClient = createAuthClient(
  import.meta.env.VITE_NEON_AUTH_URL,
  adapterOptions
);

// NeonAuth wrapper — provides getJWTToken()
export const neonAuth = createInternalNeonAuth(
  import.meta.env.VITE_NEON_AUTH_URL,
  adapterOptions
);
