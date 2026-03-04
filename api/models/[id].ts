import { getDb, json, jsonError, parseBody } from '../_lib/db.js';
import { requireAuth, requireAdmin } from '../_lib/auth.js';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  try {
    const auth = await requireAuth(req);
    const sql = getDb();
    const url = new URL(req.url);
    const id = url.pathname.split('/').pop()!;

    // [FIX #39] Use reusable admin check
    await requireAdmin(sql, auth);

    if (req.method === 'PATCH') {
      // [FIX #21] Safe JSON parsing
      const { is_enabled } = await parseBody<{ is_enabled: boolean }>(req);
      await sql`UPDATE enabled_models SET is_enabled = ${Boolean(is_enabled)} WHERE id = ${id}`;
      return json({ ok: true });
    }

    if (req.method === 'DELETE') {
      // [FIX #38] Verify model exists
      const existing = await sql`SELECT id FROM enabled_models WHERE id = ${id} LIMIT 1`;
      if (!existing[0]) return jsonError('Model not found', 404);

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
