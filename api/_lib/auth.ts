import type { Sql } from './db.js';
import { sql } from './db.js';

export interface AuthPayload {
  id: string;
  firebase_uid: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  credits: number;
}

const SESSION_COOKIE_NAME = 'magnova_session';

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
  const firebaseUid = extractSessionToken(req);
  if (!firebaseUid) throw new Response('Unauthorized', { status: 401 });

  const rows = await sql`
    SELECT id, auth_id, email, display_name, avatar_url, credits
    FROM astrova_users
    WHERE auth_id = ${firebaseUid}
    LIMIT 1`;
  const row = rows[0] as
    | { id: string; auth_id: string; email: string; display_name: string | null; avatar_url: string | null; credits: number }
    | undefined;

  if (!row) {
    // User exists in magnova-auth but not in astrova yet — create on first use
    const newUser = await sql`
      INSERT INTO astrova_users (auth_id, email, credits)
      VALUES (${firebaseUid}, '', 100)
      RETURNING id, auth_id, email, display_name, avatar_url, credits`;
    const created = newUser[0] as { id: string; auth_id: string; email: string; display_name: string | null; avatar_url: string | null; credits: number };
    return {
      id: created.id,
      firebase_uid: firebaseUid,
      email: created.email || '',
      display_name: created.display_name,
      avatar_url: created.avatar_url,
      credits: created.credits,
    };
  }

  return {
    id: row.id,
    firebase_uid: firebaseUid,
    email: row.email || '',
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

export async function requireOwnership(
  sqlClient: Sql,
  authPayload: AuthPayload,
  requestedUserId: string,
): Promise<void> {
  const rows = await sqlClient`SELECT id, role, is_banned FROM astrova_users WHERE auth_id = ${authPayload.firebase_uid} LIMIT 1`;
  const me = rows[0] as { id: string; role: string; is_banned: boolean } | undefined;
  if (!me) throw new Response('Forbidden', { status: 403 });
  if (me.is_banned) throw new Response('Account suspended', { status: 403 });
  if (me.id !== requestedUserId && me.role !== 'admin') {
    throw new Response('Forbidden', { status: 403 });
  }
}
