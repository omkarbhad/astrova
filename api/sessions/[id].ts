import { getDb, json } from '../_lib/db.js';
import { requireAuth, requireOwnership } from '../_lib/auth.js';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  try {
    const auth = await requireAuth(req);
    const sql = getDb();
    const url = new URL(req.url);
    const id = url.pathname.split('/').pop()!;

    // Verify the session belongs to the authenticated user
    const session = await sql`SELECT user_id FROM astrova_chat_sessions WHERE id = ${id} LIMIT 1`;
    if (!session[0]) return json({ error: 'Not found' }, 404);
    await requireOwnership(sql, auth, session[0].user_id as string);

    if (req.method === 'DELETE') {
      await sql`DELETE FROM astrova_chat_sessions WHERE id = ${id}`;
      return json({ ok: true });
    }

    return new Response('Method Not Allowed', { status: 405 });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('[sessions/[id]]', e);
    return new Response('Internal Server Error', { status: 500 });
  }
}
