import { getDb, json } from './_lib/db';
import { requireAuth } from './_lib/auth';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  try {
    const payload = await requireAuth(req);
    const sql = getDb();

    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM astrova_users WHERE auth_id = ${payload.sub} LIMIT 1`;
      return json(rows[0] ?? null);
    }

    if (req.method === 'POST') {
      const { email, displayName, avatarUrl } = await req.json() as {
        email: string; displayName?: string; avatarUrl?: string;
      };

      // Try to find existing user
      const existing = await sql`SELECT * FROM astrova_users WHERE auth_id = ${payload.sub} LIMIT 1`;

      if (existing[0]) {
        await sql`UPDATE astrova_users SET last_login_at = now(), updated_at = now() WHERE auth_id = ${payload.sub}`;
        const updated = await sql`SELECT * FROM astrova_users WHERE auth_id = ${payload.sub} LIMIT 1`;
        return json(updated[0]);
      }

      // Create new user
      const newUser = await sql`
        INSERT INTO astrova_users (auth_id, email, display_name, avatar_url, credits)
        VALUES (${payload.sub}, ${email}, ${displayName ?? email.split('@')[0]}, ${avatarUrl ?? null}, 20)
        RETURNING *`;
      return json(newUser[0], 201);
    }

    return new Response('Method Not Allowed', { status: 405 });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('[users]', e);
    return new Response('Internal Server Error', { status: 500 });
  }
}
