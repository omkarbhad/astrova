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

  // Query the astrova-db users table (not magnova_users)
  const rows = await sql`
    SELECT id, email, name, credits
    FROM users
    WHERE firebase_uid = ${firebaseUid}
    LIMIT 1`;
  const row = rows[0] as
    | { id: string; email: string; name: string | null; credits: number }
    | undefined;
  
  if (!row) {
    // User exists in magnova-auth but not in astrova yet - create them
    // This happens on first use of astrova after signing in via auth.magnova.ai
    const newUser = await sql`
      INSERT INTO users (firebase_uid, email, credits)
      VALUES (${firebaseUid}, '', 100)
      RETURNING id, email, name, credits`;
    const created = newUser[0] as { id: string; email: string; name: string | null; credits: number };
    return {
      id: created.id,
      firebase_uid: firebaseUid,
      email: created.email || '',
      display_name: created.name,
      avatar_url: null,
      credits: created.credits,
    };
  }

  return {
    id: row.id,
    firebase_uid: firebaseUid,
    email: row.email || '',
    display_name: row.name,
    avatar_url: null,
    credits: row.credits,
  };
}

export async function requireAdmin(sqlClient: Sql, authPayload: AuthPayload): Promise<{ id: string; role: string }> {
  // Simplified: no role column in users table yet - just check if user exists
  // TODO: add role column if needed
  const rows = await sqlClient`SELECT id FROM users WHERE firebase_uid = ${authPayload.firebase_uid} LIMIT 1`;
  const me = rows[0] as { id: string } | undefined;
  if (!me) throw new Response('Forbidden', { status: 403 });
  // For now, no admin check - return with empty role
  return { id: me.id, role: 'user' };
}

export async function requireNotBanned(sqlClient: Sql, authPayload: AuthPayload): Promise<void> {
  // Simplified: no is_banned column yet - just verify user exists
  const rows = await sqlClient`SELECT id FROM users WHERE firebase_uid = ${authPayload.firebase_uid} LIMIT 1`;
  if (!rows[0]) throw new Response('Forbidden', { status: 403 });
}

export async function requireOwnership(sqlClient: Sql, authPayload: AuthPayload, requestedUserId: string): Promise<void> {
  // Check if the authenticated user owns the requested resource
  const rows = await sqlClient`SELECT id FROM users WHERE firebase_uid = ${authPayload.firebase_uid} LIMIT 1`;
  const me = rows[0] as { id: string } | undefined;
  if (!me) throw new Response('Forbidden', { status: 403 });
  if (me.id !== requestedUserId) {
    throw new Response('Forbidden', { status: 403 });
  }
}
