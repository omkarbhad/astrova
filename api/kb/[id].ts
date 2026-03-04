import { getDb, json } from '../_lib/db';
import { requireAuth } from '../_lib/auth';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  try {
    const auth = await requireAuth(req);
    const sql = getDb();
    const url = new URL(req.url);
    const id = url.pathname.split('/').pop()!;

    if (req.method === 'DELETE') {
      // Only admins can delete KB articles
      const adminCheck = await sql`SELECT role FROM astrova_users WHERE auth_id = ${auth.sub} LIMIT 1`;
      if (!adminCheck[0] || adminCheck[0].role !== 'admin') {
        return new Response('Forbidden', { status: 403 });
      }

      await sql`DELETE FROM astrova_knowledge_base WHERE id = ${id}`;
      return json({ ok: true });
    }

    return new Response('Method Not Allowed', { status: 405 });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('[kb/[id]]', e);
    return new Response('Internal Server Error', { status: 500 });
  }
}
