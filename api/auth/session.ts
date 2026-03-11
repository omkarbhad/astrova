import { json, parseBody, sql } from '../_lib/db.js';
import { verifyToken } from '../_lib/firebaseAdmin.js';

const COOKIE_NAME = 'magnova_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export const config = { runtime: 'edge' };

function buildCookie(req: Request, token: string): string {
  const { hostname, protocol } = new URL(req.url);
  const cookieParts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${COOKIE_MAX_AGE}`,
    'Path=/',
  ];

  if (protocol === 'https:') {
    cookieParts.push('Secure');
  }

  const configuredDomain = process.env.SESSION_COOKIE_DOMAIN;
  if (configuredDomain) {
    cookieParts.push(`Domain=${configuredDomain}`);
  } else if (hostname.endsWith('.magnova.ai')) {
    cookieParts.push('Domain=.magnova.ai');
  }

  return cookieParts.join('; ');
}

export default async function handler(req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const { token: bodyToken } = await parseBody<{ token?: string }>(req);
    const header = req.headers.get('authorization');
    const headerToken = header?.toLowerCase().startsWith('bearer ')
      ? header.slice(7).trim()
      : undefined;
    const token = headerToken || bodyToken;
    if (!token) {
      return new Response('Unauthorized', { status: 401 });
    }

    const decoded = await verifyToken(token);
    const email = decoded.email ?? '';
    const displayName = decoded.name ?? null;
    const avatarUrl = decoded.picture ?? null;

    const [astrovaUser] = await sql`
      INSERT INTO users (
        firebase_uid,
        email,
        name,
        display_name,
        avatar_url,
        credits,
        last_login_at,
        updated_at
      )
      VALUES (
        ${decoded.uid},
        ${email},
        ${displayName},
        ${displayName},
        ${avatarUrl},
        10,
        now(),
        now()
      )
      ON CONFLICT(firebase_uid)
      DO UPDATE SET
        email = EXCLUDED.email,
        name = COALESCE(EXCLUDED.name, users.name),
        display_name = COALESCE(EXCLUDED.display_name, users.display_name, users.name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
        last_login_at = now(),
        updated_at = now()
      RETURNING
        id,
        firebase_uid AS auth_id,
        email,
        COALESCE(display_name, name) AS display_name,
        avatar_url,
        role,
        is_banned,
        credits,
        credits_used,
        last_login_at,
        created_at`;

    const response = json({ user: astrovaUser ?? null });
    response.headers.set('Set-Cookie', buildCookie(req, decoded.uid));
    return response;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[auth][session]', msg);
    if (error instanceof Response) return error;
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
