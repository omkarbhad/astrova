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
  if (!baseUrl) {
    console.error('[auth] NEON_AUTH_BASE_URL not set');
    return null;
  }
  
  console.log(`[auth] Attempting opaque token verification with baseUrl: ${baseUrl}`);
  
  try {
    // Try multiple approaches for Neon Auth opaque token verification
    
    // Approach 1: Use /session endpoint with Bearer token
    const response1 = await fetch(`${baseUrl}/session`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });
    
    console.log(`[auth] Approach 1 - /session endpoint status: ${response1.status}`);
    
    if (response1.ok) {
      const session = await response1.json();
      console.log('[auth] Approach 1 - Session response:', session);
      
      if (session && session.user) {
        return {
          sub: session.user.id,
          email: session.user.email,
          name: session.user.name,
          picture: session.user.image,
        };
      }
    }
    
    // Approach 2: Try /me endpoint
    const response2 = await fetch(`${baseUrl}/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });
    
    console.log(`[auth] Approach 2 - /me endpoint status: ${response2.status}`);
    
    if (response2.ok) {
      const user = await response2.json();
      console.log('[auth] Approach 2 - User response:', user);
      
      if (user) {
        return {
          sub: user.id,
          email: user.email,
          name: user.name,
          picture: user.image,
        };
      }
    }
    
    // Approach 3: Try /user endpoint
    const response3 = await fetch(`${baseUrl}/user`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });
    
    console.log(`[auth] Approach 3 - /user endpoint status: ${response3.status}`);
    
    if (response3.ok) {
      const user = await response3.json();
      console.log('[auth] Approach 3 - User response:', user);
      
      if (user) {
        return {
          sub: user.id,
          email: user.email,
          name: user.name,
          picture: user.image,
        };
      }
    }
    
    console.error(`[auth] All opaque token verification approaches failed for token prefix: ${token.substring(0, 10)}`);
    return null;
    
  } catch (e) {
    console.error('[auth] Opaque token verification error:', e);
    return null;
  }
}

export async function requireAuth(req: Request): Promise<AuthPayload> {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/, '');
  if (!token) throw new Response('Unauthorized', { status: 401 });

  console.log(`[auth] Received token: prefix="${token.substring(0, 10)}", length=${token.length}, startsWith_eyJ=${token.startsWith('eyJ')}`);

  // For now, only accept JWT tokens - opaque tokens are not working with Neon Auth
  if (!token.startsWith('eyJ')) {
    console.error(`[auth] Opaque tokens not supported - only JWT tokens allowed. Token prefix: ${token.substring(0, 10)}`);
    throw new Response('Unauthorized - JWT token required', { status: 401 });
  }

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
    throw new Response('Unauthorized', { status: 401 });
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
