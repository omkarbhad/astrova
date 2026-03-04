import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface AuthPayload {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
}

let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS() {
  if (!_jwks) {
    const base = process.env.NEON_AUTH_BASE_URL;
    if (!base) throw new Error('NEON_AUTH_BASE_URL not set');
    _jwks = createRemoteJWKSet(new URL(`${base}/.well-known/jwks.json`));
  }
  return _jwks;
}

async function verifyOpaqueToken(token: string): Promise<AuthPayload | null> {
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  if (!baseUrl) return null;
  
  try {
    // For Neon Auth opaque tokens, we need to use the token as a Bearer token
    // to get the current session info
    const response = await fetch(`${baseUrl}/session`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.error(`[auth] Session endpoint returned ${response.status}`);
      return null;
    }
    
    const session = await response.json();
    console.log('[auth] Session response:', session);
    
    // The session structure should have user data
    if (!session || !session.user) {
      console.error('[auth] No user data in session response');
      return null;
    }
    
    return {
      sub: session.user.id,
      email: session.user.email,
      name: session.user.name,
      picture: session.user.image,
    };
  } catch (e) {
    console.error('[auth] Opaque token verification failed:', e);
    return null;
  }
}

export async function requireAuth(req: Request): Promise<AuthPayload> {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/, '');
  if (!token) throw new Response('Unauthorized', { status: 401 });

  console.log(`[auth] Received token: prefix="${token.substring(0, 10)}", length=${token.length}, startsWith_eyJ=${token.startsWith('eyJ')}`);

  // Check if it's a JWT token (starts with eyJ) or opaque token
  if (token.startsWith('eyJ')) {
    console.log('[auth] Attempting JWT verification');
    try {
      const { payload } = await jwtVerify(token, getJWKS());
      console.log('[auth] JWT verification successful:', payload);
      
      if (!payload.sub) throw new Error('No sub in token');
      return {
        sub: payload.sub,
        email: payload.email as string | undefined,
        name: payload.name as string | undefined,
        picture: payload.picture as string | undefined,
      };
    } catch (e) {
      const prefix = token.substring(0, 10);
      console.error(`[auth] JWT verify failed | token_prefix="${prefix}" | error:`, e instanceof Error ? e.message : String(e));
      
      // Try opaque token verification as fallback
      console.log('[auth] Falling back to opaque token verification');
      const payload = await verifyOpaqueToken(token);
      if (!payload) {
        console.error(`[auth] Both JWT and opaque token verification failed`);
        throw new Response('Unauthorized', { status: 401 });
      }
      return payload;
    }
  } else {
    // Handle opaque token
    console.log('[auth] Attempting opaque token verification');
    const payload = await verifyOpaqueToken(token);
    if (!payload) {
      console.error(`[auth] Opaque token verification failed | token_prefix="${token.substring(0, 10)}"`);
      throw new Response('Unauthorized', { status: 401 });
    }
    return payload;
  }
}

/**
 * Resolve the authenticated user's internal astrova_users.id from their auth_id,
 * then verify the requested userId matches (or the user is an admin).
 */
export async function requireOwnership(
  sql: import('./db.js').Sql,
  authPayload: AuthPayload,
  requestedUserId: string,
): Promise<void> {
  const rows = await sql`SELECT id, role FROM astrova_users WHERE auth_id = ${authPayload.sub} LIMIT 1`;
  const me = rows[0] as { id: string; role: string } | undefined;
  if (!me) throw new Response('Forbidden', { status: 403 });
  if (me.id !== requestedUserId && me.role !== 'admin') {
    throw new Response('Forbidden', { status: 403 });
  }
}
