import type { Sql } from './db.js';
import { sql } from './db.js';
import { verifyToken } from './firebaseAdmin.js';

export interface AuthPayload {
  id: string;
  firebase_uid: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  credits: number;
}

const SESSION_COOKIE_NAME = 'magnova_session';
const APP_NAME = 'astrova';

function extractSessionToken(req: Request): string | null {
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) return null;

  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [name, ...valueParts] = part.trim().split('=');
    if (name === SESSION_COOKIE_NAME) {
      return decodeURIComponent(valueParts.join('='));
    }
  }

  return null;
}

export async function requireAuth(req: Request): Promise<AuthPayload> {
  const token = extractSessionToken(req);
  if (!token) throw new Response('Unauthorized', { status: 401 });

  let decoded;
  try {
    decoded = await verifyToken(token);
  } catch (error) {
    console.error('[auth] token verify failed', error);
    throw new Response('Unauthorized', { status: 401 });
  }

  const rows = await sql`
    SELECT u.id, u.email, u.display_name, u.avatar_url,
      COALESCE(c.balance, 0) AS credits
    FROM magnova_users u
    LEFT JOIN user_credits c ON c.user_id = u.id AND c.app = ${APP_NAME}
    WHERE u.firebase_uid = ${decoded.uid}
    LIMIT 1`;
  const row = rows[0] as
    | { id: string; email: string; display_name: string | null; avatar_url: string | null; credits: number }
    | undefined;
  if (!row) {
    throw new Response('Unauthorized', { status: 401 });
  }

  return {
    id: row.id,
    firebase_uid: decoded.uid,
    email: row.email,
    display_name: row.display_name,
    avatar_url: row.avatar_url,
    credits: row.credits,
  };
}

export async function requireAdmin(sqlClient: Sql, authPayload: AuthPayload): Promise<{ id: string; role: string }> {
  const rows = await sqlClient`SELECT id, role FROM astrova_users WHERE auth_id = ${authPayload.firebase_uid} LIMIT 1`;
  const me = rows[0] as { id: string; role: string } | undefined;
  if (!me || me.role !== 'admin') throw new Response('Forbidden', { status: 403 });
  return me;
}

export async function requireNotBanned(sqlClient: Sql, authPayload: AuthPayload): Promise<void> {
  const rows = await sqlClient`SELECT is_banned FROM astrova_users WHERE auth_id = ${authPayload.firebase_uid} LIMIT 1`;
  const user = rows[0] as { is_banned: boolean } | undefined;
  if (user?.is_banned) throw new Response('Account suspended', { status: 403 });
}

export async function requireOwnership(sqlClient: Sql, authPayload: AuthPayload, requestedUserId: string): Promise<void> {
  const rows = await sqlClient`SELECT id, role, is_banned FROM astrova_users WHERE auth_id = ${authPayload.firebase_uid} LIMIT 1`;
  const me = rows[0] as { id: string; role: string; is_banned: boolean } | undefined;
  if (!me) throw new Response('Forbidden', { status: 403 });
  if (me.is_banned) throw new Response('Account suspended', { status: 403 });
  if (me.id !== requestedUserId && me.role !== 'admin') {
    throw new Response('Forbidden', { status: 403 });
  }
}
