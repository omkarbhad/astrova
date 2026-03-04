import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Sql } from './db.js';

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

// [FIX #9] Removed ~95 lines of dead verifyOpaqueToken code

// [FIX #10] Removed all sensitive console.log calls that leaked token data
export async function requireAuth(req: Request): Promise<AuthPayload> {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/, '');
  if (!token) throw new Response('Unauthorized', { status: 401 });

  if (!token.startsWith('eyJ')) {
    throw new Response('Unauthorized - JWT token required', { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(token, getJWKS());
    if (!payload.sub) throw new Error('No sub in token');
    return {
      sub: payload.sub,
      email: payload.email as string | undefined,
      name: payload.name as string | undefined,
      picture: payload.picture as string | undefined,
    };
  } catch (e) {
    console.error('[auth] JWT verify failed:', e instanceof Error ? e.message : 'unknown');
    throw new Response('Unauthorized', { status: 401 });
  }
}

// [FIX #39] Reusable admin check helper — avoids repeating admin verification in every endpoint
export async function requireAdmin(sql: Sql, authPayload: AuthPayload): Promise<{ id: string; role: string }> {
  const rows = await sql`SELECT id, role FROM astrova_users WHERE auth_id = ${authPayload.sub} LIMIT 1`;
  const me = rows[0] as { id: string; role: string } | undefined;
  if (!me || me.role !== 'admin') throw new Response('Forbidden', { status: 403 });
  return me;
}

// [FIX #41] Check if user is banned before allowing operations
export async function requireNotBanned(sql: Sql, authPayload: AuthPayload): Promise<void> {
  const rows = await sql`SELECT is_banned FROM astrova_users WHERE auth_id = ${authPayload.sub} LIMIT 1`;
  const user = rows[0] as { is_banned: boolean } | undefined;
  if (user?.is_banned) throw new Response('Account suspended', { status: 403 });
}

/**
 * Resolve the authenticated user's internal astrova_users.id from their auth_id,
 * then verify the requested userId matches (or the user is an admin).
 */
export async function requireOwnership(
  sql: Sql,
  authPayload: AuthPayload,
  requestedUserId: string,
): Promise<void> {
  const rows = await sql`SELECT id, role, is_banned FROM astrova_users WHERE auth_id = ${authPayload.sub} LIMIT 1`;
  const me = rows[0] as { id: string; role: string; is_banned: boolean } | undefined;
  if (!me) throw new Response('Forbidden', { status: 403 });
  // [FIX #41] Block banned users
  if (me.is_banned) throw new Response('Account suspended', { status: 403 });
  if (me.id !== requestedUserId && me.role !== 'admin') {
    throw new Response('Forbidden', { status: 403 });
  }
}
