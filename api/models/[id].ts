import { getDb, json } from '../_lib/db';
import { requireAuth } from '../_lib/auth';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  try {
    const auth = await requireAuth(req);
    const sql = getDb();
    const url = new URL(req.url);
    const id = url.pathname.split('/').pop()!;

    // Only admins can modify models
    const adminCheck = await sql`SELECT role FROM astrova_users WHERE auth_id = ${auth.sub} LIMIT 1`;
    if (!adminCheck[0] || adminCheck[0].role !== 'admin') {
      return new Response('Forbidden', { status: 403 });
    }

    if (req.method === 'PATCH') {
      const { is_enabled } = await req.json() as { is_enabled: boolean };
      await sql`UPDATE enabled_models SET is_enabled = ${is_enabled} WHERE id = ${id}`;
      return json({ ok: true });
    }

    if (req.method === 'DELETE') {
      await sql`DELETE FROM enabled_models WHERE id = ${id}`;
      return json({ ok: true });
    }

    return new Response('Method Not Allowed', { status: 405 });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('[models/[id]]', e);
    return new Response('Internal Server Error', { status: 500 });
  }
}
