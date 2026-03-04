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

export async function requireAuth(req: Request): Promise<AuthPayload> {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/, '');
  if (!token) throw new Response('Unauthorized', { status: 401 });

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
