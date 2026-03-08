import { getDb, json, jsonError, parseBody } from './_lib/db.js';
import { requireAuth } from './_lib/auth.js';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  try {
    const payload = await requireAuth(req);
    const sql = getDb();

    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM users WHERE auth_id = ${payload.sub} LIMIT 1`;
      return json(rows[0] ?? null);
    }

    if (req.method === 'POST') {
      // [FIX #21] Safe JSON parsing
      const { email, displayName, avatarUrl } = await parseBody<{
        email: string; displayName?: string; avatarUrl?: string;
      }>(req);

      // [FIX #8] Basic email validation
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return jsonError('Valid email is required');
      }

      const existing = await sql`SELECT * FROM users WHERE auth_id = ${payload.sub} LIMIT 1`;

      if (existing[0]) {
        const updated = await sql`
          UPDATE users
          SET email = COALESCE(${email}, email),
              display_name = COALESCE(${displayName ?? null}, display_name),
              avatar_url = COALESCE(${avatarUrl ?? null}, avatar_url),
              last_login_at = now(),
              updated_at = now()
          WHERE auth_id = ${payload.sub}
          RETURNING *`;
        // [FIX #40] Null check on returned data
        if (!updated[0]) return jsonError('User update failed', 500);
        return json(updated[0]);
      }

      // Safely extract display name from email
      const safeName = displayName ?? (email.includes('@') ? email.split('@')[0] : 'User');
      const newUser = await sql`
        INSERT INTO users (auth_id, email, display_name, avatar_url, credits)
        VALUES (${payload.sub}, ${email}, ${safeName}, ${avatarUrl ?? null}, 20)
        RETURNING *`;
      if (!newUser[0]) return jsonError('User creation failed', 500);
      return json(newUser[0], 201);
    }

    return new Response('Method Not Allowed', { status: 405 });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('[users]', e);
    return new Response('Internal Server Error', { status: 500 });
  }
}
