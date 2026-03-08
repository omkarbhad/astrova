import { getDb, json } from '../_lib/db.js';
import { requireAuth, requireAdmin } from '../_lib/auth.js';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  try {
    const payload = await requireAuth(req);
    const sql = getDb();

    // [FIX #39] Use reusable admin check
    await requireAdmin(sql, payload);

    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM users ORDER BY created_at DESC`;
      return json(rows);
    }

    return new Response('Method Not Allowed', { status: 405 });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('[users/all]', e);
    return new Response('Internal Server Error', { status: 500 });
  }
}
