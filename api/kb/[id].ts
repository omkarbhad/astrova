import { getDb, json, jsonError } from '../_lib/db.js';
import { requireAuth, requireAdmin } from '../_lib/auth.js';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  try {
    const auth = await requireAuth(req);
    const sql = getDb();
    const url = new URL(req.url);
    const id = url.pathname.split('/').pop()!;

    if (req.method === 'DELETE') {
      await requireAdmin(sql, auth);

      // Verify article exists before deleting
      const existing = await sql`SELECT id FROM knowledge_base WHERE id = ${id} LIMIT 1`;
      if (!existing[0]) return jsonError('Article not found', 404);

      await sql`DELETE FROM knowledge_base WHERE id = ${id}`;
      return json({ ok: true });
    }

    return new Response('Method Not Allowed', { status: 405 });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('[kb/[id]]', e);
    return new Response('Internal Server Error', { status: 500 });
  }
}
