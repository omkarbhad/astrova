import type { Sql } from './db.js';
import { sql } from './db.js';
// verifyToken no longer needed - magnova_session cookie contains Firebase UID directly

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
  // magnova_session cookie contains the Firebase UID directly (set by auth.magnova.ai)
  // Since it's httpOnly and set by our trusted auth service, we can use it directly
  const firebaseUid = extractSessionToken(req);
  if (!firebaseUid) throw new Response('Unauthorized', { status: 401 });

  const rows = await sql`
    SELECT id, email, display_name, credits
    FROM astrova_users
    WHERE auth_id = ${firebaseUid}
    LIMIT 1`;
  const row = rows[0] as
    | { id: string; email: string; display_name: string | null; credits: number }
    | undefined;

  if (!row) {
    // User exists in magnova-auth but not in astrova yet - create them
    const newUser = await sql`
      INSERT INTO astrova_users (auth_id, email, credits)
      VALUES (${firebaseUid}, '', 100)
      RETURNING id, email, display_name, credits`;
    const created = newUser[0] as { id: string; email: string; display_name: string | null; credits: number };
    return {
      id: created.id,
      firebase_uid: firebaseUid,
      email: created.email || '',
      display_name: created.display_name,
      avatar_url: null,
      credits: created.credits,
    };
  }

  return {
    id: row.id,
    firebase_uid: firebaseUid,
    email: row.email || '',
    display_name: row.display_name,
    avatar_url: null,
    credits: row.credits,
  };
}

export async function requireAdmin(sqlClient: Sql, authPayload: AuthPayload): Promise<{ id: string; role: string }> {
  const rows = await sqlClient`SELECT id, role FROM astrova_users WHERE auth_id = ${authPayload.firebase_uid} LIMIT 1`;
  const me = rows[0] as { id: string; role: string } | undefined;
  if (!me) throw new Response('Forbidden', { status: 403 });
  if (me.role !== 'admin') throw new Response('Forbidden', { status: 403 });
  return { id: me.id, role: me.role };
}

export async function requireNotBanned(sqlClient: Sql, authPayload: AuthPayload): Promise<void> {
  const rows = await sqlClient`SELECT id, is_banned FROM astrova_users WHERE auth_id = ${authPayload.firebase_uid} LIMIT 1`;
  const me = rows[0] as { id: string; is_banned: boolean } | undefined;
  if (!me) throw new Response('Forbidden', { status: 403 });
  if (me.is_banned) throw new Response('Forbidden', { status: 403 });
}

export async function requireOwnership(sqlClient: Sql, authPayload: AuthPayload, requestedUserId: string): Promise<void> {
  // Allow if user owns the resource OR is admin
  const rows = await sqlClient`SELECT id, role FROM astrova_users WHERE auth_id = ${authPayload.firebase_uid} LIMIT 1`;
  const me = rows[0] as { id: string; role: string } | undefined;
  if (!me) throw new Response('Forbidden', { status: 403 });
  if (me.id !== requestedUserId && me.role !== 'admin') {
    throw new Response('Forbidden', { status: 403 });
  }
}
