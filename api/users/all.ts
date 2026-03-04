import { getDb, json } from '../_lib/db';
import { requireAuth } from '../_lib/auth';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  try {
    const payload = await requireAuth(req);
    const sql = getDb();

    // Verify requester is admin
    const adminCheck = await sql`SELECT role FROM astrova_users WHERE auth_id = ${payload.sub} LIMIT 1`;
    if (!adminCheck[0] || adminCheck[0].role !== 'admin') {
      return new Response('Forbidden', { status: 403 });
    }

    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM astrova_users ORDER BY created_at DESC`;
      return json(rows);
    }

    return new Response('Method Not Allowed', { status: 405 });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('[users/all]', e);
    return new Response('Internal Server Error', { status: 500 });
  }
}
