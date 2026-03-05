import { jwtVerify } from 'jose';
import type { Sql } from './db.js';

export interface AuthPayload {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
}

let _secret: Uint8Array | null = null;

function getSecret(): Uint8Array {
  if (!_secret) {
    const secret = process.env.SUPABASE_JWT_SECRET;
    if (!secret) throw new Error('SUPABASE_JWT_SECRET not set');
    _secret = new TextEncoder().encode(secret);
  }
  return _secret;
}

export async function requireAuth(req: Request): Promise<AuthPayload> {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/, '');
  if (!token) throw new Response('Unauthorized', { status: 401 });

  if (!token.startsWith('eyJ')) {
    throw new Response('Unauthorized - JWT token required', { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub) throw new Error('No sub in token');

    // Supabase JWT: email is top-level, name/picture are in user_metadata
    const meta = (payload as Record<string, unknown>).user_metadata as
      Record<string, string> | undefined;

    return {
      sub: payload.sub,
      email: payload.email as string | undefined,
      name: meta?.name ?? meta?.full_name ?? undefined,
      picture: meta?.avatar_url ?? meta?.picture ?? undefined,
    };
  } catch (e) {
    console.error('[auth] JWT verify failed:', e instanceof Error ? e.message : 'unknown');
    throw new Response('Unauthorized', { status: 401 });
  }
}

export async function requireAdmin(sql: Sql, authPayload: AuthPayload): Promise<{ id: string; role: string }> {
  const rows = await sql`SELECT id, role FROM astrova_users WHERE auth_id = ${authPayload.sub} LIMIT 1`;
  const me = rows[0] as { id: string; role: string } | undefined;
  if (!me || me.role !== 'admin') throw new Response('Forbidden', { status: 403 });
  return me;
}

export async function requireNotBanned(sql: Sql, authPayload: AuthPayload): Promise<void> {
  const rows = await sql`SELECT is_banned FROM astrova_users WHERE auth_id = ${authPayload.sub} LIMIT 1`;
  const user = rows[0] as { is_banned: boolean } | undefined;
  if (user?.is_banned) throw new Response('Account suspended', { status: 403 });
}

export async function requireOwnership(
  sql: Sql,
  authPayload: AuthPayload,
  requestedUserId: string,
): Promise<void> {
  const rows = await sql`SELECT id, role, is_banned FROM astrova_users WHERE auth_id = ${authPayload.sub} LIMIT 1`;
  const me = rows[0] as { id: string; role: string; is_banned: boolean } | undefined;
  if (!me) throw new Response('Forbidden', { status: 403 });
  if (me.is_banned) throw new Response('Account suspended', { status: 403 });
  if (me.id !== requestedUserId && me.role !== 'admin') {
    throw new Response('Forbidden', { status: 403 });
  }
}
